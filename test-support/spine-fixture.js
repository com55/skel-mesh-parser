// test-support/spine-fixture.js
// Download-on-demand access to the official Spine 3.8 "goblins" example
// skeleton used by the integration test (integration/goblins-38.integration.js).
//
// The asset is NOT distributed by this repository. It belongs to Esoteric
// Software and stays under its original terms (see THIRD_PARTY_NOTICES.md).
//
// Resolution order (first match wins):
//   1. $SPINE_GOBLINS_SKEL  -> user-provided file; SHA-256 verified, never downloaded.
//   2. .cache/spine/goblins-pro.skel -> reused if its SHA-256 matches; a cached
//      file with a different checksum is deleted and re-downloaded.
//   3. Download GOBLINS_SKEL_URL (pinned commit, not a moving ref); SHA-256
//      verified before it is written to the cache.
//
// A checksum mismatch ALWAYS throws ChecksumMismatchError. An unreachable
// fixture (offline, HTTP error) resolves to { status: 'unavailable' } so the
// integration test can skip with a clear message — unless
// SPINE_FIXTURE_REQUIRED=1 is set (CI), in which case it throws instead.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Official Esoteric Software repository, pinned to an immutable commit
// (the 3.8 reference commit also cited in the README).
export const GOBLINS_SKEL_URL =
  'https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/' +
  '8b4844bd4b193ba9e54487ed397a777993cbad56/examples/goblins/export/goblins-pro.skel';
export const GOBLINS_SKEL_SHA256 =
  '7941a9cf45cd9966d6a403efc8808e7a990ec37b5ec8fdd96bb3b2c67d1b7eb1';
export const GOBLINS_SKEL_ENV = 'SPINE_GOBLINS_SKEL';
export const FIXTURE_REQUIRED_ENV = 'SPINE_FIXTURE_REQUIRED';
export const DEFAULT_CACHE_PATH = new URL('../.cache/spine/goblins-pro.skel', import.meta.url);

export class ChecksumMismatchError extends Error {
  constructor(label, expected, actual) {
    super(`SHA-256 mismatch for ${label}: expected ${expected}, got ${actual}`);
    this.name = 'ChecksumMismatchError';
  }
}

export class FixtureMissingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FixtureMissingError';
  }
}

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { error: `HTTP ${res.status} ${res.statusText}`.trim() };
    return { bytes: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    return { error: e?.cause?.code ?? e?.message ?? String(e) };
  }
}

/**
 * @returns {Promise<{status:'ok', bytes:Uint8Array, source:'env'|'cache'|'download', path:string}
 *                 |{status:'unavailable', reason:string}>}
 * @throws {ChecksumMismatchError} on any checksum mismatch (env file, or a fresh download)
 * @throws {FixtureMissingError} if $SPINE_GOBLINS_SKEL points at a missing file, or the
 *         fixture is unavailable while SPINE_FIXTURE_REQUIRED=1
 */
export async function resolveGoblinsSkel({
  env = process.env,
  cachePath = DEFAULT_CACHE_PATH,
  url = GOBLINS_SKEL_URL,
  sha256 = GOBLINS_SKEL_SHA256,
  fetchImpl = globalThis.fetch,
} = {}) {
  const cacheFile = cachePath instanceof URL ? fileURLToPath(cachePath) : cachePath;

  const override = env[GOBLINS_SKEL_ENV];
  if (override) {
    if (!existsSync(override)) {
      throw new FixtureMissingError(`${GOBLINS_SKEL_ENV}=${override} does not exist`);
    }
    const bytes = readFileSync(override);
    const actual = sha256Hex(bytes);
    if (actual !== sha256) throw new ChecksumMismatchError(override, sha256, actual);
    return { status: 'ok', bytes: new Uint8Array(bytes), source: 'env', path: override };
  }

  if (existsSync(cacheFile)) {
    const bytes = readFileSync(cacheFile);
    if (sha256Hex(bytes) === sha256) {
      return { status: 'ok', bytes: new Uint8Array(bytes), source: 'cache', path: cacheFile };
    }
    rmSync(cacheFile); // corrupt/stale cache entry: discard and re-download
  }

  const got = await download(url, fetchImpl);
  if (got.error) {
    const reason =
      `official Spine fixture unavailable (${got.error} fetching ${url}). ` +
      `Set ${GOBLINS_SKEL_ENV}=/path/to/goblins-pro.skel to supply it manually.`;
    if (env[FIXTURE_REQUIRED_ENV] === '1') throw new FixtureMissingError(reason);
    return { status: 'unavailable', reason };
  }
  const actual = sha256Hex(got.bytes);
  if (actual !== sha256) throw new ChecksumMismatchError(url, sha256, actual);

  mkdirSync(dirname(cacheFile), { recursive: true });
  const tmp = `${cacheFile}.${process.pid}.tmp`;
  writeFileSync(tmp, got.bytes);
  renameSync(tmp, cacheFile);
  return { status: 'ok', bytes: got.bytes, source: 'download', path: cacheFile };
}
