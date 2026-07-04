#!/usr/bin/env python3
"""ZMK Studio RPC probe over CDC ACM (no pyserial; termios direct).

Sends core.getDeviceInfo (Request{requestId=1, core{getDeviceInfo:true}})
framed with SOF 0xAB / ESC 0xAC / EOF 0xAD and records any response bytes.
Read/write restricted to the given serial port. Read-only for the keyboard
(no flashing, no destructive ops).
"""
import os
import sys
import termios
import time

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/cu.usbmodem1101"
BAUD = int(sys.argv[2]) if len(sys.argv) > 2 else 115200
# Request { requestId=1 (08 01), core=field3 { getDeviceInfo=true (08 01) } }
FRAME = bytes.fromhex("ab08011a020801ad")

BAUD_CONST = {1200: termios.B1200, 9600: termios.B9600, 115200: termios.B115200}

fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
try:
    attrs = termios.tcgetattr(fd)
    # raw mode
    attrs[0] = 0  # iflag
    attrs[1] = 0  # oflag
    attrs[2] = termios.CREAD | termios.CLOCAL | termios.CS8  # cflag
    attrs[3] = 0  # lflag
    speed = BAUD_CONST.get(BAUD, termios.B115200)
    attrs[4] = speed
    attrs[5] = speed
    termios.tcsetattr(fd, termios.TCSANOW, attrs)

    # Assert DTR/RTS (CDC ACM line control)
    import fcntl
    TIOCMBIS = 0x8004746C
    TIOCM_DTR = 0x002
    TIOCM_RTS = 0x004
    import struct
    fcntl.ioctl(fd, TIOCMBIS, struct.pack("i", TIOCM_DTR))
    fcntl.ioctl(fd, TIOCMBIS, struct.pack("i", TIOCM_RTS))

    termios.tcflush(fd, termios.TCIOFLUSH)
    time.sleep(0.2)

    written = os.write(fd, FRAME)
    print(f"[probe] port={PORT} baud={BAUD} wrote {written} bytes: {FRAME.hex()}")

    deadline = time.time() + 4.0
    received = bytearray()
    while time.time() < deadline:
        try:
            chunk = os.read(fd, 256)
            if chunk:
                received.extend(chunk)
                # got EOF marker? keep reading briefly for the rest
                if 0xAD in chunk:
                    time.sleep(0.2)
        except BlockingIOError:
            time.sleep(0.05)

    if received:
        print(f"[probe] RESPONSE {len(received)} bytes: {received.hex()}")
    else:
        print("[probe] NO RESPONSE (0 bytes in 4s)")
finally:
    os.close(fd)
