import { cache } from "react";
import { headers } from "next/headers";
import { getBackendDO } from "@/lib/env";

/**
 * Current server-side session. Better Auth runs inside the Durable Object, so we
 * read it via RPC, forwarding the request cookies.
 *
 * Wrapped in React `cache()` so it runs at most once per request render: a single
 * navigation touches the session in both the (app) layout guard and the page
 * guard, and this dedupes those into one Durable Object round-trip.
 * @returns {Promise<{ session: object, user: object } | null>}
 */
export const getSession = cache(async function getSession() {
  const do_ = await getBackendDO();
  const h = Object.fromEntries(await headers());
  return do_.getSession(h);
});

/** Logged-in user or null. */
export async function getCurrentUser() {
  const data = await getSession();
  return data?.user ?? null;
}
