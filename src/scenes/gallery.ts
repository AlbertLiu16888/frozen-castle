/**
 * Gallery: shows all coloring pages as thumbnails, grouped by chapter.
 * Pages unlock sequentially — finishing page N unlocks page N+1.
 */

import {
  PAGES, CHAPTERS, isUnlocked, isDone, completedCount, allComplete, resetProgress,
} from '../progress';
import { setSelectedPage } from '../state';
import { speak, speakNamed } from '../audio';
import { getArtwork, clearArtworks } from '../artwork';

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

  const scroller = document.createElement('div');
  scroller.className = 'gallery-scroller';

  const finishBtn = document.createElement('button');
  finishBtn.className = 'big-button gallery-finish';
  finishBtn.textContent = '去見公主 ✨';
  finishBtn.addEventListener('click', onAllDone);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'gallery-reset';
  resetBtn.textContent = '重新開始 🔄';
  resetBtn.addEventListener('click', () => {
    if (confirm('確定要重新開始嗎？所有進度和畫作會消失喔。')) {
      resetProgress();
      clearArtworks();
      refresh();
    }
  });

  scene.append(bg, title, scroller, finishBtn, resetBtn);

  const refresh = () => {
    scroller.innerHTML = '';

    for (const chapter of CHAPTERS) {
      const chapterPages = PAGES.map((p, idx) => ({ p, idx })).filter((x) => x.p.chapter === chapter.id);
      if (chapterPages.length === 0) continue;

      const section = document.createElement('section');
      section.className = 'gallery-chapter';

      const head = document.createElement('h3');
      head.className = 'chapter-heading';
      head.textContent = chapter.title;
      section.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'gallery-grid';

      for (const { p: page, idx } of chapterPages) {
        const tile = document.createElement('button');
        tile.className = 'gallery-tile';
        tile.dataset.pageId = page.id;
        const unlocked = isUnlocked(idx);
        const done = isDone(page.id);
        if (!unlocked) tile.classList.add('locked');
        if (done) tile.classList.add('done');

        const img = document.createElement('img');
        const saved = done ? getArtwork(page.id) : null;
        img.src = saved ?? page.src;
        img.alt = page.title;
        img.draggable = false;

        const label = document.createElement('span');
        label.className = 'tile-label';
        label.textContent = page.title;

        tile.append(img, label);
        tile.addEventListener('click', () => {
          if (!unlocked) {
            speakNamed('{name}要先完成前一張喔！');
            return;
          }
          setSelectedPage(page.id);
          onPick();
        });
        grid.appendChild(tile);
      }

      section.appendChild(grid);
      scroller.appendChild(section);
    }

    const done = completedCount();
    const line = title.querySelector('.progress-line');
    if (line) line.textContent = `完成 ${done} / ${PAGES.length}`;
    finishBtn.style.display = allComplete() ? '' : 'none';
  };

  scene.addEventListener('scene:enter', () => {
    refresh();
    if (allComplete()) {
      speakNamed('哇！{name}把全部的畫都塗完了，超級厲害！');
    } else if (completedCount() === 0) {
      speakNamed('{name}挑一張你喜歡的來畫畫吧！');
    } else {
      speak('做得真好，再來畫下一張！');
    }
  });

  refresh();
  return scene;
}
