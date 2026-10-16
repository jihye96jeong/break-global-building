// Visual-only effects (never touch game state): textured chunks cut from the broken floor, chips, smoke, sparks,
// slash arcs, rings, crack sweeps and score pops. v2 §7 three-layer debris with per-material behaviour.
import { GROUND_Y } from '../config/balance';
import { DEBRIS_FEEL } from '../config/gameFeel';

export type Material = 'glass' | 'stone' | 'steel' | 'wood' | 'mixed';

interface Part {
  kind: 'chunk' | 'chip' | 'smoke' | 'spark';
  img?: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number;
  color: string; shape: 'shard' | 'block' | 'rod' | 'splinter' | 'dot';
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; rot: number; vr: number; g: number;
  life: number; max: number; bounced: boolean;
}
interface Pop { x: number; y: number; text: string; life: number; max: number; size: number; color: string }
interface Ring { x: number; y: number; r: number; life: number; max: number; color: string; width: number; flat: number }
interface Slash { x: number; y: number; variant: number; dir: 1 | -1; life: number; max: number; color: string; width: number }
interface Streak { x: number; y0: number; y1: number; life: number; max: number; color: string; width: number }
interface Ghost { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; life: number; max: number; crackFrom: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (r: number[]) => Math.round(rand(r[0], r[1]));
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const MAT_SHAPE: Record<Material, Part['shape'][]> = {
  glass: ['shard', 'shard', 'dot'], stone: ['block', 'block', 'dot'], steel: ['rod', 'rod', 'block'], wood: ['splinter', 'block', 'splinter'], mixed: ['shard', 'block', 'rod'],
};

export class Particles {
  parts: Part[] = [];
  pops: Pop[] = [];
  rings: Ring[] = [];
  slashes: Slash[] = [];
  streaks: Streak[] = [];
  ghosts: Ghost[] = [];
  cap = DEBRIS_FEEL.maxParticlesDesktop;
  low = false; // effects LOW / reduced motion: fewer chips, no smoke trails, mechanics unchanged

  clear() { this.parts = []; this.pops = []; this.rings = []; this.slashes = []; this.streaks = []; this.ghosts = []; }

  private push(p: Part) {
    this.parts.push(p);
    if (this.parts.length > this.cap) this.parts.splice(0, this.parts.length - this.cap); // oldest first
  }

  private chip(x: number, y: number, color: string, material: Material, speed = 1) {
    const size = rand(2.5, 7);
    const shape = pick(MAT_SHAPE[material]);
    const w = shape === 'rod' ? size * 3 : shape === 'splinter' ? size * 2.4 : size;
    this.push({ kind: 'chip', color, shape, sx: 0, sy: 0, sw: 0, sh: 0, x, y, w, h: shape === 'rod' || shape === 'splinter' ? size * 0.6 : size,
      vx: rand(DEBRIS_FEEL.chipSpeedX[0], DEBRIS_FEEL.chipSpeedX[1]) * speed, vy: rand(DEBRIS_FEEL.chipSpeedY[0], DEBRIS_FEEL.chipSpeedY[1]) * speed,
      rot: rand(0, 6), vr: rand(-12, 12), g: rand(DEBRIS_FEEL.gravity[0], DEBRIS_FEEL.gravity[1]), life: rand(0.35, 0.85), max: 0.85, bounced: false });
  }

  smoke(x: number, y: number, n: number, color = 'rgba(232,222,204,', size = 1) {
    if (this.low) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const max = rand(0.3, 0.65);
      this.push({ kind: 'smoke', color, shape: 'dot', sx: 0, sy: 0, sw: 0, sh: 0, x: x + rand(-14, 14), y: y + rand(-6, 6), w: rand(8, 18) * size, h: 0,
        vx: rand(-70, 70), vy: rand(-60, -10), rot: 0, vr: 0, g: -20, life: max, max, bounced: true });
    }
  }

  sparks(x: number, y: number, n: number, colors = ['#fff6c2', '#9fd8ff', '#ffffff']) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(120, 380);
      this.push({ kind: 'spark', color: pick(colors), shape: 'dot', sx: 0, sy: 0, sw: 0, sh: 0, x, y, w: rand(2, 3.5), h: 0,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 0, g: 900, life: rand(0.12, 0.3), max: 0.3, bounced: true });
    }
  }

  /** HP went down but the floor stands: a dent with dust (3→2) or a spreading crack with chips (2→1). */
  damage(x: number, y: number, hpLeft: number, color: string, material: Material) {
    if (hpLeft >= 2) { this.sparks(x, y, 5); this.smoke(x, y, 2); for (let i = 0; i < 3; i++) this.chip(x, y, color, material, 0.5); }
    else { this.sparks(x, y, 8, ['#ffffff', '#ffd2a0', '#ff8a6a']); for (let i = 0; i < 6; i++) this.chip(x, y, color, material, 0.7); this.smoke(x, y, 3); }
  }

  /**
   * A whole floor bursts (v2 §5.4): the floor's own picture stays as a 45 ms ghost while a crack sweeps across it from
   * the struck lane, then 3–6 textured chunks, 12–26 material chips and 5–10 smoke puffs fly from that floor.
   */
  burstFloor(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, palette: string[], material: Material, crackFromX: number, power = 1) {
    this.ghosts.push({ img: canvas, x, y, w, h, life: DEBRIS_FEEL.ghostMs / 1000, max: DEBRIS_FEEL.ghostMs / 1000, crackFrom: crackFromX });
    const chunks = randi(DEBRIS_FEEL.chunkCount);
    // uneven cut positions so the chunks are not identical columns
    const cuts = [0, ...Array.from({ length: chunks - 1 }, (_, i) => ((i + 1) / chunks) + rand(-0.06, 0.06)), 1];
    for (let i = 0; i < chunks; i++) {
      const a = cuts[i], bnd = cuts[i + 1];
      const cw = (bnd - a) * w, cx = x + (a + (bnd - a) / 2) * w;
      this.push({ kind: 'chunk', img: canvas, sx: a * canvas.width, sy: 0, sw: (bnd - a) * canvas.width, sh: canvas.height, color: palette[0], shape: 'block',
        x: cx, y: y + h / 2, w: cw, h, vx: rand(DEBRIS_FEEL.chunkSpeedX[0], DEBRIS_FEEL.chunkSpeedX[1]) * power + (cx - (x + w / 2)) * 1.2,
        vy: rand(DEBRIS_FEEL.chunkSpeedY[0], DEBRIS_FEEL.chunkSpeedY[1]) * power, rot: 0, vr: rand(DEBRIS_FEEL.angularSpeed[0], DEBRIS_FEEL.angularSpeed[1]) * 0.35,
        g: rand(DEBRIS_FEEL.gravity[0], DEBRIS_FEEL.gravity[1]), life: rand(0.45, 0.85), max: 0.85, bounced: false });
    }
    let chips = randi(DEBRIS_FEEL.chipCount);
    if (this.low) chips = Math.ceil(chips / 2);
    for (let i = 0; i < chips; i++) this.chip(x + rand(0, w), y + rand(0, h), palette[i % palette.length], material, power);
    const smokeColor = material === 'glass' ? 'rgba(220,240,255,' : material === 'steel' ? 'rgba(200,200,205,' : 'rgba(232,222,204,';
    this.smoke(x + w / 2, y + h, randi(DEBRIS_FEEL.smokeCount), smokeColor, material === 'stone' ? 1.4 : 1);
    if (material === 'glass') this.sparks(x + w / 2, y + h / 2, 8, ['#ffffff', '#cfefff', '#9fd8ff']);
    if (material === 'steel') this.sparks(x + w / 2, y + h, 10, ['#ffe9a0', '#ffb347', '#ffffff']);
    this.ring(x + w / 2, y + h / 2, w * 0.7, 'rgba(255,255,255,0.9)', 0.28, 6);
  }

  slash(x: number, y: number, variant: number, dir: 1 | -1, combo: number) {
    const hot = Math.min(1, combo / 50);
    this.slashes.push({ x, y, variant, dir, life: 0.12, max: 0.12, color: `rgba(${255},${255 - hot * 60},${255 - hot * 140},1)`, width: 5 + hot * 2 });
  }

  streak(x: number, y0: number, y1: number, color = 'rgba(200,235,255,0.95)', width = 10, life = 0.06) {
    this.streaks.push({ x, y0, y1, life, max: life, color, width });
  }

  ring(x: number, y: number, r: number, color: string, life = 0.35, width = 5, flat = 0.5) { this.rings.push({ x, y, r, life, max: life, color, width, flat }); }

  pop(x: number, y: number, text: string, size = 22, color = '#fff') {
    this.pops.push({ x, y, text, life: 0.75, max: 0.75, size, color });
    if (this.pops.length > 24) this.pops.shift();
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.vy += p.g * dt;
      const d = Math.pow(0.985, dt * 60);
      p.vx *= d; if (p.kind !== 'smoke') p.vy *= d; else p.vx *= 0.97;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind !== 'smoke' && p.y > GROUND_Y && p.vy > 0) {
        p.y = GROUND_Y;
        if (!p.bounced) { p.vy *= -0.3; p.vx *= 0.55; p.bounced = true; p.life = Math.min(p.life, 0.35); }
        else { p.vy = 0; p.vx *= 0.8; }
      }
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) { p.y -= 50 * dt; p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const a of [this.rings, this.slashes, this.streaks, this.ghosts] as { life: number }[][]) for (const r of a) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    this.slashes = this.slashes.filter((r) => r.life > 0);
    this.streaks = this.streaks.filter((r) => r.life > 0);
    this.ghosts = this.ghosts.filter((r) => r.life > 0);
  }

  draw(g: CanvasRenderingContext2D) {
    // broken floor ghost with the crack racing across it (render only, never hittable)
    for (const gh of this.ghosts) {
      const k = 1 - gh.life / gh.max;
      g.globalAlpha = 1 - k * 0.6;
      g.drawImage(gh.img, gh.x, gh.y, gh.w, gh.h);
      g.globalAlpha = 1;
      const span = Math.min(1, k * 1.6) * gh.w;
      g.strokeStyle = '#fffbe0'; g.lineWidth = 4;
      g.beginPath();
      const midY = gh.y + gh.h / 2;
      for (const dir of [-1, 1]) {
        g.moveTo(gh.crackFrom, midY);
        for (let s = 1; s <= 6; s++) g.lineTo(gh.crackFrom + dir * span * (s / 6), midY + (s % 2 ? -1 : 1) * gh.h * 0.18);
      }
      g.stroke();
      g.strokeStyle = 'rgba(20,10,10,.9)'; g.lineWidth = 1.5; g.stroke();
    }
    for (const s of this.streaks) {
      const k = s.life / s.max;
      g.globalAlpha = k;
      g.fillStyle = 'rgba(120,180,255,0.4)'; g.fillRect(s.x - s.width, s.y0, s.width * 2, s.y1 - s.y0);
      g.fillStyle = s.color; g.fillRect(s.x - s.width / 3, s.y0, (s.width * 2) / 3, s.y1 - s.y0);
    }
    g.globalAlpha = 1;
    for (const p of this.parts) {
      if (p.kind === 'smoke') {
        const k = p.life / p.max;
        g.fillStyle = `${p.color}${0.55 * k})`;
        g.beginPath(); g.arc(p.x, p.y, p.w * (1.5 - k * 0.6), 0, Math.PI * 2); g.fill();
        continue;
      }
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, p.life / 0.25));
      g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.img) g.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, -p.w / 2, -p.h / 2, p.w, p.h);
      else if (p.kind === 'spark') { g.fillStyle = p.color; g.fillRect(-p.w, -p.w / 3, p.w * 2.2, p.w / 1.5); }
      else {
        g.fillStyle = p.color;
        g.beginPath();
        if (p.shape === 'shard') { g.moveTo(-p.w / 2, p.h / 2); g.lineTo(0, -p.h); g.lineTo(p.w / 2, p.h / 3); }
        else g.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.closePath(); g.fill();
        g.lineWidth = 0.8; g.strokeStyle = 'rgba(20,20,30,.6)'; g.stroke();
      }
      g.restore();
    }
    for (const s of this.slashes) {
      const k = 1 - s.life / s.max;
      // three alternating arcs: rising cut, reverse cut, straight thrust
      g.globalAlpha = 1 - k * 0.8;
      g.lineCap = 'round';
      const r = 58, sweep = Math.PI * 0.95 * Math.min(1, k * 2.2);
      for (const [w, col] of [[s.width * 3, 'rgba(140,190,255,.45)'], [s.width, s.color]] as const) {
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath();
        if (s.variant === 2) { g.moveTo(s.x, s.y + 10); g.lineTo(s.x, s.y + 10 - 90 * Math.min(1, k * 2.4)); }
        else {
          const cw = (s.variant === 0) === (s.dir > 0);
          const a0 = cw ? -Math.PI * 0.97 : -Math.PI * 0.03;
          g.arc(s.x, s.y + 22, r, a0, a0 + (cw ? sweep : -sweep), !cw);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      g.globalAlpha = 1 - k; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - k) + 1;
      g.beginPath(); g.ellipse(r.x, r.y, r.r * (0.3 + k), r.r * (0.3 + k) * r.flat, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }

  drawPops(g: CanvasRenderingContext2D) {
    g.save();
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (const p of this.pops) {
      const k = p.life / p.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${p.size * pop}px "Arial Black", system-ui, sans-serif`;
      g.lineWidth = p.size * 0.22; g.strokeStyle = '#1b1530'; g.strokeText(p.text, p.x, p.y);
      g.fillStyle = p.color; g.fillText(p.text, p.x, p.y);
    }
    g.restore();
  }
}
