"""Object storage for uploaded files — S3-compatible, off the compute instance.

Selected by ``STORAGE_BACKEND``:

* ``local`` (default) — callers keep writing to the local upload directories
  exactly as before. Nothing changes until an operator opts in.
* ``s3`` — uploads go to a bucket through boto3, the official AWS SDK. Any
  S3-compatible store works by setting ``S3_ENDPOINT_URL`` (Cloudflare R2,
  MinIO, Google Cloud Storage's XML API, DigitalOcean Spaces).

Credentials are NEVER read from code or settings here: boto3's default chain
supplies them (instance/task IAM role, workload identity, or the standard
``AWS_ACCESS_KEY_ID`` / ``AWS_SECRET_ACCESS_KEY`` environment variables).

Stored references
-----------------
A database column that used to hold a disk path now holds ``obj:<key>`` for
files written to the bucket, e.g. ``obj:kyc/<user_id>/selfie_<hex>.jpg``.
Rows written before the switch keep their disk paths and are still served
from disk, so turning the bucket on needs no data migration.

Private files (KYC, deposit proofs, payout QR codes) are always streamed
through the application, which applies the caller's permission checks; the
bucket itself stays private. Every key is validated against a strict pattern
and each reader confines it to its own prefix (``kyc/<user_id>/``,
``wallet/``), so a tampered row cannot reach another user's file.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from functools import lru_cache

logger = logging.getLogger("object-storage")

REF_PREFIX = "obj:"
# category/segment/.../file.ext — lowercase category, safe segment charset,
# no empty segments, no "." / ".." segments.
_KEY_RE = re.compile(r"^[a-z_]+(?:/[A-Za-z0-9_-][A-Za-z0-9._-]{0,127})+$")

_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
}


class StorageError(Exception):
    """The bucket could not be reached or refused the operation."""


def backend() -> str:
    return (os.environ.get("STORAGE_BACKEND") or "local").strip().lower()


def enabled() -> bool:
    """True when uploads should go to the bucket instead of local disk."""
    return backend() == "s3"


def media_type_for(key: str) -> str:
    dot = key.rfind(".")
    return _MEDIA_TYPES.get(key[dot:].lower(), "application/octet-stream") if dot >= 0 else "application/octet-stream"


def valid_key(key: str) -> bool:
    if not key or not _KEY_RE.match(key):
        return False
    return all(seg not in (".", "..") for seg in key.split("/"))


def is_ref(stored: str | None) -> bool:
    return bool(stored) and str(stored).startswith(REF_PREFIX)


def key_from_ref(stored: str, *, required_prefix: str) -> str | None:
    """The object key in ``stored`` if it is a valid reference under
    ``required_prefix`` (e.g. ``"kyc/<user_id>/"``), else None."""
    if not is_ref(stored):
        return None
    key = str(stored)[len(REF_PREFIX):]
    if not valid_key(key) or not key.startswith(required_prefix):
        return None
    return key


def _bucket() -> str:
    b = (os.environ.get("S3_BUCKET") or "").strip()
    if not b:
        raise StorageError("STORAGE_BACKEND=s3 but S3_BUCKET is not set")
    return b


def _full_key(key: str) -> str:
    prefix = (os.environ.get("S3_PREFIX") or "").strip().strip("/")
    return f"{prefix}/{key}" if prefix else key


@lru_cache(maxsize=1)
def _client():
    import boto3  # imported lazily: only needed when the bucket is enabled
    from botocore.config import Config

    return boto3.client(
        "s3",
        region_name=(os.environ.get("S3_REGION") or None),
        endpoint_url=(os.environ.get("S3_ENDPOINT_URL") or None),
        config=Config(
            retries={"max_attempts": 4, "mode": "standard"},
            connect_timeout=5,
            read_timeout=30,
            max_pool_connections=32,
            signature_version="s3v4",
        ),
    )


def _sse_args() -> dict:
    """Server-side encryption: SSE-KMS when a key id is configured, else
    SSE-S3 (AES-256). Some S3-compatible stores reject these headers; set
    S3_SSE=none for those (and encrypt at the provider level instead)."""
    mode = (os.environ.get("S3_SSE") or "aes256").strip().lower()
    if mode == "none":
        return {}
    kms = (os.environ.get("S3_KMS_KEY_ID") or "").strip()
    if kms:
        return {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": kms}
    return {"ServerSideEncryption": "AES256"}


async def put(key: str, content: bytes, *, content_type: str | None = None) -> str:
    """Upload ``content`` under ``key``; returns the ``obj:`` reference to
    store in the database."""
    if not valid_key(key):
        raise ValueError(f"invalid object key: {key!r}")
    args = {
        "Bucket": _bucket(),
        "Key": _full_key(key),
        "Body": content,
        "ContentType": content_type or media_type_for(key),
        **_sse_args(),
    }
    try:
        await asyncio.to_thread(_client().put_object, **args)
    except Exception as e:  # botocore raises a family of errors; log, normalise
        logger.error("object storage put failed for %s: %s", key, e)
        raise StorageError("upload storage unavailable") from e
    return REF_PREFIX + key


async def get(key: str) -> bytes | None:
    """Object bytes, or None when the object does not exist."""
    if not valid_key(key):
        return None
    try:
        resp = await asyncio.to_thread(_client().get_object, Bucket=_bucket(), Key=_full_key(key))
        return await asyncio.to_thread(resp["Body"].read)
    except Exception as e:
        code = getattr(e, "response", {}).get("Error", {}).get("Code") if hasattr(e, "response") else None
        if code in ("NoSuchKey", "404", "NotFound"):
            return None
        logger.error("object storage get failed for %s: %s", key, e)
        raise StorageError("upload storage unavailable") from e


async def delete(key: str) -> None:
    if not valid_key(key):
        return
    try:
        await asyncio.to_thread(_client().delete_object, Bucket=_bucket(), Key=_full_key(key))
    except Exception as e:
        logger.warning("object storage delete failed for %s: %s", key, e)


async def response(key: str, *, filename: str | None = None, cache_seconds: int = 0):
    """A FastAPI Response streaming the object, 404 when missing, 503 when
    the store is unreachable. Private by default (no caching)."""
    from fastapi import HTTPException
    from fastapi.responses import Response

    try:
        data = await get(key)
    except StorageError:
        raise HTTPException(status_code=503, detail="File storage is temporarily unavailable")
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": f"public, max-age={cache_seconds}" if cache_seconds else "private, no-store",
    }
    if filename:
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:120]
        headers["Content-Disposition"] = f'inline; filename="{safe}"'
    return Response(content=data, media_type=media_type_for(key), headers=headers)


# ---------------------------------------------------------------------------
# Public media (banners, bank QR codes, broker logos), stored by filename.
# The caller validates the filename; keys are re-validated here.
# ---------------------------------------------------------------------------
PUBLIC_CACHE_SECONDS = 86400


async def save_public_media(category: str, filename: str, content: bytes, local_dir) -> None:
    """Write a public media file to the bucket, or to ``local_dir`` (a
    pathlib.Path) when the bucket is off."""
    if enabled():
        await put(f"{category}/{filename}", content)
        return
    (local_dir / filename).write_bytes(content)


async def serve_public_media(category: str, filename: str, local_path):
    """Serve a public media file: bucket first (when on), then the local file
    written before the bucket was enabled. 404 when neither has it."""
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    if enabled():
        key = f"{category}/{filename}"
        try:
            data = await get(key)
        except StorageError:
            data = None
        if data is not None:
            from fastapi.responses import Response
            return Response(content=data, media_type=media_type_for(key), headers={
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": f"public, max-age={PUBLIC_CACHE_SECONDS}",
            })
    if local_path is not None and local_path.is_file():
        return FileResponse(local_path)
    raise HTTPException(status_code=404, detail="Not found")


async def delete_public_media(category: str, filename: str, local_path) -> None:
    if enabled():
        await delete(f"{category}/{filename}")
    if local_path is not None:
        try:
            if local_path.is_file():
                local_path.unlink()
        except OSError:
            pass
