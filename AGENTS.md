# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product direction

- This is a personal, mobile-first workout runner and food index for a beginner returning to the gym.
- Workouts are the primary experience. A user can choose Sessions A–E, start one, complete exercises and sets, read concise form/safety cues, and finish the session.
- Workout sessions, set-completion timestamps, selected exercise variants, and body-weight entries persist in a single-owner Neon database. A session must resume after reload or browser closure. Enforce one active session globally and one session per logical workout day, where the day changes at 04:00 Asia/Kolkata.
- Protect all private data and write operations with one four-digit owner PIN and a secure signed cookie that expires at the next 04:00 Asia/Kolkata workout-day boundary. Use the built-in numeric keypad instead of a native phone keyboard. Do not add registration, profiles, social features, or a multi-user account model. Never commit the PIN, cookie secret, database URL, or production data.
- The active runner shows only overall elapsed time, exercise/set progress, variant selection, and concise cues. Do not show a rest countdown. Record timestamps in the background.
- Food is an index, not a meal schedule or full food diary. Organize recommended choices by no-cook, pan-cooked, protein additions, and fruits/vegetables. Keep delivery food, sweets, sugary drinks, and packaged snacks in a separate expanded limit/avoid reference. Show approximate energy and protein ranges against the current daily references without implying an exact remaining allowance.
- AI meal parsing is explicitly deferred. Do not add an AI food input, provider SDK, API key, or prompt in this phase.
- Primary navigation is Workouts, Food, Calendar, and Analytics. Keep the Guide accessible from contextual help rather than primary navigation. Surface an active session as a persistent continue banner.
- Every canonical exercise or supported variant needs its own instructional raster gallery. Reuse an asset only for the exact same movement. Offer variant toggles only for equipment confirmed available or for a safe dumbbell/cable/bodyweight alternative.
- Match the supplied dashboard references: charcoal shell, flat periwinkle/coral/butter/aqua/sage cards, large rounded rectangles, condensed headings, outlined utility labels, desktop side rail, and mobile bottom navigation.
- Treat the references as a premium instrument-panel system: disciplined spacing, consistent radii and strokes, compact utility typography, clear nested card hierarchy, and restrained motion. Avoid generic gradients, glass effects, ornamental shadows, or loosely aligned cards.
- Navigation and API mutations should feel responsive: use short reduced-motion-safe page transitions, single-flight async actions, an app-wide save state, and per-button progress feedback. Interface sounds are allowed, but must stay subtle and expose a persistent mute control.
- Selecting a historical weight is read-only. Editing begins only after an explicit Edit weight action.
- Seed data is a development tool, not part of the personal journal. Production should be empty before the owner begins real tracking.
- Use real image assets for workout and food artwork and a consistent third-party icon family for interface icons. Do not use emoji, handcrafted SVG art, CSS illustrations, or placeholder imagery.
