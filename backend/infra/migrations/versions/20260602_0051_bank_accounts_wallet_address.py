"""Add bank_accounts.wallet_address so admin can list a crypto address.

Consolidates the deposit-destination configuration onto a single admin
page (Banks). Previously the only place to enter a crypto address was
the separate admin Deposit Wallets page (admin_deposit_wallets), which
confused operators who'd already entered bank/UPI/QR data on the Banks
page. The on-chain verifier engine still uses admin_deposit_wallets
internally for auto-credit, but trader-facing display is unified here.

Revision ID: 0051
Revises: 0050
"""
from alembic import op
import sqlalchemy as sa


revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bank_accounts",
        sa.Column("wallet_address", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bank_accounts", "wallet_address")
