"use client";

import { useState } from "react";
import styles from "./Timeline.module.css";

/**
 * The insights activity timeline. Shows a few entries with category tags, then a
 * "See all" button that reveals the rest inline.
 */
export default function Timeline({ items, initial = 3 }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, initial);
  const hidden = items.length - initial;

  return (
    <>
      <ul className={styles.timeline}>
        {shown.map((item, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.head}>
              <span className={styles.date}>{item.date}</span>
              <span className={styles.tag} data-cat={item.category}>
                {item.category}
              </span>
            </div>
            <p className={styles.text}>{item.text}</p>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <button
          type="button"
          className={styles.seeAll}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `See all (${items.length})`}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
          </svg>
        </button>
      ) : null}
    </>
  );
}
