"""Realtime voice brick — runs a turn-based conversation with the Voice Agent Service.

The persona and the learned memory live server-side: the device connects to a
session voice URL that ``companion open`` already opened with them loaded. So this
brick only needs the URL (+ a Cloudflare Access token if the service is gated).

Lifecycle: sleep until the wake word fires, run one conversation (a few turns
until the user goes quiet), then call ``on_sleep`` to return to wake-word standby.
"""

import asyncio
import os
import threading
from typing import Callable

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


@brick
class VoiceRealtime:
    """Runs the wake ↔ conversation loop in a dedicated daemon thread."""

    def __init__(self):
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False
        self._wake_event: threading.Event | None = None
        self._on_sleep: Callable | None = None
        self._idle_timeout = float(os.getenv("PIPELINE_SLEEP_TIMEOUT", "45"))

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
            self._loop.close()

    async def _run(self):
        session = self._build_session()
        while True:
            if self._wake_event is not None:
                logger.info("Sleeping — waiting for the wake word.")
                await asyncio.get_event_loop().run_in_executor(None, self._wake_event.wait)
                self._wake_event.clear()
            await session.run_conversation()
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
            headers=_cf_access_headers(),
            output_rate=int(os.getenv("VA_OUTPUT_RATE", "24000")),
            idle_timeout=self._idle_timeout,
            silence_ms=int(os.getenv("SILENCE_MS", "1500")),
        )
