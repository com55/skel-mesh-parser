# spine-skeleton-binary-js

A minimal, dependency-free JS/ESM library that parses the skin/attachment section of Spine skeleton binary files (`.skel`) and returns, per attachment, its raw type and — for `Mesh`-type attachments — the `uvs`/`triangles` needed to build a texture-space silhouette. It is **not** a Spine runtime: it does no rendering, no animation, no timelines, IK, physics, or constraint solving, and it supports Spine versions **3.8.x and 4.2.x only** (anything else throws `UnsupportedVersionError`).

## Usage

```js
import { parseSkeleton } from 'spine-skeleton-binary-js';

const bytes = new Uint8Array(/* your .skel file's contents */);
const { version, attachments } = parseSkeleton(bytes);

// version: { major, minor, patch, raw } — e.g. { major: 4, minor: 2, patch: 33, raw: "4.2.33" }
// attachments: Map<string, AttachmentInfo>, keyed by the attachment's
// resolved path (the atlas region name it draws from)

const info = attachments.get('some_region_name');
// info.type: 'Region' | 'BoundingBox' | 'Mesh' | 'LinkedMesh' | 'Path' | 'Point' | 'Clipping'
// info.uvs / info.triangles: present ONLY when info.type === 'Mesh'
```

**Scope, by design:**
- Default skin only. Non-default skins are walked (to keep the byte stream aligned) but not returned.
- `Mesh`-type attachments only carry `uvs`/`triangles` — `Region` et al. don't need them (a `Region`'s whole rectangle *is* its content).
- `LinkedMesh` is reported as its own distinct type, never confused with `Mesh` — its real geometry lives in a parent mesh attachment (possibly in another skin), which this library doesn't resolve.
- If an attachment path collides with another attachment's path within the same skin (two different slots drawing the same underlying region, one as e.g. `Region` and one as `Mesh`), the `Mesh` entry always wins, deterministically — regardless of which one appears first on the wire.

## Tested against real files

Beyond hand-built binary fixtures for each wire-format branch, this library is validated against:
- **3.8**: the official Spine example asset `goblins-pro.skel` (vendored at `fixtures/38/`, redistributed under Esoteric Software's example-asset license — see `fixtures/38/license.txt`), cross-checked against an independent Python parser (`spine_asset`, MIT) for exact `uvs`/`triangles` counts.
- **4.2**: a real production `.skel` (not included in this repo — validated in the consuming project's own test suite).

## Provenance (read, not copied)

Implementation is informed by reading — never copying — the official `spine-ts` reference source, which is licensed under the Spine Runtimes License (not permissive; redistributing or deriving substantial code from it requires a Spine Editor license per that license's terms). Every field-layout fact in this project's source cites the exact file/line/commit it came from, so a reviewer can verify the *facts* (wire format, byte order, field presence) against primary source without this repo's code being a derivative of that source's *expression*. Pinned commits (branch HEAD at time of writing, 2026-08-28 — re-verify before relying on a moved branch ref):
- 4.2: `EsotericSoftware/spine-runtimes@b81e5a58ed38704aee4f866f0e0ac672623ce914`, `spine-ts/spine-core/src/SkeletonBinary.ts`
- 3.8: `EsotericSoftware/spine-runtimes@8b4844bd4b193ba9e54487ed397a777993cbad56`, `spine-ts/core/src/SkeletonBinary.ts`
