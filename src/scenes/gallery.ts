/**
 * Gallery: shows all 10 coloring pages as thumbnails.
 * Pages unlock sequentially — finishing page N unlocks page N+1.
 * When every page is done, the "see the princess" button leads to the ending.
 */

import { PAGES, isUnlocked, isDone, completedCount, allComplete, resetProgress } from '../progress';
import { setSelectedPage } from '../state';
import { speak } from '../audio';

export function renderGallery(onPick: () => void, onAllDone: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-gallery';

  const bg = document.createElement('img');
  bg.className = 'scene-bg';
  bg.src = './assets/bg-home.png';
  bg.onerror = () => { bg.style.display = 'none'; };

  const title = document.createElement('div');
  title.className = 'gallery-title';
  title.innerHTML = `
    <h2>我的繪本 📖</h2>
    <p class="progress-line"></p>
  `;

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  const finishBtn = document.createElement('button');
  finishBtn.className = 'big-button gallery-finish';
  finishBtn.textContent = '去見公主 ✨';
  finishBtn.addEventListener('click', onAllDone);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'gallery-reset';
  resetBtn.textContent = '重新開始 🔄';
  resetBtn.addEventListener('click', () => {
    if (confirm('確定要重新開始嗎？所有進度會消失喔。')) {
      resetProgress();
      refresh();
    }
  });

  scene.append(bg, title, grid, finishBtn, resetBtn);

  const refresh = () => {
    grid.innerHTML = '';
    PAGES.forEach((page, idx) => {
      const tile = document.createElement('button');
      tile.className = 'gallery-tile';
      tile.dataset.pageId = page.id;
      const unlocked = isUnlocked(idx);
      const done = isDone(page.id);
      if (!unlocked) tile.classList.add('locked');
      if (done) tile.classList.add('done');

      const img = document.createElement('img');
      img.src = page.src;
      img.alt = page.title;
      img.draggable = false;

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = page.title;

      tile.append(img, label);
      tile.addEventListener('click', () => {
        if (!unlocked) {
          speak('這張還要先完成前一張喔！');
          return;
        }
        setSelectedPage(page.id);
        onPick();
      });
      grid.appendChild(tile);
    });

    const done = completedCount();
    const line = title.querySelector('.progress-line');
    if (line) line.textContent = `完成 ${done} / ${PAGES.length}`;
    finishBtn.style.display = allComplete() ? '' : 'none';
  };

  scene.addEventListener('scene:enter', () => {
    refresh();
    if (allComplete()) {
      speak('哇！你把全部的畫都塗完了，太厲害了！');
    } else if (completedCount() === 0) {
      speak('挑一張你喜歡的來畫畫吧！');
    } else {
      speak('做得好，接下來畫這一張！');
    }
  });

  refresh();
  return scene;
}
