/**
 * Audio: procedural background music via Web Audio + voice prompts via SpeechSynthesis.
 *
 * The voice bank calls the player by name (小仙貝 / 仙貝 / 貝貝 / 嘉臻) and
 * mixes in positive parenting reinforcement — praising the kid's drawing while
 * gently prompting good habits (brushing teeth, sharing toys, etc.).
 *
 * Zero audio files. Mute toggle silences music + voice.
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
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, startTime: number, duration: number, type: OscillatorType, peak: number): void {
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

  const melody = [
    523.25, 659.25, 783.99, 987.77,
    1046.5, 987.77, 783.99, 659.25,
    523.25, 659.25, 880.00, 783.99,
    659.25, 523.25, 659.25, 783.99,
  ];
  const bass = [130.81, 164.81, 196.00, 174.61];

  const BEAT = 0.45;
  const CHUNK = 16;
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

/* ---------------- Voice ---------------- */

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
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = null;
    voicesReady = true;
  });
  if (window.speechSynthesis.getVoices().length > 0) voicesReady = true;
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }): void {
  if (muted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.rate = opts?.rate ?? 0.95;
  u.pitch = opts?.pitch ?? 1.2;
  const v = pickChineseVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function speakLater(text: string, delay = 300): void {
  setTimeout(() => speak(text), voicesReady ? 0 : delay);
}

/* ---------------- Personalized praise bank ---------------- */

const NAMES = ['小仙貝', '仙貝', '貝貝', '嘉臻'];

export function pickName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/**
 * Positive-reinforcement lines. Each links great drawing to a good-habit behavior
 * (eating by oneself, brushing teeth, putting toys away, etc.).
 * {name} gets replaced with a random nickname.
 */
const PRAISE_LINES: string[] = [
  '{name}畫得好漂亮！一定也會自己吃飯飯對不對？好棒！',
  '{name}好厲害喔，會自己刷牙嗎？超棒的！',
  '哇！{name}塗得這麼美，一定會自己收玩具！',
  '{name}真的好棒，一定很會照顧弟弟！',
  '{name}畫得好棒，也會跟弟弟分享玩具，對不對？',
  '{name}好美喔，洗手有沒有洗得乾乾淨淨？',
  '{name}好聰明！學英文一定也超快！',
  '{name}這麼厲害，爸爸媽媽一定超驕傲！',
  '{name}真的好棒！會自己穿衣服了嗎？',
  '哇！{name}這麼會塗色，自己吃飯也沒問題！',
  '{name}好乖，記得洗手手才能吃東西喔！',
  '{name}塗得超美！今天也要記得收玩具喔。',
  '哇！{name}是小天才耶！',
  '{name}好厲害，也要教弟弟一起畫畫喔！',
  '{name}畫得真棒！自己刷牙才有亮晶晶的牙齒！',
  '{name}超棒的！再來一個顏色看看！',
  '{name}塗得好有創意！要分享給弟弟看喔！',
  '{name}真勇敢！要不要試試不一樣的顏色？',
  '哇！{name}是最厲害的小畫家！',
  '{name}好美的畫！爸爸媽媽一定會拍照給阿公阿嬤看！',
];

const SMALL_CHEERS: string[] = [
  '好漂亮！',
  '哇喔！',
  '真美！',
  '好棒！',
  '厲害！',
  '超棒的！',
  '再一個！',
];

let lastPraiseAt = 0;
const PRAISE_GAP_MS = 3500;   // big praise line every ~3.5s
let lastCheerAt = 0;
const CHEER_GAP_MS = 1200;    // tiny cheers more often

function render(template: string): string {
  return template.replaceAll('{name}', pickName());
}

/**
 * Big praise with name + behavior reinforcement. Throttled so it doesn't overrun.
 * Returns true if a line was actually spoken.
 */
export function speakPraise(): boolean {
  const now = Date.now();
  if (now - lastPraiseAt < PRAISE_GAP_MS) return false;
  lastPraiseAt = now;
  const tpl = PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)];
  speak(render(tpl));
  return true;
}

/** Short cheer (no name), for rapid feedback. Lightly throttled. */
export function speakCheer(): void {
  const now = Date.now();
  if (now - lastCheerAt < CHEER_GAP_MS) return;
  lastCheerAt = now;
  const line = SMALL_CHEERS[Math.floor(Math.random() * SMALL_CHEERS.length)];
  speak(line);
}

/** Speak a named line directly: `speakNamed('${name}快來看！')` */
export function speakNamed(template: string): void {
  speak(render(template));
}
