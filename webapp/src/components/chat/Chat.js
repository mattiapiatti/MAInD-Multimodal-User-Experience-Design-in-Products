"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import styles from "./Chat.module.css";

const SYNC_REPLY =
  "Got it — your messages will sync to your device as soon as you're connected.";
const SYNCED_REPLY = "Synced to your device.";

let seq = 0;
const nextId = () => `m${seq++}`;

function VoiceBubble({ url, secs }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  return (
    <span className={styles.voice}>
      <button
        type="button"
        className={styles.voiceBtn}
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <span className={styles.wave} aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <i key={i} style={{ height: `${6 + ((i * 7) % 16)}px` }} />
        ))}
      </span>
      <span className={styles.voiceSecs}>{secs}s</span>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </span>
  );
}

export default function Chat({ name, paired = false }) {
  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      from: "kai",
      type: "text",
      text: paired
        ? `Hi${name ? `, ${name}` : ""}. I'm connected to your device — write or send a voice note and it syncs straight across.`
        : `Hi${name ? `, ${name}` : ""}. I'm not connected to your device yet — but go ahead and write or send a voice note. Everything will sync the moment you're connected.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  const listRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, transcript]);

  const kaiReply = useCallback(() => {
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          from: "kai",
          type: "text",
          text: paired ? SYNCED_REPLY : SYNC_REPLY,
        },
      ]);
    }, 650);
  }, [paired]);

  function setLiveTranscript(value) {
    transcriptRef.current = value;
    setTranscript(value);
  }

  function sendText(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { id: nextId(), from: "me", type: "text", text }]);
    setDraft("");
    kaiReply();
  }

  // Live speech-to-text while recording (Web Speech API, where available).
  function startTranscription() {
    const SpeechRec =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRec) return;
    try {
      const rec = new SpeechRec();
      rec.lang = navigator.language || "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += chunk + " ";
          else interim += chunk;
        }
        setLiveTranscript((finalText + interim).trim());
      };
      rec.onerror = () => {};
      recognitionRef.current = rec;
      rec.start();
    } catch {
      /* transcription unavailable — recording still works */
    }
  }

  function stopTranscription() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      stopTranscription();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      startedRef.current = Date.now();
      setLiveTranscript("");
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const secs = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const text = transcriptRef.current.trim();
        setMessages((m) => [
          ...m,
          { id: nextId(), from: "me", type: "voice", url, secs, text },
        ]);
        stream.getTracks().forEach((t) => t.stop());
        setLiveTranscript("");
        setRecording(false);
        kaiReply();
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      startTranscription();
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          from: "kai",
          type: "text",
          text: "I couldn't reach the microphone — check the browser's mic permission and try again.",
        },
      ]);
    }
  }

  const hasDraft = draft.trim().length > 0;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link href="/home" className={styles.back} aria-label="Back to home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <Avatar size={38} face dark />
        <div className={styles.who}>
          <strong>Kai</strong>
          <span className={styles.status}>
            <span
              className={styles.statusDot}
              data-paired={paired ? "true" : "false"}
              aria-hidden="true"
            />
            {paired ? "Connected · in sync" : "Offline · syncs to your device"}
          </span>
        </div>
      </header>

      <div className={styles.list} ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.row} ${m.from === "me" ? styles.me : styles.kai}`}
          >
            <div className={styles.bubble}>
              {m.type === "voice" ? (
                <>
                  <VoiceBubble url={m.url} secs={m.secs} />
                  {m.text ? <span className={styles.voiceText}>{m.text}</span> : null}
                </>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
      </div>

      <form className={styles.inputBar} onSubmit={sendText}>
        {recording ? (
          <div className={styles.recBox} aria-live="polite">
            <span className={styles.recDot} aria-hidden="true" />
            <span className={styles.recText}>
              {transcript || "Listening…"}
            </span>
          </div>
        ) : (
          <input
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Kai…"
            aria-label="Message"
          />
        )}
        {hasDraft ? (
          <button type="submit" className={styles.send} aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.mic} ${recording ? styles.micOn : ""}`}
            onClick={toggleRecord}
            aria-label={recording ? "Stop and send voice message" : "Record a voice message"}
          >
            {recording ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
