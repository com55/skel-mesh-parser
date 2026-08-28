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
