const STORAGE_KEY = "form-shift:sound-enabled";
const FALLBACK_SAMPLE_RATE = 24_000;
const FALLBACK_TARGET_PEAK = 0.96;
const FALLBACK_SATURATION_DRIVE = 1.55;
const WEB_AUDIO_MASTER_GAIN = 0.98;
const TONE_REPLACEMENT_FADE_SECONDS = 0.006;
const AUDIO_RESUME_TIMEOUT_MS = 250;
const AUDIO_TEST_PLAY_TIMEOUT_MS = 1_500;
const TAP_COOLDOWN_MS = 50;
const HAPTIC_DEDUPE_WINDOW_MS = 120;

const tonePatterns = Object.freeze({
  tap: Object.freeze([
    Object.freeze({ frequency: 1_650, frequencyEnd: 1_350, duration: 0.13, delay: 0, gain: 0.12, type: "triangle" }),
  ]),
  navigate: Object.freeze([
    Object.freeze({ frequency: 1_150, frequencyEnd: 1_400, duration: 0.12, delay: 0, gain: 0.082, type: "triangle" }),
    Object.freeze({ frequency: 1_750, frequencyEnd: 2_050, duration: 0.15, delay: 0.045, gain: 0.076, type: "triangle" }),
  ]),
  set: Object.freeze([
    Object.freeze({ frequency: 1_250, frequencyEnd: 1_600, duration: 0.14, delay: 0, gain: 0.09, type: "triangle" }),
    Object.freeze({ frequency: 2_100, frequencyEnd: 1_850, duration: 0.18, delay: 0.055, gain: 0.078, type: "triangle" }),
  ]),
  saved: Object.freeze([
    Object.freeze({ frequency: 1_050, frequencyEnd: 1_250, duration: 0.17, delay: 0, gain: 0.08, type: "triangle" }),
    Object.freeze({ frequency: 1_650, frequencyEnd: 1_900, duration: 0.21, delay: 0.08, gain: 0.082, type: "triangle" }),
  ]),
  complete: Object.freeze([
    Object.freeze({ frequency: 950, frequencyEnd: 1_100, duration: 0.19, delay: 0, gain: 0.078, type: "triangle" }),
    Object.freeze({ frequency: 1_350, frequencyEnd: 1_550, duration: 0.22, delay: 0.11, gain: 0.08, type: "triangle" }),
    Object.freeze({ frequency: 1_850, frequencyEnd: 2_150, duration: 0.26, delay: 0.22, gain: 0.084, type: "triangle" }),
  ]),
  unlock: Object.freeze([
    Object.freeze({ frequency: 1_000, frequencyEnd: 1_200, duration: 0.17, delay: 0, gain: 0.076, type: "triangle" }),
    Object.freeze({ frequency: 1_500, frequencyEnd: 1_750, duration: 0.21, delay: 0.09, gain: 0.08, type: "triangle" }),
    Object.freeze({ frequency: 2_050, frequencyEnd: 2_350, duration: 0.24, delay: 0.19, gain: 0.08, type: "triangle" }),
  ]),
  partial: Object.freeze([
    Object.freeze({ frequency: 1_300, frequencyEnd: 1_100, duration: 0.18, delay: 0, gain: 0.082, type: "triangle" }),
    Object.freeze({ frequency: 950, frequencyEnd: 800, duration: 0.24, delay: 0.1, gain: 0.08, type: "triangle" }),
  ]),
  error: Object.freeze([
    Object.freeze({ frequency: 1_050, frequencyEnd: 850, duration: 0.19, delay: 0, gain: 0.09, type: "triangle" }),
    Object.freeze({ frequency: 900, frequencyEnd: 700, duration: 0.25, delay: 0.11, gain: 0.086, type: "triangle" }),
  ]),
  test: Object.freeze([
    Object.freeze({ frequency: 1_200, frequencyEnd: 1_500, duration: 0.22, delay: 0, gain: 0.082, type: "triangle" }),
    Object.freeze({ frequency: 1_650, frequencyEnd: 1_950, duration: 0.22, delay: 0.26, gain: 0.084, type: "triangle" }),
    Object.freeze({ frequency: 2_050, frequencyEnd: 2_350, duration: 0.3, delay: 0.52, gain: 0.086, type: "triangle" }),
  ]),
});

const hapticPatterns = Object.freeze({
  tap: Object.freeze([45]),
  navigate: Object.freeze([55]),
  set: Object.freeze([75, 35, 95]),
  saved: Object.freeze([70, 35, 110]),
  complete: Object.freeze([90, 45, 125, 55, 180]),
  unlock: Object.freeze([70, 35, 110]),
  partial: Object.freeze([85, 50, 85]),
  error: Object.freeze([140, 65, 140]),
});

const hapticAliases = Object.freeze({
  button: "tap",
  save: "saved",
  finish: "complete",
});

let audioContext = null;
let activeWebAudioTone = null;
let fallbackAudio = null;
let fallbackPlaybackId = 0;
let resumePromise = null;
let lastTapAt = 0;
let lastHapticAt = Number.NEGATIVE_INFINITY;
let lastHapticKey = null;
const fallbackUriCache = new Map();

export function parseSoundPreference(value, fallback = true) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function readSoundPreference(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    return parseSoundPreference(target?.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

export function writeSoundPreference(enabled, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target?.setItem(STORAGE_KEY, String(Boolean(enabled)));
  } catch {
    // A blocked storage API should not prevent the interface from working.
  }
}

export function tonePattern(kind) {
  return tonePatterns[kind] ?? tonePatterns.tap;
}

export function mutationSuccessTone(key) {
  if (key === "unlock") return "unlock";
  if (key === "finish") return "complete";
  if (key?.startsWith("set:")) return "set";
  return "saved";
}

function resolveHapticKind(kind) {
  const resolvedKind = hapticAliases[kind] ?? kind;
  return hapticPatterns[resolvedKind] ? resolvedKind : "tap";
}

export function hapticPattern(kind) {
  return hapticPatterns[resolveHapticKind(kind)];
}

export function mutationSuccessHaptic(key) {
  if (key === "unlock") return "unlock";
  if (key === "finish") return "complete";
  if (key === "end-incomplete") return "partial";
  if (key?.startsWith("set:")) return "set";
  return "saved";
}

function reducedMotionRequested(matchMediaTarget) {
  const query = matchMediaTarget
    ?? globalThis.window?.matchMedia?.bind(globalThis.window);
  if (typeof query !== "function") return false;
  try {
    return query("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}

function hapticDedupeKey(kind) {
  return kind === "tap" || kind === "navigate" ? "intent" : kind;
}

export function playInterfaceHaptic(kind, enabled = true, options = {}) {
  if (!enabled) return false;

  const navigatorTarget = options.navigatorTarget ?? globalThis.navigator;
  const documentTarget = options.documentTarget ?? globalThis.document;
  if (typeof navigatorTarget?.vibrate !== "function") return false;
  if (documentTarget?.visibilityState && documentTarget.visibilityState !== "visible") return false;
  if (options.respectReducedMotion !== false && reducedMotionRequested(options.matchMediaTarget)) return false;

  const resolvedKind = resolveHapticKind(kind);
  const dedupeKey = hapticDedupeKey(resolvedKind);
  const now = typeof options.now === "function" ? options.now() : Date.now();
  if (dedupeKey === lastHapticKey && now - lastHapticAt < HAPTIC_DEDUPE_WINDOW_MS) return false;

  try {
    const started = navigatorTarget.vibrate(hapticPatterns[resolvedKind]);
    if (started === false) return false;
    lastHapticAt = now;
    lastHapticKey = dedupeKey;
    return true;
  } catch {
    return false;
  }
}

export function playInterfaceHapticForEvent(event, kind, enabled = true, options = {}) {
  if (event?.isTrusted !== true) return false;
  return playInterfaceHaptic(kind, enabled, options);
}

export function configurePlaybackAudioSession(navigatorTarget = globalThis.navigator) {
  const session = navigatorTarget?.audioSession;
  if (!session) return false;
  try {
    session.type = "playback";
    return session.type === "playback";
  } catch {
    return false;
  }
}

export function prefersMediaElementPlayback(navigatorTarget = globalThis.navigator) {
  const userAgent = navigatorTarget?.userAgent ?? "";
  const classicAppleMobile = /iPad|iPhone|iPod/i.test(userAgent);
  const touchMac = navigatorTarget?.platform === "MacIntel" && navigatorTarget?.maxTouchPoints > 1;
  if (!classicAppleMobile && !touchMac) return false;
  try {
    return navigatorTarget?.audioSession?.type !== "playback";
  } catch {
    return true;
  }
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  configurePlaybackAudioSession();
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext || audioContext.state === "closed") {
    try {
      audioContext = new AudioContextClass({ latencyHint: "interactive" });
      activeWebAudioTone = null;
      resumePromise = null;
    } catch {
      audioContext = null;
    }
  }
  return audioContext;
}

function replaceActiveWebAudioTone(context) {
  const activeTone = activeWebAudioTone;
  if (!activeTone || activeTone.context !== context) return;
  activeWebAudioTone = null;

  const fadeEnd = context.currentTime + TONE_REPLACEMENT_FADE_SECONDS;
  try {
    activeTone.output.gain.cancelScheduledValues?.(context.currentTime);
    activeTone.output.gain.setValueAtTime(activeTone.outputLevel, context.currentTime);
    if (typeof activeTone.output.gain.linearRampToValueAtTime === "function") {
      activeTone.output.gain.linearRampToValueAtTime(0.0001, fadeEnd);
    } else {
      activeTone.output.gain.setValueAtTime(0.0001, fadeEnd);
    }
  } catch {
    // Stopping the oscillators still prevents repeated tones from stacking.
  }

  for (const oscillator of activeTone.oscillators) {
    try {
      oscillator.stop(fadeEnd + 0.002);
    } catch {
      // An oscillator that has already ended needs no further cleanup.
    }
  }
}

function createSilentSource(context) {
  if (typeof context.createBuffer !== "function" || typeof context.createBufferSource !== "function") return;
  const buffer = context.createBuffer(1, 1, context.sampleRate || FALLBACK_SAMPLE_RATE);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

function resumeAudioContext(context) {
  if (resumePromise) return resumePromise;
  try {
    if (context.state === "running") return Promise.resolve(true);
    if (context.state === "closed" || typeof context.resume !== "function") {
      return Promise.resolve(false);
    }
    createSilentSource(context);
    const resumeAttempt = Promise.resolve(context.resume())
      .then(() => context.state === "running")
      .catch(() => false);
    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(false), AUDIO_RESUME_TIMEOUT_MS);
    });
    let boundedResume;
    boundedResume = Promise.race([resumeAttempt, timeout])
      .finally(() => {
        clearTimeout(timeoutId);
        if (resumePromise === boundedResume) resumePromise = null;
      });
    resumePromise = boundedResume;
    return boundedResume;
  } catch {
    return Promise.resolve(false);
  }
}

function noteEnvelope(progress) {
  const attack = Math.min(1, progress / 0.035);
  const releaseProgress = Math.max(0, (progress - 0.7) / 0.3);
  const release = Math.cos(Math.min(1, releaseProgress) * Math.PI * 0.5) ** 1.25;
  return attack * release;
}

function waveSample(type, phase) {
  if (type === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

export function renderToneSamples(kind, sampleRate = FALLBACK_SAMPLE_RATE) {
  const pattern = tonePattern(kind);
  const endTime = Math.max(...pattern.map((note) => note.delay + note.duration)) + 0.025;
  const samples = new Float32Array(Math.ceil(endTime * sampleRate));

  for (const note of pattern) {
    const startIndex = Math.floor(note.delay * sampleRate);
    const noteSamples = Math.max(1, Math.ceil(note.duration * sampleRate));
    let phase = 0;

    for (let offset = 0; offset < noteSamples && startIndex + offset < samples.length; offset += 1) {
      const progress = offset / noteSamples;
      const frequency = note.frequency + ((note.frequencyEnd ?? note.frequency) - note.frequency) * progress;
      phase += (Math.PI * 2 * frequency) / sampleRate;
      const fundamental = waveSample(note.type, phase);
      const secondHarmonic = Math.sin(phase * 2) * 0.18;
      const thirdHarmonic = Math.sin(phase * 3) * 0.055;
      samples[startIndex + offset] += (fundamental + secondHarmonic + thirdHarmonic)
        * note.gain
        * noteEnvelope(progress);
    }
  }

  let rawPeak = 0;
  for (const sample of samples) rawPeak = Math.max(rawPeak, Math.abs(sample));
  if (rawPeak === 0) return samples;

  const saturationPeak = Math.tanh(FALLBACK_SATURATION_DRIVE);
  for (let index = 0; index < samples.length; index += 1) {
    const normalized = samples[index] / rawPeak;
    samples[index] = (Math.tanh(normalized * FALLBACK_SATURATION_DRIVE) / saturationPeak)
      * FALLBACK_TARGET_PEAK;
  }
  return samples;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  if (typeof btoa !== "function") return "";
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function interfaceToneDataUri(kind) {
  const resolvedKind = tonePatterns[kind] ? kind : "tap";
  if (fallbackUriCache.has(resolvedKind)) return fallbackUriCache.get(resolvedKind);

  const samples = renderToneSamples(resolvedKind);
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, FALLBACK_SAMPLE_RATE, true);
  view.setUint32(28, FALLBACK_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
  }

  const base64 = bytesToBase64(new Uint8Array(buffer));
  const uri = base64 ? `data:audio/wav;base64,${base64}` : "";
  fallbackUriCache.set(resolvedKind, uri);
  return uri;
}

function getFallbackAudio() {
  if (typeof window === "undefined" || typeof window.Audio !== "function") return null;
  if (!fallbackAudio) {
    try {
      fallbackAudio = new window.Audio();
      fallbackAudio.preload = "auto";
      fallbackAudio.playsInline = true;
    } catch {
      fallbackAudio = null;
    }
  }
  return fallbackAudio;
}

function primeFallbackAudio() {
  const audio = getFallbackAudio();
  if (!audio) return Promise.resolve(false);
  const uri = interfaceToneDataUri("tap");
  if (!uri) return Promise.resolve(false);

  try {
    const playbackId = fallbackPlaybackId + 1;
    fallbackPlaybackId = playbackId;
    audio.src = uri;
    audio.volume = 0;
    const playback = audio.play();
    return Promise.resolve(playback)
      .then(() => {
        if (fallbackPlaybackId === playbackId) {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
        }
        return true;
      })
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

function startFallbackTone(kind) {
  const audio = getFallbackAudio();
  const uri = interfaceToneDataUri(kind);
  if (!audio || !uri) return null;

  try {
    const playbackId = fallbackPlaybackId + 1;
    fallbackPlaybackId = playbackId;
    audio.pause();
    audio.src = uri;
    audio.currentTime = 0;
    audio.volume = 1;
    const result = Promise.resolve(audio.play())
      .then(() => true)
      .catch(() => false);
    const cancel = () => {
      if (fallbackPlaybackId !== playbackId) return;
      fallbackPlaybackId += 1;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // A stale mobile media element can still be replaced on the next attempt.
      }
    };
    return { cancel, result };
  } catch {
    return null;
  }
}

function playFallbackTone(kind) {
  const attempt = startFallbackTone(kind);
  if (!attempt) return false;
  void attempt.result;
  return true;
}

function playFallbackToneWithResult(kind, timeoutMs) {
  const attempt = startFallbackTone(kind);
  if (!attempt) return Promise.resolve(false);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return attempt.result;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    const finish = (started) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(started);
    };
    timeoutId = setTimeout(() => {
      attempt.cancel();
      finish(false);
    }, timeoutMs);
    attempt.result.then(finish);
  });
}

function maximumConcurrentPatternGain(pattern) {
  const checkpoints = pattern.flatMap((note) => [
    note.delay,
    note.delay + note.duration - Number.EPSILON,
  ]);
  return Math.max(...checkpoints.map((time) => pattern.reduce((total, note) => {
    const active = time >= note.delay && time < note.delay + note.duration;
    return total + (active ? note.gain : 0);
  }, 0)));
}

function configurePeakLimiter(context, output, startAt) {
  if (typeof context.createDynamicsCompressor !== "function") return null;
  let limiter = null;
  try {
    limiter = context.createDynamicsCompressor();
    limiter.threshold?.setValueAtTime?.(-0.5, startAt);
    limiter.knee?.setValueAtTime?.(0, startAt);
    limiter.ratio?.setValueAtTime?.(20, startAt);
    limiter.attack?.setValueAtTime?.(0.001, startAt);
    limiter.release?.setValueAtTime?.(0.06, startAt);
    limiter.connect(output);
    return limiter;
  } catch {
    try {
      limiter?.disconnect();
    } catch {
      // The deterministic mix bound remains safe without the optional limiter.
    }
    return null;
  }
}

function scheduleNoteEnvelope(parameter, peak, noteStart, noteEnd) {
  const attackEnd = noteStart + Math.min(0.008, (noteEnd - noteStart) * 0.08);
  const releaseStart = noteStart + (noteEnd - noteStart) * 0.7;
  parameter.setValueAtTime(0.0001, noteStart);
  if (typeof parameter.linearRampToValueAtTime === "function") {
    parameter.linearRampToValueAtTime(peak, attackEnd);
  } else {
    parameter.exponentialRampToValueAtTime(peak, attackEnd);
  }
  parameter.setValueAtTime(peak, releaseStart);
  if (typeof parameter.linearRampToValueAtTime === "function") {
    parameter.linearRampToValueAtTime(0.0001, noteEnd);
  } else {
    parameter.exponentialRampToValueAtTime(0.0001, noteEnd);
  }
}

function scheduleWebAudioTone(context, kind) {
  if (context.state !== "running") return false;
  const startAt = context.currentTime + 0.008;
  const pattern = tonePattern(kind);
  const voiceGainScale = 1 / maximumConcurrentPatternGain(pattern);
  let output = null;
  let limiter = null;
  let voice = null;

  try {
    output = context.createGain();
    output.gain.setValueAtTime(WEB_AUDIO_MASTER_GAIN, startAt);
    output.connect(context.destination);
    replaceActiveWebAudioTone(context);
    limiter = configurePeakLimiter(context, output, startAt);

    voice = {
      context,
      disposed: false,
      gains: [],
      limiter,
      oscillators: [],
      output,
      outputLevel: WEB_AUDIO_MASTER_GAIN,
      remaining: pattern.length,
    };
    activeWebAudioTone = voice;

    for (const note of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + note.delay;
      const noteEnd = noteStart + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      if (note.frequencyEnd && typeof oscillator.frequency.exponentialRampToValueAtTime === "function") {
        oscillator.frequency.exponentialRampToValueAtTime(note.frequencyEnd, noteEnd);
      }
      scheduleNoteEnvelope(gain.gain, note.gain * voiceGainScale, noteStart, noteEnd);
      oscillator.connect(gain);
      gain.connect(limiter ?? output);
      voice.gains.push(gain);
      voice.oscillators.push(oscillator);
      oscillator.onended = () => {
        if (voice.disposed) return;
        oscillator.disconnect();
        gain.disconnect();
        voice.remaining -= 1;
        if (voice.remaining === 0) {
          limiter?.disconnect();
          output.disconnect();
          if (activeWebAudioTone === voice) activeWebAudioTone = null;
        }
      };
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.012);
    }
    return true;
  } catch {
    if (voice) {
      voice.disposed = true;
      if (activeWebAudioTone === voice) activeWebAudioTone = null;
      for (const oscillator of voice.oscillators) {
        try {
          oscillator.stop(context.currentTime);
        } catch {
          // A partially scheduled oscillator may already be stopped.
        }
        try {
          oscillator.disconnect();
        } catch {
          // A failed node may never have connected.
        }
      }
      for (const gain of voice.gains) {
        try {
          gain.disconnect();
        } catch {
          // A failed node may never have connected.
        }
      }
      try {
        voice.limiter?.disconnect();
      } catch {
        // A partially created limiter may never have connected.
      }
    }
    try {
      output?.disconnect();
    } catch {
      // The fallback tone remains available even when cleanup is best effort.
    }
    return false;
  }
}

export function primeInterfaceAudio(enabled = true) {
  if (!enabled) return Promise.resolve(false);
  configurePlaybackAudioSession();
  const context = getAudioContext();
  const fallbackReady = primeFallbackAudio();
  if (context) {
    if (context.state === "running") {
      return fallbackReady.then(() => true);
    }
    const webAudioReady = resumeAudioContext(context);
    return Promise.all([webAudioReady, fallbackReady])
      .then(([contextReady, audioReady]) => contextReady || audioReady);
  }
  return fallbackReady;
}

export function playInterfaceTone(kind, enabled = true) {
  if (!enabled) return false;
  if (kind === "tap") {
    const now = Date.now();
    if (now - lastTapAt < TAP_COOLDOWN_MS) return false;
    lastTapAt = now;
  }
  configurePlaybackAudioSession();
  if (prefersMediaElementPlayback() && playFallbackTone(kind)) return true;
  const context = getAudioContext();

  if (!context) return playFallbackTone(kind);
  if (context.state === "running") {
    return scheduleWebAudioTone(context, kind) || playFallbackTone(kind);
  }

  const fallbackStarted = playFallbackTone(kind);
  void resumeAudioContext(context);
  return fallbackStarted;
}

export async function playInterfaceTestTone(enabled = true) {
  if (!enabled) return false;
  configurePlaybackAudioSession();

  if (prefersMediaElementPlayback()) {
    return playFallbackToneWithResult("test", AUDIO_TEST_PLAY_TIMEOUT_MS);
  }
  const context = getAudioContext();
  if (!context) return playFallbackToneWithResult("test", AUDIO_TEST_PLAY_TIMEOUT_MS);
  if (context.state === "running") {
    return scheduleWebAudioTone(context, "test")
      || playFallbackToneWithResult("test", AUDIO_TEST_PLAY_TIMEOUT_MS);
  }

  const fallbackResult = playFallbackToneWithResult("test", AUDIO_TEST_PLAY_TIMEOUT_MS);
  const resumeResult = resumeAudioContext(context);
  if (await fallbackResult) return true;
  if (!(await resumeResult)) return false;
  return scheduleWebAudioTone(context, "test");
}

export function resetInterfaceAudioAfterBackground() {
  resumePromise = null;
  activeWebAudioTone = null;
  const context = audioContext;
  audioContext = null;
  if (context && context.state !== "closed" && typeof context.close === "function") {
    Promise.resolve(context.close()).catch(() => undefined);
  }

  fallbackPlaybackId += 1;
  const staleFallbackAudio = fallbackAudio;
  fallbackAudio = null;
  if (staleFallbackAudio) {
    try {
      staleFallbackAudio.pause();
      staleFallbackAudio.currentTime = 0;
      staleFallbackAudio.volume = 1;
      staleFallbackAudio.removeAttribute?.("src");
      staleFallbackAudio.load?.();
    } catch {
      // Background recovery remains best effort and must never affect the app.
    }
  }
}

export function mutationStatusLabel(key) {
  if (!key) return "";
  if (key === "unlock") return "Opening journal";
  if (key === "lock") return "Locking journal";
  if (key === "start") return "Starting workout";
  if (key === "finish") return "Saving workout";
  if (key === "finish-weight") return "Workout saved · saving weight";
  if (key === "end-incomplete") return "Ending workout";
  if (key === "weight:add") return "Saving weight";
  if (key.startsWith("weight:")) return "Updating weight";
  if (key.startsWith("set:")) return "Saving set";
  if (key.startsWith("variant:")) return "Saving setup";
  if (key.startsWith("skip:")) return "Saving exercise";
  return "Saving change";
}

export { STORAGE_KEY as SOUND_PREFERENCE_KEY };
