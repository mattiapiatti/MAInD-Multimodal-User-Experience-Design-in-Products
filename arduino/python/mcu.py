"""Small MCU RPC helper for LED matrix state and RGB LEDs."""

import socket
import threading

import msgpack

ROUTER_SOCK = "/var/run/arduino-router.sock"
_lock = threading.Lock()


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


def set_wake_word_state(active: bool):
    _call("set_wake_word_state", [active])


def set_voice_state(active: bool):
    _call("set_voice_state", [active])


def set_audio_level(level: int):
    _notify("set_audio_level", [level])


def set_led_color(led_id: int, r: int, g: int, b: int) -> bool:
    ok, _ = _request("set_color", [led_id, r, g, b])
    return ok


def set_light_state(state: int):
    _notify("set_light_state", [state])
