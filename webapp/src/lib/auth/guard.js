import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Requires a logged-in user. Redirects to /login otherwise.
 * Returns the user for use in the calling Server Component.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Requires a logged-in user who has finished onboarding. Sends unfinished users
 * to /onboarding. Use on the main app screens.
 */
export async function requireOnboardedUser() {
  const user = await requireUser();
  if (!user.onboardingCompleted) redirect("/onboarding");
  return user;
}
