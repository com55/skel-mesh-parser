// test/fixtures-38.test.js
// Real-fixture validation against the official Spine 3.8 goblins example
// (fixtures/38/, vendored from the Spine 3.8 example export — see
// fixtures/38/license.txt). Expected values below are the confirmed
// oracle results from an independent cross-validation with the
// `spine_asset` Python package (MIT) against the same file's default
// skin — not just "length > 0" sanity checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSkeleton } from '../src/index.js';

const bytes = readFileSync(new URL('../fixtures/38/goblins-pro.skel', import.meta.url));

test('parses the real goblins-pro.skel (3.8) and reports version 3.8.55', () => {
  const { version } = parseSkeleton(new Uint8Array(bytes));
  assert.equal(version.major, 3);
  assert.equal(version.minor, 8);
  assert.equal(version.raw, '3.8.55');
});

test('goblins-pro.skel default skin: exact attachment set per the spine_asset oracle', () => {
  const { attachments } = parseSkeleton(new Uint8Array(bytes));

  // The oracle lists 4 attachments in the default skin: "dagger" as a
  // Region (one slot) AND "dagger" as a Mesh (a different slot), "spear"
  // as a Mesh, and "shield" as a Region. This library's public
  // Map<path, AttachmentInfo> is keyed by resolved path, so the two
  // "dagger" entries (same name, same resolved path, different type)
  // collapse into one. The tie-break is now deterministic and not
  // dependent on wire order: on a path collision a Mesh always wins over
  // any other type (it conveys uvs/triangles), so the surviving entry is
  // the Mesh dagger regardless of read order.
  assert.equal(attachments.size, 3);

  const dagger = attachments.get('dagger');
  assert.ok(dagger, 'expected a "dagger" attachment');
  assert.equal(dagger.type, 'Mesh', 'the Mesh dagger wins the path collision (deterministic Mesh-wins tie-break)');
  assert.equal(dagger.uvs.length, 28);
  assert.equal(dagger.triangles.length, 36);

  const spear = attachments.get('spear');
  assert.ok(spear, 'expected a "spear" attachment');
  assert.equal(spear.type, 'Mesh');
  assert.equal(spear.uvs.length, 28);
  assert.equal(spear.triangles.length, 36);

  const shield = attachments.get('shield');
  assert.ok(shield, 'expected a "shield" attachment');
  assert.equal(shield.type, 'Region');
});

test('every Mesh attachment in goblins-pro.skel has well-formed uvs/triangles', () => {
  const { attachments } = parseSkeleton(new Uint8Array(bytes));
  const meshes = [...attachments.values()].filter(a => a.type === 'Mesh');
  assert.ok(meshes.length > 0, 'expected at least one Mesh attachment in goblins-pro.skel default skin');
  for (const m of meshes) {
    assert.ok(Array.isArray(m.uvs) && m.uvs.length > 0);
    assert.ok(Array.isArray(m.triangles) && m.triangles.length > 0);
    assert.equal(m.triangles.length % 3, 0);
    assert.ok(m.uvs.every(v => v >= -0.01 && v <= 1.01), 'uvs should be ~0-1 normalized');
  }
});
