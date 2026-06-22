import { requireOnboardedUser } from "@/lib/auth/guard";
import { getFrequencyByMonth, getSummary, getTimeline } from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import { FrequencyChart } from "@/components/insights/Charts";
import Timeline from "@/components/insights/Timeline";
import DownloadReport from "@/components/insights/DownloadReport";
import styles from "./insights.module.css";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  await requireOnboardedUser();
  const frequency = getFrequencyByMonth();
  const summary = getSummary();
  const timeline = getTimeline();

  return (
    <Screen title="Insights" action={<DownloadReport icon />}>
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
        <Timeline items={timeline} />
      </Card>
    </Screen>
  );
}
