import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

/**
 * Current server-side session (Server Components, Server Actions, Route Handlers).
 * @returns {Promise<{ session: object, user: object } | null>}
 */
export async function getSession() {
  const auth = getAuth();
  return auth.api.getSession({ headers: await headers() });
}

/** Logged-in user or null. */
export async function getCurrentUser() {
  const data = await getSession();
  return data?.user ?? null;
}
