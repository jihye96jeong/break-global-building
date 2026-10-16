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

export const GUARD_FEEL = {
  guardReachAboveHead: 8, // the raised sword is 8 wu above the head: that is the contact plane
  contactLookAhead: 16, // contact happens when the building's underside is within this of the plane
  maxSnapCorrection: 7, // never snap more than this; deeper overlap means the guard came too late
  braceCompression: 4,
  braceCompressionMs: 35,
  holdMs: { ground: 120, air: 110 },
  repelUnits: { ground: 85, air: 35 },
  repelMs: { ground: 210, air: 160 },
  releaseBlendMs: 80,
  contactCooldownMs: 280,
  counterWindowMs: 350, // a hit this soon after a guard shows COUNTER! (no extra damage)
};

export const ATTACK_FEEL = {
  intervalMs: 95,
  bufferMs: 100, // one press during cooldown / guard hold is kept
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
