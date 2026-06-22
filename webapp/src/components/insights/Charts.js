"use client";

import styles from "./Charts.module.css";

export function FrequencyChart({ data }) {
  const max = data.reduce((m, d) => Math.max(m, d.days), 0) || 1;
  return (
    <div className={styles.bars}>
      {data.map((d) => (
        <div key={d.month} className={styles.barCol}>
          <span className={styles.barValue}>{d.days}</span>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ height: `${Math.round((d.days / max) * 100)}%` }}
            />
          </div>
          <span className={styles.barMonth}>{d.month}</span>
        </div>
      ))}
    </div>
  );
}
