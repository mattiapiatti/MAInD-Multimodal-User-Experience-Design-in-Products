import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { getDb, schema } from "@/db";

// A host is on the local network (so we trust it for CSRF on this prototype):
// loopback, *.local (mDNS), and the RFC1918 private IPv4 ranges.
function isPrivateHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

// Dynamically trust the request's own origin when it's a LAN address. This lets
// the phone reach the app at http://<mac-lan-ip>:3000 without hardcoding the IP
// or restarting when it changes. Safe here because the server is only reachable
// on the local network.
function lanTrustedOrigins(request) {
  const origins = new Set();
  try {
    const ref = request?.headers?.get("origin") || request?.headers?.get("referer");
    if (ref) {
      const u = new URL(ref);
      if (isPrivateHost(u.hostname)) origins.add(u.origin);
    }
    const host =
      request?.headers?.get("x-forwarded-host") || request?.headers?.get("host");
    if (host) {
      const hostname = host.split(":")[0];
      if (isPrivateHost(hostname)) {
        const proto = request?.headers?.get("x-forwarded-proto") || "http";
        origins.add(`${proto}://${host}`);
      }
    }
  } catch {
    /* ignore malformed headers */
  }
  return [...origins];
}

// Self-hosted: a single Better Auth instance for the whole process (no
// per-request D1 binding). Memoized on a module global so dev hot-reload reuses
// it.
let _auth = globalThis.__voicebotAuth;

export function getAuth() {
  if (_auth) return _auth;

  const env = getEnv();
  const db = getDb();

  _auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // Trust localhost, the configured public URL, and (dynamically) any LAN
    // origin the request actually comes from — so phones on the same Wi-Fi work.
    trustedOrigins: (request) => {
      const base = [env.BETTER_AUTH_URL, "http://localhost:3000"].filter(Boolean);
      return [...new Set([...base, ...lanTrustedOrigins(request)])];
    },

    // In-memory rate limiting is fine for a single self-hosted instance.
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 900, max: 10 },
        "/sign-up/email": { window: 3600, max: 10 },
      },
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
      // Prototype: no email service runs locally, so we skip verification and
      // let people sign in immediately. (Tighten this when email is wired.)
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days — it's a personal device
      updateAge: 60 * 60 * 24,
      // No cookie cache: the onboarding gate reads `onboardingCompleted` from
      // the session on every request, so completing onboarding takes effect
      // immediately (a cached cookie would bounce the user back to /onboarding).
      cookieCache: { enabled: false },
    },

    advanced: {
      cookiePrefix: "voicebot",
    },

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

    // nextCookies must be the last plugin.
    plugins: [nextCookies()],
  });

  globalThis.__voicebotAuth = _auth;
  return _auth;
}
