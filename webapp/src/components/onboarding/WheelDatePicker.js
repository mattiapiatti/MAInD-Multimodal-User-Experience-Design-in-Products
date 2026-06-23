"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./WheelDatePicker.module.css";

// Inline date picker (day · month · year), no dependencies. Each column is a
// scrollable list of buttons: scroll to browse, click a value to select it.
// Nothing is committed until the user actually picks — the form value stays
// empty (and the step can't be passed) until then.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, mo) => new Date(y, mo + 1, 0).getDate();
const isValid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");

function parseDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  if (m) return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
  const now = new Date();
  return { y: now.getFullYear(), mo: now.getMonth(), d: now.getDate() };
}

// `selected` highlights (null = none yet); `focus` is the value to scroll into
// view so the column opens near today even before anything is chosen.
function Column({ items, selected, focus, onSelect, render, ariaLabel }) {
  const colRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    const c = colRef.current;
    const s = focusRef.current;
    if (c && s) c.scrollTop = s.offsetTop - (c.clientHeight - s.offsetHeight) / 2;
  }, [focus, items.length]);

  return (
    <div ref={colRef} className={styles.col} role="listbox" aria-label={ariaLabel}>
      {items.map((it) => {
        const active = it === selected;
        return (
          <button
            type="button"
            key={it}
            ref={it === focus ? focusRef : null}
            className={`${styles.opt} ${active ? styles.optActive : ""}`}
            role="option"
            aria-selected={active}
            onClick={() => onSelect(it)}
          >
            {render ? render(it) : it}
          </button>
        );
      })}
    </div>
  );
}

export default function WheelDatePicker({ value, onChange }) {
  const nowY = new Date().getFullYear();
  const years = useRef(Array.from({ length: 71 }, (_, i) => nowY - 70 + i)).current;

  // `date` drives positioning/highlight; `touched` gates whether we commit it.
  const [date, setDate] = useState(() => parseDate(value));
  const [touched, setTouched] = useState(() => isValid(value));

  // Commit the date to the form only once the user has actually picked. Until
  // then the value stays empty so the required check blocks the step.
  useEffect(() => {
    onChange(touched ? `${date.y}-${pad(date.mo + 1)}-${pad(date.d)}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, touched]);

  const days = Array.from({ length: daysIn(date.y, date.mo) }, (_, i) => i + 1);

  // Apply one part (marks as touched), clamping the day to the new month.
  const pick = (patch) => {
    setTouched(true);
    setDate((prev) => {
      const next = { ...prev, ...patch };
      const max = daysIn(next.y, next.mo);
      if (next.d > max) next.d = max;
      return next;
    });
  };

  return (
    <div className={styles.picker}>
      <Column
        items={days}
        selected={touched ? date.d : null}
        focus={date.d}
        ariaLabel="Day"
        onSelect={(d) => pick({ d })}
      />
      <Column
        items={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
        selected={touched ? date.mo : null}
        focus={date.mo}
        ariaLabel="Month"
        render={(i) => MONTHS[i]}
        onSelect={(mo) => pick({ mo })}
      />
      <Column
        items={years}
        selected={touched ? date.y : null}
        focus={date.y}
        ariaLabel="Year"
        onSelect={(y) => pick({ y })}
      />
    </div>
  );
}
