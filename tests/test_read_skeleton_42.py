from pathlib import Path

from skel_mesh_parser.binary_reader import BinaryReader
from skel_mesh_parser.read_skeleton_42 import read_skeleton_42

FIXTURES = Path(__file__).parent / "fixtures"


def _reader_past_header() -> BinaryReader:
    data = (FIXTURES / "synthetic-skeleton-42.skel").read_bytes()
    r = BinaryReader(data)
    r.read_int32(); r.read_int32()  # hash: 2 int32s
    r.read_string()  # version
    return r


def test_reads_mesh_and_region_attachments_from_synthetic_fixture():
    r = _reader_past_header()
    result = read_skeleton_42(r)
    assert set(result.keys()) == {"mesh_a", "region_b"}
    assert result["mesh_a"] == {
        "type": "Mesh", "path": "mesh_a",
        "uvs": [0.0, 0.0, 1.0, 0.0, 0.5, 1.0], "triangles": [0, 1, 2],
    }
    assert result["region_b"] == {"type": "Region", "path": "region_b"}
