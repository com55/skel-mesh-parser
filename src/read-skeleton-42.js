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

  return { strings, nonessential };
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

// Attachment type order matches the flag low-3-bits encoding in
// SkeletonBinary.readAttachment (4.2): 0=Region, 1=BoundingBox, 2=Mesh,
// 3=LinkedMesh, 4=Path, 5=Point, 6=Clipping.
const ATTACHMENT_TYPES = ['Region', 'BoundingBox', 'Mesh', 'LinkedMesh', 'Path', 'Point', 'Clipping'];

/** Reads a 4.2.x skeleton from the position left by the version-string read,
 *  returning the default skin's attachments as a Map keyed by resolved path
 *  (atlas region name when the wire carries a path, otherwise the
 *  attachment's own name). Other skins are walked but discarded. */
export function readSkeleton42(r) {
  const { strings, nonessential } = walkHeaderAndConstraints42(r);
  const result = new Map();
  readSkin42(r, strings, nonessential, result);
  const otherSkinCount = r.readVarint(true);
  for (let i = 0; i < otherSkinCount; i++) {
    r.readString(); // skin name
    if (nonessential) r.readInt32(); // skin color (4.2 only)
    skipSkinBoneAndConstraintRefs42(r);
    readSkin42(r, strings, nonessential, null); // null = discard attachments
  }
  return result;
}

function readSkin42(r, strings, nonessential, outMap) {
  const slotCount = r.readVarint(true);
  for (let i = 0; i < slotCount; i++) {
    r.readVarint(true); // slotIndex, unused
    const attachmentCount = r.readVarint(true);
    for (let ii = 0; ii < attachmentCount; ii++) {
      const attachmentName = r.readStringRef(strings);
      const info = readAttachment42(r, strings, attachmentName, nonessential);
      if (outMap && info) {
        const existing = outMap.get(info.path);
        // Deterministic tie-break on path collision: a Mesh conveys more
        // (uvs/triangles) than a Region, so it wins regardless of wire order.
        if (!existing || info.type === 'Mesh' || existing.type !== 'Mesh') {
          outMap.set(info.path, info);
        }
      }
    }
  }
}

function readAttachment42(r, strings, attachmentName, nonessential) {
  const flags = r.readUByte();
  const name = (flags & 8) ? r.readStringRef(strings) : attachmentName;
  const type = ATTACHMENT_TYPES[flags & 0b111];
  switch (type) {
    case 'Region': {
      const path = (flags & 16) ? r.readStringRef(strings) : null;
      if (flags & 32) r.readInt32();
      if (flags & 64) skipSequence42(r);
      if (flags & 128) r.readFloat();
      r.readFloat(); r.readFloat(); r.readFloat(); r.readFloat(); r.readFloat(); r.readFloat();
      return { type: 'Region', path: path ?? name };
    }
    case 'BoundingBox': {
      readVertices42(r, !!(flags & 16));
      if (nonessential) r.readInt32();
      return { type: 'BoundingBox', path: name };
    }
    case 'Mesh': {
      const path = (flags & 16) ? r.readStringRef(strings) : name;
      if (flags & 32) r.readInt32();
      if (flags & 64) skipSequence42(r);
      const hullLength = r.readVarint(true);
      const { floatCount } = readVertices42(r, !!(flags & 128));
      const uvs = readFloatArray42(r, floatCount);
      const triangleCount = (floatCount - hullLength - 2) * 3;
      const triangles = [];
      for (let i = 0; i < triangleCount; i++) triangles.push(r.readVarint(true));
      if (nonessential) {
        const edgeCount = r.readVarint(true);
        for (let i = 0; i < edgeCount; i++) r.readVarint(true);
        r.readFloat(); r.readFloat();
      }
      return { type: 'Mesh', path: path ?? name, uvs, triangles };
    }
    case 'LinkedMesh': {
      const path = (flags & 16) ? r.readStringRef(strings) : name;
      if (flags & 32) r.readInt32();
      if (flags & 64) skipSequence42(r);
      r.readVarint(true); // skinIndex
      r.readStringRef(strings); // parent
      if (nonessential) { r.readFloat(); r.readFloat(); }
      return { type: 'LinkedMesh', path: path ?? name };
    }
    case 'Path': {
      const { floatCount } = readVertices42(r, !!(flags & 64));
      const lengthCount = Math.floor(floatCount / 6);
      for (let i = 0; i < lengthCount; i++) r.readFloat();
      if (nonessential) r.readInt32();
      return { type: 'Path', path: name };
    }
    case 'Point': {
      r.readFloat(); r.readFloat(); r.readFloat();
      if (nonessential) r.readInt32();
      return { type: 'Point', path: name };
    }
    case 'Clipping': {
      r.readVarint(true); // endSlotIndex
      readVertices42(r, !!(flags & 16));
      if (nonessential) r.readInt32();
      return { type: 'Clipping', path: name };
    }
    default:
      throw new Error(`Unknown attachment type flag: ${flags & 0b111}`);
  }
}

function readVertices42(r, weighted) {
  const vertexCount = r.readVarint(true);
  const floatCount = vertexCount * 2;
  if (!weighted) {
    for (let i = 0; i < floatCount; i++) r.readFloat();
    return { floatCount };
  }
  for (let i = 0; i < vertexCount; i++) {
    const boneCount = r.readVarint(true);
    for (let ii = 0; ii < boneCount; ii++) {
      r.readVarint(true); // boneIndex
      r.readFloat(); r.readFloat(); r.readFloat(); // weightX, weightY, weightValue
    }
  }
  return { floatCount };
}

function readFloatArray42(r, n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = r.readFloat();
  return arr;
}

function skipSequence42(r) {
  r.readVarint(true); r.readVarint(true); r.readVarint(true); r.readVarint(true); // count, start, digits, setupIndex
}

function skipSkinBoneAndConstraintRefs42(r) {
  const boneCount = r.readVarint(true);
  for (let i = 0; i < boneCount; i++) r.readVarint(true); // bone index
  const ikCount = r.readVarint(true);
  for (let i = 0; i < ikCount; i++) r.readVarint(true); // IK constraint index
  const transformCount = r.readVarint(true);
  for (let i = 0; i < transformCount; i++) r.readVarint(true); // transform constraint index
  const pathCount = r.readVarint(true);
  for (let i = 0; i < pathCount; i++) r.readVarint(true); // path constraint index
  const physicsCount = r.readVarint(true);
  for (let i = 0; i < physicsCount; i++) r.readVarint(true); // physics constraint index
}
