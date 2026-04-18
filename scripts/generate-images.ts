/**
 * Batch-generate game assets via xAI Grok Image API.
 *
 * Usage:
 *   1. Put your key in .env: XAI_API_KEY=xai-...
 *   2. npm run generate-images
 *
 * Outputs PNGs to public/assets/. Piece/character images get white-background
 * chroma-keyed to transparent for clean compositing over scene backgrounds.
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import promptsJson from '../prompts.json' with { type: 'json' };

interface Prompt {
  id: string;
  filename: string;
  used_in: string;
  prompt: string;
}

interface PromptsFile {
  _meta: Record<string, string>;
  prompts: Prompt[];
}

const XAI_URL = 'https://api.x.ai/v1/images/generations';
const MODEL = 'grok-imagine-image';
const OUT_DIR = path.resolve('public/assets');

// Assets that should have their white background removed (pieces + characters)
const KEY_WHITE_IDS = new Set([
  'piece-body', 'piece-gate', 'piece-tower-l', 'piece-tower-r', 'piece-spire',
  'princess', 'snow-sprite',
]);

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error('❌ XAI_API_KEY not set. Copy .env.example to .env and add your key.');
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const { prompts } = promptsJson as PromptsFile;
  console.log(`📦 Generating ${prompts.length} images → ${OUT_DIR}\n`);

  for (const p of prompts) {
    const outPath = path.join(OUT_DIR, p.filename);
    try {
      await fs.access(outPath);
      console.log(`⏭  ${p.filename} already exists — skipping`);
      continue;
    } catch {
      // file doesn't exist, proceed
    }

    console.log(`🎨 ${p.id} … `);
    try {
      const buf = await generateImage(apiKey, p.prompt);
      const finalBuf = KEY_WHITE_IDS.has(p.id) ? await chromaKeyWhite(buf) : buf;
      await fs.writeFile(outPath, finalBuf);
      console.log(`   ✓ saved ${p.filename}`);
    } catch (err) {
      console.error(`   ✗ failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n✨ Done.');
}

async function generateImage(apiKey: string, prompt: string): Promise<Buffer> {
  const res = await fetch(XAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data: Array<{ b64_json?: string; url?: string }> };
  const first = json.data[0];
  if (first.b64_json) return Buffer.from(first.b64_json, 'base64');
  if (first.url) {
    const imgRes = await fetch(first.url);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error('No image data in response');
}

/**
 * Replace near-white pixels with transparent. Uses a soft threshold so edges
 * feather naturally.
 */
async function chromaKeyWhite(inputBuf: Buffer): Promise<Buffer> {
  const img = sharp(inputBuf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const HARD = 245; // fully transparent above this brightness
  const SOFT = 210; // fully opaque below this
  const buf = Buffer.from(data);

  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max; // low sat = grayscale

    if (min >= HARD && sat < 0.08) {
      buf[i + 3] = 0;
    } else if (min >= SOFT && sat < 0.1) {
      const t = (min - SOFT) / (HARD - SOFT); // 0..1
      buf[i + 3] = Math.round(255 * (1 - t));
    }
  }

  return sharp(buf, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
