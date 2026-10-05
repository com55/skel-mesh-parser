// test/spine-fixture.test.js
// Offline tests for test-support/spine-fixture.js. No network: every download
// goes through an injected fetch stub, and every cache lives in a temp dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ChecksumMismatchError, FixtureMissingError, resolveGoblinsSkel, sha256Hex,
} from '../test-support/spine-fixture.js';

const GOOD = new Uint8Array([1, 2, 3, 4]);
const SHA = sha256Hex(GOOD);

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'spine-fixture-'));
  const calls = [];
  const okFetch = (bytes = GOOD) => async (url) => {
    calls.push(url);
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  return { dir, cachePath: join(dir, 'sub', 'f.skel'), calls, okFetch, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('download + checksum match -> ok, written to cache', async () => {
  const t = setup();
  try {
    const r = await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch() });
    assert.equal(r.status, 'ok');
    assert.equal(r.source, 'download');
    assert.deepEqual(readFileSync(t.cachePath), Buffer.from(GOOD));
  } finally { t.done(); }
});

test('cache exists + checksum matches -> reused without any network call', async () => {
  const t = setup();
  try {
    await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch() });
    t.calls.length = 0;
    const r = await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch() });
    assert.equal(r.source, 'cache');
    assert.equal(t.calls.length, 0);
  } finally { t.done(); }
});

test('cache exists + checksum differs -> discarded and re-downloaded', async () => {
  const t = setup();
  try {
    await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch() });
    writeFileSync(t.cachePath, 'corrupted');
    const r = await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch() });
    assert.equal(r.source, 'download');
    assert.deepEqual(readFileSync(t.cachePath), Buffer.from(GOOD));
  } finally { t.done(); }
});

test('download succeeds + checksum differs -> throws and does not populate the cache', async () => {
  const t = setup();
  try {
    await assert.rejects(
      resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: t.okFetch(new Uint8Array([9])) }),
      ChecksumMismatchError,
    );
    assert.equal(existsSync(t.cachePath), false);
  } finally { t.done(); }
});

test('network failure -> unavailable (skip), or FixtureMissingError when SPINE_FIXTURE_REQUIRED=1', async () => {
  const t = setup();
  try {
    const failing = async () => { throw new Error('offline'); };
    const r = await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: failing });
    assert.equal(r.status, 'unavailable');
    assert.match(r.reason, /SPINE_GOBLINS_SKEL/);
    await assert.rejects(
      resolveGoblinsSkel({ env: { SPINE_FIXTURE_REQUIRED: '1' }, cachePath: t.cachePath, sha256: SHA, fetchImpl: failing }),
      FixtureMissingError,
    );
    const http404 = async () => ({ ok: false, status: 404, statusText: 'Not Found' });
    assert.equal((await resolveGoblinsSkel({ env: {}, cachePath: t.cachePath, sha256: SHA, fetchImpl: http404 })).status, 'unavailable');
  } finally { t.done(); }
});

test('SPINE_GOBLINS_SKEL: valid file is used (no download); wrong checksum / missing file fail', async () => {
  const t = setup();
  try {
    const noFetch = async () => { throw new Error('must not download'); };
    const good = join(t.dir, 'mine.skel');
    writeFileSync(good, GOOD);
    const r = await resolveGoblinsSkel({ env: { SPINE_GOBLINS_SKEL: good }, cachePath: t.cachePath, sha256: SHA, fetchImpl: noFetch });
    assert.equal(r.source, 'env');

    const bad = join(t.dir, 'bad.skel');
    writeFileSync(bad, 'nope');
    await assert.rejects(
      resolveGoblinsSkel({ env: { SPINE_GOBLINS_SKEL: bad }, cachePath: t.cachePath, sha256: SHA, fetchImpl: noFetch }),
      ChecksumMismatchError,
    );
    await assert.rejects(
      resolveGoblinsSkel({ env: { SPINE_GOBLINS_SKEL: join(t.dir, 'missing') }, cachePath: t.cachePath, sha256: SHA, fetchImpl: noFetch }),
      FixtureMissingError,
    );
  } finally { t.done(); }
});
