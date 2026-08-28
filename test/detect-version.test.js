import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectVersion, UnsupportedVersionError } from '../src/detect-version.js';

function bytesForVersion(versionStr) {
  const body = Array.from(versionStr).map(c => c.charCodeAt(0));
  return new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0,              // 8-byte hash, ignored
    body.length + 1,                      // varint byteCount (single-byte since short)
    ...body,
  ]);
}

test('detects 4.2.x as supported', () => {
  const v = detectVersion(bytesForVersion('4.2.33'));
  assert.deepEqual(v, { major: 4, minor: 2, patch: 33, raw: '4.2.33' });
});

test('detects 3.8.x as supported', () => {
  const v = detectVersion(bytesForVersion('3.8.99'));
  assert.deepEqual(v, { major: 3, minor: 8, patch: 99, raw: '3.8.99' });
});

test('throws UnsupportedVersionError for other versions', () => {
  assert.throws(() => detectVersion(bytesForVersion('4.1.0')), UnsupportedVersionError);
  assert.throws(() => detectVersion(bytesForVersion('2.1.27')), UnsupportedVersionError);
});
