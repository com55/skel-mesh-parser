from pathlib import Path

from skel_mesh_parser.binary_reader import BinaryReader
from skel_mesh_parser.read_skeleton_38 import read_skeleton_38

FIXTURES = Path(__file__).parent / "fixtures"


def _reader_past_header() -> BinaryReader:
    data = (FIXTURES / "synthetic-skeleton-38.skel").read_bytes()
    r = BinaryReader(data)
    r.read_string()  # hash
    r.read_string()  # version
    return r


def test_reads_mesh_region_and_path_attachments_from_synthetic_fixture():
    r = _reader_past_header()
    result = read_skeleton_38(r)
    assert set(result.keys()) == {"mesh_a", "region_b", "path_c"}
    assert result["mesh_a"] == {
        "type": "Mesh", "path": "mesh_a",
        "uvs": [0.0, 0.0, 1.0, 0.0, 0.5, 1.0], "triangles": [0],
    }
    assert result["region_b"] == {"type": "Region", "path": "region_b"}
    # This is the discriminating assertion for the ceil-vs-floor bug: if
    # read_skeleton_38 under-reads the Path attachment's trailing floats
    # (floor instead of ceil), the byte stream desyncs and this dict either
    # never gets built (an exception fires first) or comes back wrong --
    # a bare "did path_c parse to type Path" check is not enough on its
    # own, the surrounding otherSkinCount read must also land correctly.
    assert result["path_c"] == {"type": "Path", "path": "path_c"}
