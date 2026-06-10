import { getBackendDO } from "@/lib/env";

// Thin proxies to the backend Durable Object, where the SQLite data lives.

/** Onboarding profile row for a user, or null. */
export async function getOnboarding(userId) {
  const do_ = await getBackendDO();
  return do_.getOnboarding(userId);
}

/** Insert/update the profile; when complete, also flips onboardingCompleted. */
export async function upsertOnboarding(userId, values, { complete = false } = {}) {
  const do_ = await getBackendDO();
  return do_.upsertOnboarding(userId, values, complete);
}
