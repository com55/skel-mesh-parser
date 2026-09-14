"""Reads just the header and classifies the skeleton binary version -- port
of www/js/vendor/spine-skeleton-binary/detect-version.js's detectVersion.

Tries the 4.2 shape first (8-byte/2xint32 hash, then version string), then
falls back to the 3.8 shape (string hash, then version string) on a fresh
reader. A buffer too small for a given shape raises BufferUnderrunError --
Python's equivalent of DataView's RangeError -- which is the signal to fall
through, not a real error (same as the real JS's RangeError guard)."""
from __future__ import annotations

import re
from typing import Any

from skel_mesh_parser.binary_reader import BinaryReader, BufferUnderrunError

_VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)")


class UnsupportedVersionError(Exception):
    def __init__(self, raw: str | None) -> None:
        super().__init__(f"Unsupported Spine skeleton version: {raw}")
        self.version = raw


def detect_version(data: bytes) -> dict[str, Any]:
    raw42: str | None = None
    try:
        r42 = BinaryReader(data)
        r42.read_int32()
        r42.read_int32()
        raw42 = r42.read_string()
    except BufferUnderrunError:
        pass

    m42 = _VERSION_RE.match(raw42 or "")
    if m42 and int(m42.group(1)) == 4 and int(m42.group(2)) == 2:
        return {"major": 4, "minor": 2, "patch": int(m42.group(3)), "raw": raw42}

    raw38: str | None = None
    try:
        r38 = BinaryReader(data)
        r38.read_string()  # hash
        raw38 = r38.read_string()
    except BufferUnderrunError:
        pass

    m38 = _VERSION_RE.match(raw38 or "")
    if m38 and int(m38.group(1)) == 3 and int(m38.group(2)) == 8:
        return {"major": 3, "minor": 8, "patch": int(m38.group(3)), "raw": raw38}

    raise UnsupportedVersionError(raw42 or raw38 or None)
