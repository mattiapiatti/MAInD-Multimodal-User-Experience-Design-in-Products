import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Entry point: route by auth + onboarding state.
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  redirect("/home");
}
