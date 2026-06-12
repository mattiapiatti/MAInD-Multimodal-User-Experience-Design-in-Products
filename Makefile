# Health Companion client — host-side helpers.
#
# This project runs no model: it owns the persona + memory and talks to an external
# Voice Agent Service. The client and its microphone frontend run on the host (the
# mic cannot be reached from a container on macOS), inside a venv under $HOME — the
# project volume (/Volumes/ARCHIVE) spawns macOS AppleDouble (._*) files that crash
# pip's metadata scanner.

CLIENT_VENV = $(HOME)/.companion-venv
CLIENT_PY = $(CLIENT_VENV)/bin/python
SERVICE_URL ?= http://127.0.0.1:8080

.PHONY: install run open wipe health devices clean

# Build the venv only when missing; install the client + the mic frontend extras.
$(CLIENT_PY):
	python3 -m venv $(CLIENT_VENV)
	$(CLIENT_PY) -m pip install --quiet --upgrade pip
	$(CLIENT_PY) -m pip install --quiet -e ".[frontend]"
	@echo "client venv ready"

install: $(CLIENT_PY)   ## one-time: create the host venv with client + frontend deps

run: $(CLIENT_PY)       ## open a session and start the local mic frontend
	$(CLIENT_PY) -m companion_client run

open: $(CLIENT_PY)      ## open a session for an external frontend (prints the voice URL)
	$(CLIENT_PY) -m companion_client open

wipe: $(CLIENT_PY)      ## erase the personal memory (local + service)
	$(CLIENT_PY) -m companion_client wipe

health: $(CLIENT_PY)    ## check the Voice Agent Service is reachable
	$(CLIENT_PY) -m companion_client health

devices: $(CLIENT_PY)   ## list host audio input/output devices
	$(CLIENT_PY) scripts/mic_switcher.py --list-devices

clean:                  ## remove the host venv
	rm -rf $(CLIENT_VENV)
