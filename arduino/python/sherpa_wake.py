"""Always-listening wake word via sherpa-onnx keyword spotting (k2-fsa).

Unlike full ASR (Vosk), this is a *dedicated* streaming keyword spotter: you give
it the phrase and it fires only on that phrase — far fewer false positives. It is
open source, fully offline, and ships an aarch64 wheel, so it runs on the Uno Q's
Linux core.

"Open vocabulary": the wake phrase needs no training. We encode it to the model's
BPE tokens at startup with the bundled ``bpe.model`` (e.g. "HEY KAY" -> "▁HE Y ▁K A Y")
and hand that to the spotter as a keyword.

We read the USB mic with ``arecord`` (same as before) and stream 16 kHz mono audio
into the spotter. Tune sensitivity with KWS_THRESHOLD / KWS_SCORE if needed.

Drop-in lifecycle (matches the old Vosk module, used by main.py):
    w = SherpaWakeWord(phrase="hey kay", mic_device="plughw:0,0")
    w.on_detect(callback)   # callback() — no args
    w.start()
    w.stop()
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tarfile
import threading
import time
import urllib.request

from arduino.app_utils import Logger

logger = Logger("sherpa-wake")

MODEL = "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"
MODEL_URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/{MODEL}.tar.bz2"
SAMPLE_RATE = 16000


def ensure_model(model_dir: str | None = None) -> str:
    """Return a local sherpa-onnx KWS model dir.

    Prefers a copy bundled with the app (``<app>/models/<MODEL>``) — the App Lab
    container often has no runtime internet, so we ship the model with the app.
    Falls back to a cache dir, then to a one-off download if the board can reach
    GitHub.
    """
    if model_dir and os.path.isdir(model_dir):
        return model_dir
    # bundled with the app (deployed alongside the code) — no runtime download.
    app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bundled = os.path.join(app_root, "models", MODEL)
    if os.path.isdir(bundled):
        logger.info(f"Using bundled KWS model at {bundled}")
        return bundled
    cache = os.path.expanduser(os.getenv("SHERPA_CACHE", "~/.cache/sherpa-onnx"))
    target = os.path.join(cache, MODEL)
    if os.path.isdir(target):
        return target
    os.makedirs(cache, exist_ok=True)
    tar_path = target + ".tar.bz2"
    logger.info(f"Downloading KWS model {MODEL} …")
    urllib.request.urlretrieve(MODEL_URL, tar_path)
    with tarfile.open(tar_path, "r:bz2") as t:
        t.extractall(cache)
    os.remove(tar_path)
    logger.info(f"KWS model ready at {target}")
    return target


def _find(model_dir: str, prefix: str) -> str:
    names = [n for n in os.listdir(model_dir) if n.startswith(prefix) and n.endswith(".onnx")]
    if not names:
        raise FileNotFoundError(f"{prefix}*.onnx not found in {model_dir}")
    # Prefer the int8 (quantised) model — lighter for an always-on KWS on the A53.
    int8 = [n for n in names if "int8" in n]
    return os.path.join(model_dir, (int8 or sorted(names))[0])


def _encode_keywords(model_dir: str, phrases: list[str]) -> str:
    """Encode each phrase to BPE tokens and write a sherpa keywords file."""
    import sentencepiece as spm

    sp = spm.SentencePieceProcessor()
    sp.load(os.path.join(model_dir, "bpe.model"))
    lines = []
    for phrase in phrases:
        tokens = sp.encode(phrase.upper(), out_type=str)
        # Canonical sherpa keyword line = just the BPE tokens. A trailing "@label"
        # must be space-free; a space makes sherpa parse the 2nd word as a token
        # ("Cannot find ID for token kay"), so we omit the label entirely.
        lines.append(" ".join(tokens))
    # Write to a writable dir — the bundled model dir may be read-only in the container.
    out_dir = os.path.expanduser(os.getenv("SHERPA_CACHE", "~/.cache/sherpa-onnx"))
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "wake_keywords.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    logger.info(f"Keywords: {lines}")
    return path


class SherpaWakeWord:
    def __init__(
        self,
        phrase: str = "hey kay",
        aliases: list[str] | None = None,
        model_dir: str | None = None,
        mic_device: str | None = None,
        sample_rate: int = SAMPLE_RATE,
        debounce_sec: float = 3.0,
    ) -> None:
        self._phrase = " ".join(phrase.lower().split())
        env_aliases = [a for a in os.getenv("WAKE_WORD_ALIASES", "").split(",") if a.strip()]
        extra = aliases or env_aliases or []
        self._phrases = [self._phrase] + [a.strip().lower() for a in extra if a.strip()]
        self._model_dir = model_dir or os.getenv("SHERPA_MODEL_DIR") or None
        self._mic_device = (mic_device or "").strip() or None
        self._sr = sample_rate
        # Capture at the device's native rate and let sherpa resample. Many USB
        # mics (e.g. the Denver Q5+, native 48 kHz) lose ~10x level when arecord
        # is asked for 16 kHz via plughw — capturing native and resampling in the
        # recognizer fixes it. Override with WAKE_WORD_CAP_RATE if needed.
        self._cap_sr = int(os.getenv("WAKE_WORD_CAP_RATE", "48000"))
        self._debounce = debounce_sec
        self._threshold = float(os.getenv("KWS_THRESHOLD", "0.25"))
        self._score = float(os.getenv("KWS_SCORE", "1.5"))
        self._cb = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._proc: subprocess.Popen | None = None
        self._last_fire = 0.0
        self._spotter = None  # cached KeywordSpotter — loaded once, reused on re-arm

    def on_detect(self, callback) -> None:
        self._cb = callback

    # -- lifecycle ---------------------------------------------------------- #

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="sherpa-wake", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._kill_arecord()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None

    # -- internals ---------------------------------------------------------- #

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

    def _fire(self, keyword: str) -> None:
        now = time.monotonic()
        if now - self._last_fire < self._debounce:
            return
        self._last_fire = now
        logger.info(f"Wake phrase detected: {keyword!r}")
        if self._cb:
            try:
                self._cb()
            except Exception as e:  # noqa: BLE001
                logger.error(f"wake callback error: {e}")

    def _ensure_spotter(self):
        """Build the KeywordSpotter once and cache it. Loading the onnx model takes
        ~2 s, so reusing it across wake cycles makes re-arm instant."""
        if self._spotter is not None:
            return self._spotter
        import sherpa_onnx

        model = ensure_model(self._model_dir)
        keywords_file = _encode_keywords(model, self._phrases)
        self._spotter = sherpa_onnx.KeywordSpotter(
            tokens=os.path.join(model, "tokens.txt"),
            encoder=_find(model, "encoder"),
            decoder=_find(model, "decoder"),
            joiner=_find(model, "joiner"),
            num_threads=2,
            keywords_file=keywords_file,
            keywords_threshold=self._threshold,
            keywords_score=self._score,
            provider="cpu",
        )
        return self._spotter

    def _run(self) -> None:
        import numpy as np

        try:
            spotter = self._ensure_spotter()
        except Exception as e:  # noqa: BLE001
            logger.error(f"sherpa-onnx init failed: {e}")
            return

        self._proc = self._open_arecord()
        if not self._proc:
            return
        logger.info(f"sherpa-onnx listening for '{self._phrase}' on {self._mic_device or 'default'}")

        stream = spotter.create_stream()
        frame = int(self._cap_sr * 0.1) * 2  # 100 ms of S16 mono at the capture rate
        while not self._stop.is_set():
            data = self._proc.stdout.read(frame)
            if not data:
                break
            samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            stream.accept_waveform(self._cap_sr, samples)  # sherpa resamples to 16 kHz
            while spotter.is_ready(stream):
                spotter.decode_stream(stream)
            result = spotter.get_result(stream)
            if result:
                self._fire(result)
                spotter.reset_stream(stream)
        self._kill_arecord()
