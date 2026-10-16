// The whole run as plain data plus a fixed-step tick. No DOM, no canvas, no timers: input arrives as intents,
// output leaves as events the renderer and audio consume. Spec v1 §3–§8 with the v2.0 game-feel patch
// (high asymmetric jump, guard contact state machine, gameplay-only hit-stop).
import { BALANCE, comboMultiplier, DANGER_Y, GROUND_Y, specialGain, tierFor } from '../config/balance';
import { ATTACK_FEEL, GUARD_FEEL, HITSTOP_MS, JUMP_FEEL } from '../config/gameFeel';
import { hitFloor, spawnBuilding, type FallingBuilding, type Floor, type Lane } from './building';

export type Phase = 'BOOT' | 'TITLE' | 'COUNTDOWN' | 'PLAYING' | 'HIT_FREEZE' | 'PAUSED' | 'GAME_OVER' | 'SPECIAL_CUTIN' | 'WAVE_TRANSITION';
export type GuardPhase = 'OFF' | 'READY' | 'HOLD' | 'REPEL' | 'RELEASE';

export interface Intents {
  left: boolean; leftPressed: boolean;
  right: boolean; rightPressed: boolean;
  attack: boolean; attackPressed: boolean;
  jump: boolean; jumpPressed: boolean;
  guard: boolean; guardPressed: boolean;
  specialPressed: boolean; // a new key/finger press only: holding X never fires the special
  laneTo?: Lane; // touch: tap a lane to go straight there
}
export const NO_INPUT: Intents = {
  left: false, leftPressed: false, right: false, rightPressed: false, attack: false, attackPressed: false,
  jump: false, jumpPressed: false, guard: false, guardPressed: false, specialPressed: false,
};

export type GameEvent =
  | { t: 'swing'; lane: Lane; variant: number; air: boolean }
  | { t: 'hit'; lane: Lane; floor: Floor; score: number; hpBefore: number; hpLeft: number; variant: number; counter: boolean }
  | { t: 'whiff'; lane: Lane; variant: number }
  | { t: 'floor'; lane: Lane; floor: Floor; score: number; bottomY: number; landmarkId: string; oneHit: boolean; chain: number; last: boolean; aerial: boolean }
  | { t: 'building'; building: FallingBuilding; bonus: number; elite: boolean; aerial: boolean }
  | { t: 'guardContact'; kind: 'ground' | 'air'; comboKept: boolean; planeY: number; clutch: boolean }
  | { t: 'guardRepel'; kind: 'ground' | 'air' }
  | { t: 'guardRelease' }
  | { t: 'guardBreak' }
  | { t: 'lifeLost'; livesLeft: number }
  | { t: 'special'; floors: Floor[]; bottomY: number; landmarkId: string; score: number; clutch: boolean }
  | { t: 'specialReady' }
  | { t: 'combo'; combo: number }
  | { t: 'jump'; full: boolean }
  | { t: 'land'; fromHeight: number }
  | { t: 'danger' }
  | { t: 'wave'; building: FallingBuilding }
  | { t: 'countdown'; n: number }
  | { t: 'gameOver'; score: number };

export interface PlayerState {
  lane: Lane;
  laneFrom: Lane;
  laneAnimMs: number; // remaining slide time
  y: number; // feet height above the ground (up is +)
  vy: number; // up is +
  peakY: number; // highest point of the current jump
  jumpElapsed: number;
  jumpCut: boolean;
  jumpBufferMs: number;
  landMs: number; // landing squash timer (visual)
  facing: 1 | -1;
  attackCooldownMs: number;
  attackAnimMs: number;
  bufferedAttackMs: number;
  swingCount: number;
  moveRepeatMs: number;
  guardWindowMs: number;
  guarding: boolean; // guard pose shown (READY or in contact)
}

export interface GuardContact {
  id: number;
  kind: 'ground' | 'air';
  phaseMs: number; // time spent in the current phase
  repelTravelled: number;
  releaseTarget: number; // fall speed to blend back to
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
  guardPhase: GuardPhase;
  guardContact: GuardContact | null;
  guardCooldownMs: number;
  guardContacts: number;
  lastGuardAtMs: number;
  speedRecoverMs: number;
  invulnMs: number;
  freezeMs: number; // hit-stop: gameplay frozen, effects keep running
  dangerWarned: string; // building id already warned
  chainLane: number;
  chainCount: number;
  player: PlayerState;
  events: GameEvent[];
  countdown: number;
}

export function newPlayer(): PlayerState {
  return { lane: 1, laneFrom: 1, laneAnimMs: 0, y: 0, vy: 0, peakY: 0, jumpElapsed: 0, jumpCut: false, jumpBufferMs: 0, landMs: 0,
    facing: 1, attackCooldownMs: 0, attackAnimMs: 0, bufferedAttackMs: 0, swingCount: 0, moveRepeatMs: 0, guardWindowMs: 0, guarding: false };
}

export function newRun(seed: number): RunState {
  return {
    phase: 'TITLE', pausedFrom: null, phaseMs: 0, timeMs: 0, seed, buildingIndex: 0, destroyedBuildings: 0,
    recentLandmarks: [], building: null, lives: BALANCE.lives, score: 0, combo: 0, comboMs: 0, maxCombo: 0,
    special: 0, guard: BALANCE.guardMax, guardRegenDelayMs: 0, guardPhase: 'OFF', guardContact: null, guardCooldownMs: 0,
    guardContacts: 0, lastGuardAtMs: -1e9, speedRecoverMs: 0, invulnMs: 0, freezeMs: 0, dangerWarned: '', chainLane: -1, chainCount: 0,
    player: newPlayer(), events: [], countdown: 3,
  };
}

/** Title → countdown → first building. Everything except best scores is reset. */
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
/** World y of the raised sword: where a guard meets the building's underside. */
export const guardPlaneY = (s: RunState) => GROUND_Y - BALANCE.heroHeight - s.player.y - GUARD_FEEL.guardReachAboveHead;
const headY = (s: RunState) => GROUND_Y - BALANCE.heroHeight - s.player.y;
const inContact = (s: RunState) => s.guardPhase === 'HOLD' || s.guardPhase === 'REPEL';

function freeze(s: RunState, ms: number) { s.freezeMs = Math.max(s.freezeMs, ms); }

function endGuard(s: RunState) {
  s.guardPhase = 'OFF';
  s.guardContact = null;
}

function nextBuilding(s: RunState) {
  s.buildingIndex += 1;
  const b = spawnBuilding(s.seed, s.buildingIndex, s.destroyedBuildings, s.recentLandmarks);
  s.recentLandmarks = [...s.recentLandmarks, b.landmarkId].slice(-2);
  s.building = b;
  s.speedRecoverMs = 0;
  s.chainLane = -1; s.chainCount = 0;
  if (inContact(s) || s.guardPhase === 'RELEASE') endGuard(s);
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

function buildingCleared(s: RunState, b: FallingBuilding, aerial: boolean) {
  const bonus = BALANCE.buildingBonusBase + b.tier * BALANCE.buildingBonusPerTier + b.originalFloorCount * BALANCE.buildingBonusPerFloor
    + (b.elite ? BALANCE.eliteBonus : 0);
  addScore(s, bonus);
  s.destroyedBuildings += 1;
  s.events.push({ t: 'building', building: b, bonus, elite: b.elite, aerial });
}

/** One sword swing. The hit lands on the logical lane at the moment of the swing, on the very next tick. */
export function attack(s: RunState) {
  const p = s.player;
  if (s.phase !== 'PLAYING' || p.attackCooldownMs > 0) return false;
  if (s.guardPhase === 'HOLD') { p.bufferedAttackMs = ATTACK_FEEL.bufferMs; return false; } // bracing: the press waits
  p.attackCooldownMs = BALANCE.attackIntervalMs;
  p.attackAnimMs = BALANCE.attackAnimMs;
  const variant = p.swingCount++ % ATTACK_FEEL.swingVariants;
  const lane = p.lane;
  const b = s.building;
  s.events.push({ t: 'swing', lane, variant, air: p.y > 0 });
  if (!b || b.defeated) { s.events.push({ t: 'whiff', lane, variant }); return true; }
  const hpBefore = b.floors[0]?.hp[lane] ?? 0;
  const r = hitFloor(b, lane);
  if (r.kind === 'none') { s.events.push({ t: 'whiff', lane, variant }); return true; }
  const score = onSuccessfulHit(s);
  const counter = s.timeMs - s.lastGuardAtMs <= GUARD_FEEL.counterWindowMs;
  s.events.push({ t: 'hit', lane, floor: r.floor, score, hpBefore, hpLeft: r.kind === 'damaged' ? r.floor.hp[lane] : 0, variant, counter });
  if (r.kind === 'damaged') { freeze(s, HITSTOP_MS.hit); return true; }

  // a whole floor is gone
  s.chainCount = s.chainLane === lane ? s.chainCount + 1 : 1;
  s.chainLane = lane;
  const fs = addScore(s, floorScore(r.floor, s.combo));
  const aerial = p.y > 0;
  s.events.push({ t: 'floor', lane, floor: r.floor, score: fs, bottomY: b.bottomY + r.floor.height, landmarkId: b.landmarkId,
    oneHit: r.floor.initialHp[lane] === 1, chain: s.chainCount, last: r.buildingCleared, aerial });
  if (r.buildingCleared) {
    freeze(s, HITSTOP_MS.building);
    buildingCleared(s, b, aerial);
    nextBuilding(s);
  } else freeze(s, HITSTOP_MS.floor);
  return true;
}

/** X: destroys every remaining floor of the current building at once (v1 §7.3). */
export function special(s: RunState) {
  const b = s.building;
  if (s.phase !== 'PLAYING' || !b || b.defeated || s.special < BALANCE.specialMax) return false;
  s.special = 0;
  const clutch = DANGER_Y - b.bottomY < 40;
  const floors = b.floors.splice(0);
  const bottomY = b.bottomY;
  let score = 0;
  for (const f of floors) score += addScore(s, floorScore(f, s.combo) * BALANCE.specialFloorFactor);
  b.defeated = true;
  if (s.guardPhase !== 'OFF' && s.guardPhase !== 'READY') endGuard(s);
  s.events.push({ t: 'special', floors, bottomY, landmarkId: b.landmarkId, score, clutch });
  buildingCleared(s, b, s.player.y > 0);
  freeze(s, HITSTOP_MS.special);
  s.phase = 'SPECIAL_CUTIN';
  s.phaseMs = BALANCE.specialCutinMs;
  return true;
}

function updateLanes(s: RunState, ms: number, input: Intents) {
  const p = s.player;
  p.laneAnimMs = Math.max(0, p.laneAnimMs - ms);
  p.moveRepeatMs = Math.max(0, p.moveRepeatMs - ms);
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
}

/** v2 §3: ~204 wu full jump, fast fall, short hop on an early release, jump buffer. */
function updateJump(s: RunState, dt: number, input: Intents) {
  const p = s.player;
  const ms = dt * 1000;
  p.landMs = Math.max(0, p.landMs - ms);
  if (input.jumpPressed) p.jumpBufferMs = JUMP_FEEL.jumpBuffer * 1000;
  else p.jumpBufferMs = Math.max(0, p.jumpBufferMs - ms);

  // bracing under the building during an air guard hold: the hero stays glued to the contact point
  if (s.guardPhase === 'HOLD' && s.guardContact?.kind === 'air') return;

  if (p.y <= 0 && p.vy <= 0 && p.jumpBufferMs > 0) {
    p.vy = JUMP_FEEL.jumpVelocity;
    p.jumpElapsed = 0; p.jumpCut = false; p.peakY = 0; p.jumpBufferMs = 0;
    s.events.push({ t: 'jump', full: input.jump });
  }
  if (p.y > 0 || p.vy > 0) {
    p.jumpElapsed += dt;
    if (!input.jump && p.vy > 0 && !p.jumpCut && p.jumpElapsed <= JUMP_FEEL.jumpCutWindow) { p.vy *= JUMP_FEEL.jumpCutVelocityFactor; p.jumpCut = true; }
    p.vy -= (p.vy > 0 ? JUMP_FEEL.gravityAscending : JUMP_FEEL.gravityDescending) * dt;
    p.y += p.vy * dt;
    if (p.y > p.peakY) p.peakY = p.y;
    if (p.y <= 0) {
      p.y = 0; p.vy = 0; p.landMs = JUMP_FEEL.landingSquashMs;
      s.events.push({ t: 'land', fromHeight: p.peakY });
    }
  }
  // the hero can never be inside the building: its underside is a ceiling
  const b = s.building;
  if (b && !b.defeated && !inContact(s)) {
    // guarding, the raised sword is the top of the hero: it meets the underside first
    const reach = s.guardPhase === 'READY' ? GUARD_FEEL.guardReachAboveHead : 0;
    const maxY = Math.max(0, DANGER_Y - reach - b.bottomY);
    if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy = 0; }
  }
}

function updateGuardInput(s: RunState, dt: number, input: Intents) {
  const p = s.player;
  const ms = dt * 1000;
  s.guardCooldownMs = Math.max(0, s.guardCooldownMs - ms);
  if (input.guardPressed && s.guard > 0) p.guardWindowMs = BALANCE.guardWindowMs;
  p.guardWindowMs = Math.max(0, p.guardWindowMs - ms);
  const wants = s.guard > 0 && (p.guardWindowMs > 0 || input.guard);
  if (s.guardPhase === 'OFF' && wants && s.guardCooldownMs <= 0) s.guardPhase = 'READY';
  if (s.guardPhase === 'READY' && !wants) s.guardPhase = 'OFF';
  p.guarding = s.guardPhase === 'READY' || inContact(s);
  // v1 hold drain, only while waiting for contact (never stacked with the contact cost)
  if (s.guardPhase === 'READY' && input.guard) s.guard = Math.max(0, s.guard - BALANCE.guardHoldDrainPerSec * dt);
  if (s.guardPhase === 'OFF' || s.guardPhase === 'RELEASE') {
    if (s.guardRegenDelayMs > 0) s.guardRegenDelayMs = Math.max(0, s.guardRegenDelayMs - ms);
    else s.guard = Math.min(BALANCE.guardMax, s.guard + BALANCE.guardRegenPerSec * dt);
  } else s.guardRegenDelayMs = BALANCE.guardRegenDelayMs;
}

/**
 * v2 §4: the only owner of the building's Y while guarding. READY never touches the building; contact starts only
 * when the underside actually reaches the raised sword (swept, within 16 wu), then HOLD 120 ms → REPEL (animated
 * 85 / 35 wu) → RELEASE (80 ms blend back to falling).
 */
function updateGuardContact(s: RunState, dt: number, prevBottom: number) {
  const b = s.building;
  if (!b || b.defeated) return;
  const ms = dt * 1000;
  const c = s.guardContact;
  if (s.guardPhase === 'READY' && s.guardCooldownMs <= 0) {
    const plane = guardPlaneY(s);
    const gap = plane - b.bottomY; // > 0: building still above the sword
    // touching = the underside is at the sword (≤ 7 wu overlap from step order), or crossed it this tick (swept).
    // Above the sword the building keeps falling untouched; far below it the guard came too late.
    const crossed = prevBottom < plane && b.bottomY >= plane;
    if (gap > 0 || (gap < -GUARD_FEEL.maxSnapCorrection && !crossed)) return;
    {
      const air = s.player.y > 0;
      const kind = air ? 'air' : 'ground';
      const cost = air ? BALANCE.air.cost : BALANCE.ground.cost;
      s.guardCooldownMs = GUARD_FEEL.contactCooldownMs;
      if (s.guard < cost) { s.events.push({ t: 'guardBreak' }); s.guardPhase = 'OFF'; return; }
      s.guard = Math.max(0, s.guard - cost);
      b.bottomY = plane; // snap ≤ 7 wu so the underside sits exactly on the sword
      b.velocityY = 0;
      s.guardContacts += 1;
      s.guardContact = { id: s.guardContacts, kind, phaseMs: 0, repelTravelled: 0, releaseTarget: b.baseSpeed * (air ? BALANCE.air.speedFactor : BALANCE.ground.speedFactor) };
      s.guardPhase = 'HOLD';
      s.lastGuardAtMs = s.timeMs;
      if (air) { if (s.combo > 0) s.comboMs += BALANCE.air.comboExtendMs; } else breakCombo(s);
      s.events.push({ t: 'guardContact', kind, comboKept: air, planeY: plane, clutch: false });
      if (air) { s.player.vy = 0; s.player.y = Math.max(0, GROUND_Y - BALANCE.heroHeight - GUARD_FEEL.guardReachAboveHead - b.bottomY); }
    }
    return;
  }
  if (!c) return;
  c.phaseMs += ms;
  if (s.guardPhase === 'HOLD') {
    b.velocityY = 0;
    if (c.phaseMs >= GUARD_FEEL.holdMs[c.kind]) { s.guardPhase = 'REPEL'; c.phaseMs = 0; s.events.push({ t: 'guardRepel', kind: c.kind }); }
  } else if (s.guardPhase === 'REPEL') {
    const dur = GUARD_FEEL.repelMs[c.kind], dist = GUARD_FEEL.repelUnits[c.kind];
    const k = Math.min(1, c.phaseMs / dur);
    const travel = dist * (1 - Math.pow(1 - k, 3)); // ease-out cubic, total exactly 85 / 35
    b.bottomY -= travel - c.repelTravelled; // move by the delta so hits during the push still add up
    c.repelTravelled = travel;
    b.velocityY = 0;
    if (k >= 1) { s.guardPhase = 'RELEASE'; c.phaseMs = 0; s.events.push({ t: 'guardRelease' }); }
  } else if (s.guardPhase === 'RELEASE') {
    const k = Math.min(1, c.phaseMs / GUARD_FEEL.releaseBlendMs);
    b.velocityY = c.releaseTarget * k; // 0 → slowed fall speed, then speedRecover brings it back to normal
    if (k >= 1) { s.speedRecoverMs = BALANCE.speedRecoverMs; endGuard(s); }
  }
}

function handleAttackInput(s: RunState, input: Intents) {
  const p = s.player;
  if (input.attackPressed) {
    if (p.attackCooldownMs <= 0 && s.guardPhase !== 'HOLD') { attack(s); return; }
    p.bufferedAttackMs = ATTACK_FEEL.bufferMs; // one press during cooldown or a guard hold is kept
  }
  if (p.attackCooldownMs <= 0 && s.guardPhase !== 'HOLD' && (p.bufferedAttackMs > 0 || input.attack)) {
    p.bufferedAttackMs = 0;
    attack(s);
  }
}

/** Special invulnerability → guard contact → crush (v2 §4.3 order). */
function resolveDanger(s: RunState) {
  const b = s.building;
  if (!b || b.defeated || s.phase !== 'PLAYING' || inContact(s)) return;
  // warn once when the building would reach the hero within 0.25 s
  if (s.dangerWarned !== b.id && s.guardPhase === 'OFF' && b.velocityY > 0 && (DANGER_Y - b.bottomY) / b.velocityY < 0.25) { s.dangerWarned = b.id; s.events.push({ t: 'danger' }); }
  if (b.bottomY >= DANGER_Y && s.invulnMs <= 0) {
    s.lives -= 1;
    breakCombo(s);
    s.invulnMs = BALANCE.invulnAfterHitMs;
    s.events.push({ t: 'lifeLost', livesLeft: s.lives });
    s.phase = 'HIT_FREEZE';
    s.phaseMs = BALANCE.hitFreezeMs;
    if (s.guardPhase !== 'OFF') endGuard(s);
  } else if (b.bottomY >= DANGER_Y) b.bottomY = DANGER_Y; // invulnerable: rests on the hero, never passes through
}

/** One fixed simulation step (dt seconds). Input is applied only while PLAYING. */
export function tick(s: RunState, dt: number, input: Intents = NO_INPUT) {
  if (s.phase === 'PAUSED' || s.phase === 'TITLE' || s.phase === 'GAME_OVER' || s.phase === 'BOOT') return;
  const ms = dt * 1000;
  s.timeMs += ms;
  s.invulnMs = Math.max(0, s.invulnMs - ms);
  const p = s.player;
  p.attackCooldownMs = Math.max(0, p.attackCooldownMs - ms); // the 95 ms rhythm keeps running through hit-stop
  p.attackAnimMs = Math.max(0, p.attackAnimMs - ms);
  p.bufferedAttackMs = Math.max(0, p.bufferedAttackMs - ms);

  switch (s.phase) {
    case 'COUNTDOWN': {
      s.phaseMs -= ms;
      const n = Math.max(1, Math.ceil((s.phaseMs / BALANCE.countdownMs) * 3));
      if (n !== s.countdown) { s.countdown = n; s.events.push({ t: 'countdown', n }); }
      if (s.phaseMs <= 0) nextBuilding(s);
      updateLanes(s, ms, input);
      updateJump(s, dt, input);
      return;
    }
    case 'WAVE_TRANSITION':
      s.phaseMs -= ms; // combo timer is frozen here
      s.freezeMs = Math.max(0, s.freezeMs - ms);
      updateLanes(s, ms, input);
      updateJump(s, dt, input);
      updateGuardInput(s, dt, input);
      if (input.attackPressed) p.bufferedAttackMs = ATTACK_FEEL.bufferMs;
      if (s.phaseMs <= 0) s.phase = 'PLAYING';
      return;
    case 'SPECIAL_CUTIN':
      s.phaseMs -= ms; // invulnerable; the combo timer restarts when it ends
      s.freezeMs = Math.max(0, s.freezeMs - ms);
      updateJump(s, dt, input);
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

  // hit-stop: gameplay (falling, physics, combo clock, contact) pauses; one attack press is buffered
  if (s.freezeMs > 0) {
    s.freezeMs = Math.max(0, s.freezeMs - ms);
    if (input.attackPressed) p.bufferedAttackMs = ATTACK_FEEL.bufferMs;
    if (input.jumpPressed) p.jumpBufferMs = JUMP_FEEL.jumpBuffer * 1000;
    if (input.specialPressed) special(s);
    return;
  }

  updateLanes(s, ms, input);
  updateGuardInput(s, dt, input);
  if (input.specialPressed && special(s)) return;
  updateJump(s, dt, input);
  handleAttackInput(s, input);
  if (s.phase !== 'PLAYING') return; // the hit just cleared the building

  if (s.combo > 0 && s.guardPhase !== 'HOLD') {
    s.comboMs -= ms;
    if (s.comboMs <= 0) breakCombo(s);
  }

  const b = s.building;
  const prevBottom = b ? b.bottomY : 0;
  if (b && !b.defeated && !inContact(s) && s.guardPhase !== 'RELEASE') {
    if (s.speedRecoverMs > 0) {
      s.speedRecoverMs = Math.max(0, s.speedRecoverMs - ms);
      const k = 1 - s.speedRecoverMs / BALANCE.speedRecoverMs;
      b.velocityY += (b.baseSpeed - b.velocityY) * Math.min(1, k);
    }
    b.velocityY = Math.min(b.velocityY, b.baseSpeed * BALANCE.fallCapFactor);
  }
  if (b && !b.defeated && !inContact(s)) b.bottomY += b.velocityY * dt;
  updateGuardContact(s, dt, prevBottom);
  // the building pushes an airborne hero down instead of overlapping them
  if (b && !b.defeated && !inContact(s) && p.y > 0) {
    const maxY = Math.max(0, DANGER_Y - b.bottomY);
    if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy = 0; }
  }
  resolveDanger(s);
  void headY;
}

/** Drain events for the renderer / audio. */
export function takeEvents(s: RunState) {
  const e = s.events;
  s.events = [];
  return e;
}
