"""H-ADMIN-1: admin_refresh must reject an EXPIRED admin token (verify_exp=True).

Previously an expired admin access token could be refreshed forever, so a single
leaked token meant permanent access.
"""
import asyncio
import importlib.util
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
from fastapi import HTTPException


def _load_admin_auth_service():
    admin_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "admin"))
    if admin_dir not in sys.path:
        sys.path.append(admin_dir)
    path = os.path.join(admin_dir, "services", "auth_service.py")
    spec = importlib.util.spec_from_file_location("admin_auth_service", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


auth_service = _load_admin_auth_service()
S = auth_service.settings


class _Res:
    def __init__(self, val):
        self._val = val

    def scalar_one_or_none(self):
        return self._val


class _DB:
    def __init__(self, admin):
        self._admin = admin
        self.added = []

    async def execute(self, *a, **k):
        return _Res(self._admin)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None


_PWD_HASH = "$2b$12$dummyhashfortests000000000000000000000000000000000000"


def _admin(admin_id, role):
    return SimpleNamespace(
        id=admin_id, role=role, first_name="A", last_name="B", status="active",
        password_hash=_PWD_HASH,
    )


def _token(admin_id, delta_seconds, sid=None, pwd_hash=_PWD_HASH):
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=delta_seconds)
    payload = {
        "admin_id": str(admin_id), "type": "admin", "exp": exp, "iat": now,
        "iss": auth_service.ADMIN_JWT_ISSUER,
        "pwd": auth_service.password_fingerprint(pwd_hash),
    }
    if sid is not None:
        payload["sid"] = str(sid)
    return jwt.encode(payload, S.ADMIN_JWT_SECRET, algorithm=S.ADMIN_JWT_ALGORITHM)


class AdminRefreshTests(unittest.TestCase):
    def test_expired_token_rejected(self):
        token = _token(uuid4(), -3600)  # expired 1h ago
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(token, _DB(None)))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_missing_token_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(None, _DB(None)))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_issuer_rejected(self):
        admin_id = uuid4()
        now = datetime.now(timezone.utc)
        payload = {"admin_id": str(admin_id), "type": "admin", "iat": now,
                   "exp": now + timedelta(hours=1), "iss": "someone-else",
                   "pwd": auth_service.password_fingerprint(_PWD_HASH)}
        token = jwt.encode(payload, S.ADMIN_JWT_SECRET, algorithm=S.ADMIN_JWT_ALGORITHM)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(token, _DB(_admin(admin_id, "admin"))))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_password_rotation_rejects_old_token(self):
        # Token fingerprinted against the OLD hash must not refresh once the
        # stored hash changed.
        admin_id = uuid4()
        token = _token(admin_id, 3600, pwd_hash="$2b$12$oldhash")
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_service.admin_refresh(token, _DB(_admin(admin_id, "admin"))))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_valid_token_refreshes(self):
        # No sid → grandfathered token; refresh upgrades it to a revocable session.
        admin_id = uuid4()
        admin = _admin(admin_id, "super_admin")
        token = _token(admin_id, 3600)  # valid 1h
        out = asyncio.run(auth_service.admin_refresh(token, _DB(admin)))
        self.assertTrue(out.access_token)
        self.assertEqual(out.role, "super_admin")

    def test_revoked_session_cannot_refresh(self):
        # A token with a sid whose session was revoked must NOT be refreshable.
        admin_id, sid = uuid4(), uuid4()
        admin = _admin(admin_id, "admin")
        token = _token(admin_id, 3600, sid=sid)
        orig = auth_service._session_is_active

        async def _revoked(_sid):
            return False

        auth_service._session_is_active = _revoked
        try:
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(auth_service.admin_refresh(token, _DB(admin)))
            self.assertEqual(ctx.exception.status_code, 401)
        finally:
            auth_service._session_is_active = orig

    def test_active_session_refreshes_and_keeps_sid(self):
        admin_id, sid = uuid4(), uuid4()
        admin = _admin(admin_id, "admin")
        token = _token(admin_id, 3600, sid=sid)
        orig = auth_service._session_is_active

        async def _active(_sid):
            return True

        auth_service._session_is_active = _active
        try:
            out = asyncio.run(auth_service.admin_refresh(token, _DB(admin)))
        finally:
            auth_service._session_is_active = orig
        # The reissued token must carry the SAME sid (session reused, still revocable).
        decoded = jwt.decode(
            out.access_token, S.ADMIN_JWT_SECRET, algorithms=[S.ADMIN_JWT_ALGORITHM],
            issuer=auth_service.ADMIN_JWT_ISSUER,
        )
        self.assertEqual(decoded.get("sid"), str(sid))
        self.assertEqual(decoded.get("iss"), auth_service.ADMIN_JWT_ISSUER)
        self.assertTrue(decoded.get("jti"))
        self.assertEqual(decoded.get("pwd"), auth_service.password_fingerprint(_PWD_HASH))


if __name__ == "__main__":
    unittest.main()
