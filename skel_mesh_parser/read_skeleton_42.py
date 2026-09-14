"""4.2.x skeleton binary walker -- port of
www/js/vendor/spine-skeleton-binary/read-skeleton-42.js. Field order matches
the vendored JS exactly (spec §6: mechanical port, no redesign). Bone/slot/
constraint field values are read (to stay byte-aligned) but not retained --
only the skins/attachments that follow are needed."""
from __future__ import annotations

from typing import Any

from skel_mesh_parser.binary_reader import BinaryReader

_ATTACHMENT_TYPES = ["Region", "BoundingBox", "Mesh", "LinkedMesh", "Path", "Point", "Clipping"]


def walk_header_and_constraints_42(r: BinaryReader) -> tuple[list[str | None], bool]:
    r.read_float(); r.read_float(); r.read_float(); r.read_float()  # x, y, width, height
    r.read_float()  # referenceScale
    nonessential = r.read_boolean()
    if nonessential:
        r.read_float(); r.read_string(); r.read_string()  # fps, imagesPath, audioPath

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
        r.read_byte()  # inherit
        r.read_boolean()  # skinRequired
        if nonessential:
            r.read_int32()  # color
            r.read_string()  # icon
            r.read_boolean()  # visible

    num_slots = r.read_varint(True)
    for _ in range(num_slots):
        r.read_string()  # name
        r.read_varint(True)  # boneIndex
        r.read_int32(); r.read_int32()  # color, darkColor
        r.read_string_ref(strings)  # attachmentName
        r.read_varint(True)  # blendMode
        if nonessential:
            r.read_boolean()  # visible

    _skip_ik_constraints_42(r)
    _skip_transform_constraints_42(r)
    _skip_path_constraints_42(r)
    _skip_physics_constraints_42(r)

    return strings, nonessential


def _skip_ik_constraints_42(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True)
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True)
        flags = r.read_ubyte()
        if (flags & 32) and (flags & 64):
            r.read_float()
        if flags & 128:
            r.read_float()


def _skip_transform_constraints_42(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True)
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True)
        flags1 = r.read_ubyte()
        if flags1 & 8: r.read_float()
        if flags1 & 16: r.read_float()
        if flags1 & 32: r.read_float()
        if flags1 & 64: r.read_float()
        if flags1 & 128: r.read_float()
        flags2 = r.read_ubyte()
        if flags2 & 1: r.read_float()
        if flags2 & 2: r.read_float()
        if flags2 & 4: r.read_float()
        if flags2 & 8: r.read_float()
        if flags2 & 16: r.read_float()
        if flags2 & 32: r.read_float()
        if flags2 & 64: r.read_float()


def _skip_path_constraints_42(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True); r.read_boolean()
        nn = r.read_varint(True)
        for _ in range(nn):
            r.read_varint(True)
        r.read_varint(True)
        flags = r.read_ubyte()
        if flags & 128:
            r.read_float()
        r.read_float(); r.read_float(); r.read_float(); r.read_float(); r.read_float()


def _skip_physics_constraints_42(r: BinaryReader) -> None:
    n = r.read_varint(True)
    for _ in range(n):
        r.read_string(); r.read_varint(True); r.read_varint(True)
        flags = r.read_ubyte()
        if flags & 2: r.read_float()
        if flags & 4: r.read_float()
        if flags & 8: r.read_float()
        if flags & 16: r.read_float()
        if flags & 32: r.read_float()
        if flags & 64: r.read_float()  # limit
        r.read_ubyte()  # step
        r.read_float(); r.read_float(); r.read_float()  # inertia, strength, damping
        if flags & 128:
            r.read_float()  # massInverse
        r.read_float(); r.read_float()  # wind, gravity
        flags2 = r.read_ubyte()
        if flags2 & 128:
            r.read_float()  # mix


def read_skeleton_42(r: BinaryReader) -> dict[str, dict[str, Any]]:
    strings, nonessential = walk_header_and_constraints_42(r)
    result: dict[str, dict[str, Any]] = {}
    _read_skin_42(r, strings, nonessential, result)
    other_skin_count = r.read_varint(True)
    for _ in range(other_skin_count):
        r.read_string()  # skin name
        if nonessential:
            r.read_int32()  # skin color (4.2 only)
        _skip_skin_bone_and_constraint_refs_42(r)
        _read_skin_42(r, strings, nonessential, None)
    return result


def _read_skin_42(
    r: BinaryReader,
    strings: list[str | None],
    nonessential: bool,
    out_map: dict[str, dict[str, Any]] | None,
) -> None:
    slot_count = r.read_varint(True)
    for _ in range(slot_count):
        r.read_varint(True)  # slotIndex, unused
        attachment_count = r.read_varint(True)
        for _ in range(attachment_count):
            attachment_name = r.read_string_ref(strings)
            info = _read_attachment_42(r, strings, attachment_name, nonessential)
            if out_map is not None and info is not None:
                existing = out_map.get(info["path"])
                if existing is None or info["type"] == "Mesh" or existing["type"] != "Mesh":
                    out_map[info["path"]] = info


def _read_attachment_42(
    r: BinaryReader,
    strings: list[str | None],
    attachment_name: str | None,
    nonessential: bool,
) -> dict[str, Any] | None:
    flags = r.read_ubyte()
    name = r.read_string_ref(strings) if (flags & 8) else attachment_name
    type_index = flags & 0b111
    attachment_type = _ATTACHMENT_TYPES[type_index]

    if attachment_type == "Region":
        path = r.read_string_ref(strings) if (flags & 16) else None
        if flags & 32:
            r.read_int32()
        if flags & 64:
            _skip_sequence_42(r)
        if flags & 128:
            r.read_float()
        r.read_float(); r.read_float(); r.read_float(); r.read_float(); r.read_float(); r.read_float()
        return {"type": "Region", "path": path if path is not None else name}

    if attachment_type == "BoundingBox":
        _read_vertices_42(r, bool(flags & 16))
        if nonessential:
            r.read_int32()
        return {"type": "BoundingBox", "path": name}

    if attachment_type == "Mesh":
        path = r.read_string_ref(strings) if (flags & 16) else name
        if flags & 32:
            r.read_int32()
        if flags & 64:
            _skip_sequence_42(r)
        hull_length = r.read_varint(True)
        float_count = _read_vertices_42(r, bool(flags & 128))
        uvs = _read_float_array_42(r, float_count)
        triangle_count = (float_count - hull_length - 2) * 3
        triangles = [r.read_varint(True) for _ in range(triangle_count)]
        if nonessential:
            edge_count = r.read_varint(True)
            for _ in range(edge_count):
                r.read_varint(True)
            r.read_float(); r.read_float()
        return {"type": "Mesh", "path": path if path is not None else name, "uvs": uvs, "triangles": triangles}

    if attachment_type == "LinkedMesh":
        path = r.read_string_ref(strings) if (flags & 16) else name
        if flags & 32:
            r.read_int32()
        if flags & 64:
            _skip_sequence_42(r)
        r.read_varint(True)  # skinIndex
        r.read_string_ref(strings)  # parent
        if nonessential:
            r.read_float(); r.read_float()
        return {"type": "LinkedMesh", "path": path if path is not None else name}

    if attachment_type == "Path":
        float_count = _read_vertices_42(r, bool(flags & 64))
        length_count = float_count // 6
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
        _read_vertices_42(r, bool(flags & 16))
        if nonessential:
            r.read_int32()
        return {"type": "Clipping", "path": name}

    raise ValueError(f"Unknown attachment type flag: {type_index}")


def _read_vertices_42(r: BinaryReader, weighted: bool) -> int:
    """Returns floatCount (the real JS returns { floatCount } -- Python
    returns it bare since that's the only field callers ever read)."""
    vertex_count = r.read_varint(True)
    float_count = vertex_count * 2
    if not weighted:
        for _ in range(float_count):
            r.read_float()
        return float_count
    for _ in range(vertex_count):
        bone_count = r.read_varint(True)
        for _ in range(bone_count):
            r.read_varint(True)  # boneIndex
            r.read_float(); r.read_float(); r.read_float()  # weightX, weightY, weightValue
    return float_count


def _read_float_array_42(r: BinaryReader, n: int) -> list[float]:
    return [r.read_float() for _ in range(n)]


def _skip_sequence_42(r: BinaryReader) -> None:
    r.read_varint(True); r.read_varint(True); r.read_varint(True); r.read_varint(True)


def _skip_skin_bone_and_constraint_refs_42(r: BinaryReader) -> None:
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
    physics_count = r.read_varint(True)
    for _ in range(physics_count):
        r.read_varint(True)
