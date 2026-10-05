"""Download-on-demand access to the official Spine 3.8 "goblins" example
skeleton used by the integration test (tests/integration/test_goblins_38.py).

The asset is NOT distributed by this repository. It belongs to Esoteric
Software and stays under its original terms (see THIRD_PARTY_NOTICES.md).

Resolution order (first match wins):
  1. $SPINE_GOBLINS_SKEL  -> user-provided file; SHA-256 verified, never downloaded.
  2. .cache/spine/goblins-pro.skel -> reused if its SHA-256 matches; a cached
     file with a different checksum is deleted and re-downloaded.
  3. Download GOBLINS_SKEL_URL (pinned commit, not a moving ref); SHA-256
     verified before it is written to the cache.

A checksum mismatch ALWAYS raises ChecksumMismatchError. An unreachable
fixture (offline, HTTP error) raises FixtureUnavailable so the integration test
can skip with a clear message -- unless SPINE_FIXTURE_REQUIRED=1 is set (CI),
in which case FixtureMissingError is raised instead.
"""
from __future__ import annotations

import hashlib
import os
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

# Official Esoteric Software repository, pinned to an immutable commit
# (the 3.8 reference commit also cited in the README).
GOBLINS_SKEL_URL = (
    "https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/"
    "8b4844bd4b193ba9e54487ed397a777993cbad56/examples/goblins/export/goblins-pro.skel"
)
GOBLINS_SKEL_SHA256 = "7941a9cf45cd9966d6a403efc8808e7a990ec37b5ec8fdd96bb3b2c67d1b7eb1"
GOBLINS_SKEL_ENV = "SPINE_GOBLINS_SKEL"
FIXTURE_REQUIRED_ENV = "SPINE_FIXTURE_REQUIRED"
DEFAULT_CACHE_PATH = Path(__file__).resolve().parent.parent / ".cache" / "spine" / "goblins-pro.skel"


class ChecksumMismatchError(Exception):
    def __init__(self, label: str, expected: str, actual: str) -> None:
        super().__init__(f"SHA-256 mismatch for {label}: expected {expected}, got {actual}")


class FixtureMissingError(Exception):
    """$SPINE_GOBLINS_SKEL points at a missing file, or the fixture is
    unavailable while SPINE_FIXTURE_REQUIRED=1."""


class FixtureUnavailable(Exception):
    """The official fixture could not be obtained (callers should skip)."""


@dataclass(frozen=True)
class Fixture:
    data: bytes
    source: str  # "env" | "cache" | "download"
    path: Path


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _urlopen_download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as res:  # noqa: S310 -- fixed https URL
        return res.read()


def resolve_goblins_skel(
    env: Mapping[str, str] | None = None,
    cache_path: Path = DEFAULT_CACHE_PATH,
    url: str = GOBLINS_SKEL_URL,
    sha256: str = GOBLINS_SKEL_SHA256,
    download: Callable[[str], bytes] = _urlopen_download,
) -> Fixture:
    env = os.environ if env is None else env

    override = env.get(GOBLINS_SKEL_ENV)
    if override:
        p = Path(override)
        if not p.is_file():
            raise FixtureMissingError(f"{GOBLINS_SKEL_ENV}={override} does not exist")
        data = p.read_bytes()
        actual = sha256_hex(data)
        if actual != sha256:
            raise ChecksumMismatchError(override, sha256, actual)
        return Fixture(data, "env", p)

    if cache_path.is_file():
        data = cache_path.read_bytes()
        if sha256_hex(data) == sha256:
            return Fixture(data, "cache", cache_path)
        cache_path.unlink()  # corrupt/stale cache entry: discard and re-download

    try:
        data = download(url)
    except Exception as e:  # network down, DNS, HTTP error, timeout, ...
        reason = (
            f"official Spine fixture unavailable ({type(e).__name__}: {e} fetching {url}). "
            f"Set {GOBLINS_SKEL_ENV}=/path/to/goblins-pro.skel to supply it manually."
        )
        if env.get(FIXTURE_REQUIRED_ENV) == "1":
            raise FixtureMissingError(reason) from e
        raise FixtureUnavailable(reason) from e

    actual = sha256_hex(data)
    if actual != sha256:
        raise ChecksumMismatchError(url, sha256, actual)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = cache_path.with_name(f"{cache_path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, cache_path)
    return Fixture(data, "download", cache_path)
