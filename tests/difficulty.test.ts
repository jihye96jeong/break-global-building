import { describe, expect, it } from 'vitest';
import { speedMultiplier, tierFor, TIERS } from '../src/config/balance';
import { generateFloorHp, spawnBuilding } from '../src/core/building';
import { makeRng } from '../src/core/rng';

describe('difficulty (spec §8)', () => {
  it('T08 destroying the 3rd building moves Tier 1 → 2 with its floors, speed and HP mix', () => {
    expect(tierFor(2).tier).toBe(1);
    expect(tierFor(3).tier).toBe(2);
    const b2 = spawnBuilding(7, 3, 2, []), b3 = spawnBuilding(7, 4, 3, []);
    expect(b2.baseSpeed).toBeCloseTo(115);
    expect(b3.baseSpeed).toBeCloseTo(115 * 1.2);
    expect(b3.floors.length).toBeGreaterThanOrEqual(4);
    expect(b3.floors.length).toBeLessThanOrEqual(7);
  });

  it('T09 Tier 6 from 20 buildings, speed grows from 2.0 and never passes 2.4', () => {
    expect(tierFor(19).tier).toBe(5);
    expect(tierFor(20).tier).toBe(6);
    expect(speedMultiplier(20)).toBe(2.0);
    expect(speedMultiplier(23)).toBeCloseTo(2.05);
    expect(speedMultiplier(1000)).toBe(2.4);
  });

  it('tier boundaries match the table', () => {
    expect([0, 3, 6, 10, 15, 20].map((d) => tierFor(d).tier)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(TIERS.map((t) => t.floors)).toEqual([[3, 5], [4, 7], [6, 9], [8, 12], [10, 15], [12, 20]]);
  });

  it('tier 1 always offers a 1-hit weak spot on every floor', () => {
    for (let seed = 0; seed < 50; seed++) for (const hp of generateFloorHp(makeRng(seed), TIERS[0], 5)) expect(hp).toContain(1);
  });

  it('no two all-HP3 floors in a row below tier 6; the weak lane never repeats 3 floors in tiers 1–3', () => {
    for (let ti = 0; ti < 5; ti++) for (let seed = 0; seed < 80; seed++) {
      const floors = generateFloorHp(makeRng(seed * 31 + ti), TIERS[ti], 20);
      for (let i = 1; i < floors.length; i++) expect(floors[i - 1].every((h) => h === 3) && floors[i].every((h) => h === 3)).toBe(false);
      if (ti < 3) for (let i = 2; i < floors.length; i++) {
        const w = (h: number[]) => h.indexOf(Math.min(...h));
        expect(w(floors[i]) === w(floors[i - 1]) && w(floors[i]) === w(floors[i - 2])).toBe(false);
      }
    }
  });

  it('later tiers really are harder: more HP3 and more floors', () => {
    const share = (ti: number) => {
      let h3 = 0, n = 0;
      for (let seed = 0; seed < 60; seed++) for (const f of generateFloorHp(makeRng(seed), TIERS[ti], 10)) for (const h of f) { n++; if (h === 3) h3++; }
      return h3 / n;
    };
    expect(share(5)).toBeGreaterThan(share(2));
    expect(share(2)).toBeGreaterThan(share(0));
  });

  it('T26 every 5th building is ELITE with the tier maximum of floors', () => {
    for (const i of [5, 10, 15]) {
      const b = spawnBuilding(3, i, 0, []);
      expect(b.elite).toBe(true);
      expect(b.floors.length).toBe(tierFor(0).floors[1]);
    }
    expect(spawnBuilding(3, 4, 0, []).elite).toBe(false);
  });

  it('is reproducible from the run seed and never repeats the last two landmarks', () => {
    expect(spawnBuilding(42, 7, 4, []).floors.map((f) => f.initialHp)).toEqual(spawnBuilding(42, 7, 4, []).floors.map((f) => f.initialHp));
    for (let i = 1; i < 60; i++) {
      const b = spawnBuilding(9, i, 0, ['tokyo_tower', 'colosseum']);
      expect(['tokyo_tower', 'colosseum']).not.toContain(b.landmarkId);
    }
  });
});
