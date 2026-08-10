import assert from "node:assert/strict";
import test from "node:test";
import {
  mutationStatusLabel,
  parseSoundPreference,
  readSoundPreference,
  tonePattern,
  writeSoundPreference,
} from "../src/interfaceFeedback.js";

test("sound preference defaults on and parses stored booleans", () => {
  assert.equal(parseSoundPreference(null), true);
  assert.equal(parseSoundPreference("true"), true);
  assert.equal(parseSoundPreference("false"), false);
});

test("sound preference survives a storage round trip", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  writeSoundPreference(false, storage);
  assert.equal(readSoundPreference(storage), false);
  writeSoundPreference(true, storage);
  assert.equal(readSoundPreference(storage), true);
});

test("tone patterns are deterministic and unknown tones use a tap", () => {
  assert.equal(tonePattern("saved").length, 2);
  assert.deepEqual(tonePattern("unknown"), tonePattern("tap"));
});

test("mutation keys resolve to short journal-wide status labels", () => {
  assert.equal(mutationStatusLabel("set:a-press:2"), "Saving set");
  assert.equal(mutationStatusLabel("weight:entry-1"), "Updating weight");
  assert.equal(mutationStatusLabel("finish"), "Saving workout");
  assert.equal(mutationStatusLabel(null), "");
});
