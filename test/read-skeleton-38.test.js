// test/read-skeleton-38.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinaryReader } from '../src/binary-reader.js';
import { walkHeaderAndConstraints38 } from '../src/read-skeleton-38.js';

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
