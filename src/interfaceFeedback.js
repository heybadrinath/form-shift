const STORAGE_KEY = "form-shift:sound-enabled";

const tonePatterns = Object.freeze({
  tap: Object.freeze([
    Object.freeze({ frequency: 240, duration: 0.035, delay: 0, gain: 0.018, type: "sine" }),
  ]),
  navigate: Object.freeze([
    Object.freeze({ frequency: 220, duration: 0.04, delay: 0, gain: 0.016, type: "sine" }),
    Object.freeze({ frequency: 330, duration: 0.05, delay: 0.035, gain: 0.014, type: "sine" }),
  ]),
  saved: Object.freeze([
    Object.freeze({ frequency: 330, duration: 0.06, delay: 0, gain: 0.018, type: "sine" }),
    Object.freeze({ frequency: 495, duration: 0.09, delay: 0.055, gain: 0.016, type: "sine" }),
  ]),
  error: Object.freeze([
    Object.freeze({ frequency: 190, duration: 0.08, delay: 0, gain: 0.016, type: "triangle" }),
    Object.freeze({ frequency: 145, duration: 0.1, delay: 0.065, gain: 0.014, type: "triangle" }),
  ]),
});

let audioContext = null;

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

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

export function playInterfaceTone(kind, enabled = true) {
  if (!enabled) return false;
  const context = getAudioContext();
  if (!context) return false;

  if (context.state === "suspended") {
    context.resume().catch(() => undefined);
  }

  const startAt = context.currentTime + 0.005;
  for (const note of tonePattern(kind)) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + note.delay;
    const noteEnd = noteStart + note.duration;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(note.gain, noteStart + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.01);
  }

  return true;
}

export function mutationStatusLabel(key) {
  if (!key) return "";
  if (key === "unlock") return "Opening journal";
  if (key === "lock") return "Locking journal";
  if (key === "start") return "Starting workout";
  if (key === "finish") return "Saving workout";
  if (key === "end-incomplete") return "Ending workout";
  if (key === "weight:add") return "Saving weight";
  if (key.startsWith("weight:")) return "Updating weight";
  if (key.startsWith("set:")) return "Saving set";
  if (key.startsWith("variant:")) return "Saving setup";
  if (key.startsWith("skip:")) return "Saving exercise";
  return "Saving change";
}

export { STORAGE_KEY as SOUND_PREFERENCE_KEY };
