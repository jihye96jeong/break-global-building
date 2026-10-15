// DEV-ONLY asset QA: every P0 file exists, decodes, has the right size/alpha/coverage, and the total stays small.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LANDMARKS } from './prompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = path.join(ROOT, 'public', 'assets');
const checks = [];
for (const id of Object.keys(LANDMARKS)) {
  checks.push({ file: `buildings/${id}.webp`, alpha: true, minOpaque: 0.12, maxOpaque: 0.9, minSide: 400 });
  checks.push({ file: `backgrounds/${id}.webp`, alpha: false, minSide: 1280, landscape: true });
}

let failed = 0, total = 0;
for (const c of checks) {
  const f = path.join(A, c.file);
  const problems = [];
  try {
    const st = await fs.stat(f);
    total += st.size;
    const img = sharp(f);
    const m = await img.metadata();
    if (Math.max(m.width, m.height) < c.minSide) problems.push(`too small ${m.width}x${m.height}`);
    if (c.landscape && m.width <= m.height) problems.push('background must be landscape');
    if (c.alpha) {
      if (!m.hasAlpha) problems.push('no alpha channel');
      const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let opaque = 0, magenta = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const a = data[i * 4 + 3];
        if (a > 40) {
          opaque++;
          const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
          if (Math.min(r, b) - g > 90) magenta++;
        }
      }
      const ratio = opaque / (info.width * info.height);
      if (ratio < c.minOpaque || ratio > c.maxOpaque) problems.push(`opaque ratio ${ratio.toFixed(2)} out of range`);
      if (magenta / Math.max(1, opaque) > 0.01) problems.push(`magenta fringe ${(100 * magenta / opaque).toFixed(1)}%`);
      // edges should be transparent after trimming (no leftover backdrop)
      const corner = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1].map((i) => data[i * 4 + 3]);
      if (corner.some((a) => a > 200)) problems.push('opaque corner: backdrop not removed');
      console.log(`${problems.length ? '✗' : '✓'} ${c.file} ${m.width}x${m.height} opaque ${(ratio * 100).toFixed(0)}% ${(st.size / 1024).toFixed(0)}KB ${problems.join('; ')}`);
    } else {
      console.log(`${problems.length ? '✗' : '✓'} ${c.file} ${m.width}x${m.height} ${(st.size / 1024).toFixed(0)}KB ${problems.join('; ')}`);
    }
  } catch (e) {
    problems.push(`missing or unreadable (${e.code || e.message})`);
    console.log(`✗ ${c.file} ${problems.join('; ')}`);
  }
  if (problems.length) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} ok, total ${(total / 1024 / 1024).toFixed(2)} MB`);
if (total > 12 * 1024 * 1024) { console.log('✗ total asset size above 12 MB'); failed++; }
process.exit(failed ? 1 : 0);
