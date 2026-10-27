"""add_quiz_id_to_xp_transactions

Revision ID: 7b84c8e192a4
Revises: 2e738d0747c5
Create Date: 2026-10-28 01:40:00.000000

NOTE ON DEDUPLICATION:
This migration deletes duplicate XPTransaction ledger rows caused by SEC-RACE-01
for disposable dev/test databases. It retains the earliest transaction per user/quiz,
resets quiz_attempts.xp_awarded to false for attempts whose ledger rows were removed,
and recomputes users.xp_total and users.level from the SUM of remaining transactions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b84c8e192a4'
down_revision: Union[str, None] = '2e738d0747c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add quiz_id column to xp_transactions
    op.add_column(
        'xp_transactions',
        sa.Column('quiz_id', sa.Uuid(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'xp_transactions_quiz_id_fkey',
        'xp_transactions',
        'quizzes',
        ['quiz_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # 2. Backfill existing quiz_id from quiz_attempts
    op.execute("""
        UPDATE xp_transactions t
        SET quiz_id = a.quiz_id
        FROM quiz_attempts a
        WHERE t.quiz_attempt_id = a.id AND t.quiz_id IS NULL;
    """)

    # 3. Deduplicate legacy rows:
    #    a) Identify duplicate transaction IDs (all except earliest per user_id, quiz_id)
    #    b) Reset xp_awarded = false on quiz_attempts whose XP transactions are being deleted
    #    c) Delete duplicate XP transactions
    #    d) Recompute users.xp_total as exact SUM of remaining xp_transactions
    #    e) Recompute users.level based on the new xp_total
    op.execute("""
        WITH duplicate_txns AS (
            SELECT id, user_id, quiz_attempt_id FROM (
                SELECT id, user_id, quiz_attempt_id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, quiz_id ORDER BY created_at ASC
                ) as rnum
                FROM xp_transactions
                WHERE quiz_id IS NOT NULL
            ) dupes
            WHERE dupes.rnum > 1
        ),
        reset_attempts AS (
            UPDATE quiz_attempts a
            SET xp_awarded = false
            FROM duplicate_txns d
            WHERE a.id = d.quiz_attempt_id
        ),
        deleted_txns AS (
            DELETE FROM xp_transactions
            WHERE id IN (SELECT id FROM duplicate_txns)
        )
        UPDATE users u
        SET xp_total = r.new_total,
            level = CASE
                WHEN r.new_total >= 10000 THEN 50
                WHEN r.new_total >= 300 THEN 3
                WHEN r.new_total >= 100 THEN 2
                ELSE 1
            END
        FROM (
            SELECT u.id AS user_id, COALESCE(SUM(t.amount), 0) AS new_total
            FROM users u
            LEFT JOIN xp_transactions t ON t.user_id = u.id AND t.id NOT IN (SELECT id FROM duplicate_txns)
            GROUP BY u.id
        ) r
        WHERE u.id = r.user_id;
    """)

    # 4. Create partial unique index on (user_id, quiz_id)
    op.create_index(
        'uq_xp_transactions_user_quiz',
        'xp_transactions',
        ['user_id', 'quiz_id'],
        unique=True,
        postgresql_where=sa.text('quiz_id IS NOT NULL'),
        sqlite_where=sa.text('quiz_id IS NOT NULL')
    )


def downgrade() -> None:
    op.drop_index('uq_xp_transactions_user_quiz', table_name='xp_transactions')
    op.drop_constraint('xp_transactions_quiz_id_fkey', 'xp_transactions', type_='foreignkey')
    op.drop_column('xp_transactions', 'quiz_id')
