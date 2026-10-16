// Every gameplay number lives here (spec §8.1: tune only this file). World units: the world is 600 tall.
// These are values defined for this HTML game, not measured from the original 斬るビル.

export const WORLD_H = 600;
export const GROUND_Y = 530; // the ground the hero stands on
export const HERO_HEIGHT = 62;
/**
 * Danger line: a building whose underside reaches the standing hero's head crushes them (one life).
 * v1 used the ground itself; v2 forbids the building visibly passing through the hero, so the line is the head.
 */
export const DANGER_Y = GROUND_Y - HERO_HEIGHT;
export const SPAWN_BOTTOM_Y = 85; // a new building's lowest floor never appears higher than this
/** …and never lower than this, so there is always room to react */
export const SPAWN_BOTTOM_MAX = 240;
/** share of a new building that should be on screen when it appears */
export const SPAWN_VISIBLE_SHARE = 0.8;
export const LANES = 3;

export const BALANCE = {
  lives: 3,
  // player
  laneMoveMs: 75, // lane slide animation
  laneRepeatMs: 130, // holding ←/→ moves one lane per this interval
  attackIntervalMs: 95, // v2: ~10.5 hits per second
  attackAnimMs: 90,
  heroHeight: HERO_HEIGHT,

  // falling building
  baseFallSpeed: 115, // units/s at tier 1
  hitPushUp: 7, // every successful hit nudges the building up
  fallCapFactor: 1.12, // speed never exceeds base * tier * this
  waveGapMs: 450, // name card between buildings
  countdownMs: 750, // 3 → 2 → 1
  hitFreezeMs: 120,
  invulnAfterHitMs: 1250,
  specialCutinMs: 650,

  // guard
  guardMax: 100,
  guardRegenPerSec: 18,
  guardRegenDelayMs: 250,
  ground: { cost: 30, keepsCombo: false },
  air: { cost: 18, keepsCombo: true, comboExtendMs: 450 },

  // combo / score / special
  comboWindowMs: 1500,
  hitScore: 10,
  floorScoreBase: 100,
  floorScorePerOrdinal: 5,
  buildingBonusBase: 500,
  buildingBonusPerTier: 100,
  buildingBonusPerFloor: 20,
  eliteBonus: 300,
  specialFloorFactor: 0.65,
  specialMax: 100,
  specialGainBase: 7,
  specialGainComboStep: 8, // +2 per this many combo, up to +8
  specialGainComboMax: 8,
  comboMilestones: [10, 25, 50, 100],

  eliteEvery: 5, // every 5th building is ELITE
  minFloorHeight: 18,
};

export const comboMultiplier = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.25);
export const specialGain = (combo: number) =>
  BALANCE.specialGainBase + Math.min(BALANCE.specialGainComboMax, Math.floor(combo / BALANCE.specialGainComboStep) * 2);

export interface Tier {
  tier: number;
  name: 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER' | 'EXTREME';
  minDestroyed: number;
  floors: [number, number];
  speed: number;
  weights: [number, number, number]; // HP1 / HP2 / HP3
  weakChance: number; // chance a floor is forced to contain an HP1 lane
  sameWeakLaneAllowed: number; // chance 3 floors in a row may keep the same weak lane
  allHardAllowed: boolean; // two all-HP3 floors in a row
}

export const TIERS: Tier[] = [
  { tier: 1, name: 'EASY', minDestroyed: 0, floors: [3, 5], speed: 1.0, weights: [65, 30, 5], weakChance: 1.0, sameWeakLaneAllowed: 0, allHardAllowed: false },
  { tier: 2, name: 'NORMAL', minDestroyed: 3, floors: [4, 7], speed: 1.2, weights: [50, 38, 12], weakChance: 0.9, sameWeakLaneAllowed: 0, allHardAllowed: false },
  { tier: 3, name: 'HARD', minDestroyed: 6, floors: [6, 9], speed: 1.4, weights: [35, 45, 20], weakChance: 0.7, sameWeakLaneAllowed: 0, allHardAllowed: false },
  { tier: 4, name: 'EXPERT', minDestroyed: 10, floors: [8, 12], speed: 1.7, weights: [25, 45, 30], weakChance: 0.45, sameWeakLaneAllowed: 0.25, allHardAllowed: false },
  { tier: 5, name: 'MASTER', minDestroyed: 15, floors: [10, 15], speed: 2.0, weights: [20, 40, 40], weakChance: 0.3, sameWeakLaneAllowed: 0.25, allHardAllowed: false },
  { tier: 6, name: 'EXTREME', minDestroyed: 20, floors: [12, 20], speed: 2.0, weights: [15, 35, 50], weakChance: 0.2, sameWeakLaneAllowed: 0.25, allHardAllowed: true },
];

/** Tier 6 speeds up from 2.0 by 0.05 every 3 buildings, capped at 2.4. */
export function speedMultiplier(destroyed: number) {
  const t = tierFor(destroyed);
  if (t.tier < 6) return t.speed;
  return 2.0 + Math.min(0.4, 0.05 * Math.floor((destroyed - 20) / 3));
}

export function tierFor(destroyed: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (destroyed >= x.minDestroyed) t = x;
  return t;
}
