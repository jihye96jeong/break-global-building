import type { FallingBuilding, Floor, HP } from '../src/core/building';
import { newRun, type RunState } from '../src/core/game';

export function floor(hp: [HP, HP, HP], ordinal = 1, height = 40): Floor {
  return { id: `f${ordinal}-${Math.random()}`, ordinal, hp: [...hp] as [HP, HP, HP], initialHp: hp as [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3], height, v0: 0, v1: 1, segment: 's' };
}

export function building(floors: Floor[], bottomY = 200): FallingBuilding {
  return { id: 'test', index: 1, landmarkId: 'gyeongbokgung', floors, originalFloorCount: floors.length, totalHeight: floors.reduce((a, f) => a + f.height, 0), bottomY,
    baseSpeed: 115, velocityY: 115, tier: 1, elite: false, defeated: false };
}

/** A run already PLAYING against the given building. */
export function playing(b: FallingBuilding, seed = 1): RunState {
  const s = newRun(seed);
  s.phase = 'PLAYING';
  s.building = b;
  s.buildingIndex = 1;
  return s;
}
