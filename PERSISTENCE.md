# Persistence and API contract

FORM / SHIFT uses same-origin Vercel Functions under `/api` and stores owner data in Neon Postgres through Drizzle ORM. Function entry points in `api/` delegate to shared handlers in `server/api/handlers.js`; those handlers use Web `Request` and `Response` objects.

## Environment

Copy `.env.example` to `.env.local` for local development, or configure the same names as encrypted Vercel environment variables:

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection string |
| `OWNER_PIN` | Private four-digit owner PIN; never committed or stored in the database |
| `AUTH_COOKIE_SECRET` | Independent signing secret of at least 32 characters |

Do not reuse the PIN as the cookie secret. No environment values belong in documentation, screenshots, client code, or committed files.

## Authentication and request boundaries

- `POST /api/auth/unlock` compares the submitted PIN using HMAC-backed constant-time comparison.
- A successful unlock issues a signed owner token in an `HttpOnly`, `SameSite=Strict` cookie. The cookie is also `Secure` on HTTPS and Vercel runtimes and expires at the next 04:00 `Asia/Kolkata` workout-day boundary. The owner therefore unlocks once each logical day.
- The client uses an accessible on-screen numeric keypad with no text input, so opening the gate on a phone does not summon the native keyboard.
- The PIN and signing secret remain server-side; the cookie contains a signed, expiring token rather than the PIN.
- Protected reads require a valid cookie. A locked `GET /api/bootstrap` returns `{ "authenticated": false }` so the client can render the owner gate.
- Mutations require authentication, an `application/json` body where applicable, and a same-origin `Origin` when the browser sends that header.
- JSON responses use `Cache-Control: no-store` and a consistent `{ "error": { "code", "message", "details"? } }` error shape.

This is intentionally a single-owner design. It does not provide registration, password recovery, roles, or user isolation.

## Database model

### `workout_sessions`

Stores the selected template, a complete template snapshot, logical day, status, start time, completion/end times, and an optional incomplete-session reason.

Statuses are `active`, `completed`, and `incomplete`. Database checks keep status and timestamp combinations consistent.

### `workout_exercises`

Stores an exercise snapshot, position, expected set count, selected variant and selection timestamp, status, and either a completion or skip timestamp. Version 2 snapshots also preserve the exercise's resistance/cardio category and primary/supporting muscle regions.

Statuses are `pending`, `completed`, and `skipped`. A database check prevents an exercise from retaining both `completedAt` and `skippedAt`.

### `workout_sets`

Stores every expected set and its completion timestamp. The compound key is session, exercise, and set number.

### `weight_entries`

Stores weight, measurement time, logical day, and audit timestamps. Postgres constrains values to 20–500 kg and verifies the logical-day calculation.

## Database-enforced workout rules

- A partial unique index permits only one `active` session for the owner.
- A unique index permits only one session per owner and logical day.
- A logical day is calculated in `Asia/Kolkata` after shifting the local clock by four hours. For example, 03:59 belongs to the previous logical day and 04:00 starts the next one.
- The stored logical day is checked against `startedAt`; it is not trusted only because the application supplied it.
- Finishing succeeds only when every exercise is either completed or explicitly skipped.
- Ending incomplete closes the active session while preserving its checked sets and exercise states.
- Set and skip mutations take a transaction-scoped advisory lock for the session to avoid conflicting updates.

Application checks provide readable errors, while database indexes and checks remain the final concurrency safeguard.

## Session lifecycle

1. The owner unlocks the app for the current 04:00-to-03:59 workout day.
2. `GET /api/bootstrap` returns templates, logical-day state, an active session if present, up to 120 ended sessions, and the 30 most recent weight entries.
3. Starting a workout snapshots the chosen template and its exercises—including muscle-exposure metadata—creates all expected set rows, and records the initial variant selections.
4. Set, variant, and skip changes are written immediately. Reloading, sleeping and waking the browser, or closing and reopening it does not discard them; bootstrap returns the same active session.
5. The session can be completed after all exercises are completed or skipped, or explicitly ended as incomplete.
6. Calendar and Analytics derive their display data from the returned session history. The active workout is excluded from history until it ends. Weekly muscle exposure counts persisted completed resistance/core sets, excludes cardio, and uses stable-ID fallback metadata for older snapshots.

The food quick-compare tray is client-only by design and clears on reload. The sound preference is stored in browser local storage so the subtle interface tones remain muted or enabled on that browser, but it is not synchronized owner data. Neither belongs to the Postgres persistence model.

## API endpoints

All request and response bodies are JSON unless noted otherwise.

### Authentication and bootstrap

| Method | Route | Request | Success response |
| --- | --- | --- | --- |
| `POST` | `/api/auth/unlock` | `{ "pin": "..." }` | `{ "authenticated": true }` plus cookie |
| `POST` | `/api/auth/lock` | No body | `{ "authenticated": false }` plus expired cookie |
| `GET` | `/api/bootstrap` | — | Locked state, or the authenticated bootstrap payload |

The authenticated bootstrap payload contains:

```json
{
  "authenticated": true,
  "logicalDay": "YYYY-MM-DD",
  "serverNow": "ISO timestamp",
  "templates": [],
  "activeSession": null,
  "logicalDaySession": null,
  "sessionHistory": [],
  "weights": []
}
```

`sessionHistory` entries include session status, logical day, start/end/completion timestamps, duration, completed/skipped/handled counts, completion percentage, and per-exercise set counts, status, and sanitized muscle-exposure metadata when present.

### Workouts

| Method | Route | Request | Success response |
| --- | --- | --- | --- |
| `POST` | `/api/workouts/start` | `{ "templateId": "A", "variantSelections": {} }` | `201` with `{ "session": {} }` |
| `PUT` | `/api/workouts/:sessionId/sets` | `{ "exerciseId": "...", "setNumber": 1, "completed": true }` | `{ "set": {}, "exercise": {} }` |
| `PUT` | `/api/workouts/:sessionId/variant` | `{ "exerciseId": "...", "variant": "machine" }` | `{ "exercise": {} }` |
| `PUT` | `/api/workouts/:sessionId/exercises` | `{ "exerciseId": "...", "skipped": true }` | `{ "exercise": {} }` |
| `POST` | `/api/workouts/:sessionId/finish` | No body | `{ "session": {} }` |
| `POST` | `/api/workouts/:sessionId/end-incomplete` | Optional `{ "reason": "..." }` | `{ "session": {} }` |

Sending `"completed": false` unchecks a set. Sending `"skipped": false` restores an exercise and derives its status from the sets already completed.

### Weight entries

| Method | Route | Request | Success response |
| --- | --- | --- | --- |
| `GET` | `/api/weights?limit=30` | — | `{ "weights": [] }` |
| `POST` | `/api/weights` | `{ "weightKg": 73.4, "date": "YYYY-MM-DD" }`, or an optional ISO `measuredAt` | `201` with `{ "entry": {} }` |
| `PUT` | `/api/weights/:entryId` | `{ "weightKg": 73.2, "date": "YYYY-MM-DD" }`, or an ISO `measuredAt` | `{ "entry": {} }` |
| `DELETE` | `/api/weights/:entryId` | No body | `{ "deleted": true, "entryId": "..." }` |

The current Analytics screen exposes add and edit. Selecting a chart point or recent row only opens a read-only measurement summary; the separate **Edit weight** action intentionally populates the form. The delete route exists for API completeness but is not currently surfaced as an Analytics control.

Date-only input is resolved on the server in `Asia/Kolkata`, not parsed as browser-local midnight. A date matching the current logical day uses the current instant, avoiding a future-noon rejection during the morning. A valid backdated date is stored at noon in Chennai so it remains on the requested calendar day across time zones. Impossible dates and future timestamps are rejected, and the database still checks that `logicalDay` matches `measuredAt` after the 04:00 shift.

## Explicit journal reset

The reset command is deliberately safe by default:

```bash
npm run db:journal:reset
```

Without a confirmation flag it prints the credential-free database target and exact journal counts, then exits without deleting anything. Permanent deletion requires the configured database name in the only accepted confirmation flag:

```bash
npm run db:journal:reset -- --confirm-reset-owner-journal=<database-name>
```

The confirmed operation locks the four journal tables, deletes workout sessions and weight entries, relies on foreign-key cascades for exercises and sets, and verifies exact zero counts before completing. It preserves schema, migrations, environment configuration, and owner authentication. It creates no recovery copy.

For the 2026-08-10 release, the temporary QA journal was cleared and a later dry run reconfirmed 0 sessions, 0 exercises, 0 sets, and 0 weights in the configured production database.

## Migrations and verification

Apply checked-in migrations to the configured database:

```bash
npm run db:migrate
```

After an intentional schema change, generate the next migration and inspect the SQL before applying it:

```bash
npm run db:generate
npm run db:migrate
```

Run the backend-focused suite with:

```bash
npm run test:backend
```

The suite covers authentication, cookie signing and expiry, logical-day boundaries, current and backdated date-only weight handling, session finish/skip invariants, history shaping, snapshot muscle metadata, weekly exposure classification, template variant IDs, journal-reset safeguards, migration safeguards, and unauthenticated mutation rejection. Active-session reopening was verified in the authenticated browser pass recorded in [design-qa.md](./design-qa.md).
