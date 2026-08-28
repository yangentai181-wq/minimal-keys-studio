#!/usr/bin/env python3
"""Read-only dump of the runtime hold-tap settings over CDC ACM.

Lists every hold-tap behavior with its tapping term, quick-tap window,
prior-idle guard and flavor. Useful to confirm what the keyboard actually
stores after editing the values in Studio: a quick-tap of 0 means a tapped key
cannot repeat, because holding it again resolves to the hold behavior.

Usage:
    python3 scripts/studio_holdtap_dump.py /dev/cu.usbmodemXXXX

The serial port must be free: close any Studio tab or app holding it first.
Sends only list requests; nothing is written to the keyboard.
"""
import fcntl
import os
import struct
import sys
import termios
import time

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/cu.usbmodem1101"
SUBSYSTEM_ID = "zmk__hold_tap"
SOF, ESC, EOF = 0xAB, 0xAC, 0xAD
FLAVORS = {0: "ホールド優先", 1: "バランス", 2: "タップ優先", 3: "他キーでホールド"}


def varint(value):
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        out.append(byte | (0x80 if value else 0))
        if not value:
            return bytes(out)


def field(number, wire, payload):
    return varint((number << 3) | wire) + payload


def submessage(number, payload):
    return field(number, 2, varint(len(payload)) + payload)


def frame(payload):
    out = bytearray([SOF])
    for byte in payload:
        if byte in (SOF, ESC, EOF):
            out.append(ESC)
        out.append(byte)
    out.append(EOF)
    return bytes(out)


def read_varint(buf, i):
    val = shift = 0
    while True:
        byte = buf[i]
        i += 1
        val |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return val, i
        shift += 7


def fields(buf):
    i = 0
    while i < len(buf):
        tag, i = read_varint(buf, i)
        num, wire = tag >> 3, tag & 7
        if wire == 0:
            val, i = read_varint(buf, i)
        elif wire == 2:
            ln, i = read_varint(buf, i)
            val, i = buf[i:i + ln], i + ln
        else:
            raise ValueError("wire type %d unsupported" % wire)
        yield num, wire, val


def first(buf, target):
    if buf is None:
        return None
    for num, _wire, val in fields(buf):
        if num == target:
            return val
    return None


def frames(buf):
    body, in_frame, skip = bytearray(), False, False
    for byte in buf:
        if not in_frame:
            if byte == SOF:
                in_frame, body, skip = True, bytearray(), False
            continue
        if skip:
            body.append(byte)
            skip = False
        elif byte == ESC:
            skip = True
        elif byte == EOF:
            in_frame = False
            yield bytes(body)
        else:
            body.append(byte)


def exchange(fd, payload):
    os.write(fd, frame(payload))
    raw = bytearray()
    deadline = time.time() + 5
    while time.time() < deadline:
        try:
            chunk = os.read(fd, 4096)
        except BlockingIOError:
            time.sleep(0.05)
            continue
        if chunk:
            raw += chunk
            deadline = time.time() + 0.6
    for body in frames(raw):
        try:
            response = first(body, 1)          # Response.requestResponse
            custom = first(response, 100) if response else None
        except (IndexError, ValueError):
            continue
        if custom:
            return custom
    return None


def open_port(port):
    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    attrs = termios.tcgetattr(fd)
    attrs[0] = attrs[1] = attrs[3] = 0
    attrs[2] = termios.CREAD | termios.CLOCAL | termios.CS8
    attrs[4] = attrs[5] = termios.B115200
    termios.tcsetattr(fd, termios.TCSANOW, attrs)
    fcntl.ioctl(fd, 0x8004746C, struct.pack("i", 0x002 | 0x004))  # DTR|RTS
    time.sleep(0.2)
    return fd


fd = open_port(PORT)
try:
    discovery = exchange(
        fd, field(1, 0, varint(1)) + submessage(100, submessage(1, b"")))
    if discovery is None:
        print("カスタムサブシステム一覧を取得できませんでした")
        sys.exit(1)

    index = None
    for num, _wire, val in fields(first(discovery, 1) or b""):
        if num != 1:
            continue
        subsystem_index, identifier = 0, ""
        for f_num, f_wire, f_val in fields(val):
            if f_num == 1 and f_wire == 0:
                subsystem_index = f_val
            elif f_num == 2:
                identifier = f_val.decode("utf-8", "replace")
        if identifier == SUBSYSTEM_ID:
            index = subsystem_index

    if index is None:
        print("%s はこのファームウェアにありません" % SUBSYSTEM_ID)
        sys.exit(1)

    call = submessage(100, submessage(
        2, field(1, 0, varint(index)) + submessage(2, submessage(1, b""))))
    reply = exchange(fd, field(1, 0, varint(2)) + call)
finally:
    os.close(fd)

payload = first(first(reply, 2) if reply else None, 2)
listing = first(payload, 2) if payload else None
if listing is None:
    print("ホールドタップ設定を読み取れませんでした")
    sys.exit(1)

print("%-20s %10s %12s %12s  %s" % ("名前", "長押し判定", "連打→単押し", "直前入力待ち", "判定方式"))
for num, _wire, val in fields(listing):
    if num != 1:
        continue
    info = {"id": 0, "name": "", 3: 0, 4: 0, 5: 0, 6: 0}
    for f_num, _f_wire, f_val in fields(val):
        if f_num == 1:
            info["id"] = f_val
        elif f_num == 2:
            info["name"] = f_val.decode("utf-8", "replace")
        elif f_num in info:
            info[f_num] = f_val
    def ms(value):
        # The runtime module reports 0xFFFFFFFF for "not overridden".
        return "未設定" if value == 0xFFFFFFFF else "%dms" % value

    quick_unset = info[4] in (0, 0xFFFFFFFF)
    note = "   ← タップのリピート不可" if quick_unset else ""
    print("id=%-3d %-20s %8s %10s %10s  %s%s" % (
        info["id"], info["name"][:20], ms(info[3]), ms(info[4]), ms(info[5]),
        FLAVORS.get(info[6], info[6]), note))
