# Kai — mobile web app

Mobile-only web app on top of Kai, the local voice health assistant. Handles
**accounts, first-login onboarding, exclusive device pairing, insights (charts +
PDF), and data/privacy controls**. Self-hosted next to the voice backend; data
stays on your machine.

Stack runs fully local: **Next.js 16 (App
Router, JS, CSS Modules), Better Auth, Drizzle ORM on local SQLite**
(`better-sqlite3`). No Cloudflare, no cloud.

## Run locally (without Docker)

```bash
cd webapp
cp .env.example .env          # adjust BETTER_AUTH_SECRET / URL
npm install
npm run db:generate           # create SQL migrations from the schema (first time)
npm run db:migrate            # apply them → data/app.db
npm run dev                   # http://localhost:3000
```

## Run with Docker (alongside the voice backend)

From the project root:

```bash
docker compose up --build webapp
```

Open it on a **phone on the same Wi-Fi** at `http://<host-ip>:3000`. Set the
public origin so Better Auth cookies/redirects work:

```bash
WEBAPP_PUBLIC_URL=http://192.168.1.20:3000 \
WEBAPP_AUTH_SECRET=$(openssl rand -base64 32) \
docker compose up --build webapp
```

## How it fits together

- **Auth** — email/password via Better Auth. Email verification is **off** in
  this prototype (no local mail service); tighten when email is wired.
- **Onboarding gate** — new users land on `/onboarding` until they finish; the
  health profile is editable later in Settings. Cookie session cache is disabled
  so completing onboarding takes effect immediately.
- **Device pairing** — the app generates a 6-char code. The Arduino Uno Q claims
  it via `POST /api/pair { code, hardwareId }` and receives a `deviceToken` to
  present on the voice backend's WebSocket `hello` handshake. A `UNIQUE`
  constraint on `hardwareId` guarantees a unit belongs to **one account only**.
  A "Simula associazione" button demos the flow without hardware.
- **Insights** — charts (recharts) and a downloadable PDF report
  (`/api/report`, pdf-lib). Data is currently **mock** (`src/lib/mock/health.js`)
  with the same shape the structured memory will return later.
- **Data & privacy** — wipe Kai's memory (best-effort call to the
  voice backend's HTTP API) or delete the account (cascades to profile, devices,
  sessions).

## Layout

```
src/
  app/
    (auth)/         login, register
    (app)/          home, insights, device, settings  (gated: logged-in + onboarded)
    onboarding/     first-login wizard
    api/auth/       Better Auth handler
    api/pair/       device claim endpoint
    api/report/     PDF generation
  components/       ui/, shell/ (tab bar), onboarding/, device/, settings/, insights/
  db/               schema.js, index.js (SQLite), migrate.mjs, migrations/
  lib/              auth/, data/, validation/, mock/, voicebot.js, ids.js, env.js
```
