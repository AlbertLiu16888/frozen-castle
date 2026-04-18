import { renderHome } from './scenes/home';
import { renderAssembly } from './scenes/assembly';
import { renderColoring } from './scenes/coloring';
import { renderEnding } from './scenes/ending';

export type SceneName = 'home' | 'assembly' | 'coloring' | 'ending';

export class Game {
  private root: HTMLElement;
  private scenes: Record<SceneName, HTMLElement> = {} as Record<SceneName, HTMLElement>;
  private current: SceneName = 'home';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.scenes.home = renderHome(() => this.goto('assembly'));
    this.scenes.assembly = renderAssembly(() => this.goto('coloring'));
    this.scenes.coloring = renderColoring(() => this.goto('ending'));
    this.scenes.ending = renderEnding(() => this.goto('home'));

    for (const key of Object.keys(this.scenes) as SceneName[]) {
      this.root.appendChild(this.scenes[key]);
    }
    this.show(this.current);
  }

  private goto(name: SceneName): void {
    const prev = this.current;
    this.current = name;
    this.scenes[prev].classList.remove('active');
    // Re-mount scene to reset state if it has a re-init hook
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
