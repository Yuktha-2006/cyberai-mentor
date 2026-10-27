"""
Measure 10-run concurrency behavior of 20 parallel submissions:
Condition 1: With advisory lock present (baseline fix)
Condition 2: With advisory lock removed (mutation)
"""

import asyncio
import os
import sys
import uuid
import psycopg2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

pg_url = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://postgres:sandeep%402004@localhost:5432/cm_test")
sync_url = os.environ.get("DATABASE_URL_SYNC", "postgresql://postgres:sandeep%402004@localhost:5432/cm_test")
os.environ["DATABASE_URL"] = pg_url

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy import select

from app import database
from app.models import User, UserRole, Quiz, QuizQuestion, QuizAttempt
from app.services.grading import grade_quiz_attempt, MaxAttemptsExceededError

engine = create_async_engine(pg_url, poolclass=NullPool)
database.engine = engine
database.AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autocommit=False, autoflush=False)

async def setup_test_quiz():
    async with database.AsyncSessionLocal() as session:
        quiz_res = await session.execute(select(Quiz).where(Quiz.slug == "network-defense-quiz"))
        quiz = quiz_res.scalar_one()
        q_res = await session.execute(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.order_index))
        questions = q_res.scalars().all()
        correct_answers = {str(q.id): q.correct_option_id for q in questions}
        return str(quiz.id), correct_answers

async def create_user(idx: int):
    async with database.AsyncSessionLocal() as session:
        user = User(
            email=f"race_lock_{idx}_{uuid.uuid4().hex[:6]}@example.com",
            full_name=f"Race User {idx}",
            hashed_password="dummy_hash_value",
            role=UserRole.learner,
        )
        session.add(user)
        await session.commit()
        return user.id

async def _one_grade_call(user_id, quiz_id, answers):
    async with database.AsyncSessionLocal() as session:
        try:
            res = await grade_quiz_attempt(
                db=session,
                user_id=user_id,
                quiz_id=uuid.UUID(quiz_id),
                answers=answers,
            )
            await session.commit()
            return res
        except Exception as e:
            await session.rollback()
            return e

async def run_burst(user_id, quiz_id, answers, n=20):
    tasks = [_one_grade_call(user_id, quiz_id, answers) for _ in range(n)]
    results = await asyncio.gather(*tasks)
    return results

async def count_attempts_in_db(user_id):
    with psycopg2.connect(sync_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT attempt_number FROM quiz_attempts WHERE user_id = %s ORDER BY attempt_number", (str(user_id),))
            rows = [r[0] for r in cur.fetchall()]
            return rows

async def main():
    quiz_id, answers = await setup_test_quiz()

    print("=================================================================")
    print("RUNNING 10 ITERATIONS WITH ADVISORY LOCK ENABLED (BASELINE FIX)")
    print("=================================================================")
    print("Run | DB Attempts | Attempt Numbers | MaxAttemptsErr | Other (Integrity/500)")
    print("-" * 65)

    for r in range(1, 11):
        uid = await create_user(r)
        results = await run_burst(uid, quiz_id, answers, 20)
        attempts = await count_attempts_in_db(uid)
        max_errs = sum(1 for x in results if isinstance(x, MaxAttemptsExceededError))
        other_errs = sum(1 for x in results if isinstance(x, Exception) and not isinstance(x, MaxAttemptsExceededError))
        print(f"{r:>3} | {len(attempts):>11} | {str(attempts):<15} | {max_errs:>14} | {other_errs:>22}")

    print("\n=================================================================")
    print("MUTATION CHECK: 10 RUNS WITH ADVISORY LOCK REMOVED (COUNT RACE)")
    print("=================================================================")
    print("Run | DB Attempts | Attempt Numbers | MaxAttemptsErr | Integrity Violations")
    print("-" * 65)

    # Monkeypatch to bypass advisory lock
    import app.services.grading as grading_module
    orig_grade = grading_module.grade_quiz_attempt

    # We patch grading_module so db.execute(select(func.pg_advisory_xact_lock)) is skipped
    from unittest.mock import patch

    async def run_without_lock():
        for r in range(1, 11):
            uid = await create_user(r + 100)
            # Monkeypatch dialect name to 'not_postgresql' during lock check
            with patch.object(database.engine.dialect, "name", "mock_no_lock"):
                results = await run_burst(uid, quiz_id, answers, 20)
            attempts = await count_attempts_in_db(uid)
            max_errs = sum(1 for x in results if isinstance(x, MaxAttemptsExceededError))
            # Check for IntegrityError / other errors caused by concurrent attempts colliding
            other_errs = sum(1 for x in results if isinstance(x, Exception) and not isinstance(x, MaxAttemptsExceededError))
            print(f"{r:>3} | {len(attempts):>11} | {str(attempts):<15} | {max_errs:>14} | {other_errs:>22}")

    await run_without_lock()

if __name__ == "__main__":
    asyncio.run(main())
