from pathlib import Path

import pytest

from skel_mesh_parser import UnsupportedVersionError, parse_skeleton

FIXTURES = Path(__file__).parent / "fixtures"


def test_parses_synthetic_38_fixture():
    data = (FIXTURES / "synthetic-skeleton-38.skel").read_bytes()
    result = parse_skeleton(data)
    assert result["version"]["raw"] == "3.8.75"
    assert set(result["attachments"].keys()) == {"mesh_a", "region_b", "path_c"}


def test_parses_synthetic_42_fixture():
    data = (FIXTURES / "synthetic-skeleton-42.skel").read_bytes()
    result = parse_skeleton(data)
    assert result["version"]["raw"] == "4.2.0"
    assert set(result["attachments"].keys()) == {"mesh_a", "region_b"}


def test_unsupported_version_still_raises_through_the_public_api():
    with pytest.raises(UnsupportedVersionError):
        parse_skeleton(b"")
