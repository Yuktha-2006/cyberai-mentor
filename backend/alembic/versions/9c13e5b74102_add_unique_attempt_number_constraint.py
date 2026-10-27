"""add_unique_attempt_number_constraint

Revision ID: 9c13e5b74102
Revises: 7b84c8e192a4
Create Date: 2026-10-28 02:10:00.000000

NOTE:
Ensures attempt_number is strictly unique per (user_id, quiz_id, attempt_number).
Before adding the unique constraint, any legacy duplicate attempt_number values
are re-sequenced ordered by created_at.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c13e5b74102'
down_revision: Union[str, None] = '7b84c8e192a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Deduplicate / resequence legacy attempts where attempt_number collided
    op.execute("""
        WITH resequenced AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY user_id, quiz_id ORDER BY created_at ASC
            ) as seq
            FROM quiz_attempts
        )
        UPDATE quiz_attempts q
        SET attempt_number = r.seq
        FROM resequenced r
        WHERE q.id = r.id;
    """)

    # 2. Add unique constraint on (user_id, quiz_id, attempt_number)
    op.create_unique_constraint(
        'uq_quiz_attempts_user_quiz_attempt_number',
        'quiz_attempts',
        ['user_id', 'quiz_id', 'attempt_number']
    )


def downgrade() -> None:
    op.drop_constraint('uq_quiz_attempts_user_quiz_attempt_number', 'quiz_attempts', type_='unique')
