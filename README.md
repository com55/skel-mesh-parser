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

## Versions and tags

This `js` branch and the `python` branch are released independently, each
with its own version numbers and tag prefix:

- `js-vX.Y.Z` — this `js` branch (the version in `package.json`).
- `py-vX.Y.Z` — the `python` branch (`skel-mesh-parser`).

1.1.0 added `hullLength` to `Mesh` results; 1.1.1 changes only the license
(Apache-2.0) and test assets, not the parser.

## Testing

```sh
npm test                  # all normal tests — offline, no Spine assets needed
npm run test:integration  # needs the official Spine 3.8 example asset (see below)
```

- **Normal tests** (`npm test`) use only hand-built binary fixtures created for this repo. They never touch the network or any Spine asset.
- **Integration test** (`npm run test:integration`) validates the 3.8 reader against the official Spine example `goblins-pro.skel`, cross-checked against an independent Python parser (`spine_asset`, MIT) for exact `uvs`/`triangles` counts. **This repository does not distribute that file** — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Instead, `test-support/spine-fixture.js` resolves it as follows:
  1. If `SPINE_GOBLINS_SKEL=/path/to/goblins-pro.skel` is set, that file is used (and never downloaded).
  2. Otherwise `.cache/spine/goblins-pro.skel` (gitignored) is reused if present.
  3. Otherwise it is downloaded once from Esoteric Software's official `EsotericSoftware/spine-runtimes` repository, at a **pinned commit** (not a moving branch), and cached.
- **Checksum verification.** Every source is verified against a pinned SHA-256 (`GOBLINS_SKEL_SHA256`). A mismatch fails the test run; a cached file with the wrong checksum is discarded and re-downloaded. Nothing is written to the cache unless it verified.
- **Fixture unavailable** (offline, HTTP error): the integration tests are skipped with a message explaining how to supply the file. Set `SPINE_FIXTURE_REQUIRED=1` (as CI does) to fail instead of skip.
- **4.2**: validated against a real production `.skel` that is not included in this repo (validated in the consuming project's own test suite).

## Provenance

The implementation was written independently. The official Spine Runtime source was consulted only to verify binary-format behavior and field layout; its source code was not copied or translated into this project. The reference source (`spine-ts`) is licensed under the Spine Runtimes License, which is not a permissive license. Source comments cite the exact file/line/commit each field-layout fact was checked against, so a reviewer can verify those facts against the primary source. This project is not a Spine runtime. Pinned commits (branch HEAD at time of writing, 2026-08-28 — re-verify before relying on a moved branch ref):
- 4.2: `EsotericSoftware/spine-runtimes@b81e5a58ed38704aee4f866f0e0ac672623ce914`, `spine-ts/spine-core/src/SkeletonBinary.ts`
- 3.8: `EsotericSoftware/spine-runtimes@8b4844bd4b193ba9e54487ed397a777993cbad56`, `spine-ts/core/src/SkeletonBinary.ts`

## Disclaimer

This project is **not affiliated with, endorsed by, or associated with Esoteric Software** or the Spine runtime in any way. "Spine" is a trademark of Esoteric Software.

Licensed under the [Apache License 2.0](LICENSE). That license applies to this project's source code only, not to third-party assets or trademarks — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Provided **as-is, without warranty of any kind** — see [LICENSE](LICENSE) for details.
