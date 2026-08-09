# Design and browser QA

## Final status

**Passed on 2026-08-09.**

A fresh authenticated browser pass covered the current desktop and mobile interface, owner unlock, persistent workout lifecycle, training history, weight editing, food interactions, and database cleanup. No unresolved release-blocking visual or functional issue remained at the end of the pass.

## Current evidence

| Artifact | Viewport | Evidence |
| --- | ---: | --- |
| `docs/screenshots/dashboard-desktop.png` | 1440 × 1050 | Current workout dashboard, navigation rail, utility header, selected-session hero, and five-session system |
| `docs/screenshots/session-mobile.png` | 390 × 844 | Current authenticated runner, elapsed timer, progress, exercise illustration, variant choice, and bottom navigation |
| `docs/screenshots/food-mobile.png` | 390 × 844 | Current food-index landing view, food artwork, comparison entry point, and bottom navigation |
| `docs/screenshots/analytics-mobile.png` | 390 × 844 | Current Analytics hero, weekly training state, metric cards, and constrained mobile layout |

The captures use the current Workouts, Food, Calendar, and Analytics information architecture. They replace the older root-level presentation captures as the documentation source of truth.

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

- Calendar displayed the ended workout on its logical day and opened its session details.
- Analytics reflected the saved session in weekly frequency, duration, completion, session mix, and recent history.
- A weight entry could be added and then edited, with the revised value retained after refresh.
- The Analytics page stayed within the 390 px viewport after min-width hardening; cards, labels, bars, and the weight form no longer forced horizontal expansion.

## Authentication and persistence

- An incorrect PIN was rejected without opening the protected journal.
- The correct PIN unlocked the current application shell.
- Reload during an active workout restored the same session, selected variant, checked sets, and skipped state from Neon.
- The one-active-session rule remained enforced during the browser flow.
- Completed or incomplete session data populated Calendar and Analytics after refresh.
- Weight edits persisted through the authenticated API.

The food comparison tray was the deliberate exception: reload cleared it because it is a local comparison aid rather than persistent owner data.

## Defects resolved during the pass

### Leg-curl guide matching

The exercise-guide matcher could classify a leg-curl identifier as the generic curl family. The specific leg-curl match now runs before the generic curl match, so leg-curl exercises receive the correct machine variants, illustrations, and cues.

### Selected-variant title

The runner could update the selected setup while leaving the heading too generic. The current heading includes the selected variant, so the visible title stays aligned with the artwork and instructions.

### Mobile Analytics minimum width

Analytics content could retain an intrinsic width larger than the mobile viewport. Minimum-width constraints were hardened so the grid, panels, charts, labels, and form can shrink inside 390 px without horizontal overflow.

## Cleanup and database state

The workout sessions and weight entries created for QA were deleted after the screenshots and interaction checks were complete. The database was queried after cleanup and verified empty of QA rows.

## Automated verification

```bash
npm test
npm run build
```

The automated suites cover history calculations, signed-cookie authentication, the 04:00 `Asia/Kolkata` logical-day boundary, session invariants, skip/completion timestamps, workout-history shaping, template variants, schema safeguards, protected API mutations, and static-hosting packaging. The production build verifies the client bundle and expected packaging outputs.

Verification rerun on 2026-08-09:

- `npm test` — passed, 31 tests.
- `npm run build` — passed.

final result: passed
