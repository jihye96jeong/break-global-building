import { describe, expect, it } from 'vitest';
import { GAME_CONFIG as C } from '../src/game/config';
import { comboGaugeBoost, comboMultiplier, ScoreManager } from '../src/game/ScoreManager';

describe('score', () => {
  it('a broken piece is worth 100 x combo x stage multiplier', () => {
    const s = new ScoreManager();
    expect(s.registerHit(0, true, 1)).toBe(100);
    expect(s.registerHit(100, false, 1.5)).toBe(30); // crack only: +20 x 1.5
  });

  it('combo builds within 1.5 s and the multiplier is capped at 3', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.25);
    expect(comboMultiplier(1000)).toBe(3);
    const s = new ScoreManager();
    s.registerHit(0, true, 1);
    s.registerHit(1000, true, 1);
    expect(s.combo).toBe(2);
    s.registerHit(1000 + C.comboWindowMs + 1, true, 1);
    expect(s.combo).toBe(1);
    s.update(5000);
    expect(s.combo).toBe(0);
  });
});

describe('super gauge', () => {
  it('+8 per real hit, capped at 100, empty after use, kept between stages', () => {
    const s = new ScoreManager();
    s.registerHit(0, true, 1);
    expect(s.gauge).toBe(8);
    for (let i = 0; i < 20; i++) s.registerHit(i * 100, true, 1);
    expect(s.gauge).toBe(100);
    s.startStage();
    expect(s.gauge).toBe(100);
    expect(s.useUltimate()).toBe(true);
    expect(s.gauge).toBe(0);
    expect(s.useUltimate()).toBe(false);
  });

  it('13 separate hits fill the gauge; combos fill it much faster', () => {
    const s = new ScoreManager();
    for (let i = 0; i < 12; i++) s.registerHit(i * 2000, true, 1); // 2 s apart: no combo
    expect(s.gaugeFull).toBe(false);
    s.registerHit(12 * 2000, true, 1);
    expect(s.gaugeFull).toBe(true);
    const c = new ScoreManager();
    let hits = 0;
    while (!c.gaugeFull) c.registerHit(hits++ * 100, true, 1); // one long combo
    expect(hits).toBeLessThan(13);
    expect(comboGaugeBoost(4)).toBe(1);
    expect(comboGaugeBoost(10)).toBe(2);
    expect(comboGaugeBoost(99)).toBe(3);
  });
});

describe('lives', () => {
  it('one life per hit, no loss while invulnerable, dead at 0', () => {
    const s = new ScoreManager();
    expect(s.takeHit(0)).toBe(true);
    expect(s.lives).toBe(2);
    expect(s.takeHit(500)).toBe(false); // inside 1.25 s
    expect(s.lives).toBe(2);
    expect(s.takeHit(1300)).toBe(true);
    expect(s.takeHit(2600)).toBe(true);
    expect(s.dead).toBe(true);
    expect(s.takeHit(9000)).toBe(false);
    expect(s.lives).toBe(0);
  });

  it('a new game resets lives, score and gauge', () => {
    const s = new ScoreManager();
    s.registerHit(0, true, 1); s.takeHit(0);
    s.reset();
    expect([s.lives, s.score, s.gauge, s.combo]).toEqual([3, 0, 0, 0]);
  });
});
