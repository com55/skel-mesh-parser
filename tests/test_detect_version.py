from pathlib import Path

import pytest

from skel_mesh_parser.detect_version import UnsupportedVersionError, detect_version

FIXTURES = Path(__file__).parent / "fixtures"


def test_detects_38_from_real_fixture():
    data = (FIXTURES / "synthetic-skeleton-38.skel").read_bytes()
    v = detect_version(data)
    assert v == {"major": 3, "minor": 8, "patch": 75, "raw": "3.8.75"}


def test_detects_42_from_real_fixture():
    data = (FIXTURES / "synthetic-skeleton-42.skel").read_bytes()
    v = detect_version(data)
    assert v == {"major": 4, "minor": 2, "patch": 0, "raw": "4.2.0"}


def test_unsupported_version_raises():
    # A plausible-shaped but unsupported version string (5.0.0), 3.8-style
    # header: hash="" (varint 1), version="5.0.0" (varint 6 + 5 ascii bytes).
    data = bytes([0x01]) + bytes([0x06]) + b"5.0.0"
    with pytest.raises(UnsupportedVersionError) as exc_info:
        detect_version(data)
    assert exc_info.value.version == "5.0.0"


def test_too_short_buffer_raises_unsupported_not_buffer_underrun():
    # Neither the 4.2 nor 3.8 header shape can be read from an empty
    # buffer -- both trials hit BufferUnderrunError internally and are
    # swallowed, surfacing as UnsupportedVersionError(None), matching the
    # real JS's RangeError-swallowed-then-UnsupportedVersionError(null) path.
    with pytest.raises(UnsupportedVersionError) as exc_info:
        detect_version(b"")
    assert exc_info.value.version is None
