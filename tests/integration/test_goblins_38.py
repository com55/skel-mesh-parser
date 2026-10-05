"""Integration test against the official Spine 3.8 goblins example. NOT part of
the default test run: use `pytest -m integration`. The asset is not distributed
by this repository -- tests/spine_fixture.py uses a local cache (.cache/spine/),
downloads it from Esoteric Software's official spine-runtimes repository at a
pinned commit, or reads $SPINE_GOBLINS_SKEL, and always verifies a pinned
SHA-256 (see THIRD_PARTY_NOTICES.md). If the fixture cannot be obtained, the
tests are skipped with a clear message; a checksum mismatch fails the run.

Expected values are the confirmed oracle results from the js branch's
cross-validation with the independent `spine_asset` package (MIT-licensed, not
included here) against the same file's default skin."""
import pytest

from skel_mesh_parser import parse_skeleton
from skel_mesh_parser.binary_reader import BinaryReader
from skel_mesh_parser.read_skeleton_38 import read_skeleton_38
from tests.spine_fixture import FixtureUnavailable, resolve_goblins_skel

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def goblins() -> bytes:
    try:
        return resolve_goblins_skel().data  # raises on checksum mismatch
    except FixtureUnavailable as e:
        pytest.skip(str(e))


def test_reports_version_3_8_55(goblins):
    v = parse_skeleton(goblins)["version"]
    assert (v["major"], v["minor"], v["raw"]) == (3, 8, "3.8.55")


def test_default_skin_attachment_set_matches_oracle(goblins):
    attachments = parse_skeleton(goblins)["attachments"]
    # "dagger" appears twice in the default skin (Region + Mesh, same resolved
    # path); the Mesh wins the collision deterministically.
    assert len(attachments) == 3
    assert attachments["dagger"]["type"] == "Mesh"
    assert len(attachments["dagger"]["uvs"]) == 28
    assert len(attachments["dagger"]["triangles"]) == 36
    assert attachments["spear"]["type"] == "Mesh"
    assert len(attachments["spear"]["uvs"]) == 28
    assert len(attachments["spear"]["triangles"]) == 36
    assert attachments["shield"]["type"] == "Region"


def test_every_mesh_has_well_formed_uvs_and_triangles(goblins):
    meshes = [a for a in parse_skeleton(goblins)["attachments"].values() if a["type"] == "Mesh"]
    assert meshes
    for m in meshes:
        assert m["uvs"] and m["triangles"]
        assert len(m["triangles"]) % 3 == 0
        assert all(-0.01 <= v <= 1.01 for v in m["uvs"])


def test_multi_skin_walk_lands_at_end_of_skins_section(goblins):
    # 3 skins (default + 2 others); stops at the start of the events section,
    # offset 10562 -- not len(goblins) (17672), since only attachments are parsed.
    r = BinaryReader(goblins)
    r.read_string()  # 3.8 hash: a string
    r.read_string()  # version string
    read_skeleton_38(r)
    assert r.position == 10562
