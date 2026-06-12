# Health Companion client — headless persona + memory owner.
#
# This container runs no model and no audio. It opens a session on the external
# Voice Agent Service, uploads the persona + memory, and keeps the memory vault in
# sync with what the service learns (written back to the bind-mounted vault). An
# external audio frontend (the Arduino) connects to the session's voice URL printed
# in the logs.
#
# The local microphone frontend (`companion run`) is NOT containerised: a Linux
# container on macOS cannot reach the host microphone (CoreAudio). For the mic demo,
# run it on the host with `make run`.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    COMPANION_SERVICE_URL=http://host.docker.internal:8080 \
    COMPANION_VAULT_DIR=/app/memory/vault \
    COMPANION_KNOWLEDGE_DIR=/app/memory/knowledge \
    COMPANION_PERSONA_PATH=/app/persona/system_prompt.txt

RUN useradd --create-home --uid 10001 companion
WORKDIR /app

# Client deps only (httpx + pydantic); no audio/frontend extras in the container.
COPY pyproject.toml README.md ./
COPY src ./src
COPY persona ./persona
RUN pip install . && chown -R companion:companion /app

USER companion

# Liveness: the external Voice Agent Service is reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD companion health || exit 1

# Own persona + memory, open a session, keep memory synced for an external frontend.
CMD ["companion", "open"]
