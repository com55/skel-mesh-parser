// src/read-skeleton-38.js

/** 3.8.x equivalent of read-skeleton-42.js's walker. Field order verified
 *  against spine-ts/core/src/SkeletonBinary.ts @ 8b4844b (see README
 *  Provenance note) — independently, not assumed identical to 4.2.
 *  3.8 has no per-record flag byte anywhere: every field is read
 *  unconditionally except where marked nonessential-gated. */
export function walkHeaderAndConstraints38(r) {
  r.readFloat(); r.readFloat(); r.readFloat(); r.readFloat(); // x, y, width, height
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
    r.readVarint(true); // transformMode (3.8: a varint enum index, not a raw byte)
    r.readBoolean(); // skinRequired
    if (nonessential) r.readInt32(); // color — 3.8 has no icon/visible fields
  }

  const numSlots = r.readVarint(true);
  for (let i = 0; i < numSlots; i++) {
    r.readString(); // name
    r.readVarint(true); // boneIndex
    r.readInt32(); // color
    r.readInt32(); // darkColor (always present, not nonessential-gated)
    r.readStringRef(strings); // attachmentName
    r.readVarint(true); // blendMode
  }

  skipIkConstraints38(r);
  skipTransformConstraints38(r);
  skipPathConstraints38(r);
  // No physics constraints in 3.8 — that kind is a 4.2-only addition.

  return { strings };
}

function skipIkConstraints38(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    r.readBoolean(); // skinRequired (a standalone boolean in 3.8, unlike 4.2's flag byte)
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target bone index
    r.readFloat(); // mix (unconditional)
    r.readFloat(); // softness (unconditional)
    r.readByte(); // bendDirection
    r.readBoolean(); // compress
    r.readBoolean(); // stretch
    r.readBoolean(); // uniform
  }
}

function skipTransformConstraints38(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    r.readBoolean(); // skinRequired
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target bone index
    r.readBoolean(); // local
    r.readBoolean(); // relative
    // 10 unconditional floats:
    r.readFloat(); // offsetRotation
    r.readFloat(); // offsetX
    r.readFloat(); // offsetY
    r.readFloat(); // offsetScaleX
    r.readFloat(); // offsetScaleY
    r.readFloat(); // offsetShearY
    r.readFloat(); // rotateMix
    r.readFloat(); // translateMix
    r.readFloat(); // scaleMix
    r.readFloat(); // shearMix
  }
}

function skipPathConstraints38(r) {
  const n = r.readVarint(true);
  for (let i = 0; i < n; i++) {
    r.readString(); // name
    r.readVarint(true); // order
    r.readBoolean(); // skinRequired
    const nn = r.readVarint(true);
    for (let j = 0; j < nn; j++) r.readVarint(true); // bone index
    r.readVarint(true); // target slot index
    r.readVarint(true); // positionMode (enum index)
    r.readVarint(true); // spacingMode (enum index)
    r.readVarint(true); // rotateMode (enum index)
    r.readFloat(); // offsetRotation
    r.readFloat(); // position
    r.readFloat(); // spacing
    r.readFloat(); // rotateMix
    r.readFloat(); // translateMix
  }
}

const ATTACHMENT_TYPES = ['Region', 'BoundingBox', 'Mesh', 'LinkedMesh', 'Path', 'Point', 'Clipping'];

export function readSkeleton38(r, nonessential) {
  const { strings } = walkHeaderAndConstraints38(r);
  const result = new Map();
  readSkin38(r, strings, nonessential, result);
  const otherSkinCount = r.readVarint(true);
  for (let i = 0; i < otherSkinCount; i++) {
    r.readStringRef(strings); // skin name (a table-index ref in 3.8, not an inline string)
    skipSkinBoneAndConstraintRefs38(r);
    readSkin38(r, strings, nonessential, null);
  }
  return result;
}

function readSkin38(r, strings, nonessential, outMap) {
  const slotCount = r.readVarint(true);
  for (let i = 0; i < slotCount; i++) {
    r.readVarint(true); // slotIndex
    const attachmentCount = r.readVarint(true);
    for (let ii = 0; ii < attachmentCount; ii++) {
      const attachmentName = r.readStringRef(strings);
      const info = readAttachment38(r, strings, attachmentName, nonessential);
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

function readAttachment38(r, strings, attachmentName, nonessential) {
  const name = r.readStringRef(strings) ?? attachmentName;
  const typeIndex = r.readUByte();
  const type = ATTACHMENT_TYPES[typeIndex];

  switch (type) {
    case 'Region': {
      const path = r.readStringRef(strings);
      r.readFloat(); // rotation
      r.readFloat(); // x
      r.readFloat(); // y
      r.readFloat(); // scaleX
      r.readFloat(); // scaleY
      r.readFloat(); // width
      r.readFloat(); // height
      r.readInt32(); // color, unconditional
      return { type: 'Region', path: path ?? name };
    }
    case 'BoundingBox': {
      const vertexCount = r.readVarint(true);
      readVertices38(r, vertexCount);
      if (nonessential) r.readInt32();
      return { type: 'BoundingBox', path: name };
    }
    case 'Mesh': {
      const path = r.readStringRef(strings);
      r.readInt32(); // color
      const vertexCount = r.readVarint(true);
      const uvs = readFloatArray38(r, vertexCount * 2);
      const triangleCount = r.readVarint(true);
      const triangles = [];
      for (let i = 0; i < triangleCount; i++) triangles.push(r.readShort());
      readVertices38(r, vertexCount);
      r.readVarint(true); // hullLength, unused by this library
      if (nonessential) {
        const edgeCount = r.readVarint(true);
        for (let i = 0; i < edgeCount; i++) r.readShort();
        r.readFloat(); // width
        r.readFloat(); // height
      }
      return { type: 'Mesh', path: path ?? name, uvs, triangles };
    }
    case 'LinkedMesh': {
      const path = r.readStringRef(strings);
      r.readInt32(); // color
      r.readStringRef(strings); // skinName
      r.readStringRef(strings); // parent
      r.readBoolean(); // inheritDeform (a real byte in 3.8, not a flag bit)
      if (nonessential) {
        r.readFloat(); // width
        r.readFloat(); // height
      }
      return { type: 'LinkedMesh', path: path ?? name };
    }
    case 'Path': {
      r.readBoolean(); // closed
      r.readBoolean(); // constantSpeed
      const vertexCount = r.readVarint(true);
      readVertices38(r, vertexCount);
      const lengthCount = vertexCount / 3;
      for (let i = 0; i < lengthCount; i++) r.readFloat();
      if (nonessential) r.readInt32();
      return { type: 'Path', path: name };
    }
    case 'Point': {
      r.readFloat(); // rotation
      r.readFloat(); // x
      r.readFloat(); // y
      if (nonessential) r.readInt32();
      return { type: 'Point', path: name };
    }
    case 'Clipping': {
      r.readVarint(true); // endSlotIndex
      const vertexCount = r.readVarint(true);
      readVertices38(r, vertexCount);
      if (nonessential) r.readInt32();
      return { type: 'Clipping', path: name };
    }
    default:
      throw new Error(`Unknown attachment type index: ${typeIndex}`);
  }
}

function readVertices38(r, vertexCount) {
  const floatCount = vertexCount * 2;
  const weighted = r.readBoolean();
  if (!weighted) {
    for (let i = 0; i < floatCount; i++) r.readFloat();
    return;
  }
  for (let i = 0; i < vertexCount; i++) {
    const boneCount = r.readVarint(true);
    for (let ii = 0; ii < boneCount; ii++) {
      r.readVarint(true); // bone index
      r.readFloat(); // x
      r.readFloat(); // y
      r.readFloat(); // weight
    }
  }
}

function readFloatArray38(r, n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = r.readFloat();
  return arr;
}

function skipSkinBoneAndConstraintRefs38(r) {
  const boneCount = r.readVarint(true);
  for (let i = 0; i < boneCount; i++) r.readVarint(true); // bone index

  const ikCount = r.readVarint(true);
  for (let i = 0; i < ikCount; i++) r.readVarint(true); // IK constraint index

  const transformCount = r.readVarint(true);
  for (let i = 0; i < transformCount; i++) r.readVarint(true); // transform constraint index

  const pathCount = r.readVarint(true);
  for (let i = 0; i < pathCount; i++) r.readVarint(true); // path constraint index
}
