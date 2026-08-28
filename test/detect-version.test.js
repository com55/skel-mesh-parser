import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectVersion, UnsupportedVersionError } from '../src/detect-version.js';

// 4.2 header shape: 8-byte (2×int32) hash, then version string.
function bytesForVersion42(versionStr) {
  const body = Array.from(versionStr).map(c => c.charCodeAt(0));
  return new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0,              // 8-byte hash, ignored
    body.length + 1,                      // varint byteCount (single-byte since short)
    ...body,
  ]);
}

// 3.8 header shape: hash is a length-prefixed string, then version string.
function bytesForVersion38(hashStr, versionStr) {
  const enc = s => [s.length + 1, ...Array.from(s).map(c => c.charCodeAt(0))];
  return new Uint8Array([...enc(hashStr), ...enc(versionStr)]);
}

test('detects 4.2.x as supported', () => {
  const v = detectVersion(bytesForVersion42('4.2.33'));
  assert.deepEqual(v, { major: 4, minor: 2, patch: 33, raw: '4.2.33' });
});

test('detects 3.8.x as supported (via the 3.8 header-shape fallback)', () => {
  const v = detectVersion(bytesForVersion38('abc', '3.8.99'));
  assert.deepEqual(v, { major: 3, minor: 8, patch: 99, raw: '3.8.99' });
});

test('throws UnsupportedVersionError for other versions', () => {
  assert.throws(() => detectVersion(bytesForVersion42('4.1.0')), UnsupportedVersionError);
  assert.throws(() => detectVersion(bytesForVersion42('2.1.27')), UnsupportedVersionError);
});

test('throws UnsupportedVersionError when neither header shape yields a supported version', () => {
  // 4.2-shaped header whose version string is 9.9.9: the 4.2 attempt
  // parses the string but rejects the version, and the 3.8 fallback
  // (which reads the 8 zero bytes as a varint-length string) fails too.
  assert.throws(() => detectVersion(bytesForVersion42('9.9.9')), UnsupportedVersionError);
});

test('throws UnsupportedVersionError (not RangeError) on a short adversarial buffer', () => {
  // 9 bytes: the 4.2 trial reads 2 int32s (8 bytes) then a string whose
  // length byte is 0 → null. The 3.8 trial re-reads the same bytes as
  // hash + version; the version string's length varint comes out huge, so
  // readString() would `new Uint8Array(huge)` and throw RangeError. Both
  // trials are RangeError-guarded, so this must surface as
  // UnsupportedVersionError, not escape as a raw RangeError.
  assert.throws(
    () => detectVersion(new Uint8Array([50, 0, 0, 0, 0, 0, 0, 0, 0])),
    UnsupportedVersionError,
  );
});
