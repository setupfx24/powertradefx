"""Halve USOIL / UKOIL contract size to 100 (mini oil contract).

Previously 1000 barrels per lot (industry standard for "full" oil
CFDs). On a retail platform that exposure was too punishing per the
minimum 0.01 lot: a $0.40 adverse move drained ~$4 instead of ~$0.40
like a comparable forex pair, surprising users used to small-money
0.01-lot positions. Drop to 100 (1 barrel per 0.01 lot) so oil sizes
match the rest of the platform.

NATGAS stays at 10000 (MMBtu) — different unit, different convention.

Revision ID: 0052
Revises: 0051
"""
from alembic import op


revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE instruments SET contract_size = 100 "
        "WHERE symbol IN ('USOIL', 'UKOIL')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE instruments SET contract_size = 1000 "
        "WHERE symbol IN ('USOIL', 'UKOIL')"
    )
