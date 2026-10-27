"""
Pure functions for grading calculations — no database dependency.
Imported by both grading.py and tests without needing a DB connection.
"""
from decimal import Decimal


def compute_score(earned_points: int, total_points: int) -> Decimal:
    """Compute a percentage score. Returns 0.00 if total_points is 0."""
    if total_points == 0:
        return Decimal("0.00")
    return Decimal(str(round((earned_points / total_points) * 100, 2)))


def compute_level(xp: int) -> int:
    """
    Level thresholds (tunable without model changes):
    Level N requires level_threshold(N) XP.
    """
    level = 1
    while xp >= level_threshold(level + 1):
        level += 1
        if level >= 50:
            break
    return level


def level_threshold(level: int) -> int:
    """XP required to reach a given level."""
    return 100 * level * (level - 1) // 2
