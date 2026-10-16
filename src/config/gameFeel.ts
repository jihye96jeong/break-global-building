// Game-feel values (spec v2.0 "feelConfig"): jump, guard contact, attack rhythm, hit-stop, camera, debris.
// Tuning values for this game, not measured from the original. Everything feel-related reads from here.

export const JUMP_FEEL = {
  jumpVelocity: 820, // up, wu/s
  gravityAscending: 1650,
  gravityDescending: 2600,
  jumpCutVelocityFactor: 0.56, // release early → short hop
  jumpCutWindow: 0.2, // s
  jumpBuffer: 0.25, // s: a press just before landing still jumps (and holding ↑ jumps again on landing)
  landingSquashMs: 100,
  takeoffStretchMs: 100,
  clingMs: 300, // an airborne hero who reaches the underside sticks to it this long (and while Z or ↓ is held)
  airGuardDropVelocity: 260, // wu/s down: after an air guard the hero drops straight back to the ground
  landNowVelocity: 900, // wu/s down: after a floor breaks (or a new building comes) the hero drops straight to the ground
  homingOvershoot: 10, // wu: a leap toward a high building aims a little past its underside so it always touches
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
  fallAccel: 3000, // wu/s²: after a hit the building accelerates back to its fall speed
  pressureFromSpeed: 190, // at or below this fall speed a hit holds the building still…
  pressureFactor: 0.28, // …above it, endless creeps down at (speed − 190) × this (story levels set their own, 0 → 130 wu/s)
  pressureHoldMs: 150, // the creep lasts this long after a hit; with no new hit the building speeds back up
  // after a floor breaks: what is left floats up (~14 wu), then comes down SLOWLY for a while so the hero, who has
  // just landed, has time to set up the next cut; only then does it speed back up to the level's fall speed
  breakPopVelocity: 205, // wu/s up
  postBreakSettleAccel: 1500, // wu/s²: gentle float up and turn-around
  postBreakSlowFactor: 0.45, // the slow descent is this share of the fall speed…
  postBreakSlowMin: 80, // …but at least this (wu/s)
  postBreakSettleMs: 900, // how long the slow descent lasts
};

export const GUARD_FEEL = {
  guardReachAboveHead: 12, // guard pose: the raised flat blade — the same height as the attack blade, so touching = touching
  braceCompression: { ground: 4, air: 2.5 },
  braceCompressionMs: 35,
  holdMs: { ground: 200, air: 170 }, // the building visibly stops on the blade for a moment
  repelUnits: { ground: 36, air: 18 },
  repelMs: { ground: 170, air: 140 },
  releaseBlendMs: 70,
  postGuardSlowFactor: 0.15, // after the push it comes back down much slower (this share of its fall speed)…
  postGuardSlowMin: 35, // …at least this (wu/s)…
  postGuardSlowMs: 1300, // …for this long, then speeds back up to its normal fall
  counterWindowMs: 500, // a real re-contact hit this soon after the push shows COUNTER! (no extra damage)
};

export const ATTACK_FEEL = {
  intervalMs: 95,
  swingVariants: 3,
};

/** v4 §7: special = charge → slash sweeps bottom→top bursting each floor → top finish → quick return (≈1.0–1.45 s). */
export const SPECIAL_SEQ = {
  chargeMs: 110,
  sweepBaseMs: 380,
  sweepPerFloorMs: 28,
  sweepMinMs: 460,
  sweepMaxMs: 820,
  finishStopMs: 70,
  returnMs: 360,
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
