// Canvas drawing in world units: the world is 600 tall; its width follows the screen's aspect (spec §11.1).
import { BALANCE, GROUND_Y, WORLD_H } from '../config/balance';
import { landmarkById } from '../config/landmarks';
import type { RunState } from '../core/game';
import { imageNow } from './assets';
import { drawHero } from './character';
import { refreshMarks, type BuildingVisual } from './landmark';
import type { Particles } from './particles';

const SKY_GRAD: Record<string, [string, string]> = { day: ['#7cc4f2', '#d9f0ff'], sunset: ['#ff9a62', '#ffe0b0'], night: ['#0d1638', '#33407a'] };

export interface FrameFx {
  shake: number;
  flash: number; // 0..1 white flash
  redFlash: number; // 0..1 hurt tint
  cutin: number; // 0..1 special cut-in strength
  waveCard: { name: string; sub: string; elite: boolean; k: number } | null;
  countdown: number | null;
  showHp: boolean;
  reducedMotion: boolean;
}

export class Renderer {
  readonly g: CanvasRenderingContext2D;
  scale = 1; // device px per world unit
  worldW = 960;
  laneGap = 120; // eased toward the current building's lane spacing
  private cssScale = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
  }

  /** Recompute pixel mapping only; world state never changes on resize (spec §14.3). */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.cssScale = r.height / WORLD_H;
    this.scale = this.cssScale * dpr;
    this.worldW = r.width / this.cssScale;
  }

  laneX(lane: number) { return this.worldW / 2 + (lane - 1) * this.laneGap; }

  /** Screen (CSS px) x → lane index, for touch lane taps. */
  laneAtClientX(clientX: number): 0 | 1 | 2 {
    const r = this.canvas.getBoundingClientRect();
    const wx = (clientX - r.left) / this.cssScale;
    const d = (wx - this.worldW / 2) / this.laneGap;
    return (d < -0.5 ? 0 : d > 0.5 ? 2 : 1);
  }

  draw(s: RunState, visual: BuildingVisual | null, fx: Particles, f: FrameFx, time: number, bgLandmarkId: string) {
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.save();
    if (f.shake > 0 && !f.reducedMotion) g.translate((Math.random() * 2 - 1) * f.shake, (Math.random() * 2 - 1) * f.shake);
    else if (f.shake > 0) g.translate((Math.random() * 2 - 1) * f.shake * 0.25, 0);
    this.drawBackground(bgLandmarkId);

    const b = s.building;
    if (visual) this.laneGap += (visual.width / 3 - this.laneGap) * 0.2;
    if (b && visual && visual.buildingId === b.id && !b.defeated) this.drawBuilding(s, visual, time, f.showHp);

    fx.draw(g);
    const p = s.player;
    const k = p.laneAnimMs > 0 ? 1 - p.laneAnimMs / BALANCE.laneMoveMs : 1;
    const ease = 1 - (1 - k) * (1 - k);
    const x = this.laneX(p.laneFrom) + (this.laneX(p.lane) - this.laneX(p.laneFrom)) * ease;
    const invuln = s.invulnMs > 0 && s.phase !== 'SPECIAL_CUTIN';
    drawHero(g, {
      x, y: p.y, facing: p.facing,
      attackK: p.attackAnimMs > 0 ? 1 - p.attackAnimMs / BALANCE.attackAnimMs : -1,
      guarding: p.guarding, air: p.y > 0, moving: p.laneAnimMs > 0, hurt: s.phase === 'HIT_FREEZE',
      special: s.phase === 'SPECIAL_CUTIN' ? Math.sin(Math.min(1, 1 - s.phaseMs / BALANCE.specialCutinMs) * Math.PI) : 0,
      time, blink: invuln && Math.floor(time / 80) % 2 === 0,
    });
    fx.drawPops(g);
    g.restore();

    // full-screen layers (no shake)
    if (f.cutin > 0) this.drawCutin(f.cutin);
    if (f.flash > 0) { g.fillStyle = `rgba(255,255,255,${(f.reducedMotion ? 0.3 : 0.75) * f.flash})`; g.fillRect(0, 0, this.worldW, WORLD_H); }
    if (f.redFlash > 0) { g.fillStyle = `rgba(220,30,40,${0.35 * f.redFlash})`; g.fillRect(0, 0, this.worldW, WORLD_H); }
    if (f.countdown) this.bigText(String(f.countdown), WORLD_H * 0.42, 120, '#ffe066');
    if (f.waveCard) this.drawWaveCard(f.waveCard);
  }

  private drawBackground(landmarkId: string) {
    const g = this.g;
    const l = landmarkById(landmarkId);
    const [a, b] = SKY_GRAD[l.sky];
    const grd = g.createLinearGradient(0, 0, 0, GROUND_Y);
    grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(-20, -20, this.worldW + 40, WORLD_H + 40);
    const img = imageNow(l.background);
    if (img) {
      const h = Math.max(GROUND_Y + 40, (this.worldW + 20) * (img.naturalHeight / img.naturalWidth));
      const w = h * (img.naturalWidth / img.naturalHeight);
      g.drawImage(img, (this.worldW - w) / 2, GROUND_Y + 40 - h, w, h);
    }
    const ground = g.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
    ground.addColorStop(0, '#d9cdb5'); ground.addColorStop(0.25, '#9b8b78'); ground.addColorStop(1, '#3a3352');
    g.fillStyle = ground; g.fillRect(-20, GROUND_Y, this.worldW + 40, WORLD_H - GROUND_Y + 20);
    g.fillStyle = '#1b1530'; g.fillRect(-20, GROUND_Y - 1.5, this.worldW + 40, 3);
  }

  private drawBuilding(s: RunState, v: BuildingVisual, time: number, showHp: boolean) {
    const g = this.g;
    const b = s.building!;
    const x0 = this.worldW / 2 - v.width / 2;
    // danger: red glow on the ground as the building nears it
    const gap = GROUND_Y - b.bottomY;
    if (gap < 140) {
      const k = Math.max(0, 1 - gap / 140);
      const grd = g.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
      grd.addColorStop(0, 'rgba(255,50,40,0)'); grd.addColorStop(1, `rgba(255,50,40,${0.55 * k})`);
      g.fillStyle = grd; g.fillRect(x0 - 20, GROUND_Y - 60, v.width + 40, 60);
    }
    if (b.elite) {
      g.save();
      g.shadowColor = `rgba(255,200,60,${0.6 + 0.3 * Math.sin(time * 0.008)})`; g.shadowBlur = 24;
    }
    let bottom = b.bottomY;
    for (const f of b.floors) {
      const fv = v.floors.get(f.id);
      if (!fv) { bottom -= f.height; continue; }
      refreshMarks(v, f, this.scale, time);
      const top = bottom - f.height;
      const y = top - fv.padTop, h = f.height + fv.padTop + fv.padBottom;
      g.drawImage(fv.canvas, x0, y, v.width, h);
      g.drawImage(fv.marks, x0, y, v.width, h);
      bottom = top;
    }
    if (b.elite) g.restore();

    // lane chips under the current lowest floor: what each lane takes to break
    const f0 = b.floors[0];
    if (!f0) return;
    for (let lane = 0; lane < 3; lane++) {
      const hp = f0.hp[lane];
      const cx = this.laneX(lane), cy = b.bottomY + 14;
      const w = Math.min(46, this.laneGap * 0.7), h = 14;
      const col = hp === 1 ? '#ffd84a' : hp === 2 ? '#e9eef7' : '#5d6f94';
      const active = s.player.lane === lane;
      g.fillStyle = 'rgba(20,16,40,0.75)';
      g.beginPath(); g.roundRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, 8); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 6); g.fill();
      if (hp === 3) { g.strokeStyle = '#e2b54a'; g.lineWidth = 2; g.stroke(); }
      // pips: one per hit still needed
      g.fillStyle = hp === 3 ? '#e2b54a' : '#1b1530';
      for (let k = 0; k < hp; k++) { g.beginPath(); g.arc(cx + (k - (hp - 1) / 2) * 9, cy, 2.6, 0, Math.PI * 2); g.fill(); }
      if (hp === 1) { g.strokeStyle = '#1b1530'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - w / 2 + 4, cy - 3); g.lineTo(cx - 6, cy + 3); g.lineTo(cx - 2, cy - 2); g.stroke(); }
      if (active) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 10); g.stroke(); }
      if (showHp) { g.fillStyle = '#fff'; g.font = '900 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`HP${hp}`, cx, cy + 22); }
    }
  }

  private drawCutin(k: number) {
    const g = this.g;
    const img = imageNow('assets/fx/special_cutin.webp');
    g.save();
    g.globalAlpha = Math.min(1, k * 1.4) * 0.85;
    const bandH = WORLD_H * 0.34, y = WORLD_H * 0.3;
    if (img) g.drawImage(img, 0, y, this.worldW, bandH);
    else { const grd = g.createLinearGradient(0, y, this.worldW, y + bandH); grd.addColorStop(0, '#1d1a5a'); grd.addColorStop(0.5, '#cfe8ff'); grd.addColorStop(1, '#1d1a5a'); g.fillStyle = grd; g.fillRect(0, y, this.worldW, bandH); }
    g.restore();
    this.bigText('FULL BREAK!', y + bandH / 2, 72, '#fff3b0', -0.08);
  }

  private drawWaveCard(c: { name: string; sub: string; elite: boolean; k: number }) {
    const g = this.g;
    const a = c.k < 0.2 ? c.k / 0.2 : c.k > 0.8 ? (1 - c.k) / 0.2 : 1;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(20,16,40,0.55)';
    g.fillRect(0, WORLD_H * 0.36, this.worldW, 96);
    g.restore();
    g.save(); g.globalAlpha = a;
    if (c.elite) this.bigText('ELITE', WORLD_H * 0.36 + 18, 20, '#ffcc33');
    this.bigText(c.name, WORLD_H * 0.36 + 52, 40, '#ffffff');
    this.bigText(c.sub, WORLD_H * 0.36 + 82, 15, '#d8d2ff');
    g.restore();
  }

  bigText(text: string, y: number, size: number, color: string, rot = 0) {
    const g = this.g;
    g.save();
    g.translate(this.worldW / 2, y); g.rotate(rot);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
    g.lineWidth = size * 0.16; g.strokeStyle = '#1b1530'; g.strokeText(text, 0, 0);
    g.fillStyle = color; g.fillText(text, 0, 0);
    g.restore();
  }
}
