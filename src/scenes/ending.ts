/**
 * Ending scene: princess appears, fireworks, replay button.
 */

export function renderEnding(onReplay: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-ending';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-home.png';
  bg.onerror = () => { bg.style.display = 'none'; };

  const princess = document.createElement('img');
  princess.className = 'princess';
  princess.src = './assets/princess.png';
  princess.onerror = () => {
    princess.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.className = 'princess-fallback';
    fallback.textContent = '👸';
    scene.insertBefore(fallback, content);
  };

  const fireworks = document.createElement('div');
  fireworks.className = 'fireworks';

  const content = document.createElement('div');
  content.className = 'scene-content';
  content.innerHTML = `
    <h1 class="title">你好棒！🎉</h1>
    <p class="subtitle">城堡蓋好了，公主很開心！</p>
  `;
  const replayBtn = document.createElement('button');
  replayBtn.className = 'big-button';
  replayBtn.textContent = '再玩一次 ✨';
  replayBtn.addEventListener('click', onReplay);
  content.appendChild(replayBtn);

  scene.append(bg, princess, fireworks, content);

  scene.addEventListener('scene:enter', () => {
    launchFireworks(fireworks);
    playFanfare();
  });

  return scene;
}

function launchFireworks(container: HTMLElement): void {
  container.innerHTML = '';
  for (let burst = 0; burst < 6; burst++) {
    setTimeout(() => {
      const cx = 20 + Math.random() * 60;
      const cy = 20 + Math.random() * 40;
      const hue = Math.floor(Math.random() * 360);
      for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'fw-particle';
        p.style.left = cx + '%';
        p.style.top = cy + '%';
        p.style.background = `hsl(${hue + Math.random() * 40}, 90%, 70%)`;
        const angle = (Math.PI * 2 * i) / 20;
        const dist = 80 + Math.random() * 80;
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        container.appendChild(p);
        setTimeout(() => p.remove(), 1400);
      }
    }, burst * 450);
  }
}

let audioCtx: AudioContext | null = null;
function playFanfare(): void {
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return; }
  }
  const ctx = audioCtx!;
  const notes = [523, 659, 784, 1047, 1319]; // C E G C E
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.12;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.5);
  });
}
