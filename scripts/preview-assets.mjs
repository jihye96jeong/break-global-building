// DEV-ONLY: writes art-preview.html (open via `npm run dev` -> /art-preview.html) and art-source/contact-sheet.png.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LANDMARKS } from './prompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = Object.keys(LANDMARKS);
const cards = ids.map((id) => `<figure><div class="pair"><img src="assets/backgrounds/${id}.webp"><img class="b" src="assets/buildings/${id}.webp"></div><figcaption>${id}</figcaption></figure>`).join('\n');
await fs.writeFile(path.join(ROOT, 'art-preview.html'), `<!doctype html><meta charset="utf-8"><title>WORLD BREAKER art preview</title>
<style>body{background:#222;color:#eee;font:14px system-ui;margin:20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.pair{position:relative;aspect-ratio:9/16;background:#000;overflow:hidden}.pair img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pair img.b{object-fit:contain;top:auto;height:70%;bottom:5%}.h{height:160px;background:repeating-conic-gradient(#555 0 25%,#333 0 50%) 0/20px 20px}
figure{margin:0}</style><h1>Landmarks over their backgrounds</h1><div class="grid">${cards}</div>`);

// contact sheet: 4x2 landmarks on their plates + hero row
const W = 270, H = 480;
const tiles = [];
for (const [i, id] of ids.entries()) {
  const bg = await sharp(path.join(ROOT, 'public/assets/backgrounds', `${id}.webp`)).resize(W, H).toBuffer();
  const b = await sharp(path.join(ROOT, 'public/assets/buildings', `${id}.webp`)).resize(W - 20, H - 120, { fit: 'inside' }).toBuffer();
  const bm = await sharp(b).metadata();
  const card = await sharp(bg).composite([{ input: b, left: Math.round((W - bm.width) / 2), top: H - 30 - bm.height }]).png().toBuffer();
  tiles.push({ input: card, left: (i % 4) * W, top: Math.floor(i / 4) * H });
}
await sharp({ create: { width: 4 * W, height: 2 * H, channels: 4, background: '#2a2a3a' } }).composite(tiles).png().toFile(path.join(ROOT, 'art-source', 'contact-sheet.png'));
console.log('wrote art-preview.html and art-source/contact-sheet.png');
