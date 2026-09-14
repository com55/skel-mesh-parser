# skel-mesh-parser (Python)

Python port of this repo's `js` branch (`spine-skeleton-binary-js`): a
minimal, dependency-free parser for the skin/attachment section of Spine
skeleton binary files (`.skel`) that returns, per attachment, its raw type
and — for `Mesh`-type attachments — the `uvs`/`triangles` needed to build a
texture-space silhouette. It is **not** a Spine runtime: no rendering, no
animation, no timelines, IK, physics, or constraint solving. Supports Spine
versions **3.8.x and 4.2.x only** (anything else raises
`UnsupportedVersionError`).

**Status:** package skeleton only — the actual port from the `js` branch has
not landed yet. See that branch for the reference implementation this one
is porting from, field-for-field, with no behavioral changes.

## Usage (once implemented)

```python
from skel_mesh_parser import parse_skeleton

data = open("some.skel", "rb").read()
result = parse_skeleton(data)

# result["version"]: {"major": int, "minor": int, "patch": int, "raw": str}
# result["attachments"]: dict[str, AttachmentInfo], keyed by the
# attachment's resolved path (the atlas region name it draws from)

info = result["attachments"]["some_region_name"]
# info["type"]: "Region" | "BoundingBox" | "Mesh" | "LinkedMesh" | "Path" | "Point" | "Clipping"
# info["uvs"] / info["triangles"]: present ONLY when info["type"] == "Mesh"
```

**Scope, by design (same as the `js` branch):**
- Default skin only. Non-default skins are walked (to keep the byte stream
  aligned) but not returned.
- `Mesh`-type attachments only carry `uvs`/`triangles`.
- `LinkedMesh` is reported as its own distinct type, never confused with
  `Mesh`.
- On an attachment-path collision within the same skin, the `Mesh` entry
  always wins, deterministically, regardless of wire order.

## Provenance

This is a direct, mechanical port of the `js` branch's implementation —
not a re-derivation from the original `spine-ts` reference source. See the
`js` branch's own README for the primary provenance note (which spine-ts
commits its field-layout facts were read against) and its licensing
rationale (informed by reading, not copying, spine-ts, which is licensed
under the non-permissive Spine Runtimes License).

## Disclaimer

This project is **not affiliated with, endorsed by, or associated with
Esoteric Software** or the Spine runtime in any way. "Spine" is a trademark
of Esoteric Software.

Provided **as-is, without warranty of any kind** — see [LICENSE](LICENSE)
for details.
