import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceDirectory = fileURLToPath(new URL("../src/", import.meta.url));
const sourceFiles = readdirSync(sourceDirectory, { recursive: true })
  .filter((file) => /\.(js|jsx)$/.test(file));

const sourceText = sourceFiles
  .map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"))
  .join("\n");

test("persistent screens do not claim that workout data is browser-only", () => {
  const obsoleteClaims = [
    /reload\s*=\s*clean slate/i,
    /there is no account, database, analytics or saved history/i,
    /workout checks[^.]*live only in this browser tab/i,
  ];

  for (const claim of obsoleteClaims) {
    assert.doesNotMatch(sourceText, claim);
  }
});

test("the Guide identifies persistent and temporary data accurately", () => {
  const guide = readFileSync(new URL("../src/components/GuidePage.jsx", import.meta.url), "utf8");

  assert.match(guide, /RELOAD = RESUME/);
  assert.match(guide, /Active workouts, checked sets, selected exercise versions, session history and weight entries are saved/);
  assert.match(guide, /Only the food quick-compare tray clears on reload/);
});
