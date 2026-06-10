import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { and, eq, desc } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import migrations from "../../drizzle/migrations.js";
import * as schema from "../db/schema.js";
import { newId, newToken, newPairingCode } from "../lib/ids.js";

const PAIRING_TTL_MS = 10 * 60 * 1000;

// A host is on the local network — trusted for CSRF in this prototype.
function isPrivateHost(h) {
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}
function lanTrustedOrigins(request) {
  const origins = new Set();
  try {
    const ref =
      request?.headers?.get("origin") || request?.headers?.get("referer");
    if (ref) {
      const u = new URL(ref);
      if (isPrivateHost(u.hostname)) origins.add(u.origin);
    }
  } catch {
    /* ignore */
  }
  return [...origins];
}

/**
 * The whole backend lives in one Durable Object: SQLite (accounts, sessions,
 * onboarding, devices, pairing) + Better Auth + the device WebSocket hub (added
 * in later phases). The Next Worker forwards /api/auth/* to fetch() and calls
 * the RPC methods below for data.
 */
export class BackendDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.db = drizzle(ctx.storage, { schema, logger: false });

    ctx.blockConcurrencyWhile(async () => {
      // Enforce ON DELETE CASCADE (e.g. deleting a user clears its sessions,
      // onboarding, devices). Off by default in SQLite.
      ctx.storage.sql.exec("PRAGMA foreign_keys = ON");
      await migrate(this.db, migrations);
    });

    const db = this.db;
    this.auth = betterAuth({
      baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
      secret: env.BETTER_AUTH_SECRET || "dev-only-secret-change-me-please-32x",
      trustedOrigins: (request) => {
        const base = [
          env.BETTER_AUTH_URL,
          // Both production origins (custom domain + workers.dev) plus local dev.
          "https://voicebot-webapp.mattiapiatti.eu",
          "https://voicebot-webapp.administration-981.workers.dev",
          "http://localhost:8787",
          "http://localhost:3000",
        ].filter(Boolean);
        return [...new Set([...base, ...lanTrustedOrigins(request)])];
      },
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
          user: schema.users,
          session: schema.sessions,
          account: schema.accounts,
          verification: schema.verifications,
        },
      }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 128,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        // Read fresh each request so the onboarding gate reacts immediately.
        cookieCache: { enabled: false },
      },
      advanced: { cookiePrefix: "voicebot" },
      user: {
        additionalFields: {
          onboardingCompleted: {
            type: "boolean",
            defaultValue: false,
            input: false,
          },
        },
      },
      databaseHooks: {
        session: {
          create: {
            after: async (session) => {
              try {
                await db
                  .update(schema.users)
                  .set({ lastLoginAt: new Date() })
                  .where(eq(schema.users.id, session.userId));
              } catch (err) {
                console.error("[auth] lastLoginAt update failed:", err);
              }
            },
          },
        },
      },
    });
  }

  // ---- Better Auth ----------------------------------------------------------

  /** Runs the Better Auth HTTP handler (sign-up/in/out, etc.). */
  fetch(request) {
    return this.auth.handler(request);
  }

  /** Server-side session read for guards / Server Components. */
  async getSession(headers) {
    return this.auth.api.getSession({ headers: new Headers(headers) });
  }

  // ---- Onboarding -----------------------------------------------------------

  async getOnboarding(userId) {
    const rows = this.db
      .select()
      .from(schema.onboardingProfiles)
      .where(eq(schema.onboardingProfiles.userId, userId))
      .limit(1)
      .all();
    return rows[0] ?? null;
  }

  async upsertOnboarding(userId, values, complete = false) {
    const nowDate = new Date();
    const payload = {
      preferredName: values.preferredName ?? null,
      pronouns: values.pronouns || null,
      careContext: values.careContext ?? null,
      goals: values.goals ?? [],
      trackedSymptoms: values.trackedSymptoms ?? [],
      therapyStartDate: values.therapyStartDate || null,
      language: values.language ?? "en",
      updatedAt: nowDate,
    };
    this.db
      .insert(schema.onboardingProfiles)
      .values({ userId, ...payload })
      .onConflictDoUpdate({
        target: schema.onboardingProfiles.userId,
        set: payload,
      })
      .run();
    if (complete) {
      this.db
        .update(schema.users)
        .set({ onboardingCompleted: true, updatedAt: nowDate })
        .where(eq(schema.users.id, userId))
        .run();
    }
    return { ok: true };
  }

  // ---- Devices --------------------------------------------------------------

  async listDevices(userId) {
    return this.db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.userId, userId))
      .orderBy(desc(schema.devices.pairedAt))
      .all();
  }

  /**
   * Device-facing: a unit starts a pairing session and gets a code to show on
   * its screen. If the hardware is already bound, returns its token instead.
   */
  async startPairing(hardwareId, deviceName) {
    const existing = this.db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.hardwareId, hardwareId))
      .limit(1)
      .all();
    if (existing[0]) {
      return { alreadyPaired: true, deviceToken: existing[0].deviceToken };
    }

    // Clear any stale pending sessions for this hardware, then issue a new code.
    this.db
      .delete(schema.pairingSessions)
      .where(eq(schema.pairingSessions.hardwareId, hardwareId))
      .run();
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    this.db
      .insert(schema.pairingSessions)
      .values({ code, hardwareId, deviceName: deviceName || null, expiresAt })
      .run();
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /** Device-facing: poll a session by hardware; returns the token once claimed. */
  async pollPairing(hardwareId) {
    const rows = this.db
      .select()
      .from(schema.pairingSessions)
      .where(eq(schema.pairingSessions.hardwareId, hardwareId))
      .orderBy(desc(schema.pairingSessions.createdAt))
      .limit(1)
      .all();
    const s = rows[0];
    if (!s) return { status: "none" };
    if (s.status === "claimed")
      return { status: "paired", deviceToken: s.deviceToken };
    if (new Date(s.expiresAt).getTime() < Date.now())
      return { status: "expired" };
    return { status: "pending" };
  }

  /**
   * App-facing (authenticated): the user types the code shown on the device.
   * Binds the hardware to this user (exclusive) and issues the device token.
   */
  async claimCode(userId, code, deviceName) {
    const rows = this.db
      .select()
      .from(schema.pairingSessions)
      .where(eq(schema.pairingSessions.code, code))
      .limit(1)
      .all();
    const s = rows[0];
    if (!s) return { ok: false, error: "invalid_code" };
    if (s.status === "claimed") return { ok: false, error: "code_used" };
    if (new Date(s.expiresAt).getTime() < Date.now())
      return { ok: false, error: "code_expired" };

    // Exclusivity: the hardware can only ever belong to one account.
    const existing = this.db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.hardwareId, s.hardwareId))
      .limit(1)
      .all();
    if (existing[0] && existing[0].userId !== userId) {
      return { ok: false, error: "device_taken" };
    }

    const deviceToken = existing[0]?.deviceToken || newToken();
    if (!existing[0]) {
      this.db
        .insert(schema.devices)
        .values({
          id: newId("dev"),
          hardwareId: s.hardwareId,
          userId,
          name: deviceName || s.deviceName || null,
          deviceToken,
        })
        .run();
    }
    this.db
      .update(schema.pairingSessions)
      .set({ status: "claimed", userId, deviceToken, claimedAt: new Date() })
      .where(eq(schema.pairingSessions.code, code))
      .run();
    return { ok: true, hardwareId: s.hardwareId };
  }

  async removeDevice(userId, deviceId) {
    this.db
      .delete(schema.devices)
      .where(
        and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, userId)),
      )
      .run();
    return { ok: true };
  }

  // ---- Account --------------------------------------------------------------

  /** Deletes the user; FK cascade removes sessions, onboarding, devices, codes. */
  async deleteUser(userId) {
    this.db.delete(schema.users).where(eq(schema.users.id, userId)).run();
    return { ok: true };
  }
}
