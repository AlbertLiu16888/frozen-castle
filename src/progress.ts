/**
 * Local progress tracking for the coloring book.
 *
 * Pages unlock sequentially: page[i] opens once page[i-1] is marked done.
 * State persists in localStorage so kids can come back later.
 */

export interface Page {
  id: string;
  title: string;
  src: string;
  chapter: 1 | 2;
}

export const PAGES: Page[] = [
  // Chapter 1 — 冰雪魔法
  { id: 'castle',    title: '魔法城堡', src: './assets/coloring-castle.png',    chapter: 1 },
  { id: 'princess',  title: '冰雪公主', src: './assets/coloring-princess.png',  chapter: 1 },
  { id: 'sprite',    title: '小雪精靈', src: './assets/coloring-sprite.png',    chapter: 1 },
  { id: 'snowflake', title: '大雪花',   src: './assets/coloring-snowflake.png', chapter: 1 },
  { id: 'wand',      title: '魔法棒',   src: './assets/coloring-wand.png',      chapter: 1 },
  { id: 'crown',     title: '皇冠',     src: './assets/coloring-crown.png',     chapter: 1 },
  { id: 'throne',    title: '冰寶座',   src: './assets/coloring-throne.png',    chapter: 1 },
  { id: 'sleigh',    title: '馴鹿雪橇', src: './assets/coloring-sleigh.png',    chapter: 1 },
  { id: 'forest',    title: '雪地森林', src: './assets/coloring-forest.png',    chapter: 1 },
  { id: 'heart',     title: '愛心花園', src: './assets/coloring-heart.png',     chapter: 1 },

  // Chapter 2 — 奇幻世界
  { id: 'rainbow',    title: '彩虹天空', src: './assets/coloring-rainbow.png',    chapter: 2 },
  { id: 'unicorn',    title: '獨角獸',   src: './assets/coloring-unicorn.png',    chapter: 2 },
  { id: 'butterfly',  title: '蝴蝶花園', src: './assets/coloring-butterfly.png',  chapter: 2 },
  { id: 'penguin',    title: '企鵝家族', src: './assets/coloring-penguin.png',    chapter: 2 },
  { id: 'rocket',     title: '太空火箭', src: './assets/coloring-rocket.png',     chapter: 2 },
  { id: 'mermaid',    title: '美人魚',   src: './assets/coloring-mermaid.png',    chapter: 2 },
  { id: 'cupcake',    title: '杯子蛋糕', src: './assets/coloring-cupcake.png',    chapter: 2 },
  { id: 'dragon',     title: '小龍寶寶', src: './assets/coloring-dragon.png',     chapter: 2 },
  { id: 'arcticfox',  title: '北極狐',   src: './assets/coloring-arcticfox.png',  chapter: 2 },
  { id: 'underwater', title: '海底世界', src: './assets/coloring-underwater.png', chapter: 2 },
];

export const CHAPTERS = [
  { id: 1 as const, title: '第一章 · 冰雪魔法' },
  { id: 2 as const, title: '第二章 · 奇幻世界' },
];

const KEY = 'frozen-castle-progress-v1';

type ProgressMap = Record<string, boolean>;

export function getProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function markDone(pageId: string): void {
  const p = getProgress();
  p[pageId] = true;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
}

export function resetProgress(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function isDone(pageId: string): boolean {
  return getProgress()[pageId] === true;
}

export function isUnlocked(pageIndex: number): boolean {
  if (pageIndex <= 0) return true;
  const prev = PAGES[pageIndex - 1];
  return isDone(prev.id);
}

export function completedCount(): number {
  const p = getProgress();
  return PAGES.filter((pg) => p[pg.id]).length;
}

export function allComplete(): boolean {
  return completedCount() >= PAGES.length;
}
