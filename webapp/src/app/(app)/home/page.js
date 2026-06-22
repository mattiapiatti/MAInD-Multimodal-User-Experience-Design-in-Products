import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { getOnboarding } from "@/lib/data/onboarding";
import { listDevices } from "@/lib/data/devices";
import { getSummary, getTimeline } from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import DeviceManager from "@/components/device/DeviceManager";
import { PulseIcon } from "@/components/shell/icons";
import TalkButton from "./TalkButton";
import styles from "./home.module.css";

export const metadata = { title: "Home" };

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const [profile, devices] = await Promise.all([
    getOnboarding(user.id),
    listDevices(user.id),
  ]);
  const summary = getSummary();
  const timeline = getTimeline();
  const name = profile?.preferredName || user.name || "";
  const greeting = greetingFor(new Date().getHours());

  // Progress bar widths (0–1) derived from the real summary numbers.
  const checkinPct = Math.min(summary.checkins / 30, 1) * 100;
  const streakPct = Math.min(summary.streakDays / 10, 1) * 100;
  const symptomPct = Math.min(summary.trackedSymptoms / 8, 1) * 100;

  // Serializable device rows for the client DeviceManager.
  const deviceRows = devices.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    hardwareId: d.hardwareId,
    pairedAt: d.pairedAt instanceof Date ? d.pairedAt.toISOString() : d.pairedAt,
  }));

  return (
    <Screen>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroHead}>
            <span className={styles.eyebrow}>{greeting}</span>
            <h1 className={styles.heroTitle}>Hi{name ? `, ${name}` : ""}</h1>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>Synced · stays on device</span>
            </div>
          </div>
          <div className={styles.face} aria-hidden="true">
            <svg width="42" height="42" viewBox="0 0 100 100" fill="none">
              <circle cx="36" cy="42" r="6.5" fill="#fff" />
              <circle cx="64" cy="42" r="6.5" fill="#fff" />
              <path
                d="M33 61 Q50 79 67 61"
                stroke="#fff"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>

          <TalkButton />
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLbl}>Check-ins</span>
            <div className={styles.statVal}>
              <span className={styles.statNum}>{summary.checkins}</span>
              <span className={styles.statUnit}>/30</span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${checkinPct}%` }} />
            </div>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLbl}>Day streak</span>
            <div className={styles.statVal}>
              <span className={styles.statNum}>{summary.streakDays}</span>
              <span className={styles.statUnit}>days</span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${streakPct}%` }} />
            </div>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLbl}>Symptoms</span>
            <div className={styles.statVal}>
              <span className={styles.statNum}>{summary.trackedSymptoms}</span>
              <span className={styles.statUnit}>tracked</span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${symptomPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <h2 className={styles.sectionTitle}>Your device</h2>
      <DeviceManager devices={deviceRows} />

      <Card
        title="Recent insights"
        subtitle="A summary of your last few days"
        footer={
          <Link href="/insights" className={styles.footerLink}>
            <PulseIcon width={18} height={18} aria-hidden="true" />
            See all insights
          </Link>
        }
        padded
      >
        <ul className={styles.timeline}>
          {timeline.map((item, i) => (
            <li key={i} className={styles.tItem}>
              <span className={styles.tDate}>{item.date}</span>
              <span className={styles.tText}>{item.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Screen>
  );
}
