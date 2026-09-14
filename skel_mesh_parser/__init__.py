"""Public API for the .skel binary parser -- port of
www/js/vendor/spine-skeleton-binary/index.js's parseSkeleton. Lives directly
in this package's __init__.py (the spec's §1 tree names no separate file for
it) since it's this package's one entry point, mirroring index.js's own role
in the vendored JS package.

Real source's own comment on the re-read below: "Once the version is known,
the header shape is no longer ambiguous -- redo exactly the right skip (not
a 'replay' of a single assumed shape, per the bug this task found)." --
detect_version() consumes its OWN throwaway BinaryReader internally and
never advances the one this function passes to read_skeleton_38/42, so the
header must be walked again here, deliberately, once the version is known."""
from __future__ import annotations

from typing import Any

from skel_mesh_parser.binary_reader import BinaryReader
from skel_mesh_parser.detect_version import UnsupportedVersionError, detect_version
from skel_mesh_parser.read_skeleton_38 import read_skeleton_38
from skel_mesh_parser.read_skeleton_42 import read_skeleton_42

__version__ = "0.2.0"
__all__ = ["parse_skeleton", "UnsupportedVersionError"]


def parse_skeleton(data: bytes) -> dict[str, Any]:
    version = detect_version(data)
    r = BinaryReader(data)
    is_42 = version["major"] == 4 and version["minor"] == 2
    if is_42:
        r.read_int32()
        r.read_int32()
    else:
        r.read_string()
    r.read_string()  # version string -- same position in both shapes

    attachments = read_skeleton_42(r) if is_42 else read_skeleton_38(r)

    return {"version": version, "attachments": attachments}
