// The whole run as plain data plus a fixed-step tick. No DOM, no canvas, no timers: input arrives as intents,
// output leaves as events the renderer and audio consume. Spec §3.2 (phases), §4–§8.
import { BALANCE, comboMultiplier, GROUND_Y, specialGain, tierFor } from '../config/balance';
import { hitFloor, spawnBuilding, type FallingBuilding, type Floor, type Lane } from './building';

export type Phase = 'BOOT' | 'TITLE' | 'COUNTDOWN' | 'PLAYING' | 'HIT_FREEZE' | 'PAUSED' | 'GAME_OVER' | 'SPECIAL_CUTIN' | 'WAVE_TRANSITION';

export interface Intents {
  left: boolean; leftPressed: boolean;
  right: boolean; rightPressed: boolean;
  attack: boolean; attackPressed: boolean;
  jumpPressed: boolean;
  guard: boolean; guardPressed: boolean;
  specialPressed: boolean; // a new key/finger press only: holding X never fires the special
  laneTo?: Lane; // touch: tap a lane to go straight there
}
export const NO_INPUT: Intents = {
  left: false, leftPressed: false, right: false, rightPressed: false, attack: false, attackPressed: false,
  jumpPressed: false, guard: false, guardPressed: false, specialPressed: false,
};

export type GameEvent =
  | { t: 'hit'; lane: Lane; floor: Floor; score: number; hpLeft: number }
  | { t: 'whiff'; lane: Lane }
  | { t: 'floor'; lane: Lane; floor: Floor; score: number; bottomY: number; landmarkId: string }
  | { t: 'building'; building: FallingBuilding; bonus: number; elite: boolean }
  | { t: 'guard'; kind: 'ground' | 'air'; comboKept: boolean }
  | { t: 'guardBreak' }
  | { t: 'lifeLost'; livesLeft: number }
  | { t: 'special'; floors: Floor[]; bottomY: number; landmarkId: string; score: number }
  | { t: 'specialReady' }
  | { t: 'combo'; combo: number }
  | { t: 'jump' }
  | { t: 'wave'; building: FallingBuilding }
  | { t: 'countdown'; n: number }
  | { t: 'gameOver'; score: number };

export interface PlayerState {
  lane: Lane;
  laneFrom: Lane;
  laneAnimMs: number; // remaining slide time
  y: number; // height above the ground (up is +)
  vy: number;
  facing: 1 | -1;
  attackCooldownMs: number;
  attackAnimMs: number;
  bufferedAttackMs: number;
  moveRepeatMs: number;
  guardWindowMs: number;
  guarding: boolean;
}

export interface RunState {
  phase: Phase;
  pausedFrom: Phase | null;
  phaseMs: number; // time left in a timed phase
  timeMs: number; // game time, stops while paused
  seed: number;
  buildingIndex: number;
  destroyedBuildings: number;
  recentLandmarks: string[];
  building: FallingBuilding | null;
  lives: number;
  score: number;
  combo: number;
  comboMs: number;
  maxCombo: number;
  special: number;
  guard: number;
  guardRegenDelayMs: number;
  guardContactCooldownMs: number;
  speedRecoverMs: number;
  invulnMs: number;
  player: PlayerState;
  events: GameEvent[];
  countdown: number;
}

export function newPlayer(): PlayerState {
  return { lane: 1, laneFrom: 1, laneAnimMs: 0, y: 0, vy: 0, facing: 1, attackCooldownMs: 0, attackAnimMs: 0,
    bufferedAttackMs: 0, moveRepeatMs: 0, guardWindowMs: 0, guarding: false };
}

export function newRun(seed: number): RunState {
  return {
    phase: 'TITLE', pausedFrom: null, phaseMs: 0, timeMs: 0, seed, buildingIndex: 0, destroyedBuildings: 0,
    recentLandmarks: [], building: null, lives: BALANCE.lives, score: 0, combo: 0, comboMs: 0, maxCombo: 0,
    special: 0, guard: BALANCE.guardMax, guardRegenDelayMs: 0, guardContactCooldownMs: 0, speedRecoverMs: 0, invulnMs: 0,
    player: newPlayer(), events: [], countdown: 3,
  };
}

/** Title → countdown → first building. Everything except best scores is reset (T28). */
export function startRun(s: RunState, seed = s.seed) {
  Object.assign(s, newRun(seed));
  s.phase = 'COUNTDOWN';
  s.phaseMs = BALANCE.countdownMs;
  s.countdown = 3;
  s.events.push({ t: 'countdown', n: 3 });
}

export function pause(s: RunState) {
  if (s.phase === 'PAUSED' || s.phase === 'TITLE' || s.phase === 'GAME_OVER' || s.phase === 'BOOT') return;
  s.pausedFrom = s.phase;
  s.phase = 'PAUSED';
}
export function resume(s: RunState) {
  if (s.phase !== 'PAUSED' || !s.pausedFrom) return;
  s.phase = s.pausedFrom;
  s.pausedFrom = null;
}

export const tierOf = (s: RunState) => tierFor(s.destroyedBuildings);
export const isAirborne = (s: RunState) => s.player.y > 0;

function nextBuilding(s: RunState) {
  s.buildingIndex += 1;
  const b = spawnBuilding(s.seed, s.buildingIndex, s.destroyedBuildings, s.recentLandmarks);
  s.recentLandmarks = [...s.recentLandmarks, b.landmarkId].slice(-2);
  s.building = b;
  s.speedRecoverMs = 0;
  s.phase = 'WAVE_TRANSITION';
  s.phaseMs = BALANCE.waveGapMs;
  s.events.push({ t: 'wave', building: b });
}

function addScore(s: RunState, n: number) {
  const v = Math.round(n);
  s.score += v;
  return v;
}

function breakCombo(s: RunState) { s.combo = 0; s.comboMs = 0; }

function onSuccessfulHit(s: RunState) {
  s.combo += 1;
  s.comboMs = BALANCE.comboWindowMs;
  if (s.combo > s.maxCombo) s.maxCombo = s.combo;
  if (BALANCE.comboMilestones.includes(s.combo)) s.events.push({ t: 'combo', combo: s.combo });
  const wasFull = s.special >= BALANCE.specialMax;
  s.special = Math.min(BALANCE.specialMax, s.special + specialGain(s.combo));
  if (!wasFull && s.special >= BALANCE.specialMax) s.events.push({ t: 'specialReady' });
  return addScore(s, BALANCE.hitScore * comboMultiplier(s.combo));
}

const floorScore = (f: Floor, combo: number) => (BALANCE.floorScoreBase + f.ordinal * BALANCE.floorScorePerOrdinal) * comboMultiplier(combo);

function buildingCleared(s: RunState, b: FallingBuilding) {
  const bonus = BALANCE.buildingBonusBase + b.tier * BALANCE.buildingBonusPerTier + b.originalFloorCount * BALANCE.buildingBonusPerFloor
    + (b.elite ? BALANCE.eliteBonus : 0);
  addScore(s, bonus);
  s.destroyedBuildings += 1;
  s.events.push({ t: 'building', building: b, bonus, elite: b.elite });
}

/** One sword swing (spec §5.2). The hit lands on the logical lane at the moment of the swing. */
export function attack(s: RunState) {
  const p = s.player;
  if (s.phase !== 'PLAYING' || p.attackCooldownMs > 0) return false;
  p.attackCooldownMs = BALANCE.attackIntervalMs;
  p.attackAnimMs = BALANCE.attackAnimMs;
  const b = s.building;
  if (!b || b.defeated) { s.events.push({ t: 'whiff', lane: p.lane }); return true; }
  const lane = p.lane;
  const r = hitFloor(b, lane);
  if (r.kind === 'none') { s.events.push({ t: 'whiff', lane }); return true; }
  const score = onSuccessfulHit(s);
  if (r.kind === 'damaged') {
    s.events.push({ t: 'hit', lane, floor: r.floor, score, hpLeft: r.floor.hp[lane] });
  } else {
    s.events.push({ t: 'hit', lane, floor: r.floor, score, hpLeft: 0 });
    const fs = addScore(s, floorScore(r.floor, s.combo));
    s.events.push({ t: 'floor', lane, floor: r.floor, score: fs, bottomY: b.bottomY + r.floor.height, landmarkId: b.landmarkId });
    if (r.buildingCleared) {
      buildingCleared(s, b);
      nextBuilding(s);
    }
  }
  return true;
}

/** X: destroys every remaining floor of the current building at once (spec §7.3). */
export function special(s: RunState) {
  const b = s.building;
  if (s.phase !== 'PLAYING' || !b || b.defeated || s.special < BALANCE.specialMax) return false;
  s.special = 0;
  const floors = b.floors.splice(0);
  const bottomY = b.bottomY;
  let score = 0;
  for (const f of floors) score += addScore(s, floorScore(f, s.combo) * BALANCE.specialFloorFactor);
  b.defeated = true;
  s.events.push({ t: 'special', floors, bottomY, landmarkId: b.landmarkId, score });
  buildingCleared(s, b);
  s.phase = 'SPECIAL_CUTIN';
  s.phaseMs = BALANCE.specialCutinMs;
  return true;
}

function updatePlayer(s: RunState, dt: number, input: Intents) {
  const p = s.player;
  const ms = dt * 1000;
  p.attackCooldownMs = Math.max(0, p.attackCooldownMs - ms);
  p.attackAnimMs = Math.max(0, p.attackAnimMs - ms);
  p.laneAnimMs = Math.max(0, p.laneAnimMs - ms);
  p.moveRepeatMs = Math.max(0, p.moveRepeatMs - ms);
  p.bufferedAttackMs = Math.max(0, p.bufferedAttackMs - ms);

  // lanes: a press moves at once, holding repeats every 130 ms
  const step = (dir: -1 | 1) => {
    const to = Math.max(0, Math.min(2, p.lane + dir)) as Lane;
    p.facing = dir;
    if (to === p.lane) return;
    p.laneFrom = p.lane; p.lane = to; p.laneAnimMs = BALANCE.laneMoveMs; p.moveRepeatMs = BALANCE.laneRepeatMs;
  };
  if (input.laneTo !== undefined && input.laneTo !== p.lane) {
    p.facing = input.laneTo > p.lane ? 1 : -1;
    p.laneFrom = p.lane; p.lane = input.laneTo; p.laneAnimMs = BALANCE.laneMoveMs; p.moveRepeatMs = BALANCE.laneRepeatMs;
  } else if (input.leftPressed) step(-1);
  else if (input.rightPressed) step(1);
  else if (input.left && !input.right && p.moveRepeatMs <= 0) step(-1);
  else if (input.right && !input.left && p.moveRepeatMs <= 0) step(1);

  // jump
  if (input.jumpPressed && p.y <= 0) { p.vy = BALANCE.jumpVelocity; s.events.push({ t: 'jump' }); }
  if (p.y > 0 || p.vy > 0) {
    p.vy -= BALANCE.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; }
  }
}

function updateGuard(s: RunState, dt: number, input: Intents) {
  const p = s.player;
  const ms = dt * 1000;
  if (input.guardPressed && s.guard > 0) p.guardWindowMs = BALANCE.guardWindowMs;
  p.guardWindowMs = Math.max(0, p.guardWindowMs - ms);
  p.guarding = s.guard > 0 && (p.guardWindowMs > 0 || input.guard);
  s.guardContactCooldownMs = Math.max(0, s.guardContactCooldownMs - ms);
  if (p.guarding) {
    if (input.guard) s.guard = Math.max(0, s.guard - BALANCE.guardHoldDrainPerSec * dt);
    s.guardRegenDelayMs = BALANCE.guardRegenDelayMs;
  } else if (s.guardRegenDelayMs > 0) {
    s.guardRegenDelayMs = Math.max(0, s.guardRegenDelayMs - ms);
  } else {
    s.guard = Math.min(BALANCE.guardMax, s.guard + BALANCE.guardRegenPerSec * dt);
  }
}

function handleAttackInput(s: RunState, input: Intents) {
  const p = s.player;
  if (input.attackPressed) {
    if (p.attackCooldownMs <= 0) { attack(s); return; }
    p.bufferedAttackMs = BALANCE.attackBufferMs; // one press during cooldown is kept briefly
  }
  if (p.attackCooldownMs <= 0 && (p.bufferedAttackMs > 0 || input.attack)) {
    p.bufferedAttackMs = 0;
    attack(s);
  }
}

/** Guard first, then damage. Called after the building moved this tick (spec §6.1 order). */
function resolveContact(s: RunState) {
  const b = s.building;
  if (!b || b.defeated || s.phase !== 'PLAYING') return;
  const p = s.player;
  if (p.guarding && b.bottomY >= GROUND_Y - BALANCE.guardRange && s.guardContactCooldownMs <= 0) {
    const air = p.y > 0;
    const g = air ? BALANCE.air : BALANCE.ground;
    s.guardContactCooldownMs = BALANCE.guardContactCooldownMs;
    if (s.guard >= g.cost) {
      s.guard = Math.max(0, s.guard - g.cost);
      b.bottomY -= g.push;
      b.velocityY = b.baseSpeed * g.speedFactor;
      s.speedRecoverMs = BALANCE.speedRecoverMs;
      if (air) { if (s.combo > 0) s.comboMs += BALANCE.air.comboExtendMs; } else breakCombo(s);
      s.events.push({ t: 'guard', kind: air ? 'air' : 'ground', comboKept: air });
      return;
    }
    s.events.push({ t: 'guardBreak' });
  }
  if (b.bottomY >= GROUND_Y && s.invulnMs <= 0) {
    s.lives -= 1;
    breakCombo(s);
    s.invulnMs = BALANCE.invulnAfterHitMs;
    s.events.push({ t: 'lifeLost', livesLeft: s.lives });
    s.phase = 'HIT_FREEZE';
    s.phaseMs = BALANCE.hitFreezeMs;
  }
}

/** One fixed simulation step (dt seconds). Input is applied only while PLAYING. */
export function tick(s: RunState, dt: number, input: Intents = NO_INPUT) {
  if (s.phase === 'PAUSED' || s.phase === 'TITLE' || s.phase === 'GAME_OVER' || s.phase === 'BOOT') return;
  const ms = dt * 1000;
  s.timeMs += ms;
  s.invulnMs = Math.max(0, s.invulnMs - ms);

  switch (s.phase) {
    case 'COUNTDOWN': {
      s.phaseMs -= ms;
      const n = Math.max(1, Math.ceil((s.phaseMs / BALANCE.countdownMs) * 3));
      if (n !== s.countdown) { s.countdown = n; s.events.push({ t: 'countdown', n }); }
      if (s.phaseMs <= 0) { nextBuilding(s); }
      updatePlayer(s, dt, input); // you can already move during the countdown
      return;
    }
    case 'WAVE_TRANSITION':
      s.phaseMs -= ms; // combo timer is frozen here
      updatePlayer(s, dt, input);
      updateGuard(s, dt, input);
      if (s.phaseMs <= 0) s.phase = 'PLAYING';
      return;
    case 'SPECIAL_CUTIN':
      s.phaseMs -= ms; // invulnerable; the combo timer restarts when it ends
      if (s.phaseMs <= 0) {
        if (s.combo > 0) s.comboMs = BALANCE.comboWindowMs;
        nextBuilding(s);
      }
      return;
    case 'HIT_FREEZE':
      s.phaseMs -= ms;
      if (s.phaseMs <= 0) {
        if (s.lives <= 0) {
          s.phase = 'GAME_OVER';
          s.building = null;
          s.events.push({ t: 'gameOver', score: s.score });
        } else nextBuilding(s);
      }
      return;
    case 'PLAYING': break;
  }

  updatePlayer(s, dt, input);
  updateGuard(s, dt, input);
  if (input.specialPressed && special(s)) return;
  handleAttackInput(s, input);
  if (s.phase !== 'PLAYING') return; // the hit just cleared the building

  // combo timeout
  if (s.combo > 0) {
    s.comboMs -= ms;
    if (s.comboMs <= 0) breakCombo(s);
  }

  // falling
  const b = s.building;
  if (b && !b.defeated) {
    if (s.speedRecoverMs > 0) {
      s.speedRecoverMs = Math.max(0, s.speedRecoverMs - ms);
      const k = 1 - s.speedRecoverMs / BALANCE.speedRecoverMs;
      b.velocityY += (b.baseSpeed - b.velocityY) * Math.min(1, k);
    }
    b.velocityY = Math.min(b.velocityY, b.baseSpeed * BALANCE.fallCapFactor);
    b.bottomY += b.velocityY * dt;
  }
  resolveContact(s);
}

/** Drain events for the renderer / audio. */
export function takeEvents(s: RunState) {
  const e = s.events;
  s.events = [];
  return e;
}
