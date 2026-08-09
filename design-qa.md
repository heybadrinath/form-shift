# Design and browser QA

## Final status

**Passed on 2026-08-09.**

A fresh authenticated browser pass covered the current desktop and mobile interface, owner unlock, persistent workout lifecycle, training history, weight editing, food interactions, and database cleanup. No unresolved release-blocking visual or functional issue remained at the end of the pass.

## Reference captures

| Artifact | Viewport | Evidence |
| --- | ---: | --- |
| `docs/screenshots/dashboard-desktop.png` | 1440 × 1050 | Authenticated workout dashboard, navigation rail, utility header, selected-session hero, and five-session system |
| `docs/screenshots/session-mobile.png` | 390 × 844 | Authenticated runner, elapsed timer, progress, exercise illustration, variant choice, and bottom navigation |
| `docs/screenshots/food-mobile.png` | 390 × 844 | Food-index landing view, food artwork, comparison entry point, and bottom navigation |
| `docs/screenshots/analytics-mobile.png` | 390 × 844 | Analytics hero, weekly training state, metric cards, and constrained mobile layout before the later density pass |

The captures show the same Workouts, Food, Calendar, and Analytics information architecture used by the application. They are representative portfolio evidence rather than pixel-current release snapshots; the Calendar and mobile Analytics layouts received a later refinement pass described below.

## Desktop comparison

The 1440 × 1050 dashboard was compared directly with `/Users/badri/Downloads/designs/Dg Dashboard Overview.png`.

The implementation preserves the reference's intentional visual language:

- pale outer stage;
- charcoal rounded application shell;
- compact left navigation rail and utility header;
- large coral primary panel;
- aqua, violet, butter, and sage supporting cards;
- condensed display typography paired with mono utility labels; and
- flat fills, large radii, restrained borders, and minimal shadow.

The subject matter is correctly adapted rather than copied literally. Restaurant revenue, venue, and operations cards become a workout library, exercise guidance, session progression, training history, and food reference. The hierarchy and visual rhythm remain faithful while every content surface serves workout execution.

## Mobile checks

The current interface was checked at 390 × 844 across the runner, food index, Calendar, and Analytics.

### Runner

- The active-session header, overall elapsed timer, progress, instruction image, sets, form cues, and workout runway remain readable in one narrow column.
- Switching the chest-press setup between machine and dumbbells changed both the instruction artwork and selected-variant title correctly.
- Completing a set persisted immediately and remained completed after reload.
- Skipping an exercise changed it to the skipped state, advanced the runner, and preserved a skip timestamp.
- Restoring that exercise removed the skipped state and derived completion from its saved sets.
- A second workout could not be started while one session was active.
- Finishing became available only after every exercise was completed or explicitly skipped.
- Ending or completing a workout produced a saved history record rather than discarding progress.

### Food

- Search filtered the index and returned the expected matching cards.
- Food details opened with the stated portion, energy/protein range, ingredients, method or practical boundary, and estimate caveat.
- The comparison tray accepted up to four portions, updated combined ranges, and blocked an additional item at the cap.
- Reload cleared the tray as designed; the food comparison is temporary and is not a food diary.

### Calendar and Analytics

- Calendar displayed workouts on their logical days, summarized the current month, visualized weekly activity, returned to the current month, and opened a selected day's session details.
- Analytics reflected the saved session in weekly frequency, duration, completion, session mix, and recent history.
- A weight entry could be added and then edited, with the revised value retained after refresh.
- The Analytics page stayed within both 390 px and 320 px viewports after the density pass; summary cards, labels, bars, the weight form, and recent history no longer force page-level horizontal expansion.

### Interaction feedback

- Auth, session-start, set, variant, skip, finish, incomplete-session, and weight mutations expose a working label and spinner while the request is in flight.
- A synchronous lock prevents a second mutation from starting before React has rendered the disabled state, so rapid double clicks cannot submit duplicate writes.
- Navigation and page content use short, reduced-motion-safe transitions while data mutations continue to wait for confirmed API responses before updating persistent UI state.

## Authentication and persistence

- An incorrect PIN was rejected without opening the protected journal.
- The correct PIN unlocked the current application shell.
- Reload during an active workout restored the same session, selected variant, checked sets, and skipped state from Neon.
- The one-active-session rule remained enforced during the browser flow.
- Completed or incomplete session data populated Calendar and Analytics after refresh.
- Weight edits persisted through the authenticated API.

The food comparison tray was the deliberate exception: reload cleared it because it is a local comparison aid rather than persistent owner data.

## Defects resolved during the pass

### Guide persistence message

The Guide still contained a prototype-era banner claiming that reload removed workout state and that no database or history existed. It now states the actual boundary: workout progress, history, selected variants and weight entries persist, while only the food quick-compare tray clears on reload. A source-wide regression test rejects the obsolete persistence claims.

### Leg-curl guide matching

The exercise-guide matcher could classify a leg-curl identifier as the generic curl family. The specific leg-curl match now runs before the generic curl match, so leg-curl exercises receive the correct machine variants, illustrations, and cues.

### Selected-variant title

The runner could update the selected setup while leaving the heading too generic. The current heading includes the selected variant, so the visible title stays aligned with the artwork and instructions.

### Mobile Analytics minimum width

Analytics content could retain an intrinsic width larger than the mobile viewport. Minimum-width constraints were hardened so the grid, panels, charts, labels, and form can shrink inside 390 px without horizontal overflow.

## Seeded review state

The review database is intentionally populated with deterministic sample history: 25 workout sessions across Sessions A–E and 10 body-weight entries. The seed command skips logical workout days occupied by genuine sessions, and rerunning it replaces only its own deterministic rows. `npm run db:seed:reset` removes those sample rows later without deleting genuine journal entries.

## Automated verification

```bash
npm test
npm run build
```

The automated suites cover single-flight action locking, Calendar metrics, seed-data relationships, history calculations, signed-cookie authentication, the 04:00 `Asia/Kolkata` logical-day boundary, session invariants, skip/completion timestamps, workout-history shaping, template variants, schema safeguards, protected API mutations, and static-hosting packaging. The production build verifies the client bundle and expected packaging outputs.

Verification rerun on 2026-08-09:

- `npm test` — passed, 41 tests.
- `npm run build` — passed.

final result: passed
