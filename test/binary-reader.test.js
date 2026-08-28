// test/binary-reader.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinaryReader } from '../src/binary-reader.js';

test('readByte reads signed int8, big-endian irrelevant (1 byte)', () => {
  const r = new BinaryReader(new Uint8Array([0x7f, 0x80, 0xff]));
  assert.equal(r.readByte(), 127);
  assert.equal(r.readByte(), -128);
  assert.equal(r.readByte(), -1);
});

test('readUByte reads unsigned int8', () => {
  const r = new BinaryReader(new Uint8Array([0x80, 0xff]));
  assert.equal(r.readUByte(), 128);
  assert.equal(r.readUByte(), 255);
});

test('readShort reads signed int16 big-endian', () => {
  // 0x7FFF = 32767, 0x8000 = -32768, 0xFFFF = -1
  const r = new BinaryReader(new Uint8Array([0x7f, 0xff, 0x80, 0x00, 0xff, 0xff]));
  assert.equal(r.readShort(), 32767);
  assert.equal(r.readShort(), -32768);
  assert.equal(r.readShort(), -1);
});

test('readInt32 reads signed int32 big-endian', () => {
  // 0x00000001 = 1, 0xFFFFFFFF = -1
  const r = new BinaryReader(new Uint8Array([0x00, 0x00, 0x00, 0x01, 0xff, 0xff, 0xff, 0xff]));
  assert.equal(r.readInt32(), 1);
  assert.equal(r.readInt32(), -1);
});

test('readFloat reads IEEE754 float32 big-endian', () => {
  // 1.5 as float32 BE = 0x3FC00000
  const r = new BinaryReader(new Uint8Array([0x3f, 0xc0, 0x00, 0x00]));
  assert.equal(r.readFloat(), 1.5);
});

test('readBoolean reads a byte, nonzero = true', () => {
  const r = new BinaryReader(new Uint8Array([0x00, 0x01, 0x05]));
  assert.equal(r.readBoolean(), false);
  assert.equal(r.readBoolean(), true);
  assert.equal(r.readBoolean(), true);
});

test('readVarint: single-byte value, optimizePositive', () => {
  // 5 fits in 7 bits, high bit 0 -> one byte, no continuation
  const r = new BinaryReader(new Uint8Array([0x05]));
  assert.equal(r.readVarint(true), 5);
});

test('readVarint: two-byte value, optimizePositive', () => {
  // 300 = 0b1_0010_1100 -> low 7 bits 0x2C with continuation bit set (0xAC),
  // next byte holds bits 7-13: 300 >> 7 = 2 -> 0x02
  const r = new BinaryReader(new Uint8Array([0xac, 0x02]));
  assert.equal(r.readVarint(true), 300);
});

test('readVarint: zigzag-decodes negative numbers when optimizePositive is false', () => {
  // Spine's zigzag: result = (raw >>> 1) ^ -(raw & 1). raw=1 -> -1, raw=2 -> 1.
  const r = new BinaryReader(new Uint8Array([0x01, 0x02]));
  assert.equal(r.readVarint(false), -1);
  assert.equal(r.readVarint(false), 1);
});

test('readString reads a length-prefixed UTF-8 string', () => {
  // "Hi" = byteCount 3 (1 + 2 bytes), then 0x48 0x69
  const r = new BinaryReader(new Uint8Array([0x03, 0x48, 0x69]));
  assert.equal(r.readString(), 'Hi');
});

test('readString: byteCount 0 is null, byteCount 1 is empty string', () => {
  const r = new BinaryReader(new Uint8Array([0x00, 0x01]));
  assert.equal(r.readString(), null);
  assert.equal(r.readString(), '');
});

test('readStringRef: index 0 is null, else 1-based lookup into strings[]', () => {
  const strings = ['first', 'second'];
  const r = new BinaryReader(new Uint8Array([0x00, 0x01, 0x02]));
  assert.equal(r.readStringRef(strings), null);
  assert.equal(r.readStringRef(strings), 'first');
  assert.equal(r.readStringRef(strings), 'second');
});
