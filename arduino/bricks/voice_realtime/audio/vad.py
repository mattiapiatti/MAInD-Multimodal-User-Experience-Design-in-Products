"""RMS-based voice activity detection."""

import struct
from dataclasses import dataclass


@dataclass
class VADConfig:
    threshold: int = 500
    silence_ms: int = 1200
    min_speech_ms: int = 500
    max_speech_ms: int = 15_000
    chunk_ms: int = 40


class VoiceActivityDetector:
    def __init__(self, config: VADConfig | None = None):
        self.cfg = config or VADConfig()

    @staticmethod
    def rms(pcm_bytes: bytes) -> int:
        count = len(pcm_bytes) // 2
        if count == 0:
            return 0
        shorts = struct.unpack(f"<{count}h", pcm_bytes)
        return int((sum(s * s for s in shorts) / count) ** 0.5)

    def silence_chunks(self) -> int:
        return max(1, self.cfg.silence_ms // self.cfg.chunk_ms)

    def min_speech_chunks(self) -> int:
        return max(1, self.cfg.min_speech_ms // self.cfg.chunk_ms)

    def max_speech_chunks(self) -> int:
        return self.cfg.max_speech_ms // self.cfg.chunk_ms

    def is_speech(self, pcm_bytes: bytes) -> bool:
        return self.rms(pcm_bytes) > self.cfg.threshold
