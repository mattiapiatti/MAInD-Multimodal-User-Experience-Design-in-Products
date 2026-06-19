# Kai — Design Brief

**Kai** is a calm, private voice health companion delivered as a **mobile-only web app**. It sits on top of a local, self-hosted voice device (Arduino Uno Q) and handles accounts, first-login onboarding, exclusive device pairing, insights (charts + downloadable PDF), and data/privacy controls. Everything runs fully local — no cloud, your data stays on your device — with a gentle, reassuring tone and a sage/mint wellness brand.

## Design principles

- **Calm clinical**: reassuring, low-pressure, privacy-forward — health data is local-only; favor gentle guidance over clinical density.
- **Mobile-first single column**: one vertical phone frame locked to `--content-max: 480px` even on desktop, with a fixed bottom tab bar.
- **Generous whitespace**: warm neutral background, breathing room between stacked cards, compact summaries that only show filled values.
- **Soft cards**: white surfaces, rounded corners (`--radius-card: 16px`), subtle card elevation shadow.
- **One mint accent**: a single sage/mint accent (`#2f8062`) carries all emphasis — numbers, links, active states, primary buttons.
- **Accessible contrast & native feel**: 16px form fonts (prevents iOS focus-zoom), `aria-pressed`/`aria-current` states, antialiased Swiss-grotesque type, standalone home-screen feel.

## Design system

Calm, healthcare-oriented mobile-only app. Swiss-grotesque base, warm neutral surfaces, teal/green wellness accent.

### Colors

**Brand / accent (mint green family)**

| Token | Value | Role |
|---|---|---|
| `--color-accent` | `#2f8062` | Primary accent |
| `--color-accent-strong` | `#266b50` | Pressed / emphasized accent |
| `--color-accent-soft` | `#e6f3ec` | Tinted accent background |
| `--color-accent-fg` | `#ffffff` | Foreground on accent |

**Surfaces & text**

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#f4f5f4` | App background (warm neutral) |
| `--color-surface` | `#ffffff` | Cards / sheets |
| `--color-inset` | `#eef0ef` | Inset / recessed fields |
| `--color-border` | `#e3e5e3` | Borders / dividers |
| `--color-fg` | `#1a1c1b` | Primary text |
| `--color-fg-muted` | `#6b6f6d` | Secondary text |
| `--color-fg-faint` | `#9aa09d` | Tertiary / placeholder text |

**State colors (each with a soft tint)**

| Token | Value | Soft token | Soft value |
|---|---|---|---|
| `--color-danger` | `#c0392b` | `--color-danger-soft` | `#fdecea` |
| `--color-success` | `#1e7e44` | `--color-success-soft` | `#e9f6ee` |
| `--color-warning` | `#b8860b` | `--color-warning-soft` | `#fbf3e0` |
| `--color-info` | `#2a4a73` | `--color-info-soft` | `#eef3fb` |

**Chart palette (insights)**

| Token | Value |
|---|---|
| `--chart-1` | `#2f8062` (teal-green, = accent) |
| `--chart-2` | `#4a9cc7` (blue) |
| `--chart-3` | `#d98a3d` (amber) |
| `--chart-4` | `#9b6bc4` (purple) |

### Typography

- **Display stack** (`--font-display`): `"Helvetica Neue", "Helvetica Now Display", Helvetica, Arial, sans-serif`
- **UI stack** (`--font-ui`): `"Helvetica Neue", Helvetica, Arial, sans-serif` (no licensed font shipped; system grotesque)
- **Body**: `--font-ui`, weight `400`, size `16px`, line-height `1.45`, color `--color-fg`, background `--color-bg`. Antialiased.
- **Headings** (`h1`–`h4`): weight `700`, line-height `1.2`.
- **Form controls** (`input`, `select`, `textarea`): font-size `16px` (≥16px prevents iOS Safari focus-zoom); text is user-selectable (app body otherwise has `user-select: none`).
- Only two weights in use — `400` (body/regular) and `700` (headings/bold).

### Spacing scale

| Token | Value |
|---|---|
| `--gap-xs` | `6px` |
| `--gap-sm` | `10px` |
| `--gap-md` | `16px` |
| `--gap-lg` | `24px` |
| `--gap-xl` | `40px` |

### Radius scale

| Token | Value |
|---|---|
| `--radius-sm` | `8px` |
| `--radius` | `12px` |
| `--radius-lg` | `18px` |
| `--radius-card` | `16px` |
| `--radius-field` | `12px` |
| `--radius-pill` | `999px` |

### Shadows

| Token | Value | Role |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow` | `0 4px 16px rgba(0,0,0,0.07)` | Card elevation |
| `--shadow-up` | `0 -2px 14px rgba(0,0,0,0.06)` | Bottom bar / upward shadow |

### Z-index

| Token | Value |
|---|---|
| `--z-nav` | `100` |
| `--z-header` | `90` |
| `--z-modal` | `300` |
| `--z-toast` | `400` |

### Mobile shell metrics

| Token | Value | Role |
|---|---|---|
| `--tabbar-h` | `64px` | Bottom tab bar height |
| `--topbar-h` | `56px` | Top bar height |
| `--content-max` | `480px` | Content column max width (phone-width lock, even on desktop) |

### Transition

- `--transition`: `0.2s ease` (single global easing token).

### Global behavior notes (load-bearing for native feel)

- `box-sizing: border-box` on all elements; all margins/padding reset to `0`.
- `html, body { height: 100% }`; `overscroll-behavior-y: none`.
- App-wide `user-select: none` and `-webkit-tap-highlight-color: transparent`, `-webkit-touch-callout: none` for a standalone/home-screen feel; text inputs re-enable selection.
- `a` inherits color, no underline; `button` inherits font-family.

## Components

- **Screen scaffold**: a sticky title header (`.header`) with an `<h1 class=".title">` and optional right-aligned `.action` slot, above a scrollable content column (`<main class=".content">`) padded clear of the bottom tab bar.
- **TabBar**: fixed bottom `<nav aria-label="Main navigation">`, height `64px`, upward shadow. Each tab is a `next/link` rendering an icon (`aria-hidden`) above a label. Active when `pathname === href` or `pathname.startsWith(href + "/")`, sets `aria-current="page"`; each link has `aria-label={label}`.
- **Card**: white surface, `--radius-card`, `--shadow`; optional `title`, `subtitle`, leading `icon`, `padded` flag, and a footer slot.
- **Button**: primary (mint accent) and `variant="secondary"`; supports `fullWidth`, `type="submit"`, and a `loading` spinner state.
- **TextField**: label above input, optional hint, placeholder, `autoComplete`, supports `type="date"`; inline validation error text.
- **Alert**: `tone="error"` / `tone="success"`, rendered above form fields.
- **ChipGroup**: grid of toggle `chip` buttons (`gridTemplateColumns: repeat(N,1fr)`); active = `chipActive`; multi-select; `aria-pressed`.
- **RadioCards**: vertical `radioList` of `radioCard` buttons, each with a leading round `radioDot`; single-select; active = `radioActive`; `aria-pressed`.
- **CheckCards**: same card styling as RadioCards but with a leading square `checkDot`; multi-select toggle; `aria-pressed`.
- **Avatar**: 48×48px circle, single uppercased initial, diagonal mint gradient `linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%)`, `--color-accent-fg` text.
- **Brand mark**: an 18×18px `brandDot` circle with mint gradient and a soft `--color-accent-soft` halo, optionally beside a bold brand name.
- **DeviceManager / DangerZone / DownloadReport / SignOutButton**: composite blocks described per-screen below.

## Screens

### Auth (login / register)

Two screens (`/login`, `/register`) sharing one layout: a centered card floating on a soft, calm gradient. Mobile-first, max-width `400px`. If already authenticated, redirects to `/home` (or `/onboarding` if onboarding incomplete).

**Layout shell** — full-height centered column (`min-height: 100dvh`, flex column, centered both axes, `gap: 16px`, `padding: 24px`). Background: layered `radial-gradient(120% 70% at 50% -10%, var(--color-accent-soft) 0%, transparent 60%)` over `var(--color-bg)` — a soft accent glow blooming from top-center.

Top-to-bottom:

1. **Card** (`width: 100%`, `max-width: 400px`, surface, `1px solid var(--color-border)`, `--radius-lg`, `--shadow`, padding `28px 24px 30px`, flex column `gap: 22px`).
2. **Brand mark** (`.brand`): row, `gap: 9px` — `brandDot` (18×18, mint gradient, halo) + brand name **"Companion"** (`17px`, weight `700`).
3. **Header block** (`gap: 6px`): `.title` (`23px`, `700`) + `.subtitle` (`14px`, `400`, muted).
   - Login — Title: **"Welcome back"**, Subtitle: **"Sign in to your companion."**
   - Register — Title: **"Create your account"**, Subtitle: **"It only takes a few seconds. Then we'll set up your companion together."**
4. **Form** (`gap: 16px`, `noValidate`). Error `<Alert tone="error">` renders at top of form on failure.

   Login fields (`TextField`, label above input):

   | Label | Type | Placeholder | autoComplete |
   |---|---|---|---|
   | Email | email | `you@example.com` | email |
   | Password | password | `••••••••` | current-password |

   _(Demo note: login form is prefilled with demo credentials; any submit logs straight in via `/api/dev-login`.)_

   Register fields:

   | Label | Type | Placeholder | autoComplete |
   |---|---|---|---|
   | Your name | text | `Your name` | name |
   | Email | email | `you@example.com` | email |
   | Password | password | `At least 8 characters` | new-password |
   | Confirm password | password | `Repeat your password` | new-password |

   Register consent row (`.checkboxRow`, `gap: 10px`, `13px`): checkbox 18×18 (`accent-color: var(--color-accent)`, top-aligned) + label **"I consent to the processing of my health data so the companion can work. It stays on my device."** Consent error (`.checkError`, `12px`, danger).
5. **Primary button** (`Button`, `fullWidth`, `type="submit"`, `loading={isSubmitting}`): Login **"Sign in"** · Register **"Create account"**.
6. **Footer link** (`.footer`, centered, `13px`, muted; link in accent, weight `600`):
   - Login: "Don't have an account? **Sign up**" → `/register`
   - Register: "Already have an account? **Sign in**" → `/login`
7. **Legal line** below the card (`.legal`, max-width 400px, `12px`, faint): **"Voice companion for hormonal health · your data stays on your device"**.

**States**: server-failure error alerts — Login: **"Sign-in failed. Please try again."** · Register: **"An account with this email already exists."** (email exists) or **"Sign-up failed. Please try again."**

### Onboarding wizard

First-login flow at `/onboarding` (gated on `user.onboardingCompleted`; redirects to `/home` if done). Intro header above a card containing the wizard form.

**Page shell (intro, above the wizard card):**

- `brandDot` (decorative, `aria-hidden`).
- `h1`: **"Hi, {user.name}"** (renders **"Hi"** alone when no name).
- `lead`: **"Let's set up your companion. Just four steps — you can change everything later in settings."** _(copy says "four steps"; the wizard actually has 5.)_

**Stepper**: progress dots, one `dot` per step; dots at index `<= step` get `dotOn` (cumulative fill). Step title rendered as `<h2 className={styles.stepTitle}>`.

| # | Step title (h2) | Fields |
|---|---|---|
| 0 | **What's your name** | `preferredName`, `pronouns` |
| 1 | **Your journey** | `careContext` |
| 2 | **Your therapy** | `hormoneMethod` |
| 3 | **Where you are** | `stage` |
| 4 | **Last details** | `therapyStartDate`, `language` |

**Per-step fields, components & copy:**

- **Step 0 — "What's your name"**
  - `TextField` label **"Your name"**, hint **"(this is the name that your companion will use)"**, placeholder **"e.g. Sam"**. Error: **"Enter a name"** (max 60 chars).
  - Field label **"Pronouns"** — `CheckCards` (multi-select, square `checkDot`). Error: **"Select your pronouns"**. Options (value === label): **She/Her**, **He/Him**, **They/Them**.
- **Step 1 — "Your journey"**
  - Field label **"What's your journey?"** — `CheckCards` (multi-select). Error: **"Select at least one"**. Options (value → label): `gender_affirming` → **Gender-affirming therapy**, `menopause` → **Menopause / HRT**, `contraception` → **Contraception**, `pmos` → **PMOS**, `endometriosis` → **Endometriosis**, `other` → **Other**.
- **Step 2 — "Your therapy"**
  - Field label **"How do you take it?"** — `RadioCards` (single-select, round `radioDot`). Error: **"Select an option"**. Options: `gel` → **Gel**, `injection` → **Injection**, `pill` → **Pill**, `patch` → **Patch**, `other` → **Other**, `nothing` → **Nothing**.
- **Step 3 — "Where you are"**
  - Field label **"Where are you?"** — `RadioCards` (single-select). Error: **"Select an option"**. Options: `starting` → **Starting**, `few_months` → **A few months in**, `further` → **Further along**.
- **Step 4 — "Last details"**
  - `TextField` label **"Therapy start (optional)"**, `type="date"`. Validation regex `YYYY-MM-DD`, error **"Invalid date"**; empty allowed.
  - Field label **"Companion language"** — `RadioCards` (single-select). Options: `en` → **English**, `it` → **Italiano**.

**Navigation** (`styles.nav`, bottom of form):

- **Back**: secondary `Button`, only when `step > 0` (else an empty `<span />` spacer keeps right-alignment). Decrements step.
- **Next**: primary `Button` on all non-last steps; validates current step via `trigger(STEPS[step].fields)`, advances only if valid.
- **Save (last step)**: primary `Button type="submit"`, label **"Get started"**, shows `loading` while submitting.
- Server error: on `res.ok === false`, `<Alert tone="error">` **"Check the fields and try again."** above the fields.

**Edit-mode-only blocks (NOT in the wizard; shown all-at-once in Profile edit):**

- `goals` — field label **"What do you want to get out of it?"**, `ChipGroup` (1 column). Options: `track_symptoms` → **Track symptoms over time**, `understand_changes` → **Understand changes in my body**, `prepare_appointments` → **Prepare for appointments**, `emotional_support` → **Support in difficult moments**.
- `trackedSymptoms` — field label **"Symptoms to track (optional)"**, `ChipGroup` (2 columns). Options: **Hot flashes**, **Mood swings**, **Fatigue**, **Headaches**, **Sleep changes**, **Skin changes**, **Pain**, **Bleeding**.

**Defaults / validation**: `preferredName: ""`, `pronouns: []`, `careContext: []`, `hormoneMethod: undefined`, `stage: undefined`, `goals: []`, `trackedSymptoms: []`, `therapyStartDate: ""`, `language: "en"`. Required to submit: name (1–60), ≥1 pronoun, ≥1 careContext, a hormoneMethod, a stage. `goals`/`trackedSymptoms`/`therapyStartDate` optional.

### Home

`<Screen title="Hi, <name>">` (e.g. **"Hi, Sarah"**, falls back to **"Hi"**; name = `profile.preferredName` → `user.name` → `""`). Tab title "Home". Three stacked `Card` components.

**1. Stats card** (`padded`): 3-column grid (`repeat(3, 1fr)`, `gap: 8px`, centered). Each stat is a column (`gap: 2px`, `padding: 6px 0`):

- Number (`.statNum`): `26px`, weight `700`, `var(--color-accent)`, `letter-spacing: -0.02em`.
- Label (`.statLbl`): `12px`, muted.

Stats in order: **28** "check-ins" · **5** "day streak" · **3** "tracked symptoms". Below, a last-check-in line (`.lastCheckin`, top border `1px solid var(--color-border)`, `13px`, muted, centered): **"Last check-in: last night"**.

**2. Device card** — `Card title="Device" subtitle="Pair and manage Kai." padded`, holds `DeviceManager`. `hasDevice = devices.some(d => d.status === "active")`.

- **Pair a device panel** (`Card title="Pair a device" subtitle="Bring Kai online and link it to your account." padded`, shown only when `!hasDevice`):
  - On error, `<Alert tone="error">` above content: `device_taken` → **"This device is already paired to another account."**; otherwise **"Pairing failed. Try again."**
  - Body (`.pairKai`, row, `gap: 16px`): left text column (`gap: 14px`) with copy (`.pairKaiCopy`, `14px`, line-height `1.45`, muted) **"Kai is your voice companion. Tap to pair it with this account."** + primary `Button` **"Pair Kai"** (loading spinner when `busy === "sim"`). Right art column (`.pairKaiArt`, width `132px`): `<img src="/kai.png" alt="Kai voice device" width={483} height={520}>` (transparent-background Kai device photo; `width: 100%; height: auto; display: block`).
- **Paired devices list** (`Card title="Paired devices" padded`, shown when `devices.length > 0`): `<ul>` (`gap: 14px`). Each row: status dot (12×12, `var(--color-success)`; `revoked` → `var(--color-fg-faint)`), body (`gap: 2px`) with name `<strong>` (`15px`, default **"Voice unit"**) and meta (`12px`, muted, ellipsis) **`<hardwareId> · since <date>`** (date as `en-GB` "12 June 2026"), and **"Unpair"** button (borderless, danger, `13px`, weight `600`); native `confirm("Unpair this device?")` then `removeDeviceAction(id)`.
- **Exclusivity note** (`.exclusivity`, always): **"Once paired, a device belongs exclusively to your account: it can't be linked to anyone else until you unpair it."** (`12px`, line-height `1.5`, faint, centered).

**3. Recent insights card** — `Card title="Recent insights" subtitle="A summary of your last few days" padded`. Timeline `<ul>` (`gap: 14px`); each item row (`gap: 12px`, `align-items: baseline`) with date (`.tDate`, fixed `52px`, `12px`, weight `600`, accent) + text (`.tText`, `14px`):

1. **Jun 10** — "Evening check-in: mood steady, sleep improved."
2. **Jun 7** — "Reported an evening hot flash, medium intensity."
3. **Jun 3** — "3 months on therapy — no adverse effects."
4. **May 28** — "Energy dipped for a few days, then recovered."

Footer link (`.footerLink`): `Link` to `/insights` with `PulseIcon` (18×18) + **"See all insights"** (inline-flex, `gap: 8px`, `14px`, weight `600`, accent).

### Insights

`<Screen title="Insights">` (tab title "Insights"). Vertical stack:

1. **Sample-data note** — `<p>` (`12px`, line-height `1.45`, faint): **"Sample data. It will connect to the companion's memory in a later phase."**
2. **KPI tiles** — 2-up grid (`.kpis`, `1fr 1fr`, `gap: 12px`). Each tile (`.kpi`, column, `gap: 2px`, `padding: 16px`, surface, `1px solid var(--color-border)`, `--radius-card`, `--shadow-sm`): number (`.kpiNum`, `28px`, weight `700`, accent, `letter-spacing: -0.02em`) + label (`.kpiLbl`, `12px`, muted).
   - Tile 1: `summary.checkins` — **"total check-ins"**.
   - Tile 2: `summary.streakDays` — **"day streak"**.
3. **Symptom frequency chart** — `<Card title="Symptom frequency" subtitle="Days per month" padded>` wrapping `<FrequencyChart>`: Recharts `BarChart` in `ResponsiveContainer` (`width="100%" height={200}`, `margin={{ top: 6, right: 8, left: -18, bottom: 0 }}`). `CartesianGrid` stroke `var(--color-border)`, `strokeDasharray="3 3"`, horizontal only. `XAxis` dataKey `"month"`, `YAxis` auto; ticks `{ fontSize: 11, fill: "var(--color-fg-muted)" }`, no tick/axis lines. `Tooltip` cursor fill `var(--color-inset)`, box `borderRadius: 12`, `1px solid var(--color-border)`, `fontSize: 12`. `Bar` dataKey `"days"`, name **"Days with symptoms"**, fill `var(--chart-1)`, top corner radius `[6, 6, 0, 0]`. Data: `{ month, days }[]`.
4. **Appointment record (PDF)** — `<Card title="Appointment record" subtitle="A PDF to share with your care team." padded>` containing `<DownloadReport />`.

### Profile

`<Screen title="Profile">` at `/settings` (tab title "Profile"). Three stacked `<Card>` components (all `padded`).

**Card 1 — Account** (`Card title="Account" padded`). Layout `.account`: row, `gap: 14px`.

- **Avatar** (`.avatar`, `aria-hidden`): 48×48, circle, single uppercased initial (first char of `user.name` → `user.email` → `"?"`), `20px`/`700`, `var(--color-accent-fg)`, diagonal mint gradient `linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%)`.
- **Account info** (`.accountInfo`, `gap: 2px`): name `<strong>` (`15px`, falls back to **"—"**) + email `<span>` (`13px`, muted, truncated).
- **Sign out** (`.signout`, `margin-top: 16px`): `<SignOutButton />`.

**Card 2 — Health profile** (`Card title="Health profile" icon={<PersonIcon />} subtitle="What you set during onboarding." padded`). Renders `OnboardingForm` in **edit (non-wizard) mode**, `submitLabel="Save changes"`. Three states:

- **State A — Read-only summary (default)**: a `<dl className={styles.summary}>` with one `.sumRow` (`dt .sumLabel` + `dd .sumValue`) per filled value (`.filter(r => r.text)`, compact). Rows: **Name** (`preferredName`), **Pronouns** (joined `", "`), **Journey** (`careContext` → labels), **How you take it** (`hormoneMethod` label), **Where you are** (`stage` label), **Goals** (labels), **Symptoms** (joined), **Therapy start** (raw date), **Language** (**"Italiano"** if `language === "it"`, else **"English"**). Below: full-width secondary button **"Edit"** → clears saved flag, enters edit mode.
- **State B — Full edit form**: `<form>` renders all field blocks at once (every option). Blocks: **Your name** (`TextField`), **Pronouns** (`CheckCards`), **What's your journey?** (`CheckCards`, error **"Select at least one"**), **How do you take it?** (`RadioCards`, error **"Select an option"**), **Where are you?** (`RadioCards`, error **"Select an option"**), **What do you want to get out of it?** (`ChipGroup`, 1 col), **Symptoms to track (optional)** (`ChipGroup`, 2 col), **Therapy start (optional)** (`TextField type="date"`), **Companion language** (`RadioCards`, inline `en`/`it`). Footer `.nav`: secondary **"Cancel"** (back to summary, no save) + primary submit **"Save changes"** (`loading={isSubmitting}`). On validation failure: `<Alert tone="error">` **"Check the fields and try again."**
- **State C — Saved confirmation**: returns to summary with `<Alert tone="success">` **"Profile updated."** The success alert clears as soon as "Edit" is pressed again.

**Card 3 — Data & privacy** (`Card title="Data & privacy" subtitle="You're fully in control of your data." padded`). Renders `<DangerZone />`. Layout `.zone` (column, `gap: 16px`); each `.row` (space-between, `gap: 14px`) has a `.text` block (`strong` title `14px`/`600`, `span` description `12px`, muted) on the left and a button on the right. Two rows: **wipe memory** and **delete account**.

_Note: the Device section is NOT on Profile — it lives on Home._

## Notes for generation

Render Kai as a **tall mobile frame (~390px wide)**, **light theme**. Lock the content column to a single centered phone width (max ~480px). Use a **sage-mint accent `#2f8062`** as the only accent — for primary buttons, links, active tab state, and the large numbers. Place **soft, rounded white cards (16px radius, subtle `0 4px 16px rgba(0,0,0,0.07)` shadow)** on a warm neutral **`#f4f5f4`** background, with generous whitespace between stacked cards. Add a **fixed bottom tab bar** (64px) with three tabs — Home, Insights, Profile — each an icon above a label, the active one tinted mint. Type is a clean system grotesque (Helvetica Neue), only weights 400 and 700. On the **Home** screen, reuse the **Kai device photo (`/kai.png`, 483×520, transparent background)** in the "Pair a device" card's right-hand art column. Keep the tone calm, private, and reassuring throughout.
