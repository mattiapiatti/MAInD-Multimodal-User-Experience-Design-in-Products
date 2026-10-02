"""Realtime voice brick — runs a turn-based conversation with the Voice Agent Service.

The persona and the learned memory live server-side: the device connects to a
session voice URL that ``companion open`` already opened with them loaded. So this
brick only needs the URL (+ a Cloudflare Access token if the service is gated).

Lifecycle: sleep until the wake word fires, run one conversation (a few turns
until the user goes quiet), then call ``on_sleep`` to return to wake-word standby.
"""

import asyncio
import hashlib
import json
import os
import secrets
import threading
import urllib.error
import urllib.request
from typing import Callable
from urllib.parse import urlparse

from arduino.app_utils import brick, Logger

from .session import VoiceSession

logger = Logger("voice_realtime")

__all__ = ["VoiceRealtime"]


def _cf_access_headers() -> dict:
    """Cloudflare Access service-token headers for the voice WS upgrade.

    Ways to supply them (first match wins; same names as the companion repo .env):
      * VA_CF_ACCESS_CLIENT_ID / VA_CF_ACCESS_CLIENT_SECRET  (preferred)
      * VA_ACCESS_CLIENT_ID    / VA_ACCESS_CLIENT_SECRET
      * CF_HEADER_<Name>=value  ->  arbitrary header <Name>
    Empty when the service is local / not behind Access.
    """
    headers = {
        k[len("CF_HEADER_"):]: v
        for k, v in os.environ.items()
        if k.startswith("CF_HEADER_") and v
    }
    cid = (os.getenv("VA_CF_ACCESS_CLIENT_ID", "") or os.getenv("VA_ACCESS_CLIENT_ID", "")).strip()
    secret = (os.getenv("VA_CF_ACCESS_CLIENT_SECRET", "") or os.getenv("VA_ACCESS_CLIENT_SECRET", "")).strip()
    if cid and secret:
        headers["CF-Access-Client-Id"] = cid
        headers["CF-Access-Client-Secret"] = secret
    return headers


# Hardware identities tried in order for the device fingerprint. The first readable,
# non-empty one wins; if none is (common inside a container), a random id is
# generated once and kept in the app folder.
_HW_ID_SOURCES = (
    "/sys/firmware/devicetree/base/serial-number",
    "/proc/device-tree/serial-number",
    "/etc/machine-id",
    "/var/lib/dbus/machine-id",
)
_APP_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEVICE_ID_FILE = os.path.join(_APP_ROOT, ".device-id")


def _device_fingerprint() -> tuple[str, str]:
    """(sha256 of this board's identity, where it came from).

    The server binds a device token to this value on first use, so it must stay
    the same across restarts — and must never be put in .env (copying .env to
    another board would then copy the identity too)."""
    for path in _HW_ID_SOURCES:
        try:
            with open(path, "rb") as f:
                raw = f.read().strip(b"\x00\n\r\t ")
        except OSError:
            continue
        if raw:
            return hashlib.sha256(raw).hexdigest(), path
    try:
        with open(_DEVICE_ID_FILE) as f:
            raw = f.read().strip()
    except OSError:
        raw = ""
    if not raw:
        raw = secrets.token_hex(32)
        with open(_DEVICE_ID_FILE, "w") as f:
            f.write(raw + "\n")
    return hashlib.sha256(raw.encode()).hexdigest(), _DEVICE_ID_FILE


def _device_headers() -> dict:
    """Per-device token headers (empty if VA_DEVICE_TOKEN is not set)."""
    token = os.getenv("VA_DEVICE_TOKEN", "").strip()
    if not token:
        return {}
    fingerprint, _ = _device_fingerprint()
    return {"X-Device-Token": token, "X-Device-Fingerprint": fingerprint}


def _check_device_token() -> None:
    """At boot, ask the server whether this board's token is valid and bound here,
    so a wrong/copied token shows up in the logs immediately, not at the first wake."""
    headers = _device_headers()
    if not headers:
        logger.info("No VA_DEVICE_TOKEN set — connecting without a device token.")
        return
    _, source = _device_fingerprint()
    logger.info(f"Device fingerprint from {source}")
    ws_url = (os.getenv("VA_VOICE_WS_URL", "") or os.getenv("VOICE_WS_URL", "")).strip()
    if not ws_url:
        return
    parts = urlparse(ws_url)
    scheme = "https" if parts.scheme == "wss" else "http"
    req = urllib.request.Request(
        f"{scheme}://{parts.netloc}/v1/devices/me",
        headers={**_cf_access_headers(), **headers},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            info = json.loads(r.read())
        logger.info(f"Device token OK: {info.get('name')} ({info.get('device_id')})")
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("detail", "")
        except Exception:  # noqa: BLE001
            detail = ""
        logger.error(f"Device token refused (HTTP {e.code}): {detail}")
    except Exception as e:  # noqa: BLE001 — offline at boot must not stop the device
        logger.warning(f"Device token check skipped: {e}")


@brick
class VoiceRealtime:
    """Runs the wake ↔ conversation loop in a dedicated daemon thread."""

    def __init__(self):
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False
        self._wake_event: threading.Event | None = None
        self._on_sleep: Callable | None = None
        self._idle_timeout = float(os.getenv("PIPELINE_SLEEP_TIMEOUT", "45"))
        threading.Thread(target=_check_device_token, name="device-check", daemon=True).start()

    def set_wake_mode(self, event: threading.Event, on_sleep: Callable = None, sleep_timeout_sec: float = None):
        self._wake_event = event
        self._on_sleep = on_sleep
        if sleep_timeout_sec is not None:
            self._idle_timeout = sleep_timeout_sec

    def start(self):
        self._running = True

    def stop(self):
        self._running = False

    @brick.execute
    def _run_pipeline(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._run())
        except KeyboardInterrupt:
            pass
        except Exception as exc:
            logger.error(f"Fatal: {exc}")
            import traceback
            traceback.print_exc()
        finally:
            # If the loop ever dies, make sure main.py releases _session_active and
            # re-arms the wake word so the device doesn't stay deaf.
            if self._on_sleep:
                try:
                    self._on_sleep()
                except Exception:
                    pass
            self._loop.close()

    async def _run(self):
        session = None
        while True:
            if self._wake_event is not None:
                logger.info("Sleeping — waiting for the wake word.")
                await asyncio.get_event_loop().run_in_executor(None, self._wake_event.wait)
                self._wake_event.clear()
            try:
                # Build lazily and per-loop: a config error (e.g. missing URL) then
                # logs once per wake and still re-arms, instead of killing the thread
                # while main.py keeps firing wakes into a dead loop.
                if session is None:
                    session = self._build_session()
                await session.run_conversation()
            except Exception as exc:  # noqa: BLE001
                # A busy mic / dropped connection / misconfig must return us to
                # standby, never kill the loop (the device would go deaf until reboot).
                logger.error(f"conversation error: {exc}")
            if self._wake_event is None:
                break
            if self._on_sleep:
                self._on_sleep()

    def _build_session(self) -> VoiceSession:
        url = (os.getenv("VA_VOICE_WS_URL", "") or os.getenv("VOICE_WS_URL", "")).strip()
        if not url:
            raise RuntimeError(
                "VA_VOICE_WS_URL not set — run `companion open` on the memory-owner "
                "machine and paste the printed ws(s):// session voice URL"
            )
        logger.info(f"Voice Agent Service: {url}")
        return VoiceSession(
            url=url,
            headers={**_cf_access_headers(), **_device_headers()},
            output_rate=int(os.getenv("VA_OUTPUT_RATE", "24000")),
            idle_timeout=self._idle_timeout,
            silence_ms=int(os.getenv("SILENCE_MS", "1500")),
        )
