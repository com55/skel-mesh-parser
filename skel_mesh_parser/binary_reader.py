"""Low-level big-endian byte reader for the Spine skeleton binary format --
port of www/js/vendor/spine-skeleton-binary/binary-reader.js's BinaryReader.
Field encodings match the vendored JS exactly; this is a mechanical port,
not a redesign (spec §6)."""
from __future__ import annotations

import struct


class BufferUnderrunError(Exception):
    """Python's equivalent of DataView throwing a RangeError when a read
    runs past the buffer's end. detect_version.py (Task 4) catches this
    exact type to implement the same try-4.2-then-fall-back-to-3.8 probe
    the real JS does via its own RangeError guard -- this type is load
    -bearing there, not incidental here."""


class BinaryReader:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self._pos = 0

    @property
    def position(self) -> int:
        return self._pos

    def _require(self, n: int) -> None:
        if self._pos + n > len(self._data):
            raise BufferUnderrunError(
                f"read of {n} bytes at offset {self._pos} exceeds buffer "
                f"length {len(self._data)}"
            )

    def read_byte(self) -> int:
        self._require(1)
        v = struct.unpack_from(">b", self._data, self._pos)[0]
        self._pos += 1
        return v

    def read_ubyte(self) -> int:
        self._require(1)
        v = struct.unpack_from(">B", self._data, self._pos)[0]
        self._pos += 1
        return v

    def read_short(self) -> int:
        self._require(2)
        v = struct.unpack_from(">h", self._data, self._pos)[0]
        self._pos += 2
        return v

    def read_int32(self) -> int:
        self._require(4)
        v = struct.unpack_from(">i", self._data, self._pos)[0]
        self._pos += 4
        return v

    def read_float(self) -> float:
        self._require(4)
        v = struct.unpack_from(">f", self._data, self._pos)[0]
        self._pos += 4
        return v

    def read_boolean(self) -> bool:
        return self.read_byte() != 0

    def read_varint(self, optimize_positive: bool) -> int:
        # JS's bitwise ops truncate `result` to a signed 32-bit int at every
        # `|=` -- replicated here explicitly (`_to_int32`) rather than
        # relying on Python's arbitrary-precision ints, so a 5-byte varint
        # whose top contributed bits would overflow 32 bits in JS produces
        # the identical (wrapped) result in Python. Unreachable via any
        # real skeleton file (hullLength/vertexCount/triangleCount never
        # approach 2**28) -- ported for fidelity, not because real input
        # exercises it, same class of ruling as Stage 1's _parse_int NaN
        # divergence note.
        def to_int32(x: int) -> int:
            x &= 0xFFFFFFFF
            return x - 0x100000000 if x & 0x80000000 else x

        b = self.read_ubyte()
        result = b & 0x7F
        if b & 0x80:
            b = self.read_ubyte()
            result = to_int32(result | ((b & 0x7F) << 7))
            if b & 0x80:
                b = self.read_ubyte()
                result = to_int32(result | ((b & 0x7F) << 14))
                if b & 0x80:
                    b = self.read_ubyte()
                    result = to_int32(result | ((b & 0x7F) << 21))
                    if b & 0x80:
                        b = self.read_ubyte()
                        result = to_int32(result | ((b & 0x7F) << 28))
        if optimize_positive:
            return result & 0xFFFFFFFF
        return ((result & 0xFFFFFFFF) >> 1) ^ (-(result & 1))

    def read_string(self) -> str | None:
        byte_count = self.read_varint(True)
        if byte_count == 0:
            return None
        if byte_count == 1:
            return ""
        length = byte_count - 1
        self._require(length)
        raw = self._data[self._pos : self._pos + length]
        self._pos += length
        # JS's manual utf8Decode() never throws -- malformed bytes just
        # produce garbled String.fromCharCode output, not an exception.
        # Strict decode("utf-8") raises UnicodeDecodeError instead, a real
        # divergence found by Stage 2's Task 4 scrutinize review: reachable
        # not just adversarially but on ANY real 3.8 file, since
        # detect_version() always speculatively tries the 4.2 header shape
        # first, which routinely walks misaligned bytes (arbitrary skeleton
        # data, not string data) as if they were a length-prefixed string.
        # errors="replace" avoids the crash without chasing byte-for-byte
        # parity with JS's specific garbled output. This guarantee is
        # crash-safety, not full observable-behavior parity: on any
        # non-crafted input, the version-detection outcome matches JS,
        # since the only real consumer today (detect_version's regex match
        # against `^\d+\.\d+\.\d+`) treats ordinary garbage the same way --
        # as "no match". A scrutinize re-review found this DOES have a real
        # (adversarial-only) counterexample -- a hand-crafted overlong
        # 2-byte UTF-8 sequence (e.g. bytes C0 B4 C0 AE C0 B2 C0 AE C0 B0)
        # decodes in JS's utf8Decode() to the literal string "4.2.0"
        # (overlong encodings drop their high bits, `(0xC0 & 0x1f) << 6 |
        # (b1 & 0x3f)` collapses to `b1 & 0x3f`, i.e. plain ASCII), which
        # WOULD match the version regex -- while Python's errors="replace"
        # produces U+FFFD characters that don't. No real skeleton file's
        # misaligned-byte walk produces this pattern; only a deliberately
        # crafted payload would. This claim is scoped to today's two call
        # sites (both in detect_version.py) -- Tasks 5-7 add consumers
        # (attachment/skin/event names) that don't route through a regex,
        # so re-examine this note once those land.
        return raw.decode("utf-8", errors="replace")

    def read_string_ref(self, strings: list[str | None]) -> str | None:
        # JS: `return index === 0 ? null : strings[index - 1];` -- an
        # out-of-range index returns `undefined` in JS (no exception),
        # which typically flows into a `?? name`-style coalesce elsewhere
        # and recovers silently. A bare `strings[index - 1]` here would
        # raise IndexError instead, an uncaught-exception behavior change
        # from the oracle on malformed/adversarial input (unreachable via
        # any real skeleton file, same class of ruling as read_varint's
        # 32-bit-truncation note above) -- bounds-checked explicitly so
        # this stays a silent None like the real JS, not a crash.
        index = self.read_varint(True)
        if index == 0:
            return None
        pos = index - 1
        return strings[pos] if 0 <= pos < len(strings) else None
