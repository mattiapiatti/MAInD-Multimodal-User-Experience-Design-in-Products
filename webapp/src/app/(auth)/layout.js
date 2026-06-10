import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./auth.module.css";

// Auth screens: if already logged in, bounce to the app.
export default async function AuthLayout({ children }) {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingCompleted ? "/home" : "/onboarding");

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandDot} aria-hidden="true" />
          <span className={styles.brandName}>Companion</span>
        </div>
        {children}
      </div>
      <p className={styles.legal}>
        Voice companion for hormonal health · your data stays on your device
      </p>
    </div>
  );
}
