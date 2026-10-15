// DEV-ONLY: art-source/* -> public/assets/**/*.webp. Magenta chroma key, despill, trim, resize, compress.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art-source');
const OUT = path.join(ROOT, 'public', 'assets');
// art-source/character (optional illustrated hero) is not shipped: the game draws a stick figure
const OUT_DIR = { building: 'buildings', background: 'backgrounds' };
const only = process.argv.find((a) => a.startsWith('--id='))?.slice(5);

// "magenta-ness": how far both R and B sit above G. Pure #FF00FF scores 255; art rarely above ~60.
const KEY_LO = 70, KEY_HI = 150;

function keyMagenta(data, w, h) {
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const m = Math.min(r, b) - g;
    let a = 1;
    if (m >= KEY_HI) a = 0;
    else if (m > KEY_LO) a = 1 - (m - KEY_LO) / (KEY_HI - KEY_LO);
    // despill: pull the magenta cast out of semi-keyed edge pixels
    const spill = m - 25;
    if (spill > 0) {
      data[o] = Math.max(0, r - spill);
      data[o + 2] = Math.max(0, b - spill);
    }
    data[o + 3] = Math.round(a * 255);
  }
  // drop isolated specks: an opaque pixel with < 2 opaque 8-neighbours
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!alpha[i]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && alpha[i + dy * w + dx] > 64) n++;
    if (n < 2) data[i * 4 + 3] = 0;
  }
  // a 1px alpha erosion on the soft edge removes the last pink fringe
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (alpha[i] < 255) continue;
    let minN = 255;
    for (const d of [-1, 1, -w, w]) minN = Math.min(minN, alpha[i + d]);
    if (minN === 0) data[i * 4 + 3] = 200;
  }
}

function bbox(data, w, h, thr = 24) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function sprite(file, out, maxW, maxH) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  keyMagenta(data, info.width, info.height);
  const box = bbox(data, info.width, info.height);
  if (!box) throw new Error(`${path.basename(file)}: nothing left after keying`);
  const pad = 2;
  const ex = { left: Math.max(0, box.x - pad), top: Math.max(0, box.y - pad) };
  ex.width = Math.min(info.width - ex.left, box.w + pad * 2);
  ex.height = Math.min(info.height - ex.top, box.h + pad * 2);
  const img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(ex)
    .resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });
  const res = await img.webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer({ resolveWithObject: true });
  await fs.writeFile(out, res.data);
  return { width: res.info.width, height: res.info.height, sourceBox: box };
}

async function background(file, out) {
  const res = await sharp(file).resize(1600, 900, { fit: 'cover', position: 'centre' })
    .modulate({ saturation: 0.88, brightness: 1.04 }) // keep the plate a bit softer than the landmark
    .blur(0.6).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  await fs.writeFile(out, res.data);
  return { width: res.info.width, height: res.info.height };
}

async function main() {
  const meta = {};
  for (const type of Object.keys(OUT_DIR)) {
    const dir = path.join(SRC, type);
    let files = [];
    try { files = await fs.readdir(dir); } catch { continue; }
    await fs.mkdir(path.join(OUT, OUT_DIR[type]), { recursive: true });
    for (const f of files.sort()) {
      const id = path.parse(f).name;
      if (only && id !== only) continue;
      const out = path.join(OUT, OUT_DIR[type], `${id}.webp`);
      const src = path.join(dir, f);
      const info = type === 'background' ? await background(src, out)
        : type === 'building' ? await sprite(src, out, 1100, 1300)
        : await sprite(src, out, 320, 320);
      meta[`${type}:${id}`] = { file: path.relative(path.join(ROOT, 'public'), out), ...info };
      console.log(`${type}/${id} -> ${path.relative(ROOT, out)} ${info.width}x${info.height}`);
    }
  }
  console.log(`processed ${Object.keys(meta).length} file(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
