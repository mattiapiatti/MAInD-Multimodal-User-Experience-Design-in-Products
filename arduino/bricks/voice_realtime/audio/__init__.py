"""Audio I/O wrappers over ALSA plughw via subprocess pipes."""

from .capture import AudioCapture
from .playback import AudioPlayback
from .vad import VoiceActivityDetector, VADConfig
