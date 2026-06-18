"""
Health-companion voice device — Linux (MPU) orchestration for the Arduino Uno Q.

  1. Listen for the wake word "hey kay" with sherpa-onnx KWS (offline, Linux core).
  2. Release the wake-word microphone.
  3. Run a turn-based conversation with the Voice Agent Service (voice_realtime brick).
  4. Return to wake-word standby after the user goes quiet.

The ring LED / button live on the MCU and are driven over the bridge (see mcu.py).
"""

import os
import re
import shutil
import subprocess
import threading
import time

import mcu
from sherpa_wake import SherpaWakeWord
from voice_realtime import VoiceRealtime

try:
    from dotenv import load_dotenv

    for candidate in ("/app/.env", ".env", os.path.expanduser("~/.env")):
        if os.path.isfile(candidate):
            load_dotenv(candidate)
            break
except ImportError:
    pass

from arduino.app_utils import App, Logger

logger = Logger("companion")

WAKE_WORD_PHRASE = os.getenv("WAKE_WORD_PHRASE", "hey kay")
WAKE_WORD_DEBOUNCE_SEC = float(os.getenv("WAKE_WORD_DEBOUNCE_SEC", "3.0"))
WAKE_WORD_POST_SILENCE_SEC = float(os.getenv("WAKE_WORD_POST_SILENCE_SEC", "0.0"))
# ignore detections right after (re)starting the listener (avoids warmup false-fires)
WAKE_WORD_WARMUP_SEC = float(os.getenv("WAKE_WORD_WARMUP_SEC", "0.8"))

# States (github.com/g10rg10/state-hormones) — must match sketch.ino / session.py.
S_OFF, S_A2_WAKE, S_IDLE, S_WAKEWORD = 0, 1, 2, 10

# Press the physical button to start/stop. Period between MCU button polls (only
# while idle, so the poll can't collide with a ring show() on the serial bridge).
BUTTON_POLL_SEC = float(os.getenv("BUTTON_POLL_SEC", "0.09"))

_wake_event = threading.Event()
_spotter: SherpaWakeWord | None = None
_spotter_started = False
_wake_enabled = False
_wake_pending = False
_wake_started_at = 0.0
# Single source of truth: a conversation owns the mic. While it's True the wake
# listener must NOT run (two arecords on the shared device => "busy" => crash).
_state_lock = threading.Lock()
_session_active = False
# The button toggles this. Until it's True the wake word is NOT listening and the
# halo is off; a press arms listening + lights the halo, another press turns it off.
_listening_active = False


def _ensure_audio_tools():
    if shutil.which("arecord") and shutil.which("aplay"):
        return
    logger.warning("arecord/aplay missing. Install alsa-utils on the board.")


def _find_capture_only_mic() -> str | None:
    """Prefer a USB microphone that has capture but no playback."""
    try:
        out = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=3).stdout
        pattern = re.compile(r"^card\s+\d+:\s+(\S+)\s.*?device\s+\d+:\s+([^\[]+)\[")
        for line in out.splitlines():
            match = pattern.match(line)
            if not match or "USB Audio" not in match.group(2):
                continue
            card_id = match.group(1)
            for index in range(8):
                try:
                    with open(f"/proc/asound/card{index}/id") as f:
                        if f.read().strip() != card_id:
                            continue
                    with open(f"/proc/asound/card{index}/stream0") as f:
                        stream = f.read()
                    if "Capture:" in stream and "Playback:" not in stream:
                        return f"plughw:CARD={card_id},DEV=0"
                except FileNotFoundError:
                    continue
    except Exception:
        pass
    return None


def _create_spotter():
    mic_device = os.getenv("WAKE_WORD_MIC", "").strip() or _find_capture_only_mic()
    logger.info(f"Wake-word mic: {mic_device or 'default'}")
    engine = os.getenv("WAKE_ENGINE", "sherpa").strip().lower()

    if engine == "ei":
        # Custom Edge Impulse keyword-spotting model (.eim) — run by us with the
        # same native capture used for the training clips. See ei_wake.py.
        from ei_wake import EiWakeWord

        label = os.getenv("WAKE_WORD_LABEL", "hey_kay")
        spotter = EiWakeWord(label=label, mic_device=mic_device, debounce_sec=WAKE_WORD_DEBOUNCE_SEC)
        spotter.on_detect(_on_wake_word)
        logger.info(f"Wake engine: ei  label: '{label}'")
        return spotter

    spotter = SherpaWakeWord(
        phrase=WAKE_WORD_PHRASE,
        mic_device=mic_device,
        debounce_sec=WAKE_WORD_DEBOUNCE_SEC,
    )
    spotter.on_detect(_on_wake_word)
    logger.info(f"Wake engine: sherpa  phrase: '{WAKE_WORD_PHRASE}'")
    return spotter


def _start_wake_word():
    global _spotter, _spotter_started, _wake_enabled, _wake_started_at, _wake_pending
    with _state_lock:
        if _session_active or not _listening_active:
            # A conversation owns the mic, or the button hasn't enabled listening:
            # never open a second arecord / never arm while "off".
            return
        if _spotter is None:
            _spotter = _create_spotter()
        _spotter.start()
        _spotter_started = True
        _wake_enabled = True
        _wake_pending = False  # clear any stale latch so a fresh arm can fire
        _wake_started_at = time.monotonic()
    mcu.set_wake_word_state(True)
    logger.info(f"Sleeping. Say '{WAKE_WORD_PHRASE}' to start.")


def _stop_wake_word():
    global _spotter_started, _wake_enabled
    _wake_enabled = False
    if not _spotter_started or _spotter is None:
        return
    try:
        _spotter.stop()
    finally:
        _spotter_started = False


def _release_wake_mic():
    """Free the mic so the conversation's capture can grab it."""
    mcu.set_wake_word_state(False)
    # Wake word heard → D2_wakeword: an attentive, cooler "your turn" halo that
    # the session then holds as B2_listening once the mic is open.
    mcu.set_light_state(S_WAKEWORD)
    try:
        _stop_wake_word()  # no sleep: the conversation's AudioCapture retries if busy
    except Exception as exc:
        logger.warning(f"Could not release the wake mic cleanly: {exc}")


def _restart_wake_word():
    # Reuse the SAME spotter (the KWS model stays loaded) so re-arm is instant
    # instead of taking ~7s to reload the onnx model each time.
    _stop_wake_word()
    threading.Timer(0.2, _start_wake_word).start()


def _wake_after_post_silence():
    global _wake_pending, _session_active
    with _state_lock:
        if not _wake_enabled or _session_active:
            _wake_pending = False
            return
        _wake_pending = False
        _session_active = True  # claim the mic before anything else can
    logger.info("Wake word accepted. Starting voice session.")
    _release_wake_mic()
    _wake_event.set()


def _on_wake_word():
    global _wake_pending
    with _state_lock:
        if _session_active or not _wake_enabled or _wake_pending:
            return
        if time.monotonic() - _wake_started_at < WAKE_WORD_WARMUP_SEC:
            return
        _wake_pending = True
    logger.info(f"Wake word detected. Waiting {WAKE_WORD_POST_SILENCE_SEC:.1f}s.")
    threading.Timer(WAKE_WORD_POST_SILENCE_SEC, _wake_after_post_silence).start()


def _on_pipeline_sleep():
    global _session_active
    logger.info("Voice session ended. Returning to wake-word standby.")
    with _state_lock:
        _session_active = False  # release the mic; the listener may run again
    # App._stop()-style teardown is blocking; restart the listener off the loop thread.
    threading.Thread(target=_restart_wake_word, daemon=True).start()


def _wake_watchdog():
    """The wake-listener thread can die silently (arecord EOF on a USB re-enumerate,
    or a classify error). When that happens the device goes deaf with no recovery.
    Poll the spotter and re-arm it if it has stopped while it should be listening."""
    while True:
        time.sleep(2.0)
        with _state_lock:
            armed = _wake_enabled and _spotter_started and not _session_active
            spotter = _spotter
        if not armed or spotter is None:
            continue
        thread = getattr(spotter, "_thread", None)
        if thread is not None and not thread.is_alive():
            logger.warning("Wake listener thread died — re-arming.")
            try:
                _restart_wake_word()
            except Exception as exc:  # noqa: BLE001
                logger.error(f"watchdog re-arm failed: {exc}")


def _set_active(active: bool):
    """Hold-to-listen: held → arm wake word + halo on; released → stop + halo off."""
    global _listening_active
    with _state_lock:
        if active == _listening_active:
            return
        _listening_active = active
    if active:
        logger.info("Button held → listening ON")
        _start_wake_word()           # arms the spotter (respects _listening_active)
        mcu.set_light_state(S_IDLE)  # halo on (idle glow)
    else:
        logger.info("Button released → listening OFF")
        _stop_wake_word()
        mcu.set_light_state(S_OFF)   # halo off


def _button_poll():
    """Poll the MCU button STATE and follow it: held = active, released = off.
    Only while idle (no conversation) so the request/response can't collide with a
    ring show() on the serial bridge."""
    last_held = False
    while True:
        time.sleep(BUTTON_POLL_SEC)
        if _session_active:
            continue  # ring is animating a turn — defer polling to avoid a collision
        state = mcu.get_button()  # 1 = held, 0 = released, None on a bridge hiccup
        if state is None:
            continue
        held = state == 1
        if held == last_held:
            continue
        last_held = held
        try:
            _set_active(held)
        except Exception as exc:  # noqa: BLE001
            logger.error(f"button handling failed: {exc}")


# ---- Boot ------------------------------------------------------------------

_ensure_audio_tools()

pipeline = VoiceRealtime()
pipeline.set_wake_mode(_wake_event, on_sleep=_on_pipeline_sleep)

# Start INACTIVE: halo off and NOT listening. Press the button to begin.
mcu.set_light_state(S_OFF)
threading.Thread(target=_wake_watchdog, name="wake-watchdog", daemon=True).start()
threading.Thread(target=_button_poll, name="button-poll", daemon=True).start()

App.run()
