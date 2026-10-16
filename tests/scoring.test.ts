import { describe, expect, it } from 'vitest';
import { comboMultiplier, specialGain } from '../src/config/balance';
import { attack } from '../src/core/game';
import { building, floor, playing } from './helpers';

describe('score formulas (spec §7.2)', () => {
  it('combo multiplier and special gain follow the spec', () => {
    expect([0, 4, 5, 10, 40, 999].map(comboMultiplier)).toEqual([1, 1, 1.25, 1.5, 3, 3]);
    expect([1, 8, 16, 32, 99].map(specialGain)).toEqual([7, 9, 11, 15, 15]);
  });
  it('a 1-hit floor pays hit + floor score', () => {
    const s = playing(building([floor([2, 1, 2], 3), floor([2, 2, 2], 4)])); // centre lane
    attack(s);
    expect(s.score).toBe(10 + (100 + 3 * 5));
  });
});
