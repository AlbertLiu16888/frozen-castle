/**
 * Artwork storage: persists the kid's colored pages as small JPEGs in localStorage.
 *
 * We compress aggressively (max 512px, JPEG q=0.7) so 10 pages fit well under the
 * 5MB per-origin quota. The gallery uses these to show the child's own versions
 * on completed tiles; the photo scene uses them as the overlay image.
 */

const KEY = 'frozen-castle-artworks-v1';
const MAX_SIDE = 512;
const JPEG_QUALITY = 0.72;

type ArtworkMap = Record<string, string>; // pageId -> dataURL

function readAll(): ArtworkMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ArtworkMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Quota — keep only the latest entry and retry
    try {
      const keys = Object.keys(map);
      const last = keys[keys.length - 1];
      localStorage.setItem(KEY, JSON.stringify({ [last]: map[last] }));
    } catch {
      /* give up quietly */
    }
  }
}

export function saveArtwork(pageId: string, dataUrl: string): void {
  const all = readAll();
  all[pageId] = dataUrl;
  writeAll(all);
}

export function getArtwork(pageId: string): string | null {
  return readAll()[pageId] ?? null;
}

export function clearArtworks(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/**
 * Export a canvas to a compact JPEG data URL suitable for storage and sharing.
 */
export function exportCanvasToDataUrl(canvas: HTMLCanvasElement): string {
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  if (scale >= 1) {
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * Convert a data URL to a Blob so we can hand it to Web Share or a download link.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Save or share a data URL, picking the best path per platform.
 * - iOS / Android: native share sheet (user can "save to photos")
 * - Desktop: triggers a download
 */
export async function saveOrShare(dataUrl: string, filename: string, title = '我的畫作'): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], filename, { type: blob.type });

  // Web Share with files, when available
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (err) {
      // user cancelled or share failed — fall through to download
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
