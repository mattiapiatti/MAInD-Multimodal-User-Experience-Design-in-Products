"""Small MCU RPC helper for LED matrix state and RGB LEDs.

The router reaches the MCU over a 115200-baud serial link, and the NeoPixel
``strip.show()`` disables interrupts for ~0.7 ms per frame. Flooding the bridge
(e.g. an audio level per chunk) makes the MCU drop serial bytes during show(),
desyncing the msgpack stream so the LEDs freeze. Keep high-frequency calls
throttled — see ``set_audio_level``.
"""

import socket
import threading
import time

import msgpack

ROUTER_SOCK = "/var/run/arduino-router.sock"
_lock = threading.Lock()

# Rate-limit state for the high-frequency audio-level updates (matrix only).
_LEVEL_MIN_INTERVAL = 0.12  # ~8 Hz
_last_level_ts = 0.0
_last_level_val = -1


def _request(method: str, params: list):
    req = msgpack.packb([0, 1, method, params])
    try:
        with _lock:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
                s.settimeout(5.0)
                s.connect(ROUTER_SOCK)
                s.sendall(req)
                buf = b""
                for _ in range(3):
                    chunk = s.recv(1024)
                    if not chunk:
                        break
                    buf += chunk
                    try:
                        unpacked = msgpack.unpackb(buf, max_array_len=100, max_map_len=100)
                        if len(unpacked) >= 4 and unpacked[2] is None:
                            return True, unpacked[3]
                        return False, None
                    except Exception:
                        continue
    except Exception:
        pass
    return False, None


def _call(method: str, params: list):
    ok, result = _request(method, params)
    return result if ok else None


def _notify(method: str, params: list):
    req = msgpack.packb([0, 1, method, params])
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.settimeout(0.1)
            s.connect(ROUTER_SOCK)
            s.sendall(req)
    except Exception:
        pass


def _notify_x2(method: str, params: list):
    # Send a low-frequency state RPC twice with a tiny gap. show() masks IRQs and
    # can drop a byte of one frame; a second copy lands when the line is clear.
    # (This only rescues a single dropped/desynced frame — it cannot un-stall an
    # already buffer-locked decoder; the firmware change is what avoids that.)
    _notify(method, params)
    time.sleep(0.01)
    _notify(method, params)


def set_wake_word_state(active: bool):
    # Fire-and-forget: this only drives the ring LED, and the reply was discarded
    # anyway. A blocking _call (5s timeout) here stalled the whole activation path
    # waiting on the MCU — keep it off the hot path so the mic opens instantly.
    _notify_x2("set_wake_word_state", [active])


def set_voice_state(active: bool):
    _notify_x2("set_voice_state", [active])


def set_audio_level(level: int):
    # Matrix-only now (the ring no longer reacts to audio). Throttle hard (~8 Hz,
    # skip tiny changes) so this stream stays a negligible fraction of the serial
    # bridge — the ring's show() bursts must not overlap a flood of these frames.
    # level=0 always passes so the matrix settles promptly when audio stops.
    global _last_level_ts, _last_level_val
    now = time.monotonic()
    if level != 0 and now - _last_level_ts < _LEVEL_MIN_INTERVAL and abs(level - _last_level_val) < 12:
        return
    _last_level_ts = now
    _last_level_val = level
    _notify("set_audio_level", [level])


def set_led_color(led_id: int, r: int, g: int, b: int) -> bool:
    ok, _ = _request("set_color", [led_id, r, g, b])
    return ok


def set_light_state(state: int):
    _notify_x2("set_light_state", [state])
