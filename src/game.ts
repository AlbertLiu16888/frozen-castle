import { renderHome } from './scenes/home';
import { renderGallery } from './scenes/gallery';
import { renderColoring } from './scenes/coloring';
import { renderPhoto } from './scenes/photo';
import { renderEnding } from './scenes/ending';

export type SceneName = 'home' | 'gallery' | 'coloring' | 'photo' | 'ending';

export class Game {
  private root: HTMLElement;
  private scenes: Record<SceneName, HTMLElement> = {} as Record<SceneName, HTMLElement>;
  private current: SceneName = 'home';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.scenes.home = renderHome(() => this.goto('gallery'));
    this.scenes.gallery = renderGallery(
      () => this.goto('coloring'),
      () => this.goto('ending'),
    );
    this.scenes.coloring = renderColoring(
      () => this.goto('gallery'),
      () => this.goto('gallery'),
      () => this.goto('photo'),
    );
    this.scenes.photo = renderPhoto(() => this.goto('gallery'));
    this.scenes.ending = renderEnding(() => this.goto('home'));

    for (const key of Object.keys(this.scenes) as SceneName[]) {
      this.root.appendChild(this.scenes[key]);
    }
    this.show(this.current);
  }

  private goto(name: SceneName): void {
    const prev = this.current;
    if (prev === name) return;
    this.current = name;
    this.scenes[prev].dispatchEvent(new CustomEvent('scene:leave'));
    this.scenes[prev].classList.remove('active');
    const el = this.scenes[name];
    el.dispatchEvent(new CustomEvent('scene:enter'));
    this.show(name);
  }

  private show(name: SceneName): void {
    this.scenes[name].classList.add('active');
  }
}

export function requestFullscreen(): void {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}
