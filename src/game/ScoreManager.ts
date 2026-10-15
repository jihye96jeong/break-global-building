// Score, combo, super gauge and lives. Pure state with explicit time so it can be unit tested.
import { GAME_CONFIG as C } from './config';

export function comboMultiplier(combo: number) {
  if (combo < 1) return 1;
  return Math.min(1 + Math.floor((combo - 1) / 4) * 0.25, C.maxComboMultiplier);
}

/** Combos charge the special much faster: x1 under 5 hits, then +0.5 every 5 hits, up to x3. */
export function comboGaugeBoost(combo: number) {
  return Math.min(1 + Math.floor(Math.max(0, combo) / 5) * 0.5, 3);
}

export class ScoreManager {
  score = 0;
  combo = 0;
  gauge = 0;
  lives: number = C.maxLives;
  hitsThisStage = 0;
  private lastHitAt = -Infinity;
  private invulnUntil = -Infinity;

  reset() {
    this.score = 0; this.combo = 0; this.gauge = 0; this.lives = C.maxLives;
    this.hitsThisStage = 0; this.lastHitAt = -Infinity; this.invulnUntil = -Infinity;
  }

  startStage() {
    this.combo = 0; this.hitsThisStage = 0; this.lastHitAt = -Infinity; this.invulnUntil = -Infinity; // gauge carries over
  }

  /** A successful attack (tile cracked or broken). Returns points awarded. */
  registerHit(now: number, destroyed: boolean, stageMult: number, gaugeGain: number = C.ultimateGainPerHit): number {
    this.combo = now - this.lastHitAt <= C.comboWindowMs ? this.combo + 1 : 1;
    this.lastHitAt = now;
    this.gauge = Math.min(C.ultimateMax, this.gauge + gaugeGain * comboGaugeBoost(this.combo));
    const pts = destroyed
      ? Math.round(C.successfulHitScore * comboMultiplier(this.combo) * stageMult)
      : Math.round(C.damageOnlyScore * stageMult);
    this.score += pts;
    return pts;
  }

  /** Combo display resets once the window passes; gauge stays. */
  update(now: number) {
    if (this.combo > 0 && now - this.lastHitAt > C.comboWindowMs) this.combo = 0;
  }

  add(points: number) {
    const p = Math.round(points);
    this.score += p;
    return p;
  }

  get gaugeFull() { return this.gauge >= C.ultimateMax; }

  /** Spend the full gauge. False if it was not full. */
  useUltimate(): boolean {
    if (!this.gaugeFull) return false;
    this.gauge = 0;
    return true;
  }

  isInvulnerable(now: number) { return now < this.invulnUntil; }

  grantInvulnerability(now: number, ms: number) { this.invulnUntil = Math.max(this.invulnUntil, now + ms); }

  /** Hazard contact. Returns true if a life was lost. */
  takeHit(now: number): boolean {
    if (this.lives <= 0 || this.isInvulnerable(now)) return false;
    this.lives -= 1;
    this.hitsThisStage += 1;
    this.invulnUntil = now + C.invulnerabilityMs;
    return true;
  }

  get dead() { return this.lives <= 0; }
}
