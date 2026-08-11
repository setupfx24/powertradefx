"""Add users.avatar — profile avatar / photo.

Stores the user's chosen profile avatar. The value is either a small JSON
string describing a preset avatar ({"type":"lottie","value":"a"} /
{"type":"icon","value":{...}}) or a photo as a data-URI / URL. Null means the
app falls back to its default avatar. Used by the mobile profile screen + home
header so the choice persists and syncs across devices.

Revision ID: 0054
Revises: 0053
"""
from alembic import op
import sqlalchemy as sa


revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar")
