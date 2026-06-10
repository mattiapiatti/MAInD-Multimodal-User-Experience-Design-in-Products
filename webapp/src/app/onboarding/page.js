import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import OnboardingForm from "@/components/onboarding/OnboardingForm";
import { completeOnboardingAction } from "./actions";
import styles from "./onboarding.module.css";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingCompleted) redirect("/home");

  async function handleSubmit(values) {
    "use server";
    return completeOnboardingAction(values);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.intro}>
        <span className={styles.brandDot} aria-hidden="true" />
        <h1 className={styles.h1}>Hi{user.name ? `, ${user.name}` : ""}</h1>
        <p className={styles.lead}>
          Let&apos;s set up your companion. Just four steps — you can change
          everything later in settings.
        </p>
      </div>

      <div className={styles.card}>
        <OnboardingForm
          wizard
          submitLabel="Get started"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
