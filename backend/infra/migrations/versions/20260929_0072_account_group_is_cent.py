"""Add account_groups.is_cent and enable the Cent account type.

A Cent account keeps its money in USD like every other account; the trader
apps show its balance, P&L, margin and charges x100 as US cents (USC). The
flag is explicit so renaming the type in admin never changes how it displays.

Also re-enables the existing "Cent" type (retired in 0020) and flags it.

Revision ID: 0072
Revises: 0071
"""
from alembic import op

revision = "0072"
down_revision = "0071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE account_groups ADD COLUMN IF NOT EXISTS is_cent BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "UPDATE account_groups SET is_cent = TRUE, is_active = TRUE, "
        "description = 'Cent account: balance and results shown in US cents (USC). $1 = 100 USC.' "
        "WHERE lower(name) = 'cent' AND is_demo = FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE account_groups DROP COLUMN IF EXISTS is_cent")
