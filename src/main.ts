import { Game } from './game';
import { isMuted, setMuted } from './audio';
import './style.css';

const app = document.getElementById('app')!;

// Mute toggle (top-right corner, always on top)
const muteBtn = document.createElement('button');
muteBtn.className = 'mute-btn';
muteBtn.setAttribute('aria-label', '靜音切換');
const updateMuteIcon = () => {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
};
updateMuteIcon();
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMuted(!isMuted());
  updateMuteIcon();
});
document.body.appendChild(muteBtn);

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
