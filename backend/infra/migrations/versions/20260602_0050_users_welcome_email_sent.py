"""Add users.welcome_email_sent flag.

The welcome email used to fire immediately at /auth/register, before the
user verified their email or filled out their profile. We're moving the
trigger to the end of profile completion so the welcome arrives once the
account is actually usable. This flag prevents duplicate sends if the
user edits their profile again after the initial completion.

Revision ID: 0050
Revises: 0049
"""
from alembic import op
import sqlalchemy as sa


revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "welcome_email_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Anyone who already exists has, by virtue of having been around long
    # enough to get here, already received their welcome email (or doesn't
    # need one). Flip them all to True so the next /profile PUT doesn't
    # spam every legacy account.
    op.execute("UPDATE users SET welcome_email_sent = true")


def downgrade() -> None:
    op.drop_column("users", "welcome_email_sent")
