"use client";

import { useState } from "react";
import styles from "./home.module.css";

/**
 * Primary hero CTA. White pill with a mic icon + "Talk to Kai".
 * Tapping toggles a local "listening" visual; it is otherwise non-functional.
 */
export default function TalkButton() {
  const [listening, setListening] = useState(false);

  return (
    <button
      type="button"
      className={styles.talk}
      data-listening={listening ? "true" : "false"}
      aria-pressed={listening}
      onClick={() => setListening((v) => !v)}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      Talk to Kai
    </button>
  );
}
