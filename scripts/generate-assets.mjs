// DEV-ONLY xAI image generation. Run explicitly: npm run assets:generate -- --sample | --all | --id=<id> --type=<type> [--force]
// Never runs during dev/build/preview and is never imported by the game. Reads XAI_API_KEY from the local .env only.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allJobs, SAMPLE_KEYS } from './prompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'art-source');
const MANIFEST = path.join(ROOT, 'public', 'assets', 'assets-manifest.json');

const KEY = process.env.XAI_API_KEY || '';
const BASE = 'https://api.x.ai/v1';
const MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0';
const MAX_REQUESTS = Number(process.env.MAX_ASSET_REQUESTS || 30);
const MAX_BUDGET = Number(process.env.MAX_ASSET_BUDGET_USD || 3);
// Conservative per-image estimate; check https://docs.x.ai pricing before a large batch.
const COST = { '1k': Number(process.env.COST_PER_IMAGE_1K_USD || 0.05), '2k': Number(process.env.COST_PER_IMAGE_2K_USD || 0.08) };

const redact = (s) => (KEY ? String(s).split(KEY).join('<redacted>') : String(s));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

async function readManifest() {
  try { return JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch { return { model: MODEL, jobs: {} }; }
}
async function writeManifest(m) {
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

function sniffExt(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

async function existingSource(job) {
  for (const ext of ['png', 'jpg', 'webp']) {
    const p = path.join(SRC_DIR, job.type, `${job.id}.${ext}`);
    try { await fs.access(p); return p; } catch { /* not there */ }
  }
  return null;
}

async function callApi(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${redact(text).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = JSON.parse(text);
  const item = json?.data?.[0];
  if (!item) throw new Error('response contained no image');
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) { // URLs expire: download immediately, never reference them from the game
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`image download failed: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('response item had neither b64_json nor url');
}

async function generate(job) {
  if (job.editFrom) {
    const ref = await existingSource({ id: job.editFrom, type: job.type });
    if (ref) {
      const ext = path.extname(ref).slice(1).replace('jpg', 'jpeg');
      const dataUri = `data:image/${ext};base64,${(await fs.readFile(ref)).toString('base64')}`;
      try {
        return { mode: 'edit', bytes: await callApi('/images/edits', { model: MODEL, prompt: job.prompt, image: { url: dataUri, type: 'image_url' }, response_format: 'b64_json' }) };
      } catch (e) {
        console.warn(`  edit failed (${e.message}); falling back to a fresh generation`);
      }
    }
  }
  const base = job.editFrom ? allJobs().find((j) => j.id === job.editFrom)?.prompt ?? '' : '';
  const prompt = job.editFrom ? `${base}\nPose: ${job.prompt}` : job.prompt;
  return { mode: 'generate', bytes: await callApi('/images/generations', {
    model: MODEL, prompt, n: 1, aspect_ratio: job.aspect, resolution: job.resolution, quality: job.quality, response_format: 'b64_json',
  }) };
}

async function main() {
  let jobs = allJobs();
  if (args.sample) jobs = jobs.filter((j) => SAMPLE_KEYS.includes(`${j.type}:${j.id}`));
  else if (args.id) jobs = jobs.filter((j) => j.id === args.id && (!args.type || j.type === args.type));
  else if (!args.all) {
    console.log('Usage: npm run assets:generate -- --sample | --all [--type=<type>] | --id=<id> [--type=building|background|character] [--force]');
    process.exit(1);
  }
  if (args.all && args.type) jobs = jobs.filter((j) => j.type === args.type);
  if (!jobs.length) { console.error('No matching jobs.'); process.exit(1); }

  const todo = [];
  for (const j of jobs) if (args.force || !(await existingSource(j))) todo.push(j);
  const estimate = todo.reduce((s, j) => s + COST[j.resolution], 0);
  console.log(`${jobs.length} job(s) selected, ${todo.length} to generate, ${jobs.length - todo.length} reused from art-source/.`);
  console.log(`Estimated cost: ~$${estimate.toFixed(2)} (limits: ${MAX_REQUESTS} requests, $${MAX_BUDGET}).`);
  if (!todo.length) return;
  if (!KEY) {
    console.error('XAI_API_KEY is missing. Copy .env.example to .env and set it. Asset generation is NOT complete.');
    process.exit(2);
  }

  const manifest = await readManifest();
  manifest.model = MODEL;
  let requests = 0, spent = 0, failed = 0;
  for (const job of todo) {
    let done = false;
    for (let attempt = 0; attempt <= 2 && !done; attempt++) { // first try + max 2 retries
      if (requests >= MAX_REQUESTS || spent + COST[job.resolution] > MAX_BUDGET) {
        console.error(`Stopping: request/budget limit reached (${requests} requests, ~$${spent.toFixed(2)}).`);
        await writeManifest(manifest);
        process.exit(3);
      }
      requests++; spent += COST[job.resolution];
      const started = new Date().toISOString();
      try {
        console.log(`→ ${job.type}/${job.id} (attempt ${attempt + 1})`);
        const { mode, bytes } = await generate(job);
        const ext = sniffExt(bytes);
        if (!ext) throw new Error('response bytes are not a PNG/JPEG/WebP image');
        await fs.mkdir(path.join(SRC_DIR, job.type), { recursive: true });
        for (const old of ['png', 'jpg', 'webp']) await fs.rm(path.join(SRC_DIR, job.type, `${job.id}.${old}`), { force: true });
        const out = path.join(SRC_DIR, job.type, `${job.id}.${ext}`);
        await fs.writeFile(out, bytes);
        manifest.jobs[`${job.type}:${job.id}`] = {
          id: job.id, type: job.type, model: MODEL, mode, prompt: job.prompt, aspect_ratio: job.aspect,
          resolution: job.resolution, quality: job.quality, generatedAt: started,
          source: path.relative(ROOT, out), bytes: bytes.length, success: true,
        };
        await writeManifest(manifest);
        console.log(`  saved ${path.relative(ROOT, out)} (${(bytes.length / 1024).toFixed(0)} KB)`);
        done = true;
      } catch (e) {
        console.warn(`  failed: ${redact(e.message)}`);
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) break; // not retryable
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
    if (!done) {
      failed++;
      manifest.jobs[`${job.type}:${job.id}`] = { id: job.id, type: job.type, model: MODEL, prompt: job.prompt, generatedAt: new Date().toISOString(), success: false };
      await writeManifest(manifest);
    }
  }
  console.log(`Done: ${requests} request(s), ~$${spent.toFixed(2)} estimated, ${failed} failed.`);
  if (failed) process.exit(4);
}

main().catch((e) => { console.error(redact(e.stack || e.message)); process.exit(1); });
