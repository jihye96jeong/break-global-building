// v3.0 P0 contact tests: CT (attack only on real contact), GD (guard only on real contact, hold/repel/release),
// VIS (frame-rate / render independence). World units; gap = pose surface − underside (> 0 = apart).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { CONTACT, GUARD_FEEL } from '../src/config/gameFeel';
import { attack, attackSurfaceY, guardPlaneY, laneOverlap, NO_INPUT, special, sweptContact, takeEvents, tick, type GameEvent, type Intents, type RunState } from '../src/core/game';
import type { HP } from '../src/core/building';
import { building, floor, playing } from './helpers';

const DT = 1 / 60;
const tall = (n: number, hp: [HP, HP, HP] = [3, 3, 3], h = 40) => Array.from({ length: n }, (_, i) => floor(hp, i + 1, h));
const hpSum = (s: RunState) => s.building!.floors.reduce((a, f) => a + f.hp[0] + f.hp[1] + f.hp[2], 0);
/** A static building whose underside is `gap` wu above the grounded hero's attack blade. */
function attackAt(gap: number, hp: [HP, HP, HP] = [3, 3, 3], speed = 0) {
  const s = playing(building(tall(6, hp)));
  const b = s.building!;
  b.bottomY = attackSurfaceY(s) - gap; b.baseSpeed = speed; b.velocityY = speed;
  return s;
}
/** Building `gap` wu above the grounded hero's guard blade, falling at `speed`. */
function guardAt(gap: number, speed = 115) {
  const s = playing(building(tall(6)));
  const b = s.building!;
  b.bottomY = guardPlaneY(s) - gap; b.baseSpeed = speed; b.velocityY = speed;
  return s;
}
const step = (s: RunState, input: Partial<Intents> = {}, dt = DT) => { tick(s, dt, { ...NO_INPUT, ...input }); return takeEvents(s); };
const count = (ev: GameEvent[], t: GameEvent['t']) => ev.filter((e) => e.t === t).length;

describe('CT — a normal attack damages only on real contact', () => {
  for (const gap of [80, 40, 12, 4]) {
    it(`CT-0${{ 80: 1, 40: 2, 12: 3, 4: 4 }[gap]} building ${gap} wu above the blade: mashing Z does nothing`, () => {
      const s = attackAt(gap);
      const hp = hpSum(s);
      let ev: GameEvent[] = [];
      for (let i = 0; i < 60; i++) ev = ev.concat(step(s, { attack: true, attackPressed: i % 3 === 0 }));
      expect(hpSum(s)).toBe(hp);
      expect([s.combo, s.score, s.special]).toEqual([0, 0, 0]);
      expect(count(ev, 'hit') + count(ev, 'floor')).toBe(0);
      expect(count(ev, 'swing')).toBeGreaterThan(5); // the sword still swings (visual only)
      expect(count(ev, 'whiff')).toBeGreaterThan(5);
    });
  }

  it('CT-05 underside 0–2 wu from the blade, right lane: HP −1 exactly', () => {
    for (const gap of [0, 1, 2, -1, -3]) {
      const s = attackAt(gap);
      const before = s.building!.floors[0].hp[1];
      attack(s);
      const hits = takeEvents(s).filter((e) => e.t === 'hit');
      expect(hits).toHaveLength(1);
      expect(s.building!.floors[0].hp[1]).toBe(before - 1);
      const h = hits[0];
      if (h.t === 'hit') { expect(h.contact.contactConfirmed).toBe(true); expect(h.contact.atExactContact).toBe(true); expect(h.contact.laneMatched).toBe(true); }
    }
    const deep = attackAt(-4); // deeper than 3 wu: too late, no hit
    attack(deep);
    expect(count(takeEvents(deep), 'hit')).toBe(0);
  });

  it('CT-06 in contact: only the hero\'s own lane takes damage', () => {
    const s = attackAt(0);
    s.player.lane = 0; s.player.laneFrom = 0;
    attack(s);
    expect(s.building!.floors[0].hp).toEqual([2, 3, 3]);
  });

  it('CT-07 in contact but mid-slide with no horizontal overlap: no damage', () => {
    const s = attackAt(0);
    s.player.laneFrom = 0; s.player.lane = 1; s.player.laneAnimMs = BALANCE.laneMoveMs; // drawn still over lane 0
    expect(laneOverlap(0, 1)).toBeLessThan(CONTACT.minHorizontalOverlap);
    attack(s);
    expect(count(takeEvents(s), 'hit')).toBe(0);
    expect(s.building!.floors[0].hp).toEqual([3, 3, 3]);
  });

  it('CT-08 one swing over many high-rate frames damages once', () => {
    const s = attackAt(0, [3, 3, 3], 115);
    attack(s);
    let hits = 1 + 0;
    takeEvents(s);
    for (let i = 0; i < 60; i++) hits += count(step(s, {}, 1 / 240), 'hit'); // no new press
    expect(hits).toBe(1);
    expect(s.building!.floors[0].hp[1]).toBe(2);
  });

  it('CT-09 a weak (HP1) lane in contact: that one floor goes, once', () => {
    const s = attackAt(0, [2, 1, 2]);
    const floors = s.building!.floors.length;
    attack(s);
    expect(s.building!.floors.length).toBe(floors - 1);
    expect(count(takeEvents(s), 'floor')).toBe(1);
  });

  it('CT-10 after a floor break the next floor must physically drop back before any hit', () => {
    const s = playing(building(tall(6, [1, 1, 1], 28)));
    s.building!.baseSpeed = 115; s.building!.velocityY = 115;
    attack(s);
    takeEvents(s);
    const gapAfter = attackSurfaceY(s) - s.building!.bottomY;
    expect(gapAfter).toBeGreaterThanOrEqual(28);
    let lastGap = gapAfter, firstHitAt = -1;
    for (let i = 0; i < 60 && firstHitAt < 0; i++) {
      const ev = step(s, { attack: true, attackPressed: true });
      for (const e of ev) if (e.t === 'hit') { firstHitAt = i; expect(e.contact.gap).toBeLessThanOrEqual(CONTACT.touchEpsilonWu); }
      if (firstHitAt < 0) lastGap = attackSurfaceY(s) - s.building!.bottomY;
    }
    expect(firstHitAt).toBeGreaterThan(3); // it takes real falling time
    expect(lastGap).toBeLessThan(28);
  });

  it('CT-11 the 7 wu kick after a hit is a real gap: no more hits until it closes', () => {
    const s = attackAt(0); // static: the gap never closes
    attack(s);
    takeEvents(s);
    expect(attackSurfaceY(s) - s.building!.bottomY).toBeCloseTo(BALANCE.hitPushUp, 5);
    let hits = 0;
    for (let i = 0; i < 60; i++) hits += count(step(s, { attack: true, attackPressed: i % 2 === 0 }), 'hit');
    expect(hits).toBe(0);
  });

  it('CT-12 the special still clears the building from far away', () => {
    const s = attackAt(300);
    s.special = 100;
    expect(special(s)).toBe(true);
    expect(s.building!.floors).toHaveLength(0);
  });

  it('CT-13 property: in long random play every hit is at real contact', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = playing(building(tall(30, [2, 2, 2], 30), 150), seed);
      s.building!.baseSpeed = 115 * (1 + seed * 0.25); s.building!.velocityY = s.building!.baseSpeed;
      let r = seed * 9301;
      const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      for (let i = 0; i < 600 && s.phase === 'PLAYING'; i++) {
        const ev = step(s, { attack: rnd() < 0.7, attackPressed: rnd() < 0.3, leftPressed: rnd() < 0.03, rightPressed: rnd() < 0.03, jumpPressed: rnd() < 0.02, jump: rnd() < 0.5 });
        for (const e of ev) if (e.t === 'hit') {
          expect(e.contact.gap).toBeLessThanOrEqual(CONTACT.touchEpsilonWu);
          expect(e.contact.gap).toBeGreaterThanOrEqual(-CONTACT.maxPenetrationWu);
          expect(laneOverlap(e.contact.lanePos, e.lane)).toBeGreaterThanOrEqual(CONTACT.minHorizontalOverlap);
        }
      }
    }
  });

  it('swept contact maths', () => {
    expect(sweptContact(30, 25)).toBeNull();
    expect(sweptContact(7, -8)).toBeCloseTo(7 / 15);
    expect(sweptContact(1, -20)).toBe(0);
    expect(sweptContact(-5, -8)).toBeNull();
  });
});

describe('GD — guard only on real contact, then HOLD → REPEL → RELEASE', () => {
  it('GD-01 building 80 wu above: pose only; no stop, push, cost or success', () => {
    const s = guardAt(80);
    const b = s.building!;
    const ev = step(s, { guard: true, guardPressed: true });
    expect(s.player.guarding).toBe(true);
    expect(b.velocityY).toBe(115);
    expect(b.bottomY).toBeCloseTo(guardPlaneY(s) - 80 + 115 * DT, 5);
    expect(count(ev, 'guardContact')).toBe(0);
    expect(s.guard).toBe(100);
  });

  it('GD-02 building 12 wu above: READY, and until contact the fall is untouched', () => {
    const s = guardAt(12);
    const b = s.building!;
    let y = b.bottomY;
    step(s, { guard: true, guardPressed: true });
    expect(s.guardPhase).toBe('READY');
    while (s.guardPhase === 'READY') {
      expect(b.bottomY).toBeCloseTo(y + 115 * DT, 5);
      y = b.bottomY;
      step(s, { guard: true });
    }
    expect(s.guardPhase).toBe('HOLD');
  });

  it('GD-03 contact at gap 0 inside the window: success, speed 0, held at the blade', () => {
    const s = guardAt(0);
    const ev = step(s, { guard: true, guardPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    expect(s.building!.velocityY).toBe(0);
    expect(s.building!.bottomY).toBeCloseTo(guardPlaneY(s), 5);
    const g = ev.find((e) => e.t === 'guardContact');
    if (g?.t === 'guardContact') { expect(g.motionOwner).toBe('GUARD_HOLD'); expect(g.contact.atExactContact).toBe(true); }
  });

  it('GD-04 2.4× fall, guard pressed on the contact frame: no pass-through, held 120 ms', () => {
    const speed = 115 * 2.4;
    const s = guardAt(3, speed);
    const ev = step(s, { guard: true, guardPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    const y = s.building!.bottomY;
    expect(y).toBeLessThanOrEqual(guardPlaneY(s) + 1e-9);
    let held = 0;
    while (s.guardPhase === 'HOLD') { step(s); expect(s.building!.bottomY).toBe(y); held += DT * 1000; }
    expect(held).toBeGreaterThanOrEqual(110); expect(held).toBeLessThanOrEqual(135);
  });

  it('GD-05 gap +7 → −8 in one tick: found by the swept test, stopped AT the blade (not 7 wu early)', () => {
    const s = guardAt(7, 15 * 60);
    const ev = step(s, { guard: true, guardPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    expect(s.building!.bottomY).toBeCloseTo(guardPlaneY(s), 5);
  });

  it('GD-06/07/08 hold pinned (≤2 wu), push exactly 36 wu once over ~170 ms, release blends with no jump', () => {
    const s = guardAt(0);
    const b = s.building!;
    step(s, { guard: true, guardPressed: true });
    const contactY = b.bottomY;
    const log: { phase: string; y: number; v: number }[] = [];
    for (let i = 0; i < 40; i++) { step(s); log.push({ phase: s.guardPhase, y: b.bottomY, v: b.velocityY }); }
    for (const l of log.filter((x) => x.phase === 'HOLD')) { expect(l.y).toBe(contactY); expect(Math.abs(guardPlaneY(s) - l.y)).toBeLessThanOrEqual(2); }
    const repel = log.filter((x) => x.phase === 'REPEL');
    expect(repel.length * DT * 1000).toBeGreaterThanOrEqual(150);
    expect(repel.length * DT * 1000).toBeLessThanOrEqual(185);
    const releaseStart = log.findIndex((x) => x.phase === 'RELEASE');
    expect(contactY - log[releaseStart].y).toBeCloseTo(GUARD_FEEL.repelUnits.ground, 5); // the push ends exactly 36 wu up
    expect(Math.min(...log.map((x) => x.y))).toBeCloseTo(contactY - 36, 0);
    for (let i = 1; i < log.length; i++) expect(Math.abs(log[i].y - log[i - 1].y)).toBeLessThan(8); // peak push speed ≈ 400 wu/s ≈ 6.6 wu per tick; never a 36 wu teleport
    const rel = log.slice(releaseStart).filter((x) => x.phase === 'RELEASE');
    for (let i = 1; i < rel.length; i++) expect(rel[i].v).toBeGreaterThanOrEqual(rel[i - 1].v);
    expect(rel.length * DT * 1000).toBeLessThanOrEqual(85);
  });

  it('GD-09 holding ↓ from far away never becomes an auto-guard; a fresh press is needed', () => {
    const s = guardAt(120, 115);
    let ev: GameEvent[] = step(s, { guard: true, guardPressed: true });
    for (let t = 0; t < 1.5 && s.phase === 'PLAYING'; t += DT) ev = ev.concat(step(s, { guard: true }));
    expect(count(ev, 'guardContact')).toBe(0);
    expect(s.lives).toBe(2); // crushed: the long hold protected nothing
    const r = guardAt(40, 115);
    step(r, { guard: true, guardPressed: true });
    for (let i = 0; i < 12; i++) step(r, { guard: true });
    expect(r.guardPhase).toBe('LOCKED');
    step(r, {}); // release
    let ok = 0;
    for (let i = 0; i < 30; i++) ok += count(step(r, { guard: true, guardPressed: i === 0 }), 'guardContact');
    expect(ok).toBe(1);
  });

  it('GD-10/11 mashing across one contact: one success, gauge −30 once, combo reset (ground)', () => {
    const s = guardAt(6);
    s.combo = 9; s.comboMs = 1500;
    let contacts = 0;
    for (let i = 0; i < 30; i++) contacts += count(step(s, { guard: true, guardPressed: true }), 'guardContact');
    expect(contacts).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.guard).toBeGreaterThanOrEqual(100 - 30 - 0.001);
    expect(s.guard).toBeLessThanOrEqual(100 - 30 + 30 * 0.5 * BALANCE.guardRegenPerSec / 60 * 60);
  });

  it('GD-12 air guard: combo kept, −18, hold 100 ms, push 18 wu', () => {
    const s = playing(building(tall(6)));
    s.player.y = 100;
    const b = s.building!;
    b.bottomY = guardPlaneY(s); b.baseSpeed = 0; b.velocityY = 0;
    s.combo = 7; s.comboMs = 1500;
    const ev = step(s, { guard: true, guardPressed: true });
    const g = ev.find((e) => e.t === 'guardContact');
    expect(g?.t === 'guardContact' && g.kind).toBe('air');
    expect(s.combo).toBe(7);
    expect(s.guard).toBe(100 - 18);
    const y0 = b.bottomY;
    let hold = 0;
    while (s.guardPhase === 'HOLD') { step(s); hold += DT * 1000; expect(Math.abs(guardPlaneY(s) - b.bottomY)).toBeLessThanOrEqual(2); }
    expect(hold).toBeGreaterThanOrEqual(90); expect(hold).toBeLessThanOrEqual(115);
    while (s.guardPhase === 'REPEL') step(s);
    expect(y0 - b.bottomY).toBeCloseTo(18, 5);
  });

  it('GD-13 not enough gauge: no stop, no push; the normal crush rule applies', () => {
    const s = guardAt(2);
    s.guard = 10;
    let ev: GameEvent[] = step(s, { guard: true, guardPressed: true });
    expect(s.building!.velocityY).toBeGreaterThan(0);
    for (let t = 0; t < 0.5 && s.phase === 'PLAYING'; t += DT) ev = ev.concat(step(s, { guard: true }));
    expect(count(ev, 'guardContact')).toBe(0);
    expect(count(ev, 'guardBreak')).toBe(1);
    expect(s.lives).toBe(2);
  });

  it('GD-14 mashing Z during hold / push / release never damages from a distance', () => {
    const s = guardAt(0);
    s.building!.floors[0].hp = [1, 1, 1];
    step(s, { guard: true, guardPressed: true });
    const hp = hpSum(s);
    for (let i = 0; i < 30; i++) {
      const ev = step(s, { attack: true, attackPressed: i % 2 === 0 });
      for (const e of ev) if (e.t === 'hit') expect(e.contact.gap).toBeLessThanOrEqual(2);
      if (s.guardPhase === 'OFF') break;
    }
    expect(hpSum(s)).toBe(hp);
  });

  it('GD-15 Z and ↓ on the same contact frame: the guard wins, no damage, no life lost', () => {
    const s = guardAt(0);
    s.building!.floors[0].hp = [1, 1, 1];
    const hp = hpSum(s);
    const ev = step(s, { guard: true, guardPressed: true, attack: true, attackPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    expect(count(ev, 'hit')).toBe(0);
    expect(hpSum(s)).toBe(hp);
    expect(s.lives).toBe(3);
  });
});

describe('VIS — judgement is independent of frame rate, camera and screen size', () => {
  function heldAttackRun(hz: number, mult: number) {
    const s = playing(building(tall(12, [2, 2, 2], 30), 300));
    s.building!.baseSpeed = 115 * mult; s.building!.velocityY = s.building!.baseSpeed;
    let hits = 0, floors = 0;
    for (let t = 0; t < 3 && s.phase === 'PLAYING'; t += 1 / hz) {
      const ev = step(s, { attack: true }, 1 / hz);
      hits += count(ev, 'hit'); floors += count(ev, 'floor');
    }
    return { hits, floors, lives: s.lives };
  }

  it('VIS-03 holding Z at 30 / 60 / 120 Hz and 1.0 / 1.7 / 2.4× speed: no skipped contact, no crush, same result ±1', () => {
    for (const mult of [1, 1.7, 2.4]) {
      const r = [30, 60, 120].map((hz) => heldAttackRun(hz, mult));
      for (const x of r) { expect(x.lives).toBe(3); expect(x.hits).toBeGreaterThan(8); }
      expect(Math.max(...r.map((x) => x.floors)) - Math.min(...r.map((x) => x.floors))).toBeLessThanOrEqual(1);
    }
  });

  it('VIS-03 a ground guard pushes the same 36 wu and holds about the same time at 30 / 60 / 120 Hz', () => {
    for (const hz of [30, 60, 120]) {
      const s = guardAt(0);
      step(s, { guard: true, guardPressed: true }, 1 / hz);
      const y0 = s.building!.bottomY;
      let hold = 0;
      while (s.guardPhase === 'HOLD') { step(s, {}, 1 / hz); hold += 1000 / hz; }
      while (s.guardPhase === 'REPEL') step(s, {}, 1 / hz);
      expect(y0 - s.building!.bottomY).toBeGreaterThan(35); // RELEASE starts falling within its first tick
      expect(hold).toBeGreaterThanOrEqual(115); expect(hold).toBeLessThanOrEqual(140);
    }
  });

  it('VIS-02/04 the simulation never reads the camera, the canvas or the screen size', () => {
    const src = readFileSync(new URL('../src/core/game.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const word of ['camera', 'canvas', 'window', 'document', 'devicePixelRatio', 'innerWidth']) expect(src.includes(word)).toBe(false);
  });
});
