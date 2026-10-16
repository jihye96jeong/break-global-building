// Keyboard + pointer → intents. Held state is live; "pressed" edges are collected between simulation steps
// and handed to exactly one step, so OS key-repeat and fast taps never double-fire (spec §4.1, §14.4).
import type { Intents } from './core/game';
import type { Lane } from './core/building';

type Action = 'left' | 'right' | 'jump' | 'guard' | 'attack' | 'special' | 'pause' | 'mute';

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'guard', KeyS: 'guard',
  KeyZ: 'attack', KeyJ: 'attack', KeyX: 'special', KeyK: 'special',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
};

export class Input {
  private keys = new Set<Action>();
  private fingers = new Map<number, Action>();
  private pressed = new Set<Action>();
  private laneTap: Lane | undefined;
  onSystem: (a: 'pause' | 'mute') => void = () => {};
  onGesture: () => void = () => {};

  constructor() {
    addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      if (!(e.target instanceof HTMLSelectElement)) e.preventDefault();
      this.onGesture();
      if (e.repeat) return;
      if (a === 'pause' || a === 'mute') { this.onSystem(a); return; }
      this.keys.add(a);
      this.pressed.add(a);
    });
    addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) this.keys.delete(a); });
    addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
  }

  /** On-screen button: every finger tracked by pointerId so moving, jumping and attacking work together. */
  bind(el: HTMLElement, a: Action) {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.onGesture();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      this.fingers.set(e.pointerId, a);
      this.pressed.add(a);
      el.classList.add('pressed');
    };
    const up = (e: PointerEvent) => {
      if (this.fingers.get(e.pointerId) !== a) return;
      this.fingers.delete(e.pointerId);
      if (![...this.fingers.values()].includes(a)) el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  tapLane(l: Lane) { this.laneTap = l; this.onGesture(); }

  private held(a: Action) {
    if (this.keys.has(a)) return true;
    for (const v of this.fingers.values()) if (v === a) return true;
    return false;
  }

  /** Intents for one simulation step; edges are consumed. */
  take(): Intents {
    const p = this.pressed;
    const i: Intents = {
      left: this.held('left'), leftPressed: p.has('left'), right: this.held('right'), rightPressed: p.has('right'),
      attack: this.held('attack'), attackPressed: p.has('attack'), jumpPressed: p.has('jump'),
      guard: this.held('guard'), guardPressed: p.has('guard'), specialPressed: p.has('special'), laneTo: this.laneTap,
    };
    p.clear();
    this.laneTap = undefined;
    return i;
  }

  clear() {
    this.keys.clear(); this.fingers.clear(); this.pressed.clear(); this.laneTap = undefined;
    document.querySelectorAll('.pressed').forEach((n) => n.classList.remove('pressed'));
  }
}
