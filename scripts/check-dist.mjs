// Fails the build if anything from the dev-only xAI pipeline leaked into dist/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const banned = ['XAI_API_KEY', 'api.x.ai', 'images/generations', 'images/edits', 'b64_json', 'Bearer '];
const envKey = (() => {
  try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^XAI_API_KEY=(.+)$/m) || [])[1]?.trim(); } catch { return null; }
})();
if (envKey) banned.push(envKey);

const hits = [];
let files = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    files++;
    if (e.name === 'art-preview.html') hits.push(`${path.relative(ROOT, p)}: dev-only file shipped`);
    if (!/\.(html|js|css|json|txt|map|svg)$/.test(e.name)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const b of banned) if (text.includes(b)) hits.push(`${path.relative(ROOT, p)}: contains ${b === envKey ? '<the API key>' : JSON.stringify(b)}`);
  }
})(DIST);
if (hits.length) { console.error('✗ dist check failed:\n' + hits.join('\n')); process.exit(1); }
console.log(`✓ dist check: ${files} files, no API key, no xAI endpoint, no generation code`);
