// Keyboard + pointer (touch/mouse) unified. Held state for movement/attack, edge-triggered for ultimate/pause.
export type Action = 'left' | 'right' | 'attack' | 'ultimate' | 'pause' | 'guard' | 'jump';

// The classic 키루비루 layout (← → move, ↑ jump, ↓ guard, Z attack, X special); WASD/J/K as aliases.
const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'guard', KeyS: 'guard',
  KeyZ: 'attack', KeyJ: 'attack', KeyX: 'ultimate', KeyK: 'ultimate',
  Escape: 'pause', KeyP: 'pause',
};

export class InputManager {
  private keys = new Set<Action>();
  private pointers = new Map<number, Action>();
  private pressed = new Set<Action>();

  constructor(private onAnyGesture: () => void) {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault(); // no page scroll / focused-button activation
      this.onAnyGesture();
      if (!e.repeat) this.pressed.add(a); // OS key-repeat never creates extra presses
      this.keys.add(a);
    });
    window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this.keys.delete(a); });
    window.addEventListener('blur', () => this.clear());
  }

  /** Wire an on-screen button. Multi-touch safe: each finger is tracked by pointerId. */
  bindButton(el: HTMLElement, action: Action) {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.onAnyGesture();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      this.pointers.set(e.pointerId, action);
      this.pressed.add(action);
      el.classList.add('pressed');
    };
    const up = (e: PointerEvent) => {
      if (this.pointers.get(e.pointerId) !== action) return;
      this.pointers.delete(e.pointerId);
      if (![...this.pointers.values()].includes(action)) el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  held(a: Action) {
    if (this.keys.has(a)) return true;
    for (const v of this.pointers.values()) if (v === a) return true;
    return false;
  }

  /** True once per physical press. */
  consume(a: Action) {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }

  clearPresses() { this.pressed.clear(); }

  clear() {
    this.keys.clear(); this.pointers.clear(); this.pressed.clear();
    document.querySelectorAll('.pressed').forEach((n) => n.classList.remove('pressed'));
  }
}
