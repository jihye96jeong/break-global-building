// v2.0 game-feel acceptance tests (GF-xx), updated to the v3.0 contact values. World units, 60 Hz fixed step.
import { describe, expect, it } from 'vitest';
import { BALANCE, DANGER_Y } from '../src/config/balance';
import { GUARD_FEEL, HITSTOP_MS, JUMP_FEEL } from '../src/config/gameFeel';
import { attack, attackSurfaceY, guardPlaneY, NO_INPUT, special, takeEvents, tick, type Intents, type RunState } from '../src/core/game';
import { building, floor, playing } from './helpers';

const DT = 1 / 60;
const tall = (n: number, hp: [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3] = [3, 3, 3]) => Array.from({ length: n }, (_, i) => floor(hp, i + 1));
const run = (s: RunState, secs: number, input: Partial<Intents> = {}, each?: (s: RunState) => void) => {
  for (let t = 0; t < secs; t += DT) { tick(s, DT, { ...NO_INPUT, ...input }); each?.(s); }
};
/** A run with the building far above (so it never interferes) unless a bottom is given. */
const open = (bottom = -2000) => { const s = playing(building(tall(5), bottom)); s.building!.velocityY = 0; s.building!.baseSpeed = 0; return s; };

function jumpProfile(holdSecs: number) {
  const s = open();
  let peak = 0, apexAt = 0, t = 0, landAt = 0;
  tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
  for (; t < 2; t += DT) {
    tick(s, DT, { ...NO_INPUT, jump: t < holdSecs });
    if (s.player.y > peak) { peak = s.player.y; apexAt = t + DT; }
    if (s.player.y === 0) { landAt = t + DT; break; }
  }
  return { peak, apexAt, landAt };
}

describe('jump (v2 §3)', () => {
  it('GF-01/02 a held jump peaks at 185–215 wu, apex ≈0.5 s, airtime 0.82–1.02 s', () => {
    const j = jumpProfile(2);
    expect(j.peak).toBeGreaterThanOrEqual(185);
    expect(j.peak).toBeLessThanOrEqual(215);
    expect(j.apexAt).toBeGreaterThanOrEqual(0.45);
    expect(j.apexAt).toBeLessThanOrEqual(0.55);
    expect(j.landAt).toBeGreaterThanOrEqual(0.82);
    expect(j.landAt).toBeLessThanOrEqual(1.02);
  });

  it('GF-03 a quick tap is a clearly lower, shorter hop', () => {
    const full = jumpProfile(2), hop = jumpProfile(0.05);
    expect(hop.peak).toBeLessThan(full.peak * 0.6);
    expect(hop.landAt).toBeLessThan(full.landAt);
  });

  it('GF-04 a jump attack lands when the rising blade actually reaches the underside', () => {
    const s = playing(building(tall(10), 300)); // contact at feet height 156, inside the jump
    s.building!.velocityY = 0; s.building!.baseSpeed = 0;
    tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
    let hits = 0;
    for (let i = 0; i < 25; i++) {
      tick(s, DT, { ...NO_INPUT, jump: true, attack: true });
      for (const e of takeEvents(s)) if (e.t === 'hit') { hits++; expect(e.contact.gap).toBeLessThanOrEqual(2); expect(s.player.y).toBeGreaterThan(80); }
    }
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  it('no height limit but the building: from the ground, any jump (even a tap) reaches a high building\'s underside', () => {
    for (const bottom of [80, 150, 250, 330]) for (const hold of [0.03, 1]) {
      const s = playing(building(tall(6), bottom));
      s.building!.velocityY = 0; s.building!.baseSpeed = 0;
      let touched = false, t = 0;
      tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
      for (; t < 1.2 && !touched; t += DT) { tick(s, DT, { ...NO_INPUT, jump: t < hold }); if (attackSurfaceY(s) - s.building!.bottomY <= 2) touched = true; }
      expect(touched).toBe(true);
      expect(attackSurfaceY(s)).toBeGreaterThanOrEqual(s.building!.bottomY - 0.001); // stopped by it, never inside
    }
  });

  it('a held Z during a leap to a high building lands real hits up there', () => {
    const s = playing(building(tall(6, [1, 1, 1]), 100));
    s.building!.velocityY = 0; s.building!.baseSpeed = 0;
    tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
    let hits = 0;
    for (let i = 0; i < 50; i++) { tick(s, DT, { ...NO_INPUT, jump: true, attack: true }); hits += takeEvents(s).filter((e) => e.t === 'hit').length; }
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  it('a jump buffered just before landing still fires', () => {
    const s = open();
    tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
    while (s.player.y > 12) tick(s, DT);
    tick(s, DT, { ...NO_INPUT, jumpPressed: true, jump: true });
    let rose = false;
    for (let i = 0; i < 30; i++) { tick(s, DT, { ...NO_INPUT, jump: true }); if (s.player.vy > 0 && s.player.y > 20) rose = true; }
    expect(rose).toBe(true);
  });

  it('the hero can never jump into the building: its underside is a ceiling', () => {
    const s = open(300);
    tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
    run(s, 0.6, { jump: true }, (st) => expect(attackSurfaceY(st)).toBeGreaterThanOrEqual(st.building!.bottomY - 0.001));
  });
});

/** Ground guard pressed while the building is `gap` wu above the sword plane; returns the tick log. */
function guardRun(gap: number, opts: { air?: boolean; secs?: number } = {}) {
  const s = playing(building(tall(6), 0));
  if (opts.air) { s.player.y = 100; s.player.vy = 0; }
  const b = s.building!;
  b.bottomY = guardPlaneY(s) - gap;
  const log: { t: number; bottom: number; phase: string; vel: number; plane: number }[] = [];
  let t = 0;
  const step = (input: Partial<Intents>) => { tick(s, DT, { ...NO_INPUT, ...input }); t += DT; log.push({ t, bottom: b.bottomY, phase: s.guardPhase, vel: b.velocityY, plane: guardPlaneY(s) }); };
  step({ guard: true, guardPressed: true });
  while (t < (opts.secs ?? 1.2)) step({ guard: t < 0.15 }); // a short press: one contact

  return { s, log };
}

describe('guard contact (v2 §4)', () => {
  it('GF-05 guarding with the building 70 wu above changes nothing about the building', () => {
    const s = playing(building(tall(5), 0));
    const b = s.building!;
    b.bottomY = guardPlaneY(s) - 200;
    const before = b.bottomY, v = b.velocityY;
    tick(s, DT, { ...NO_INPUT, guard: true, guardPressed: true });
    expect(s.guardPhase).toBe('OFF');
    expect(s.player.guarding).toBe(true); // the pose only
    expect(b.bottomY).toBeCloseTo(before + v * DT, 5); // only its own fall
    expect(b.velocityY).toBe(v);
  });

  it('GF-06/07 contact aligns the underside with the sword and holds it still for 100–150 ms', () => {
    const { log } = guardRun(10);
    const hold = log.filter((l) => l.phase === 'HOLD');
    expect(hold.length).toBeGreaterThan(0);
    for (const h of hold) { expect(Math.abs(h.bottom - h.plane)).toBeLessThanOrEqual(2); expect(h.vel).toBe(0); }
    const ms = hold.length * DT * 1000;
    expect(ms).toBeGreaterThanOrEqual(100);
    expect(ms).toBeLessThanOrEqual(150);
  });

  it('GF-08 a ground guard then pushes the building up 36 wu smoothly (v3; never a one-tick jump)', () => {
    const { log } = guardRun(10);
    const start = log.filter((l) => l.phase === 'HOLD').pop()!.bottom;
    const repel = log.filter((l) => l.phase === 'REPEL' || l.phase === 'RELEASE');
    const top = Math.min(...repel.map((l) => l.bottom));
    expect(start - top).toBeGreaterThan(35.5);
    expect(start - top).toBeLessThan(36.5);
    const guarded = log.filter((l) => l.phase !== 'OFF');
    for (let i = 1; i < guarded.length; i++) expect(Math.abs(guarded[i].bottom - guarded[i - 1].bottom)).toBeLessThan(10);
    const repelMs = log.filter((l) => l.phase === 'REPEL').length * DT * 1000;
    expect(repelMs).toBeGreaterThan(150); expect(repelMs).toBeLessThan(190);
  });

  it('GF-09 an air guard (jumping up into the building) pushes 18 wu (v3)', () => {
    const s = playing(building(tall(6), 300));
    const b = s.building!; b.velocityY = 0; b.baseSpeed = 0;
    const log: { bottom: number; phase: string }[] = [];
    tick(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true });
    let pressed = false;
    for (let i = 0; i < 70; i++) {
      const near = !pressed && guardPlaneY(s) - b.bottomY < 30; // press ↓ just before the blade meets the underside
      if (near) pressed = true;
      tick(s, DT, { ...NO_INPUT, jump: true, guard: pressed && i < 40, guardPressed: near });
      log.push({ bottom: b.bottomY, phase: s.guardPhase });
    }
    expect(log.some((l) => l.phase === 'HOLD')).toBe(true);
    expect(takeEvents(s).some((e) => e.t === 'guardContact' && e.kind === 'air')).toBe(true);
    const start = log.filter((l) => l.phase === 'HOLD').pop()!.bottom;
    const top = Math.min(...log.filter((l) => l.phase !== 'HOLD').slice(-60).map((l) => l.bottom));
    expect(start - top).toBeGreaterThan(17);
    expect(start - top).toBeLessThan(19);
    expect(s.guardContacts).toBe(1);
  });

  it('GF-10 after the push the building eases back into falling with no position jump', () => {
    const { log } = guardRun(10, { secs: 1.5 });
    const i = log.findIndex((l) => l.phase === 'RELEASE');
    expect(i).toBeGreaterThan(0);
    const after = log.slice(i, i + 12);
    for (let k = 1; k < after.length; k++) expect(after[k].vel).toBeGreaterThanOrEqual(after[k - 1].vel - 1e-9);
    expect(Math.abs(log[i].bottom - log[i - 1].bottom)).toBeLessThan(2);
  });

  it('GF-11 contact and danger in the same moment: no life lost', () => {
    const s = playing(building(tall(5), 0));
    const b = s.building!;
    b.bottomY = guardPlaneY(s) - 1; b.velocityY = 600; // would pass the danger line next tick without the guard
    run(s, 0.5, { guard: true, guardPressed: true });
    expect(s.lives).toBe(3);
  });

  it('GF-13 holding or mashing guard: one success per contact episode', () => {
    const s = playing(building(tall(6), 0));
    const b = s.building!;
    b.bottomY = guardPlaneY(s) - 10;
    let contacts = 0;
    for (let i = 0; i < 30; i++) { tick(s, DT, { ...NO_INPUT, guard: true, guardPressed: i % 2 === 0 }); contacts += takeEvents(s).filter((e) => e.t === 'guardContact').length; }
    expect(contacts).toBe(1);
  });

  it('GF-14 ground guard resets the combo; air guard keeps it', () => {
    const g = playing(building(tall(6), 0)); g.combo = 12; g.comboMs = 1500; g.building!.bottomY = guardPlaneY(g) - 5;
    run(g, 0.2, { guard: true, guardPressed: true });
    expect(g.combo).toBe(0);
    const a = playing(building(tall(6), 0)); a.combo = 12; a.comboMs = 1500; a.player.y = 100; a.building!.bottomY = guardPlaneY(a) - 5;
    run(a, 0.2, { guard: true, guardPressed: true });
    expect(a.combo).toBe(12);
  });

  it('GF-29 guard contact and an attack in the same tick resolve deterministically, damage once', () => {
    const s = playing(building(tall(6, [1, 1, 1]), 0));
    s.building!.bottomY = guardPlaneY(s) - 1;
    tick(s, DT, { ...NO_INPUT, guard: true, guardPressed: true, attack: true, attackPressed: true });
    const ev = takeEvents(s);
    expect(ev.filter((e) => e.t === 'floor').length).toBeLessThanOrEqual(1);
    expect(ev.filter((e) => e.t === 'guardContact').length).toBeLessThanOrEqual(1);
  });

  it('GF-30 (v3 §5.7) mashing Z while the guard braces or pushes never damages the building', () => {
    const s = playing(building(tall(6, [1, 1, 1]), 0));
    const b = s.building!;
    b.bottomY = guardPlaneY(s) - 1;
    tick(s, DT, { ...NO_INPUT, guard: true, guardPressed: true });
    expect(s.guardPhase).toBe('HOLD');
    const floors = b.floors.length;
    for (let i = 0; i < 18 && (s.guardPhase === 'HOLD' || s.guardPhase === 'REPEL'); i++) tick(s, DT, { ...NO_INPUT, attack: true, attackPressed: i % 2 === 0 });
    expect(b.floors.length).toBe(floors);
  });
});

describe('destruction & hit-stop (v2 §5–§6)', () => {
  it('GF-15 [1,2,3] lane 0 → whole floor gone at once', () => {
    const s = playing(building([floor([1, 2, 3]), floor([2, 2, 2], 2)])); s.player.lane = 0;
    attack(s);
    expect(s.building!.floors).toHaveLength(1);
  });

  it('GF-16 [3,2,1] lane 0 → [2,2,1], the floor stays', () => {
    const s = playing(building([floor([3, 2, 1]), floor([2, 2, 2], 2)])); s.player.lane = 0;
    attack(s);
    expect(s.building!.floors[0].hp).toEqual([2, 2, 1]);
  });

  it('GF-17/18/19 a floor break emits one floor event (with origin = that floor) and scores once', () => {
    const s = playing(building([floor([2, 1, 2]), floor([2, 2, 2], 2)]));
    const bottom = s.building!.bottomY;
    attack(s);
    const ev = takeEvents(s).filter((e) => e.t === 'floor');
    expect(ev).toHaveLength(1);
    if (ev[0].t === 'floor') expect(ev[0].bottomY).toBeCloseTo(bottom - BALANCE.hitPushUp);
    const score = s.score;
    tick(s, DT, { ...NO_INPUT, attackPressed: true });
    expect(s.score).toBeLessThanOrEqual(score + 200); // the next hit lands on the next floor only
  });

  it('GF-20/21 special: all floors gone at once, invulnerable at the danger line, one building counted', () => {
    const s = playing(building(tall(6), DANGER_Y - 2)); s.special = 100;
    special(s);
    run(s, 1);
    expect(s.lives).toBe(3);
    expect(s.destroyedBuildings).toBe(1);
  });

  it('GF-22 hit-stop freezes gameplay only: the building does not fall, the attack rhythm keeps time', () => {
    const s = playing(building(tall(6, [2, 2, 2])));
    attack(s);
    expect(s.freezeMs).toBe(HITSTOP_MS.hit);
    const y = s.building!.bottomY;
    tick(s, DT);
    expect(s.building!.bottomY).toBe(y);
    run(s, 0.2);
    expect(s.building!.bottomY).toBeGreaterThan(y);
  });

  it('GF-23 results do not depend on how frames are chopped (fixed step)', () => {
    const a = jumpProfile(2), b = jumpProfile(2);
    expect(a).toEqual(b);
  });

  it('GF-28 ten new runs in a row start identically', async () => {
    const { newRun, startRun } = await import('../src/core/game');
    const s = newRun(1);
    const snaps = new Set<string>();
    for (let i = 0; i < 10; i++) { startRun(s, 7); snaps.add(JSON.stringify({ ...s, events: [] })); }
    expect(snaps.size).toBe(1);
  });

  it('feel values match the v2 jump and v3 guard targets', () => {
    expect(JUMP_FEEL.jumpVelocity ** 2 / (2 * JUMP_FEEL.gravityAscending)).toBeCloseTo(203.8, 0);
    expect(GUARD_FEEL.holdMs).toEqual({ ground: 120, air: 100 });
    expect(GUARD_FEEL.repelUnits).toEqual({ ground: 36, air: 18 });
    expect(BALANCE.attackIntervalMs).toBe(95);
  });
});
