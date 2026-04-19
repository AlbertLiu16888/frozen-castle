/**
 * Photo scene: front camera preview with the kid's artwork overlaid as a sticker,
 * a snap button that composites both into a single image, and save/retake controls.
 *
 * Falls back gracefully if the browser denies camera access or the device lacks a camera.
 */

import { saveOrShare, getArtwork } from '../artwork';
import { getSelectedPage } from '../state';
import { PAGES } from '../progress';
import { speak, speakNamed } from '../audio';

export function renderPhoto(onBack: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-photo';

  const video = document.createElement('video');
  video.className = 'photo-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; // required for autoplay

  const overlay = document.createElement('img');
  overlay.className = 'photo-artwork';
  overlay.alt = '我的畫作';

  const hint = document.createElement('div');
  hint.className = 'photo-hint';
  hint.textContent = '跟你的畫作一起拍照！📸';

  const snapBtn = document.createElement('button');
  snapBtn.className = 'big-button photo-snap';
  snapBtn.textContent = '📸 拍!';

  const backBtn = document.createElement('button');
  backBtn.className = 'next-page-btn photo-back';
  backBtn.textContent = '⬅️ 返回';
  backBtn.addEventListener('click', () => {
    stopCamera();
    onBack();
  });

  // Preview state (shown after snap)
  const preview = document.createElement('div');
  preview.className = 'photo-preview';
  preview.style.display = 'none';

  const previewImg = document.createElement('img');
  previewImg.className = 'photo-preview-img';

  const savePreviewBtn = document.createElement('button');
  savePreviewBtn.className = 'big-button photo-save';
  savePreviewBtn.textContent = '💾 儲存';

  const retakeBtn = document.createElement('button');
  retakeBtn.className = 'big-button photo-retake';
  retakeBtn.textContent = '🔄 重拍';

  preview.append(previewImg, savePreviewBtn, retakeBtn);

  const fallback = document.createElement('div');
  fallback.className = 'photo-fallback';
  fallback.style.display = 'none';
  fallback.innerHTML = `
    <h2>哎呀 📷</h2>
    <p>沒辦法打開相機。你可以先儲存畫作到手機喔！</p>
    <button class="big-button photo-fallback-save">💾 儲存畫作</button>
  `;

  scene.append(video, overlay, hint, snapBtn, backBtn, preview, fallback);

  let stream: MediaStream | null = null;
  let lastSnapDataUrl: string | null = null;

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    try { video.srcObject = null; } catch { /* ignore */ }
  };

  const startCamera = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      video.srcObject = stream;
      fallback.style.display = 'none';
      video.style.display = '';
      snapBtn.style.display = '';
    } catch (err) {
      console.warn('[photo] camera error', err);
      video.style.display = 'none';
      snapBtn.style.display = 'none';
      fallback.style.display = 'flex';
    }
  };

  const loadArtworkOverlay = () => {
    const pageId = getSelectedPage();
    const src = pageId ? getArtwork(pageId) : null;
    if (src) {
      overlay.src = src;
      overlay.style.display = '';
    } else {
      // Fallback: current page lineart
      const page = PAGES.find((p) => p.id === pageId);
      overlay.src = page ? page.src : PAGES[0].src;
    }
  };

  snapBtn.addEventListener('click', () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;

    // Mirror the selfie so text reads correctly (front camera is inverted)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Composite artwork sticker at bottom-right, 32% of width
    if (overlay.complete && overlay.naturalWidth) {
      const ow = canvas.width * 0.32;
      const oh = ow * (overlay.naturalHeight / overlay.naturalWidth);
      const ox = canvas.width - ow - canvas.width * 0.03;
      const oy = canvas.height - oh - canvas.height * 0.04;
      // White rounded frame behind artwork
      ctx.fillStyle = 'white';
      const pad = canvas.width * 0.008;
      const r = canvas.width * 0.02;
      roundRect(ctx, ox - pad, oy - pad, ow + pad * 2, oh + pad * 2, r);
      ctx.fill();
      ctx.drawImage(overlay, ox, oy, ow, oh);
    }

    lastSnapDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    previewImg.src = lastSnapDataUrl;
    preview.style.display = '';
    video.style.display = 'none';
    snapBtn.style.display = 'none';
    overlay.style.display = 'none';
    hint.style.display = 'none';
    speak('拍好了！');
  });

  retakeBtn.addEventListener('click', () => {
    preview.style.display = 'none';
    video.style.display = '';
    snapBtn.style.display = '';
    overlay.style.display = '';
    hint.style.display = '';
    lastSnapDataUrl = null;
  });

  savePreviewBtn.addEventListener('click', async () => {
    if (!lastSnapDataUrl) return;
    const pageId = getSelectedPage() ?? 'photo';
    const stamp = new Date().toISOString().slice(0, 10);
    await saveOrShare(lastSnapDataUrl, `冰雪繪本-${pageId}-${stamp}.jpg`, '我的畫作合照');
  });

  const fallbackSaveBtn = fallback.querySelector<HTMLButtonElement>('.photo-fallback-save');
  fallbackSaveBtn?.addEventListener('click', async () => {
    const pageId = getSelectedPage();
    const dataUrl = pageId ? getArtwork(pageId) : null;
    if (!dataUrl) return;
    const stamp = new Date().toISOString().slice(0, 10);
    await saveOrShare(dataUrl, `冰雪繪本-${pageId}-${stamp}.jpg`, '我的畫作');
  });

  scene.addEventListener('scene:enter', () => {
    speakNamed('{name}來跟你的畫作一起拍照吧！');
    preview.style.display = 'none';
    lastSnapDataUrl = null;
    loadArtworkOverlay();
    startCamera();
  });

  scene.addEventListener('scene:leave', () => {
    stopCamera();
  });

  return scene;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
