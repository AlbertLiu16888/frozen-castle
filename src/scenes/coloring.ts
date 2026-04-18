/**
 * Scene 2: Magic Wand Coloring — storybook mode
 *
 * On each entry, picks a random Grok-generated coloring page from ./assets/coloring-*.png.
 * The page is loaded to a canvas, binarized, and scanline flood-fill handles each tap.
 *
 * Completion rule: ALL white space must be colored. We track the remaining "unpainted"
 * pixel count; once it drops below 2% of the initial white area, the done button appears.
 *
 * Fallback: if no coloring pages are available (Grok not run yet), render the
 * hand-crafted SVG castle with clickable regions.
 */

import { speak, speakRandom } from '../audio';
import { PAGES, markDone } from '../progress';
import { getSelectedPage } from '../state';
import { saveArtwork, exportCanvasToDataUrl, saveOrShare } from '../artwork';

const COLORS = ['#7dd3fc', '#c4b5fd', '#fbcfe8', '#ffffff', '#fde68a', '#86efac', '#fca5a5', '#a5f3fc'];

// A region is "colored enough" when less than this fraction of the initial white area remains.
// 5% tolerance covers anti-aliased edge pixels and small unfillable slivers from line crossings.
const DONE_THRESHOLD = 0.05;

export function renderColoring(
  onDone: () => void,
  onBack: () => void,
  onPhoto: () => void,
): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-coloring';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-home.png';
  bg.onerror = () => { bg.style.display = 'none'; };

  const hint = document.createElement('div');
  hint.className = 'scene-hint';
  hint.textContent = '把整張圖都塗滿顏色 🎨✨';

  const stage = document.createElement('div');
  stage.className = 'color-stage';

  // Back to gallery button (top right of stage)
  const backBtn = document.createElement('button');
  backBtn.className = 'next-page-btn';
  backBtn.textContent = '⬅️ 返回總覽';
  backBtn.addEventListener('click', () => {
    onBack();
  });

  let currentPageId: string | null = null;

  const palette = document.createElement('div');
  palette.className = 'palette';

  const wand = document.createElement('div');
  wand.className = 'wand';
  wand.innerHTML = '<span class="star">✨</span>';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'big-button done-btn';
  doneBtn.textContent = '完成了！✨';
  doneBtn.style.display = 'none';

  // "Done" modal panel with save / photo / continue options
  const donePanel = document.createElement('div');
  donePanel.className = 'done-panel';
  donePanel.style.display = 'none';
  donePanel.innerHTML = `
    <div class="done-card">
      <h2>太棒了！🎉</h2>
      <img class="done-preview" alt="我的畫作" />
      <div class="done-actions">
        <button class="done-action save-btn">💾 儲存</button>
        <button class="done-action photo-btn">📷 拍照</button>
        <button class="done-action continue-btn">➡️ 下一張</button>
      </div>
    </div>
  `;
  const donePreview = donePanel.querySelector<HTMLImageElement>('.done-preview')!;
  const saveBtn = donePanel.querySelector<HTMLButtonElement>('.save-btn')!;
  const photoBtn = donePanel.querySelector<HTMLButtonElement>('.photo-btn')!;
  const continueBtn = donePanel.querySelector<HTMLButtonElement>('.continue-btn')!;

  let lastArtworkDataUrl = '';

  const state = {
    selected: COLORS[0],
    initialWhite: 0,
    reset: () => {},
  };

  for (const c of COLORS) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.dataset.color = c;
    if (c === state.selected) sw.classList.add('active');
    sw.addEventListener('click', () => {
      state.selected = c;
      palette.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      wand.style.color = c;
    });
    palette.appendChild(sw);
  }

  function loadPage(pageId: string): void {
    currentPageId = pageId;
    doneBtn.style.display = 'none';
    const meta = PAGES.find((p) => p.id === pageId);
    const src = meta ? meta.src : PAGES[0].src;
    const img = new Image();
    img.onload = () => setupCanvas(stage, img, state, doneBtn, backBtn);
    img.onerror = () => setupSvg(stage, state, doneBtn);
    img.src = src;
  }

  scene.append(bg, hint, stage, backBtn, palette, wand, doneBtn, donePanel);

  scene.addEventListener('scene:enter', () => {
    speak('把整張圖都塗滿顏色，就算完成囉！');
    donePanel.style.display = 'none';
    const pageId = getSelectedPage() ?? PAGES[0].id;
    loadPage(pageId);
  });

  const captureArtwork = (): string => {
    const canvas = stage.querySelector<HTMLCanvasElement>('.castle-canvas');
    if (!canvas) return '';
    return exportCanvasToDataUrl(canvas);
  };

  doneBtn.addEventListener('click', () => {
    if (!currentPageId) return;
    const dataUrl = captureArtwork();
    if (dataUrl) {
      lastArtworkDataUrl = dataUrl;
      saveArtwork(currentPageId, dataUrl);
      donePreview.src = dataUrl;
    }
    markDone(currentPageId);
    doneBtn.style.display = 'none';
    donePanel.style.display = '';
  });

  saveBtn.addEventListener('click', async () => {
    if (!lastArtworkDataUrl || !currentPageId) return;
    const stamp = new Date().toISOString().slice(0, 10);
    await saveOrShare(lastArtworkDataUrl, `冰雪繪本-${currentPageId}-${stamp}.jpg`);
  });

  photoBtn.addEventListener('click', () => {
    donePanel.style.display = 'none';
    onPhoto();
  });

  continueBtn.addEventListener('click', () => {
    donePanel.style.display = 'none';
    onDone();
  });

  return scene;
}

/* ---------------- Canvas flood-fill path (primary) ---------------- */

function setupCanvas(
  stage: HTMLElement,
  lineart: HTMLImageElement,
  state: { selected: string; initialWhite: number; reset: () => void },
  doneBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
): void {
  stage.innerHTML = '';
  stage.appendChild(nextBtn);

  const canvas = document.createElement('canvas');
  canvas.className = 'castle-canvas';
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  canvas.width = lineart.naturalWidth;
  canvas.height = lineart.naturalHeight;

  const paintBase = () => {
    ctx.drawImage(lineart, 0, 0);
    binarize(ctx, canvas.width, canvas.height);
    state.initialWhite = countWhitePixels(ctx, canvas.width, canvas.height);
  };
  paintBase();
  state.reset = paintBase;

  canvas.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * canvas.height);
    const filled = floodFill(ctx, canvas.width, canvas.height, x, y, hexToRgb(state.selected));
    if (filled > 200) {
      sparkleAt(stage, ev.clientX - stage.getBoundingClientRect().left, ev.clientY - stage.getBoundingClientRect().top);
      playDing();
      const remaining = countWhitePixels(ctx, canvas.width, canvas.height);
      if (remaining < state.initialWhite * DONE_THRESHOLD) {
        doneBtn.style.display = '';
        speak('哇！你把整張都塗滿了，好厲害！');
      } else {
        const percent = 1 - remaining / state.initialWhite;
        if (percent > 0.6 && percent < 0.62) speak('快塗完囉，加油！');
        else speakRandom(['好漂亮！', '哇喔！', '真美！', '好棒！']);
      }
    }
  });

  stage.appendChild(canvas);
}

function binarize(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (avg < 128) {
      d[i] = d[i + 1] = d[i + 2] = 0;
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function countWhitePixels(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) count++;
  }
  return count;
}

function floodFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sx: number,
  sy: number,
  [fr, fg, fb]: [number, number, number],
): number {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return 0;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const idx = (x: number, y: number) => (y * w + x) * 4;
  const fillable = (x: number, y: number): boolean => {
    const i = idx(x, y);
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r === fr && g === fg && b === fb) return false;
    return (r + g + b) / 3 > 160;
  };
  const paint = (x: number, y: number) => {
    const i = idx(x, y);
    d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
  };

  if (!fillable(sx, sy)) return 0;

  let count = 0;
  const stack: Array<[number, number]> = [[sx, sy]];
  while (stack.length) {
    const [x0, y] = stack.pop()!;
    let lx = x0;
    while (lx >= 0 && fillable(lx, y)) lx--;
    lx++;
    let above = false, below = false;
    while (lx < w && fillable(lx, y)) {
      paint(lx, y);
      count++;
      if (y > 0) {
        if (!above && fillable(lx, y - 1)) { stack.push([lx, y - 1]); above = true; }
        else if (above && !fillable(lx, y - 1)) above = false;
      }
      if (y < h - 1) {
        if (!below && fillable(lx, y + 1)) { stack.push([lx, y + 1]); below = true; }
        else if (below && !fillable(lx, y + 1)) below = false;
      }
      lx++;
    }
  }
  ctx.putImageData(img, 0, 0);
  return count;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/* ---------------- SVG fallback (when Grok hasn't been run) ---------------- */

const REGIONS: { id: string; path: string }[] = [
  { id: 'tower-l',  path: 'M120,240 L120,460 L220,460 L220,240 L170,200 Z' },
  { id: 'tower-r',  path: 'M580,240 L580,460 L680,460 L680,240 L630,200 Z' },
  { id: 'body',     path: 'M220,280 L220,460 L580,460 L580,280 L400,200 Z' },
  { id: 'gate',     path: 'M360,380 Q360,340 400,340 Q440,340 440,380 L440,460 L360,460 Z' },
  { id: 'spire-l',  path: 'M120,240 L170,140 L220,240 Z' },
  { id: 'spire-m',  path: 'M220,280 L400,120 L580,280 Z' },
  { id: 'spire-r',  path: 'M580,240 L630,140 L680,240 Z' },
  { id: 'window',   path: 'M370,280 Q370,250 400,250 Q430,250 430,280 L430,320 L370,320 Z' },
];

function setupSvg(
  stage: HTMLElement,
  state: { selected: string; reset: () => void },
  doneBtn: HTMLButtonElement,
): void {
  stage.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 500');
  svg.setAttribute('class', 'castle-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const els: SVGPathElement[] = [];
  const filled = new Set<string>();

  for (const r of REGIONS) {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', r.path);
    p.setAttribute('fill', '#f8fafc');
    p.setAttribute('stroke', '#1e1b4b');
    p.setAttribute('stroke-width', '4');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('class', 'region');
    p.addEventListener('click', (ev) => {
      p.setAttribute('fill', state.selected);
      filled.add(r.id);
      sparkleAt(stage, (ev as MouseEvent).clientX - stage.getBoundingClientRect().left, (ev as MouseEvent).clientY - stage.getBoundingClientRect().top);
      playDing();
      if (filled.size >= REGIONS.length) {
        doneBtn.style.display = '';
        speak('你塗得好漂亮！');
      } else {
        speakRandom(['好漂亮！', '哇喔！', '真美！', '好棒！']);
      }
    });
    svg.appendChild(p);
    els.push(p);
  }

  state.reset = () => {
    filled.clear();
    els.forEach((e) => e.setAttribute('fill', '#f8fafc'));
  };

  stage.appendChild(svg);
}

/* ---------------- shared effects ---------------- */

function sparkleAt(stage: HTMLElement, x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = '✨';
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    const angle = (Math.PI * 2 * i) / 10;
    const dist = 30 + Math.random() * 40;
    s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    stage.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try { audioCtx = new AudioContext(); return audioCtx; } catch { return null; }
}

function playDing(): void {
  const ctx = getAudio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const f = 660 + Math.random() * 400;
  o.frequency.setValueAtTime(f, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(f * 1.5, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.3);
}
