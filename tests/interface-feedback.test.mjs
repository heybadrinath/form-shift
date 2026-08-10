import assert from "node:assert/strict";
import test from "node:test";
import {
  interfaceToneDataUri,
  mutationSuccessTone,
  mutationStatusLabel,
  parseSoundPreference,
  readSoundPreference,
  renderToneSamples,
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
  assert.equal(tonePattern("complete").length, 3);
  assert.deepEqual(tonePattern("unknown"), tonePattern("tap"));
});

test("fallback tones render valid bounded audio and WAV data", () => {
  for (const kind of ["tap", "navigate", "set", "saved", "complete", "unlock", "partial", "error"]) {
    const samples = renderToneSamples(kind);
    const peak = samples.reduce((highest, sample) => Math.max(highest, Math.abs(sample)), 0);
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length);
    assert.ok(samples.length > 500);
    assert.ok(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(peak >= 0.22 && peak <= 0.45);
    assert.ok(rms >= 0.06 && rms <= 0.11);
    assert.ok(samples.every((sample) => Math.abs(sample) < 0.99));
    assert.match(interfaceToneDataUri(kind), /^data:audio\/wav;base64,UklGR/);
  }
});

test("rapid taps do not stack louder interface tones", async () => {
  const previousWindow = globalThis.window;
  let playCalls = 0;

  class AudioFallback {
    pause() {}

    play() {
      playCalls += 1;
      return Promise.resolve();
    }
  }

  globalThis.window = { Audio: AudioFallback };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?tap-cooldown=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("tap"), true);
    assert.equal(feedback.playInterfaceTone("tap"), false);
    assert.equal(playCalls, 1);
    await new Promise((resolve) => setTimeout(resolve, 55));
    assert.equal(feedback.playInterfaceTone("tap"), true);
    assert.equal(playCalls, 2);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("Web Audio uses the same audible output gain", async () => {
  const previousWindow = globalThis.window;
  const gainTargets = [];

  class RunningAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime(value) { gainTargets.push(value); },
        },
        connect() {},
        disconnect() {},
      };
    }
  }

  globalThis.window = { AudioContext: RunningAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?web-audio-gain=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("tap"), true);
    assert.equal(Math.max(...gainTargets), 0.51);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("mutation outcomes resolve to distinct confirmation sounds", () => {
  assert.equal(mutationSuccessTone("unlock"), "unlock");
  assert.equal(mutationSuccessTone("set:a-press:2"), "set");
  assert.equal(mutationSuccessTone("finish"), "complete");
  assert.equal(mutationSuccessTone("weight:add"), "saved");
});

test("mutation keys resolve to short journal-wide status labels", () => {
  assert.equal(mutationStatusLabel("set:a-press:2"), "Saving set");
  assert.equal(mutationStatusLabel("weight:entry-1"), "Updating weight");
  assert.equal(mutationStatusLabel("finish"), "Saving workout");
  assert.equal(mutationStatusLabel("finish-weight"), "Workout saved · saving weight");
  assert.equal(mutationStatusLabel(null), "");
});

test("a suspended audio context plays an immediate fallback while preparing Web Audio", async () => {
  const previousWindow = globalThis.window;
  let completeResume;
  let oscillatorStarts = 0;
  let audibleFallbacks = 0;

  class SuspendedAudioContext {
    constructor() {
      this.state = "suspended";
      this.currentTime = 0;
      this.sampleRate = 24_000;
      this.destination = {};
    }

    createBuffer() {
      return {};
    }

    createBufferSource() {
      return { connect() {}, start() {} };
    }

    resume() {
      return new Promise((resolve) => {
        completeResume = () => {
          this.state = "running";
          resolve();
        };
      });
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() { oscillatorStarts += 1; },
        stop() {},
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }

  class AudioFallback {
    constructor() {
      this.volume = 1;
    }

    pause() {}

    play() {
      if (this.volume > 0) audibleFallbacks += 1;
      return Promise.resolve();
    }
  }

  globalThis.window = { AudioContext: SuspendedAudioContext, Audio: AudioFallback };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?suspended=${Date.now()}`);
    const priming = feedback.primeInterfaceAudio(true);
    assert.equal(feedback.playInterfaceTone("saved"), true);
    assert.equal(audibleFallbacks, 1);
    assert.equal(oscillatorStarts, 0);
    completeResume();
    assert.equal(await priming, true);
    assert.equal(oscillatorStarts, 0);
    assert.equal(feedback.playInterfaceTone("saved"), true);
    assert.equal(oscillatorStarts, 2);
    assert.equal(audibleFallbacks, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("a stalled AudioContext resume cannot block priming or future retries", async () => {
  const previousWindow = globalThis.window;
  let resumeCalls = 0;

  class HangingAudioContext {
    constructor() {
      this.state = "suspended";
      this.sampleRate = 24_000;
      this.destination = {};
    }

    createBuffer() {
      return {};
    }

    createBufferSource() {
      return { connect() {}, start() {} };
    }

    resume() {
      resumeCalls += 1;
      return new Promise(() => {});
    }
  }

  globalThis.window = { AudioContext: HangingAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?stalled=${Date.now()}`);
    const result = await Promise.race([
      feedback.primeInterfaceAudio(true),
      new Promise((_, reject) => setTimeout(() => reject(new Error("audio priming did not settle")), 1_000)),
    ]);
    assert.equal(result, false);
    assert.equal(resumeCalls, 1);

    void feedback.primeInterfaceAudio(true);
    assert.equal(resumeCalls, 2);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("HTML audio provides a safe fallback when Web Audio is unavailable", async () => {
  const previousWindow = globalThis.window;
  let playCalls = 0;

  class AudioFallback {
    pause() {}

    play() {
      playCalls += 1;
      return Promise.resolve();
    }
  }

  globalThis.window = { Audio: AudioFallback };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?fallback=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("complete"), true);
    assert.equal(playCalls, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("background recovery closes a stale context and creates a fresh one", async () => {
  const previousWindow = globalThis.window;
  let constructions = 0;
  let closes = 0;
  let starts = 0;
  let fallbackConstructions = 0;

  class RunningAudioContext {
    constructor() {
      constructions += 1;
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    close() {
      closes += 1;
      this.state = "closed";
      return Promise.resolve();
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() { starts += 1; },
        stop() {},
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }

  class AudioFallback {
    constructor() {
      fallbackConstructions += 1;
    }

    pause() {}

    play() {
      return Promise.resolve();
    }

    load() {}
  }

  globalThis.window = { AudioContext: RunningAudioContext, Audio: AudioFallback };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?background=${Date.now()}`);
    await feedback.primeInterfaceAudio();
    feedback.playInterfaceTone("saved");
    feedback.resetInterfaceAudioAfterBackground();
    await feedback.primeInterfaceAudio();
    feedback.playInterfaceTone("saved");
    assert.equal(constructions, 2);
    assert.equal(closes, 1);
    assert.equal(starts, 4);
    assert.equal(fallbackConstructions, 2);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
