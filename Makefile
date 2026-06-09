# Voice assistant — OrbStack / Docker helpers.
#
# Every target first scrubs macOS AppleDouble (._*) files, which BuildKit reads
# before applying .dockerignore and chokes on when the build context lives on a
# volume without extended-attribute support (e.g. /Volumes/ARCHIVE).

COMPOSE ?= docker compose
SCRUB = find . -name '._*' -type f -delete 2>/dev/null || true

# Host-side virtualenv for the terminal switcher (runs on the Mac, not in Docker,
# because the container cannot reach the microphone). It lives under $HOME, not on
# the project volume — /Volumes/ARCHIVE spawns macOS AppleDouble (._*) files that
# crash pip's metadata scanner.
CLIENT_VENV = $(HOME)/.voicebot-client-venv
CLIENT_PY = $(CLIENT_VENV)/bin/python

.PHONY: up start logs ps restart down rebuild shell health say test scrub \
        switcher switcher-install switcher-devices

scrub:
	@$(SCRUB)

up: scrub            ## build + start in the foreground
	$(COMPOSE) up --build

start: scrub         ## build + start detached
	$(COMPOSE) up --build -d

logs:                ## follow logs
	$(COMPOSE) logs -f

ps:                  ## container + health status
	$(COMPOSE) ps

restart: scrub       ## restart the service (clears conversation history)
	$(COMPOSE) restart

down:                ## stop + remove
	$(COMPOSE) down

rebuild: scrub       ## full rebuild, no cache
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

shell:               ## a shell inside the running container
	$(COMPOSE) exec voicebot bash

health:              ## TCP probe of the websocket port
	@python3 -c "import socket; socket.create_connection(('127.0.0.1',8765),3); print('ws port open')"

# Send a text turn (skips STT) and report the streamed reply + audio. Useful to
# verify the LLM + TTS path without a microphone or the Arduino.
#   make say TEXT="my night bus just got cancelled in rural Vietnam, it's 2am"
say:
	$(COMPOSE) exec voicebot python scripts/ws_test_client.py --text "$(TEXT)"

# Send a recorded WAV file (mounted into the container) through the full
# STT -> LLM -> TTS path. Pass WAV=/path/to/file.wav (16-bit mono preferred).
test:
	$(COMPOSE) exec voicebot python scripts/ws_test_client.py --text "hello, can you hear me?"

# --- terminal switcher (runs on the Mac, talks to the container) -------------

# The venv is (re)built only when it is missing.
$(CLIENT_PY):
	python3 -m venv $(CLIENT_VENV)
	$(CLIENT_PY) -m pip install --quiet --upgrade pip
	$(CLIENT_PY) -m pip install --quiet -r scripts/requirements-client.txt
	@echo "client venv ready"

switcher-install: $(CLIENT_PY)   ## one-time: create host venv with the client deps

switcher: $(CLIENT_PY)           ## start the terminal voice switcher (Enter=talk, text=type)
	$(CLIENT_PY) scripts/mic_switcher.py

switcher-devices: $(CLIENT_PY)   ## list host audio input/output devices
	$(CLIENT_PY) scripts/mic_switcher.py --list-devices
