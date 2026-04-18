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
}

export const PAGES: Page[] = [
  { id: 'castle',    title: '魔法城堡', src: './assets/coloring-castle.png' },
  { id: 'princess',  title: '冰雪公主', src: './assets/coloring-princess.png' },
  { id: 'sprite',    title: '小雪精靈', src: './assets/coloring-sprite.png' },
  { id: 'snowflake', title: '大雪花',   src: './assets/coloring-snowflake.png' },
  { id: 'wand',      title: '魔法棒',   src: './assets/coloring-wand.png' },
  { id: 'crown',     title: '皇冠',     src: './assets/coloring-crown.png' },
  { id: 'throne',    title: '冰寶座',   src: './assets/coloring-throne.png' },
  { id: 'sleigh',    title: '馴鹿雪橇', src: './assets/coloring-sleigh.png' },
  { id: 'forest',    title: '雪地森林', src: './assets/coloring-forest.png' },
  { id: 'heart',     title: '愛心花園', src: './assets/coloring-heart.png' },
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
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota or privacy */ }
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
