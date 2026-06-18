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
from collections import deque

import numpy as np

from arduino.app_utils import Logger

from .audio import AudioCapture, AudioPlayback, VADConfig, VoiceActivityDetector
from .audio.playback import find_usb_playback_device

logger = Logger("voice-session")

try:
    import mcu as _mcu
except ImportError:  # running off-device
    _mcu = None

# States — github.com/g10rg10/state-hormones (Maind X spec). Must match the enum
# in sketch/sketch.ino. Faces go on a separate ESP32 over UART; on the Uno Q
# these drive the light halo (the ring) only.
S_OFF, S_WAKE, S_IDLE, S_CLOCK = 0, 1, 2, 3
S_SPEAKING, S_LISTENING, S_THINKING = 4, 5, 6
S_CONFIRM, S_DIDNT_CATCH, S_REMINDER, S_WAKEWORD = 7, 8, 9, 10
S_QUIRK, S_WINK = 11, 12

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
            VADConfig(
                threshold=int(os.getenv("VAD_THRESHOLD", "500")),  # absolute RMS floor
                silence_ms=silence_ms,
                min_speech_ms=int(os.getenv("VAD_MIN_SPEECH_MS", "300")),
                max_speech_ms=int(os.getenv("VAD_MAX_SPEECH_MS", "15000")),
                chunk_ms=40,
            )
        )
        # Adaptive end-of-turn: the onset threshold is the measured room noise floor
        # + VAD_DELTA. A fixed RMS threshold never works here — the native-48k capture
        # is loud and the ambient level varies per room, so a too-low floor means
        # silence is never seen and recording runs to max_speech.
        self._vad_delta = int(os.getenv("VAD_DELTA", "700"))
        self._vad_calib_chunks = int(os.getenv("VAD_CALIB_CHUNKS", "6"))  # ~240 ms of ambient
        self._vad_debug = os.getenv("VAD_DEBUG", "0") != "0"
        # arecord cold-start often returns a level ramp / garbage in the first reads —
        # discard a couple, and keep a short pre-roll so the sub-threshold onset of
        # the first word (which would otherwise be dropped) is recovered.
        self._warmup_chunks = int(os.getenv("CAPTURE_WARMUP_CHUNKS", "2"))
        self._preroll_chunks = int(os.getenv("CAPTURE_PREROLL_CHUNKS", "4"))
        # Per-utterance normalization: scale the captured speech to a consistent peak
        # so far/quiet speech is boosted and near/hot speech is tamed before the STT
        # (max_gain caps amplification so a near-silent turn isn't blown up into noise).
        self._norm_peak = float(os.getenv("AUDIO_NORMALIZE_PEAK", "0.85"))
        self._norm_max_gain = float(os.getenv("AUDIO_NORMALIZE_MAX_GAIN", "6.0"))
        self._beeps = os.getenv("BEEP", "1") != "0"
        self._spk = find_usb_playback_device()

    # -- one conversation (N turns) ----------------------------------------- #

    async def run_conversation(self) -> None:
        logger.info("Activating — opening mic.")
        # Kick the WebSocket connect off FIRST (before the blocking amixer unmute)
        # so it overlaps everything else; the utterance takes a few seconds, by
        # which time the connection + server-side STT warmup are ready.
        connect_task = asyncio.create_task(self._connect())
        _unmute(self._spk)  # so the beep + reply are audible
        ws = None
        try:
            # Beep + open the mic IMMEDIATELY so the feedback tone fires the instant
            # the wake word is accepted, not after the WebSocket connect.
            pcm = await self._record_utterance()
            ws = await connect_task
            if ws is None:
                logger.info("No connection — back to wake-word standby.")
            elif not pcm:
                logger.info("No speech — back to wake-word standby.")
                _light(S_DIDNT_CATCH)  # "didn't catch that" pulse
            else:
                _light(S_THINKING)
                await ws.send(pcm)
                await ws.send(json.dumps({"event": "eou"}))
                await self._receive_and_play(ws)
                logger.info("Turn complete — back to wake-word standby.")
        except Exception as e:  # noqa: BLE001
            logger.error(f"session error: {e}")
        finally:
            # Always close/cancel the WS (even if _record_utterance raised before we
            # awaited it) and reset every device indicator — no path may wedge.
            if ws is None and connect_task.done() and not connect_task.cancelled():
                ws = connect_task.result()  # a ws that opened while we errored out
            if ws is not None:
                try:
                    await ws.close()
                except Exception:
                    pass
            else:
                connect_task.cancel()
            _voice(False)
            _level(0)
            _light(S_IDLE)

    async def _connect(self):
        """Open the voice WS and do the hello/ready handshake. Returns ws or None."""
        from websockets.asyncio.client import connect

        ws = None
        try:
            # ping_interval=None: a turn can keep the brain busy past the keepalive.
            ws = await asyncio.wait_for(
                connect(self._url, max_size=None, ping_interval=None, additional_headers=self._headers),
                timeout=10,
            )
            await ws.send(json.dumps({"event": "hello", "input_sample_rate": self._cr}))
            # Bound the handshake: a server that accepts the upgrade but never sends
            # 'ready' must not wedge the whole loop.
            ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if ready.get("event") == "ready":
                self._out_sr = ready.get("output_sample_rate", self._out_sr)
            logger.info(f"Voice Agent Service connected (reply {self._out_sr} Hz)")
            return ws
        except Exception as e:  # noqa: BLE001
            logger.error(f"connect failed: {e}")
            if ws is not None:  # opened but handshake failed → don't leak it
                try:
                    await ws.close()
                except Exception:
                    pass
            return None

    # -- record one utterance with VAD -------------------------------------- #

    async def _record_utterance(self) -> bytes:
        # Beep BEFORE opening the mic so the tone isn't captured into the utterance.
        await self._beep(BEEP_START_HZ)

        mic = AudioCapture(sample_rate=self._cr)
        await mic.start()
        _voice(True)
        _light(S_LISTENING)  # the listen halo brightens with your voice (via _level)

        frames: list[bytes] = []
        preroll: deque[bytes] = deque(maxlen=self._preroll_chunks)
        speech_chunks = silence_chunks = 0
        started = False
        flushed = False
        got_speech = False
        warmup_left = self._warmup_chunks
        need_silence = self._vad.silence_chunks()
        need_speech = self._vad.min_speech_chunks()
        max_speech = self._vad.max_speech_chunks()

        # Calibrate the ambient noise floor from the first few quiet chunks, then
        # anything below floor + delta counts as silence. min() takes the quietest
        # reading (so a word between calib chunks doesn't poison it); the clamp keeps
        # a fully-loud calibration window from inflating the threshold for the turn.
        floor = float(self._vad.cfg.threshold)
        noise = floor
        noise_ceiling = floor * 8
        calib_left = self._vad_calib_chunks
        # Wall-clock bounds so the loop can NEVER spin forever: idle_timeout while
        # no one has started talking, and an absolute backstop that also covers the
        # "started but the end condition never triggers" case (brief blip + silence,
        # or audio that stays just under threshold). Uses the loop clock so it's
        # independent of whether reads return on timeout or instantly.
        loop = asyncio.get_event_loop()
        t0 = loop.time()
        hard_cap = self._idle_timeout + max_speech * 0.04 + 5.0
        try:
            while True:
                chunk = await mic.read_chunk(timeout=0.5)
                if chunk is None:  # capture stream ended (arecord died/EOF)
                    logger.warning("capture stream ended early")
                    break
                elapsed = loop.time() - t0
                if not started and elapsed >= self._idle_timeout:
                    break  # nobody spoke within the idle window
                if elapsed >= hard_cap:
                    logger.warning("recording hit the absolute time cap")
                    break
                if not chunk:  # timeout: no audio this tick
                    continue
                if warmup_left > 0:  # drop arecord cold-start ramp/garbage
                    warmup_left -= 1
                    continue
                rms = self._vad.rms(chunk)
                if not started and calib_left > 0:
                    noise = float(rms) if calib_left == self._vad_calib_chunks else min(noise, rms)
                    noise = min(noise, noise_ceiling)
                    calib_left -= 1
                thresh = max(floor, noise + self._vad_delta)
                is_speech = rms > thresh
                if self._vad_debug:
                    logger.info(f"vad rms={rms} peak={_peak(chunk)} noise={noise:.0f} thr={thresh:.0f} "
                                f"sp={speech_chunks} sil={silence_chunks} {'SPEAK' if is_speech else 'sil'}")
                if is_speech:
                    if not started and not flushed:
                        frames.extend(preroll)  # recover the sub-threshold word onset
                        flushed = True
                    started = True
                    speech_chunks += 1
                    silence_chunks = 0
                    frames.append(chunk)
                    _level(_peak(chunk))
                elif started:
                    silence_chunks += 1
                    frames.append(chunk)  # keep a little trailing silence
                else:
                    preroll.append(chunk)  # remember recent ambient for onset recovery
                if started and speech_chunks >= need_speech and silence_chunks >= need_silence:
                    got_speech = True
                    break
                if speech_chunks >= max_speech:
                    got_speech = True
                    break
        finally:
            await mic.stop()

        # If we broke out via a time cap but actually captured enough speech, still
        # send it rather than dropping the turn.
        if not got_speech and speech_chunks >= need_speech:
            got_speech = True
        if not got_speech:
            return b""
        # Beep AFTER stopping the mic (so it isn't recorded) to mark "recording stopped".
        await self._beep(BEEP_STOP_HZ)
        pcm, gain, peak = _normalize(b"".join(frames), self._norm_peak, self._norm_max_gain)
        if self._vad_debug:
            logger.info(f"captured {len(frames)} chunks (~{len(frames) * 40} ms), "
                        f"peak={peak} gain={gain:.2f} noise={noise:.0f}")
        return pcm

    # -- stream the reply back and play it ---------------------------------- #

    async def _receive_and_play(self, ws) -> None:
        speaker: AudioPlayback | None = None
        try:
            while True:
                # Bound each read: a half-open server (no FIN, common behind proxies)
                # must not block forever waiting for 'speaking_end'.
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=30)
                except asyncio.TimeoutError:
                    logger.warning("reply stream timed out — ending turn")
                    break
                if isinstance(msg, (bytes, bytearray)):
                    if speaker is None:
                        speaker = AudioPlayback(sample_rate=self._out_sr)
                        await speaker.start()
                        _light(S_SPEAKING)
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
            _light(S_IDLE)

    # -- short feedback tone ------------------------------------------------ #

    async def _beep(self, freq_hz: int, ms: int = 120) -> None:
        if not self._beeps:
            return
        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                "aplay", "-q", "-D", self._spk,
                "-f", "S16_LE", "-r", str(BEEP_SR), "-c", "1", "-t", "raw",
                stdin=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            )
            # Bound it: a wedged/contended speaker must never hang the turn.
            await asyncio.wait_for(proc.communicate(_tone_pcm(freq_hz, ms)), timeout=2.0)
        except Exception:  # noqa: BLE001 — a missing/stuck speaker must not break the turn
            if proc is not None and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass


# -- helpers ---------------------------------------------------------------- #

def _normalize(pcm: bytes, target_peak: float, max_gain: float):
    """Scale an utterance so its peak reaches target_peak*full-scale, capped at
    max_gain. Boosts far/quiet speech, leaves already-hot speech alone. Returns
    (pcm, applied_gain, original_peak)."""
    if not pcm or max_gain <= 1.0:
        return pcm, 1.0, 0
    x = np.frombuffer(pcm, dtype=np.int16)
    if x.size == 0:
        return pcm, 1.0, 0
    peak = int(np.max(np.abs(x.astype(np.int32))))
    if peak < 400:  # essentially silence — don't amplify noise
        return pcm, 1.0, peak
    gain = min(max_gain, (target_peak * 32767.0) / peak)
    if gain <= 1.01:  # already loud (or clipping) — leave as-is
        return pcm, 1.0, peak
    y = np.clip(x.astype(np.float32) * gain, -32768, 32767).astype(np.int16)
    return y.tobytes(), gain, peak


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
        subprocess.run(["amixer", "-c", card, "sset", "PCM", "60%", "unmute"],
                       capture_output=True, timeout=2)
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
