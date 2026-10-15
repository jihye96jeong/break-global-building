import { GAME_CONFIG as C, GROUND_Y, HERO_H } from './config';

export { HERO_H };

const BLUE = '#2f6bff';
const INK = '#14123a';

/** A deliberately simple blue stick figure, drawn in code so every pose animates smoothly. */
export class Player {
  x = 640;
  facing: 1 | -1 = 1;
  minX = 30; maxX = 1250;
  private moving = false;
  private runT = 0;
  attackMs = 0; // >0 while the attack pose shows
  hurtMs = 0;
  guardMs = 0; // >0 while pushing up against the building
  knockV = 0;
  ultLift = 0; // 0..1 power-up jump during the ultimate
  private cooldownMs = 0;

  reset(x: number) { this.x = x; this.attackMs = 0; this.hurtMs = 0; this.knockV = 0; this.ultLift = 0; this.cooldownMs = 0; this.guardMs = 0; this.facing = 1; }

  /** Movement; dt in seconds. */
  move(dir: number, dt: number) {
    this.moving = dir !== 0;
    if (dir) this.facing = dir > 0 ? 1 : -1;
    this.x += dir * C.playerSpeed * dt + this.knockV * dt;
    this.knockV *= Math.pow(0.002, dt);
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    if (this.moving) this.runT += dt;
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

  /** Fist position for the attack trail. */
  get fist() { return { x: this.x + this.facing * 8, y: GROUND_Y - HERO_H - 10 - this.hop }; }

  get hop() {
    if (this.ultLift) return this.ultLift * 60;
    if (this.attackMs > 0) return Math.sin((1 - this.attackMs / 170) * Math.PI) * 18;
    if (this.moving) return Math.abs(Math.sin(this.runT * 16)) * 4;
    return 0;
  }

  draw(ctx: CanvasRenderingContext2D, time: number, invulnerable: boolean) {
    // ground shadow
    ctx.fillStyle = 'rgba(20,20,40,0.28)';
    ctx.beginPath(); ctx.ellipse(this.x, GROUND_Y + 2, 20 - this.hop * 0.15, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (invulnerable && Math.floor(time / 80) % 2 === 0) return; // blink

    const H = HERO_H;
    const headR = H * 0.15;
    const hip = { x: 0, y: -H * 0.42 };
    const neck = { x: 0, y: -H * 0.74 };
    const attacking = this.attackMs > 0 || this.ultLift > 0;
    const hurt = this.hurtMs > 0;
    const leg = H * 0.42, arm = H * 0.3;

    // pose: [angle from straight down] for each limb, + lean
    let lean = 0, lLeg = 0.15, rLeg = -0.15, lArm = 0.35, rArm = -0.35;
    const guarding = this.guardMs > 0 && !hurt;
    if (guarding) {
      lean = 0; lLeg = 0.45; rLeg = -0.45; lArm = Math.PI - 0.5; rArm = -(Math.PI - 0.5); // both arms braced overhead
    } else if (hurt) {
      lean = -0.35; lLeg = 0.5; rLeg = -0.2; lArm = 2.4; rArm = -2.1 + Math.sin(time * 0.05) * 0.5;
    } else if (attacking) {
      lean = -0.08; lLeg = 0.45; rLeg = -0.05; rArm = Math.PI - 0.12; lArm = 0.9; // punching straight up
    } else if (this.moving) {
      const s = Math.sin(this.runT * 16);
      lean = 0.18; lLeg = s * 0.75; rLeg = -s * 0.75; lArm = -s * 0.9; rArm = s * 0.9;
    } else {
      const b = Math.sin(time * 0.004) * 0.05;
      lArm += b; rArm -= b;
    }

    ctx.save();
    ctx.translate(this.x, GROUND_Y - this.hop);
    ctx.scale(this.facing, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const limb = (from: { x: number; y: number }, ang: number, len: number) => {
      // angle 0 = straight down, positive = forward
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(from.x + Math.sin(ang) * len, from.y + Math.cos(ang) * len); ctx.stroke();
    };
    ctx.rotate(lean);
    const shoulder = { x: neck.x, y: neck.y + H * 0.04 };
    for (const [w, c] of [[9, INK], [5.5, BLUE]] as const) {
      ctx.lineWidth = w; ctx.strokeStyle = c;
      limb(hip, lLeg, leg); limb(hip, rLeg, leg);
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
      limb(shoulder, lArm, arm); limb(shoulder, rArm, arm);
    }
    // fist glow while punching
    if (attacking) {
      const f = { x: shoulder.x + Math.sin(rArm) * arm, y: shoulder.y + Math.cos(rArm) * arm };
      ctx.fillStyle = 'rgba(190,225,255,.9)';
      ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    // head
    const head = { x: neck.x + H * 0.02, y: neck.y - headR * 0.95 };
    ctx.fillStyle = BLUE; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(head.x - headR * 0.35, head.y - headR * 0.35, headR * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
