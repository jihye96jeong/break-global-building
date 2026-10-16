// Game-feel values (spec v2.0 "feelConfig"): jump, guard contact, attack rhythm, hit-stop, camera, debris.
// Tuning values for this game, not measured from the original. Everything feel-related reads from here.

export const JUMP_FEEL = {
  jumpVelocity: 820, // up, wu/s
  gravityAscending: 1650,
  gravityDescending: 2600,
  jumpCutVelocityFactor: 0.56, // release early → short hop
  jumpCutWindow: 0.2, // s
  jumpBuffer: 0.11, // s: a press just before landing still jumps
  landingSquashMs: 100,
  takeoffStretchMs: 100,
};

/**
 * v3.0 contact geometry: an attack or guard counts only when the pose's visible contact surface actually meets the
 * underside of the lowest floor (swept across the tick, so fast falls cannot skip it). 2 wu is a pixel tolerance, not a range.
 */
export const CONTACT = {
  touchEpsilonWu: 2, // gap ≤ this counts as touching
  maxPenetrationWu: 3, // deeper overlap than this never hits / guards
  attackReachAboveHead: 12, // attack pose: the swept blade's top edge, drawn exactly here
  bladeHalfWidth: 0.32, // lane units: horizontal half-span of the blade around the hero
  minHorizontalOverlap: 0.02, // lane units (≈ 2 wu)
  attackActiveMs: 55, // a tapped swing can connect during this window only
  heldActiveMs: 95, // auto-repeat while Z is held: the blade stays live until the next swing (no dead gaps)
  attackBufferMs: 70,
  fallAccel: 3000, // wu/s²: a struck building stops dead, then falls back onto the blade
  postBreakSettleSpeed: 400, // wu/s: the next floor drops fast onto the blade after a floor break…
  postBreakSettleMs: 140,
  postBreakSettleAccel: 6000,
  settleEaseGap: [6, 26] as [number, number], // …easing back to normal speed over the last 26 → 6 wu
};

export const GUARD_FEEL = {
  guardReachAboveHead: 8, // guard pose: the raised flat blade is 8 wu above the head
  readyWindowMs: 180, // one press arms the guard this long; holding longer does nothing (no auto-guard)
  preContactBufferMs: 70, // a press released early still counts if contact comes within this
  braceCompression: { ground: 4, air: 2.5 },
  braceCompressionMs: 35,
  holdMs: { ground: 120, air: 100 },
  repelUnits: { ground: 36, air: 18 },
  repelMs: { ground: 170, air: 140 },
  releaseBlendMs: 70,
  contactCooldownMs: 280,
  counterWindowMs: 500, // a real re-contact hit this soon after the push shows COUNTER! (no extra damage)
};

export const ATTACK_FEEL = {
  intervalMs: 95,
  swingVariants: 3,
};

export const HITSTOP_MS = { hit: 28, floor: 52, building: 70, special: 75 };

/** Camera impulses in world units (≈ px at 1:1); summed impulses are capped. */
export const CAMERA_FEEL = {
  cap: 10,
  hit: { amp: 2, ms: 50 },
  heavyHit: { amp: 3, ms: 60 },
  floor: { amp: 5, ms: 95 },
  guardGround: { amp: 3.5, ms: 80 },
  guardAir: { amp: 2.5, ms: 70 },
  building: { amp: 8, ms: 140 },
  damage: { amp: 8, ms: 160 },
  special: { amp: 9, ms: 160 },
  land: { amp: 1.2, ms: 60 },
};

export const DEBRIS_FEEL = {
  chunkSpeedX: [-170, 170],
  chunkSpeedY: [-260, -90],
  chipSpeedX: [-240, 240],
  chipSpeedY: [-310, 40],
  gravity: [820, 1250],
  angularSpeed: [-8, 8],
  chunkCount: [3, 6],
  chipCount: [12, 26],
  smokeCount: [5, 10],
  maxParticlesDesktop: 260,
  maxParticlesMobile: 140,
  crackSweepMs: 30,
  ghostMs: 45,
  recoilUnits: 4,
  recoilMs: 70,
};

export const COMBO_TIERS = [
  { at: 100, text: 'LEGENDARY!' },
  { at: 50, text: 'UNSTOPPABLE!' },
  { at: 25, text: 'RUSH!' },
  { at: 10, text: 'COMBO' },
];
