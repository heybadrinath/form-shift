# FORM / SHIFT

FORM / SHIFT is a private, single-owner training journal built as a personal project. It combines a mobile-first workout runner, persistent training history, a lightweight weight log, and a practical food reference for a beginner training with machines, dumbbells, cables, and bodyweight.

The app is intentionally narrow: it helps one person execute the next workout cleanly, resume it on another device, and review what was actually recorded. It is not a social fitness platform, calorie tracker, or medical service.

## What it does

- Provides five rolling workout templates, with Sessions A–C as the foundation and D–E as optional additions.
- Guides every exercise with sets, repetitions, effort targets, equipment notes, written form cues, and a four-panel instruction image.
- Supports 20 exercise families, 30 equipment variants, and 30 dedicated instruction assets.
- Records individual set completion, exercise completion, exercise skips, variant choices, session start/end times, and incomplete sessions.
- Keeps one active workout resumable after reload or browser closure.
- Shows a calendar and analytics view derived from saved workout history.
- Stores occasional body-weight measurements and supports adding or editing entries from Analytics.
- Includes a searchable food index for no-cook combinations, simple pan recipes, fruit and vegetables, protein add-ons, and foods to limit.
- Compares up to four food portions against rough energy and protein references without turning the comparison into a prescribed meal plan.
- Adapts from a desktop dashboard to a focused mobile runner and fixed bottom navigation.

## Screenshots

These captures come from the completed authenticated browser QA pass. They show the current desktop dashboard and the current mobile runner, food index, and analytics views.

![Current desktop workout dashboard](./docs/screenshots/dashboard-desktop.png)

| Mobile workout runner | Mobile food index | Mobile analytics |
| --- | --- | --- |
| ![Current mobile workout runner](./docs/screenshots/session-mobile.png) | ![Current mobile food index](./docs/screenshots/food-mobile.png) | ![Current mobile training analytics](./docs/screenshots/analytics-mobile.png) |

## Architecture

```text
React 19 + Vite client
        |
        | same-origin JSON requests
        v
Vercel Functions under /api
        |
        | shared request handlers and domain rules
        v
Drizzle ORM + Neon serverless driver
        |
        v
Neon Postgres
```

The owner PIN is submitted only to the same-origin unlock function; it is not bundled into or returned to the client. The cookie-signing secret and database connection string remain server-side. Vercel Functions use Web `Request` and `Response` semantics, and the client sends the signed authentication cookie only to the same origin.

Postgres enforces the two most important workout rules:

- Only one workout can be active for the owner at a time.
- Only one workout can be started in a logical training day, where the day changes at 04:00 in `Asia/Kolkata`.

Workout templates and exercise definitions are snapshotted when a session starts, so historical records remain meaningful if the source program changes later.

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Neon Postgres database
- Vercel CLI for the full local client-and-functions runtime

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure local environment variables

```bash
cp .env.example .env.local
```

Fill the three placeholders in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection string |
| `OWNER_PIN` | Private 4–12 digit PIN used by the owner gate |
| `AUTH_COOKIE_SECRET` | Independent random signing secret with at least 32 characters |

Never commit `.env.local`. The repository ignores `.env` files except for the safe `.env.example` template.

### 3. Apply the database migrations

```bash
npm run db:migrate
```

This applies the checked-in migrations from `drizzle/`. Use `npm run db:generate` only after intentionally changing `server/db/schema.js`.

### 4. Start the full app locally

If the Vercel CLI is not already installed, either install it globally or run it through `npx`:

```bash
npx vercel dev
```

The first run may ask you to authenticate and link a local Vercel project. Open the local URL printed by the CLI and unlock the app with `OWNER_PIN`.

`npm run dev` starts only the Vite frontend. It is useful for isolated visual work, but the complete application requires the same-origin `/api` functions and database, so `vercel dev` is the recommended local command.

## Tests and production build

Run the complete automated test suite:

```bash
npm test
```

The test command covers history calculations, authentication and signed cookies, the 04:00 logical-day boundary, workout invariants, workout-history shaping, template variants, schema safeguards, API authentication, and static-hosting packaging.

Build the production assets with:

```bash
npm run build
```

Vite writes the client to `dist/client`. The build also preserves the repository's alternate static-hosting handoff files; Vercel uses `vercel.json`, the client output, and the functions in `api/`.

## Project structure

```text
api/                 Vercel Function entry points
drizzle/             Versioned Postgres migrations
public/assets/       Workout, food, and exercise instruction artwork
server/api/          Shared HTTP handlers
server/db/           Drizzle schema, connection, and repository
server/domain/       Session invariants and history shaping
src/components/      Workout, food, calendar, analytics, and owner-gate UI
tests/               Node test suites
```

## Deliberate boundaries

- Authentication is a single-owner PIN, not a multi-user account system.
- The workout journal, workout history, and weight entries are persistent. The food quick-compare tray is intentionally temporary and clears on reload.
- The runner shows overall elapsed session time and written rest guidance. It does not run a rest countdown.
- Food energy and protein values are approximate references, not a personalized daily prescription.
- Exercise illustrations support the written cues; they are not a substitute for a qualified coach or clinical assessment when pain or injury symptoms are present.

See [PERSISTENCE.md](./PERSISTENCE.md) for the storage and API contract, [DESIGN_NOTES.md](./DESIGN_NOTES.md) for product-design decisions, and [design-qa.md](./design-qa.md) for the completed authenticated QA record.
