"""Allow the 'razorpay' deposit method.

Razorpay replaces NOWPayments as the automated (card / UPI / netbanking)
deposit gateway. New rows are created with method='razorpay', so the
deposits_method_check CHECK constraint must include it.

This widens the deposits method CHECK to add 'razorpay' alongside every
method allowed by migration 0043 (restore_manual_money_methods). All
existing methods are kept; 'nowpayments' is retained so historical /
in-flight NOWPayments rows remain valid (no data migration needed).

The withdrawals CHECK is left untouched — Razorpay is a deposit-only
gateway here (payouts stay on the manual / on-chain flows).

Revision ID: 0048
Revises: 0047
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


# Allowed deposit methods AFTER this migration — the 0043 set + 'razorpay'.
_DEPOSIT_METHODS = (
    "wallet_connect",
    "nowpayments",
    "oxapay",
    "manual",
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
    "razorpay",
)

# The 0043 set, without 'razorpay' — used for downgrade.
_DEPOSIT_METHODS_WITHOUT_RAZORPAY = (
    "wallet_connect",
    "nowpayments",
    "oxapay",
    "manual",
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
)


def upgrade() -> None:
    dep_sql = ", ".join(f"'{m}'" for m in _DEPOSIT_METHODS)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({dep_sql}));"
    )


def downgrade() -> None:
    dep_sql = ", ".join(f"'{m}'" for m in _DEPOSIT_METHODS_WITHOUT_RAZORPAY)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({dep_sql}));"
    )
