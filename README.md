# Health Companion — client

A **fully-local, voice-only** hormonal-health companion: a quiet voice in a small
home device for tracking symptoms over time, understanding what the body is doing,
and preparing for appointments.

Course: *Multimodal User Experience Design in Products* — SUPSI MAInD.

This repository is the **companion's identity and memory**. It owns:

- the **persona** — [`persona/system_prompt.txt`](persona/system_prompt.txt)
- the **learned memory** — an Obsidian-style note vault in [`memory/vault/`](memory/vault/)
- a **reference knowledge base** — [`memory/knowledge/`](memory/knowledge/)

It runs **no AI model itself**. All speech-to-text, language generation, text-to-
speech, and memory computation happen in a separate, reusable **Voice Agent
Service**. This project connects to that service, hands it the persona and memory,
and stores back whatever the companion learns. Personal health data never leaves
this project.

## Architecture

```
┌───────────────────────────┐   persona + memory bundle    ┌──────────────────────────┐
│  Health Companion (this)  │ ───── POST /v1/sessions ────▶ │   Voice Agent Service    │
│  • persona (system prompt)│ ◀──── SSE memory updates ──── │   STT · LLM · TTS ·      │
│  • memory vault  (owner)  │                               │   adaptive memory engine │
└───────────────────────────┘                               └──────────────────────────┘
              ▲                                                          ▲
              │ launches, pointed at the session's voice URL            │ PCM + events
              └────────────────  audio frontend (mic / Arduino)  ───────┘
```

- The **client** (this repo) is the source of truth for the persona and the memory.
  It uploads them when a session opens and writes back every learned change the
  service streams to it (Server-Sent Events), keeping `memory/vault/` in sync.
- The **Voice Agent Service** is a separate, domain-free project (`voice-agent-
  service`) that does the actual compute. It holds no persona and no personal data
  of its own. Run it co-located on the same machine for lowest latency.
- The **audio frontend** (the Arduino Uno Q, or the local mic client for testing)
  connects to the session's voice WebSocket URL.

> Why the split: the engine became reusable across projects, while the personal
> health data and the personality stay here. See the service's `docs/API.md` for
> the wire contract.

## Prerequisites

- The **Voice Agent Service** running and reachable (default
  `http://127.0.0.1:8080`). See its README; in short: `ollama pull gemma3n:e4b`,
  fetch its models, `voice-agent`.
- Python 3.11+ on the host for this client and the mic frontend.

## Install

```bash
pip install -e .                 # the client + the `companion` CLI
pip install -e ".[frontend]"     # + the local microphone frontend (sounddevice)
```

## Run

```bash
companion health      # check the service is up
companion run         # open a session and start the local mic frontend
companion open        # open a session for an external frontend (the Arduino),
                      #   print its voice URL, and keep memory in sync
companion wipe        # erase the personal memory (local + service)
```

`companion run` opens a session (uploading persona + memory and warming the model
in the background so the first reply is immediate), starts syncing learned memory
back into `memory/vault/`, and launches the terminal mic client. Per turn:

| Input | Action |
|-------|--------|
| `[Enter]` | push-to-talk: record until you press Enter again |
| `<type text>` + Enter | send text directly (skips speech-to-text) |
| `/reset` | clear the conversation history (never the memory) |
| `/quit` | end the session |

> **macOS microphone permission:** the first recording prompts your terminal app
> for mic access — grant it under *System Settings → Privacy & Security →
> Microphone*. List devices with `python scripts/mic_switcher.py --list-devices`.

## Run the headless client in Docker

The client can also run as a small container — the **headless owner of the persona
and memory**. It opens a session on the service, uploads persona + memory, and keeps
`memory/vault/` in sync with what the service learns (bind-mounted, so the learned
memory persists on the host). An external audio frontend (the Arduino) then connects
to the session's voice URL.

```bash
make docker-up        # build + start the container (detached)
make docker-logs      # follow logs — shows the session voice URL to point a frontend at
make docker-down      # stop + remove
```

`docker-compose.yml` mounts the persona (read-only), the knowledge base (read-only),
and the vault (read-write, the source of truth), and points
`COMPANION_SERVICE_URL` at `host.docker.internal:8080`. Run the Voice Agent Service
on the same host so the voice WebSocket stays local.

> **Why headless:** the microphone frontend is *not* containerised — a Linux
> container on macOS cannot reach the host microphone (CoreAudio). For the local mic
> demo, use `make run` on the host. The container is for the persona+memory role with
> an external audio device (e.g. the Arduino).

## Memory — adaptive Hebbian vault (owned here)

The companion keeps a persistent long-term memory as an **Obsidian-style vault** of
linked markdown notes (`memory/vault/*.md`) — one note per concept (a symptom, the
therapy, a preference, a pattern), with weighted **Hebbian** links that strengthen
when memories are used together and fade when they are not.

The **engine** for this (lexical recall, spreading activation, the background LLM
that distils a turn into notes, link reinforcement and decay) lives in the Voice
Agent Service. The **data** lives here: when the service learns something, it streams
the changed note files back and this client writes them to `memory/vault/`
verbatim. A note:

```markdown
---
id: hot-flashes
type: symptom
aliases: [hot flash, night sweats]
links: [menopause-hrt:0.820, sleep:0.450]
---
Reports hot flashes at night, three cycles in a row.

Related: [[menopause-hrt]] [[sleep]]
```

> The vault holds personal health data and is **git-ignored** — only an empty
> `memory/vault/.gitkeep` is tracked. `/reset` clears the conversation, never the
> vault; the vault survives restarts.

## Configuration

All settings are environment variables (see [.env.example](.env.example)); the
defaults assume the service is on `localhost`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `COMPANION_SERVICE_URL` | `http://127.0.0.1:8080` | the Voice Agent Service |
| `COMPANION_PROFILE_TYPES` | `therapy,preference` | note types always surfaced as context |
| `COMPANION_PERSONA_PATH` | `./persona/system_prompt.txt` | the persona |
| `COMPANION_VAULT_DIR` | `./memory/vault` | the learned memory |
| `COMPANION_KNOWLEDGE_DIR` | `./memory/knowledge` | reference notes |

## License

© 2026 Mattia Piatti. Released under **CC BY-NC-SA 4.0**.
