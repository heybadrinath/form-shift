import assert from "node:assert/strict";
import test from "node:test";
import {
  configurePlaybackAudioSession,
  hapticPattern,
  interfaceToneDataUri,
  mutationSuccessHaptic,
  mutationSuccessTone,
  mutationStatusLabel,
  parseSoundPreference,
  prefersMediaElementPlayback,
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
  assert.equal(tonePattern("test").length, 3);
  assert.deepEqual(tonePattern("unknown"), tonePattern("tap"));
});

test("supported Apple audio sessions use the media playback route", () => {
  const audioSession = { type: "ambient" };
  assert.equal(configurePlaybackAudioSession({ audioSession }), true);
  assert.equal(audioSession.type, "playback");

  const blockedSession = {};
  Object.defineProperty(blockedSession, "type", {
    get: () => "ambient",
    set: () => { throw new Error("blocked"); },
  });
  const blockedAppleNavigator = {
    audioSession: blockedSession,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  };
  assert.equal(configurePlaybackAudioSession(blockedAppleNavigator), false);
  assert.equal(prefersMediaElementPlayback(blockedAppleNavigator), true);
  assert.equal(configurePlaybackAudioSession({}), false);
});

test("older Apple mobile browsers prefer the HTML media route", () => {
  assert.equal(prefersMediaElementPlayback({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)",
  }), true);
  assert.equal(prefersMediaElementPlayback({
    platform: "MacIntel",
    maxTouchPoints: 5,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  }), true);
  assert.equal(prefersMediaElementPlayback({
    audioSession: { type: "ambient" },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  }), true);
  assert.equal(prefersMediaElementPlayback({
    audioSession: { type: "playback" },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  }), false);
  assert.equal(prefersMediaElementPlayback({
    userAgent: "Mozilla/5.0 (Linux; Android 15)",
  }), false);
});

test("fallback tones render sustained near-full-scale audio and valid WAV data", () => {
  const minimumDurationMs = {
    tap: 150,
    navigate: 215,
    set: 255,
    saved: 310,
    complete: 500,
    unlock: 450,
    partial: 360,
    error: 380,
    test: 840,
  };

  for (const kind of ["tap", "navigate", "set", "saved", "complete", "unlock", "partial", "error", "test"]) {
    const samples = renderToneSamples(kind);
    const peak = samples.reduce((highest, sample) => Math.max(highest, Math.abs(sample)), 0);
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length);
    const durationMs = samples.length / 24_000 * 1_000;
    const presenceFrequency = Math.max(...tonePattern(kind).map((note) => (
      Math.max(note.frequency, note.frequencyEnd ?? note.frequency)
    )));

    assert.ok(durationMs >= minimumDurationMs[kind]);
    assert.ok(presenceFrequency >= 1_050);
    assert.ok(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(peak >= 0.955 && peak <= 0.965);
    assert.ok(rms >= 0.42 && rms <= 0.6);
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

test("Web Audio normalizes the voice while keeping the master below full scale", async () => {
  const previousWindow = globalThis.window;
  const gainTargets = [];
  const gainSetValues = [];

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
          setValueAtTime(value) { gainSetValues.push(value); },
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
    assert.ok(Math.abs(Math.max(...gainTargets) - 1) < Number.EPSILON * 2);
    assert.ok(gainSetValues.includes(0.98));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("Web Audio configures a near-ceiling peak limiter when the browser supports it", async () => {
  const previousWindow = globalThis.window;
  const limiterSettings = new Map();
  let limiterConnections = 0;

  const audioParam = (name) => ({
    setValueAtTime(value) { limiterSettings.set(name, value); },
  });

  class LimitedAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    createDynamicsCompressor() {
      return {
        threshold: audioParam("threshold"),
        knee: audioParam("knee"),
        ratio: audioParam("ratio"),
        attack: audioParam("attack"),
        release: audioParam("release"),
        connect() { limiterConnections += 1; },
        disconnect() {},
      };
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
          linearRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }

  globalThis.window = { AudioContext: LimitedAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?web-audio-limiter=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("set"), true);
    assert.equal(limiterConnections, 1);
    assert.deepEqual(Object.fromEntries(limiterSettings), {
      threshold: -0.5,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.06,
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("Web Audio replaces an in-flight tone instead of stacking output", async () => {
  const previousWindow = globalThis.window;
  const stopCalls = [];
  let oscillatorId = 0;
  let oscillatorStarts = 0;

  class RunningAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    createOscillator() {
      oscillatorId += 1;
      const id = oscillatorId;
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() { oscillatorStarts += 1; },
        stop(at) { stopCalls.push({ at, id }); },
      };
    }

    createGain() {
      return {
        gain: {
          cancelScheduledValues() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {},
          setValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }

  globalThis.window = { AudioContext: RunningAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?web-audio-replace=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("saved"), true);
    assert.equal(feedback.playInterfaceTone("navigate"), true);
    assert.equal(oscillatorStarts, 4);
    assert.deepEqual(
      stopCalls.filter(({ at }) => at < 0.02).map(({ id }) => id),
      [1, 2],
    );
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("a partially scheduled Web Audio tone is stopped before fallback playback", async () => {
  const previousWindow = globalThis.window;
  const stopCalls = [];
  let oscillatorCount = 0;
  let fallbackPlays = 0;
  let outputDisconnects = 0;

  class FragileAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    createOscillator() {
      oscillatorCount += 1;
      if (oscillatorCount === 2) throw new Error("node limit");
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop(at) { stopCalls.push(at); },
      };
    }

    createGain() {
      const isOutput = oscillatorCount === 0;
      return {
        gain: {
          cancelScheduledValues() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {},
          setValueAtTime() {},
        },
        connect() {},
        disconnect() { if (isOutput) outputDisconnects += 1; },
      };
    }
  }

  class FallbackAudio {
    pause() {}
    play() { fallbackPlays += 1; return Promise.resolve(); }
  }

  globalThis.window = { Audio: FallbackAudio, AudioContext: FragileAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?web-audio-partial=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("saved"), true);
    assert.ok(Math.abs(stopCalls[0] - 0.19) < 0.000_001);
    assert.equal(stopCalls[1], 0);
    assert.equal(outputDisconnects, 1);
    assert.equal(fallbackPlays, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("a partially supported limiter degrades to the bounded Web Audio mix", async () => {
  const previousWindow = globalThis.window;
  let oscillatorStarts = 0;
  let fallbackPlays = 0;

  class PartialAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }

    createDynamicsCompressor() {
      throw new Error("limiter unavailable");
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

  class FallbackAudio {
    pause() {}
    play() { fallbackPlays += 1; return Promise.resolve(); }
  }

  globalThis.window = { Audio: FallbackAudio, AudioContext: PartialAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?partial-limiter=${Date.now()}`);
    assert.equal(feedback.playInterfaceTone("saved"), true);
    assert.equal(oscillatorStarts, 2);
    assert.equal(fallbackPlays, 0);
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

test("haptic patterns separate interface intent from semantic outcomes", () => {
  assert.deepEqual(hapticPattern("tap"), [45]);
  assert.deepEqual(hapticPattern("navigate"), [55]);
  assert.deepEqual(hapticPattern("save"), hapticPattern("saved"));
  assert.deepEqual(hapticPattern("finish"), hapticPattern("complete"));
  assert.ok(hapticPattern("set").reduce((sum, duration) => sum + duration, 0) > hapticPattern("tap")[0]);
  assert.ok(hapticPattern("complete").length > hapticPattern("saved").length);
  assert.ok(hapticPattern("error")[0] > hapticPattern("navigate")[0]);
  assert.deepEqual(hapticPattern("unknown"), hapticPattern("tap"));
});

test("mutation outcomes resolve to semantic haptic patterns", () => {
  assert.equal(mutationSuccessHaptic("unlock"), "unlock");
  assert.equal(mutationSuccessHaptic("set:a-press:2"), "set");
  assert.equal(mutationSuccessHaptic("finish"), "complete");
  assert.equal(mutationSuccessHaptic("end-incomplete"), "partial");
  assert.equal(mutationSuccessHaptic("weight:add"), "saved");
});

test("supported visible interfaces vibrate while unsupported and disabled interfaces stay safe", async () => {
  const feedback = await import(`../src/interfaceFeedback.js?haptic-safety=${Date.now()}`);
  const patterns = [];
  const supported = { vibrate: (pattern) => { patterns.push(pattern); return true; } };
  const visible = { visibilityState: "visible" };

  assert.equal(feedback.playInterfaceHaptic("set", true, {
    navigatorTarget: supported,
    documentTarget: visible,
    matchMediaTarget: () => ({ matches: false }),
    now: () => 1_000,
  }), true);
  assert.deepEqual(patterns, [[75, 35, 95]]);
  assert.equal(feedback.playInterfaceHaptic("saved", false, {
    navigatorTarget: supported,
    documentTarget: visible,
    now: () => 2_000,
  }), false);
  assert.equal(feedback.playInterfaceHaptic("saved", true, {
    navigatorTarget: {},
    documentTarget: visible,
    now: () => 2_000,
  }), false);
  assert.equal(feedback.playInterfaceHaptic("saved", true, {
    navigatorTarget: supported,
    documentTarget: { visibilityState: "hidden" },
    now: () => 2_000,
  }), false);
  assert.equal(feedback.playInterfaceHaptic("saved", true, {
    navigatorTarget: { vibrate: () => { throw new Error("blocked"); } },
    documentTarget: visible,
    now: () => 2_000,
  }), false);
  assert.equal(patterns.length, 1);
});

test("haptics respect reduced motion unless the caller explicitly overrides it", async () => {
  const feedback = await import(`../src/interfaceFeedback.js?haptic-motion=${Date.now()}`);
  let vibrationCount = 0;
  const options = {
    navigatorTarget: { vibrate: () => { vibrationCount += 1; return true; } },
    documentTarget: { visibilityState: "visible" },
    matchMediaTarget: () => ({ matches: true }),
    now: () => 3_000,
  };

  assert.equal(feedback.playInterfaceHaptic("tap", true, options), false);
  assert.equal(feedback.playInterfaceHaptic("tap", true, {
    ...options,
    respectReducedMotion: false,
  }), true);
  assert.equal(vibrationCount, 1);
});

test("trusted intent haptics are deduplicated without suppressing semantic completion", async () => {
  const feedback = await import(`../src/interfaceFeedback.js?haptic-dedupe=${Date.now()}`);
  const patterns = [];
  const sharedOptions = {
    navigatorTarget: { vibrate: (pattern) => { patterns.push(pattern); return true; } },
    documentTarget: { visibilityState: "visible" },
    matchMediaTarget: () => ({ matches: false }),
  };

  assert.equal(feedback.playInterfaceHapticForEvent({ isTrusted: false }, "tap", true, {
    ...sharedOptions,
    now: () => 4_000,
  }), false);
  assert.equal(feedback.playInterfaceHapticForEvent({ isTrusted: true }, "tap", true, {
    ...sharedOptions,
    now: () => 4_000,
  }), true);
  assert.equal(feedback.playInterfaceHapticForEvent({ isTrusted: true }, "navigate", true, {
    ...sharedOptions,
    now: () => 4_050,
  }), false);
  assert.equal(feedback.playInterfaceHaptic("set", true, {
    ...sharedOptions,
    now: () => 4_055,
  }), true);
  assert.equal(feedback.playInterfaceHapticForEvent({ isTrusted: true }, "navigate", true, {
    ...sharedOptions,
    now: () => 4_121,
  }), true);
  assert.deepEqual(patterns, [[45], [75, 35, 95], [55]]);
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

test("the loud diagnostic reports accepted and blocked media playback", async () => {
  const previousWindow = globalThis.window;

  class AcceptedAudio {
    pause() {}
    play() { return Promise.resolve(); }
  }

  class BlockedAudio {
    pause() {}
    play() { return Promise.reject(new Error("not allowed")); }
  }

  try {
    globalThis.window = { Audio: AcceptedAudio };
    const acceptedFeedback = await import(`../src/interfaceFeedback.js?test-accepted=${Date.now()}`);
    assert.equal(await acceptedFeedback.playInterfaceTestTone(), true);

    globalThis.window = { Audio: BlockedAudio };
    const blockedFeedback = await import(`../src/interfaceFeedback.js?test-blocked=${Date.now()}`);
    assert.equal(await blockedFeedback.playInterfaceTestTone(), false);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("the loud diagnostic schedules its dedicated three-note Web Audio pattern", async () => {
  const previousWindow = globalThis.window;
  let oscillatorStarts = 0;

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
        start() { oscillatorStarts += 1; },
        stop() {},
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }

  globalThis.window = { AudioContext: RunningAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?test-web-audio=${Date.now()}`);
    assert.equal(await feedback.playInterfaceTestTone(), true);
    assert.equal(oscillatorStarts, 3);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("a stalled media diagnostic times out and uses a resumed AudioContext", async () => {
  const previousWindow = globalThis.window;
  let oscillatorStarts = 0;
  let pauseCalls = 0;

  class HangingAudio {
    pause() { pauseCalls += 1; }
    play() { return new Promise(() => {}); }
  }

  class ResumableAudioContext {
    constructor() {
      this.state = "suspended";
      this.currentTime = 0;
      this.sampleRate = 24_000;
      this.destination = {};
    }

    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() {} }; }
    resume() { this.state = "running"; return Promise.resolve(); }
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
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }

  globalThis.window = { Audio: HangingAudio, AudioContext: ResumableAudioContext };
  try {
    const feedback = await import(`../src/interfaceFeedback.js?test-timeout=${Date.now()}`);
    const result = await Promise.race([
      feedback.playInterfaceTestTone(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("sound test remained pending")), 2_500)),
    ]);
    assert.equal(result, true);
    assert.equal(oscillatorStarts, 3);
    assert.ok(pauseCalls >= 2);
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
