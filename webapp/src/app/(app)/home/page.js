import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { getOnboarding } from "@/lib/data/onboarding";
import { listDevices } from "@/lib/data/devices";
import { getSummary, getTimeline } from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import { DeviceIcon, PulseIcon } from "@/components/shell/icons";
import styles from "./home.module.css";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const profile = getOnboarding(user.id);
  const devices = listDevices(user.id);
  const summary = getSummary();
  const timeline = getTimeline();
  const name = profile?.preferredName || user.name || "";

  return (
    <Screen title={`Hi${name ? `, ${name}` : ""}`}>
      <Card padded>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{summary.checkins}</span>
            <span className={styles.statLbl}>check-ins</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{summary.streakDays}</span>
            <span className={styles.statLbl}>day streak</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{summary.trackedSymptoms}</span>
            <span className={styles.statLbl}>tracked symptoms</span>
          </div>
        </div>
        <p className={styles.lastCheckin}>
          Last check-in: {summary.lastCheckin}
        </p>
      </Card>

      {devices.length === 0 ? (
        <Link href="/device" className={styles.cta}>
          <DeviceIcon className={styles.ctaIcon} aria-hidden="true" />
          <div>
            <strong>Pair your device</strong>
            <span>Connect the voice unit to start talking to it.</span>
          </div>
        </Link>
      ) : (
        <Card title="Your device" padded>
          <div className={styles.deviceRow}>
            <span className={styles.deviceDot} data-status={devices[0].status} />
            <div>
              <strong>{devices[0].name || "Voice unit"}</strong>
              <p className={styles.deviceMeta}>
                {devices[0].status === "active" ? "Active" : "Revoked"}
              </p>
            </div>
          </div>
        </Card>
      )}

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
