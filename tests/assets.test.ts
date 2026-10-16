import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/config/landmarks';
import { NINJA_SPRITES } from '../src/render/character';

const pub = (p: string) => path.join(__dirname, '..', 'public', p);

describe('static assets (spec §10)', () => {
  it('every landmark, background and ninja pose is a local file (never a remote URL)', () => {
    for (const src of [...LANDMARKS.flatMap((l) => [l.asset, l.background]), ...Object.values(NINJA_SPRITES), 'assets/fx/special_cutin.webp']) {
      expect(src).toMatch(/^assets\//);
      expect(fs.existsSync(pub(src)), src).toBe(true);
    }
  });

  it('game code never calls an AI API or reads a key', () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(path.join(__dirname, '..', 'src'))) {
      const s = fs.readFileSync(f, 'utf8');
      for (const bad of ['api.x.ai', 'XAI_API_KEY', 'images/generations', 'grok-imagine']) expect(s.includes(bad), `${f} contains ${bad}`).toBe(false);
    }
  });
});
