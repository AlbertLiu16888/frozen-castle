/**
 * Scene 1: Castle Assembly
 * Drag 5 castle pieces onto target slots on the castle outline.
 * Pieces snap when close enough; each snap plays sparkle + sound.
 * When all 5 snapped, the "done" button appears.
 */

import { speak, speakRandom } from '../audio';

interface Piece {
  id: string;
  label: string;
  src: string;
  target: { x: number; y: number; w: number; h: number }; // % of stage
  start: { x: number; y: number };
  snapped: boolean;
}

const PIECES: Omit<Piece, 'snapped'>[] = [
  { id: 'body',     label: '城堡主體', src: './assets/piece-body.png',    target: { x: 35, y: 45, w: 30, h: 35 }, start: { x: 10, y: 70 } },
  { id: 'gate',     label: '城門',     src: './assets/piece-gate.png',    target: { x: 44, y: 62, w: 12, h: 20 }, start: { x: 75, y: 75 } },
  { id: 'tower-l',  label: '左塔樓',   src: './assets/piece-tower-l.png', target: { x: 20, y: 30, w: 18, h: 45 }, start: { x: 5,  y: 20 } },
  { id: 'tower-r',  label: '右塔樓',   src: './assets/piece-tower-r.png', target: { x: 62, y: 30, w: 18, h: 45 }, start: { x: 82, y: 20 } },
  { id: 'spire',    label: '尖頂',     src: './assets/piece-spire.png',   target: { x: 40, y: 15, w: 20, h: 20 }, start: { x: 45, y: 80 } },
];

export function renderAssembly(onDone: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-assembly';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-ground.png';
  bg.onerror = () => { bg.style.display = 'none'; };

  const stage = document.createElement('div');
  stage.className = 'stage';

  // Target silhouette outlines (so kids see where to put pieces)
  const outlines = document.createElement('div');
  outlines.className = 'outlines';

  const pieces: Piece[] = PIECES.map((p) => ({ ...p, snapped: false }));

  for (const p of pieces) {
    const slot = document.createElement('div');
    slot.className = 'target-slot';
    slot.dataset.pieceId = p.id;
    slot.style.left = p.target.x + '%';
    slot.style.top = p.target.y + '%';
    slot.style.width = p.target.w + '%';
    slot.style.height = p.target.h + '%';
    outlines.appendChild(slot);
  }

  const doneBtn = document.createElement('button');
  doneBtn.className = 'big-button done-btn';
  doneBtn.textContent = '太棒了！下一步 ✨';
  doneBtn.style.display = 'none';
  doneBtn.addEventListener('click', onDone);

  const title = document.createElement('div');
  title.className = 'scene-hint';
  title.textContent = '把積木拖到亮亮的地方 🏰';

  stage.append(outlines);
  pieces.forEach((p) => stage.appendChild(makeDraggable(p, pieces, stage, doneBtn)));

  scene.append(bg, title, stage, doneBtn);

  // Reset when re-entering
  scene.addEventListener('scene:enter', () => {
    speak('把積木拖到亮亮的地方，把城堡蓋好！');
    pieces.forEach((p) => (p.snapped = false));
    doneBtn.style.display = 'none';
    stage.querySelectorAll('.target-slot').forEach((s) => s.classList.remove('filled'));
    stage.querySelectorAll('.piece').forEach((el, i) => {
      const pc = pieces[i];
      (el as HTMLElement).style.left = pc.start.x + '%';
      (el as HTMLElement).style.top = pc.start.y + '%';
      (el as HTMLElement).classList.remove('snapped');
    });
  });

  return scene;
}

function makeDraggable(p: Piece, all: Piece[], stage: HTMLElement, doneBtn: HTMLButtonElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.pieceId = p.id;
  el.style.left = p.start.x + '%';
  el.style.top = p.start.y + '%';
  el.style.width = p.target.w + '%';
  el.style.height = p.target.h + '%';

  const img = document.createElement('img');
  img.src = p.src;
  img.alt = p.label;
  img.draggable = false;
  img.onerror = () => {
    // Placeholder: colored rounded block with label
    img.style.display = 'none';
    el.classList.add('no-img');
    el.textContent = p.label;
  };
  el.appendChild(img);

  let dragging = false;
  let startX = 0, startY = 0;
  let origLeft = 0, origTop = 0;

  const onDown = (e: PointerEvent) => {
    if (p.snapped) return;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const rect = stage.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origLeft = (parseFloat(el.style.left) / 100) * rect.width;
    origTop = (parseFloat(el.style.top) / 100) * rect.height;
    e.preventDefault();
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeftPx = origLeft + dx;
    const newTopPx = origTop + dy;
    el.style.left = (newLeftPx / rect.width) * 100 + '%';
    el.style.top = (newTopPx / rect.height) * 100 + '%';
  };

  const onUp = (_e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');

    // Snap check: center of piece within SNAP% of target center
    const curLeft = parseFloat(el.style.left);
    const curTop = parseFloat(el.style.top);
    const dx = curLeft - p.target.x;
    const dy = curTop - p.target.y;
    const dist = Math.hypot(dx, dy);
    const SNAP = 10; // 10% threshold (generous for little fingers)

    if (dist < SNAP) {
      el.style.left = p.target.x + '%';
      el.style.top = p.target.y + '%';
      el.classList.add('snapped');
      p.snapped = true;
      sparkle(stage, p.target.x + p.target.w / 2, p.target.y + p.target.h / 2);
      playDing();
      const slot = stage.querySelector<HTMLElement>(`.target-slot[data-piece-id="${p.id}"]`);
      if (slot) slot.classList.add('filled');

      if (all.every((x) => x.snapped)) {
        doneBtn.style.display = '';
        playFanfare();
        speak('太棒了！城堡蓋好了！');
      } else {
        speakRandom(['好棒！', '對了！', '很厲害！', '再一個！']);
      }
    }
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  return el;
}

function sparkle(stage: HTMLElement, xPct: number, yPct: number): void {
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = ['✨', '❄', '⭐'][i % 3];
    s.style.left = xPct + '%';
    s.style.top = yPct + '%';
    const angle = (Math.PI * 2 * i) / 14;
    const dist = 40 + Math.random() * 60;
    s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    stage.appendChild(s);
    setTimeout(() => s.remove(), 900);
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
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.2);
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.4);
}

function playFanfare(): void {
  const ctx = getAudio();
  if (!ctx) return;
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.15;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.4);
  });
}
