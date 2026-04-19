/**
 * Scene: Magic Wand Coloring — pencil-drag edition
 *
 * Pencils are draggable. Grab a pencil, drag it over the castle, release, and
 * the region under the tip gets flood-filled. The pencil ghost follows the
 * pointer at ~75% opacity so the kid can see through it.
 *
 * Completion: the "done" button appears once the kid has used at least 3
 * different pencil colors on this page — no need to fill every last pixel.
 */

import { speakPraise, speakCheer, speakNamed } from '../audio';
import { PAGES, markDone } from '../progress';
import { getSelectedPage } from '../state';
import { saveArtwork, exportCanvasToDataUrl, saveOrShare } from '../artwork';

const COLORS = ['#7dd3fc', '#c4b5fd', '#fbcfe8', '#fde68a', '#86efac', '#fca5a5', '#a78bfa', '#f97316'];
const MIN_UNIQUE_COLORS = 3;

export function renderColoring(
  onDone: () => void,
  _onBack: () => void,
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
  hint.textContent = '拿起色筆，拖到畫上放開上色 ✏️✨';

  const stage = document.createElement('div');
  stage.className = 'color-stage';

  const backBtn = document.createElement('button');
  backBtn.className = 'next-page-btn';
  backBtn.textContent = '⬅️ 返回總覽';
  backBtn.addEventListener('click', () => _onBack());

  let currentPageId: string | null = null;
  const usedColors = new Set<string>();

  const rack = document.createElement('div');
  rack.className = 'pencil-rack';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'big-button done-btn';
  doneBtn.textContent = '完成了！✨';
  doneBtn.style.display = 'none';

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

  // Fill handler — called from pencil release
  const applyFill = (color: string, clientX: number, clientY: number): void => {
    const canvas = stage.querySelector<HTMLCanvasElement>('.castle-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    const cx = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const cy = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d')!;
    const filled = floodFill(ctx, canvas.width, canvas.height, cx, cy, hexToRgb(color));
    if (filled > 200) {
      sparkleAt(stage, clientX - stage.getBoundingClientRect().left, clientY - stage.getBoundingClientRect().top);
      playDing();
      usedColors.add(color);
      if (usedColors.size >= MIN_UNIQUE_COLORS && doneBtn.style.display === 'none') {
        doneBtn.style.display = '';
        speakNamed('{name}用了好多顏色！可以按完成了喔！');
      } else if (!speakPraise()) {
        speakCheer();
      }
    }
  };

  // Build the pencil rack
  for (const c of COLORS) {
    rack.appendChild(makePencil(c, applyFill));
  }

  function loadPage(pageId: string): void {
    currentPageId = pageId;
    doneBtn.style.display = 'none';
    usedColors.clear();
    const meta = PAGES.find((p) => p.id === pageId);
    const src = meta ? meta.src : PAGES[0].src;
    const img = new Image();
    img.onload = () => setupCanvas(stage, img);
    img.onerror = () => setupFallback(stage);
    img.src = src;
  }

  scene.append(bg, hint, stage, backBtn, rack, doneBtn, donePanel);

  scene.addEventListener('scene:enter', () => {
    speakNamed('{name}挑一枝色筆，拖到畫上放開就會上色喔！');
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
    speakPraise();
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

/* ---------------- Pencil (draggable) ---------------- */

// Tip position inside the 60x200 viewBox. Ghost is sized to match.
const PENCIL_W = 60;
const PENCIL_H = 200;
const TIP_X = 30;
const TIP_Y = 195;

function pencilSvg(): string {
  return `
    <svg viewBox="0 0 ${PENCIL_W} ${PENCIL_H}" class="pencil-svg" preserveAspectRatio="xMidYMid meet">
      <!-- eraser top -->
      <rect x="12" y="5" width="36" height="26" fill="#f472b6" stroke="#1e1b4b" stroke-width="3" rx="8"/>
      <!-- metal band -->
      <rect x="9" y="28" width="42" height="12" fill="#d1d5db" stroke="#1e1b4b" stroke-width="3"/>
      <!-- body -->
      <rect x="10" y="38" width="40" height="102" fill="var(--c)" stroke="#1e1b4b" stroke-width="3" rx="2"/>
      <!-- wood cone -->
      <polygon points="10,140 50,140 30,170" fill="#fde68a" stroke="#1e1b4b" stroke-width="3" stroke-linejoin="round"/>
      <!-- tip -->
      <polygon points="20,162 40,162 30,195" fill="var(--c)" stroke="#1e1b4b" stroke-width="3" stroke-linejoin="round"/>
    </svg>
  `;
}

function makePencil(color: string, onFill: (color: string, x: number, y: number) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'pencil';
  btn.type = 'button';
  btn.draggable = false;
  btn.style.setProperty('--c', color);
  btn.dataset.color = color;
  btn.innerHTML = pencilSvg();

  // Block native HTML5 drag which otherwise steals pointer events on desktop
  btn.addEventListener('dragstart', (e) => e.preventDefault());

  let ghost: HTMLElement | null = null;
  let activeId: number | null = null;
  // Keep references so we can remove precisely the same handlers on cleanup.
  let onMove: ((e: PointerEvent) => void) | null = null;
  let onEnd: ((e: PointerEvent) => void) | null = null;

  const updateGhost = (x: number, y: number) => {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - TIP_X}px, ${y - TIP_Y}px) rotate(-8deg)`;
  };

  const cleanup = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    btn.classList.remove('is-held');
    if (onMove) document.removeEventListener('pointermove', onMove);
    if (onEnd) {
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    }
    onMove = null;
    onEnd = null;
    activeId = null;
  };

  btn.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    e.preventDefault();
    activeId = e.pointerId;
    btn.classList.add('is-held');

    // Create ghost as a direct child of <body> so nothing can clip/hide it.
    ghost = document.createElement('div');
    ghost.className = 'pencil-ghost';
    ghost.style.setProperty('--c', color);
    ghost.innerHTML = pencilSvg();
    document.body.appendChild(ghost);
    updateGhost(e.clientX, e.clientY);

    onMove = (ev) => {
      if (ev.pointerId !== activeId) return;
      updateGhost(ev.clientX, ev.clientY);
    };

    onEnd = (ev) => {
      if (ev.pointerId !== activeId) return;
      const x = ev.clientX;
      const y = ev.clientY;
      // Clean up first so if onFill throws we still reset state
      cleanup();
      if (ev.type !== 'pointercancel') onFill(color, x, y);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  });

  return btn;
}

/* ---------------- Canvas flood-fill ---------------- */

function setupCanvas(stage: HTMLElement, lineart: HTMLImageElement): void {
  stage.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'castle-canvas';
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  canvas.width = lineart.naturalWidth;
  canvas.height = lineart.naturalHeight;

  ctx.drawImage(lineart, 0, 0);
  binarize(ctx, canvas.width, canvas.height);

  stage.appendChild(canvas);
}

function setupFallback(stage: HTMLElement): void {
  stage.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'coloring-fallback';
  msg.textContent = '圖片讀不到 😢 請回總覽再試一次。';
  stage.appendChild(msg);
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
  const a = getAudio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  const f = 660 + Math.random() * 400;
  o.frequency.setValueAtTime(f, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(f * 1.5, a.currentTime + 0.15);
  g.gain.setValueAtTime(0.2, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.3);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.3);
}
