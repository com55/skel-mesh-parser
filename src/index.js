// src/index.js
import { BinaryReader } from './binary-reader.js';
import { detectVersion, UnsupportedVersionError } from './detect-version.js';
import { readSkeleton42 } from './read-skeleton-42.js';
import { readSkeleton38 } from './read-skeleton-38.js';

export { UnsupportedVersionError };

export function parseSkeleton(bytes) {
  const version = detectVersion(bytes);
  // Once the version is known, the header shape is no longer ambiguous —
  // redo exactly the right skip (not a "replay" of a single assumed
  // shape, per the bug this task found).
  const r = new BinaryReader(bytes);
  if (version.major === 4 && version.minor === 2) {
    r.readInt32(); r.readInt32(); // 4.2 hash: 2 int32s
  } else {
    r.readString(); // 3.8 hash: a string
  }
  r.readString(); // version string — same position in both shapes: right
                   // after the hash, whatever shape the hash itself took

  const attachments = (version.major === 4 && version.minor === 2)
    ? readSkeleton42(r)
    : readSkeleton38(r);

  return { version, attachments };
}
