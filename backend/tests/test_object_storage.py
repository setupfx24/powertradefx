"""object_storage: key validation, prefix confinement and the local default."""
import asyncio

import pytest

from packages.common.src import object_storage as obs


def test_default_backend_is_local(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert obs.enabled() is False
    monkeypatch.setenv("STORAGE_BACKEND", "S3")
    assert obs.enabled() is True


@pytest.mark.parametrize("key", [
    "kyc/3f1c/selfie_ab12.jpg",
    "wallet/deposits/3f1c/deposit_ab.png",
    "banners/0123abcd.webp",
])
def test_valid_keys(key):
    assert obs.valid_key(key)


@pytest.mark.parametrize("key", [
    "", "kyc", "/kyc/a.jpg", "kyc//a.jpg", "kyc/../etc/passwd", "kyc/./a.jpg",
    "KYC/a.jpg", "kyc/a b.jpg", "kyc/.hidden", "kyc/a\\b.jpg", "kyc/a.jpg/",
])
def test_invalid_keys(key):
    assert not obs.valid_key(key)


def test_ref_confined_to_owner_prefix():
    ref = "obj:kyc/user-a/selfie_1.jpg"
    assert obs.key_from_ref(ref, required_prefix="kyc/user-a/") == "kyc/user-a/selfie_1.jpg"
    # Another user's document, or a traversal attempt, never resolves.
    assert obs.key_from_ref(ref, required_prefix="kyc/user-b/") is None
    assert obs.key_from_ref("obj:kyc/user-a/../user-b/x.jpg", required_prefix="kyc/user-a/") is None
    # Legacy disk paths are not object references.
    assert obs.key_from_ref("/app/uploads/kyc/user-a/x.jpg", required_prefix="kyc/user-a/") is None


def test_put_rejects_invalid_key_before_network(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    with pytest.raises(ValueError):
        asyncio.run(obs.put("kyc/../x.jpg", b"data"))


def test_local_public_media_roundtrip(tmp_path, monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    asyncio.run(obs.save_public_media("banners", "abc.png", b"\x89PNG", tmp_path))
    assert (tmp_path / "abc.png").read_bytes() == b"\x89PNG"
    resp = asyncio.run(obs.serve_public_media("banners", "abc.png", tmp_path / "abc.png"))
    assert resp.status_code == 200
    asyncio.run(obs.delete_public_media("banners", "abc.png", tmp_path / "abc.png"))
    assert not (tmp_path / "abc.png").exists()


def test_media_type():
    assert obs.media_type_for("kyc/u/a.PDF") == "application/pdf"
    assert obs.media_type_for("kyc/u/a.exe") == "application/octet-stream"
