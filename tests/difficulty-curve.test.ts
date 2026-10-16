// v5 difficulty curve: three bots play the real generated story levels (seeded) through the real game core.
import { describe, it } from 'vitest';
import { GROUND_Y, HERO_HEIGHT } from '../src/config/balance';
import { expect } from 'vitest';
import { newRun, NO_INPUT, startStoryRun, takeEvents, tick } from '../src/core/game';

function play(level: number, seed: number, useGuard: boolean, naive = false) {
  const s = newRun(seed);
  startStoryRun(s, level, seed);
  let guardHold = 0;
  for (let t = 0; t < 180 && s.phase !== 'GAME_OVER'; t += 1 / 60) {
    const b = s.building, p = s.player;
    let input = { ...NO_INPUT };
    if (s.phase === 'BURIED') input = { ...NO_INPUT, attack: true, attackPressed: true };
    else if (b && b.floors[0] && s.phase === 'PLAYING') {
      const hp: number[] = b.floors[0].hp, weak = hp.indexOf(Math.min(...hp));
      const gapHead = GROUND_Y - HERO_HEIGHT - b.bottomY;
      const move = !naive && gapHead > 60 && hp[weak] < hp[p.lane];
      // guard bot: brace when the building has sunk most of the way to the head and this lane still needs ≥2 hits
      if (useGuard && s.guardPhase === 'OFF' && (b.pressMs ?? 0) > 0 && gapHead < Math.max(4, (b.pressure ?? 0) * 0.1)) guardHold = 6; // would be crushed before the next swing
      const g = guardHold-- > 0;
      input = { ...NO_INPUT, attack: !g, left: move && weak < p.lane, right: move && weak > p.lane, guard: g, guardPressed: g };
    }
    tick(s, 1 / 60, input);
    takeEvents(s);
  }
  return s;
}
const result = (level: number, guard: boolean, naive: boolean, seeds = 4) => {
  let clears = 0, lives = 0;
  for (let seed = 1; seed <= seeds; seed++) { const s = play(level, seed, guard, naive); if (s.story!.wavesCleared >= s.story!.waveCount) clears++; lives += s.lives; }
  return { clears, lives };
};

describe('v5 difficulty curve (bots playing the real generated levels)', () => {
  it('levels 1–3: even standing in the centre and holding Z clears without damage', () => {
    for (const l of [1, 2, 3]) expect(result(l, false, true)).toEqual({ clears: 4, lives: 12 });
  });
  it('levels 9–10: holding Z alone is not enough — it loses lives and stages', () => {
    for (const l of [9, 10]) { const r = result(l, false, false); expect(r.lives).toBeLessThan(12); }
    expect(result(10, false, true).clears).toBeLessThan(4);
  });
  it('levels 9–10: a skilled route exists — guard when the next swing would come too late, then keep cutting', () => {
    for (const l of [9, 10]) expect(result(l, true, false)).toEqual({ clears: 4, lives: 12 });
  });
});
