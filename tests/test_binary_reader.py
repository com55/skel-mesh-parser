import struct

import pytest

from skel_mesh_parser.binary_reader import BinaryReader, BufferUnderrunError


def test_read_byte_and_ubyte():
    r = BinaryReader(bytes([0xFF, 0x01]))
    assert r.read_byte() == -1  # signed
    assert r.read_ubyte() == 1


def test_read_short_big_endian_signed():
    r = BinaryReader(struct.pack(">h", -300))
    assert r.read_short() == -300


def test_read_int32_big_endian_signed():
    r = BinaryReader(struct.pack(">i", -70000))
    assert r.read_int32() == -70000


def test_read_float_big_endian():
    r = BinaryReader(struct.pack(">f", 3.5))
    assert r.read_float() == pytest.approx(3.5)


def test_read_boolean():
    r = BinaryReader(bytes([0x00, 0x01, 0x02]))
    assert r.read_boolean() is False
    assert r.read_boolean() is True
    assert r.read_boolean() is True  # any nonzero byte is truthy


def test_read_varint_single_byte_positive():
    r = BinaryReader(bytes([0x05]))
    assert r.read_varint(True) == 5


def test_read_varint_multi_byte_positive():
    # 300 = 0b1_0010_1100 -> low 7 bits 0b0101100=0x2c with continuation,
    # next byte 0b0000010=0x02
    r = BinaryReader(bytes([0x2C | 0x80, 0x02]))
    assert r.read_varint(True) == 300


def test_read_varint_zigzag_negative():
    # optimizePositive=false: -1 encodes as zigzag 1 -> varint byte 0x01
    r = BinaryReader(bytes([0x01]))
    assert r.read_varint(False) == -1


def test_read_varint_zigzag_positive():
    # zigzag 2 -> value 1
    r = BinaryReader(bytes([0x02]))
    assert r.read_varint(False) == 1


def test_read_string_null_when_byte_count_zero():
    r = BinaryReader(bytes([0x00]))
    assert r.read_string() is None


def test_read_string_empty_when_byte_count_one():
    r = BinaryReader(bytes([0x01]))
    assert r.read_string() == ""


def test_read_string_ascii():
    payload = b"hi"
    r = BinaryReader(bytes([len(payload) + 1]) + payload)
    assert r.read_string() == "hi"


def test_read_string_utf8_multibyte():
    payload = "café".encode("utf-8")
    r = BinaryReader(bytes([len(payload) + 1]) + payload)
    assert r.read_string() == "café"


def test_read_string_ref_zero_is_none():
    r = BinaryReader(bytes([0x00]))
    assert r.read_string_ref(["a", "b"]) is None


def test_read_string_ref_one_based_index():
    r = BinaryReader(bytes([0x02]))
    assert r.read_string_ref(["a", "b"]) == "b"


def test_position_advances_correctly():
    r = BinaryReader(bytes([0x00, 0x00, 0x00, 0x00, 0x00]))
    assert r.position == 0
    r.read_int32()
    assert r.position == 4
    r.read_ubyte()
    assert r.position == 5


def test_read_past_end_raises_buffer_underrun():
    r = BinaryReader(bytes([0x00]))
    r.read_ubyte()
    with pytest.raises(BufferUnderrunError):
        r.read_ubyte()


def test_read_int32_past_end_raises_buffer_underrun():
    r = BinaryReader(bytes([0x00, 0x00]))  # only 2 bytes, int32 needs 4
    with pytest.raises(BufferUnderrunError):
        r.read_int32()
