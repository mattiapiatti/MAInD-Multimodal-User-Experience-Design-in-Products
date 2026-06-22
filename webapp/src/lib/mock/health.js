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

/**
 * How often each symptom was reported overall, for a distribution pie chart.
 * Colors are RGB triples (0–1) so the PDF report can draw slices directly.
 */
export function getSymptomDistribution() {
  return [
    { label: "Hot flashes", value: 18, color: [0.055, 0.486, 0.4] },
    { label: "Mood swings", value: 13, color: [0.2, 0.62, 0.52] },
    { label: "Fatigue", value: 9, color: [0.45, 0.74, 0.66] },
    { label: "Sleep changes", value: 6, color: [0.66, 0.83, 0.78] },
    { label: "Headaches", value: 4, color: [0.83, 0.91, 0.88] },
  ];
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

/**
 * A human timeline of recent milestones (mock). Each entry has a category so
 * the insights screen can tag it; the home screen shows a short slice.
 */
export function getTimeline() {
  return [
    {
      date: "Jun 10",
      category: "Mood",
      text: "Evening check-in: mood steady, and sleep improved after a calmer week.",
    },
    {
      date: "Jun 7",
      category: "Symptom",
      text: "Reported an evening hot flash, medium intensity, lasting about ten minutes.",
    },
    {
      date: "Jun 3",
      category: "Therapy",
      text: "Three months on therapy — no adverse effects noted so far.",
    },
    {
      date: "May 28",
      category: "Energy",
      text: "Energy dipped for a few days, then recovered alongside better sleep.",
    },
    {
      date: "May 21",
      category: "Sleep",
      text: "Sleep averaged about 7 hours this week, up from 6 the week before.",
    },
    {
      date: "May 14",
      category: "Mood",
      text: "Mood more even overall, with fewer low moments in the evenings.",
    },
    {
      date: "May 6",
      category: "Symptom",
      text: "Occasional mild headaches, mostly in the early afternoon.",
    },
  ];
}
