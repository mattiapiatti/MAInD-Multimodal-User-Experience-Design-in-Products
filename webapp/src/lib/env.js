import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Cloudflare bindings + vars for the current request. On Workers these are not
 * in process.env — they come from the OpenNext context. Async form works in all
 * server contexts (Server Components, Server Actions, Route Handlers).
 */
export async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

/**
 * The singleton backend Durable Object stub. All accounts, sessions, onboarding,
 * and device data live inside it; this is the only way the Worker reaches them.
 */
export async function getBackendDO() {
  const env = await getEnv();
  return env.AUTH_DO.getByName("main");
}
