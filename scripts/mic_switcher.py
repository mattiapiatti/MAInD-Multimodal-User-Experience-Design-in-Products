#!/usr/bin/env python3
"""Terminal switcher — local audio frontend for testing on the Mac without the Arduino.

This stands in for the Arduino Uno Q: it captures the Mac microphone, streams the
utterance to the brain container over the WebSocket, and plays the synthesised
reply back through the speakers. It runs on the **host** (not in the container),
because a Linux container on macOS cannot reach CoreAudio.

Per turn you "switch" the input mode:

    [Enter]            push-to-talk: record from the mic until you press Enter again
    <type text>+Enter  send text directly (skips speech-to-text)
    /reset             clear the conversation history
    /quit              exit

Requires (on the host): pip install sounddevice numpy websockets
Run:                    python3 scripts/mic_switcher.py
"""

from __future__ import annotations

import argparse
import json
import queue
import sys
import threading

import numpy as np
import sounddevice as sd
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

MIC_SAMPLE_RATE = 16000  # what the brain's STT expects; send 16 kHz mono int16


def list_devices() -> None:
    print(sd.query_devices())


def record_push_to_talk(device: int | None) -> bytes:
    """Record mono 16-bit PCM from the mic until the user presses Enter."""
    q: queue.Queue[np.ndarray] = queue.Queue()
    stop = threading.Event()

    def callback(indata, _frames, _time, status):  # noqa: ANN001 — sounddevice signature
        if status:
            print(f"  (audio status: {status})", file=sys.stderr)
        q.put(indata.copy())

    def wait_for_enter() -> None:
        input()
        stop.set()

    print("🔴 recording — press Enter to stop")
    threading.Thread(target=wait_for_enter, daemon=True).start()

    frames: list[np.ndarray] = []
    with sd.InputStream(
        samplerate=MIC_SAMPLE_RATE,
        channels=1,
        dtype="int16",
        device=device,
        callback=callback,
    ):
        while not stop.is_set():
            try:
                frames.append(q.get(timeout=0.1))
            except queue.Empty:
                pass

    if not frames:
        return b""
    return np.concatenate(frames)[:, 0].tobytes()


def play(pcm: bytes, sample_rate: int, device: int | None) -> None:
    if not pcm:
        return
    audio = np.frombuffer(pcm, dtype=np.int16)
    sd.play(audio, samplerate=sample_rate, device=device)
    sd.wait()


def receive_and_play(ws, out_sr: int, output_device: int | None) -> int:
    """Consume one reply: print text events, play each audio frame as it arrives."""
    while True:
        msg = ws.recv()
        if isinstance(msg, (bytes, bytearray)):
            play(bytes(msg), out_sr, output_device)
            continue
        data = json.loads(msg)
        event = data.get("event")
        if event == "transcript":
            text = data.get("text", "")
            print(f"  you said: {text!r}" if text else "  (nothing recognised)")
        elif event == "speaking_start":
            out_sr = data.get("sample_rate", out_sr)
        elif event == "sentence":
            print(f"  » {data.get('text', '')}")
        elif event == "error":
            print(f"  [error] {data.get('message')}")
        elif event == "speaking_end":
            return out_sr


def main() -> None:
    p = argparse.ArgumentParser(description="Terminal voice switcher (Arduino stand-in)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--input-device", type=int, default=None, help="mic device index")
    p.add_argument("--output-device", type=int, default=None, help="speaker device index")
    p.add_argument("--list-devices", action="store_true", help="list audio devices and exit")
    args = p.parse_args()

    if args.list_devices:
        list_devices()
        return

    uri = f"ws://{args.host}:{args.port}"
    print(f"connecting to {uri} …")
    # ping_interval=None: a turn can keep the brain's CPU busy longer than the
    # default keepalive timeout, which would otherwise drop the connection.
    with connect(uri, max_size=None, ping_interval=None) as ws:
        ws.send(json.dumps({"event": "hello", "input_sample_rate": MIC_SAMPLE_RATE}))
        out_sr = 22050
        ready = json.loads(ws.recv())
        if ready.get("event") == "ready":
            out_sr = ready.get("output_sample_rate", out_sr)
            print(f"connected — brain v{ready.get('version', '?')}, reply audio {out_sr} Hz")

        print("\nCommands:  [Enter]=talk   <text>+Enter=type   /reset   /quit\n")
        while True:
            try:
                cmd = input("› ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break

            if cmd in ("/quit", "/exit"):
                break
            if cmd == "/reset":
                ws.send(json.dumps({"event": "reset"}))
                ws.recv()  # reset_ok
                print("  [history cleared]")
                continue

            try:
                if cmd == "":
                    pcm = record_push_to_talk(args.input_device)
                    if not pcm:
                        print("  (no audio captured)")
                        continue
                    ws.send(pcm)
                    ws.send(json.dumps({"event": "eou"}))
                else:
                    ws.send(json.dumps({"event": "text", "content": cmd}))

                out_sr = receive_and_play(ws, out_sr, args.output_device)
            except ConnectionClosed:
                print("  [connection lost — is the container running? `make ps`]")
                break

    print("bye")


if __name__ == "__main__":
    main()
