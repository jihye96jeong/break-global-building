// Fragments, chips, dust, sparks and score pops. Spec §11.3 physics, pooled under a hard cap.
import { GROUND_Y } from '../config/balance';

export interface Fragment {
  img?: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number; // a cut piece of the floor art
  color?: string; size: number; // or a solid chip
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; rot: number; vr: number;
  life: number; max: number; gravity: number; drag: number;
}
interface Pop { x: number; y: number; text: string; life: number; max: number; size: number; color: string }
interface Ring { x: number; y: number; r: number; life: number; max: number; color: string; width: number }
interface Streak { x: number; y0: number; y1: number; life: number; max: number; color: string; width: number }

const CAP = 250;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  frags: Fragment[] = [];
  pops: Pop[] = [];
  rings: Ring[] = [];
  streaks: Streak[] = [];

  clear() { this.frags = []; this.pops = []; this.rings = []; this.streaks = []; }

  private push(f: Fragment) {
    this.frags.push(f);
    if (this.frags.length > CAP) this.frags.splice(0, this.frags.length - CAP); // oldest first
  }

  /** A floor bursts: its art splits into chunks that fly and spin, plus chips and dust. */
  burstFloor(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, palette: string[], chunks = 5, power = 1) {
    const sw = canvas.width / chunks;
    for (let i = 0; i < chunks; i++) {
      const cw = w / chunks;
      this.push({ img: canvas, sx: i * sw, sy: 0, sw, sh: canvas.height, size: 0, x: x + cw * (i + 0.5), y: y + h / 2, w: cw, h,
        vx: rand(-150, 150) * power + (i - (chunks - 1) / 2) * 40, vy: rand(-300, -70) * power, rot: 0, vr: rand(-9, 9) * 0.4,
        life: 0.9 + rand(0, 0.45), max: 1.35, gravity: 850, drag: 0.985 });
    }
    const n = 6 + Math.floor(Math.random() * 11); // 6–16 chips
    for (let i = 0; i < n; i++) this.chip(x + rand(0, w), y + rand(0, h), palette[i % palette.length], power);
    for (let i = 0; i < 8; i++) this.chip(x + rand(0, w), y + h, 'rgba(235,225,205,0.8)', 0.4, rand(6, 14));
    this.rings.push({ x: x + w / 2, y: y + h / 2, r: w * 0.7, life: 0.3, max: 0.3, color: 'rgba(255,255,255,0.9)', width: 6 });
  }

  chip(x: number, y: number, color: string, power = 1, size = rand(3, 8)) {
    this.push({ color, size, sx: 0, sy: 0, sw: 0, sh: 0, x, y, w: size, h: size, vx: rand(-150, 150) * power, vy: rand(-300, -70) * power,
      rot: rand(0, 6), vr: rand(-9, 9), life: 0.45 + rand(0, 0.45), max: 0.9, gravity: 850, drag: 0.985 });
  }

  sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.chip(x + rand(-12, 12), y, i % 2 ? '#fff6c2' : '#9fd8ff', 0.8, rand(2, 4));
  }

  streak(x: number, y0: number, y1: number, color = 'rgba(200,235,255,0.95)', width = 10, life = 0.05) {
    this.streaks.push({ x, y0, y1, life, max: life, color, width });
  }

  ring(x: number, y: number, r: number, color: string, life = 0.35, width = 5) { this.rings.push({ x, y, r, life, max: life, color, width }); }

  pop(x: number, y: number, text: string, size = 22, color = '#fff') {
    this.pops.push({ x, y, text, life: 0.8, max: 0.8, size, color });
    if (this.pops.length > 30) this.pops.shift();
  }

  update(dt: number) {
    for (const f of this.frags) {
      f.vy += f.gravity * dt;
      const d = Math.pow(f.drag, dt * 60);
      f.vx *= d; f.vy *= d;
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.y > GROUND_Y && f.vy > 0) { f.y = GROUND_Y; f.vy *= -0.3; f.vx *= 0.6; f.life = Math.min(f.life, 0.3); }
      f.life -= dt;
    }
    this.frags = this.frags.filter((f) => f.life > 0);
    for (const p of this.pops) { p.y -= 50 * dt; p.life -= dt; }
    this.pops = this.pops.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const s of this.streaks) s.life -= dt;
    this.streaks = this.streaks.filter((s) => s.life > 0);
  }

  draw(g: CanvasRenderingContext2D) {
    for (const s of this.streaks) {
      const k = s.life / s.max;
      g.globalAlpha = k;
      g.fillStyle = 'rgba(120,180,255,0.45)'; g.fillRect(s.x - s.width, s.y0, s.width * 2, s.y1 - s.y0);
      g.fillStyle = s.color; g.fillRect(s.x - s.width / 3, s.y0, (s.width * 2) / 3, s.y1 - s.y0);
    }
    g.globalAlpha = 1;
    for (const f of this.frags) {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, f.life / 0.3));
      g.translate(f.x, f.y); g.rotate(f.rot);
      if (f.img) g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.w / 2, -f.h / 2, f.w, f.h);
      else { g.fillStyle = f.color!; g.fillRect(-f.size / 2, -f.size / 2, f.size, f.size * 0.7); }
      g.restore();
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      g.globalAlpha = 1 - k; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - k) + 1;
      g.beginPath(); g.ellipse(r.x, r.y, r.r * (0.3 + k), r.r * (0.3 + k) * 0.5, 0, 0, Math.PI * 2); g.stroke();
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
