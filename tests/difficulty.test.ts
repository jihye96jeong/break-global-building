import { describe, expect, it } from 'vitest';
import { fallSpeedFor, tierFor, TIERS } from '../src/config/balance';
import { generateFloorHp, spawnBuilding } from '../src/core/building';
import { makeRng } from '../src/core/rng';

describe('difficulty (spec §8)', () => {
  it('T08 destroying the 3rd building moves Tier 1 → 2 with its floors, speed and HP mix', () => {
    expect(tierFor(2).tier).toBe(1);
    expect(tierFor(3).tier).toBe(2);
    const b2 = spawnBuilding(7, 3, 2, []), b3 = spawnBuilding(7, 4, 3, []);
    expect(b2.baseSpeed).toBe(190); // v4 absolute speeds
    expect(b3.baseSpeed).toBe(240);
    expect(b3.floors.length).toBeGreaterThanOrEqual(4);
    expect(b3.floors.length).toBeLessThanOrEqual(7);
  });

  it('T09 / v4 §4.2 absolute fall speeds 190 → 240 → 300 → 390 → 490 → 600, tier 6 capped at 650, never multiplied twice', () => {
    expect(tierFor(19).tier).toBe(5);
    expect(tierFor(20).tier).toBe(6);
    expect([0, 2, 3, 5, 6, 9, 10, 14, 15, 19, 20].map(fallSpeedFor)).toEqual([190, 190, 240, 240, 300, 300, 390, 390, 490, 490, 600]);
    expect(fallSpeedFor(23)).toBe(630);
    expect(fallSpeedFor(1000)).toBe(650);
    for (const d of [0, 3, 6, 10, 15, 20, 40]) expect(spawnBuilding(5, 9, d, []).baseSpeed).toBe(fallSpeedFor(d));
  });

  it('v4 §4.3 spawn → first guard contact time (TTC) is inside each tier band', () => {
    const band: Record<number, [number, number]> = { 1: [1.6, 2.3], 2: [1.1, 1.7], 3: [1.1, 1.7], 4: [0.75, 1.2], 5: [0.75, 1.2], 6: [0.5, 0.8] };
    for (const d of [0, 2, 3, 6, 9, 10, 15, 19, 20, 25, 60]) for (let i = 1; i < 30; i++) {
      const b = spawnBuilding(11, i, d, []);
      const ttc = (530 - 62 - 8 - b.bottomY) / b.baseSpeed;
      const [lo, hi] = band[b.tier];
      expect(ttc).toBeGreaterThanOrEqual(lo - 0.03);
      expect(ttc).toBeLessThanOrEqual(hi);
    }
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

  it('new buildings appear mostly on screen, between y=85 and y=240', () => {
    for (let i = 1; i < 40; i++) {
      const b = spawnBuilding(5, i, i, []);
      expect(b.bottomY).toBeGreaterThanOrEqual(85);
      expect(b.bottomY).toBeLessThanOrEqual(240);
    }
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
