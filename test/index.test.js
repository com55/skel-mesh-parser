// test/index.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkeleton, UnsupportedVersionError } from '../src/index.js';

function u8(...bytes) { return new Uint8Array(bytes); }
// Spine's length-prefixed string: byteCount = len + 1.
function name(s) { return [s.length + 1, ...Array.from(s).map(c => c.charCodeAt(0))]; }

// 8-byte hash + version string, as detectVersion expects at the start.
function header(versionStr) {
  return [0, 0, 0, 0, 0, 0, 0, 0, ...name(versionStr)];
}

test('parseSkeleton dispatches to the 4.2 reader for a 4.2.x file', () => {
  const bytes = u8(
    ...header('4.2.0'),
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x, y, width, height
    0,0,0,0,                 // referenceScale
    0,                        // nonessential = false
    0,                         // numStrings = 0
    0,                          // numBones = 0
    0,                           // numSlots = 0
    0, 0, 0, 0,               // 4 constraint counts = 0
    0,                           // default skin slotCount = 0
    0,                           // otherSkinCount = 0
  );
  const result = parseSkeleton(bytes);
  assert.equal(result.version.major, 4);
  assert.equal(result.attachments.size, 0);
});

test('parseSkeleton dispatches to the 3.8 reader for a 3.8.x file', () => {
  // 3.8 header shape: hash is a string (not 2 int32s), then the version string.
  const bytes = u8(
    ...name('abc'),
    ...name('3.8.0'),
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, // x, y, width, height
    0,                        // nonessential = false
    0,                         // numStrings = 0
    0,                          // numBones = 0
    0,                           // numSlots = 0
    0, 0, 0,               // 3 constraint counts = 0 (no physics in 3.8)
    0,                           // default skin slotCount = 0
    0,                           // otherSkinCount = 0
  );
  const result = parseSkeleton(bytes);
  assert.equal(result.version.major, 3);
  assert.equal(result.version.minor, 8);
  assert.equal(result.attachments.size, 0);
});

test('parseSkeleton throws UnsupportedVersionError for e.g. 4.1.x', () => {
  const bytes = u8(...header('4.1.0'));
  assert.throws(() => parseSkeleton(bytes), UnsupportedVersionError);
});
