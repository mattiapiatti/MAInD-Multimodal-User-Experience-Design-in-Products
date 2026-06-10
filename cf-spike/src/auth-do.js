import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import migrations from "../drizzle/migrations.js";
import * as schema from "./schema.js";

// The whole auth/account store lives inside one Durable Object. Better Auth runs
// here, against Drizzle's durable-sqlite driver bound to this DO's storage. The
// Worker forwards /api/auth/* requests to this DO's fetch() handler.
export class AuthDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema, logger: false });

    // Run migrations once, before any query is served.
    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, migrations);
    });

    this.auth = betterAuth({
      baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
      secret: env.BETTER_AUTH_SECRET || "spike-secret-at-least-32-characters-long",
      trustedOrigins: [env.BETTER_AUTH_URL || "http://localhost:8787"],
      database: drizzleAdapter(this.db, {
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
      },
      session: { cookieCache: { enabled: false } },
      user: {
        additionalFields: {
          onboardingCompleted: {
            type: "boolean",
            defaultValue: false,
            input: false,
          },
        },
      },
    });
  }

  // Run the Better Auth HTTP handler (sign-up, sign-in, get-session, ...).
  fetch(request) {
    return this.auth.handler(request);
  }

  // RPC: how a Server Component would read the session in the real app.
  async getSession(headers) {
    return this.auth.api.getSession({ headers: new Headers(headers) });
  }
}
