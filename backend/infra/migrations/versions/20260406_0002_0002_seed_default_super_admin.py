"""Ensure default super_admin exists (fixes admin panel login when DB had no init-db seed).

Revision ID: 0002
Revises: 0001
"""
import os

import bcrypt
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Known historical defaults that have shipped in .env.example at one
# point or another. Any of these are weak-password equivalents — the
# Settings boot-guard in packages/common/src/config.py refuses to start
# the app with them set, and the migration also refuses to seed them.
_KNOWN_WEAK_PASSWORDS = {
    "",
    "SwissCrestaAdmin2026!",  # current .env.example default
    "SwissCrestaAdmin2025!",  # earlier SwissCresta-era default
    "NovaFxAdmin2026!",       # NovaFX-era default
    "NovaFXAdmin2025!",       # earlier NovaFX-era default
    "FXArthaAdmin2025!",      # pre-rebrand default
    "admin",
    "password",
    "changeme",
}


def _resolve_admin_credentials() -> tuple[str, str]:
    """Read ADMIN_EMAIL + ADMIN_PASSWORD from the environment and refuse
    to seed if the password is missing or matches any historical default.
    Falling through with a default password would leave a back-door
    super-admin account that the operator has no way to know about."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or not password:
        raise RuntimeError(
            "Migration 0002 refuses to seed super_admin without "
            "ADMIN_EMAIL + ADMIN_PASSWORD set in the environment. "
            "Set them in .env, then re-run migrations."
        )
    if password in _KNOWN_WEAK_PASSWORDS:
        raise RuntimeError(
            "Migration 0002 refuses to seed super_admin with a known "
            "weak/default password. Generate one with "
            "`openssl rand -base64 24` and set ADMIN_PASSWORD in .env."
        )
    return email, password


def upgrade() -> None:
    email, password = _resolve_admin_credentials()
    # Hash at migration time — never store the plaintext anywhere, never
    # interpolate it into SQL.
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

    # Parameterised execution — `:email` and `:hash` go through the
    # driver's bind-parameter path, NOT string interpolation. An email
    # like  admin@example.com'); DROP TABLE users; --  is now a literal
    # email value, not an injection vector.
    op.execute(
        sa.text(
            """
            INSERT INTO users (email, password_hash, first_name, last_name,
                               role, status, kyc_status)
            VALUES (:email, :hash, 'Super', 'Admin',
                    'super_admin', 'active', 'approved')
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role          = EXCLUDED.role,
                status        = EXCLUDED.status,
                kyc_status    = EXCLUDED.kyc_status,
                first_name    = EXCLUDED.first_name,
                last_name     = EXCLUDED.last_name
            """
        ).bindparams(email=email, hash=password_hash)
    )


def downgrade() -> None:
    # Downgrade only removes the row if the email matches the configured
    # admin — we don't want to accidentally delete a different super_admin
    # someone added after the seed. Parameterised, same reasoning.
    email, _ = _resolve_admin_credentials()
    op.execute(
        sa.text(
            "DELETE FROM users WHERE email = :email AND role = 'super_admin'"
        ).bindparams(email=email)
    )
