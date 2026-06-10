"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";
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
  upsertOnboarding(user.id, parsed.data);
  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true };
}

/** Ask the voice backend to erase the long-term memory for this user. */
export async function wipeHistoryAction() {
  const user = await requireOnboardedUser();
  const res = await wipeMemory(user.id);
  return res; // { ok } or { ok:false, offline:true }
}

/** Delete the account and everything cascading from it, then sign out. */
export async function deleteAccountAction() {
  const user = await requireOnboardedUser();

  // Best-effort: wipe the brain's memory too before dropping the account.
  await wipeMemory(user.id);

  const db = getDb();
  // FK cascade removes sessions, accounts, onboarding, devices, pairing codes.
  db.delete(schema.users).where(eq(schema.users.id, user.id)).run();

  // Clear the auth cookie/session on the client.
  try {
    const auth = getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch {
    /* session already gone with the user row */
  }

  redirect("/register");
}
