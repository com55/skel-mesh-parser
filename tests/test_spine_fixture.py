"""Offline tests for tests/spine_fixture.py. No network: every download goes
through an injected stub, and every cache lives in pytest's tmp_path."""
import pytest

from tests.spine_fixture import (
    ChecksumMismatchError,
    FixtureMissingError,
    FixtureUnavailable,
    resolve_goblins_skel,
    sha256_hex,
)

GOOD = b"\x01\x02\x03\x04"
SHA = sha256_hex(GOOD)


class Net:
    def __init__(self, payload: bytes = GOOD) -> None:
        self.payload = payload
        self.calls: list[str] = []

    def __call__(self, url: str) -> bytes:
        self.calls.append(url)
        return self.payload


def _offline(url: str) -> bytes:
    raise OSError("offline")


def test_download_and_checksum_match_writes_cache(tmp_path):
    cache = tmp_path / "sub" / "f.skel"
    r = resolve_goblins_skel(env={}, cache_path=cache, sha256=SHA, download=Net())
    assert r.source == "download"
    assert cache.read_bytes() == GOOD


def test_cache_with_matching_checksum_is_reused_without_network(tmp_path):
    cache = tmp_path / "f.skel"
    cache.write_bytes(GOOD)
    net = Net()
    r = resolve_goblins_skel(env={}, cache_path=cache, sha256=SHA, download=net)
    assert r.source == "cache"
    assert net.calls == []


def test_cache_with_wrong_checksum_is_discarded_and_redownloaded(tmp_path):
    cache = tmp_path / "f.skel"
    cache.write_bytes(b"corrupted")
    r = resolve_goblins_skel(env={}, cache_path=cache, sha256=SHA, download=Net())
    assert r.source == "download"
    assert cache.read_bytes() == GOOD


def test_download_with_wrong_checksum_fails_and_does_not_populate_cache(tmp_path):
    cache = tmp_path / "f.skel"
    with pytest.raises(ChecksumMismatchError):
        resolve_goblins_skel(env={}, cache_path=cache, sha256=SHA, download=Net(b"\x09"))
    assert not cache.exists()


def test_network_failure_is_unavailable_or_missing_when_required(tmp_path):
    cache = tmp_path / "f.skel"
    with pytest.raises(FixtureUnavailable, match="SPINE_GOBLINS_SKEL"):
        resolve_goblins_skel(env={}, cache_path=cache, sha256=SHA, download=_offline)
    with pytest.raises(FixtureMissingError):
        resolve_goblins_skel(
            env={"SPINE_FIXTURE_REQUIRED": "1"}, cache_path=cache, sha256=SHA, download=_offline
        )


def test_env_override_valid_wrong_checksum_and_missing(tmp_path):
    good = tmp_path / "mine.skel"
    good.write_bytes(GOOD)
    r = resolve_goblins_skel(
        env={"SPINE_GOBLINS_SKEL": str(good)}, cache_path=tmp_path / "c", sha256=SHA, download=_offline
    )
    assert r.source == "env"

    bad = tmp_path / "bad.skel"
    bad.write_bytes(b"nope")
    with pytest.raises(ChecksumMismatchError):
        resolve_goblins_skel(
            env={"SPINE_GOBLINS_SKEL": str(bad)}, cache_path=tmp_path / "c", sha256=SHA, download=_offline
        )
    with pytest.raises(FixtureMissingError):
        resolve_goblins_skel(
            env={"SPINE_GOBLINS_SKEL": str(tmp_path / "missing")},
            cache_path=tmp_path / "c", sha256=SHA, download=_offline,
        )
