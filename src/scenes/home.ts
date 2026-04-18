import { requestFullscreen } from '../game';

export function renderHome(onStart: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.id = 'scene-home';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-home.png';
  bg.onerror = () => {
    bg.style.display = 'none';
  };

  const content = document.createElement('div');
  content.className = 'scene-content';
  content.innerHTML = `
    <h1 class="title">冰雪魔法城堡</h1>
    <p class="subtitle">幫公主蓋城堡，用魔法棒塗上顏色！</p>
  `;

  const btn = document.createElement('button');
  btn.className = 'big-button';
  btn.textContent = '✨ 開始 ✨';
  btn.addEventListener('click', () => {
    requestFullscreen();
    onStart();
  });

  content.appendChild(btn);
  scene.append(bg, content);
  return scene;
}
