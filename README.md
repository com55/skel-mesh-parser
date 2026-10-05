# skel-mesh-parser (Python)

Python port of this repo's `js` branch (`spine-skeleton-binary-js`): a
minimal, dependency-free parser for the skin/attachment section of Spine
skeleton binary files (`.skel`) that returns, per attachment, its raw type
and — for `Mesh`-type attachments — the `uvs`/`triangles` needed to build a
texture-space silhouette. It is **not** a Spine runtime: no rendering, no
animation, no timelines, IK, physics, or constraint solving. Supports Spine
versions **3.8.x and 4.2.x only** (anything else raises
`UnsupportedVersionError`).

**Status:** implemented (v0.2.0) — `parse_skeleton` is wired up for both
3.8.x and 4.2.x. It is a field-for-field port of the `js` branch's reader
and has been validated against the official Spine 3.8 `goblins-pro.skel`
example (see [Testing](#testing)). Note that it tracks the `js` branch as of
v0.2.0; later `js` changes (e.g. `hullLength` on `Mesh` results) have not
been ported.

## Usage

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

## Testing

```sh
python -m pytest                  # all normal tests — offline, no Spine assets needed
python -m pytest -m integration   # needs the official Spine 3.8 example asset (see below)
```

(or `uv run pytest` / `uv run pytest -m integration`)

- **Normal tests** use only hand-built binary fixtures created for this repo (`tests/fixtures/`). They never touch the network or any Spine asset.
- **Integration test** (`tests/integration/`) validates the 3.8 reader against the official Spine example `goblins-pro.skel`, using the same oracle values as the `js` branch. **This repository does not distribute that file** — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Instead, `tests/spine_fixture.py` resolves it as follows:
  1. If `SPINE_GOBLINS_SKEL=/path/to/goblins-pro.skel` is set, that file is used (and never downloaded).
  2. Otherwise `.cache/spine/goblins-pro.skel` (gitignored) is reused if present.
  3. Otherwise it is downloaded once from Esoteric Software's official `EsotericSoftware/spine-runtimes` repository, at a **pinned commit** (not a moving branch), and cached.
- **Checksum verification.** Every source is verified against a pinned SHA-256 (`GOBLINS_SKEL_SHA256`). A mismatch fails the test run; a cached file with the wrong checksum is discarded and re-downloaded. Nothing is written to the cache unless it verified.
- **Fixture unavailable** (offline, HTTP error): the integration tests are skipped with a message explaining how to supply the file. Set `SPINE_FIXTURE_REQUIRED=1` (as CI does) to fail instead of skip.

## Provenance

This is a port of the `js` branch's implementation, which was written independently. The official Spine Runtime source was consulted only to verify binary-format behavior and field layout; its source code was not copied or translated into this project. The reference source (`spine-ts`) is licensed under the Spine Runtimes License, which is not a permissive license. This project is not a Spine runtime. See the `js` branch's README and source comments for the exact file/line/commit each field-layout fact was checked against. Pinned commits (branch HEAD at time of writing, 2026-08-28 — re-verify before relying on a moved branch ref):
- 4.2: `EsotericSoftware/spine-runtimes@b81e5a58ed38704aee4f866f0e0ac672623ce914`, `spine-ts/spine-core/src/SkeletonBinary.ts`
- 3.8: `EsotericSoftware/spine-runtimes@8b4844bd4b193ba9e54487ed397a777993cbad56`, `spine-ts/core/src/SkeletonBinary.ts`

## Disclaimer

This project is **not affiliated with, endorsed by, or associated with
Esoteric Software** or the Spine runtime in any way. "Spine" is a trademark
of Esoteric Software.

Licensed under the [Apache License 2.0](LICENSE). That license applies to this
project's source code only, not to third-party assets or trademarks — see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Provided **as-is, without
warranty of any kind** — see [LICENSE](LICENSE) for details.
