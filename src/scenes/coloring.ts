/**
 * Scene 2: Magic Wand Coloring
 *
 * Primary: load Grok-generated castle line art (./assets/castle-lineart.png) onto a canvas
 * and use scanline flood fill to paint each enclosed region on tap.
 *
 * Fallback: if the image is missing (Grok not run yet), render a hand-crafted SVG castle
 * with clickable regions so the game is still playable out of the box.
 */

const COLORS = ['#7dd3fc', '#c4b5fd', '#fbcfe8', '#ffffff', '#fde68a', '#86efac'];
const LINEART_SRC = './assets/castle-lineart.png';
const MIN_FILLS_TO_FINISH = 4; // toddler friendly — a few fills is enough

export function renderColoring(onDone: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-coloring';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-home.png';
  bg.onerror = () => { bg.style.display = 'none'; };

  const hint = document.createElement('div');
  hint.className = 'scene-hint';
  hint.textContent = '選顏色 → 點城堡 🎨✨';

  const stage = document.createElement('div');
  stage.className = 'color-stage';

  const palette = document.createElement('div');
  palette.className = 'palette';

  const wand = document.createElement('div');
  wand.className = 'wand';
  wand.innerHTML = '<span class="star">✨</span>';

  const doneBtn = document.createElement('button');
  doneBtn.className = 'big-button done-btn';
  doneBtn.textContent = '完成了！✨';
  doneBtn.style.display = 'none';
  doneBtn.addEventListener('click', onDone);

  // State shared between fill logic and UI
  const state = { selected: COLORS[0], fillCount: 0, reset: () => {} };

  // Build palette (shared)
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

  // Try to load the Grok line art. If OK, use canvas; if not, fall back to SVG.
  const probe = new Image();
  probe.onload = () => {
    setupCanvas(stage, probe, state, doneBtn);
  };
  probe.onerror = () => {
    setupSvg(stage, state, doneBtn);
  };
  probe.src = LINEART_SRC;

  scene.append(bg, hint, stage, palette, wand, doneBtn);

  scene.addEventListener('scene:enter', () => {
    state.fillCount = 0;
    state.reset();
    doneBtn.style.display = 'none';
  });

  return scene;
}

/* ---------------- Canvas flood-fill path (primary) ---------------- */

function setupCanvas(
  stage: HTMLElement,
  lineart: HTMLImageElement,
  state: { selected: string; fillCount: number; reset: () => void },
  doneBtn: HTMLButtonElement,
): void {
  stage.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'castle-canvas';
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Native pixel size = source image. CSS scales it to fit stage.
  canvas.width = lineart.naturalWidth;
  canvas.height = lineart.naturalHeight;

  // Paint base: binarize line art so edges are crisp and "fillable" vs "line" is clear.
  ctx.drawImage(lineart, 0, 0);
  binarize(ctx, canvas.width, canvas.height);

  state.reset = () => {
    ctx.drawImage(lineart, 0, 0);
    binarize(ctx, canvas.width, canvas.height);
  };

  canvas.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * canvas.height);
    const filled = floodFill(ctx, canvas.width, canvas.height, x, y, hexToRgb(state.selected));
    if (filled > 200) {
      state.fillCount++;
      sparkleAt(stage, ev.clientX - stage.getBoundingClientRect().left, ev.clientY - stage.getBoundingClientRect().top);
      playDing();
      if (state.fillCount >= MIN_FILLS_TO_FINISH) {
        doneBtn.style.display = '';
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
      // line → pure black
      d[i] = d[i + 1] = d[i + 2] = 0;
    } else {
      // fill region → pure white
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
    // Skip our own color
    if (r === fr && g === fg && b === fb) return false;
    // Only fill light pixels (white / pastel existing fill). Black lines block.
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
  state: { selected: string; fillCount: number; reset: () => void },
  doneBtn: HTMLButtonElement,
): void {
  stage.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 500');
  svg.setAttribute('class', 'castle-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const ground = document.createElementNS(svgNS, 'rect');
  ground.setAttribute('x', '0');
  ground.setAttribute('y', '460');
  ground.setAttribute('width', '800');
  ground.setAttribute('height', '40');
  ground.setAttribute('fill', '#e0f2fe');
  ground.setAttribute('opacity', '0.5');
  svg.appendChild(ground);

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
      if (filled.size >= 5) doneBtn.style.display = '';
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
