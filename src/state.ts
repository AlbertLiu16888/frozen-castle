/**
 * Lightweight inter-scene state — which coloring page the gallery handed off.
 */

let selectedPage: string | null = null;

export function setSelectedPage(id: string): void {
  selectedPage = id;
}

export function getSelectedPage(): string | null {
  return selectedPage;
}
