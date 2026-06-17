"""Turn-based voice session — mirrors ``scripts/mic_switcher.py`` from the companion
repo, adapted for the device.

One conversation = a sequence of turns. Each turn:
  1. a short beep, then record the user's utterance (VAD decides when they stop),
  2. a short beep, then send the raw PCM followed by ``{"event":"eou"}``,
  3. stream the reply back and play it (transcript / sentences / audio / speaking_end).
After a stretch of silence (nobody speaks) the conversation ends and the caller
returns to wake-word standby. The ring LED reflects the state via the MCU.

This is deliberately linear and synchronous-feeling — exactly how the Mac
stand-in handled turns — not a continuous full-duplex stream.
"""

import asyncio
import json
import math
import os
import struct
import subprocess

from arduino.app_utils import Logger

from .audio import AudioCapture, AudioPlayback, VADConfig, VoiceActivityDetector
from .audio.playback import find_usb_playback_device

logger = Logger("voice-session")

try:
    import mcu as _mcu
except ImportError:  # running off-device
    _mcu = None

# Ring/matrix light states — must match sketch/sketch.ino.
LIGHT_IDLE, LIGHT_WAKE, LIGHT_SPEAK, LIGHT_LISTEN = 0, 1, 2, 3
LIGHT_USER_TALKING, LIGHT_THINKING = 5, 6

BEEP_SR = 24000
BEEP_START_HZ = 988  # higher tone = "recording started, speak now"
BEEP_STOP_HZ = 587   # lower tone  = "recording stopped, thinking"


class VoiceSession:
    def __init__(
        self,
        url: str,
        headers: dict | None = None,
        capture_rate: int = 16000,
        output_rate: int = 24000,
        idle_timeout: float = 45.0,
        silence_ms: int = 800,
    ) -> None:
        self._url = url
        self._headers = headers or None
        self._cr = capture_rate
        self._out_sr = output_rate
        self._idle_timeout = idle_timeout
        self._vad = VoiceActivityDetector(
            VADConfig(silence_ms=silence_ms, min_speech_ms=300, max_speech_ms=15000, chunk_ms=40)
        )
        self._beeps = os.getenv("BEEP", "1") != "0"
        self._spk = find_usb_playback_device()

    # -- one conversation (N turns) ----------------------------------------- #

    async def run_conversation(self) -> None:
        _unmute(self._spk)  # so the beep + reply are audible
        # Beep + open the mic IMMEDIATELY, and connect to the server IN PARALLEL —
        # so the feedback tone fires the instant the wake word is detected, not
        # after the (1–2 s) WebSocket connect. The utterance takes a few seconds,
        # by which time the connection is ready.
        connect_task = asyncio.create_task(self._connect())
        pcm = await self._record_utterance()
        ws = await connect_task
        if ws is None:
            _light(LIGHT_IDLE)
            return
        try:
            if not pcm:
                logger.info("No speech — back to wake-word standby.")
            else:
                _light(LIGHT_THINKING)
                await ws.send(pcm)
                await ws.send(json.dumps({"event": "eou"}))
                await self._receive_and_play(ws)
                logger.info("Turn complete — back to wake-word standby.")
        except Exception as e:  # noqa: BLE001
            logger.error(f"session error: {e}")
        finally:
            try:
                await ws.close()
            except Exception:
                pass
            _voice(False)
            _level(0)
            _light(LIGHT_IDLE)

    async def _connect(self):
        """Open the voice WS and do the hello/ready handshake. Returns ws or None."""
        from websockets.asyncio.client import connect

        try:
            # ping_interval=None: a turn can keep the brain busy past the keepalive.
            ws = await connect(
                self._url, max_size=None, ping_interval=None, additional_headers=self._headers
            )
            await ws.send(json.dumps({"event": "hello", "input_sample_rate": self._cr}))
            ready = json.loads(await ws.recv())
            if ready.get("event") == "ready":
                self._out_sr = ready.get("output_sample_rate", self._out_sr)
            logger.info(f"Voice Agent Service connected (reply {self._out_sr} Hz)")
            return ws
        except Exception as e:  # noqa: BLE001
            logger.error(f"connect failed: {e}")
            return None

    # -- record one utterance with VAD -------------------------------------- #

    async def _record_utterance(self) -> bytes:
        # Beep BEFORE opening the mic so the tone isn't captured into the utterance.
        await self._beep(BEEP_START_HZ)

        mic = AudioCapture(sample_rate=self._cr)
        await mic.start()
        _voice(True)
        _light(LIGHT_LISTEN)

        frames: list[bytes] = []
        speech_chunks = silence_chunks = 0
        started = False
        waited = 0.0
        got_speech = False
        need_silence = self._vad.silence_chunks()
        need_speech = self._vad.min_speech_chunks()
        max_speech = self._vad.max_speech_chunks()
        try:
            while True:
                chunk = await mic.read_chunk(timeout=0.5)
                if not chunk:
                    if not started:  # nobody has started talking yet
                        waited += 0.5
                        if waited >= self._idle_timeout:
                            break
                    continue
                if self._vad.is_speech(chunk):
                    if not started:
                        _light(LIGHT_USER_TALKING)
                    started = True
                    speech_chunks += 1
                    silence_chunks = 0
                    frames.append(chunk)
                    _level(_peak(chunk))
                elif started:
                    silence_chunks += 1
                    frames.append(chunk)  # keep a little trailing silence
                if started and speech_chunks >= need_speech and silence_chunks >= need_silence:
                    got_speech = True
                    break
                if speech_chunks >= max_speech:
                    got_speech = True
                    break
        finally:
            await mic.stop()

        if not got_speech:
            return b""
        # Beep AFTER stopping the mic (so it isn't recorded) to mark "recording stopped".
        await self._beep(BEEP_STOP_HZ)
        return b"".join(frames)

    # -- stream the reply back and play it ---------------------------------- #

    async def _receive_and_play(self, ws) -> None:
        speaker: AudioPlayback | None = None
        try:
            while True:
                msg = await ws.recv()
                if isinstance(msg, (bytes, bytearray)):
                    if speaker is None:
                        speaker = AudioPlayback(sample_rate=self._out_sr)
                        await speaker.start()
                        _light(LIGHT_SPEAK)
                    await speaker.write(bytes(msg))
                    _level(_peak(msg))
                    continue
                data = json.loads(msg)
                event = data.get("event")
                if event == "transcript":
                    logger.info(f"you said: {data.get('text', '')!r}")
                elif event == "speaking_start":
                    sr = data.get("sample_rate")
                    if sr and speaker is None:
                        self._out_sr = sr
                elif event == "sentence":
                    logger.info(f"» {data.get('text', '')}")
                elif event == "error":
                    logger.error(f"brain error: {data.get('message')}")
                elif event == "speaking_end":
                    break
        finally:
            if speaker:
                await speaker.stop()
            _level(0)
            _light(LIGHT_LISTEN)

    # -- short feedback tone ------------------------------------------------ #

    async def _beep(self, freq_hz: int, ms: int = 120) -> None:
        if not self._beeps:
            return
        try:
            proc = await asyncio.create_subprocess_exec(
                "aplay", "-q", "-D", self._spk,
                "-f", "S16_LE", "-r", str(BEEP_SR), "-c", "1", "-t", "raw",
                stdin=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.communicate(_tone_pcm(freq_hz, ms))
        except Exception:  # noqa: BLE001 — a missing speaker must not break the turn
            pass


# -- helpers ---------------------------------------------------------------- #

def _tone_pcm(freq_hz: int, ms: int, sample_rate: int = BEEP_SR, vol: float = 0.3) -> bytes:
    n = int(sample_rate * ms / 1000)
    fade = max(1, int(sample_rate * 0.008))  # 8 ms fade in/out to avoid clicks
    out = bytearray()
    for i in range(n):
        amp = vol * math.sin(2 * math.pi * freq_hz * i / sample_rate)
        if i < fade:
            amp *= i / fade
        elif i >= n - fade:
            amp *= (n - i) / fade
        out += struct.pack("<h", int(amp * 32767))
    return bytes(out)


def _unmute(device: str) -> None:
    card = device.split(":")[1].split(",")[0] if ":" in device else "0"
    try:
        subprocess.run(["amixer", "-c", card, "sset", "PCM", "60%", "unmute"], capture_output=True)
    except Exception:
        pass


def _peak(pcm: bytes) -> int:
    n = len(pcm) // 2
    if n == 0:
        return 0
    samples = struct.unpack(f"<{n}h", pcm[: n * 2])
    return min(100, int(max(abs(s) for s in samples) / 32768 * 140))


def _light(state: int) -> None:
    if _mcu:
        try:
            _mcu.set_light_state(state)
        except Exception:
            pass


def _voice(active: bool) -> None:
    if _mcu:
        try:
            _mcu.set_voice_state(active)
        except Exception:
            pass


def _level(level: int) -> None:
    if _mcu:
        try:
            _mcu.set_audio_level(level)
        except Exception:
            pass
