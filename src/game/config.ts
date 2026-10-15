// Desktop-first landscape stage (16:10), letterboxed with "contain" on any other screen.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const GROUND_Y = 650; // hero feet / building base
export const HERO_H = 82;
export const BUILDING_MAX_W = 700;
export const BUILDING_MAX_H = 540; // tall ones start partly above the screen and sink into view
/** where a fresh building's base hangs: well above the hero's head */
export const BUILDING_START_BASE = GROUND_Y - HERO_H - 170;
/** the building crushes the hero when its lowest piece sinks to here */
export const CRUSH_Y = GROUND_Y - HERO_H * 0.9;
export const BUILDING_TOP = 118; // HUD bottom, used by effects

export const GAME_CONFIG = {
  maxLives: 3,
  playerSpeed: 255, // logical px/sec
  attackCooldownMs: 175,
  attackRangeX: 85,
  // sword: hits what is just above the hero's head (jump to reach a high building)
  swordReachX: 60,
  swordReachUp: 80,
  jumpVelocity: 860, // px/s up
  jumpGravity: 1800, // px/s² → apex ≈ 205 px
  guardWindowMs: 450, // ↓ also knocks falling stones away for this long
  tileBaseHP: 1,
  successfulHitScore: 100,
  damageOnlyScore: 20,
  chainScore: 40,
  ultimateTileScore: 50,
  ultimateGainPerHit: 8,
  ultimateMax: 100,
  invulnerabilityMs: 1250,
  comboWindowMs: 1500,
  maxComboMultiplier: 3,
  clearBonus: 1200,
  noDamageBonus: 500,
  buildingBonus: 300,
  // GUARD (↓): halts the sinking building for a moment
  guardMax: 100,
  guardCost: 30,
  guardRegenPerSec: 12,
  guardHaltMs: 1200,
  guardPush: 18,
  crushPushBack: 170,
  hitStopMs: 50,
  tutorialMs: 8000,
  supportShakeMs: 250,
  gravity: 900,
  maxVisualDebris: 100,
  maxHazards: 12,
  // a cut-off chunk only falls if it is at most this share of the building's starting tiles;
  // bigger chunks stay up (cartoon physics) so one hit can never drop most of the landmark
  maxChainShare: 0.3,
} as const;

export const STORAGE_BEST = 'world-breaker-best-score';
export const STORAGE_SOUND = 'world-breaker-sound-enabled';
