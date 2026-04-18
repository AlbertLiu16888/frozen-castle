/**
 * Audio: procedural background music via Web Audio + voice prompts via SpeechSynthesis.
 *
 * Design:
 * - Zero audio files. Music is a short looping arpeggio of bells + bass pad.
 * - Voice uses the browser's built-in Chinese TTS (zh-TW preferred).
 * - Everything starts only after the first user gesture (autoplay policy).
 * - A single mute toggle silences both music and voice.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicLoopTimer: number | null = null;
let musicStarted = false;
let muted = false;

function ensureCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12; // keep music soft under voice
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peak: number,
): void {
  if (!ctx || !musicGain) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(peak, startTime + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  o.connect(g).connect(musicGain);
  o.start(startTime);
  o.stop(startTime + duration + 0.05);
}

export function startMusic(): void {
  if (musicStarted) return;
  const c = ensureCtx();
  if (!c) return;
  musicStarted = true;

  // Pentatonic-ish bell melody — magical, child-friendly
  const melody = [
    523.25, 659.25, 783.99, 987.77, // C5 E5 G5 B5
    1046.5, 987.77, 783.99, 659.25, // C6 B5 G5 E5
    523.25, 659.25, 880.00, 783.99, // C5 E5 A5 G5
    659.25, 523.25, 659.25, 783.99, // E5 C5 E5 G5
  ];
  const bass = [130.81, 164.81, 196.00, 174.61]; // C3 E3 G3 F3

  const BEAT = 0.45; // seconds per melody note
  const CHUNK = 16; // schedule this many notes per batch
  let step = 0;

  const schedule = () => {
    if (!ctx || !musicStarted) return;
    const start = ctx.currentTime + 0.1;
    for (let i = 0; i < CHUNK; i++) {
      const t = start + i * BEAT;
      playTone(melody[(step + i) % melody.length], t, 1.2, 'sine', 0.25);
      if (i % 4 === 0) {
        playTone(bass[((step + i) / 4 | 0) % bass.length], t, BEAT * 4.5, 'triangle', 0.2);
      }
    }
    step += CHUNK;
  };

  schedule();
  musicLoopTimer = window.setInterval(schedule, CHUNK * BEAT * 1000);
}

export function stopMusic(): void {
  musicStarted = false;
  if (musicLoopTimer !== null) {
    clearInterval(musicLoopTimer);
    musicLoopTimer = null;
  }
}

export function setMuted(next: boolean): void {
  muted = next;
  if (master) master.gain.value = muted ? 0 : 1;
  if (muted) window.speechSynthesis?.cancel();
}

export function isMuted(): boolean {
  return muted;
}

/* -------- Voice prompts via Web Speech API -------- */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  if (cachedVoice) return cachedVoice;
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return null;
  const preferences: Array<(v: SpeechSynthesisVoice) => boolean> = [
    (v) => v.lang === 'zh-TW' && /female|woman|mei|chen|meijia/i.test(v.name),
    (v) => v.lang === 'zh-TW',
    (v) => v.lang === 'zh-CN' && /female|woman|xiao|ting/i.test(v.name),
    (v) => v.lang === 'zh-HK',
    (v) => v.lang.startsWith('zh'),
  ];
  for (const pick of preferences) {
    const v = all.find(pick);
    if (v) {
      cachedVoice = v;
      return v;
    }
  }
  return null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  // Voices load lazily in Chrome
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = null;
    voicesReady = true;
  });
  // Initial check in case voices are already available
  if (window.speechSynthesis.getVoices().length > 0) voicesReady = true;
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }): void {
  if (muted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // avoid queue buildup on rapid events
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.rate = opts?.rate ?? 0.95;
  u.pitch = opts?.pitch ?? 1.2;
  const v = pickChineseVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

/** Speak one random line from a list. Useful for filler reactions. */
export function speakRandom(lines: string[]): void {
  speak(lines[Math.floor(Math.random() * lines.length)]);
}

/** Defer a speak call briefly — useful when voices haven't loaded yet on page open. */
export function speakLater(text: string, delay = 300): void {
  setTimeout(() => speak(text), voicesReady ? 0 : delay);
}
