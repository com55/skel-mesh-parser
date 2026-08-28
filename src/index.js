// src/index.js
import { BinaryReader } from './binary-reader.js';
import { detectVersion, UnsupportedVersionError } from './detect-version.js';
import { readSkeleton42 } from './read-skeleton-42.js';
import { readSkeleton38 } from './read-skeleton-38.js';

export { UnsupportedVersionError };

export function parseSkeleton(bytes, { nonessential = true } = {}) {
  const version = detectVersion(bytes);
  // detectVersion consumed the header from its own fresh reader; start a
  // second reader at the same point for the real walk (cheaper and less
  // error-prone than trying to share position state across two modules).
  const r = new BinaryReader(bytes);
  r.readInt32(); r.readInt32(); // hash
  r.readString(); // version string, already parsed by detectVersion

  const attachments = (version.major === 4 && version.minor === 2)
    ? readSkeleton42(r, nonessential)
    : readSkeleton38(r, nonessential);

  return { version, attachments };
}
