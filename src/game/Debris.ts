// Falling building pieces, small shards, hazard rubble, dust and score popups. Fixed caps, oldest dropped first.
import { GAME_CONFIG as C, GROUND_Y } from './config';
import type { PieceImage } from './Building';
import type { Rng } from './rng';
import type { DebrisKind } from './types';

interface Piece { img: PieceImage; x: number; y: number; vx: number; vy: number; rot: number; vr: number; bounced: boolean; life: number; }
interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; life: number; shape: number[]; }
export interface Hazard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; color: string; age: number; shape: number[]; dead: boolean; }
interface Dust { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; }
interface Popup { x: number; y: number; text: string; life: number; max: number; size: number; color: string; }

const SHARD_TINT: Record<DebrisKind, string[]> = {
  roof: ['#3d4250', '#5a6070', '#8b2a22', '#c9c2b5'],
  glass: ['#bfe7ff', '#7fc4ef', '#e8f7ff', '#5d7d99'],
  steel: ['#d2452f', '#f2f2f2', '#a3341f', '#6b6b6b'],
  stone: ['#d9c6a1', '#b9a17a', '#8e7a5c', '#efe3c8'],
  marble: ['#ffffff', '#ece9e4', '#d8d3cc', '#c9b27a'],
};

function blob(rng: Rng, n = 6) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(0.6 + rng.next() * 0.5);
  return out;
}

export class DebrisSystem {
  pieces: Piece[] = [];
  shards: Shard[] = [];
  hazards: Hazard[] = [];
  dust: Dust[] = [];
  popups: Popup[] = [];

  constructor(private rng: Rng, private onLand: (x: number, big: boolean) => void) {}

  clear() { this.pieces = []; this.shards = []; this.hazards = []; this.dust = []; this.popups = []; }

  private visualCount() { return this.pieces.length + this.shards.length; }
  private trim() {
    while (this.visualCount() > C.maxVisualDebris) {
      if (this.shards.length) this.shards.shift(); else this.pieces.shift();
    }
  }

  /** A real piece of the building falls away, plus a few small chips. */
  spawnPiece(img: PieceImage, kind: DebrisKind, push = 1) {
    const r = this.rng;
    const cx = img.x + img.w / 2, cy = img.y + img.h / 2;
    this.pieces.push({ img, x: cx, y: cy, vx: r.range(-70, 70) * push, vy: r.range(-160, -40) * push, rot: 0, vr: r.range(-3, 3), bounced: false, life: 1.6 });
    const n = 3 + Math.floor(r.next() * 4);
    const tints = SHARD_TINT[kind];
    for (let i = 0; i < n; i++) {
      this.shards.push({
        x: cx + r.range(-img.w / 3, img.w / 3), y: cy + r.range(-img.h / 3, img.h / 3),
        vx: r.range(-160, 160), vy: r.range(-280, -60), rot: r.range(0, 6), vr: r.range(-10, 10),
        size: r.range(3, 7), color: r.next() < 0.5 ? img.color : r.pick(tints), life: 1.4, shape: blob(r, 5),
      });
    }
    this.trim();
  }

  spawnShardBurst(x: number, y: number, color: string, kind: DebrisKind, n: number, speed = 1) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      this.shards.push({ x, y, vx: r.range(-220, 220) * speed, vy: r.range(-320, -40) * speed, rot: r.range(0, 6), vr: r.range(-12, 12),
        size: r.range(2.5, 6), color: r.next() < 0.5 ? color : r.pick(SHARD_TINT[kind]), life: 1.2, shape: blob(r, 5) });
    }
    this.trim();
  }

  /** Dangerous rubble: pops up first so its fall is always readable, and has a ground marker. */
  spawnHazard(x: number, y: number, color: string) {
    if (this.hazards.length >= C.maxHazards) return;
    const r = this.rng;
    this.hazards.push({ x, y, vx: r.range(-90, 90), vy: r.range(-330, -230), rot: 0, vr: r.range(-4, 4), r: r.range(12, 16), color, age: 0, shape: blob(r, 7), dead: false });
  }

  addDust(x: number, y: number, n: number, color = 'rgba(235,225,205,') {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const max = r.range(0.4, 0.9);
      this.dust.push({ x: x + r.range(-10, 10), y, vx: r.range(-90, 90), vy: r.range(-70, -10), life: max, max, size: r.range(5, 13), color });
    }
    if (this.dust.length > 160) this.dust.splice(0, this.dust.length - 160);
  }

  popup(x: number, y: number, text: string, size = 22, color = '#fff') {
    this.popups.push({ x, y, text, life: 0.75, max: 0.75, size, color });
    if (this.popups.length > 24) this.popups.shift();
  }

  /** Where a hazard will hit the ground (for the warning marker). */
  static landingX(h: Hazard) {
    const g = C.gravity, dy = GROUND_Y - h.r - h.y;
    const t = (-h.vy + Math.sqrt(Math.max(0, h.vy * h.vy + 2 * g * dy))) / g;
    return { x: h.x + h.vx * t, t };
  }

  update(dt: number) {
    const g = C.gravity;
    for (const p of this.pieces) {
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const bottom = GROUND_Y - Math.min(p.img.h, p.img.w) * 0.3;
      if (p.y > bottom) {
        if (!p.bounced) {
          p.bounced = true; p.y = bottom; p.vy *= -0.28; p.vx *= 0.5; p.vr *= 0.5;
          this.addDust(p.x, GROUND_Y, 4); this.onLand(p.x, p.img.w > 30);
        } else { p.y = bottom; p.vy = 0; p.vx *= 0.9; p.life = Math.min(p.life, 0.35); }
      }
      if (p.bounced) p.life -= dt * 1.4;
    }
    this.pieces = this.pieces.filter((p) => p.life > 0);
    for (const s of this.shards) {
      s.vy += g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      if (s.y > GROUND_Y) { s.y = GROUND_Y; s.vy *= -0.35; s.vx *= 0.6; s.life = Math.min(s.life, 0.4); }
      s.life -= dt;
    }
    this.shards = this.shards.filter((s) => s.life > 0);
    for (const h of this.hazards) {
      h.age += dt; h.vy += g * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
      if (h.y > GROUND_Y - h.r) { // lands and breaks harmlessly
        h.dead = true;
        this.spawnShardBurst(h.x, GROUND_Y - 4, h.color, 'stone', 5, 0.7);
        this.addDust(h.x, GROUND_Y, 5);
        this.onLand(h.x, true);
      }
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
    for (const d of this.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.life -= dt; }
    this.dust = this.dust.filter((d) => d.life > 0);
    for (const p of this.popups) { p.y -= 55 * dt; p.life -= dt; }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  drawBack(ctx: CanvasRenderingContext2D, time: number) {
    // hazard landing warnings on the ground
    for (const h of this.hazards) {
      const { x, t } = DebrisSystem.landingX(h);
      const k = Math.max(0, Math.min(1, 1 - t / 1.1));
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.5 * k;
      ctx.fillStyle = `rgba(255,${60 - 40 * k | 0},40,1)`;
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 4, h.r * (0.6 + 0.8 * k), 4 + 2 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      if (Math.sin(time * 0.03) > 0) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('!', x, GROUND_Y + 9);
      }
      ctx.restore();
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    for (const p of this.pieces) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.35));
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(p.img.canvas, -p.img.w / 2, -p.img.h / 2, p.img.w, p.img.h);
      ctx.restore();
    }
    for (const s of this.shards) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 0.4));
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      polyBlob(ctx, s.shape, s.size);
      ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,20,30,0.7)'; ctx.stroke();
      ctx.restore();
    }
    for (const h of this.hazards) {
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate(h.rot);
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.025);
      ctx.shadowColor = 'rgba(255,40,30,0.95)'; ctx.shadowBlur = 12 + 6 * pulse;
      ctx.fillStyle = h.color;
      polyBlob(ctx, h.shape, h.r);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,${50 + 60 * pulse | 0},40,1)`; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#2a0a08'; ctx.stroke();
      ctx.restore();
    }
    for (const d of this.dust) {
      ctx.fillStyle = `${d.color}${(d.life / d.max) * 0.7})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.size * (1.4 - d.life / d.max * 0.6), 0, Math.PI * 2); ctx.fill();
    }
  }

  drawPopups(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const p of this.popups) {
      const k = p.life / p.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${p.size * pop}px "Arial Black", system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#1b1530'; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}

function polyBlob(ctx: CanvasRenderingContext2D, shape: number[], r: number) {
  ctx.beginPath();
  for (let i = 0; i < shape.length; i++) {
    const a = (i / shape.length) * Math.PI * 2;
    const x = Math.cos(a) * r * shape[i], y = Math.sin(a) * r * shape[i];
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
