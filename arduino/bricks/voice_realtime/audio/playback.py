"""Speaker playback via an aplay stdin pipe."""

import asyncio
import shutil
import subprocess


def find_usb_playback_device() -> str:
    """Return the USB speaker (card with playback)."""
    try:
        out = subprocess.check_output(
            ["aplay", "-l"], stderr=subprocess.STDOUT, text=True, timeout=5
        )
        for line in out.splitlines():
            if line.startswith("card ") and "USB" in line:
                card = line.split(":")[0].replace("card ", "").strip()
                return f"plughw:{card},0"
    except Exception:
        pass
    return "plughw:0,0"


class AudioPlayback:
    """Async playback to ALSA device."""

    def __init__(self, device: str = None, sample_rate: int = 24000):
        self.device = device or find_usb_playback_device()
        self.sample_rate = sample_rate
        self._proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        if not shutil.which("aplay"):
            raise RuntimeError("aplay not found - install alsa-utils")

        # Unmute ALSA PCM hardware volume (starts at 0 on Q5+)
        card = self.device.split(":")[1].split(",")[0] if ":" in self.device else "0"
        subprocess.run(
            ["amixer", "-c", card, "sset", "PCM", "40%", "unmute"],
            capture_output=True,
        )

        from arduino.app_utils import Logger
        Logger("audio").info(f"Playback: {self.device} @ {self.sample_rate}Hz")

        self._proc = await asyncio.create_subprocess_exec(
            "aplay", "-D", self.device,
            "-f", "S16_LE", "-r", str(self.sample_rate), "-c", "1",
            "-t", "raw",
            "--buffer-time=40000", "--period-time=10000",  # 40ms buffer keeps matrix in sync
            stdin=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )

    async def write(self, pcm_bytes: bytes) -> None:
        if self._proc and self._proc.stdin:
            self._proc.stdin.write(pcm_bytes)
            await self._proc.stdin.drain()

    async def stop(self) -> None:
        if self._proc:
            if self._proc.stdin:
                self._proc.stdin.close()
            await self._proc.wait()
            self._proc = None
