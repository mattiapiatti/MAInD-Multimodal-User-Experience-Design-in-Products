import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Integer timestamps default to unix seconds via unixepoch().
const now = sql`(unixepoch())`;

// =============================================================
// USERS — Better Auth manages this table; we add a couple of fields.
// =============================================================
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
    name: text("name"),
    image: text("image"),

    // Has the person completed the first-login onboarding?
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .default(false)
      .notNull(),

    // GDPR / lifecycle
    deletedAt: integer("deleted_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// =============================================================
// SESSIONS — Better Auth standard
// =============================================================
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
});

// =============================================================
// ACCOUNTS — Better Auth credentials/OAuth
// =============================================================
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
});

// =============================================================
// VERIFICATIONS — Better Auth (email verify / password reset)
// =============================================================
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
});

// =============================================================
// ONBOARDING — the health profile collected on first login and editable
// later in settings. One row per user.
// =============================================================
export const onboardingProfiles = sqliteTable("onboarding_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Free-form display name the assistant uses.
  preferredName: text("preferred_name"),
  // Pronouns the assistant should use (e.g. "she/her", "they/them").
  pronouns: text("pronouns"),
  // Care context, one of a known set; drives the system prompt framing.
  careContext: text("care_context", {
    enum: [
      "gender_affirming",
      "menopause",
      "contraception",
      "pcos",
      "endometriosis",
      "other",
    ],
  }),
  // What the person wants to get out of it (multi-select stored as JSON array).
  goals: text("goals", { mode: "json" }),
  // Symptoms they want to track (JSON array of strings).
  trackedSymptoms: text("tracked_symptoms", { mode: "json" }),
  // Optional therapy start date (ISO yyyy-mm-dd) for timeline framing.
  therapyStartDate: text("therapy_start_date"),
  // Spoken-language preference for the voice assistant.
  language: text("language", { enum: ["it", "en"] }).default("it").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
});

// =============================================================
// DEVICES — Arduino Uno Q voice units. A device can be bound to AT MOST ONE
// account: the unique constraint on hardwareId enforces "once associated, never
// re-associated to another account". Pairing happens with a short-lived code.
// =============================================================
export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),

    // Stable hardware identity reported by the unit (serial/MAC-derived).
    // UNIQUE across the whole table → global, exclusive ownership.
    hardwareId: text("hardware_id").notNull().unique(),

    // The owning account. Set at pairing time, never reassigned.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Human label shown in the app ("Bedroom unit").
    name: text("name"),

    // Secret token the device presents on the WebSocket `hello` handshake so the
    // voice backend can scope memory to the right user. Opaque, rotatable.
    deviceToken: text("device_token").notNull().unique(),

    status: text("status", { enum: ["active", "revoked"] })
      .default("active")
      .notNull(),

    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),

    pairedAt: integer("paired_at", { mode: "timestamp" }).default(now).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(now).notNull(),
  },
  (t) => [
    uniqueIndex("devices_hardware_idx").on(t.hardwareId),
    uniqueIndex("devices_token_idx").on(t.deviceToken),
    index("devices_user_idx").on(t.userId),
  ],
);

// =============================================================
// PAIRING CODES — short-lived codes the app generates; the device claims one to
// bind itself. Consumed on success.
// =============================================================
export const pairingCodes = sqliteTable(
  "pairing_codes",
  {
    code: text("code").primaryKey(), // 6-char human-typeable
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(now).notNull(),
  },
  (t) => [index("pairing_codes_user_idx").on(t.userId)],
);
