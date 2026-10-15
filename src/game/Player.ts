import { GAME_CONFIG as C, GROUND_Y, HERO_H } from './config';

export { HERO_H };

const BLUE = '#2f6bff';
const INK = '#14123a';
const SWORD_LEN = HERO_H * 0.5;

/** A deliberately simple blue stick figure with a sword, drawn in code so every pose animates smoothly. */
export class Player {
  x = 640;
  /** height of the feet above the ground (jumping) */
  y = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  minX = 30; maxX = 1250;
  private moving = false;
  private runT = 0;
  attackMs = 0; // >0 while the sword swing shows
  hurtMs = 0;
  guardMs = 0; // >0 while guarding (↓)
  knockV = 0;
  ultLift = 0; // 0..1 power-up jump during the special
  private cooldownMs = 0;

  reset(x: number) {
    this.x = x; this.y = 0; this.vy = 0; this.attackMs = 0; this.hurtMs = 0; this.knockV = 0;
    this.ultLift = 0; this.cooldownMs = 0; this.guardMs = 0; this.facing = 1;
  }

  get onGround() { return this.y <= 0; }

  /** Movement; dt in seconds. */
  move(dir: number, dt: number) {
    this.moving = dir !== 0;
    if (dir) this.facing = dir > 0 ? 1 : -1;
    this.x += dir * C.playerSpeed * dt + this.knockV * dt;
    this.knockV *= Math.pow(0.002, dt);
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    if (this.moving) this.runT += dt;
  }

  jump() {
    if (!this.onGround || this.hurtMs > 0) return false;
    this.vy = C.jumpVelocity;
    return true;
  }

  /**
   * Gravity. `maxY` is the highest the feet may go this frame (the building's underside above the head):
   * jumping into the building stops the hero there instead of passing through it.
   */
  physics(dt: number, maxY: number) {
    if (this.y > 0 || this.vy > 0) {
      this.vy -= C.jumpGravity * dt;
      this.y += this.vy * dt;
      if (this.y > maxY) { this.y = Math.max(0, maxY); if (this.vy > 0) this.vy = 0; }
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    } else if (this.y > maxY) {
      this.y = Math.max(0, maxY);
    }
  }

  tick(dtMs: number) {
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.attackMs = Math.max(0, this.attackMs - dtMs);
    this.hurtMs = Math.max(0, this.hurtMs - dtMs);
    this.guardMs = Math.max(0, this.guardMs - dtMs);
  }

  canAttack() { return this.cooldownMs <= 0 && this.hurtMs <= 0; }
  startAttack() { this.cooldownMs = C.attackCooldownMs; this.attackMs = 170; }
  hurt(fromX: number) { this.hurtMs = 420; this.knockV = (this.x >= fromX ? 1 : -1) * 260; this.attackMs = 0; }

  /** World y of the top of the head. */
  get headY() { return GROUND_Y - HERO_H - this.hop; }

  get hop() {
    if (this.ultLift) return this.y + this.ultLift * 60;
    if (this.onGround && this.moving) return Math.abs(Math.sin(this.runT * 16)) * 4;
    return this.y;
  }

  draw(ctx: CanvasRenderingContext2D, time: number, invulnerable: boolean) {
    // ground shadow shrinks while airborne
    const s = Math.max(0.35, 1 - this.hop / 260);
    ctx.fillStyle = 'rgba(20,20,40,0.28)';
    ctx.beginPath(); ctx.ellipse(this.x, GROUND_Y + 2, 20 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (invulnerable && Math.floor(time / 80) % 2 === 0) return; // blink

    const H = HERO_H;
    const headR = H * 0.15;
    const hip = { x: 0, y: -H * 0.42 };
    const neck = { x: 0, y: -H * 0.74 };
    const attacking = this.attackMs > 0;
    const hurt = this.hurtMs > 0;
    const air = !this.onGround;
    const leg = H * 0.42, arm = H * 0.3;

    // pose: limb angles from straight down (positive = forward), + lean; sword angle is the sword arm's
    let lean = 0, lLeg = 0.15, rLeg = -0.15, lArm = -0.35, rArm = 0.5, sword = 2.2;
    const guarding = this.guardMs > 0 && !hurt;
    if (guarding) {
      // sword held flat overhead as a shield
      lean = 0; lLeg = 0.45; rLeg = -0.45; lArm = Math.PI - 0.55; rArm = -(Math.PI - 0.55); sword = Math.PI / 2;
    } else if (hurt) {
      lean = -0.35; lLeg = 0.5; rLeg = -0.2; lArm = -2.4; rArm = 2.1 + Math.sin(time * 0.05) * 0.5; sword = 2.6;
    } else if (attacking || this.ultLift > 0) {
      // overhead slash: the sword sweeps from front to back over the head
      const k = this.ultLift > 0 ? 0.5 : 1 - this.attackMs / 170;
      rArm = 2.3 + k * 1.3; sword = rArm; lArm = -0.6; lLeg = 0.35; rLeg = -0.1; lean = -0.1;
    } else if (air) {
      lLeg = 0.7; rLeg = -0.3; lArm = -1.2; rArm = 2.4; sword = 2.6;
    } else if (this.moving) {
      const sw = Math.sin(this.runT * 16);
      lean = 0.18; lLeg = sw * 0.75; rLeg = -sw * 0.75; lArm = -sw * 0.9; rArm = 0.9 + sw * 0.3; sword = 1.9;
    } else {
      const b = Math.sin(time * 0.004) * 0.05;
      lArm += b; rArm -= b;
    }

    ctx.save();
    ctx.translate(this.x, GROUND_Y - this.hop);
    ctx.scale(this.facing, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const end = (from: { x: number; y: number }, ang: number, len: number) => ({ x: from.x + Math.sin(ang) * len, y: from.y + Math.cos(ang) * len });
    const limb = (from: { x: number; y: number }, ang: number, len: number) => {
      const e = end(from, ang, len);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    };
    ctx.rotate(lean);
    const shoulder = { x: neck.x, y: neck.y + H * 0.04 };
    const hand = end(shoulder, rArm, arm);
    // sword (behind the body lines so the hand covers the hilt)
    const tip = end(hand, sword, SWORD_LEN);
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    const guardA = sword + Math.PI / 2, gl = 6;
    ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hand.x + Math.sin(guardA) * gl, hand.y + Math.cos(guardA) * gl); ctx.lineTo(hand.x - Math.sin(guardA) * gl, hand.y - Math.cos(guardA) * gl); ctx.stroke();
    for (const [w, c] of [[9, INK], [5.5, BLUE]] as const) {
      ctx.lineWidth = w; ctx.strokeStyle = c;
      limb(hip, lLeg, leg); limb(hip, rLeg, leg);
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
      limb(shoulder, lArm, arm); limb(shoulder, rArm, arm);
    }
    // head
    const head = { x: neck.x + H * 0.02, y: neck.y - headR * 0.95 };
    ctx.fillStyle = BLUE; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(head.x - headR * 0.35, head.y - headR * 0.35, headR * 0.28, 0, Math.PI * 2); ctx.fill();
    // guard shield glow
    if (guarding) {
      ctx.strokeStyle = 'rgba(143,240,255,.85)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, neck.y - headR, H * 0.55, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.restore();
  }
}
