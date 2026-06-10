import { requireOnboardedUser } from "@/lib/auth/guard";
import TabBar from "@/components/shell/TabBar";
import styles from "./app.module.css";

// All main screens live under this group. Gate: must be logged in AND onboarded.
export default async function AppLayout({ children }) {
  await requireOnboardedUser();
  return (
    <div className={styles.frame}>
      {children}
      <TabBar />
    </div>
  );
}
