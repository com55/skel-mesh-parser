// test/read-skeleton-38.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinaryReader } from '../src/binary-reader.js';
import { walkHeaderAndConstraints38, readSkeleton38 } from '../src/read-skeleton-38.js';

function u8(...bytes) { return new Uint8Array(bytes); }

// Spine's length-prefixed string: byteCount = len + 1 (1 = empty, 0 = null).
function name(s) { return u8(s.length + 1, ...Array.from(s).map(c => c.charCodeAt(0))); }

test('walks a minimal 3.8 skeleton to the skins boundary', () => {
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height (4 floats, no referenceScale)
    0,        // nonessential = false
    0,         // numStrings = 0
    0,          // numBones = 0
    0,           // numSlots = 0
    0,            // numIkConstraints = 0
    0,             // numTransformConstraints = 0
    0,              // numPathConstraints = 0 (no physics — 3.8 has 3 kinds, not 4)
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints38(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('walks one bone and one slot correctly (nonessential = false)', () => {
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height (4 floats)
    0,                        // nonessential = false
    0,                         // numStrings = 0
    1,                          // numBones = 1
      ...name('root'),           // bone[0].name
      // no parent index for bone 0
      0,0,0,0, 0,0,0,0, 0,0,0,0, // rotation, x, y
      0,0,0,0, 0,0,0,0,           // scaleX, scaleY
      0,0,0,0, 0,0,0,0,            // shearX, shearY
      0,0,0,0,                      // length
      0,                              // transformMode (varint enum index)
      0,                               // skinRequired
      // nonessential = false → no color
    1,                          // numSlots = 1
      ...name('slot0'),           // slot[0].name
      0,                            // boneIndex = 0
      0,0,0,0,                       // color
      0,0,0,0,                        // darkColor (unconditional in 3.8)
      0,                                // attachmentName ref = 0 (null)
      0,                                 // blendMode
    0,0,0,                    // 3 constraint-count varints, all 0
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints38(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('walks one bone and one slot correctly (nonessential = true)', () => {
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height (4 floats)
    1,                        // nonessential = true
      0,0,0,0,                // fps = 0.0
      0,                       // imagesPath = null
      0,                       // audioPath = null
    0,                         // numStrings = 0
    1,                          // numBones = 1
      ...name('root'),           // bone[0].name
      // no parent index for bone 0
      0,0,0,0, 0,0,0,0, 0,0,0,0, // rotation, x, y
      0,0,0,0, 0,0,0,0,           // scaleX, scaleY
      0,0,0,0, 0,0,0,0,            // shearX, shearY
      0,0,0,0,                      // length
      0,                              // transformMode (varint enum index)
      1,                               // skinRequired
      0,0,0,0,                        // color (nonessential-gated)
    1,                          // numSlots = 1
      ...name('slot0'),           // slot[0].name
      0,                            // boneIndex = 0
      0,0,0,0,                       // color
      0,0,0,0,                        // darkColor (unconditional in 3.8)
      0,                                // attachmentName ref = 0 (null)
      0,                                 // blendMode
    0,0,0,                    // 3 constraint-count varints, all 0
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints38(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('walks one of each 3.8 constraint kind (IK, transform, path)', () => {
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height (4 floats)
    0,                        // nonessential = false
    0,                         // numStrings = 0
    0,                          // numBones = 0
    0,                           // numSlots = 0
    1,                            // numIkConstraints = 1
      ...name('ik0'),            // name
      0,                           // order
      1,                            // skinRequired
      1,                             // bone count
      0,                              // bone index
      0,                               // target bone index
      0,0,0,0,                         // mix
      0,0,0,0,                         // softness
      0,                               // bendDirection
      1,                               // compress
      0,                                // stretch
      0,                                 // uniform
    1,                              // numTransformConstraints = 1
      ...name('tc0'),             // name
      0,                            // order
      0,                             // skinRequired
      0,                              // bone count
      0,                               // target bone index
      1,                               // local
      0,                                // relative
      0,0,0,0, 0,0,0,0, 0,0,0,0, // offsetRotation, offsetX, offsetY
      0,0,0,0, 0,0,0,0,           // offsetScaleX, offsetScaleY
      0,0,0,0, 0,0,0,0,            // offsetShearY, rotateMix
      0,0,0,0, 0,0,0,0,             // translateMix, scaleMix
      0,0,0,0,                       // shearMix
    1,                               // numPathConstraints = 1
      ...name('pc0'),              // name
      0,                             // order
      1,                              // skinRequired
      1,                               // bone count
      0,                                // bone index
      0,                                 // target slot index
      0,                                  // positionMode
      0,                                   // spacingMode
      0,                                    // rotateMode
      0,0,0,0, 0,0,0,0, 0,0,0,0, // offsetRotation, position, spacing
      0,0,0,0, 0,0,0,0,            // rotateMix, translateMix
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints38(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('readSkeleton38: Mesh attachment extracts uvs and triangles (3.8 field order)', () => {
  // 3.8 Mesh field order: path, color, vertexCount, uvs (BEFORE vertices),
  // triangles (self-describing readShort array), vertices, hullLength.
  // No per-attachment flag byte anywhere.
  const bytes = u8(
    // --- header (walkHeaderAndConstraints38) ---
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // x, y, width, height (4 floats)
    0, // nonessential
    1, // numStrings
    ...name('tri'), // strings[0] = "tri"
    0, // numBones
    0, // numSlots
    0, // IK constraint count
    0, // transform constraint count
    0, // path constraint count
    // --- default skin (readSkin38) ---
    1, // slotCount
    0, // slotIndex
    1, // attachmentCount
    1, // attachmentName ref -> "tri"
    1, // name ref (readAttachment38) -> "tri"
    2, // typeIndex = Mesh
    1, // path ref -> "tri"
    0, 0, 0, 0, // color (unconditional)
    3, // vertexCount
    // uvs: 6 floats = [0, 1, 0, 1, 1, 0]
    0, 0, 0, 0, // 0
    63, 128, 0, 0, // 1
    0, 0, 0, 0, // 0
    63, 128, 0, 0, // 1
    63, 128, 0, 0, // 1
    0, 0, 0, 0, // 0
    3, // triangleCount
    0, 0, 0, 1, 0, 2, // triangles: 3 shorts [0, 1, 2]
    0, // weighted (readVertices38)
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 6 vertex floats
    3, // hullLength
    // --- end ---
    0, // otherSkinCount
  );

  const r = new BinaryReader(bytes);
  const result = readSkeleton38(r);
  assert.equal(result.size, 1);
  const info = result.get('tri');
  assert.deepEqual(info, {
    type: 'Mesh',
    path: 'tri',
    uvs: [0, 1, 0, 1, 1, 0],
    triangles: [0, 1, 2],
  });
  assert.equal(r.position, bytes.length);
});

// Region attachment sharing path "tri". Each attachment block begins with
// the attachmentName ref read by readSkin38, then readAttachment38's own
// name ref, typeIndex, and type-specific fields.
const regionTri = u8(
  1, // attachmentName ref (readSkin38) -> "tri"
  1, // name ref (readAttachment38) -> "tri"
  0, // typeIndex = Region
  1, // path ref -> "tri"
  0, 0, 0, 0, // rotation
  0, 0, 0, 0, // x
  0, 0, 0, 0, // y
  0, 0, 0, 0, // scaleX
  0, 0, 0, 0, // scaleY
  0, 0, 0, 0, // width
  0, 0, 0, 0, // height
  0, 0, 0, 0, // color
);

// Mesh attachment sharing path "tri".
const meshTri = u8(
  1, // attachmentName ref (readSkin38) -> "tri"
  1, // name ref (readAttachment38) -> "tri"
  2, // typeIndex = Mesh
  1, // path ref -> "tri"
  0, 0, 0, 0, // color
  1, // vertexCount
  0, 0, 0, 0, 0, 0, 0, 0, // uvs: vertexCount * 2 = 2 floats
  0, // triangleCount
  0, // weighted
  0, 0, 0, 0, 0, 0, 0, 0, // vertices: 2 floats
  0, // hullLength
);

// Assemble a full 3.8 skeleton with a single slot holding the given
// attachments (in wire order), all sharing path "tri".
function skeletonWithTriAttachments(...attachments) {
  const header = [
    // --- header ---
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 4 floats
    0, // nonessential
    1, // numStrings
    ...name('tri'), // strings[0] = "tri"
    0, // numBones
    0, // numSlots
    0, 0, 0, // IK/transform/path constraint counts
    // --- default skin: 1 slot, N attachments ---
    1, // slotCount
    0, // slotIndex
    attachments.length, // attachmentCount
  ];
  const body = attachments.flat().flatMap(a => (a instanceof Uint8Array ? [...a] : a));
  return u8(...header, ...body, 0); // 0 = otherSkinCount
}

test('readSkeleton38: Mesh wins a path collision regardless of wire order', () => {
  // Region first, Mesh second.
  let result = readSkeleton38(new BinaryReader(skeletonWithTriAttachments(regionTri, meshTri)));
  assert.equal(result.size, 1);
  assert.equal(result.get('tri').type, 'Mesh');

  // Mesh first, Region second — Mesh must still win (not last-write-wins).
  result = readSkeleton38(new BinaryReader(skeletonWithTriAttachments(meshTri, regionTri)));
  assert.equal(result.size, 1);
  assert.equal(result.get('tri').type, 'Mesh');
  assert.ok('uvs' in result.get('tri') && 'triangles' in result.get('tri'));
});

test('readSkeleton38: LinkedMesh attachment (no uvs/triangles keys)', () => {
  const bytes = u8(
    // --- header ---
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 4 floats
    0, // nonessential
    1, // numStrings
    ...name('lm'), // strings[0] = "lm"
    0, // numBones
    0, // numSlots
    0, 0, 0, // IK/transform/path constraint counts
    // --- default skin ---
    1, // slotCount
    0, // slotIndex
    1, // attachmentCount
    1, // attachmentName ref -> "lm"
    1, // name ref -> "lm"
    3, // typeIndex = LinkedMesh
    1, // path ref -> "lm"
    0, 0, 0, 0, // color
    0, // skinName ref (null)
    0, // parent ref (null)
    0, // inheritDeform
    // --- end ---
    0, // otherSkinCount
  );

  const r = new BinaryReader(bytes);
  const result = readSkeleton38(r);
  const info = result.get('lm');
  assert.deepEqual(info, { type: 'LinkedMesh', path: 'lm' });
  assert.equal('uvs' in info, false);
  assert.equal('triangles' in info, false);
  assert.equal(r.position, bytes.length);
});
