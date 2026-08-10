const STORAGE_KEY = "form-shift:sound-enabled";
const FALLBACK_SAMPLE_RATE = 24_000;
const FALLBACK_MASTER_GAIN = 0.92;

const tonePatterns = Object.freeze({
  tap: Object.freeze([
    Object.freeze({ frequency: 620, frequencyEnd: 500, duration: 0.042, delay: 0, gain: 0.085, type: "sine" }),
  ]),
  navigate: Object.freeze([
    Object.freeze({ frequency: 360, frequencyEnd: 410, duration: 0.055, delay: 0, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 510, frequencyEnd: 560, duration: 0.065, delay: 0.038, gain: 0.047, type: "sine" }),
  ]),
  set: Object.freeze([
    Object.freeze({ frequency: 470, frequencyEnd: 560, duration: 0.05, delay: 0, gain: 0.075, type: "triangle" }),
    Object.freeze({ frequency: 760, frequencyEnd: 700, duration: 0.075, delay: 0.022, gain: 0.043, type: "sine" }),
  ]),
  saved: Object.freeze([
    Object.freeze({ frequency: 523.25, frequencyEnd: 560, duration: 0.09, delay: 0, gain: 0.055, type: "sine" }),
    Object.freeze({ frequency: 783.99, frequencyEnd: 820, duration: 0.13, delay: 0.065, gain: 0.052, type: "sine" }),
  ]),
  complete: Object.freeze([
    Object.freeze({ frequency: 392, frequencyEnd: 415, duration: 0.11, delay: 0, gain: 0.05, type: "sine" }),
    Object.freeze({ frequency: 523.25, frequencyEnd: 545, duration: 0.13, delay: 0.075, gain: 0.052, type: "sine" }),
    Object.freeze({ frequency: 659.25, frequencyEnd: 690, duration: 0.18, delay: 0.15, gain: 0.055, type: "sine" }),
  ]),
  unlock: Object.freeze([
    Object.freeze({ frequency: 440, frequencyEnd: 470, duration: 0.09, delay: 0, gain: 0.052, type: "sine" }),
    Object.freeze({ frequency: 659.25, frequencyEnd: 700, duration: 0.13, delay: 0.06, gain: 0.055, type: "sine" }),
    Object.freeze({ frequency: 880, frequencyEnd: 920, duration: 0.16, delay: 0.13, gain: 0.048, type: "sine" }),
  ]),
  partial: Object.freeze([
    Object.freeze({ frequency: 440, frequencyEnd: 420, duration: 0.09, delay: 0, gain: 0.052, type: "sine" }),
    Object.freeze({ frequency: 329.63, frequencyEnd: 310, duration: 0.14, delay: 0.075, gain: 0.048, type: "triangle" }),
  ]),
  error: Object.freeze([
    Object.freeze({ frequency: 290, frequencyEnd: 255, duration: 0.1, delay: 0, gain: 0.06, type: "triangle" }),
    Object.freeze({ frequency: 235, frequencyEnd: 205, duration: 0.14, delay: 0.08, gain: 0.052, type: "triangle" }),
  ]),
});

let audioContext = null;
let fallbackAudio = null;
let fallbackPlaybackId = 0;
let pendingToneId = 0;
let resumePromise = null;
let lastTapAt = 0;
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

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext || audioContext.state === "closed") {
    try {
      audioContext = new AudioContextClass({ latencyHint: "interactive" });
      resumePromise = null;
    } catch {
      audioContext = null;
    }
  }
  return audioContext;
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
      return Promise.resolve(context.state !== "closed");
    }
    createSilentSource(context);
    resumePromise = Promise.resolve(context.resume())
      .then(() => context.state !== "closed")
      .catch(() => false)
      .finally(() => {
        resumePromise = null;
      });
    return resumePromise;
  } catch {
    return Promise.resolve(false);
  }
}

function noteEnvelope(progress) {
  const attack = Math.min(1, progress / 0.08);
  const release = Math.pow(Math.max(0, 1 - progress), 2.3);
  return attack * release;
}

function waveSample(type, phase) {
  if (type === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

export function renderToneSamples(kind, sampleRate = FALLBACK_SAMPLE_RATE) {
  const pattern = tonePattern(kind);
  const endTime = Math.max(...pattern.map((note) => note.delay + note.duration)) + 0.018;
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
      const harmonic = Math.sin(phase * 2) * 0.12;
      samples[startIndex + offset] += (fundamental + harmonic) * note.gain * noteEnvelope(progress);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.max(-1, Math.min(1, samples[index] * FALLBACK_MASTER_GAIN));
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

function playFallbackTone(kind) {
  const audio = getFallbackAudio();
  const uri = interfaceToneDataUri(kind);
  if (!audio || !uri) return false;

  try {
    fallbackPlaybackId += 1;
    audio.pause();
    audio.src = uri;
    audio.currentTime = 0;
    audio.volume = 1;
    Promise.resolve(audio.play()).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

function scheduleWebAudioTone(context, kind) {
  if (context.state !== "running") return false;
  const startAt = context.currentTime + 0.008;

  try {
    for (const note of tonePattern(kind)) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + note.delay;
      const noteEnd = noteStart + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      if (note.frequencyEnd && typeof oscillator.frequency.exponentialRampToValueAtTime === "function") {
        oscillator.frequency.exponentialRampToValueAtTime(note.frequencyEnd, noteEnd);
      }
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(note.gain, noteStart + Math.min(0.009, note.duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.012);
    }
    return true;
  } catch {
    return false;
  }
}

export function primeInterfaceAudio(enabled = true) {
  if (!enabled) return Promise.resolve(false);
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
    if (now - lastTapAt < 24) return false;
    lastTapAt = now;
  }
  const context = getAudioContext();
  const toneId = pendingToneId + 1;
  pendingToneId = toneId;

  if (!context) return playFallbackTone(kind);
  if (context.state === "running") {
    return scheduleWebAudioTone(context, kind) || playFallbackTone(kind);
  }

  resumeAudioContext(context).then((ready) => {
    if (pendingToneId !== toneId) return;
    if (!ready || !scheduleWebAudioTone(context, kind)) playFallbackTone(kind);
  });
  return true;
}

export function resetInterfaceAudioAfterBackground() {
  pendingToneId += 1;
  resumePromise = null;
  const context = audioContext;
  audioContext = null;
  if (context && context.state !== "closed" && typeof context.close === "function") {
    Promise.resolve(context.close()).catch(() => undefined);
  }

  fallbackPlaybackId += 1;
  if (fallbackAudio) {
    try {
      fallbackAudio.pause();
      fallbackAudio.currentTime = 0;
      fallbackAudio.volume = 1;
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
