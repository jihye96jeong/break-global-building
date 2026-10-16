// The whole run as plain data plus a fixed-step tick. No DOM, no canvas, no timers: input arrives as intents,
// output leaves as events the renderer and audio consume. Spec v1 §3–§8, the v2.0 game-feel patch (high jump,
// hit-stop) and the v3.0 contact patch: attacks and guards resolve only on real, swept contact between the pose's
// visible surface and the lowest floor's underside, through one combat resolver (special → guard → attack → crush).
import { BALANCE, comboMultiplier, DANGER_Y, GROUND_Y, specialGain, tierFor } from '../config/balance';
import { ATTACK_FEEL, CONTACT, GUARD_FEEL, HITSTOP_MS, JUMP_FEEL } from '../config/gameFeel';
import { hitFloor, spawnBuilding, type FallingBuilding, type Floor, type Lane } from './building';

export type Phase = 'BOOT' | 'TITLE' | 'COUNTDOWN' | 'PLAYING' | 'HIT_FREEZE' | 'PAUSED' | 'GAME_OVER' | 'SPECIAL_CUTIN' | 'WAVE_TRANSITION';
/** OFF → READY (≤180 ms, no effect on the building) → HOLD → REPEL → RELEASE → OFF; READY that expires → LOCKED until ↓ is released. */
export type GuardPhase = 'OFF' | 'READY' | 'LOCKED' | 'HOLD' | 'REPEL' | 'RELEASE';

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
  | { t: 'hit'; lane: Lane; floor: Floor; score: number; hpBefore: number; hpLeft: number; variant: number; counter: boolean; contact: ContactProof }
  | { t: 'whiff'; lane: Lane; variant: number }
  | { t: 'floor'; lane: Lane; floor: Floor; score: number; bottomY: number; landmarkId: string; oneHit: boolean; chain: number; last: boolean; aerial: boolean }
  | { t: 'building'; building: FallingBuilding; bonus: number; elite: boolean; aerial: boolean }
  | { t: 'guardReady' }
  | { t: 'guardContact'; kind: 'ground' | 'air'; comboKept: boolean; planeY: number; clutch: boolean; impactSpeed: number; motionOwner: 'GUARD_HOLD'; contact: ContactProof }
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

/** Attached to every confirmed hit / guard: the numbers that prove it really touched (spec v3 §9). */
export interface ContactProof {
  contactConfirmed: true;
  atExactContact: boolean; // |gap| at the contact instant ≤ the 2 wu tolerance
  laneMatched: boolean;
  gap: number; // wu between the pose surface and the underside at the contact instant
  toi: number; // 0..1 within the tick
  lanePos: number; // hero's continuous lane position at that instant
  y: number; // world y of the contact point
  segmentId: string; // building + floor + lane
}

/** One sword swing: drawn at once, damages only if real contact happens while it is live. */
export interface Swing {
  id: number;
  variant: number;
  elapsedMs: number;
  activeMs: number;
  consumed: boolean; // one hit per swing, ever
}

/** Live numbers for ?debugContact=1. */
export interface ContactDebug {
  attackGap: number;
  guardGap: number;
  toi: number | null;
  xOverlap: boolean;
  lastEvent: string;
  contactId: string;
}

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
  swing: Swing | null;
  moveRepeatMs: number;
  guardReadyMs: number; // READY time left
  guardSincePressMs: number;
  guarding: boolean; // guard pose shown (READY, LOCKED or in contact)
}

export interface GuardContact {
  id: number;
  kind: 'ground' | 'air';
  phaseMs: number; // time spent in the current phase
  repelTravelled: number;
  contactY: number; // the underside's y at the contact instant
  segmentId: string;
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
  swingIds: number;
  contact: ContactDebug;
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
    facing: 1, attackCooldownMs: 0, attackAnimMs: 0, bufferedAttackMs: 0, swingCount: 0, swing: null, moveRepeatMs: 0,
    guardReadyMs: 0, guardSincePressMs: 0, guarding: false };
}

export function newRun(seed: number): RunState {
  return {
    phase: 'TITLE', pausedFrom: null, phaseMs: 0, timeMs: 0, seed, buildingIndex: 0, destroyedBuildings: 0,
    recentLandmarks: [], building: null, lives: BALANCE.lives, score: 0, combo: 0, comboMs: 0, maxCombo: 0,
    special: 0, guard: BALANCE.guardMax, guardRegenDelayMs: 0, guardPhase: 'OFF', guardContact: null, guardCooldownMs: 0,
    guardContacts: 0, lastGuardAtMs: -1e9, swingIds: 0, contact: { attackGap: NaN, guardGap: NaN, toi: null, xOverlap: false, lastEvent: '', contactId: '' }, invulnMs: 0, freezeMs: 0, dangerWarned: '', chainLane: -1, chainCount: 0,
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

// ---------------------------------------------------------------- contact geometry (v3 §2)
// One set of numbers for judging and drawing: the renderer draws each pose so its top edge sits exactly here.
export const headY = (s: RunState) => GROUND_Y - BALANCE.heroHeight - s.player.y;
/** World y of the attack pose's blade: where a swing meets the building's underside. */
export const attackSurfaceY = (s: RunState) => headY(s) - CONTACT.attackReachAboveHead;
/** World y of the guard pose's raised blade: where a guard meets the building's underside. */
export const guardPlaneY = (s: RunState) => headY(s) - GUARD_FEEL.guardReachAboveHead;
/** The hero's continuous lane position (0..2) — the same eased slide the renderer draws. */
export function heroLanePos(p: PlayerState) {
  const k = p.laneAnimMs > 0 ? 1 - p.laneAnimMs / BALANCE.laneMoveMs : 1;
  return p.laneFrom + (p.lane - p.laneFrom) * (1 - (1 - k) * (1 - k));
}
/** Horizontal overlap (lane units) between the blade around `pos` and lane `lane`'s underside. */
export function laneOverlap(pos: number, lane: number) {
  return Math.min(pos + CONTACT.bladeHalfWidth, lane + 0.5) - Math.max(pos - CONTACT.bladeHalfWidth, lane - 0.5);
}
/**
 * Swept contact between a pose surface and the underside across one tick. gap = surface − underside
 * (> 0 apart, 0 touching, < 0 overlapping). Returns the time of impact in [0,1], or null if they never touched.
 */
export function sweptContact(prevGap: number, currGap: number): number | null {
  const eps = CONTACT.touchEpsilonWu, pen = CONTACT.maxPenetrationWu;
  if (prevGap < -pen) return null; // already deep inside before this tick: never retroactive
  if (prevGap <= eps) return 0; // touching at the start of the tick
  if (currGap > eps) return null; // still apart
  return Math.max(0, Math.min(1, prevGap / (prevGap - currGap)));
}

/** Positions at the start of a tick, for the swept test. */
interface Snapshot { bottom: number; attackY: number; guardY: number; lanePos: number; floorId: string }
function snapshot(s: RunState): Snapshot {
  const b = s.building;
  return { bottom: b ? b.bottomY : -1e9, attackY: attackSurfaceY(s), guardY: guardPlaneY(s), lanePos: heroLanePos(s.player), floorId: b?.floors[0]?.id ?? '' };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** While the guard holds, pushes or releases the building, it alone moves the building (single writer). */
const guardOwnsBuilding = (s: RunState) => s.guardPhase === 'HOLD' || s.guardPhase === 'REPEL' || s.guardPhase === 'RELEASE';
const bracing = (s: RunState) => s.guardPhase === 'HOLD' || s.guardPhase === 'REPEL';

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
  s.chainLane = -1; s.chainCount = 0;
  if (guardOwnsBuilding(s)) endGuard(s);
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

// ---------------------------------------------------------------- attack (v3 §3)
/** Start a swing: the slash is drawn at once; whether it damages anything is decided only by contact. */
function startSwing(s: RunState, held: boolean) {
  const p = s.player;
  if (p.swing && !p.swing.consumed) s.events.push({ t: 'whiff', lane: p.lane, variant: p.swing.variant });
  p.attackCooldownMs = BALANCE.attackIntervalMs;
  p.attackAnimMs = BALANCE.attackAnimMs;
  p.bufferedAttackMs = 0;
  const variant = p.swingCount++ % ATTACK_FEEL.swingVariants;
  p.swing = { id: ++s.swingIds, variant, elapsedMs: 0, activeMs: held ? CONTACT.heldActiveMs : CONTACT.attackActiveMs, consumed: false };
  s.events.push({ t: 'swing', lane: p.lane, variant, air: p.y > 0 });
}

/**
 * The only path that lowers a floor's HP from a normal attack. Requires: a live, unused swing; the hero's logical
 * lane; real horizontal overlap at the contact instant; and the blade meeting the underside within the tick (swept).
 */
function resolveAttackContact(s: RunState, prev: Snapshot) {
  const p = s.player, sw = p.swing, b = s.building;
  if (!sw || sw.consumed || sw.elapsedMs > sw.activeMs || bracing(s)) return false;
  if (!b || b.defeated || !b.floors[0]) return false;
  const floor = b.floors[0];
  const surf = attackSurfaceY(s);
  const gapNow = surf - b.bottomY;
  // a floor that just replaced the broken one is a new contact: its old snapshot never counts
  const prevGap = prev.floorId === floor.id ? prev.attackY - prev.bottom : gapNow;
  const toi = sweptContact(prevGap, gapNow);
  s.contact.attackGap = gapNow;
  s.contact.toi = toi;
  if (toi === null) return false;
  const pos = lerp(prev.lanePos, heroLanePos(p), toi);
  const overlap = laneOverlap(pos, p.lane) >= CONTACT.minHorizontalOverlap;
  s.contact.xOverlap = overlap;
  if (!overlap) return false;
  // the strike happens at the contact instant: the underside never ends deeper than the blade
  const bottomAt = prev.floorId === floor.id ? lerp(prev.bottom, b.bottomY, toi) : b.bottomY;
  const surfAt = lerp(prev.attackY, surf, toi);
  const contactY = Math.min(bottomAt, surfAt);
  const gapAt = surfAt - bottomAt;
  b.bottomY = contactY;
  sw.consumed = true;
  applyHit(s, {
    contactConfirmed: true, atExactContact: Math.abs(Math.max(gapAt, 0)) <= CONTACT.touchEpsilonWu, laneMatched: true, gap: gapAt, toi,
    lanePos: pos, y: contactY, segmentId: `${b.id}-${floor.id}-L${p.lane}`,
  }, sw.variant);
  return true;
}

function applyHit(s: RunState, proof: ContactProof, variant: number) {
  const p = s.player;
  const lane = p.lane;
  const b = s.building!;
  const hpBefore = b.floors[0]?.hp[lane] ?? 0;
  const r = hitFloor(b, lane);
  if (r.kind === 'none') return;
  b.velocityY = 0; // the blow stops the building dead; it falls back onto the blade (CONTACT.fallAccel)
  s.contact.lastEvent = 'ATTACK_HIT';
  s.contact.contactId = proof.segmentId;
  const score = onSuccessfulHit(s);
  const counter = s.timeMs - s.lastGuardAtMs <= GUARD_FEEL.counterWindowMs;
  s.events.push({ t: 'hit', lane, floor: r.floor, score, hpBefore, hpLeft: r.kind === 'damaged' ? r.floor.hp[lane] : 0, variant, counter, contact: proof });
  if (r.kind === 'damaged') { freeze(s, HITSTOP_MS.hit); return; }

  // a whole floor is gone: the next floor is a gap away and has to physically drop onto the blade again
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
  } else {
    b.settleMs = CONTACT.postBreakSettleMs;
    freeze(s, HITSTOP_MS.floor);
  }
}

/**
 * Z / ATTACK: swing now (even into thin air) and judge contact against the current positions.
 * Returns whether a swing started; damage happens only on real contact.
 */
export function attack(s: RunState, held = false) {
  const p = s.player;
  if (s.phase !== 'PLAYING' || p.attackCooldownMs > 0) return false;
  if (bracing(s)) { p.bufferedAttackMs = CONTACT.attackBufferMs; return false; } // no hits while bracing: the press waits
  startSwing(s, held);
  resolveAttackContact(s, snapshot(s));
  return true;
}

/** X: destroys every remaining floor of the current building at once (v1 §7.3). A separate skill: no contact needed. */
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
  if (guardOwnsBuilding(s)) endGuard(s);
  if (s.player.swing) s.player.swing.consumed = true;
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

/** How far above the head the hero's top reaches in the current pose (the blade). */
const poseReach = (s: RunState) => (s.guardPhase === 'READY' ? GUARD_FEEL.guardReachAboveHead : CONTACT.attackReachAboveHead);

/** Keep an airborne hero's blade from entering the underside: the building is a ceiling and pushes them down. */
function clampUnderBuilding(s: RunState) {
  const p = s.player, b = s.building;
  if (!b || b.defeated || bracing(s) || p.y <= 0) return;
  const maxY = Math.max(0, DANGER_Y - poseReach(s) - b.bottomY);
  if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy = 0; }
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
  clampUnderBuilding(s);
}

// ---------------------------------------------------------------- guard (v3 §5)
function updateGuardInput(s: RunState, dt: number, input: Intents) {
  const p = s.player;
  const ms = dt * 1000;
  s.guardCooldownMs = Math.max(0, s.guardCooldownMs - ms);
  p.guardSincePressMs += ms;
  if (s.guardPhase === 'READY') {
    p.guardReadyMs -= ms;
    // released early: the press still counts for a short pre-contact buffer only
    if (!input.guard) p.guardReadyMs = Math.min(p.guardReadyMs, GUARD_FEEL.preContactBufferMs - p.guardSincePressMs);
    if (p.guardReadyMs <= 0) s.guardPhase = input.guard ? 'LOCKED' : 'OFF'; // holding from far away never auto-guards
  }
  if (s.guardPhase === 'LOCKED' && !input.guard) s.guardPhase = 'OFF';
  // a fresh press arms the guard; the contact check runs later in this same tick, so a press on the contact frame counts
  if (input.guardPressed && (s.guardPhase === 'OFF' || s.guardPhase === 'LOCKED') && s.guardCooldownMs <= 0) {
    s.guardPhase = 'READY';
    p.guardReadyMs = GUARD_FEEL.readyWindowMs;
    p.guardSincePressMs = 0;
    s.events.push({ t: 'guardReady' });
  }
  p.guarding = s.guardPhase === 'READY' || s.guardPhase === 'LOCKED' || bracing(s);
  if (!bracing(s)) {
    if (s.guardRegenDelayMs > 0) s.guardRegenDelayMs = Math.max(0, s.guardRegenDelayMs - ms);
    else s.guard = Math.min(BALANCE.guardMax, s.guard + BALANCE.guardRegenPerSec * dt);
  } else s.guardRegenDelayMs = BALANCE.guardRegenDelayMs;
}

/** READY + real swept contact → HOLD at the exact contact point. Never moves a building that has not touched. */
function resolveGuardContact(s: RunState, prev: Snapshot, dt: number) {
  const b = s.building;
  if (s.guardPhase !== 'READY' || !b || b.defeated) return false;
  const p = s.player;
  const plane = guardPlaneY(s);
  const gapNow = plane - b.bottomY;
  s.contact.guardGap = gapNow;
  const sameFloor = prev.floorId === (b.floors[0]?.id ?? '');
  const toi = sweptContact(sameFloor ? prev.guardY - prev.bottom : gapNow, gapNow);
  if (toi === null) return false;
  // the building spans all three lanes, so the raised blade is always under some part of it (lanes clamp to 0..2)
  const air = p.y > 0;
  const kind = air ? 'air' : 'ground';
  const cost = air ? BALANCE.air.cost : BALANCE.ground.cost;
  s.guardCooldownMs = GUARD_FEEL.contactCooldownMs;
  if (s.guard < cost) { s.events.push({ t: 'guardBreak' }); s.guardPhase = 'LOCKED'; s.contact.lastEvent = 'GUARD_BREAK'; return false; }
  const bottomAt = sameFloor ? lerp(prev.bottom, b.bottomY, toi) : b.bottomY;
  const planeAt = sameFloor ? lerp(prev.guardY, plane, toi) : plane;
  const contactY = Math.min(bottomAt, planeAt); // stop at the impact point; the rest of this tick's fall is discarded
  const impactSpeed = sameFloor && dt > 0 ? ((b.bottomY - prev.bottom) - (plane - prev.guardY)) / dt : b.velocityY;
  b.bottomY = contactY;
  b.velocityY = 0;
  s.guard = Math.max(0, s.guard - cost); // exactly once per contact
  s.guardContacts += 1;
  const segmentId = `${b.id}-${b.floors[0]?.id ?? 'x'}-L${p.lane}`;
  s.guardContact = { id: s.guardContacts, kind, phaseMs: 0, repelTravelled: 0, contactY, segmentId };
  s.guardPhase = 'HOLD';
  if (p.swing) p.swing.consumed = true; // guard wins a same-tick attack: no extra damage from the bracing pose
  if (air) {
    if (s.combo > 0) s.comboMs += BALANCE.air.comboExtendMs;
    p.vy = 0;
    p.y = Math.max(0, GROUND_Y - BALANCE.heroHeight - GUARD_FEEL.guardReachAboveHead - contactY); // blade glued to the underside
  } else breakCombo(s);
  s.contact.lastEvent = 'GUARD_CONTACT';
  s.contact.contactId = segmentId;
  s.events.push({ t: 'guardContact', kind, comboKept: air, planeY: contactY, clutch: false, impactSpeed: Math.max(0, impactSpeed), motionOwner: 'GUARD_HOLD',
    contact: { contactConfirmed: true, atExactContact: Math.abs(planeAt - contactY) <= CONTACT.touchEpsilonWu, laneMatched: true, gap: planeAt - bottomAt, toi,
      lanePos: heroLanePos(p), y: contactY, segmentId } });
  return true;
}

const smootherstep = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };

/** HOLD (building pinned at the contact y) → REPEL (smootherstep push, exactly 36 / 18 wu) → RELEASE (70 ms, 0 → fall speed). */
function updateGuardMotion(s: RunState, dt: number) {
  const b = s.building, c = s.guardContact;
  if (!b || b.defeated || !c || !guardOwnsBuilding(s)) return;
  const ms = dt * 1000;
  c.phaseMs += ms;
  if (s.guardPhase === 'HOLD') {
    b.bottomY = c.contactY;
    b.velocityY = 0;
    if (c.phaseMs >= GUARD_FEEL.holdMs[c.kind]) { s.guardPhase = 'REPEL'; c.phaseMs = 0; s.events.push({ t: 'guardRepel', kind: c.kind }); }
  } else if (s.guardPhase === 'REPEL') {
    const travel = GUARD_FEEL.repelUnits[c.kind] * smootherstep(c.phaseMs / GUARD_FEEL.repelMs[c.kind]);
    b.bottomY -= travel - c.repelTravelled; // by the delta: a floor removed meanwhile still adds up
    c.repelTravelled = travel;
    b.velocityY = 0;
    if (c.phaseMs >= GUARD_FEEL.repelMs[c.kind]) {
      s.guardPhase = 'RELEASE'; c.phaseMs = 0;
      s.lastGuardAtMs = s.timeMs;
      s.events.push({ t: 'guardRelease' });
    }
  } else {
    const k = Math.min(1, c.phaseMs / GUARD_FEEL.releaseBlendMs);
    b.velocityY = b.baseSpeed * k;
    b.bottomY += b.velocityY * dt;
    if (k >= 1) endGuard(s);
  }
}

/** Normal fall: accelerate back toward the tier speed after a hit; after a floor break, settle fast onto the blade. */
function updateFall(s: RunState, dt: number) {
  const b = s.building;
  if (!b || b.defeated || guardOwnsBuilding(s)) return;
  let target = b.baseSpeed, accel = CONTACT.fallAccel;
  if (b.settleMs && b.settleMs > 0) {
    b.settleMs = Math.max(0, b.settleMs - dt * 1000);
    const [g0, g1] = CONTACT.settleEaseGap;
    const k = Math.max(0, Math.min(1, (attackSurfaceY(s) - b.bottomY - g0) / (g1 - g0)));
    target = Math.max(target, lerp(b.baseSpeed, CONTACT.postBreakSettleSpeed, k));
    accel = CONTACT.postBreakSettleAccel;
  }
  b.velocityY = Math.min(target, b.velocityY + accel * dt);
  b.bottomY += b.velocityY * dt;
}

function handleAttackInput(s: RunState, input: Intents) {
  const p = s.player;
  if (input.attackPressed) p.bufferedAttackMs = CONTACT.attackBufferMs;
  if (p.attackCooldownMs > 0 || bracing(s)) return; // a press here waits in the 70 ms buffer
  if (p.bufferedAttackMs > 0) startSwing(s, false);
  else if (input.attack) startSwing(s, true); // held: auto-repeat on the 95 ms rhythm
}

/** Crush: no special, no guard, no hit → the v1 danger-line rule. */
function resolveDanger(s: RunState) {
  const b = s.building;
  if (!b || b.defeated || s.phase !== 'PLAYING' || bracing(s)) return;
  // warn once when the building would reach the hero within 0.25 s
  if (s.dangerWarned !== b.id && s.guardPhase === 'OFF' && b.velocityY > 0 && (DANGER_Y - b.bottomY) / b.velocityY < 0.25) { s.dangerWarned = b.id; s.events.push({ t: 'danger' }); }
  if (b.bottomY >= DANGER_Y && s.invulnMs <= 0) {
    s.lives -= 1;
    breakCombo(s);
    s.invulnMs = BALANCE.invulnAfterHitMs;
    s.events.push({ t: 'lifeLost', livesLeft: s.lives });
    s.contact.lastEvent = 'CRUSH';
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
      p.swing = null;
      updateLanes(s, ms, input);
      updateJump(s, dt, input);
      updateGuardInput(s, dt, input);
      if (input.attackPressed) p.bufferedAttackMs = CONTACT.attackBufferMs;
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
    if (input.attackPressed) p.bufferedAttackMs = CONTACT.attackBufferMs;
    if (input.jumpPressed) p.jumpBufferMs = JUMP_FEEL.jumpBuffer * 1000;
    if (input.specialPressed) special(s);
    return;
  }

  const prev = snapshot(s);
  if (p.swing) p.swing.elapsedMs += ms;
  updateLanes(s, ms, input);
  updateGuardInput(s, dt, input);
  if (input.specialPressed && special(s)) return; // 1) special: global, no contact needed
  updateJump(s, dt, input);
  handleAttackInput(s, input);

  if (s.combo > 0 && !bracing(s)) {
    s.comboMs -= ms;
    if (s.comboMs <= 0) breakCombo(s);
  }

  // movement: exactly one writer of the building's y this tick
  if (guardOwnsBuilding(s)) updateGuardMotion(s, dt);
  else updateFall(s, dt);
  clampUnderBuilding(s);

  // 2) guard on true contact, else 3) attack on true contact, else 4) crush
  const guarded = resolveGuardContact(s, prev, dt);
  if (!guarded) resolveAttackContact(s, prev);
  if (s.phase !== 'PLAYING') return; // the hit just cleared the building
  if (p.swing && p.swing.elapsedMs >= p.swing.activeMs) {
    if (!p.swing.consumed) { s.events.push({ t: 'whiff', lane: p.lane, variant: p.swing.variant }); s.contact.lastEvent = 'ATTACK_WHIFF'; }
    p.swing = null;
  }
  resolveDanger(s);
}

/** Drain events for the renderer / audio. */
export function takeEvents(s: RunState) {
  const e = s.events;
  s.events = [];
  return e;
}
