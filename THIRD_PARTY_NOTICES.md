# Third-party notices

This project's source code is licensed under the [Apache License 2.0](LICENSE).
That license applies **only to this project's own source code**. It does not
cover, and grants no rights in, any third-party asset or trademark.

## Esoteric Software / Spine

- **Trademarks.** "Spine" is a trademark of Esoteric Software. This project is
  not affiliated with, endorsed by, or associated with Esoteric Software, and the
  Apache-2.0 license does not grant any right to use that trademark.
- **Spine Runtimes source.** The official Spine Runtimes (`spine-runtimes`) are
  licensed under the Spine Runtimes License, which is not a permissive license.
  No code from them is included in this repository; they were consulted only to
  verify binary-format behavior and field layout (see "Provenance" in the
  README).
- **Official example assets.** The optional integration test uses the official
  Spine 3.8 `goblins-pro.skel` example export. **This repository does not
  contain or distribute that file.** It is fetched on demand from Esoteric
  Software's official `EsotericSoftware/spine-runtimes` repository (pinned
  commit, SHA-256 verified; see the README "Testing" section), or supplied by
  you via `SPINE_GOBLINS_SKEL`. The file remains subject to its original Esoteric
  Software terms, including the license file that accompanies the examples in
  that repository. If you fetch or use it, you are responsible for complying with
  those terms. The Apache-2.0 license of this project does not apply to it.

## Other

- The integration test's expected values were cross-checked against the
  independent `spine_asset` Python package (MIT-licensed). It is not included in,
  or required by, this repository.
