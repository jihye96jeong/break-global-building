// Builds dist-single/index.html: one self-contained page (JS, CSS and every image inlined as data URIs).
// Used for hosts that serve only one HTML file reliably (e.g. a claude.ai artifact). Run after `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'dist-single');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const assets = {};
for (const dir of fs.readdirSync(path.join(DIST, 'assets'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  for (const f of fs.readdirSync(path.join(DIST, 'assets', dir)).filter((f) => f.endsWith('.webp'))) {
    const b64 = fs.readFileSync(path.join(DIST, 'assets', dir, f)).toString('base64');
    assets[`assets/${dir}/${f}`] = `data:image/webp;base64,${b64}`;
  }
}
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/);
const js = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/);
if (!css || !js) throw new Error('could not find the built CSS/JS in dist/index.html');
const cssText = fs.readFileSync(path.join(DIST, css[1]), 'utf8');
const jsText = fs.readFileSync(path.join(DIST, js[1]), 'utf8').replace(/<\/script/gi, '<\\/script');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
const title = head.match(/<title>[\s\S]*?<\/title>/)[0].replace(/<title>.*<\/title>/, '<title>WORLD BREAKER</title>');
const icon = head.match(/<link rel="icon"[^>]*>/)?.[0] ?? '';

// No doctype/html/head/body: the host wraps the page in its own skeleton.
const page = `${title}
<meta name="description" content="WORLD BREAKER — smash the world's landmarks">
${icon}
<style>:root{color-scheme:dark} html,body{height:100%;background:#1d1a3a}
${cssText}</style>
${body}
<script>window.__WB_ASSETS=${JSON.stringify(assets)};</script>
<script type="module">${jsText}</script>
`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), page);
console.log(`✓ dist-single/index.html ${(page.length / 1024 / 1024).toFixed(2)} MB, ${Object.keys(assets).length} images inlined`);
