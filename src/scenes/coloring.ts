/**
 * Scene 2: Magic Wand Coloring
 * Castle outline as SVG with fillable regions. Tap a color swatch, then tap a region.
 * When N regions are filled, "done" button appears.
 */

const COLORS = ['#7dd3fc', '#c4b5fd', '#fbcfe8', '#ffffff', '#fde68a', '#86efac'];

const REGIONS: { id: string; path: string; label: string }[] = [
  { id: 'tower-l',  label: '左塔樓',   path: 'M120,240 L120,460 L220,460 L220,240 L170,200 Z' },
  { id: 'tower-r',  label: '右塔樓',   path: 'M580,240 L580,460 L680,460 L680,240 L630,200 Z' },
  { id: 'body',     label: '城堡主體', path: 'M220,280 L220,460 L580,460 L580,280 L400,200 Z' },
  { id: 'gate',     label: '城門',     path: 'M360,380 Q360,340 400,340 Q440,340 440,380 L440,460 L360,460 Z' },
  { id: 'spire-l',  label: '左尖頂',   path: 'M120,240 L170,140 L220,240 Z' },
  { id: 'spire-m',  label: '中尖頂',   path: 'M220,280 L400,120 L580,280 Z' },
  { id: 'spire-r',  label: '右尖頂',   path: 'M580,240 L630,140 L680,240 Z' },
  { id: 'window',   label: '窗戶',     path: 'M370,280 Q370,250 400,250 Q430,250 430,280 L430,320 L370,320 Z' },
];

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

  // Build SVG castle
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 500');
  svg.setAttribute('class', 'castle-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Ground
  const ground = document.createElementNS(svgNS, 'rect');
  ground.setAttribute('x', '0');
  ground.setAttribute('y', '460');
  ground.setAttribute('width', '800');
  ground.setAttribute('height', '40');
  ground.setAttribute('fill', '#e0f2fe');
  ground.setAttribute('opacity', '0.5');
  svg.appendChild(ground);

  const filled: Record<string, string> = {};
  const regionEls: SVGPathElement[] = [];

  for (const r of REGIONS) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', r.path);
    path.setAttribute('fill', '#f8fafc');
    path.setAttribute('stroke', '#1e1b4b');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('class', 'region');
    path.dataset.regionId = r.id;
    path.addEventListener('click', () => applyColor(r.id, path));
    svg.appendChild(path);
    regionEls.push(path);
  }

  stage.appendChild(svg);

  // Palette
  const palette = document.createElement('div');
  palette.className = 'palette';

  let selected: string = COLORS[0];
  const wand = document.createElement('div');
  wand.className = 'wand';
  wand.innerHTML = '<span class="star">✨</span>';

  for (const c of COLORS) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.dataset.color = c;
    if (c === selected) sw.classList.add('active');
    sw.addEventListener('click', () => {
      selected = c;
      palette.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      wand.style.color = c;
    });
    palette.appendChild(sw);
  }

  const doneBtn = document.createElement('button');
  doneBtn.className = 'big-button done-btn';
  doneBtn.textContent = '完成了！✨';
  doneBtn.style.display = 'none';
  doneBtn.addEventListener('click', onDone);

  function applyColor(id: string, el: SVGPathElement): void {
    el.setAttribute('fill', selected);
    filled[id] = selected;
    sparkleAt(stage, el);
    playDing();
    // Require at least 5 regions colored before unlocking done
    if (Object.keys(filled).length >= 5) {
      doneBtn.style.display = '';
    }
  }

  scene.append(bg, hint, stage, palette, wand, doneBtn);

  scene.addEventListener('scene:enter', () => {
    for (const k of Object.keys(filled)) delete filled[k];
    regionEls.forEach((el) => el.setAttribute('fill', '#f8fafc'));
    doneBtn.style.display = 'none';
  });

  return scene;
}

function sparkleAt(stage: HTMLElement, el: SVGPathElement): void {
  const bbox = el.getBBox();
  const stageRect = stage.getBoundingClientRect();
  const svgRect = (el.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
  const cx = svgRect.left - stageRect.left + ((bbox.x + bbox.width / 2) / 800) * svgRect.width;
  const cy = svgRect.top - stageRect.top + ((bbox.y + bbox.height / 2) / 500) * svgRect.height;

  for (let i = 0; i < 10; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = '✨';
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
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
