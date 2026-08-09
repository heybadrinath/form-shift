# FORM / SHIFT design direction

## Product job

FORM / SHIFT is a private training journal for one beginner gym-goer using machines, dumbbells, cables, and bodyweight. The primary job is to remove decisions during training: choose the next prepared session, follow the ordered movements, record each set, and leave with an honest session record.

The food index supports that job with practical references. It is intentionally an index rather than a meal schedule, food diary, or remaining-calorie prescription.

## Information architecture

The four primary destinations are:

1. **Workouts** — session selection, the rolling A–E system, exercise preview, and safety guardrails.
2. **Food** — searchable food categories, detail views, rough portion coverage, and a temporary comparison tray.
3. **Calendar** — logical-day training history and the detail of completed or incomplete sessions.
4. **Analytics** — weekly frequency, recorded duration, completion, muscle exposure, session mix, recent history, and weight entries.

The Guide is contextual rather than a fifth primary destination. An active workout appears as a persistent continuation action outside the runner.

The PIN gate protects all persistent owner data before the application shell opens. It communicates the single-owner model, not a multi-user sign-in product.

## Interaction model

- Starting a session creates the server record before the runner opens.
- Set checks, variant choices, and exercise skips save immediately.
- Leaving the runner keeps the session active; the owner can continue it from any main destination or after reopening the app.
- Completing the session requires every exercise to be completed or explicitly skipped.
- Ending incomplete is an intentional escape hatch and preserves recorded work.
- Only one session can be started in each 04:00-to-03:59 `Asia/Kolkata` logical day.
- The runner shows overall elapsed time. Rest values remain guidance attached to each exercise; there is no rest countdown or alarm.
- The food comparison tray is temporary and makes that boundary explicit.

## Visual system

### Tokens

- Ink: `#20201f`
- Raised ink: `#2d2c2b`
- Paper: `#f7f7f2`
- Periwinkle: `#7774f7`
- Coral: `#ff6657`
- Butter: `#ffd56a`
- Aqua: `#b8eef6`
- Sage: `#d3dfd5`
- Display: Barlow Condensed
- Body: Manrope
- Utility and data: IBM Plex Mono

### Composition

Desktop uses an 84 px navigation rail, compact utility header, and a card mosaic that gives the selected workout the largest visual surface. The runner becomes a two-column working view: the active exercise is the dominant stage and the workout runway remains visible beside it.

Mobile removes the rail, stacks the active exercise and runway, and fixes the four primary destinations to the bottom edge. The active-session continuation banner prevents the workout from becoming hidden when navigating elsewhere.

```text
DESKTOP                               MOBILE
┌rail┬───────────────────────────┐    ┌──────────────────┐
│    │ utility header            │    │ compact header   │
│    ├───────────────────────────┤    ├──────────────────┤
│    │ selected-session hero     │    │ primary card     │
│    ├───────────────┬───────────┤    ├──────────────────┤
│    │ active stage  │ runway    │    │ stacked content  │
│    └───────────────┴───────────┘    ├──────────────────┤
└────┴───────────────────────────┘    │ bottom nav       │
                                      └──────────────────┘
```

## Exercise instruction system

Each supported equipment variant has a dedicated four-panel raster illustration, a three-step method, an equipment/setup label, and an avoid cue. The same exercise family can therefore switch between a machine, dumbbell, cable, or bodyweight version without a misleading shared image.

The images are instructional aids, not ground truth. Written cues remain authoritative because machine geometry and user proportions vary. Joint pain, instability, neurological symptoms, focal shin-bone tenderness, swelling, limping, or rest/night pain leave the product flow and require an appropriate human assessment.

## State and feedback

- A set changes only after its server mutation succeeds.
- Completed, skipped, pending, and busy states are visually distinct.
- Progress treats both completed and explicitly skipped exercises as handled, while the summary preserves the difference.
- Session and exercise timestamps are recorded in the background; the interface emphasizes the task rather than audit metadata.
- Calendar and Analytics report only persisted outcomes. They do not infer load progression or repetitions that were never recorded.
- The front/back muscle map colors 12 major regions from completed sets in ended workouts. Direct sets count once and supporting involvement counts half for the relative color score; the adjacent ledger preserves the raw direct, supporting, and training-day counts.
- Muscle exposure is deliberately not labelled training volume, balance, stimulus, readiness, recovery, or growth. The active workout enters the map only after it is finished or ended.
- Food estimates use ranges and state that the percentages are an orientation, not an instruction to compensate later.

## Accessibility and motion

- Controls use semantic buttons, labels, headings, progress semantics, and visible focus treatment.
- Dialogs identify themselves, can be dismissed with Escape, and keep close controls explicit.
- Tap targets are sized for gym use on a phone.
- High-contrast active states do not rely on color alone.
- Page and state motion is restrained, and reduced-motion preferences are respected.

## Intentional restraint

The personality comes from the charcoal shell, flat color blocks, large radii, editorial typography, and commissioned exercise artwork. The interface avoids decorative gradients, glass effects, fake charts, streak pressure, punishment language, and social mechanics. Persistence is treated as quiet reliability rather than a gamification device.
