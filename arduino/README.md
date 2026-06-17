# Health-companion device (Arduino Uno Q)

The physical voice device: an **Arduino App Lab** app for the Uno Q. The wake word
runs offline on the Linux core (sherpa-onnx keyword spotting), and the conversation
is streamed to the project's own **Voice Agent Service** (the same brain the
`companion` client uses). Persona + memory live server-side; the device only moves audio.

```
   🎙 mic ─▶ KWS wake word ─▶ voice_realtime brick ─▶ Voice Agent Service (WS)
   🔊 spkr ◀──────────────────────┘   ▲                     (PCM + events)
                                   MCU │ ring LED + button (RPClite over the bridge)
```

This is the canonical source. The App Lab app is **imported from this folder**.

## Layout

```
arduino/
  app.yaml                       App Lab manifest (one brick: voice_realtime)
  python/
    main.py                      wake loop + lifecycle (Linux/MPU side)
    sherpa_wake.py               offline sherpa-onnx keyword spotter ("hey kay")
    mcu.py                       MCU RPC (ring LED, RGB LEDs, audio level)
    requirements.txt
  bricks/voice_realtime/
    __init__.py                  the brick: sleep ↔ run a conversation on wake
    session.py                   turn-based session (record → eou → play reply)
    audio/                       ALSA capture / playback / VAD
  sketch/                        MCU sketch (NeoPixel 24 ring + LED matrix + button)
  .env.example
```

The turn handling mirrors the Mac stand-in `scripts/mic_switcher.py`: record one
utterance (VAD decides when you stop) → send PCM + `{"event":"eou"}` → stream the
reply back and play it → next turn, until you go quiet.

## Configure

Copy `.env.example` → `.env` (or set the vars in the App Lab config UI). The brain
needs a **live session URL**: on the memory-owner machine run `companion open` and
paste the printed `ws(s)://…/voice` into `VA_VOICE_WS_URL`, plus the Cloudflare
Access token. See [.env.example](.env.example) for every option.

## Deploy & run

Import this folder in App Lab, or on the board:

```bash
arduino-app-cli app start user:health-companion
arduino-app-cli app logs user:health-companion --tail 120
```

Healthy startup logs:
```
Provider: voice_agent  ->  wss://…/v1/sessions/<id>/voice
sherpa-onnx listening for 'hey kay' on plughw:0,0
```
Say **"hey kay"**, then talk. You should see `Wake phrase detected`, then
`Voice Agent Service connected`, the transcript, and audio from the speaker.

## Wake word ("hey kay")

The wake word uses **sherpa-onnx** (k2-fsa) keyword spotting — a dedicated, offline
streaming KWS model, not full ASR, so it fires on the phrase and little else. The
phrase needs **no training**: at startup `sherpa_wake.py` encodes `WAKE_WORD_PHRASE`
to the model's BPE tokens (e.g. "HEY KAY" → "▁HE Y ▁K A Y") and registers it as a
keyword. The model (`sherpa-onnx-kws-zipformer-gigaspeech-3.3M`) auto-downloads on
first run.

If it triggers too easily or not enough, tune `KWS_THRESHOLD` (lower = easier) and
`KWS_SCORE` (higher = easier), or add alternative phrasings via `WAKE_WORD_ALIASES`.

## Start automatically on boot

Reconnecting power reboots the board; to auto-launch, make it the default app
(systemd runs the default app at boot):

```bash
arduino-app-cli properties set default user:health-companion
```

## Gotchas (learned the hard way)

- **Microphone is mandatory** and the Uno Q has no built-in mic. Its single USB-C
  port carries power + peripherals, so attach a USB mic via a **USB-C hub with PD
  passthrough** (or power via VIN and use an OTG adapter). `arecord -l` must list a
  `[USB Audio]` card or you get `No Microphone Device Found`.
- **`Arduino_RPClite` must match the platform** (`sketch/sketch.yaml` pins `0.3.0`).
  An older pin causes `No Colon In First Item Of Depfile` at sketch compile.
- **Only run one voice app at a time.** A second app (e.g. the old starter) holds the
  MCU/serial and the mic → `Failed Uploading` / `No Microphone Device Found`. Stop it:
  `arduino-app-cli app stop user:<other>`.
- The session URL from `companion open` is **ephemeral**; if the conversation stops
  connecting, reopen it and update `VA_VOICE_WS_URL`.
