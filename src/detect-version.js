// src/detect-version.js
import { BinaryReader } from './binary-reader.js';

export class UnsupportedVersionError extends Error {
  constructor(raw) {
    super(`Unsupported Spine skeleton version: ${raw}`);
    this.name = 'UnsupportedVersionError';
    this.version = raw;
  }
}

/** Reads just the header (hash + version string) and classifies the
 *  version. Does not consume anything beyond the version string, so the
 *  caller can hand the same bytes to the matching version-specific walker
 *  starting from a fresh reader. */
export function detectVersion(bytes) {
  const r = new BinaryReader(bytes);
  r.readInt32(); r.readInt32(); // 8-byte hash, unused
  const raw = r.readString();
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(raw ?? '');
  if (!m) throw new UnsupportedVersionError(raw);
  const major = Number(m[1]), minor = Number(m[2]), patch = Number(m[3]);
  if (!((major === 4 && minor === 2) || (major === 3 && minor === 8))) {
    throw new UnsupportedVersionError(raw);
  }
  return { major, minor, patch, raw };
}
