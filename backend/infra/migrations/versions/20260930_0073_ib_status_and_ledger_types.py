"""Allow every IB commission status and ledger type the code writes;
make IB accruals duplicate-proof.

QA 2026-09-29 (staging): ib_commissions_status_check allowed only
pending/paid/cancelled, so every accrual ('accrued') and every payout
rejection ('rejected') failed and no IB commission was ever recorded.
transactions_type_check lacked withdrawal_refund, bonus_release and
credit_removed, so on-chain withdrawal rejections, bonus releases and account
deletion with credit failed.

Revision ID: 0073
Revises: 0072
"""
from alembic import op

revision = "0073"
down_revision = "0072"
branch_labels = None
depends_on = None

IB_STATUSES = ("accrued", "pending", "paid", "rejected", "cancelled")
TX_TYPES = (
    "deposit", "withdrawal", "commission", "swap", "bonus", "credit", "adjustment",
    "ib_commission", "profit", "loss", "transfer", "admin_commission",
    "performance_fee", "master_commission", "refund",
    # added in 0073
    "withdrawal_refund", "bonus_release", "credit_removed", "copy_trade", "cpa",
    "admin_adjustment", "ib_commission_reversal", "platform_fee", "network_payout",
    "stop_out", "negative_balance",
)


def _in(values):
    return ", ".join("'" + v + "'" for v in values)


def upgrade() -> None:
    op.execute("ALTER TABLE ib_commissions DROP CONSTRAINT IF EXISTS ib_commissions_status_check")
    op.execute(
        "ALTER TABLE ib_commissions ADD CONSTRAINT ib_commissions_status_check "
        f"CHECK (status IN ({_in(IB_STATUSES)}))"
    )
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check")
    op.execute(
        "ALTER TABLE transactions ADD CONSTRAINT transactions_type_check "
        f"CHECK (type IN ({_in(TX_TYPES)}))"
    )
    # One accrual per (order, IB, level, type). Remove any duplicates first so
    # the index can be created on existing data.
    op.execute(
        """
        DELETE FROM ib_commissions a USING ib_commissions b
        WHERE a.source_trade_id IS NOT NULL
          AND a.source_trade_id = b.source_trade_id
          AND a.ib_id = b.ib_id
          AND a.mlm_level = b.mlm_level
          AND COALESCE(a.commission_type, '') = COALESCE(b.commission_type, '')
          AND a.status = 'accrued' AND b.status = 'accrued'
          AND a.created_at > b.created_at
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_ib_commissions_trade_ib_level "
        "ON ib_commissions (source_trade_id, ib_id, mlm_level, commission_type) "
        "WHERE source_trade_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_ib_commissions_trade_ib_level")
