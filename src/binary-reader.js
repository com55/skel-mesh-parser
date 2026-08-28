// src/binary-reader.js

/** Low-level big-endian byte reader for the Spine skeleton binary format.
 *  Field encodings verified against the official spine-ts reference source
 *  (read for the wire-format facts, not copied — see this repo's README's
 *  Provenance note). Independent implementation. */
export class BinaryReader {
  #view;
  #pos = 0;

  constructor(bytes) {
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get position() { return this.#pos; }

  readByte() {
    const v = this.#view.getInt8(this.#pos);
    this.#pos += 1;
    return v;
  }

  readUByte() {
    const v = this.#view.getUint8(this.#pos);
    this.#pos += 1;
    return v;
  }

  readShort() {
    const v = this.#view.getInt16(this.#pos, false);
    this.#pos += 2;
    return v;
  }

  readInt32() {
    const v = this.#view.getInt32(this.#pos, false);
    this.#pos += 4;
    return v;
  }

  readFloat() {
    const v = this.#view.getFloat32(this.#pos, false);
    this.#pos += 4;
    return v;
  }

  readBoolean() {
    return this.readByte() !== 0;
  }

  /** Variable-length integer: up to 5 bytes, 7 payload bits each, high bit
   *  is the continuation flag. When optimizePositive is false, the result
   *  is zigzag-decoded so small negative numbers stay small on the wire. */
  readVarint(optimizePositive) {
    let b = this.readUByte();
    let result = b & 0x7f;
    if ((b & 0x80) !== 0) {
      b = this.readUByte();
      result |= (b & 0x7f) << 7;
      if ((b & 0x80) !== 0) {
        b = this.readUByte();
        result |= (b & 0x7f) << 14;
        if ((b & 0x80) !== 0) {
          b = this.readUByte();
          result |= (b & 0x7f) << 21;
          if ((b & 0x80) !== 0) {
            b = this.readUByte();
            result |= (b & 0x7f) << 28;
          }
        }
      }
    }
    return optimizePositive ? (result >>> 0) : ((result >>> 1) ^ -(result & 1));
  }

  /** Reads a length-prefixed UTF-8 string. byteCount 0 = null, 1 = empty
   *  string, >=2 = (byteCount - 1) UTF-8 bytes follow. */
  readString() {
    const byteCount = this.readVarint(true);
    if (byteCount === 0) return null;
    if (byteCount === 1) return '';
    const len = byteCount - 1;
    const bytes = new Uint8Array(this.#view.buffer, this.#view.byteOffset + this.#pos, len);
    this.#pos += len;
    return utf8Decode(bytes);
  }

  /** Reads a varint index into the strings[] table (0 = null). Must not
   *  be called before readStringTable(). */
  readStringRef(strings) {
    const index = this.readVarint(true);
    return index === 0 ? null : strings[index - 1];
  }
}

/** Manual UTF-8 decode — no TextDecoder dependency, so this stays usable
 *  in the narrowest embedded/webview contexts without a polyfill. */
function utf8Decode(bytes) {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++], b2 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      // 4-byte sequences (rare in practice for skeleton names) — decode as
      // a surrogate pair.
      const b1 = bytes[i++], b2 = bytes[i++], b3 = bytes[i++];
      let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}
