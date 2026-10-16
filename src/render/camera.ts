// Camera impulses (v2 §6.3): short directional kicks that decay, summed and capped. Applied to the world layer only,
// so the hero and the building shake together and the HUD stays still. Never touches game coordinates.
import { CAMERA_FEEL } from '../config/gameFeel';

interface Impulse { dx: number; dy: number; ms: number; max: number }

export class Camera {
  private kicks: Impulse[] = [];
  scale = 1; // 0 for reduced motion / effects LOW-ish setting, debug multiplier otherwise
  x = 0; y = 0;

  kick(amp: number, ms: number, dirX = 0, dirY = 1) {
    if (this.scale <= 0) return;
    const len = Math.hypot(dirX, dirY) || 1;
    this.kicks.push({ dx: (dirX / len) * amp * this.scale, dy: (dirY / len) * amp * this.scale, ms, max: ms });
    if (this.kicks.length > 6) this.kicks.shift();
  }

  update(dtMs: number) {
    let x = 0, y = 0;
    for (const k of this.kicks) {
      k.ms -= dtMs;
      const t = Math.max(0, k.ms / k.max);
      // one quick push and a damped swing back
      const wave = Math.sin((1 - t) * Math.PI * 2.5) * t;
      x += k.dx * wave; y += k.dy * wave;
    }
    this.kicks = this.kicks.filter((k) => k.ms > 0);
    const m = Math.hypot(x, y);
    if (m > CAMERA_FEEL.cap) { x *= CAMERA_FEEL.cap / m; y *= CAMERA_FEEL.cap / m; }
    this.x = x; this.y = y;
  }

  clear() { this.kicks = []; this.x = 0; this.y = 0; }
}

/** Big texts with a priority (v2 §8.3): SPECIAL > FINISH > CLUTCH > CHAIN > COMBO > NORMAL, at most two on screen. */
export const BANNER_PRIORITY = { SPECIAL: 6, FINISH: 5, CLUTCH: 4, CHAIN: 3, COMBO: 2, NORMAL: 1 } as const;
export interface Banner { text: string; color: string; size: number; prio: number; life: number; max: number }

export class Banners {
  list: Banner[] = [];
  private frameBest: Banner | null = null;

  /** Offer a banner this tick; only the highest-priority offer of a tick is shown. */
  offer(text: string, prio: number, color = '#ffe066', size = 34, life = 0.75) {
    if (!this.frameBest || prio > this.frameBest.prio) this.frameBest = { text, color, size, prio, life, max: life };
  }

  flush() {
    if (!this.frameBest) return;
    this.list.push(this.frameBest);
    this.list.sort((a, b) => b.prio - a.prio);
    if (this.list.length > 2) this.list.length = 2;
    this.frameBest = null;
  }

  update(dt: number) {
    for (const b of this.list) b.life -= dt;
    this.list = this.list.filter((b) => b.life > 0);
  }

  clear() { this.list = []; this.frameBest = null; }
}
