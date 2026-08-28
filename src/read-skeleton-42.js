// src/read-skeleton-42.js

/** Walks everything between the version string and the skins section for
 *  a 4.2.x skeleton: skeleton bounds, string table, bones, slots, and all
 *  four constraint kinds (IK/transform/path/physics). Bone/slot/constraint
 *  field values are read (to stay byte-aligned) but not retained — this
 *  library only needs the skins/attachments that follow.
 *  Field order verified against spine-ts/spine-core/src/SkeletonBinary.ts
 *  @ b81e5a5 (see this repo's README Provenance note). */
export function walkHeaderAndConstraints42(r) {
  r.readFloat(); r.readFloat(); r.readFloat(); r.readFloat(); // x, y, width, height
  r.readFloat(); // referenceScale
  const nonessential = r.readBoolean();
  if (nonessential) {
    r.readFloat();  // fps
    r.readString(); // imagesPath
    r.readString(); // audioPath
  }

  const numStrings = r.readVarint(true);
  const strings = [];
  for (let i = 0; i < numStrings; i++) strings.push(r.readString());

  const numBones = r.readVarint(true);
  for (let i = 0; i < numBones; i++) {
    r.readString(); // name
    if (i !== 0) r.readVarint(true); // parent index
    r.readFloat(); r.readFloat(); r.readFloat(); // rotation, x, y
    r.readFloat(); r.readFloat(); // scaleX, scaleY
    r.readFloat(); r.readFloat(); // shearX, shearY
    r.readFloat(); // length
    r.readByte(); // inherit
    r.readBoolean(); // skinRequired
    if (nonessential) {
      r.readInt32(); // color
      r.readString(); // icon
      r.readBoolean(); // visible
    }
  }

  const numSlots = r.readVarint(true);
  for (let i = 0; i < numSlots; i++) {
    r.readString(); // name
    r.readVarint(true); // boneIndex
    r.readInt32(); // color
    r.readInt32(); // darkColor (always present, not nonessential-gated)
    r.readStringRef(strings); // attachmentName
    r.readVarint(true); // blendMode
    if (nonessential) r.readBoolean(); // visible
  }

  skipIkConstraints42(r);
  skipTransformConstraints42(r);
  skipPathConstraints42(r);
  skipPhysicsConstraints42(r);

  return { strings };
}

function skipIkConstraints42(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target bone index
    const flags = r.readUByte();
    if ((flags & 32) !== 0 && (flags & 64) !== 0) r.readFloat(); // mix — only if both bits set
    if ((flags & 128) !== 0) r.readFloat(); // softness
  }
}

function skipTransformConstraints42(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target bone index
    const flags1 = r.readUByte();
    if ((flags1 & 8) !== 0) r.readFloat();
    if ((flags1 & 16) !== 0) r.readFloat();
    if ((flags1 & 32) !== 0) r.readFloat();
    if ((flags1 & 64) !== 0) r.readFloat();
    if ((flags1 & 128) !== 0) r.readFloat();
    const flags2 = r.readUByte();
    if ((flags2 & 1) !== 0) r.readFloat();
    if ((flags2 & 2) !== 0) r.readFloat();
    if ((flags2 & 4) !== 0) r.readFloat();
    if ((flags2 & 8) !== 0) r.readFloat();
    if ((flags2 & 16) !== 0) r.readFloat();
    if ((flags2 & 32) !== 0) r.readFloat();
    if ((flags2 & 64) !== 0) r.readFloat();
  }
}

function skipPathConstraints42(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    r.readBoolean(); // skinRequired
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target slot index
    const flags = r.readUByte();
    if ((flags & 128) !== 0) r.readFloat(); // offsetRotation
    r.readFloat(); // position
    r.readFloat(); // spacing
    r.readFloat(); // mixRotate
    r.readFloat(); // mixX
    r.readFloat(); // mixY
  }
}

function skipPhysicsConstraints42(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    r.readVarint(true); // bone index
    const flags = r.readUByte();
    if ((flags & 2) !== 0) r.readFloat();
    if ((flags & 4) !== 0) r.readFloat();
    if ((flags & 8) !== 0) r.readFloat();
    if ((flags & 16) !== 0) r.readFloat();
    if ((flags & 32) !== 0) r.readFloat();
    if ((flags & 64) !== 0) r.readFloat(); // limit
    r.readUByte(); // step
    r.readFloat(); // inertia
    r.readFloat(); // strength
    r.readFloat(); // damping
    if ((flags & 128) !== 0) r.readFloat(); // massInverse
    r.readFloat(); // wind
    r.readFloat(); // gravity
    const flags2 = r.readUByte();
    if ((flags2 & 128) !== 0) r.readFloat(); // mix
  }
}
