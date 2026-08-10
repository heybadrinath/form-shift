# Design and browser QA

## Final status

**Passed on 2026-08-10.**

The final authenticated browser pass covered the current desktop and mobile Workouts surfaces, owner unlock, persistent workout execution and reopening, the 76-item Food Index, Calendar filtering/readouts, Analytics weight selection/editing, the 12-region muscle panel, and post-QA journal cleanup. No unresolved release-blocking visual or functional issue remained.

## Canonical release evidence

| Artifact | Browser viewport | Image dimensions | Evidence |
| --- | ---: | ---: | --- |
| `docs/screenshots/design-qa-workouts-desktop-viewport-2026-08-10.png` | 1440 × 1000 | 1440 × 1000 | Authenticated desktop shell, selected Session A hero, illustration mosaic, session system, utility controls, and left rail |
| `docs/screenshots/design-qa-workouts-mobile-viewport-2026-08-10.png` | 390 × 844 | 390 × 844 | Authenticated mobile workout landing, compact sound control, Session A content, illustration mosaic, and fixed bottom navigation |

These two files are the canonical release captures. Older dashboard, runner, food, and analytics screenshots remain historical artifacts and are not used as evidence of the 2026-08-10 visual state.

## Supplied references and same-input comparison

The comparison reused the same three supplied reference images throughout the pass. They were not regenerated, redrawn, or swapped between iterations.

| Supplied reference | Pixel dimensions | Comparison role |
| --- | ---: | --- |
| `/Users/badri/Downloads/designs/Dg Dashboard Overview.png` | 2008 × 1420 | Primary desktop shell, rail, header, card hierarchy, palette, and spacing reference |
| `/Users/badri/Downloads/designs/CHEF SHOP FEATURES.png` | 2022 × 1418 | Editorial hero, split illustration surface, large type, and rounded card reference |
| `/Users/badri/Downloads/designs/Frf.png` | 2140 × 1606 | Cross-device composition and mobile adaptation reference |

The same-input comparison placed the final 1440 × 1000 desktop capture and 390 × 844 mobile capture against those unchanged references. The final implementation preserves the following fidelity surfaces:

- pale outer stage around a charcoal rounded application shell;
- compact dark left rail and restrained white utility header on desktop;
- large coral primary workout panel with aqua, violet, butter, and sage supporting cards;
- condensed display typography paired with mono utility labels;
- flat fills, large radii, thin borders, minimal shadow, and tight data labels; and
- a mobile composition that removes the rail, preserves the editorial hierarchy, and fixes primary navigation to the bottom edge.

The restaurant analytics subject matter was intentionally adapted rather than copied. Revenue and venue cards became workout selection, instructions, progress, Calendar history, Analytics, and food guidance while the visual hierarchy and card rhythm stayed recognizably faithful.

## Comparison history

| Pass | Comparison | Result |
| --- | --- | --- |
| 2026-08-09 baseline | Authenticated desktop at 1440 × 1050 and mobile at 390 × 844 were checked against the supplied dashboard and cross-device references. | Core visual language accepted; later Calendar and mobile Analytics density work remained outside those screenshots. |
| 2026-08-10 release pass | The unchanged supplied references were compared again with exact-viewport desktop and mobile captures after the Food, Calendar, Analytics, muscle-panel, feedback, and date-handling refinements. | Canonical screenshots above recorded; desktop fidelity and mobile hierarchy passed. |
| 2026-08-10 cleanup verification | Temporary authenticated workout and weight rows used for interaction checks were removed, then the production journal was counted again. | All four journal tables verified empty while schema and authentication remained available. |
| 2026-08-10 tactile feedback pass | Static navigation, button press feedback, generated sound output, and best-effort haptics were checked at 390, 360, and 320 CSS pixels. | Every harmless trusted click produced one intended feedback request, unsupported vibration failed safely, and no transition residue, overflow, warning, or error remained. |

## Browser checks

### Workouts, sound, and persistence

- The wrong PIN remained rejected and the correct four-digit PIN opened the protected application shell through the built-in keypad without a native text input or phone keyboard.
- The refreshed authentication contract invalidated the former long-lived token and now expires each unlock at the next 04:00 Chennai workout-day boundary.
- Session A could be started once; the one-active-session and one-logical-day rules blocked conflicting starts.
- Set checks, selected variants, skips, restores, completion timestamps, and skip timestamps saved only after their authenticated mutations succeeded.
- Reload restored the same active session ID, selected variant, checked sets, and skipped state. Closing/reopening the browser and a sleep/wake cycle returned the same server-backed active session through bootstrap rather than creating a new workout.
- Finishing remained unavailable until every exercise was completed or explicitly skipped. Completing or ending incomplete created history for Calendar and Analytics.
- The compact sound button exposed its on/muted state, changed it immediately, and retained that preference after reload without adding a server-side journal record.
- The sound menu exposed a dedicated three-note loud test, reported accepted or blocked playback without claiming physical audibility, and fit without horizontal overflow at 390 and 320 CSS pixels.
- Generated tones were lengthened, focused into phone-speaker-friendly frequencies, raised to a bounded near-full-scale level, and replaced an in-flight tone instead of stacking rapid clicks into distortion.
- Supported Apple audio sessions requested the media playback route; older Apple mobile browsers used the HTML media path when that route could not be activated.
- Supported vibration-capable browsers received one firm pulse for ordinary controls and stronger semantic patterns for saved sets, journal changes, completed workouts, partial saves, and errors; unsupported browsers continued normally.
- Async actions exposed a working label and spinner, and the synchronous mutation gate prevented rapid duplicate writes.

### Food Index

- The index rendered 76 specific food entries and 10 generic family guides across choose-often and limit/avoid lanes.
- Search covered names, ingredients, tags, and family guidance; category/access filters narrowed the visible collection without changing the source data.
- Detail views showed a practical portion, energy/protein range, ingredients, method or boundary, and estimate caveat.
- The temporary comparison tray accepted up to four portions, blocked a fifth, updated combined ranges, and cleared on reload as designed.

### Calendar

- Month navigation and **Go current** respected the 04:00 `Asia/Kolkata` logical-day boundary.
- Completion-status buttons and the Session A–E filter could be combined, reported the number of shown sessions, and returned to the full log with **Clear**.
- Monthly summary cards reported sessions, completion, incomplete sessions, and recorded time without inventing missing duration.
- The filtered readout reported unique training days, median recorded visit length, most-logged session, leading weekday, and weekly activity.
- Selecting a populated date opened its completed/incomplete session details and returned focus correctly when closed.

### Analytics and weight handling

- The weekly frequency, duration, completion, session mix, and recent-history panels reflected persisted ended sessions only.
- Selecting a weight bar or recent measurement opened a read-only selection panel. The form changed to edit mode only after the separate **Edit weight** action; saving returned it to add mode.
- Date-only add/edit payloads were interpreted on the server in Chennai time. A measurement for the current logical day used the current instant instead of a potentially future noon, while valid backdated dates used Chennai noon and impossible dates were rejected.
- Weight changes persisted after refresh during the temporary QA flow.

### 12-region muscle panel

- The front/back body map covered chest, upper back, lats, shoulders, biceps, triceps, core, hip flexors, quads, hamstrings, glutes, and lower legs.
- Selecting any region updated the inspector with weighted exposure, direct sets, supporting sets, and training days.
- The ranked all-region ledger, 0/12 active-region summary, current-logical-week basis, and empty state remained readable on mobile.
- Cardio remained excluded, snapshot muscle metadata was preferred, stable exercise IDs supported older rows, and unknown completed sets remained visible as unclassified rather than silently disappearing.
- The copy did not mislabel completed-set distribution as load-based volume, stimulus, recovery, readiness, balance, or muscle growth.

## Defects resolved for this release

- The leg-curl matcher now resolves the specific leg-curl family before the generic curl family.
- Selected exercise titles remain synchronized with the chosen machine, dumbbell, cable, or bodyweight variant.
- Mobile Analytics minimum-width constraints prevent page-level horizontal overflow while the 12-region ledger remains readable.
- Weight inspection no longer enters edit mode implicitly; selection and editing are separate actions.
- Date-only weight input no longer depends on browser timezone parsing or produces a false future timestamp for the current morning.
- The Guide and public docs no longer describe the workout journal as memory-only or imply that review rows remain in production.

## Production journal cleanup

The temporary authenticated QA state was removed after capture: 26 workout sessions, 209 cascaded exercise rows, 387 cascaded set rows, and 11 weight rows were permanently deleted. The operation did not create a recovery copy. A separate dry-run count on 2026-08-10 then confirmed exactly 0 sessions, 0 exercises, 0 sets, and 0 weights. Schema, migrations, environment configuration, and owner authentication were preserved.

## Automated verification

```bash
npm test
npm run build
```

Verification rerun on 2026-08-10:

- `npm test` — passed, 67 tests.
- `npm run build` — passed.
- Read-only production journal count — passed, all four journal tables at zero.

final result: passed
