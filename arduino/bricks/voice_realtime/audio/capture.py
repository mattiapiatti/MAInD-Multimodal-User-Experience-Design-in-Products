"""Microphone capture for the conversation turn.

We capture at the device's NATIVE rate (48 kHz) and downsample to 16 kHz in
software, then hand 16 kHz mono PCM to the rest of the pipeline (VAD + the server
whisper). This matters: on devices like the Denver Q5+, asking ``arecord`` for
16 kHz via ``plughw`` loses ~10x level (the audio reaches the server's whisper too
quiet to transcribe). Capturing native + resampling here keeps it loud and clean.

Output is always ``sample_rate`` (16 kHz) so nothing downstream changes.
"""

import asyncio
import os
import shutil
import subprocess

import numpy as np

SAMPLE_RATE = 16000
CAP_RATE = int(os.getenv("AUDIO_CAP_RATE", os.getenv("WAKE_WORD_CAP_RATE", "48000")))
BOOST = float(os.getenv("AUDIO_BOOST", "1.0"))  # native capture is already loud


def find_device() -> str:
    """Return the standalone mic (card with capture but NO playback)."""
    try:
        out_cap = subprocess.check_output(["arecord", "-l"], stderr=subprocess.STDOUT, text=True, timeout=5)
        out_pb = subprocess.check_output(["aplay", "-l"], stderr=subprocess.STDOUT, text=True, timeout=5)
        cap_cards, pb_cards = set(), set()
        for line in out_cap.splitlines():
            if line.startswith("card ") and "USB" in line:
                cap_cards.add(line.split(":")[0].replace("card ", "").strip())
        for line in out_pb.splitlines():
            if line.startswith("card ") and "USB" in line:
                pb_cards.add(line.split(":")[0].replace("card ", "").strip())
        mic_only = cap_cards - pb_cards
        if mic_only:
            return f"plughw:{sorted(mic_only)[0]},0"
        if cap_cards:
            return f"plughw:{sorted(cap_cards)[0]},0"
    except Exception:
        pass
    return "plughw:0,0"


class AudioCapture:
    def __init__(self, device: str = None, sample_rate: int = SAMPLE_RATE, channels: int = 1):
        env_device = (
            os.getenv("AUDIO_CAPTURE_DEVICE", "").strip()
            or os.getenv("WAKE_WORD_MIC", "").strip()
        )
        self.device = device or env_device or find_device()
        self.sample_rate = sample_rate          # output rate handed downstream
        self.cap_rate = CAP_RATE                 # what we ask the device for
        self.channels = channels
        self._factor = max(1, self.cap_rate // self.sample_rate)
        # read 40 ms at the capture rate, an exact multiple of the decimation factor
        self._cap_bytes = self._factor * int(self.sample_rate * 0.04) * channels * 2
        self._proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        if not shutil.which("arecord"):
            raise RuntimeError("arecord not found")
        from arduino.app_utils import Logger
        logger = Logger("audio")
        logger.info(f"Capture: {self.device} @ {self.cap_rate}->{self.sample_rate}Hz")
        # The wake-word spotter may still be releasing the shared ALSA device.
        # Poll tightly (50 ms) so we grab the mic the instant it frees up — at
        # 0.2s steps the first reopen alone could cost ~200 ms of dead air.
        attempts = 100  # ~5s at 0.05s each
        for attempt in range(attempts):
            self._proc = await asyncio.create_subprocess_exec(
                "arecord", "-D", self.device,
                "-f", "S16_LE", "-r", str(self.cap_rate), "-c", str(self.channels), "-t", "raw",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.sleep(0.05)
            if self._proc.returncode is None:
                return
            if attempt == 0:
                logger.info("Capture device busy, waiting for it to free up...")
            try:
                self._proc.kill()
                await self._proc.wait()
            except ProcessLookupError:
                pass
            self._proc = None
        raise RuntimeError(f"Could not open capture device {self.device} after {attempts} attempts")

    async def read_chunk(self, timeout: float = 1.0) -> bytes:
        try:
            raw = await asyncio.wait_for(
                self._proc.stdout.readexactly(self._cap_bytes), timeout=timeout
            )
        except (asyncio.TimeoutError, asyncio.IncompleteReadError):
            return b""
        x = np.frombuffer(raw, dtype=np.int16)
        if self.channels > 1:
            x = x.reshape(-1, self.channels).mean(axis=1)
        if self._factor > 1:  # average groups of `factor` samples -> downsample
            n = (len(x) // self._factor) * self._factor
            x = x[:n].astype(np.float32).reshape(-1, self._factor).mean(axis=1)
        x = x.astype(np.float32)
        if BOOST != 1.0:
            x *= BOOST
        return np.clip(x, -32768, 32767).astype(np.int16).tobytes()

    async def stop(self) -> None:
        if self._proc:
            self._proc.kill()
            await self._proc.wait()
            self._proc = None
