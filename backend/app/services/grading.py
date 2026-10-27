"""
Deterministic grading service.

RULE: This module is the ONLY code that may compute scores and award XP.
The AI mentor calls this module's results — it never writes grades itself.
All XP awards are idempotent (guarded by xp_awarded flag + unique constraints).
"""

from decimal import Decimal
from typing import Any
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.exc import IntegrityError

from app.models import (
    Quiz, QuizQuestion, QuizAttempt, XPTransaction,
    LessonProgress, Lesson, User, SubmissionStatus
)


class GradingError(Exception):
    pass


class DuplicateSubmissionError(GradingError):
    pass


class MaxAttemptsExceededError(GradingError):
    pass


async def grade_quiz_attempt(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    answers: dict[str, str],  # {question_id: selected_option_id}
) -> QuizAttempt:
    """
    Grade a quiz attempt deterministically.

    Steps:
    1. Load quiz + questions (with correct answers).
    2. Check attempt count against max_attempts.
    3. Compute score: (correct / total) * 100.
    4. Persist QuizAttempt with graded status.
    5. Award XP exactly once if passing (idempotency via xp_awarded flag).
    6. Update user.xp_total and user.level atomically.

    Returns the persisted QuizAttempt.
    """
    # Load quiz
    quiz_result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.is_published == True))
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise GradingError("Quiz not found or not published.")

    # Load questions
    q_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id).order_by(QuizQuestion.order_index)
    )
    questions = q_result.scalars().all()
    if not questions:
        raise GradingError("Quiz has no questions.")

    # Serialize attempt counting per user and quiz using PostgreSQL transaction-level advisory lock
    # or fallback to database savepoint to eliminate count-then-insert race on max_attempts
    if db.bind and db.bind.dialect.name == "postgresql":
        # Form stable 64-bit bigint lock key from (user_id, quiz_id)
        lock_key = (hash(user_id) ^ hash(quiz_id)) & 0x7FFFFFFFFFFFFFFF
        await db.execute(select(func.pg_advisory_xact_lock(lock_key)))

    # Count previous attempts
    attempt_count_result = await db.execute(
        select(func.count()).where(QuizAttempt.user_id == user_id, QuizAttempt.quiz_id == quiz_id)
    )
    attempt_count = attempt_count_result.scalar() or 0

    if attempt_count >= quiz.max_attempts:
        raise MaxAttemptsExceededError(f"Maximum attempts ({quiz.max_attempts}) reached.")

    # ── Deterministic scoring ──────────────────────────────────────────────
    total_points = sum(q.points for q in questions)
    earned_points = 0

    for question in questions:
        selected = answers.get(str(question.id))
        if selected == question.correct_option_id:
            earned_points += question.points

    score = Decimal(str(round((earned_points / total_points) * 100, 2))) if total_points > 0 else Decimal("0")
    passed = score >= quiz.passing_score

    # ── Persist attempt ────────────────────────────────────────────────────
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        answers=answers,
        score=score,
        passed=passed,
        status=SubmissionStatus.graded,
        attempt_number=attempt_count + 1,
        xp_awarded=False,
        quiz_content_version=quiz.content_version,
    )
    db.add(attempt)
    await db.flush()  # Get attempt.id before XP award

    # ── Award XP (idempotent, only on first pass) ──────────────────────────
    if passed and not attempt.xp_awarded:
        # Check: has XP been awarded for ANY prior passing attempt on this quiz for this user?
        prior_xp_result = await db.execute(
            select(QuizAttempt).where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.xp_awarded == True,
                QuizAttempt.id != attempt.id,
            )
        )
        if prior_xp_result.scalars().first() is None:
            awarded = await _award_xp(
                db=db,
                user_id=user_id,
                amount=quiz.xp_reward,
                reason=f"Passed quiz: {quiz.slug}",
                quiz_attempt_id=attempt.id,
                quiz_id=quiz.id,
            )
            attempt.xp_awarded = awarded

    await db.flush()
    return attempt


async def complete_lesson(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    lesson_id: uuid.UUID,
) -> LessonProgress:
    """
    Mark a lesson complete and award XP once.
    Idempotent: safe to call multiple times.
    """
    lesson_result = await db.execute(
        select(Lesson).where(Lesson.id == lesson_id, Lesson.is_published == True)
    )
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise GradingError("Lesson not found or not published.")

    # Get or create progress record
    prog_result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id,
            LessonProgress.lesson_id == lesson_id,
        )
    )
    progress = prog_result.scalar_one_or_none()

    if progress is None:
        try:
            nested = db.begin_nested() if hasattr(db, "begin_nested") else None
            if hasattr(nested, "__aenter__"):
                async with nested:
                    progress = LessonProgress(user_id=user_id, lesson_id=lesson_id)
                    db.add(progress)
                    await db.flush()
            else:
                progress = LessonProgress(user_id=user_id, lesson_id=lesson_id)
                db.add(progress)
                await db.flush()
        except IntegrityError:
            prog_result = await db.execute(
                select(LessonProgress).where(
                    LessonProgress.user_id == user_id,
                    LessonProgress.lesson_id == lesson_id,
                )
            )
            progress = prog_result.scalar_one()

    # Award XP only once (concurrency safe)
    just_awarded = False
    if not progress.xp_awarded:
        awarded = await _award_xp(
            db=db,
            user_id=user_id,
            amount=lesson.xp_reward,
            reason=f"Completed lesson: {lesson.slug}",
            lesson_progress_id=progress.id,
        )
        progress.completed = True
        progress.completed_at = datetime.now(timezone.utc)
        if awarded:
            progress.xp_awarded = True
            just_awarded = True
        else:
            progress.xp_awarded = True
    elif not progress.completed:
        progress.completed = True
        progress.completed_at = datetime.now(timezone.utc)

    await db.flush()
    return progress, just_awarded


async def _award_xp(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    reason: str,
    quiz_attempt_id: uuid.UUID | None = None,
    quiz_id: uuid.UUID | None = None,
    lesson_progress_id: uuid.UUID | None = None,
) -> bool:
    """
    Internal: create an XPTransaction and update user totals.
    Called ONLY from grade_quiz_attempt and complete_lesson.
    Returns True if awarded, False if already awarded concurrently.
    """
    if amount <= 0:
        return False

    async def _do_insert():
        txn = XPTransaction(
            user_id=user_id,
            amount=amount,
            reason=reason,
            quiz_attempt_id=quiz_attempt_id,
            quiz_id=quiz_id,
            lesson_progress_id=lesson_progress_id,
        )
        db.add(txn)
        await db.flush()

        # Atomic SQL update: row-locks the user in PostgreSQL, serializing concurrent updates
        update_res = await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(xp_total=User.xp_total + amount)
            .returning(User.xp_total)
        )
        new_xp_total = update_res.scalar_one()

        # Update level computed deterministically from the newly returned total
        new_level = _compute_level(new_xp_total)
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(level=new_level)
        )
        await db.flush()
        return True

    try:
        async with db.begin_nested():
            return await _do_insert()
    except IntegrityError:
        # Concurrent request already committed the unique XP transaction
        return False


def _compute_level(xp: int) -> int:
    """
    Level thresholds (can be tuned without changing the data model):
    Level 1:   0–99 XP
    Level 2: 100–249 XP
    Level 3: 250–499 XP
    Level N: follows 100 * N * (N-1) / 2 formula
    """
    level = 1
    while xp >= _level_threshold(level + 1):
        level += 1
        if level >= 50:  # Cap
            break
    return level


def _level_threshold(level: int) -> int:
    """XP required to reach a given level."""
    return 100 * level * (level - 1) // 2
