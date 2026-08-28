// src/detect-version.js
import { BinaryReader } from './binary-reader.js';

export class UnsupportedVersionError extends Error {
  constructor(raw) {
    super(`Unsupported Spine skeleton version: ${raw}`);
    this.name = 'UnsupportedVersionError';
    this.version = raw;
  }
}

/** Reads just the header and classifies the version. Two supported
 *  versions have genuinely different header shapes (see this task's
 *  supplement for why), so this tries the 4.2 shape first, then falls
 *  back to the 3.8 shape on a fresh reader if that doesn't parse as a
 *  4.2.x version string. Does not consume anything from the caller's own
 *  reader — always operates on its own fresh, throwaway BinaryReader(s);
 *  the caller (parseSkeleton) re-derives the right header-skip afterward
 *  once it knows which version this returned. */
export function detectVersion(bytes) {
  // Try 4.2's header shape: 8-byte (2×int32) hash, then version string.
  // A buffer too small for this shape (e.g. a short 3.8 file, whose first
  // bytes misread as a 4.2 hash encode a string length past the end of the
  // buffer) throws RangeError here — that's the signal to fall through to
  // the 3.8 shape below, not a real error.
  let raw42;
  try {
    const r42 = new BinaryReader(bytes);
    r42.readInt32(); r42.readInt32();
    raw42 = r42.readString();
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }
  const m42 = /^(\d+)\.(\d+)\.(\d+)/.exec(raw42 ?? '');
  if (m42 && Number(m42[1]) === 4 && Number(m42[2]) === 2) {
    return { major: 4, minor: 2, patch: Number(m42[3]), raw: raw42 };
  }

  // Fall back to 3.8's header shape: hash as a string, then version string.
  const r38 = new BinaryReader(bytes);
  r38.readString(); // hash
  const raw38 = r38.readString();
  const m38 = /^(\d+)\.(\d+)\.(\d+)/.exec(raw38 ?? '');
  if (m38 && Number(m38[1]) === 3 && Number(m38[2]) === 8) {
    return { major: 3, minor: 8, patch: Number(m38[3]), raw: raw38 };
  }

  throw new UnsupportedVersionError(raw42 ?? raw38 ?? null);
}
