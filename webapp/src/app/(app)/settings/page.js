import { requireOnboardedUser } from "@/lib/auth/guard";
import { getOnboarding } from "@/lib/data/onboarding";
import { updateProfileAction } from "./actions";
import Screen from "@/components/shell/Screen";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import OnboardingForm from "@/components/onboarding/OnboardingForm";
import DangerZone from "@/components/settings/DangerZone";
import SignOutButton from "@/components/SignOutButton";
import { PersonIcon } from "@/components/shell/icons";
import styles from "./settings.module.css";

export const metadata = { title: "Profile" };

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const profile = await getOnboarding(user.id);

  const defaultValues = {
    preferredName: profile?.preferredName || "",
    pronouns: profile?.pronouns || [],
    careContext: profile?.careContext || [],
    hormoneMethod: profile?.hormoneMethod || undefined,
    stage: profile?.stage || undefined,
    goals: profile?.goals || [],
    trackedSymptoms: profile?.trackedSymptoms || [],
    therapyStartDate: profile?.therapyStartDate || "",
    language: profile?.language || "it",
  };

  async function handleSubmit(values) {
    "use server";
    return updateProfileAction(values);
  }

  return (
    <Screen title="Profile">
      <Card title="Account" padded>
        <div className={styles.account}>
          <Avatar />
          <div className={styles.accountInfo}>
            <strong>{user.name || "—"}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <div className={styles.signout}>
          <SignOutButton />
        </div>
      </Card>

      <Card
        title="Health profile"
        icon={<PersonIcon />}
        subtitle="What you set during onboarding."
        padded
      >
        <OnboardingForm
          defaultValues={defaultValues}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Card>

      <Card
        title="Data & privacy"
        subtitle="You're fully in control of your data."
        padded
      >
        <DangerZone />
      </Card>
    </Screen>
  );
}
