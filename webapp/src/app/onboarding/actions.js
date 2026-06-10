"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { upsertOnboarding } from "@/lib/data/onboarding";

/**
 * Completes first-login onboarding. On success it redirects to /home
 * server-side — the canonical, race-free way to navigate after a mutating
 * action (a client-side router.push + refresh cancel each other out). On
 * validation failure it returns the field errors for the form to show.
 *
 * @returns {Promise<{ ok: false, errors: object }>} only when validation fails;
 *   otherwise it throws a redirect and never returns.
 */
export async function completeOnboardingAction(values) {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  upsertOnboarding(user.id, parsed.data, { complete: true });
  redirect("/home");
}
