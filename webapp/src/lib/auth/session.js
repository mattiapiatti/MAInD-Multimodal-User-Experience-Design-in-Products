import { headers } from "next/headers";
import { getBackendDO } from "@/lib/env";

/**
 * Current server-side session. Better Auth runs inside the Durable Object, so we
 * read it via RPC, forwarding the request cookies.
 * @returns {Promise<{ session: object, user: object } | null>}
 */
export async function getSession() {
  const do_ = await getBackendDO();
  const h = Object.fromEntries(await headers());
  return do_.getSession(h);
}

/** Logged-in user or null. */
export async function getCurrentUser() {
  const data = await getSession();
  return data?.user ?? null;
}
