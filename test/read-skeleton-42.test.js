// test/read-skeleton-42.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinaryReader } from '../src/binary-reader.js';
import { walkHeaderAndConstraints42 } from '../src/read-skeleton-42.js';

function u8(...bytes) { return new Uint8Array(bytes); }

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
