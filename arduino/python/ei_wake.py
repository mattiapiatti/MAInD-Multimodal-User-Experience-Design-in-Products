"""Wake word via a custom Edge Impulse keyword-spotting model (.eim).

We run the EI model ourselves through the ``edge_impulse_linux`` ImpulseRunner,
fed by the SAME native-48k -> 16k capture used to record the training clips — so
the runtime audio matches what the model was trained on (this matters: the Denver
Q5+ loses ~10x level via plughw@16k, which would never match the dataset).

The model is loaded ONCE and reused across wake cycles (instant re-arm). On each
~0.2 s of new audio we classify the most recent 1 s window; if the wake label's
probability passes ``EI_THRESHOLD`` we fire. Drop-in lifecycle matching
``SherpaWakeWord`` so ``main.py`` can pick the engine via ``WAKE_ENGINE``.
"""

from __future__ import annotations

import glob
import importlib.util
import os
import shutil
import subprocess
import sys
import threading
import time
from collections import deque

import numpy as np

from arduino.app_utils import Logger

logger = Logger("ei-wake")

_RUNNER_CLS = None


def _impulse_runner_cls():
    """Load edge_impulse_linux/runner.py directly — importing the package itself
    pulls in pyaudio (for its audio helper), which we don't have/need."""
    global _RUNNER_CLS
    if _RUNNER_CLS is not None:
        return _RUNNER_CLS
    paths: list[str] = []
    for p in sys.path:
        paths += glob.glob(os.path.join(p, "edge_impulse_linux", "runner.py"))
    if not paths:
        raise RuntimeError("edge_impulse_linux not installed")
    spec = importlib.util.spec_from_file_location("_ei_runner", paths[0])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["_ei_runner"] = mod
    spec.loader.exec_module(mod)
    _RUNNER_CLS = mod.ImpulseRunner
    return _RUNNER_CLS


def _default_model() -> str:
    app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(app_root, "models", "hey-kay.eim")


class EiWakeWord:
    def __init__(
        self,
        label: str = "hey_kay",
        model_path: str | None = None,
        mic_device: str | None = None,
        debounce_sec: float = 3.0,
    ) -> None:
        self._label = label
        self._model_path = model_path or os.getenv("EI_KEYWORD_SPOTTING_MODEL") or _default_model()
        self._mic_device = (mic_device or "").strip() or None
        self._sr = 16000
        self._cap_sr = int(os.getenv("WAKE_WORD_CAP_RATE", "48000"))
        self._win = 16000  # overwritten from the model's input_features_count
        self._threshold = float(os.getenv("EI_THRESHOLD", "0.6"))
        self._debounce = debounce_sec
        self._cb = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._proc: subprocess.Popen | None = None
        self._runner = None
        self._last_fire = 0.0

    def on_detect(self, callback) -> None:
        self._cb = callback

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="ei-wake", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._kill_arecord()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

    # -- internals ---------------------------------------------------------- #

    def _ensure_runner(self):
        if self._runner is not None:
            return self._runner
        runner = _impulse_runner_cls()(self._model_path)
        info = runner.init()
        mp = info.get("model_parameters", {})
        self._win = mp.get("input_features_count", self._win)
        logger.info(f"EI model loaded: labels={mp.get('labels')} window={self._win}")
        self._runner = runner
        return runner

    def _open_arecord(self) -> subprocess.Popen | None:
        if not shutil.which("arecord"):
            logger.error("arecord not found — install alsa-utils on the board")
            return None
        cmd = ["arecord", "-q", "-f", "S16_LE", "-r", str(self._cap_sr), "-c", "1", "-t", "raw"]
        if self._mic_device:
            cmd[1:1] = ["-D", self._mic_device]
        for attempt in range(25):  # ~5s — the conversation may still be releasing the mic
            if self._stop.is_set():
                return None
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            time.sleep(0.2)
            if proc.poll() is None:
                return proc
            if attempt == 0:
                logger.info("Wake mic busy, waiting for it to free up…")
        logger.error(f"Could not open capture device {self._mic_device or 'default'}")
        return None

    def _kill_arecord(self) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.kill()
                self._proc.wait(timeout=1)
            except Exception:
                pass
        self._proc = None

    def _fire(self, prob: float) -> None:
        now = time.monotonic()
        if now - self._last_fire < self._debounce:
            return
        self._last_fire = now
        logger.info(f"Wake phrase detected: '{self._label}' (p={prob:.2f})")
        if self._cb:
            try:
                self._cb()
            except Exception as e:  # noqa: BLE001
                logger.error(f"wake callback error: {e}")

    def _run(self) -> None:
        try:
            runner = self._ensure_runner()
        except Exception as e:  # noqa: BLE001
            logger.error(f"EI runner init failed: {e}")
            return
        self._proc = self._open_arecord()
        if not self._proc:
            return
        logger.info(f"EI wake listening for '{self._label}' on {self._mic_device or 'default'}")

        factor = max(1, self._cap_sr // self._sr)
        cap_bytes = int(self._cap_sr * 0.1) * 2  # 100 ms at the capture rate
        buf: deque = deque(maxlen=self._win)
        since = 0
        while not self._stop.is_set():
            data = self._proc.stdout.read(cap_bytes)
            if not data:
                break
            x = np.frombuffer(data, dtype=np.int16).astype(np.float32)
            if factor > 1:
                n = (len(x) // factor) * factor
                x = x[:n].reshape(-1, factor).mean(axis=1)
            buf.extend(x.tolist())
            since += len(x)
            if len(buf) >= self._win and since >= self._sr * 0.2:  # classify ~5x/sec
                since = 0
                try:
                    res = runner.classify(list(buf))
                    p = res["result"]["classification"].get(self._label, 0.0)
                except Exception as e:  # noqa: BLE001
                    logger.error(f"classify failed: {e}")
                    break
                if p >= self._threshold:
                    self._fire(p)
        self._kill_arecord()
