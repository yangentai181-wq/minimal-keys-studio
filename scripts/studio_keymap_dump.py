#!/usr/bin/env python3
"""Read-only dump of the live ZMK Studio keymap over CDC ACM.

Sends Request{requestId=1, keymap{getKeymap:true}} and decodes the reply, so a
keymap can be checked against the device instead of against the UI. Useful when
the app and the keyboard disagree, or to tell a saved binding from a RAM-only
edit (disconnect first: unsaved edits survive a disconnect, not a power cycle).

Usage:
    python3 scripts/studio_keymap_dump.py /dev/cu.usbmodemXXXX [position ...]

The serial port must be free: close any Studio tab or app holding it first.
No writes to the keyboard: getKeymap only.
"""
import fcntl
import os
import struct
import sys
import termios
import time

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/cu.usbmodem1101"
ONLY = [int(a) for a in sys.argv[2:]] or None

SOF, ESC, EOF = 0xAB, 0xAC, 0xAD


def frame(payload: bytes) -> bytes:
    out = bytearray([SOF])
    for b in payload:
        if b in (SOF, ESC, EOF):
            out.append(ESC)
        out.append(b)
    out.append(EOF)
    return bytes(out)


def varint(buf, i):
    val = shift = 0
    while True:
        b = buf[i]
        i += 1
        val |= (b & 0x7F) << shift
        if not b & 0x80:
            return val, i
        shift += 7


def fields(buf):
    """Yield (field_number, wire_type, value) for one protobuf message."""
    i = 0
    while i < len(buf):
        tag, i = varint(buf, i)
        fnum, wtype = tag >> 3, tag & 7
        if wtype == 0:
            val, i = varint(buf, i)
        elif wtype == 2:
            ln, i = varint(buf, i)
            val, i = buf[i:i + ln], i + ln
        else:
            raise ValueError(f"wire type {wtype} unsupported")
        yield fnum, wtype, val


def first(buf, target):
    for fnum, _w, val in fields(buf):
        if fnum == target:
            return val
    return None


payload = bytes([0x08, 0x01, 0x2A, 0x02, 0x08, 0x01])  # requestId=1, keymap.getKeymap
fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
try:
    attrs = termios.tcgetattr(fd)
    attrs[0] = 0
    attrs[1] = 0
    attrs[2] = termios.CREAD | termios.CLOCAL | termios.CS8
    attrs[3] = 0
    attrs[4] = attrs[5] = termios.B115200
    termios.tcsetattr(fd, termios.TCSANOW, attrs)
    fcntl.ioctl(fd, 0x8004746C, struct.pack("i", 0x002 | 0x004))  # DTR|RTS
    time.sleep(0.2)
    os.write(fd, frame(payload))

    raw = bytearray()
    deadline = time.time() + 8
    while time.time() < deadline:
        try:
            chunk = os.read(fd, 4096)
        except BlockingIOError:
            time.sleep(0.05)
            continue
        if chunk:
            raw += chunk
            deadline = time.time() + 1.0  # keep reading while data flows
finally:
    os.close(fd)

def frames(buf):
    """Yield each unescaped frame body between SOF and EOF."""
    body, in_frame, skip = bytearray(), False, False
    for b in buf:
        if not in_frame:
            if b == SOF:
                in_frame, body, skip = True, bytearray(), False
            continue
        if skip:
            body.append(b)
            skip = False
        elif b == ESC:
            skip = True
        elif b == EOF:
            in_frame = False
            yield bytes(body)
        else:
            body.append(b)


keymap = None
for body in frames(raw):
    try:
        request_response = first(body, 1)  # Response.requestResponse
        candidate = first(first(request_response, 5), 1) if request_response else None
    except (IndexError, ValueError):
        continue
    if candidate:
        keymap = candidate

if keymap is None:
    print(f"no keymap in response ({len(raw)} bytes read)")
    sys.exit(1)

for fnum, _w, val in fields(keymap):
    if fnum != 1:
        continue
    layer_id = name = None
    bindings = []
    for lf, lw, lv in fields(val):
        if lf == 1 and lw == 0:
            layer_id = lv
        elif lf == 2:
            name = lv.decode("utf-8", "replace")
        elif lf == 3:
            b = {"behaviorId": 0, "param1": 0, "param2": 0}
            for bf, _bw, bv in fields(lv):
                if bf == 1:
                    b["behaviorId"] = (bv >> 1) ^ -(bv & 1)  # sint32 zigzag
                elif bf == 2:
                    b["param1"] = bv
                elif bf == 3:
                    b["param2"] = bv
            bindings.append(b)
    print(f"\n== layer {layer_id} {name!r} ({len(bindings)} keys)")
    for pos, b in enumerate(bindings):
        if ONLY and pos not in ONLY:
            continue
        print(
            f"  #{pos:2d} behavior={b['behaviorId']:3d} "
            f"param1=0x{b['param1']:08x} param2=0x{b['param2']:08x}"
        )
