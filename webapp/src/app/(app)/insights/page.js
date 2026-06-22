import { requireOnboardedUser } from "@/lib/auth/guard";
import { getFrequencyByMonth, getTimeline } from "@/lib/mock/health";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import { FrequencyChart } from "@/components/insights/Charts";
import Timeline from "@/components/insights/Timeline";
import DownloadReport from "@/components/insights/DownloadReport";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  await requireOnboardedUser();
  const frequency = getFrequencyByMonth();
  const timeline = getTimeline();

  return (
    <Screen title="Insights">
      <Card title="Symptom frequency" subtitle="Days per month" padded>
        <FrequencyChart data={frequency} />
      </Card>

      <Card
        title="Share with your care team"
        subtitle="Export a PDF of your profile and recent insights to bring to appointments."
        padded
      >
        <DownloadReport />
      </Card>

      <Card title="Insights" subtitle="Your latest activity" padded>
        <Timeline items={timeline} />
      </Card>
    </Screen>
  );
}
