import { Game } from './game';
import './style.css';

const app = document.getElementById('app')!;

// Orientation nag for portrait phones
const nag = document.createElement('div');
nag.className = 'rotate-nag';
nag.innerHTML = `
  <div class="icon">📱</div>
  <div>請把手機轉成橫的</div>
  <div style="font-size:1rem;opacity:.7">Rotate your device</div>
`;
document.body.appendChild(nag);

// Snow overlay (always on)
const snow = document.createElement('div');
snow.className = 'snow';
for (let i = 0; i < 40; i++) {
  const flake = document.createElement('div');
  flake.className = 'snow-flake';
  flake.textContent = ['❄', '❅', '❆', '✻'][i % 4];
  flake.style.left = Math.random() * 100 + '%';
  flake.style.fontSize = 8 + Math.random() * 18 + 'px';
  flake.style.animationDuration = 6 + Math.random() * 12 + 's';
  flake.style.animationDelay = -Math.random() * 10 + 's';
  snow.appendChild(flake);
}
document.body.appendChild(snow);

new Game(app).start();
