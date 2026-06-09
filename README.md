# Voice assistant — local, voice-only travel companion

A **fully-local, voice-only** version of a local, no-name travel-companion AI. No web
UI, no cloud model, no external API. The whole language pipeline runs offline on
your machine inside a single OrbStack container.

Course: *Multimodal User Experience Design in Products* — SUPSI MAInD.

> Derived from the *Designing Intelligent Experiences* travel-companion service. The web
> frontend and the Gemini cloud fallback have been removed; only the local
> Ollama agent survives, wrapped in a voice pipeline.

---

## Architecture

The system splits into an **audio frontend** and a **brain**:

```
┌──────────────────────────┐        WebSocket        ┌───────────────────────────────┐
│  Arduino Uno Q (Linux)   │  ws://host:8765         │  OrbStack container ("brain") │
│  • wake word             │ ──── PCM audio ───────▶ │  • STT   faster-whisper       │
│  • microphone            │                         │  • LLM   Ollama (on host)     │
│  • speaker               │ ◀─── PCM audio ──────── │  • TTS   Kokoro               │
└──────────────────────────┘    + JSON events        └───────────────────────────────┘
```

- The **Arduino Uno Q** handles wake-word detection, microphone capture and
  speaker playback. A container on macOS cannot reach CoreAudio, so all audio
  I/O lives on the Arduino, which streams audio to the brain over a WebSocket.
- The **brain** (this repo) does speech-to-text, runs the local language model,
  and synthesises speech — streaming the reply back **sentence by sentence** so
  playback starts while the model is still generating.
- **Ollama** runs on the host Mac; the container reaches it through
  `host.docker.internal`. The Kokoro voice model and the Whisper model are baked
  into the image, so the container itself needs no network at runtime.

Everything that runs on the Mac runs inside OrbStack. The only host-side
dependency is Ollama (which serves the model and is reached over the local
network bridge).

---

## Components

| Stage | Engine | Notes |
|-------|--------|-------|
| Speech-to-text | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | `base.en`, int8, CPU |
| Language model | [Ollama](https://ollama.com) `gemma3n:e4b` | on the host, local-only, no fallback |
| Text-to-speech | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) | `kokoro-v1.0`, voice `af_heart`, 24 kHz, offline on CPU |
| Transport | WebSocket (`websockets`) | binary PCM + JSON control frames |

---

## Prerequisites

- **OrbStack** (or Docker Desktop) running on the host.
- **Ollama** running on the host with the model pulled:
  ```bash
  ollama serve &
  ollama pull gemma3n:e4b
  ```
  The container reaches it via `host.docker.internal` (OrbStack maps it
  automatically).

No cloud API key is required — there is no cloud backend.

## Run

```bash
make up           # build + start in the foreground
make start        # build + start detached
make logs         # follow logs
make ps           # container + health status
make restart      # restart (clears conversation history)
make down         # stop + remove
make rebuild      # full rebuild, no cache
make shell        # shell inside the container
make health       # check the websocket port is open
```

The first build downloads the Kokoro voice model and the Whisper model and bakes
them into the image, so it takes a few minutes. After that the brain listens on
`ws://127.0.0.1:8765`.

> The `make` targets scrub macOS `._*` AppleDouble files before each Docker
> invocation — BuildKit reads their xattrs before applying `.dockerignore` and
> aborts on volumes (like `/Volumes/ARCHIVE`) that don't support them.

## Test on the Mac without the Arduino — terminal switcher

`scripts/mic_switcher.py` is a terminal client that stands in for the Arduino:
it captures the Mac microphone, streams the utterance to the brain, and plays the
reply through the speakers. It runs **on the host** (not in the container) — a
Linux container on macOS can't reach CoreAudio — inside an isolated venv under
`$HOME`.

```bash
make switcher           # creates the venv on first run, then starts the switcher
make switcher-devices   # list host microphone / speaker indices
```

Per turn you switch input mode:

| Input | Action |
|-------|--------|
| `[Enter]` | push-to-talk: record from the mic until you press Enter again |
| `<type text>` + Enter | send text directly (skips speech-to-text) |
| `/reset` | clear the conversation history |
| `/quit` | exit |

> **macOS microphone permission:** the first recording will prompt your terminal
> app (Terminal / iTerm / VS Code) for microphone access — grant it under
> *System Settings → Privacy & Security → Microphone*. Pick a specific device
> with `--input-device N` / `--output-device N` (see `make switcher-devices`).

### Headless checks

Send a text turn (skips STT) and write the spoken reply to `reply.wav` in the
container:

```bash
make say TEXT="my night bus just got cancelled in rural Vietnam, it's 2am"
```

Or push a recorded WAV through the full STT → LLM → TTS path:

```bash
python scripts/ws_test_client.py --wav utterance.wav --out reply.wav
```

---

## WebSocket protocol

Binary frames carry raw **little-endian 16-bit mono PCM**. Text frames are JSON
control messages keyed by `event`.

**Client → server**

| Message | Meaning |
|---------|---------|
| `{"event":"hello","input_sample_rate":16000}` | optional handshake; declares the mic sample rate |
| *(binary frames)* | the captured utterance, one or more PCM frames |
| `{"event":"eou"}` | end of utterance → transcribe + reply |
| `{"event":"text","content":"…"}` | skip STT, treat text as the turn (testing) |
| `{"event":"reset"}` | clear conversation history |

**Server → client**

| Message | Meaning |
|---------|---------|
| `{"event":"ready","output_sample_rate":N,"version":"…"}` | after `hello` |
| `{"event":"transcript","text":"…"}` | what the user said |
| `{"event":"speaking_start","sample_rate":N}` | reply audio is about to stream |
| *(binary frames)* | reply audio, streamed per sentence |
| `{"event":"sentence","text":"…"}` | text of each spoken sentence |
| `{"event":"speaking_end"}` | reply finished |
| `{"event":"error","message":"…"}` | something failed |

A typical turn from the Arduino: send `hello` once, then per utterance stream
the PCM frames, send `eou`, and play back every binary frame received until
`speaking_end`.

---

## Memory — adaptive Hebbian vault

The companion keeps a real, persistent long-term memory: an **Obsidian-style vault**
of linked markdown notes (`memory/vault/*.md`), one note per concept (a symptom, the
therapy, a preference, a pattern). The links between notes form a **Hebbian
network** — weighted associations that strengthen when memories are used together and
fade when they are not. No embeddings, no cloud, no extra model: it reuses the same
local Ollama, and the vault is plain files you can open directly in Obsidian.

```
                 read path (no LLM, ~instant)
utterance ──lexical seed──▶ fired notes ──spreading activation──▶ recalled context
                                                                    │ prepended to the prompt
                                                                    ▼
                                                                  reply  ── spoken ──▶
                 write path (local LLM, in the background, after the reply)
reply ──▶ extract durable facts ──▶ upsert notes ──▶ reinforce co-active links ──▶ decay unused
```

- **Read** is pure in-memory graph work (lexical match + spreading activation), so it
  adds no latency to speech.
- **Write** runs *after* the reply is spoken, in a background thread, so the one local
  LLM call that distils the turn into notes never delays the voice loop.
- **`reset` clears only the short conversation, never the vault.** Memory survives
  `make restart` and rebuilds (the vault is a host bind-mount).

Each note carries its Hebbian edges in the frontmatter and renders them as Obsidian
`[[wikilinks]]`:

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
> `memory/vault/.gitkeep` is tracked.

---

## Configuration

All settings come from environment variables (see [.env.example](.env.example)).
The defaults assume OrbStack + host Ollama and need no changes.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_URL` | `http://host.docker.internal:11434` | host Ollama endpoint |
| `VOICEBOT_LOCAL_MODEL` | `gemma3n:e4b` | Ollama model |
| `VOICEBOT_WHISPER_MODEL` | `base.en` | STT model (must match the image build arg) |
| `VOICEBOT_KOKORO_VOICE` | `af_heart` | Kokoro voice id (see VOICES.md) |
| `VOICEBOT_KOKORO_SPEED` | `1.0` | speaking-rate multiplier |
| `VOICEBOT_WS_PORT` | `8765` | WebSocket port |
| `VOICEBOT_MAX_TOKENS` | `220` | reply length cap (kept short for spoken replies) |
| `VOICEBOT_LOG_JSON` | `false` | structured JSON logs |
| `VOICEBOT_MEMORY_ENABLED` | `true` | enable the adaptive Hebbian memory |
| `VOICEBOT_MEMORY_VAULT_PATH` | `/app/memory/vault` | note vault location (bind-mounted) |
| `VOICEBOT_MEMORY_ETA` | `0.3` | Hebbian learning rate (link strengthening) |
| `VOICEBOT_MEMORY_DECAY_TAU_DAYS` | `30` | forgetting time constant for unused links |

The remaining `VOICEBOT_MEMORY_*` knobs (recall breadth, spreading-activation
damping, prune/display floors) are listed in [.env.example](.env.example).

To use a different Whisper model, set both the compose build arg
`WHISPER_MODEL` (so it is baked into the image) and `VOICEBOT_WHISPER_MODEL`.

---

## Development

Run the brain outside Docker (Linux, or the Arduino's Linux side):

```bash
pip install -e .
bash scripts/download_models.sh        # fetch the Kokoro model + voices into models/
voicebot                            # listens on ws://0.0.0.0:8765
```

Tests:

```bash
pip install -e ".[dev]"
pytest
```

`tests/test_text.py` runs with no heavy dependencies; `tests/test_audio.py`
needs numpy + websockets and is skipped otherwise.

---

## License

© 2026 Mattia Piatti. Released under **CC BY-NC-SA 4.0**.
