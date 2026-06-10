// Mock health data for the insights screen. In a later phase this comes from
// the voice backend's structured memory (symptom + date + severity). The shape
// here intentionally matches what that API will return, so swapping the source
// is a one-line change.

/** Deterministic pseudo-random so charts are stable between renders/SSR. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const SYMPTOMS = [
  { key: "mood", label: "Mood", color: "var(--chart-1)" },
  { key: "energy", label: "Energy", color: "var(--chart-2)" },
  { key: "sleep", label: "Sleep", color: "var(--chart-3)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** Last 6 weeks of severity (0–10) per tracked symptom. */
export function getSeverityTrend() {
  const rnd = seeded(42);
  return Array.from({ length: 6 }, (_, i) => ({
    week: `W${i + 1}`,
    mood: 4 + Math.round(rnd() * 5),
    energy: 3 + Math.round(rnd() * 6),
    sleep: 5 + Math.round(rnd() * 4),
  }));
}

/** How many days each symptom was reported, by month. */
export function getFrequencyByMonth() {
  const rnd = seeded(7);
  return MONTHS.map((m) => ({
    month: m,
    days: 6 + Math.round(rnd() * 14),
  }));
}

/** Headline numbers for the home + insights summary cards. */
export function getSummary() {
  return {
    checkins: 28,
    streakDays: 5,
    lastCheckin: "last night",
    trackedSymptoms: SYMPTOMS.length,
  };
}

export const TRACKED = SYMPTOMS;

/** A short, human timeline of recent milestones (mock). */
export function getTimeline() {
  return [
    { date: "Jun 10", text: "Evening check-in: mood steady, sleep improved." },
    { date: "Jun 7", text: "Reported an evening hot flash, medium intensity." },
    { date: "Jun 3", text: "3 months on therapy — no adverse effects." },
    { date: "May 28", text: "Energy dipped for a few days, then recovered." },
  ];
}
