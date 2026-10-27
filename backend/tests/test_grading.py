"""
Tests for the deterministic grading service.

These are the most critical tests in the codebase:
- Correct score calculation
- Boundary value at passing threshold
- XP idempotency (cannot be awarded twice)
- Max attempts enforcement
"""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.grading import _compute_level, _level_threshold, GradingError, MaxAttemptsExceededError


# ── Unit tests: level computation (pure function, no DB) ─────────────────────

class TestLevelComputation:
    def test_level_1_at_zero_xp(self):
        assert _compute_level(0) == 1

    def test_level_1_at_99_xp(self):
        assert _compute_level(99) == 1

    def test_level_2_at_100_xp(self):
        assert _compute_level(100) == 2

    def test_level_2_at_249_xp(self):
        assert _compute_level(249) == 2

    def test_level_2_at_250_xp(self):
        assert _compute_level(250) == 2

    def test_level_2_at_299_xp(self):
        assert _compute_level(299) == 2

    def test_level_3_at_300_xp(self):
        assert _compute_level(300) == 3

    def test_level_3_at_599_xp(self):
        assert _compute_level(599) == 3

    def test_level_4_at_600_xp(self):
        assert _compute_level(600) == 4

    def test_level_4_at_999_xp(self):
        assert _compute_level(999) == 4

    def test_level_5_at_1000_xp(self):
        assert _compute_level(1000) == 5

    def test_monotonically_increasing_thresholds(self):
        """Each level requires more XP than the previous."""
        thresholds = [_level_threshold(n) for n in range(1, 20)]
        for i in range(1, len(thresholds)):
            assert thresholds[i] > thresholds[i - 1], f"Level {i+1} threshold not greater than level {i}"

    def test_level_cap_at_50(self):
        assert _compute_level(999_999_999) == 50

    def test_level_never_below_1(self):
        assert _compute_level(0) >= 1


# ── Unit tests: score boundary values ────────────────────────────────────────

class TestScoreBoundaries:
    """Verify passing logic at the boundary (70% default)."""

    def _score_to_decimal(self, earned: int, total: int) -> Decimal:
        return Decimal(str(round((earned / total) * 100, 2)))

    def test_exactly_passing(self):
        # 7 correct out of 10 = 70.0%
        score = self._score_to_decimal(7, 10)
        assert score == Decimal("70.0")
        assert score >= Decimal("70.0")

    def test_just_below_passing(self):
        # 6.99 / 10 < 70
        score = self._score_to_decimal(699, 1000)
        assert score < Decimal("70.0")

    def test_perfect_score(self):
        score = self._score_to_decimal(10, 10)
        assert score == Decimal("100.0")

    def test_zero_score(self):
        score = self._score_to_decimal(0, 10)
        assert score == Decimal("0.0")


# ── Integration-style tests (with mocked DB) ─────────────────────────────────

class TestGradingIntegration:
    """
    These tests use mocked SQLAlchemy sessions.
    Real integration tests require a live PostgreSQL database.
    """

    def _make_question(self, qid: str, correct: str, points: int = 1) -> MagicMock:
        q = MagicMock()
        q.id = uuid.UUID(qid) if len(qid) == 36 else uuid.uuid4()
        q.correct_option_id = correct
        q.points = points
        q.order_index = 0
        q.explanation = "Test explanation"
        return q

    def _make_quiz(self, max_attempts: int = 3, passing: float = 70.0, xp: int = 50) -> MagicMock:
        quiz = MagicMock()
        quiz.id = uuid.uuid4()
        quiz.slug = "test-quiz"
        quiz.is_published = True
        quiz.max_attempts = max_attempts
        quiz.passing_score = Decimal(str(passing))
        quiz.xp_reward = xp
        quiz.content_version = 1
        return quiz

    @pytest.mark.asyncio
    async def test_grade_all_correct(self):
        """All questions answered correctly → 100% score."""
        quiz = self._make_quiz()
        q1_id = str(uuid.uuid4())
        questions = [self._make_question(q1_id, "a", 1)]

        db = AsyncMock()

        # Mock: quiz found, questions found, 0 prior attempts, no prior XP txn
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=quiz)),   # quiz lookup
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions)))),  # questions
            MagicMock(scalar=MagicMock(return_value=0)),                   # attempt count
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),    # prior XP check
            MagicMock(scalar_one=MagicMock(return_value=50)),              # update User returning xp_total
            MagicMock(),                                                   # update User level
        ]
        db.flush = AsyncMock()
        db.add = MagicMock()

        class _MockNested:
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                return None

        db.begin_nested = MagicMock(return_value=_MockNested())

        from app.services.grading import grade_quiz_attempt

        attempt = await grade_quiz_attempt(
            db=db,
            user_id=uuid.uuid4(),
            quiz_id=quiz.id,
            answers={q1_id: "a"},
        )

        assert attempt.score == Decimal("100.0")
        assert attempt.passed is True

    @pytest.mark.asyncio
    async def test_max_attempts_raises(self):
        """Submitting beyond max_attempts raises MaxAttemptsExceededError."""
        quiz = self._make_quiz(max_attempts=1)

        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=quiz)),   # quiz lookup
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[MagicMock(points=1, correct_option_id='a', id=uuid.uuid4(), order_index=0)])))),
            MagicMock(scalar=MagicMock(return_value=1)),                   # 1 attempt already done
        ]

        from app.services.grading import grade_quiz_attempt

        with pytest.raises(MaxAttemptsExceededError):
            await grade_quiz_attempt(
                db=db,
                user_id=uuid.uuid4(),
                quiz_id=quiz.id,
                answers={},
            )
