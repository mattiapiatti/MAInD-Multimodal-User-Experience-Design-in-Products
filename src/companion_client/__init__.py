"""Health Companion — client.

This project is the *owner* of the companion's personality and memory. It holds the
persona (system prompt) and the learned memory vault, and connects to an external
Voice Agent Service that does the actual speech, language, and memory computation.

The split keeps all personal health data here, in this project, while the reusable
engine lives in a separate, domain-free service. See ``README.md``.
"""

__version__ = "0.2.0"
