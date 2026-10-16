// v5 §10.2: one story wave → one falling building. Seeded and reproducible; generated once per level attempt and
// reused if the same wave has to come again, so a retry can never roll a harder building by luck.
import { BALANCE } from '../config/balance';
import { landmarkById } from '../config/landmarks';
import { layoutFloors, spawnBottom, type FallingBuilding, type Floor, type HP } from '../core/building';
import { hashString, makeRng, type Rng } from '../core/rng';
import { resolveStageFallSpeed, type StoryStage } from './stages';

type Lanes = [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3];

function weighted(rng: Rng, w: [number, number, number]): 1 | 2 | 3 {
  const r = rng.next() * (w[0] + w[1] + w[2]);
  return r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
}
const weakLanes = (hp: number[]) => [0, 1, 2].filter((i) => hp[i] === 1);
const allHard = (hp: number[]) => hp.every((h) => h === 3);

/**
 * HP for every floor, bottom → top (v5 §6.2): roll each lane from the level's weights, then make EXACTLY enough floors
 * carry an HP1 weak lane (at least ceil(n × guarantee)), then remove unfair patterns.
 */
export function generateStageFloorHp(rng: Rng, stage: StoryStage, count: number): Lanes[] {
  const out: Lanes[] = [];
  for (let i = 0; i < count; i++) out.push([0, 1, 2].map(() => weighted(rng, stage.hpWeights)) as Lanes);
  // weak-floor guarantee: add HP1 lanes to random weak-less floors until the minimum is met
  const need = Math.ceil(count * stage.weakFloorGuarantee);
  let have = out.filter((hp) => hp.includes(1)).length;
  const order = out.map((_, i) => i).sort(() => rng.next() - 0.5);
  for (const i of order) {
    if (have >= need) break;
    if (!out[i].includes(1)) { out[i][Math.floor(rng.next() * 3)] = 1; have++; }
  }
  for (let i = 0; i < count; i++) {
    const hp = out[i], prev = out[i - 1], prev2 = out[i - 2];
    // never two all-HP3 floors in a row, at any level
    if (prev && allHard(prev) && allHard(hp)) (hp as number[])[Math.floor(rng.next() * 3)] = 2;
    // levels 1–4: no weak spot ping-ponging between the far left and far right for 3 floors in a row
    if (stage.level <= 4 && prev && prev2) {
      const ends = (h: number[]) => { const w = weakLanes(h); return w.length === 1 && w[0] !== 1 ? w[0] : -1; };
      const a = ends(prev2), b = ends(prev), c = ends(hp);
      if (a >= 0 && b >= 0 && c >= 0 && a !== b && b !== c) {
        // put this floor's weak spot in the centre instead
        (hp as number[])[c] = 2; hp[1] = 1;
      }
    }
  }
  return out;
}

export interface StoryWave { building: FallingBuilding }

/** Build wave `waveIndex` (0-based) of `stage` for this attempt. */
export function createStoryWave(stage: StoryStage, waveIndex: number, attemptSeed: number, previousLandmark?: string): FallingBuilding {
  if (waveIndex < 0 || waveIndex >= stage.waveCount) throw new Error(`wave ${waveIndex} out of range for level ${stage.level}`);
  const rng = makeRng(hashString(`story:${stage.level}:${waveIndex}:${attemptSeed}`));
  const last = waveIndex === stage.waveCount - 1;
  let id: string;
  if (last && stage.finalWaveLandmark) id = stage.finalWaveLandmark;
  else {
    const pool = stage.landmarkPool.filter((l) => l !== previousLandmark && l !== stage.finalWaveLandmark);
    id = rng.pick(pool.length ? pool : stage.landmarkPool);
  }
  const landmark = landmarkById(id);
  const [lo, hi] = stage.floorsRange;
  const count = last ? hi : lo + Math.floor(rng.next() * (hi - lo + 1)); // the last building of a level is the tallest
  const hps = generateStageFloorHp(rng, stage, count);
  const layout = layoutFloors(landmark, count);
  const tag = `L${stage.level}W${waveIndex + 1}`;
  const floors: Floor[] = layout.map((l, i) => ({
    id: `${tag}-f${i + 1}`, ordinal: i + 1, hp: [...hps[i]] as [HP, HP, HP], initialHp: hps[i],
    height: l.height, v0: l.v0, v1: l.v1, segment: l.segment,
  }));
  const speed = resolveStageFallSpeed(stage, waveIndex);
  const ttc = (stage.ttcTarget[0] + stage.ttcTarget[1]) / 2;
  return {
    id: tag, index: waveIndex + 1, landmarkId: id, floors, originalFloorCount: count,
    totalHeight: floors.reduce((a, f) => a + f.height, 0),
    bottomY: spawnBottom(speed, ttc), baseSpeed: speed, velocityY: speed,
    tier: stage.level, elite: last && stage.finalIntro, defeated: false, pressure: stage.pressure,
  };
}

/** All waves of one attempt, generated up front (v5 §10.2). */
export function createStageWaves(stage: StoryStage, attemptSeed: number): FallingBuilding[] {
  const out: FallingBuilding[] = [];
  for (let w = 0; w < stage.waveCount; w++) out.push(createStoryWave(stage, w, attemptSeed, out[w - 1]?.landmarkId));
  return out;
}

/** A fresh, independent copy of a pre-generated wave (the same wave can come again after a crush). */
export function cloneWave(b: FallingBuilding, instance: number): FallingBuilding {
  const c: FallingBuilding = JSON.parse(JSON.stringify(b));
  if (instance > 0) { c.id = `${b.id}#${instance}`; c.floors.forEach((f) => { f.id = `${f.id}#${instance}`; }); }
  return c;
}

export const MIN_FLOOR = BALANCE.minFloorHeight;
