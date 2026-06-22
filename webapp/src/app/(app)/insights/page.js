import { requireOnboardedUser } from "@/lib/auth/guard";
import { getFrequencyByMonth, getSummary, getTimeline } from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import { FrequencyChart } from "@/components/insights/Charts";
import DownloadReport from "@/components/insights/DownloadReport";
import styles from "./insights.module.css";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  await requireOnboardedUser();
  const frequency = getFrequencyByMonth();
  const summary = getSummary();
  const timeline = getTimeline();

  return (
    <Screen title="Insights">
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{summary.checkins}</span>
          <span className={styles.kpiLbl}>total check-ins</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{summary.streakDays}</span>
          <span className={styles.kpiLbl}>day streak</span>
        </div>
      </div>

      <Card title="Symptom frequency" subtitle="Days per month" padded>
        <FrequencyChart data={frequency} />
      </Card>

      <Card title="Insights" subtitle="Your latest activity" padded>
        <ul className={styles.timeline}>
          {timeline.map((item, i) => (
            <li key={i} className={styles.tItem}>
              <div className={styles.tHead}>
                <span className={styles.tDate}>{item.date}</span>
                <span className={styles.tTag} data-cat={item.category}>
                  {item.category}
                </span>
              </div>
              <p className={styles.tText}>{item.text}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Appointment record"
        subtitle="A PDF to share with your care team."
        padded
      >
        <DownloadReport />
      </Card>
    </Screen>
  );
}
