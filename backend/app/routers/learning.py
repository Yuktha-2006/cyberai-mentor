"""
Learning API: lessons, quizzes, progress.
All grading delegated to services/grading.py.
Every endpoint enforces ownership — users can only read/write their own data.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Module, Lesson, Quiz, QuizQuestion, LessonProgress, QuizAttempt, UserProfile
)
from app.routers.auth import CurrentUser
from app.services.grading import (
    grade_quiz_attempt, complete_lesson,
    GradingError, MaxAttemptsExceededError, DuplicateSubmissionError
)

router = APIRouter(prefix="/api/v1/learn", tags=["learning"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModuleOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    career_path: str
    difficulty: str
    xp_reward: int
    lesson_count: int

    model_config = {"from_attributes": True}


class LessonOut(BaseModel):
    id: str
    slug: str
    title: str
    content_md: str   # Sanitized in frontend with DOMPurify
    order_index: int
    xp_reward: int
    estimated_minutes: int

    model_config = {"from_attributes": True}


class QuizQuestionOut(BaseModel):
    """Correct answer is NEVER included in this output."""
    id: str
    question_text: str
    options: list[dict[str, str]]   # [{"id": "a", "text": "..."}, ...]
    points: int
    order_index: int

    model_config = {"from_attributes": True}


class QuizOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str | None
    passing_score: float
    max_attempts: int
    time_limit_minutes: int | None
    xp_reward: int
    questions: list[QuizQuestionOut]

    model_config = {"from_attributes": True}


class QuizSubmission(BaseModel):
    answers: dict[str, str]   # {question_id: selected_option_id}


class AttemptResult(BaseModel):
    attempt_id: str
    score: float
    passed: bool
    attempt_number: int
    xp_awarded: bool
    xp_amount: int
    per_question: list[dict[str, Any]]   # Feedback per question
    message: str


class LessonCompleteResponse(BaseModel):
    xp_awarded: bool
    xp_amount: int
    message: str


class ProgressOut(BaseModel):
    completed_lessons: list[str]   # lesson IDs
    quiz_best_scores: dict[str, float]   # {quiz_id: best_score}
    xp_total: int
    level: int


# ── Modules ───────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=list[ModuleOut])
async def list_modules(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[ModuleOut]:
    """List published modules."""
    result = await db.execute(
        select(Module).where(Module.is_published == True).order_by(Module.order_index)
    )
    modules = result.scalars().all()

    out = []
    for m in modules:
        lesson_count_result = await db.execute(
            select(Lesson).where(Lesson.module_id == m.id, Lesson.is_published == True)
        )
        lesson_count = len(lesson_count_result.scalars().all())
        out.append(ModuleOut(
            id=str(m.id),
            slug=m.slug,
            title=m.title,
            description=m.description,
            career_path=m.career_path.value,
            difficulty=m.difficulty.value,
            xp_reward=m.xp_reward,
            lesson_count=lesson_count,
        ))
    return out


# ── Lessons ───────────────────────────────────────────────────────────────────

@router.get("/modules/{module_slug}/lessons", response_model=list[LessonOut])
async def list_lessons(
    module_slug: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[LessonOut]:
    module_result = await db.execute(select(Module).where(Module.slug == module_slug, Module.is_published == True))
    module = module_result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    result = await db.execute(
        select(Lesson)
        .where(Lesson.module_id == module.id, Lesson.is_published == True)
        .order_by(Lesson.order_index)
    )
    lessons = result.scalars().all()
    return [LessonOut(
        id=str(l.id), slug=l.slug, title=l.title,
        content_md=l.content_md, order_index=l.order_index,
        xp_reward=l.xp_reward, estimated_minutes=l.estimated_minutes,
    ) for l in lessons]


@router.get("/lessons/{lesson_slug}", response_model=LessonOut)
async def get_lesson(
    lesson_slug: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> LessonOut:
    result = await db.execute(select(Lesson).where(Lesson.slug == lesson_slug, Lesson.is_published == True))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonOut(
        id=str(lesson.id), slug=lesson.slug, title=lesson.title,
        content_md=lesson.content_md, order_index=lesson.order_index,
        xp_reward=lesson.xp_reward, estimated_minutes=lesson.estimated_minutes,
    )


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompleteResponse)
async def mark_lesson_complete(
    lesson_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> LessonCompleteResponse:
    """Mark a lesson complete and award XP (idempotent)."""
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        progress, just_awarded = await complete_lesson(db=db, user_id=current_user.id, lesson_id=lesson_id)
    except GradingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return LessonCompleteResponse(
        xp_awarded=just_awarded,
        xp_amount=lesson.xp_reward if just_awarded else 0,
        message="Lesson complete!" if progress.completed else "Progress saved.",
    )


# ── Quizzes ───────────────────────────────────────────────────────────────────

@router.get("/quizzes/{quiz_slug}", response_model=QuizOut)
async def get_quiz(
    quiz_slug: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuizOut:
    """Get quiz — correct answers are NEVER included in this response."""
    result = await db.execute(select(Quiz).where(Quiz.slug == quiz_slug, Quiz.is_published == True))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    q_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.order_index)
    )
    questions = q_result.scalars().all()

    return QuizOut(
        id=str(quiz.id), slug=quiz.slug, title=quiz.title,
        description=quiz.description,
        passing_score=float(quiz.passing_score),
        max_attempts=quiz.max_attempts,
        time_limit_minutes=quiz.time_limit_minutes,
        xp_reward=quiz.xp_reward,
        questions=[QuizQuestionOut(
            id=str(q.id), question_text=q.question_text,
            options=q.options, points=q.points, order_index=q.order_index,
        ) for q in questions],
    )


@router.post("/quizzes/{quiz_id}/submit", response_model=AttemptResult)
async def submit_quiz(
    quiz_id: uuid.UUID,
    body: QuizSubmission,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> AttemptResult:
    """
    Submit quiz answers. Grading is deterministic and server-side.
    AI mentor does NOT call this endpoint — only the learner's browser does.
    """
    try:
        attempt = await grade_quiz_attempt(
            db=db,
            user_id=current_user.id,
            quiz_id=quiz_id,
            answers=body.answers,
        )
    except MaxAttemptsExceededError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except GradingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Build per-question feedback (reveal correct answers after submission)
    q_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id).order_by(QuizQuestion.order_index)
    )
    questions = q_result.scalars().all()

    per_question = []
    for q in questions:
        selected = body.answers.get(str(q.id))
        correct = selected == q.correct_option_id
        per_question.append({
            "question_id": str(q.id),
            "correct": correct,
            "correct_option_id": q.correct_option_id,
            "selected_option_id": selected,
            "explanation": q.explanation,
            "points_earned": q.points if correct else 0,
            "points_possible": q.points,
        })

    # Load quiz for xp_reward
    quiz_result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = quiz_result.scalar_one()

    return AttemptResult(
        attempt_id=str(attempt.id),
        score=float(attempt.score),
        passed=attempt.passed,
        attempt_number=attempt.attempt_number,
        xp_awarded=attempt.xp_awarded,
        xp_amount=quiz.xp_reward if attempt.xp_awarded else 0,
        per_question=per_question,
        message=("Congratulations! You passed." if attempt.passed else
                 f"Score: {float(attempt.score):.0f}%. Passing score: {float(quiz.passing_score):.0f}%. Try again!"),
    )


# ── Progress ──────────────────────────────────────────────────────────────────

@router.get("/progress", response_model=ProgressOut)
async def get_progress(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ProgressOut:
    """Return the current user's own progress only."""
    lp_result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.completed == True,
        )
    )
    completed_lessons = [str(lp.lesson_id) for lp in lp_result.scalars().all()]

    qa_result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.user_id == current_user.id)
    )
    attempts = qa_result.scalars().all()
    best_scores: dict[str, float] = {}
    for a in attempts:
        qid = str(a.quiz_id)
        score = float(a.score)
        if qid not in best_scores or score > best_scores[qid]:
            best_scores[qid] = score

    return ProgressOut(
        completed_lessons=completed_lessons,
        quiz_best_scores=best_scores,
        xp_total=current_user.xp_total,
        level=current_user.level,
    )
