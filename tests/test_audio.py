"""Tests for the PCM/resampling helpers (run where numpy + websockets exist)."""

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("websockets")

from voicebot.config import WHISPER_SAMPLE_RATE
from voicebot.server import _pcm_to_whisper, _resample


def test_resample_changes_length_proportionally():
    x = np.zeros(16000, dtype=np.float32)
    out = _resample(x, 16000, 8000)
    assert abs(out.size - 8000) <= 1


def test_resample_is_identity_for_same_rate():
    x = np.linspace(-1, 1, 1000, dtype=np.float32)
    out = _resample(x, 16000, 16000)
    assert np.array_equal(out, x)


def test_pcm_to_whisper_normalises_and_targets_16k():
    # 200 ms of int16 silence at 48 kHz -> float32 at 16 kHz
    pcm = (np.zeros(9600, dtype=np.int16)).tobytes()
    audio = _pcm_to_whisper(pcm, 48000)
    assert audio.dtype == np.float32
    assert abs(audio.size - int(9600 * WHISPER_SAMPLE_RATE / 48000)) <= 1


def test_pcm_to_whisper_empty():
    assert _pcm_to_whisper(b"", 16000).size == 0
