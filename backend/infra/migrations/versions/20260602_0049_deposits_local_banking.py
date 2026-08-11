"""Add 'local_banking' deposit method + payment_link column.

Local banking replaces the user-facing Razorpay popup. The flow is now a
two-stage admin-mediated handshake:

  1. User submits a Local Banking request with just an amount → row is
     created with method='local_banking', status='pending', NO proof,
     NO transaction id. Admin reviews KYC.
  2. Admin attaches a `payment_link` (Razorpay payment-link, bank
     transfer details, UPI VPA — anything the admin chooses per case)
     and notifies the user. User pays externally and admin marks the
     deposit approved by hand.

We need two schema tweaks for that:
  - Widen the method CHECK to include 'local_banking'.
  - Add `payment_link TEXT NULL` to `deposits` so the admin's link is
    stored alongside the deposit row.

Revision ID: 0049
Revises: 0048
"""
from alembic import op
import sqlalchemy as sa


revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


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
    "local_banking",
)

_DEPOSIT_METHODS_WITHOUT_LOCAL_BANKING = (
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


def upgrade() -> None:
    # 1. Widen the method CHECK.
    dep_sql = ", ".join(f"'{m}'" for m in _DEPOSIT_METHODS)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({dep_sql}));"
    )

    # 2. Add the payment_link column. NULL while the request is in stage 1,
    #    populated by the admin when they hand the user a payment URL.
    op.add_column(
        "deposits",
        sa.Column("payment_link", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("deposits", "payment_link")

    dep_sql = ", ".join(f"'{m}'" for m in _DEPOSIT_METHODS_WITHOUT_LOCAL_BANKING)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({dep_sql}));"
    )
