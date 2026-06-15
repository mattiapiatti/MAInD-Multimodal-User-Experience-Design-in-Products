"""Command-line entry point for the Health Companion client.

    companion run        open a session and start the local mic frontend
    companion open       open a session, print the voice URL for an external
                         frontend (e.g. the Arduino), and keep memory in sync
    companion wipe       erase the personal memory (local + service)
    companion health     check the Voice Agent Service

The client uploads the persona + memory, keeps the local vault in sync with what
the service learns, and points the audio frontend at the session's voice URL.
"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import subprocess
import sys
import threading

import httpx

from .config import PROJECT_ROOT, settings
from .connector import Connector

log = logging.getLogger("companion")


def _setup_logging() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )


def _start_memory_sync(conn: Connector) -> tuple[threading.Thread, threading.Event]:
    stop = threading.Event()
    thread = threading.Thread(target=conn.sync_memory, args=(stop,), daemon=True)
    thread.start()
    return thread, stop


def cmd_run(args: argparse.Namespace) -> int:
    conn = Connector()
    info = conn.open(warmup=True)
    _, stop = _start_memory_sync(conn)
    print(f"session {conn.session_id} — model {'warm' if info.get('warm') else 'warming'}")
    print(f"voice  : {conn.voice_ws_url}")
    print("starting microphone frontend… (Ctrl-C to end)\n")
    mic = PROJECT_ROOT / "scripts" / "mic_switcher.py"
    # The voice WS sits behind Cloudflare Access too: hand the mic frontend the
    # service-token headers via the environment so it can set them on the handshake.
    mic_env = {**os.environ, **{f"CF_HEADER_{k}": v for k, v in conn.auth_headers.items()}}
    try:
        subprocess.run(
            [sys.executable, str(mic), "--url", conn.voice_ws_url],
            check=False,
            env=mic_env,
        )
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        conn.close()
    return 0


def cmd_open(args: argparse.Namespace) -> int:
    # Translate SIGTERM (e.g. `docker stop`) into the same clean shutdown as Ctrl-C.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    conn = Connector()
    info = conn.open(warmup=True)
    _, stop = _start_memory_sync(conn)
    print(f"session {conn.session_id} — model {'warm' if info.get('warm') else 'warming'}")
    print("Point your audio frontend at:")
    print(f"  {conn.voice_ws_url}")
    print("\nMemory is syncing to the local vault. Press Ctrl-C (or stop the container).")
    try:
        threading.Event().wait()  # block forever
    except KeyboardInterrupt:
        print()
    finally:
        stop.set()
        conn.close()
    return 0


def cmd_wipe(args: argparse.Namespace) -> int:
    conn = Connector()
    conn.open(warmup=False)
    _, stop = _start_memory_sync(conn)
    conn.wipe()
    print("personal memory wiped.")
    stop.set()
    conn.close()
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    try:
        r = httpx.get(
            f"{settings.service_url.rstrip('/')}/healthz",
            headers=settings.auth_headers(),
            timeout=5.0,
        )
        r.raise_for_status()
        print(r.json())
        return 0
    except httpx.HTTPError as e:
        print(f"service unreachable at {settings.service_url}: {e}", file=sys.stderr)
        return 1


def main() -> None:
    _setup_logging()
    p = argparse.ArgumentParser(prog="companion", description="Health Companion client")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="open a session and start the local mic frontend").set_defaults(
        func=cmd_run
    )
    sub.add_parser("open", help="open a session for an external audio frontend").set_defaults(
        func=cmd_open
    )
    sub.add_parser("wipe", help="erase the personal memory").set_defaults(func=cmd_wipe)
    sub.add_parser("health", help="check the Voice Agent Service").set_defaults(func=cmd_health)
    args = p.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
