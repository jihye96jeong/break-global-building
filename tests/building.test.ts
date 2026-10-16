import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { LANDMARKS } from '../src/config/landmarks';
import { hitFloor, layoutFloors } from '../src/core/building';
import { attack, takeEvents } from '../src/core/game';
import { building, floor, playing } from './helpers';

describe('floor destruction (spec §5.2)', () => {
  it('T01 [1,2,3] left hit → the whole floor goes, the next floor is the lowest', () => {
    const f2 = floor([2, 2, 2], 2);
    const b = building([floor([1, 2, 3]), f2]);
    const r = hitFloor(b, 0);
    expect(r.kind).toBe('floor');
    expect(b.floors).toEqual([f2]);
  });

  it('T02/T03 [2,2,3] left hit → [1,2,3] stays; a second left hit removes the floor', () => {
    const f = floor([2, 2, 3]);
    const b = building([f, floor([3, 3, 3], 2)]);
    expect(hitFloor(b, 0).kind).toBe('damaged');
    expect(f.hp).toEqual([1, 2, 3]);
    expect(b.floors[0]).toBe(f);
    expect(hitFloor(b, 0).kind).toBe('floor');
    expect(b.floors[0]).not.toBe(f);
  });

  it('T04 [3,1,2] centre hit → the floor goes regardless of the other lanes', () => {
    const b = building([floor([3, 1, 2]), floor([3, 3, 3], 2)]);
    expect(hitFloor(b, 1).kind).toBe('floor');
    expect(b.floors).toHaveLength(1);
  });

  it('T06 removing a floor lifts bottomY by exactly that floor height (plus the hit nudge)', () => {
    const b = building([floor([1, 1, 1], 1, 37), floor([2, 2, 2], 2)], 300);
    hitFloor(b, 2);
    expect(b.bottomY).toBe(300 - BALANCE.hitPushUp - 37);
  });

  it('T05 a duplicate attack in the same frame does not score or remove twice', () => {
    const s = playing(building([floor([2, 1, 2]), floor([2, 2, 2], 2), floor([2, 2, 2], 3)])); // player starts in the centre lane
    expect(attack(s)).toBe(true);
    const score = s.score, floors = s.building!.floors.length;
    expect(attack(s)).toBe(false); // still on cooldown
    expect(s.score).toBe(score);
    expect(s.building!.floors.length).toBe(floors);
    expect(takeEvents(s).filter((e) => e.t === 'floor')).toHaveLength(1);
  });

  it('T07 the last floor clears the building once and starts the next wave', () => {
    const s = playing(building([floor([3, 1, 3])]));
    attack(s);
    const ev = takeEvents(s);
    expect(ev.filter((e) => e.t === 'building')).toHaveLength(1);
    expect(s.destroyedBuildings).toBe(1);
    expect(s.phase).toBe('PLAYING');
    expect(s.building!.id).not.toBe('test');
  });
});

describe('landmark floor layout', () => {
  it('every landmark splits into the requested number of floors that exactly cover the art', () => {
    for (const l of LANDMARKS) for (const n of [3, 5, 9, 12, 20]) {
      const fl = layoutFloors(l, n);
      expect(fl).toHaveLength(n);
      expect(fl[0].v0).toBe(0);
      expect(fl[n - 1].v1).toBeCloseTo(1);
      for (let i = 1; i < n; i++) expect(fl[i].v0).toBeCloseTo(fl[i - 1].v1);
      for (const f of fl) expect(f.height).toBeGreaterThanOrEqual(BALANCE.minFloorHeight - 1e-9);
    }
  });
  it('has at least 12 landmarks including Gyeongbokgung, Lotte World Tower and Burj Khalifa', () => {
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(12);
    for (const id of ['gyeongbokgung', 'lotte_world_tower', 'burj_khalifa']) expect(LANDMARKS.some((l) => l.id === id)).toBe(true);
  });
});
