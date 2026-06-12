"""Connector to the external Voice Agent Service.

Responsibilities, and only these — the client is deliberately thin:

* **Bundle** the persona and the memory vault files and open a session.
* **Persist** learned-memory updates streamed back over Server-Sent-Events, writing
  each changed note file verbatim and deleting removed ones (atomically). The memory
  markdown is opaque here: the service owns the format, the client only stores bytes.
* **Close** the session, doing a final persist from the returned snapshot.

The audio frontend (mic client / Arduino) connects separately to the session's
voice WebSocket URL, which :meth:`open` returns.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import httpx

from .config import Settings, settings

log = logging.getLogger("companion.connector")


def _read_notes(directory: Path) -> list[dict]:
    """Read every ``*.md`` in a vault directory as ``{name, text}`` (skip AppleDouble)."""
    notes: list[dict] = []
    if not directory.exists():
        return notes
    for path in sorted(directory.glob("*.md")):
        if path.name.startswith("._"):
            continue
        try:
            notes.append({"name": path.name, "text": path.read_text(encoding="utf-8")})
        except OSError as e:
            log.warning("cannot read %s: %s", path, e)
    return notes


class Connector:
    def __init__(self, cfg: Settings | None = None) -> None:
        self._cfg = cfg or settings
        self._base = self._cfg.service_url.rstrip("/")
        self.session_id: str | None = None
        self.voice_ws_url: str | None = None
        self._memory_sse_path: str | None = None

    # -- bundle ------------------------------------------------------------- #

    def _persona(self) -> str:
        return self._cfg.persona_path.read_text(encoding="utf-8")

    def _bundle(self) -> dict:
        return {
            "vault": _read_notes(self._cfg.vault_dir),
            "knowledge": _read_notes(self._cfg.knowledge_dir),
        }

    # -- lifecycle ---------------------------------------------------------- #

    def open(self, warmup: bool = True) -> dict:
        """Open a session: upload persona + memory, return the session info."""
        bundle = self._bundle()
        profile_types = [t.strip() for t in self._cfg.profile_types.split(",") if t.strip()]
        body = {
            "persona": self._persona(),
            "memory": bundle,
            "memory_config": {"profile_types": profile_types},
            "warmup": warmup,
        }
        r = httpx.post(
            f"{self._base}/v1/sessions", json=body, timeout=self._cfg.request_timeout
        )
        r.raise_for_status()
        info = r.json()
        self.session_id = info["session_id"]
        self._memory_sse_path = info["memory_sse"]
        self.voice_ws_url = self._ws_url(info["voice_ws"])
        log.info(
            "session %s opened (%d vault notes uploaded, warm=%s)",
            self.session_id,
            len(bundle["vault"]),
            info.get("warm"),
        )
        return info

    def close(self) -> None:
        """Close the session and do a final persist from the returned snapshot."""
        if not self.session_id:
            return
        try:
            r = httpx.delete(
                f"{self._base}/v1/sessions/{self.session_id}",
                timeout=self._cfg.request_timeout,
            )
            r.raise_for_status()
            snap = r.json()
            self._persist(snap.get("vault", []), [])
            log.info("session %s closed (final revision %s)", self.session_id, snap.get("revision"))
        except httpx.HTTPError as e:
            log.warning("close failed: %s", e)
        finally:
            self.session_id = None

    def wipe(self) -> None:
        """Erase the personal memory on the service (and locally via the next stream)."""
        if not self.session_id:
            return
        httpx.post(
            f"{self._base}/v1/sessions/{self.session_id}/wipe", timeout=self._cfg.request_timeout
        ).raise_for_status()

    # -- memory sync (SSE) -------------------------------------------------- #

    def sync_memory(self, stop: object | None = None) -> None:
        """Stream learned-memory updates and persist them. Blocks until disconnect.

        Run this in a background thread for the life of the session. ``stop`` is an
        optional ``threading.Event``; when set, the loop exits at the next event.
        """
        if not (self.session_id and self._memory_sse_path):
            raise RuntimeError("open() must be called first")
        url = f"{self._base}{self._memory_sse_path}"
        log.info("memory sync: streaming from %s", url)
        try:
            with httpx.stream("GET", url, timeout=None) as r:
                r.raise_for_status()
                event = None
                for line in r.iter_lines():
                    if stop is not None and getattr(stop, "is_set", lambda: False)():
                        break
                    if line.startswith(":"):  # SSE comment / keepalive
                        continue
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:"):
                        if event == "memory_update":
                            self._apply(json.loads(line[5:].strip()))
                    elif line == "":
                        event = None
        except httpx.HTTPError as e:
            log.warning("memory sync ended: %s", e)

    def _apply(self, delta: dict) -> None:
        changed = delta.get("changed", [])
        removed = delta.get("removed", [])
        self._persist(changed, removed)
        log.info(
            "memory rev %s persisted (%d written, %d removed)",
            delta.get("revision"),
            len(changed),
            len(removed),
        )

    # -- disk --------------------------------------------------------------- #

    def _persist(self, changed: list[dict], removed: list[str]) -> None:
        vault = self._cfg.vault_dir
        vault.mkdir(parents=True, exist_ok=True)
        for note in changed:
            name = os.path.basename(note.get("name", ""))
            if not name.endswith(".md"):
                continue
            path = vault / name
            tmp = path.with_suffix(".md.tmp")
            tmp.write_text(note.get("text", ""), encoding="utf-8")
            os.replace(tmp, path)
        for name in removed:
            name = os.path.basename(name)
            if name.endswith(".md"):
                (vault / name).unlink(missing_ok=True)

    # -- helpers ------------------------------------------------------------ #

    def _ws_url(self, path: str) -> str:
        """Build the voice WebSocket URL from the service base + a path."""
        parts = urlparse(self._base)
        scheme = "wss" if parts.scheme == "https" else "ws"
        return urlunparse((scheme, parts.netloc, path, "", "", ""))
