import { requireOnboardedUser } from "@/lib/auth/guard";
import {
  getSeverityTrend,
  getFrequencyByMonth,
  getSummary,
  TRACKED,
} from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import { SeverityChart, FrequencyChart } from "@/components/insights/Charts";
import DownloadReport from "@/components/insights/DownloadReport";
import styles from "./insights.module.css";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  await requireOnboardedUser();
  const severity = getSeverityTrend();
  const frequency = getFrequencyByMonth();
  const summary = getSummary();

  return (
    <Screen title="Insights">
      <p className={styles.note}>
        Sample data. It will connect to the companion&apos;s memory in a later
        phase.
      </p>

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

      <Card title="Intensity over time" subtitle="Last 6 weeks (0–10)" padded>
        <SeverityChart data={severity} series={TRACKED} />
      </Card>

      <Card title="Symptom frequency" subtitle="Days per month" padded>
        <FrequencyChart data={frequency} />
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
