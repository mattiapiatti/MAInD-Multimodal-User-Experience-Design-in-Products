import { getEnv } from "@/lib/env";

// Thin client to the Python voice backend's small HTTP API. Best-effort: the
// brain runs locally and may be offline while you use the app, so callers should
// treat failures as non-fatal.

/**
 * Asks the voice backend to wipe a user's long-term memory vault. The backend
 * scopes the wipe by the device token / user id (see the WS `wipe_memory`
 * event). Returns { ok }.
 */
export async function wipeMemory(userId) {
  const { VOICEBOT_API_URL } = getEnv();
  try {
    const res = await fetch(`${VOICEBOT_API_URL}/memory/wipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      // Don't hang the request if the brain is down.
      signal: AbortSignal.timeout(4000),
    });
    return { ok: res.ok };
  } catch {
    // Backend offline or endpoint not yet implemented — report softly.
    return { ok: false, offline: true };
  }
}
