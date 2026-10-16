// Falling buildings: floors × 3 lanes of HP. One lane reaching 0 destroys the whole floor (spec §5).
import { BALANCE, fallSpeedFor, GROUND_Y, HERO_HEIGHT, LANES, SPAWN_BOTTOM_MAX, SPAWN_BOTTOM_Y, tierFor, type Tier } from '../config/balance';
import { GUARD_FEEL } from '../config/gameFeel';
import { LANDMARKS, type Landmark } from '../config/landmarks';
import { hashString, makeRng, type Rng } from './rng';

export type Lane = 0 | 1 | 2;
export type HP = 0 | 1 | 2 | 3;

export interface Floor {
  id: string;
  ordinal: number; // 1 = the lowest floor at spawn
  hp: [HP, HP, HP];
  initialHp: [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3];
  height: number; // fixed at spawn, never recomputed
  /** which slice of the art this floor shows: fractions of the image height measured from the bottom */
  v0: number;
  v1: number;
  segment: string;
}

export interface FallingBuilding {
  id: string;
  index: number; // 1-based spawn number in this run
  landmarkId: string;
  floors: Floor[]; // [0] = current lowest floor
  originalFloorCount: number;
  /** height of all floors at spawn; the art keeps this size while floors are cut away below */
  totalHeight: number;
  bottomY: number;
  baseSpeed: number;
  velocityY: number;
  /** post-floor-break fast settle onto the blade (ms left) */
  settleMs?: number;
  /** v5 difficulty: after a hit the building creeps down at the pressure speed for this long (ms) */
  pressMs?: number;
  /** story levels set the creep speed while struck (wu/s); endless derives it from the fall speed */
  pressure?: number;
  /** v4: crushed or specialled — no more collision, hits or guards against it */
  collisionDisabled?: boolean;
  tier: number;
  elite: boolean;
  defeated: boolean;
}

/** Deterministic per-building randomness: same run seed + building number → same building. */
export function buildingRng(runSeed: number, buildingIndex: number): Rng {
  return makeRng(hashString(`${runSeed}:${buildingIndex}`));
}

export function pickLandmark(rng: Rng, recent: string[]): Landmark {
  const pool = LANDMARKS.filter((l) => !l.basic && !recent.slice(-2).includes(l.id));
  return pool[Math.floor(rng.next() * pool.length)];
}

function weightedHp(rng: Rng, w: [number, number, number]): 1 | 2 | 3 {
  const r = rng.next() * (w[0] + w[1] + w[2]);
  return r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
}

const weakLane = (hp: number[]) => hp.indexOf(Math.min(...hp));

/** HP for every floor, bottom → top, with the spec's fairness corrections. */
export function generateFloorHp(rng: Rng, tier: Tier, count: number): [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3][] {
  const out: [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3][] = [];
  for (let i = 0; i < count; i++) {
    const hp = [0, 1, 2].map(() => weightedHp(rng, tier.weights)) as [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3];
    if (rng.next() < tier.weakChance && !hp.includes(1)) hp[Math.floor(rng.next() * 3)] = 1;
    const prev = out[i - 1], prev2 = out[i - 2];
    // never two all-HP3 floors in a row outside the extreme tier
    if (!tier.allHardAllowed && prev && prev.every((h) => h === 3) && hp.every((h) => h === 3)) (hp as number[])[Math.floor(rng.next() * 3)] = 2;
    // the weak lane should not stay in the same place for 3 floors in a row
    if (prev && prev2 && weakLane(prev) === weakLane(prev2) && weakLane(hp) === weakLane(prev) && rng.next() >= tier.sameWeakLaneAllowed) {
      // move the weak spot to another lane
      const w = weakLane(hp);
      const other = ((w + 1 + Math.floor(rng.next() * 2)) % 3) as 0 | 1 | 2;
      hp[other] = 1;
      hp[w] = Math.max(hp[w], 2) as 1 | 2 | 3;
    }
    out.push(hp);
  }
  return out;
}

/**
 * Split the landmark's visual height into `count` floors. Floors are spread over the landmark's segments
 * (roof, columns, base …) in proportion to their height ratio, so each floor shows a real part of the art.
 */
export function layoutFloors(landmark: Landmark, count: number) {
  const total = Math.max(landmark.displayHeight, count * BALANCE.minFloorHeight);
  const segs = landmark.segments;
  const per = segs.map((s) => s.heightRatio * count);
  const alloc = per.map((p) => Math.max(count >= segs.length ? 1 : 0, Math.floor(p)));
  while (alloc.reduce((a, b) => a + b, 0) < count) {
    let best = 0, bestGap = -Infinity;
    per.forEach((p, i) => { if (p - alloc[i] > bestGap) { bestGap = p - alloc[i]; best = i; } });
    alloc[best]++;
  }
  while (alloc.reduce((a, b) => a + b, 0) > count) alloc[alloc.indexOf(Math.max(...alloc))]--;
  const out: { height: number; v0: number; v1: number; segment: string }[] = [];
  let v = 0;
  segs.forEach((s, i) => {
    const n = alloc[i];
    if (!n) { v += s.heightRatio; return; }
    for (let k = 0; k < n; k++) {
      const frac = s.heightRatio / n;
      out.push({ height: total * frac, v0: v, v1: v + frac, segment: s.key });
      v += frac;
    }
  });
  // segments skipped because there were fewer floors than segments: stretch the last floor to the top
  if (out.length) out[out.length - 1].v1 = 1;
  const sum = out.reduce((a, f) => a + f.height, 0);
  for (const f of out) f.height *= total / sum;
  // no floor thinner than the minimum: lift small ones, take the difference from the tall ones
  for (let pass = 0; pass < 4; pass++) {
    const small = out.filter((f) => f.height < BALANCE.minFloorHeight);
    if (!small.length) break;
    const need = small.reduce((a, f) => a + BALANCE.minFloorHeight - f.height, 0);
    for (const f of small) f.height = BALANCE.minFloorHeight;
    const big = out.filter((f) => f.height > BALANCE.minFloorHeight);
    const spare = big.reduce((a, f) => a + f.height - BALANCE.minFloorHeight, 0);
    for (const f of big) f.height -= need * ((f.height - BALANCE.minFloorHeight) / spare);
  }
  return out;
}

/** Where a building of this height appears: mostly on screen, but never too close to the ground. */
/**
 * v4 §4.3: spawn so the underside reaches a standing hero's guard blade after the tier's target time-to-contact
 * (≈1.9 s at tier 1 down to ≈0.6 s at tier 6), kept on screen.
 */
export function spawnBottom(fallSpeed: number, ttc: number) {
  const guardY = GROUND_Y - HERO_HEIGHT - GUARD_FEEL.guardReachAboveHead;
  return Math.min(SPAWN_BOTTOM_MAX, Math.max(SPAWN_BOTTOM_Y, guardY - fallSpeed * ttc));
}

export function spawnBuilding(runSeed: number, index: number, destroyed: number, recent: string[]): FallingBuilding {
  const rng = buildingRng(runSeed, index);
  const tier = tierFor(destroyed);
  const elite = index % BALANCE.eliteEvery === 0;
  const landmark = pickLandmark(rng, recent);
  const [lo, hi] = tier.floors;
  const count = elite ? hi : lo + Math.floor(rng.next() * (hi - lo + 1));
  const hps = generateFloorHp(rng, tier, count);
  const layout = layoutFloors(landmark, count);
  const floors: Floor[] = layout.map((l, i) => ({
    id: `b${index}-f${i + 1}`, ordinal: i + 1, hp: [...hps[i]] as [HP, HP, HP], initialHp: hps[i],
    height: l.height, v0: l.v0, v1: l.v1, segment: l.segment,
  }));
  const speed = fallSpeedFor(destroyed);
  return {
    id: `b${index}`, index, landmarkId: landmark.id, floors, originalFloorCount: count,
    totalHeight: floors.reduce((a, f) => a + f.height, 0),
    bottomY: spawnBottom(speed, tier.ttc), baseSpeed: speed, velocityY: speed, tier: tier.tier, elite, defeated: false,
  };
}

/** World y of the top of the building (its upper floors never move when a floor is cut from below). */
export const buildingTopY = (b: FallingBuilding) => b.bottomY - b.floors.reduce((a, f) => a + f.height, 0);

export type HitResult = { kind: 'none' } | { kind: 'damaged'; floor: Floor; lane: Lane } | { kind: 'floor'; floor: Floor; lane: Lane; buildingCleared: boolean };

/** One sword hit on the current lowest floor at `lane` (spec §5.2). */
export function hitFloor(b: FallingBuilding, lane: Lane): HitResult {
  if (b.defeated) return { kind: 'none' };
  const floor = b.floors[0];
  if (!floor || floor.hp[lane] <= 0) return { kind: 'none' };
  floor.hp[lane] = (floor.hp[lane] - 1) as HP;
  b.bottomY -= BALANCE.hitPushUp;
  if (floor.hp[lane] > 0) return { kind: 'damaged', floor, lane };
  // one lane at 0 → the WHOLE floor goes, whatever HP the other lanes had
  b.floors.shift();
  b.bottomY -= floor.height;
  const buildingCleared = b.floors.length === 0;
  if (buildingCleared) b.defeated = true;
  return { kind: 'floor', floor, lane, buildingCleared };
}

export { LANES };
