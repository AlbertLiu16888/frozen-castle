/**
 * Photo scene: front camera + artwork sticker.
 *
 * Flow:
 *  1. Scene enter → camera starts + "準備好" prompt.
 *  2. Once video is ready → 5-second countdown with voice (五...四...三...二...一... 笑一個!)
 *  3. Auto-snap composites video frame + artwork sticker into one image.
 *  4. Attempts auto-save (download on desktop, share sheet on mobile). Where the
 *     browser requires a user gesture, a big [💾 儲存] button remains available.
 *  5. [🔄 再拍] restarts the countdown. [⬅️ 返回] returns to the gallery.
 */

import { saveOrShare, getArtwork } from '../artwork';
import { getSelectedPage } from '../state';
import { PAGES } from '../progress';
import { speak, speakNamed } from '../audio';

const COUNTDOWN_START = 5;
const CN_NUMBERS: Record<number, string> = { 5: '五', 4: '四', 3: '三', 2: '二', 1: '一' };

export function renderPhoto(onBack: () => void): HTMLElement {
  const scene = document.createElement('div');
  scene.className = 'scene scene-photo';

  // ---- live camera view ----
  const video = document.createElement('video');
  video.className = 'photo-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const overlay = document.createElement('img');
  overlay.className = 'photo-artwork';
  overlay.alt = '我的畫作';

  const hint = document.createElement('div');
  hint.className = 'photo-hint';

  const countdownEl = document.createElement('div');
  countdownEl.className = 'photo-countdown';
  countdownEl.style.display = 'none';

  const backBtn = document.createElement('button');
  backBtn.className = 'next-page-btn photo-back';
  backBtn.textContent = '⬅️ 返回';
  backBtn.addEventListener('click', () => {
    teardown();
    onBack();
  });

  // ---- preview (after snap) ----
  const preview = document.createElement('div');
  preview.className = 'photo-preview';
  preview.style.display = 'none';

  const previewImg = document.createElement('img');
  previewImg.className = 'photo-preview-img';

  const savedMsg = document.createElement('div');
  savedMsg.className = 'photo-saved-msg';
  savedMsg.textContent = '✓ 已儲存到相簿！';
  savedMsg.style.display = 'none';

  const previewActions = document.createElement('div');
  previewActions.className = 'photo-preview-actions';

  const savePreviewBtn = document.createElement('button');
  savePreviewBtn.className = 'big-button photo-save';
  savePreviewBtn.textContent = '💾 儲存';

  const retakeBtn = document.createElement('button');
  retakeBtn.className = 'big-button photo-retake';
  retakeBtn.textContent = '🔄 再拍一次';

  const previewBackBtn = document.createElement('button');
  previewBackBtn.className = 'big-button photo-preview-back';
  previewBackBtn.textContent = '⬅️ 返回';

  previewActions.append(savePreviewBtn, retakeBtn, previewBackBtn);
  preview.append(previewImg, savedMsg, previewActions);

  // ---- fallback when camera unavailable ----
  const fallback = document.createElement('div');
  fallback.className = 'photo-fallback';
  fallback.style.display = 'none';
  fallback.innerHTML = `
    <h2>哎呀 📷</h2>
    <p>沒辦法打開相機。可以先把畫作儲存下來！</p>
    <div class="photo-preview-actions">
      <button class="big-button photo-fallback-save">💾 儲存畫作</button>
      <button class="big-button photo-fallback-back">⬅️ 返回</button>
    </div>
  `;

  scene.append(video, overlay, hint, countdownEl, backBtn, preview, fallback);

  // ---- state ----
  let stream: MediaStream | null = null;
  let countdownTimer: number | null = null;
  let lastSnapDataUrl: string | null = null;

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    try { video.srcObject = null; } catch { /* ignore */ }
  };

  const stopCountdown = () => {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdownEl.style.display = 'none';
  };

  const teardown = () => {
    stopCountdown();
    stopCamera();
  };

  const flashCountdown = (n: number) => {
    countdownEl.textContent = String(n);
    countdownEl.classList.remove('pop');
    void countdownEl.offsetWidth; // restart animation
    countdownEl.classList.add('pop');
    countdownEl.style.display = '';
  };

  const startCountdown = () => {
    stopCountdown();
    hint.style.display = '';
    let remaining = COUNTDOWN_START;
    flashCountdown(remaining);
    speak(CN_NUMBERS[remaining]);
    hint.textContent = '準備好！';

    countdownTimer = window.setInterval(() => {
      remaining--;
      if (remaining > 0) {
        flashCountdown(remaining);
        speak(CN_NUMBERS[remaining]);
      } else {
        stopCountdown();
        countdownEl.textContent = '📸';
        countdownEl.style.display = '';
        hint.textContent = '笑一個！';
        speak('笑一個！');
        // Snap on the next frame so the smile prompt lands first
        setTimeout(performSnap, 400);
      }
    }, 1000);
  };

  const performSnap = () => {
    if (!video.videoWidth || !video.videoHeight) {
      // Camera not ready somehow — fall back gracefully
      teardown();
      fallback.style.display = 'flex';
      video.style.display = 'none';
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;

    // Mirror the selfie so it reads correctly after capture
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (overlay.complete && overlay.naturalWidth) {
      const ow = canvas.width * 0.32;
      const oh = ow * (overlay.naturalHeight / overlay.naturalWidth);
      const ox = canvas.width - ow - canvas.width * 0.03;
      const oy = canvas.height - oh - canvas.height * 0.04;
      ctx.fillStyle = 'white';
      const pad = canvas.width * 0.008;
      const r = canvas.width * 0.02;
      roundRect(ctx, ox - pad, oy - pad, ow + pad * 2, oh + pad * 2, r);
      ctx.fill();
      ctx.drawImage(overlay, ox, oy, ow, oh);
    }

    lastSnapDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    previewImg.src = lastSnapDataUrl;

    // Switch UI to preview state
    video.style.display = 'none';
    overlay.style.display = 'none';
    hint.style.display = 'none';
    countdownEl.style.display = 'none';
    preview.style.display = '';
    savedMsg.style.display = 'none';
    savePreviewBtn.textContent = '💾 儲存';
    speak('拍好了！');

    // Attempt auto-save. On desktop this silently triggers download; on mobile
    // the browser may require a user gesture for Web Share, in which case the
    // call completes without an effect and the 儲存 button is the fallback.
    void attemptSave(/* auto */ true);
  };

  const attemptSave = async (auto: boolean): Promise<void> => {
    if (!lastSnapDataUrl) return;
    const pageId = getSelectedPage() ?? 'photo';
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `冰雪繪本-${pageId}-${stamp}.jpg`;
    try {
      await saveOrShare(lastSnapDataUrl, filename, '我的畫作合照');
      savedMsg.style.display = '';
      savePreviewBtn.textContent = '💾 再存一次';
    } catch (err) {
      // Either user cancelled a share sheet, or it requires a gesture.
      if (!auto) {
        console.warn('[photo] save failed', err);
      }
    }
  };

  savePreviewBtn.addEventListener('click', () => attemptSave(false));
  retakeBtn.addEventListener('click', () => {
    lastSnapDataUrl = null;
    preview.style.display = 'none';
    savedMsg.style.display = 'none';
    video.style.display = '';
    overlay.style.display = '';
    hint.style.display = '';
    startCountdown();
  });
  previewBackBtn.addEventListener('click', () => {
    teardown();
    onBack();
  });

  // Fallback buttons
  fallback.querySelector<HTMLButtonElement>('.photo-fallback-back')?.addEventListener('click', () => {
    teardown();
    onBack();
  });
  fallback.querySelector<HTMLButtonElement>('.photo-fallback-save')?.addEventListener('click', async () => {
    const pageId = getSelectedPage();
    const dataUrl = pageId ? getArtwork(pageId) : null;
    if (!dataUrl) return;
    const stamp = new Date().toISOString().slice(0, 10);
    await saveOrShare(dataUrl, `冰雪繪本-${pageId}-${stamp}.jpg`, '我的畫作');
  });

  const loadArtworkOverlay = () => {
    const pageId = getSelectedPage();
    const saved = pageId ? getArtwork(pageId) : null;
    if (saved) {
      overlay.src = saved;
    } else {
      const page = PAGES.find((p) => p.id === pageId);
      overlay.src = page ? page.src : PAGES[0].src;
    }
    overlay.style.display = '';
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
      // Start countdown once the video actually has dimensions
      if (video.readyState >= 2 && video.videoWidth > 0) {
        startCountdown();
      } else {
        video.addEventListener('loadedmetadata', () => startCountdown(), { once: true });
      }
    } catch (err) {
      console.warn('[photo] camera error', err);
      video.style.display = 'none';
      countdownEl.style.display = 'none';
      hint.style.display = 'none';
      fallback.style.display = 'flex';
    }
  };

  scene.addEventListener('scene:enter', () => {
    preview.style.display = 'none';
    savedMsg.style.display = 'none';
    fallback.style.display = 'none';
    lastSnapDataUrl = null;
    hint.textContent = '準備好！';
    speakNamed('{name}看鏡頭笑一個，五秒後自動拍照！');
    loadArtworkOverlay();
    startCamera();
  });

  scene.addEventListener('scene:leave', () => {
    teardown();
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
