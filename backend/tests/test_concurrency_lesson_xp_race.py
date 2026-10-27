"""
Phase 3 — Concurrency test: SEC-RACE-02 (Lost update on xp_total across different lessons).

EXPECTED RESULT: This test suite FAILS before the race is fixed.

Race description
----------------
complete_lesson() marks a lesson complete and calls _award_xp() to award XP.
Inside _award_xp(), updating the user's XP is done via:
    user.xp_total += amount
    user.level = _compute_level(user.xp_total)
This is an in-memory Python-side read-modify-write.

When a user completes two *different* lessons concurrently:
  1. Both requests start separate DB transactions under READ COMMITTED.
  2. Both load user where xp_total = 0.
  3. Lesson 1 adds 50 (xp_total = 50).
  4. Lesson 2 adds 50 (xp_total = 50).
  5. Both flush/commit.
  6. Final DB state: xp_total = 50 instead of 100! (Lost update).

Both lessons have distinct lesson_progress records and unique constraints on
lesson_progress_id do NOT conflict, so both XPTransaction rows succeed.
However, user.xp_total will be short by 50 XP.

Failure assertions:
  A. xp_transactions has 2 rows (one for each lesson).
  B. users.xp_total == lesson1.xp_reward + lesson2.xp_reward (e.g. 50 + 50 = 100).
     Under the read-modify-write race, xp_total is 50.
"""

import asyncio
import os
import uuid
import pytest
import psycopg2
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.services.grading import complete_lesson
from app.security import hash_password

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:sandeep%402004@localhost:5432/cm_test",
)
DATABASE_URL_SYNC = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://postgres:sandeep%402004@localhost:5432/cm_test",
)


def _make_engine():
    return create_async_engine(DATABASE_URL, poolclass=NullPool)


def _make_session_factory(engine):
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


@pytest.fixture(scope="module")
def two_lessons():
    """Retrieve two different published lessons from seed data."""
    with psycopg2.connect(DATABASE_URL_SYNC) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, xp_reward, slug FROM lessons WHERE is_published = true ORDER BY order_index LIMIT 2"
            )
            rows = cur.fetchall()
            assert len(rows) >= 2, "Need at least 2 published lessons seeded"
    return [
        {"id": row[0], "xp_reward": row[1], "slug": row[2]}
        for row in rows
    ]


@pytest.fixture()
def fresh_user(clean_database_between_tests):
    """Create one test user and return their UUID."""
    with psycopg2.connect(DATABASE_URL_SYNC) as conn:
        with conn.cursor() as cur:
            user_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO users (id, email, full_name, hashed_password, role, "
                "is_active, is_verified, xp_total, level, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, 'learner', true, true, 0, 1, now(), now())",
                (user_id, f"race-lesson-{user_id[:8]}@test.local",
                 "Race Tester", hash_password("TestPass1!")),
            )
            cur.execute(
                "INSERT INTO user_profiles (id, user_id, onboarding_completed, "
                "domain_scores, created_at, updated_at) VALUES (%s, %s, true, '{}', now(), now())",
                (str(uuid.uuid4()), user_id),
            )
        conn.commit()
    return uuid.UUID(user_id)


async def _one_complete_call(engine, user_id, lesson_id):
    factory = _make_session_factory(engine)
    async with factory() as session:
        async with session.begin():
            try:
                progress, just_awarded = await complete_lesson(
                    db=session,
                    user_id=user_id,
                    lesson_id=lesson_id,
                )
                return progress, just_awarded
            except Exception as exc:
                return exc


class TestLessonXpRace:
    """
    SEC-RACE-02: Concurrent completion of two DIFFERENT lessons for the same user.
    """

    @pytest.mark.asyncio
    async def test_concurrent_different_lessons_lost_update(
        self, fresh_user, two_lessons
    ):
        lesson1 = two_lessons[0]
        lesson2 = two_lessons[1]
        expected_xp = lesson1["xp_reward"] + lesson2["xp_reward"]

        engine = _make_engine()
        try:
            results = await asyncio.gather(
                _one_complete_call(engine, fresh_user, lesson1["id"]),
                _one_complete_call(engine, fresh_user, lesson2["id"]),
            )
        finally:
            await engine.dispose()

        successes = [r for r in results if not isinstance(r, Exception)]
        errors = [r for r in results if isinstance(r, Exception)]
        print(f"\n  Successful complete calls: {len(successes)}, errors: {len(errors)}")

        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM xp_transactions WHERE user_id = %s",
                    (str(fresh_user),),
                )
                tx_count = cur.fetchone()[0]

                cur.execute(
                    "SELECT xp_total FROM users WHERE id = %s",
                    (str(fresh_user),),
                )
                actual_xp = cur.fetchone()[0]

        print(f"  xp_transactions count: {tx_count} (expected 2)")
        print(f"  users.xp_total:        {actual_xp} (expected {expected_xp})")

        assert tx_count == 2, f"Expected 2 XP transactions, got {tx_count}"
        assert actual_xp == expected_xp, (
            f"SEC-RACE-02 PROVEN: Lost update on xp_total! Expected {expected_xp}, got {actual_xp}."
        )

    @pytest.mark.asyncio
    async def test_twenty_request_lesson_burst_idempotency(
        self, fresh_user, two_lessons
    ):
        """20 concurrent completions of the EXACT SAME lesson for a user."""
        lesson = two_lessons[0]
        engine = _make_engine()
        try:
            results = await asyncio.gather(
                *[_one_complete_call(engine, fresh_user, lesson["id"]) for _ in range(20)]
            )
        finally:
            await engine.dispose()

        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM xp_transactions WHERE user_id = %s",
                    (str(fresh_user),),
                )
                tx_count = cur.fetchone()[0]

                cur.execute(
                    "SELECT xp_total FROM users WHERE id = %s",
                    (str(fresh_user),),
                )
                actual_xp = cur.fetchone()[0]

        assert tx_count == 1, f"Expected exactly 1 XPTransaction, got {tx_count}"
        assert actual_xp == lesson["xp_reward"], f"Expected {lesson['xp_reward']} XP, got {actual_xp}"

    @pytest.mark.asyncio
    async def test_cross_user_concurrent_isolation(
        self, two_lessons
    ):
        """Two different users completing lessons concurrently without interference."""
        user_ids = []
        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                for idx in range(2):
                    uid = str(uuid.uuid4())
                    cur.execute(
                        "INSERT INTO users (id, email, full_name, hashed_password, role, "
                        "is_active, is_verified, xp_total, level, created_at, updated_at) "
                        "VALUES (%s, %s, %s, %s, 'learner', true, true, 0, 1, now(), now())",
                        (uid, f"cross-user-{idx}-{uid[:6]}@test.local", "User", hash_password("Pass123!")),
                    )
                    user_ids.append(uuid.UUID(uid))
            conn.commit()

        lesson1 = two_lessons[0]
        lesson2 = two_lessons[1]

        engine = _make_engine()
        try:
            await asyncio.gather(
                _one_complete_call(engine, user_ids[0], lesson1["id"]),
                _one_complete_call(engine, user_ids[0], lesson2["id"]),
                _one_complete_call(engine, user_ids[1], lesson1["id"]),
                _one_complete_call(engine, user_ids[1], lesson2["id"]),
            )
        finally:
            await engine.dispose()

        expected_total = lesson1["xp_reward"] + lesson2["xp_reward"]
        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                for uid in user_ids:
                    cur.execute("SELECT xp_total FROM users WHERE id = %s", (str(uid),))
                    xp = cur.fetchone()[0]
                    assert xp == expected_total, f"User {uid} expected {expected_total} XP, got {xp}"
