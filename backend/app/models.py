"""
SQLAlchemy models for CyberMentor AI.
All constraints and relationships are enforced at the database level.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index,
    Integer, Numeric, String, Text, UniqueConstraint, CheckConstraint, JSON, Uuid as UUID, text
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, PyEnum):
    learner = "learner"
    instructor = "instructor"
    admin = "admin"


class CareerPath(str, PyEnum):
    soc_analyst = "soc_analyst"
    app_security = "app_security"
    cloud_security = "cloud_security"
    grc = "grc"


class DifficultyLevel(str, PyEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class SubmissionStatus(str, PyEnum):
    pending = "pending"
    graded = "graded"
    failed = "failed"


# ── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(254), nullable=False, unique=True, index=True)
    full_name = Column(String(100), nullable=False)
    # Argon2id hash stored here — never plain text
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.learner)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)

    # XP and level — ONLY updated by server-side grading service
    xp_total = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    lesson_progress = relationship("LessonProgress", back_populates="user")
    xp_transactions = relationship("XPTransaction", back_populates="user")
    assessment_results = relationship("AssessmentResult", back_populates="user")

    __table_args__ = (
        CheckConstraint("xp_total >= 0", name="ck_users_xp_non_negative"),
        CheckConstraint("level >= 1", name="ck_users_level_min"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    career_path = Column(Enum(CareerPath), nullable=True)
    experience_level = Column(Enum(DifficultyLevel), nullable=True)
    # Domain scores 0-100, stored as JSON: {"network_security": 72, "web_security": 45, ...}
    domain_scores = Column(JSON, nullable=False, default=dict)
    # Onboarding quiz answers
    onboarding_data = Column(JSON, nullable=True)
    onboarding_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="profile")


class UserSession(Base):
    """Server-side session records for JWT invalidation on logout."""
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jti = Column(String(64), nullable=False, unique=True, index=True)  # JWT ID
    issued_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User", back_populates="sessions")

    __table_args__ = (Index("ix_user_sessions_user_id_jti", "user_id", "jti"),)


# ── Content ──────────────────────────────────────────────────────────────────

class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), nullable=False, unique=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    career_path = Column(Enum(CareerPath), nullable=False)
    difficulty = Column(Enum(DifficultyLevel), nullable=False)
    order_index = Column(Integer, nullable=False)
    xp_reward = Column(Integer, nullable=False, default=0)
    is_published = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    lessons = relationship("Lesson", back_populates="module", order_by="Lesson.order_index")
    quizzes = relationship("Quiz", back_populates="module")

    __table_args__ = (
        CheckConstraint("xp_reward >= 0", name="ck_modules_xp_non_negative"),
        CheckConstraint("order_index >= 0", name="ck_modules_order_non_negative"),
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    title = Column(String(200), nullable=False)
    content_md = Column(Text, nullable=False)  # Markdown, sanitized on render
    order_index = Column(Integer, nullable=False)
    xp_reward = Column(Integer, nullable=False, default=10)
    estimated_minutes = Column(Integer, nullable=False, default=15)
    is_published = Column(Boolean, nullable=False, default=False)
    content_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    module = relationship("Module", back_populates="lessons")
    progress = relationship("LessonProgress", back_populates="lesson")

    __table_args__ = (
        CheckConstraint("xp_reward >= 0", name="ck_lessons_xp_non_negative"),
    )


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    passing_score = Column(Numeric(5, 2), nullable=False, default=70.0)  # percentage
    max_attempts = Column(Integer, nullable=False, default=3)
    time_limit_minutes = Column(Integer, nullable=True)
    xp_reward = Column(Integer, nullable=False, default=50)
    content_version = Column(Integer, nullable=False, default=1)
    is_published = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    module = relationship("Module", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", order_by="QuizQuestion.order_index")
    attempts = relationship("QuizAttempt", back_populates="quiz")

    __table_args__ = (
        CheckConstraint("passing_score >= 0 AND passing_score <= 100", name="ck_quizzes_passing_score_range"),
        CheckConstraint("xp_reward >= 0", name="ck_quizzes_xp_non_negative"),
        CheckConstraint("max_attempts >= 1", name="ck_quizzes_min_attempts"),
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    # options stored as JSON: [{"id": "a", "text": "..."}, ...]
    options = Column(JSON, nullable=False)
    # correct_option_id stored server-side, NEVER sent to client
    correct_option_id = Column(String(10), nullable=False)
    explanation = Column(Text, nullable=True)  # Shown after submission
    points = Column(Integer, nullable=False, default=1)
    order_index = Column(Integer, nullable=False)
    content_version = Column(Integer, nullable=False, default=1)

    quiz = relationship("Quiz", back_populates="questions")

    __table_args__ = (
        CheckConstraint("points >= 1", name="ck_questions_min_points"),
    )


# ── Progress & Grading ───────────────────────────────────────────────────────

class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    xp_awarded = Column(Boolean, nullable=False, default=False)  # Idempotency flag
    time_spent_seconds = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="lesson_progress")
    lesson = relationship("Lesson", back_populates="progress")

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),
    )


class QuizAttempt(Base):
    """
    GRADING RULE: score is computed by services/grading.py (deterministic, server-side).
    AI mentor CANNOT write to this table.
    XP is awarded exactly once per passing attempt via XPTransaction.
    """
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    # User answers: {"question_id": "selected_option_id", ...}
    answers = Column(JSON, nullable=False)
    score = Column(Numeric(5, 2), nullable=False)       # 0.00–100.00
    passed = Column(Boolean, nullable=False)
    status = Column(Enum(SubmissionStatus), nullable=False, default=SubmissionStatus.graded)
    attempt_number = Column(Integer, nullable=False)
    xp_awarded = Column(Boolean, nullable=False, default=False)  # Idempotency flag
    quiz_content_version = Column(Integer, nullable=False)       # Snapshot at submission time
    graded_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")
    xp_transaction = relationship("XPTransaction", back_populates="quiz_attempt", uselist=False)

    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="ck_attempts_score_range"),
        CheckConstraint("attempt_number >= 1", name="ck_attempts_number_min"),
        UniqueConstraint("user_id", "quiz_id", "attempt_number", name="uq_quiz_attempts_user_quiz_attempt_number"),
        Index("ix_quiz_attempts_user_quiz", "user_id", "quiz_id"),
    )


class XPTransaction(Base):
    """
    Immutable ledger. XP is awarded by grading.py ONLY.
    Each transaction corresponds to exactly one event (lesson completion or quiz pass).
    Idempotency enforced by unique constraints on source references.
    """
    __tablename__ = "xp_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(100), nullable=False)
    # Exactly one of these should be set
    quiz_attempt_id = Column(UUID(as_uuid=True), ForeignKey("quiz_attempts.id"), nullable=True, unique=True)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True)
    lesson_progress_id = Column(UUID(as_uuid=True), ForeignKey("lesson_progress.id"), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="xp_transactions")
    quiz_attempt = relationship("QuizAttempt", back_populates="xp_transaction")
    quiz = relationship("Quiz")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_xp_amount_positive"),
        Index(
            "uq_xp_transactions_user_quiz",
            "user_id",
            "quiz_id",
            unique=True,
            postgresql_where=text("quiz_id IS NOT NULL"),
            sqlite_where=text("quiz_id IS NOT NULL"),
        ),
    )


class AssessmentResult(Base):
    """Initial onboarding assessment scores per domain."""
    __tablename__ = "assessment_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain = Column(String(50), nullable=False)
    score = Column(Numeric(5, 2), nullable=False)
    assessed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="assessment_results")

    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="ck_assessment_score_range"),
        UniqueConstraint("user_id", "domain", name="uq_assessment_user_domain"),
    )
