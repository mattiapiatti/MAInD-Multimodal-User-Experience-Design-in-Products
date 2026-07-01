# Kai — mobile web app

Mobile-only web app for Kai, the voice health companion. Handles **accounts,
first-login onboarding, exclusive device pairing, insights (charts + PDF), and
data/privacy controls**.

Stack: **Next.js 16 (App Router, JS, CSS Modules), Better Auth, Drizzle ORM**,
deployed to **Cloudflare Workers via OpenNext**. All backend state (accounts,
sessions, onboarding, devices, pairing) lives in a single **Durable Object with
SQLite storage** — not D1, not a local file. Migrations are bundled and applied
inside the Durable Object on boot.

## Run locally (dev)

```bash
cd webapp
npm install
cp .env.example .dev.vars      # set BETTER_AUTH_SECRET (a 32+ char random string)
npm run db:generate            # regenerate SQL migrations after a schema change
npm run dev                    # http://localhost:3000  (wrangler dev + OpenNext)
```

`npm run dev` runs the Worker locally with the Durable Object — there is no
separate migrate step and no local `.db` file, the DO applies the bundled
migrations itself.

## Build & deploy (Cloudflare)

```bash
npm run cf:build      # OpenNext build for Workers
npm run cf:preview    # run the built Worker locally
npm run cf:deploy     # wrangler deploy
```

Config lives in `wrangler.jsonc` (the `AUTH_DO` Durable Object binding,
`BETTER_AUTH_URL`, static assets). Set the `BETTER_AUTH_SECRET` secret with
`wrangler secret put` for the deployed Worker, or in `.dev.vars` for local dev.

## How it fits together

- **Auth** — email/password via Better Auth. Email verification is **off** in
  this prototype (no mail service); tighten when email is wired.
- **Onboarding gate** — new users land on `/onboarding` until they finish; the
  health profile is editable later in Settings. The session cookie cache is
  disabled so completing onboarding takes effect immediately.
- **Device pairing** — the **device** starts pairing (`POST /api/device/pair/start`)
  and shows a 6-char code; the signed-in user types that code in the app to claim
  it, then the device polls (`POST /api/device/pair/poll`) — presenting the secret
  it kept — to receive its `deviceToken` (handed over once). A `UNIQUE` constraint
  on `hardwareId` guarantees a unit belongs to **one account only**. A one-tap
  button demos the flow without hardware.
- **Insights** — charts (recharts) and a downloadable PDF report
  (`/api/report`, pdf-lib). Data is currently **mock** (`src/lib/mock/health.js`)
  with the same shape the structured memory will return later.
- **Data & privacy** — wipe Kai's memory (best-effort call to the voice
  backend's HTTP API) or delete the account (cascades to profile, devices,
  sessions).

## Layout

```
src/
  app/
    (auth)/           login, register
    (app)/            home, insights, device, settings  (gated: logged-in + onboarded)
    onboarding/       first-login wizard
    api/auth/         Better Auth handler
    api/device/pair/  device pairing: start + poll
    api/report/       PDF generation
  backend/
    do.js             the Durable Object — SQLite + Better Auth + pairing (the whole backend)
  components/         ui/, shell/ (tab bar), onboarding/, device/, settings/, insights/
  db/                 schema.js   (Drizzle schema; SQL migrations live in ../drizzle/)
  lib/                voicebot.js, ids.js, env.js, mock/
```
