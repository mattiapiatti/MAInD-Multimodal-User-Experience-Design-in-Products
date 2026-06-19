import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { and, eq, desc } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import migrations from "../../drizzle/migrations.js";
import * as schema from "../db/schema.js";
import { newId, newToken, newPairingCode, hashSecret } from "../lib/ids.js";

const PAIRING_TTL_MS = 10 * 60 * 1000;

// DEMO ONLY — the fixed password devSignIn forces onto an account so a session
// can be minted without the real one. Never used by the normal sign-in path.
const DEMO_PASSWORD = "demo-login-please-change-0123456789";
// Neutral demo identity shown in the account (overrides the real name on login).
const DEMO_NAME = "Andrea Clarke";

// pronouns / careContext are multi-select, stored as a JSON string. Decode
// tolerantly so legacy single-string rows (pre multi-select) still read.
function toList(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [v];
  }
}

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

  /**
   * DEMO ONLY — frictionless sign-in for showcasing the app without a password.
   * Forces a known password onto the account (creating it if it doesn't exist),
   * then mints a real Better Auth session and returns its Set-Cookie header(s).
   * The /api/dev-login route gates this to local/LAN (or a DEMO_LOGIN flag).
   */
  async devSignIn(email) {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return { ok: false, error: "missing_email" };

    let user = this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, clean))
      .limit(1)
      .all()[0];

    if (!user) {
      // No such account yet: create it via the normal sign-up path.
      await this.auth.api.signUpEmail({
        body: { email: clean, password: DEMO_PASSWORD, name: DEMO_NAME },
      });
      user = this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, clean))
        .limit(1)
        .all()[0];
    } else {
      // Existing account: overwrite the credential password with the known one
      // and normalise the display name to the neutral demo identity.
      const ctx = await this.auth.$context;
      const hash = await ctx.password.hash(DEMO_PASSWORD);
      this.db
        .update(schema.users)
        .set({ name: DEMO_NAME, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id))
        .run();
      const acct = this.db
        .select()
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.userId, user.id),
            eq(schema.accounts.providerId, "credential"),
          ),
        )
        .limit(1)
        .all()[0];
      const nowDate = new Date();
      if (acct) {
        this.db
          .update(schema.accounts)
          .set({ password: hash, updatedAt: nowDate })
          .where(eq(schema.accounts.id, acct.id))
          .run();
      } else {
        this.db
          .insert(schema.accounts)
          .values({
            id: newId(),
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: hash,
            createdAt: nowDate,
            updatedAt: nowDate,
          })
          .run();
      }
    }

    // Keep the demo account always "ready": onboarded + a profile, with the
    // neutral demo greeting — so a demo sign-in never drops into onboarding.
    if (user) {
      const prof = this.db
        .select()
        .from(schema.onboardingProfiles)
        .where(eq(schema.onboardingProfiles.userId, user.id))
        .limit(1)
        .all()[0];
      if (!prof) {
        await this.upsertOnboarding(
          user.id,
          {
            preferredName: DEMO_NAME.split(" ")[0],
            pronouns: ["They/Them"],
            careContext: ["menopause"],
            hormoneMethod: "gel",
            stage: "few_months",
            goals: [],
            trackedSymptoms: [],
            therapyStartDate: "",
            language: "en",
          },
          true,
        );
      } else {
        const nowDate = new Date();
        this.db
          .update(schema.onboardingProfiles)
          .set({ preferredName: DEMO_NAME.split(" ")[0], updatedAt: nowDate })
          .where(eq(schema.onboardingProfiles.userId, user.id))
          .run();
        this.db
          .update(schema.users)
          .set({ onboardingCompleted: true, updatedAt: nowDate })
          .where(eq(schema.users.id, user.id))
          .run();
      }
    }

    const res = await this.auth.api.signInEmail({
      body: { email: clean, password: DEMO_PASSWORD },
      asResponse: true,
    });
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
    return { ok: res.ok, cookies };
  }

  /** DEMO ONLY — drop all sessions so the browser's cookie stops authenticating
   *  (used by the dev sign-out to show the login screen again). */
  async devSignOutAll() {
    this.db.delete(schema.sessions).run();
    return { ok: true };
  }

  // ---- Onboarding -----------------------------------------------------------

  async getOnboarding(userId) {
    const rows = this.db
      .select()
      .from(schema.onboardingProfiles)
      .where(eq(schema.onboardingProfiles.userId, userId))
      .limit(1)
      .all();
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      pronouns: toList(row.pronouns),
      careContext: toList(row.careContext),
    };
  }

  async upsertOnboarding(userId, values, complete = false) {
    const nowDate = new Date();
    const payload = {
      preferredName: values.preferredName ?? null,
      pronouns: JSON.stringify(values.pronouns ?? []),
      careContext: JSON.stringify(values.careContext ?? []),
      hormoneMethod: values.hormoneMethod ?? null,
      stage: values.stage ?? null,
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
   * its screen. The device sends a high-entropy secret it keeps; the token is
   * later handed back ONLY to a poller presenting that same secret — so a bare
   * hardwareId can never retrieve a token. Never returns a token here.
   */
  async startPairing(hardwareId, deviceSecret, deviceName) {
    const deviceSecretHash = deviceSecret ? await hashSecret(deviceSecret) : null;
    // Drop any stale session for this hardware, then issue a fresh code. (A
    // device that lost its token must re-pair with a new user-entered code.)
    this.db
      .delete(schema.pairingSessions)
      .where(eq(schema.pairingSessions.hardwareId, hardwareId))
      .run();
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    this.db
      .insert(schema.pairingSessions)
      .values({
        code,
        hardwareId,
        deviceSecretHash,
        deviceName: deviceName || null,
        expiresAt,
      })
      .run();
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Device-facing: poll a session by hardware. The token is returned at most
   * once, and only to a caller presenting the matching secret. After delivery
   * the token is cleared from the session so it can't be re-fetched.
   */
  async pollPairing(hardwareId, deviceSecret) {
    const rows = this.db
      .select()
      .from(schema.pairingSessions)
      .where(eq(schema.pairingSessions.hardwareId, hardwareId))
      .orderBy(desc(schema.pairingSessions.createdAt))
      .limit(1)
      .all();
    const s = rows[0];
    if (!s) return { status: "none" };
    if (s.status !== "claimed") {
      if (new Date(s.expiresAt).getTime() < Date.now())
        return { status: "expired" };
      return { status: "pending" };
    }
    // Claimed. Hand the token over once, only to the device that started it.
    const ok =
      !s.deliveredAt &&
      s.deviceToken &&
      deviceSecret &&
      s.deviceSecretHash &&
      (await hashSecret(deviceSecret)) === s.deviceSecretHash;
    if (!ok) return { status: "paired" }; // no token (already delivered / wrong secret)

    this.db
      .update(schema.pairingSessions)
      .set({ deliveredAt: new Date(), deviceToken: null })
      .where(eq(schema.pairingSessions.code, s.code))
      .run();
    return { status: "paired", deviceToken: s.deviceToken };
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
