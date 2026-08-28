// test/read-skeleton-42.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinaryReader } from '../src/binary-reader.js';
import { walkHeaderAndConstraints42, readSkeleton42 } from '../src/read-skeleton-42.js';

function u8(...bytes) { return new Uint8Array(bytes); }
const name = (s) => [s.length + 1, ...Array.from(s).map(c => c.charCodeAt(0))];

// Shared header prefix for the attachment tests: 5 zero floats (x, y, width,
// height, referenceScale), nonessential = false, then the string table.
function header(numStrings, ...strings) {
  const out = [
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x, y, width, height
    0,0,0,0,                 // referenceScale
    0,                        // nonessential = false
    numStrings,
    ...strings.flatMap(s => name(s)),
    0,                        // numBones = 0
    0,                        // numSlots = 0
    0, 0, 0, 0,               // 4 constraint counts = 0
  ];
  return out;
}

test('walks a minimal skeleton (no bones/slots/constraints/strings) to the skins boundary', () => {
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height = 0.0 each (4 floats)
    0,0,0,0,                 // referenceScale = 0.0
    0,                        // nonessential = false
    0,                         // numStrings = 0
    0,                          // numBones = 0
    0,                           // numSlots = 0
    0,                            // numIkConstraints = 0
    0,                             // numTransformConstraints = 0
    0,                              // numPathConstraints = 0
    0,                               // numPhysicsConstraints = 0
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints42(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('walks one bone and one slot correctly (nonessential = false)', () => {
  const name = (s) => u8(s.length + 1, ...Array.from(s).map(c => c.charCodeAt(0)));
  const bytes = u8(
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x,y,width,height (4 floats)
    0,0,0,0,                // referenceScale
    0,                        // nonessential = false
    0,                         // numStrings = 0
    1,                          // numBones = 1
      ...name('root'),           // bone[0].name
      // no parent index for bone 0
      0,0,0,0, 0,0,0,0, 0,0,0,0, // rotation, x, y
      0,0,0,0, 0,0,0,0,           // scaleX, scaleY
      0,0,0,0, 0,0,0,0,            // shearX, shearY
      0,0,0,0,                      // length
      0,                              // inherit
      0,                               // skinRequired
    1,                          // numSlots = 1
      ...name('slot0'),           // slot[0].name
      0,                            // boneIndex = 0
      0,0,0,0,                       // color
      0,0,0,0,                        // darkColor
      0,                                // attachmentName ref = 0 (null)
      0,                                 // blendMode
    0,0,0,0,                    // 4 constraint-count varints, all 0
  );
  const r = new BinaryReader(bytes);
  const { strings } = walkHeaderAndConstraints42(r);
  assert.deepEqual(strings, []);
  assert.equal(r.position, bytes.length);
});

test('readSkeleton42 extracts uvs/triangles for a Mesh attachment', () => {
  // Default skin: 1 slot, 1 attachment. The attachment name comes from the
  // string table (ref 1 → "tri"); flags = 2 (type Mesh, no optional bits:
  // no inline name, no path override, no color, no sequence, unweighted).
  // hullLength = 3, vertexCount = 3 → floatCount = 6 → 1 triangle
  // ((6 - 3 - 2) * 3 = 3 indices). nonessential = false, so no
  // edges/width/height tail.
  const bytes = u8(
    ...header(1, 'tri'),
    1,                                 // default skin slotCount = 1
      0,                                 // slotIndex = 0
      1,                                   // attachmentCount = 1
        1,                                   // attachmentName ref = 1 → "tri"
        2,                                   // flags: type = 2 (Mesh), no optional bits
        3,                                   // hullLength = 3
        3,                                   // vertexCount = 3 (unweighted)
        0,0,0,0, 0,0,0,0, 0,0,0,0,           //   6 vertex floats, discarded
        0,0,0,0, 0,0,0,0, 0,0,0,0,           //   (continued)
        0,0,0,0, 63,128,0,0,                 // uvs: 0.0, 1.0
        0,0,0,0, 63,128,0,0,                 //   0.0, 1.0
        63,128,0,0, 0,0,0,0,                 //   1.0, 0.0
        0, 1, 2,                             // triangles: [0, 1, 2]
    0,                                   // otherSkinCount = 0
  );
  const r = new BinaryReader(bytes);
  const result = readSkeleton42(r);
  assert.equal(result.size, 1);
  assert.deepEqual(result.get('tri'), {
    type: 'Mesh',
    path: 'tri',
    uvs: [0, 1, 0, 1, 1, 0],
    triangles: [0, 1, 2],
  });
  assert.equal(r.position, bytes.length);
});

test('a LinkedMesh attachment is reported as type LinkedMesh, not Mesh, with no uvs/triangles', () => {
  // flags = 3 (type LinkedMesh, no optional bits: no inline name, no path
  // override, no color, no sequence, no inheritTimelines). skinIndex = 0,
  // parent = null (ref 0). nonessential = false, so no width/height tail.
  const bytes = u8(
    ...header(1, 'lm'),
    1,                                 // default skin slotCount = 1
      0,                                 // slotIndex = 0
      1,                                   // attachmentCount = 1
        1,                                   // attachmentName ref = 1 → "lm"
        3,                                   // flags: type = 3 (LinkedMesh), no optional bits
        0,                                   // skinIndex = 0
        0,                                   // parent ref = 0 → null
    0,                                   // otherSkinCount = 0
  );
  const r = new BinaryReader(bytes);
  const result = readSkeleton42(r);
  assert.equal(result.size, 1);
  const info = result.get('lm');
  assert.deepEqual(info, { type: 'LinkedMesh', path: 'lm' });
  assert.equal('uvs' in info, false);
  assert.equal('triangles' in info, false);
  assert.equal(r.position, bytes.length);
});
