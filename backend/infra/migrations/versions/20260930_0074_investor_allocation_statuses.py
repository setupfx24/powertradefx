"""Allow every investor-allocation status the code writes.

QA 2026-09-29 (staging): migration 0007 recreated
investor_allocations_status_check without 'stopped', 'rejected' and
'paused_drawdown', so unfollow (stop_copy -> 'stopped') always failed with a
500, rejecting a follow request failed, and a follower hitting max drawdown
('paused_drawdown') aborted the copy engine's shared transaction and stopped
copy trading for every master.

Revision ID: 0074
Revises: 0073
"""
from alembic import op

revision = "0074"
down_revision = "0073"
branch_labels = None
depends_on = None

STATUSES = ("pending", "active", "paused", "paused_drawdown", "closed", "withdrawn", "rejected", "stopped")


def upgrade() -> None:
    op.execute("ALTER TABLE investor_allocations DROP CONSTRAINT IF EXISTS investor_allocations_status_check")
    op.execute(
        "ALTER TABLE investor_allocations ADD CONSTRAINT investor_allocations_status_check "
        "CHECK (status IN (" + ", ".join("'" + s + "'" for s in STATUSES) + "))"
    )


def downgrade() -> None:
    pass
