"""3.8.x skeleton binary walker -- port of
www/js/vendor/spine-skeleton-binary/read-skeleton-38.js. Field order matches
the vendored JS exactly (spec §6: mechanical port, no redesign). 3.8 has no
per-record flag byte anywhere: every field is read unconditionally except
where marked nonessential-gated."""
from __future__ import annotations

from typing import Any

from skel_mesh_parser.binary_reader import BinaryReader

_ATTACHMENT_TYPES = ["Region", "BoundingBox", "Mesh", "LinkedMesh", "Path", "Point", "Clipping"]


def walk_header_and_constraints_38(r: BinaryReader) -> tuple[list[str | None], bool]:
    r.read_float(); r.read_float(); r.read_float(); r.read_float()  # x, y, width, height
    nonessential = r.read_boolean()
    if nonessential:
        r.read_float()   # fps
        r.read_string()  # imagesPath
        r.read_string()  # audioPath

    num_strings = r.read_varint(True)
    strings: list[str | None] = [r.read_string() for _ in range(num_strings)]

    num_bones = r.read_varint(True)
    for i in range(num_bones):
        r.read_string()  # name
        if i != 0:
            r.read_varint(True)  # parent index
        r.read_float(); r.read_float(); r.read_float()  # rotation, x, y
        r.read_float(); r.read_float()  # scaleX, scaleY
        r.read_float(); r.read_float()  # shearX, shearY
        r.read_float()  # length
        r.read_varint(True)  # transformMode
        r.read_boolean()  # skinRequired
        if nonessential:
            r.read_int32()  # color

    num_slots = r.read_varint(True)
    for _ in range(num_slots):
        r.read_string()  # name
        r.read_varint(True)  # boneIndex
        r.read_int32()  # color
        r.read_int32()  # darkColor
        r.read_string_ref(strings)  # attachmentName
        r.read_varint(True)  # blendMode

    _skip_ik_constraints_38(r)
    _skip_transform_constraints_38(r)
    _skip_path_constraints_38(r)

    return strings, nonessential


def _skip_ik_constraints_38(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True); r.read_boolean()
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True)
        r.read_float(); r.read_float()
        r.read_byte(); r.read_boolean(); r.read_boolean(); r.read_boolean()


def _skip_transform_constraints_38(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True); r.read_boolean()
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True)
        r.read_boolean(); r.read_boolean()
        for _ in range(10):
            r.read_float()


def _skip_path_constraints_38(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True); r.read_boolean()
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True); r.read_varint(True); r.read_varint(True); r.read_varint(True)
        for _ in range(5):
            r.read_float()


def read_skeleton_38(r: BinaryReader) -> dict[str, dict[str, Any]]:
    strings, nonessential = walk_header_and_constraints_38(r)
    result: dict[str, dict[str, Any]] = {}
    _read_skin_38(r, strings, nonessential, result)
    other_skin_count = r.read_varint(True)
    for _ in range(other_skin_count):
        r.read_string_ref(strings)  # skin name (table-index ref in 3.8)
        _skip_skin_bone_and_constraint_refs_38(r)
        _read_skin_38(r, strings, nonessential, None)
    return result


def _read_skin_38(
    r: BinaryReader,
    strings: list[str | None],
    nonessential: bool,
    out_map: dict[str, dict[str, Any]] | None,
) -> None:
    slot_count = r.read_varint(True)
    for _ in range(slot_count):
        r.read_varint(True)  # slotIndex
        attachment_count = r.read_varint(True)
        for _ in range(attachment_count):
            attachment_name = r.read_string_ref(strings)
            info = _read_attachment_38(r, strings, attachment_name, nonessential)
            if out_map is not None and info is not None:
                existing = out_map.get(info["path"])
                if existing is None or info["type"] == "Mesh" or existing["type"] != "Mesh":
                    out_map[info["path"]] = info


def _read_attachment_38(
    r: BinaryReader,
    strings: list[str | None],
    attachment_name: str | None,
    nonessential: bool,
) -> dict[str, Any] | None:
    name = r.read_string_ref(strings)
    if name is None:
        name = attachment_name
    type_index = r.read_ubyte()
    attachment_type = _ATTACHMENT_TYPES[type_index]

    if attachment_type == "Region":
        path = r.read_string_ref(strings)
        r.read_float(); r.read_float(); r.read_float(); r.read_float()
        r.read_float(); r.read_float(); r.read_float()
        r.read_int32()
        return {"type": "Region", "path": path if path is not None else name}

    if attachment_type == "BoundingBox":
        vertex_count = r.read_varint(True)
        _read_vertices_38(r, vertex_count)
        if nonessential:
            r.read_int32()
        return {"type": "BoundingBox", "path": name}

    if attachment_type == "Mesh":
        path = r.read_string_ref(strings)
        r.read_int32()  # color
        vertex_count = r.read_varint(True)
        uvs = _read_float_array_38(r, vertex_count * 2)
        triangle_count = r.read_varint(True)
        triangles = [r.read_short() for _ in range(triangle_count)]
        _read_vertices_38(r, vertex_count)
        r.read_varint(True)  # hullLength, unused
        if nonessential:
            edge_count = r.read_varint(True)
            for _ in range(edge_count):
                r.read_short()
            r.read_float(); r.read_float()  # width, height
        return {"type": "Mesh", "path": path if path is not None else name, "uvs": uvs, "triangles": triangles}

    if attachment_type == "LinkedMesh":
        path = r.read_string_ref(strings)
        r.read_int32()  # color
        r.read_string_ref(strings)  # skinName
        r.read_string_ref(strings)  # parent
        r.read_boolean()  # inheritDeform
        if nonessential:
            r.read_float(); r.read_float()
        return {"type": "LinkedMesh", "path": path if path is not None else name}

    if attachment_type == "Path":
        r.read_boolean()  # closed
        r.read_boolean()  # constantSpeed
        vertex_count = r.read_varint(True)
        _read_vertices_38(r, vertex_count)
        # Real JS: `const lengthCount = vertexCount / 3;` (float division)
        # then `for (let i = 0; i < lengthCount; i++)` -- a `<` loop bound
        # against a possibly-fractional value iterates ceil(vertexCount/3)
        # times, NOT floor(vertexCount/3). Plain `//` here would silently
        # under-read one float for any vertexCount not a multiple of 3 (a
        # single open Bezier path segment is 4 control points, a real and
        # plausible shape, not an edge case) -- desyncing every subsequent
        # read in this skin with no exception raised. Found by Stage 2's
        # own scrutinize review; `(vertex_count + 2) // 3` is the integer
        # form of ceil(vertex_count / 3) for non-negative vertex_count.
        length_count = (vertex_count + 2) // 3
        for _ in range(length_count):
            r.read_float()
        if nonessential:
            r.read_int32()
        return {"type": "Path", "path": name}

    if attachment_type == "Point":
        r.read_float(); r.read_float(); r.read_float()
        if nonessential:
            r.read_int32()
        return {"type": "Point", "path": name}

    if attachment_type == "Clipping":
        r.read_varint(True)  # endSlotIndex
        vertex_count = r.read_varint(True)
        _read_vertices_38(r, vertex_count)
        if nonessential:
            r.read_int32()
        return {"type": "Clipping", "path": name}

    raise ValueError(f"Unknown attachment type index: {type_index}")


def _read_vertices_38(r: BinaryReader, vertex_count: int) -> None:
    float_count = vertex_count * 2
    weighted = r.read_boolean()
    if not weighted:
        for _ in range(float_count):
            r.read_float()
        return
    for _ in range(vertex_count):
        bone_count = r.read_varint(True)
        for _ in range(bone_count):
            r.read_varint(True)  # bone index
            r.read_float(); r.read_float(); r.read_float()  # x, y, weight


def _read_float_array_38(r: BinaryReader, n: int) -> list[float]:
    return [r.read_float() for _ in range(n)]


def _skip_skin_bone_and_constraint_refs_38(r: BinaryReader) -> None:
    bone_count = r.read_varint(True)
    for _ in range(bone_count):
        r.read_varint(True)
    ik_count = r.read_varint(True)
    for _ in range(ik_count):
        r.read_varint(True)
    transform_count = r.read_varint(True)
    for _ in range(transform_count):
        r.read_varint(True)
    path_count = r.read_varint(True)
    for _ in range(path_count):
        r.read_varint(True)
