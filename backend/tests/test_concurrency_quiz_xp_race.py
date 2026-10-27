"""
Phase 3 — Concurrency test: SEC-RACE-01 (Quiz XP duplicate award).

EXPECTED RESULT: This test suite FAILS before the race is fixed.

Race description
----------------
grade_quiz_attempt() checks for prior XP with a non-atomic SELECT, then awards
via _award_xp() which uses a savepoint + IntegrityError catch.

Two problems:
  1. xp_total lost-update: `user.xp_total += amount` inside _do_insert() is a
     Python-side read-modify-write.  Under READ COMMITTED, two concurrent sessions
     can both read the same baseline value, both add the amount, and the second
     commit overwrites the first — leaving xp_total equal to one award, not two.
     (Note: for the quiz race this is the XP amount for one quiz pass, so the
     arithmetic is that either 0 or 1 XPTransaction commit succeeds — but with the
     xp_total+=amount happening inside the savepoint, the loser's savepoint is
     rolled back, so the loser's user object still carries a stale +amount in
     memory from _do_insert up to where it was rolled back. The outer transaction
     then commits the wrong xp_total value.)
  2. xp_awarded flag set unconditionally: grading.py:125 sets
     `attempt.xp_awarded = True` regardless of whether _award_xp returned True or
     False.  So a losing attempt is marked as awarded even though no XPTransaction
     exists for it.

Failure assertions (what should hold but doesn't):
  A. xp_transactions has exactly 1 row (unique constraint may stop 2 inserts, but
     assertion might pass here — the *real* failure is B and C).
  B. users.xp_total == quiz.xp_reward (not 2× and not 0).
  C. For the attempt where xp_awarded=True but NO XPTransaction exists → data
     inconsistency.  We assert that every attempt with xp_awarded=True has a
     corresponding XPTransaction row.

Strategy
--------
We call grade_quiz_attempt() directly (service layer, not HTTP) with two separate
AsyncSession objects, each on its own connection, interleaved with asyncio.gather
to maximise the chance of the race window being hit.  Because asyncio is
single-threaded, we use multiple real asyncpg connections to get true concurrent
PostgreSQL transactions.
"""

import asyncio
import uuid
import pytest
import psycopg2
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.services.grading import grade_quiz_attempt
from app.models import User, UserProfile, Quiz, QuizQuestion
from app.security import hash_password
from app.database import Base

import os

# ── helpers ──────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:sandeep%402004@localhost:5432/cm_test",
)
DATABASE_URL_SYNC = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://postgres:sandeep%402004@localhost:5432/cm_test",
)

CONCURRENCY = 5   # simultaneous grading calls for the same quiz / same user


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


# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def quiz_info():
    """Return the first seeded quiz slug and its correct answers from the DB."""
    with psycopg2.connect(DATABASE_URL_SYNC) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT q.id, q.xp_reward, q.passing_score "
                "FROM quizzes q WHERE q.is_published = true LIMIT 1"
            )
            row = cur.fetchone()
            assert row is not None, "No published quiz found — run seed first"
            quiz_id, xp_reward, passing_score = row

            cur.execute(
                "SELECT id, correct_option_id FROM quiz_questions WHERE quiz_id = %s",
                (quiz_id,),
            )
            questions = cur.fetchall()
            assert questions, "Quiz has no questions"

    correct_answers = {str(q[0]): q[1] for q in questions}
    return {
        "quiz_id": quiz_id,
        "xp_reward": xp_reward,
        "passing_score": float(passing_score),
        "correct_answers": correct_answers,
    }


@pytest.fixture()
def fresh_user(clean_database_between_tests):  # noqa: F811 — depends on autouse fixture
    """Create one test user and return their UUID."""
    with psycopg2.connect(DATABASE_URL_SYNC) as conn:
        with conn.cursor() as cur:
            user_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO users (id, email, full_name, hashed_password, role, "
                "is_active, is_verified, xp_total, level, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, 'learner', true, true, 0, 1, now(), now())",
                (user_id, f"race-quiz-{user_id[:8]}@test.local",
                 "Race Tester", hash_password("TestPass1!")),
            )
            cur.execute(
                "INSERT INTO user_profiles (id, user_id, onboarding_completed, "
                "domain_scores, created_at, updated_at) VALUES (%s, %s, true, '{}', now(), now())",
                (str(uuid.uuid4()), user_id),
            )
        conn.commit()
    return uuid.UUID(user_id)


# ── concurrency helper ────────────────────────────────────────────────────────

async def _one_grade_call(engine, user_id, quiz_id, answers):
    """Open a fresh connection, grade the quiz, commit, return attempt."""
    factory = _make_session_factory(engine)
    async with factory() as session:
        async with session.begin():
            try:
                attempt = await grade_quiz_attempt(
                    db=session,
                    user_id=user_id,
                    quiz_id=quiz_id,
                    answers=answers,
                )
                return attempt
            except Exception as exc:
                return exc   # return exception instead of raising to not abort gather


# ── tests ─────────────────────────────────────────────────────────────────────

class TestQuizXpRace:
    """
    SEC-RACE-01: concurrent quiz submissions for the same user+quiz.

    Expected (correct) behaviour after fix:
      • Exactly 1 XPTransaction row per user per quiz.
      • users.xp_total == quiz.xp_reward  (not doubled, not zero).
      • Every attempt with xp_awarded=True has a matching XPTransaction.

    Current (buggy) behaviour:
      • xp_awarded=True may appear on an attempt whose XPTransaction was rolled back.
      • xp_total may be wrong (double-awarded or inconsistently updated).
    """

    @pytest.mark.asyncio
    async def test_exactly_one_xp_transaction_per_quiz_pass(
        self, fresh_user, quiz_info
    ):
        """
        SEC-RACE-01-A: After N concurrent correct submissions, only 1 XPTransaction
        must exist.

        EXPECTED TO FAIL before fix: the unique constraint on quiz_attempt_id
        prevents double inserts at the DB level, but the application-layer check
        (SELECT prior xp_awarded) races and may let through multiple _award_xp calls,
        each for a *different* attempt.id — so the unique constraint does NOT catch it.
        """
        engine = _make_engine()
        try:
            results = await asyncio.gather(
                *[
                    _one_grade_call(
                        engine,
                        fresh_user,
                        quiz_info["quiz_id"],
                        quiz_info["correct_answers"],
                    )
                    for _ in range(CONCURRENCY)
                ]
            )
        finally:
            await engine.dispose()

        successes = [r for r in results if not isinstance(r, Exception)]
        errors    = [r for r in results if isinstance(r, Exception)]
        print(f"\n  Successful grade calls: {len(successes)}, errors: {len(errors)}")
        for e in errors:
            print(f"  Error: {type(e).__name__}: {e}")

        # At least 1 must have succeeded (otherwise test setup is wrong)
        assert successes, f"All grade calls failed: {errors}"

        # ── DB assertions ──
        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM xp_transactions WHERE user_id = %s",
                    (str(fresh_user),),
                )
                xp_tx_count = cur.fetchone()[0]

                cur.execute(
                    "SELECT xp_total FROM users WHERE id = %s",
                    (str(fresh_user),),
                )
                xp_total = cur.fetchone()[0]

        print(f"  xp_transactions count: {xp_tx_count}")
        print(f"  users.xp_total:        {xp_total}")
        print(f"  quiz.xp_reward:        {quiz_info['xp_reward']}")

        # ── This assertion SHOULD FAIL before the fix ──
        assert xp_tx_count == 1, (
            f"SEC-RACE-01 PROVEN: expected 1 XPTransaction, got {xp_tx_count}. "
            "Double XP award detected."
        )

    @pytest.mark.asyncio
    async def test_xp_total_equals_exactly_one_reward(
        self, fresh_user, quiz_info
    ):
        """
        SEC-RACE-01-B: users.xp_total must equal exactly quiz.xp_reward after
        concurrent passes.  A doubled value proves the lost-update on xp_total.
        """
        engine = _make_engine()
        try:
            await asyncio.gather(
                *[
                    _one_grade_call(
                        engine,
                        fresh_user,
                        quiz_info["quiz_id"],
                        quiz_info["correct_answers"],
                    )
                    for _ in range(CONCURRENCY)
                ]
            )
        finally:
            await engine.dispose()

        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT xp_total FROM users WHERE id = %s",
                    (str(fresh_user),),
                )
                xp_total = cur.fetchone()[0]

        print(f"\n  users.xp_total={xp_total}, expected={quiz_info['xp_reward']}")

        # ── This assertion SHOULD FAIL before the fix ──
        assert xp_total == quiz_info["xp_reward"], (
            f"SEC-RACE-01-B PROVEN: xp_total={xp_total} != xp_reward={quiz_info['xp_reward']}. "
            "Lost-update or double-award on xp_total."
        )

    @pytest.mark.asyncio
    async def test_xp_awarded_flag_consistent_with_transactions(
        self, fresh_user, quiz_info
    ):
        """
        SEC-RACE-01-C: Every quiz_attempt with xp_awarded=True must have exactly
        one matching XPTransaction.  This catches the unconditional
        `attempt.xp_awarded = True` bug (grading.py:125).
        """
        engine = _make_engine()
        try:
            await asyncio.gather(
                *[
                    _one_grade_call(
                        engine,
                        fresh_user,
                        quiz_info["quiz_id"],
                        quiz_info["correct_answers"],
                    )
                    for _ in range(CONCURRENCY)
                ]
            )
        finally:
            await engine.dispose()

        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                # attempts flagged as awarded
                cur.execute(
                    "SELECT id FROM quiz_attempts "
                    "WHERE user_id = %s AND xp_awarded = true",
                    (str(fresh_user),),
                )
                awarded_attempt_ids = [r[0] for r in cur.fetchall()]

                orphans = []
                for aid in awarded_attempt_ids:
                    cur.execute(
                        "SELECT COUNT(*) FROM xp_transactions WHERE quiz_attempt_id = %s",
                        (str(aid),),
                    )
                    tx_count = cur.fetchone()[0]
                    if tx_count != 1:
                        orphans.append((str(aid), tx_count))

        print(f"\n  Attempts with xp_awarded=True: {len(awarded_attempt_ids)}")
        print(f"  Orphan attempts (no matching XPTransaction): {orphans}")

        # ── This assertion SHOULD FAIL before the fix ──
        assert not orphans, (
            f"SEC-RACE-01-C PROVEN: {len(orphans)} attempt(s) have xp_awarded=True "
            f"but no matching XPTransaction: {orphans}. "
            "Unconditional xp_awarded=True flag is the bug."
        )

        # Strengthened assertions: exactly one attempt has xp_awarded=True,
        # all other attempts exist, are scored, and have xp_awarded=False
        with psycopg2.connect(DATABASE_URL_SYNC) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, score, passed, xp_awarded FROM quiz_attempts WHERE user_id = %s",
                    (str(fresh_user),),
                )
                all_attempts = cur.fetchall()

        assert len(all_attempts) == CONCURRENCY, f"Expected {CONCURRENCY} total attempts, got {len(all_attempts)}"
        awarded_count = sum(1 for a in all_attempts if a[3] is True)
        unawarded_count = sum(1 for a in all_attempts if a[3] is False)
        assert awarded_count == 1, f"Expected exactly 1 attempt with xp_awarded=True, got {awarded_count}"
        assert unawarded_count == CONCURRENCY - 1, f"Expected {CONCURRENCY - 1} unawarded attempts, got {unawarded_count}"
        for a in all_attempts:
            assert a[1] is not None and a[1] >= 70.0, f"Attempt {a[0]} missing score or not passed"
            assert a[2] is True, f"Attempt {a[0]} passed flag is not True"
