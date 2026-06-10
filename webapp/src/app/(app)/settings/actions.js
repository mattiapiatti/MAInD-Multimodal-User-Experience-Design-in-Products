"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getBackendDO } from "@/lib/env";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { upsertOnboarding } from "@/lib/data/onboarding";
import { wipeMemory } from "@/lib/voicebot";

/** Save edits to the health profile (does not touch onboardingCompleted). */
export async function updateProfileAction(values) {
  const user = await requireOnboardedUser();
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  await upsertOnboarding(user.id, parsed.data);
  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true };
}

/** Ask the voice backend to erase the long-term memory for this user. */
export async function wipeHistoryAction() {
  const user = await requireOnboardedUser();
  return wipeMemory(user.id);
}

/** Delete the account (cascades to sessions/onboarding/devices), then bounce. */
export async function deleteAccountAction() {
  const user = await requireOnboardedUser();

  // Best-effort: wipe the brain's memory too before dropping the account.
  await wipeMemory(user.id);

  const do_ = await getBackendDO();
  await do_.deleteUser(user.id);

  // The session row is gone with the user, so the stale cookie is now invalid.
  redirect("/register");
}
