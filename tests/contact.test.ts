// v3.0 P0 contact tests: CT (attack only on real contact), GD (guard only on real contact, hold/repel/release),
// VIS (frame-rate / render independence). World units; gap = pose surface − underside (> 0 = apart).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE, DANGER_Y, GROUND_Y } from '../src/config/balance';
import { CONTACT, GUARD_FEEL, JUMP_FEEL } from '../src/config/gameFeel';
import { attack, attackSurfaceY, guardPlaneY, laneOverlap, NO_INPUT, special, sweptContact, takeEvents, tick, type GameEvent, type Intents, type RunState } from '../src/core/game';
import type { HP } from '../src/core/building';
import { building, CONTACT_Y as CONTACT_Y_T, floor, playing } from './helpers';

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

  it('CT-05 underside touching or pressing the blade down (2 wu above … the head), right lane: HP −1 exactly', () => {
    for (const gap of [0, 1, 2, -1, -3, -8, -12]) {
      const s = attackAt(gap);
      const before = s.building!.floors[0].hp[1];
      attack(s);
      const hits = takeEvents(s).filter((e) => e.t === 'hit');
      expect(hits).toHaveLength(1);
      expect(s.building!.floors[0].hp[1]).toBe(before - 1);
      const h = hits[0];
      if (h.t === 'hit') { expect(h.contact.contactConfirmed).toBe(true); expect(h.contact.atExactContact).toBe(true); expect(h.contact.laneMatched).toBe(true); }
    }
    const deep = attackAt(-13); // below the head: it has already crushed the hero, no hit
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
    expect(s.building!.floors[0].hp[1]).toBe(2);
    let hits = count(takeEvents(s), 'hit');
    for (let i = 0; i < 60; i++) hits += count(step(s, {}, 1 / 240), 'hit'); // no new press
    expect(hits).toBe(1);
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
    for (let i = 0; i < 120 && firstHitAt < 0; i++) {
      const ev = step(s, { attack: true, attackPressed: true });
      for (const e of ev) if (e.t === 'hit') { firstHitAt = i; expect(e.contact.gap).toBeLessThanOrEqual(CONTACT.touchEpsilonWu); }
      if (firstHitAt < 0) lastGap = attackSurfaceY(s) - s.building!.bottomY;
    }
    expect(firstHitAt).toBeGreaterThan(3); // it takes real falling time
    expect(lastGap).toBeLessThan(28);
  });

  it('CT-11 a hit never moves the building up (no kick, no teleport); it keeps creeping at the level pressure', () => {
    for (const pressure of [0, 80, 175]) {
      const s = attackAt(0, [3, 3, 3], 400);
      s.building!.pressure = pressure;
      const y0 = s.building!.bottomY;
      attack(s);
      expect(s.building!.bottomY).toBe(y0);
      expect(s.building!.velocityY).toBe(pressure);
      let prev = s.building!.bottomY;
      for (let i = 0; i < 6; i++) { step(s); expect(s.building!.bottomY).toBeGreaterThanOrEqual(prev); prev = s.building!.bottomY; }
    }
  });

  it('CT-12 the special still clears the building from far away', () => {
    const s = attackAt(300);
    s.special = 100;
    expect(special(s)).toBe(true);
    const b = s.building!;
    while (s.phase === 'SPECIAL') step(s);
    expect(b.floors).toHaveLength(0);
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
          expect(e.contact.gap).toBeGreaterThanOrEqual(-CONTACT.attackReachAboveHead); // pressing down, never below the head
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

describe('GD — v4 guard: unlimited, held or pressed, always succeeds on real contact', () => {
  it('GD-01 building 80 wu above: pose only; no stop, no push, no success', () => {
    const s = guardAt(80);
    const b = s.building!;
    const ev = step(s, { guard: true, guardPressed: true });
    expect(s.player.guarding).toBe(true);
    expect(b.velocityY).toBe(115);
    expect(b.bottomY).toBeCloseTo(guardPlaneY(s) - 80 + 115 * DT, 5);
    expect(count(ev, 'guardContact')).toBe(0);
  });

  it('GD-02 ↓ held from 50 wu: the fall is untouched until real contact, then success', () => {
    const s = guardAt(50);
    const b = s.building!;
    let y = b.bottomY, ev: GameEvent[] = [];
    for (let i = 0; i < 60 && s.guardPhase === 'OFF'; i++) {
      ev = step(s, { guard: true, guardPressed: i === 0 });
      if (s.guardPhase === 'OFF') expect(b.bottomY).toBeCloseTo(y + 115 * DT, 5);
      y = b.bottomY;
    }
    expect(count(ev, 'guardContact')).toBe(1);
    expect(Math.abs(guardPlaneY(s) - b.bottomY)).toBeLessThanOrEqual(2); // caught within the 2 wu touch tolerance
    expect(s.lives).toBe(3);
  });

  it('GD-03 already touching (0–2 wu) and ↓ pressed for the first time: success on that tick, no life lost', () => {
    for (const gap of [0, 1, 2, -2, -6]) {
      const s = guardAt(gap);
      const ev = step(s, { guard: true, guardPressed: true });
      expect(count(ev, 'guardContact')).toBe(1);
      expect(s.building!.velocityY).toBe(0);
      expect(s.lives).toBe(3);
      const g = ev.find((e) => e.t === 'guardContact');
      if (g?.t === 'guardContact') expect(g.motionOwner).toBe('GUARD_HOLD');
    }
  });

  it('GD-04 650 wu/s at 30 Hz with ↓ held: swept contact, stopped at the blade, held ~200 ms, no life lost', () => {
    const s = guardAt(60, 650);
    let ev: GameEvent[] = [];
    for (let i = 0; i < 10 && s.guardPhase === 'OFF'; i++) ev = ev.concat(step(s, { guard: true }, 1 / 30));
    expect(count(ev, 'guardContact')).toBe(1);
    const y = s.building!.bottomY;
    expect(y).toBeCloseTo(guardPlaneY(s), 5);
    let held = 0;
    while (s.guardPhase === 'HOLD') { step(s, { guard: true }, 1 / 30); if (s.guardPhase === 'HOLD') expect(s.building!.bottomY).toBe(y); held += 1000 / 30; }
    expect(held).toBeGreaterThanOrEqual(190); expect(held).toBeLessThanOrEqual(235);
    expect(s.lives).toBe(3);
  });

  it('GD-05 gap +7 → −8 in one tick: found by the swept test, stopped AT the blade (not 7 wu early)', () => {
    const s = guardAt(7, 15 * 60);
    const ev = step(s, { guard: true, guardPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    expect(s.building!.bottomY).toBeCloseTo(guardPlaneY(s), 5);
  });

  it('GD-06/07/08 hold pinned (≤2 wu), push exactly 36 wu over ~170 ms (never a teleport), release blends back', () => {
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
    for (let i = 1; i < log.length; i++) expect(Math.abs(log[i].y - log[i - 1].y)).toBeLessThan(8); // peak ≈ 400 wu/s; never a 36 wu jump
    const rel = log.slice(releaseStart).filter((x) => x.phase === 'RELEASE');
    for (let i = 1; i < rel.length; i++) expect(rel[i].v).toBeGreaterThanOrEqual(rel[i - 1].v);
    expect(rel.length * DT * 1000).toBeLessThanOrEqual(85);
  });

  it('GD-09 one ↓ press = one guard: holding ↓ does not block again; let go and press again and it does', () => {
    const s = guardAt(120, 300);
    let ev: GameEvent[] = [];
    let i = 0;
    while (s.guardPhase !== 'OFF' || count(ev, 'guardContact') === 0) { ev = ev.concat(step(s, { guard: true, guardPressed: i++ === 0 })); if (i > 300) break; }
    expect(count(ev, 'guardContact')).toBe(1);
    expect(s.player.guarding).toBe(false); // the guard lets go at once, even with ↓ still held
    ev = [];
    for (let t = 0; t < 3 && s.phase === 'PLAYING'; t += DT) ev = ev.concat(step(s, { guard: true }));
    expect(count(ev, 'guardContact')).toBe(0); // still holding: no second block (crushed instead)
    const r = guardAt(120, 300);
    let n = 0;
    for (let t = 0, k = 0; t < 3; t += DT, k++) {
      const held = k % 40 < 30; // ↓ held, let go, pressed again …
      n += count(step(r, { guard: held, guardPressed: held && k % 40 === 0 }), 'guardContact');
    }
    expect(n).toBeGreaterThanOrEqual(2);
    expect(Object.keys(s)).not.toContain('guard'); // no gauge in the state at all
  });

  it('GD-13 after a guard the building comes back slowly for a moment, then speeds back up', () => {
    const s = guardAt(0, 500);
    const b = s.building!;
    step(s, { guard: true, guardPressed: true });
    while (s.guardPhase !== 'OFF') step(s);
    b.bottomY -= 400; // room to watch the whole slow spell and the speed-up before it reaches the hero
    const slow = Math.max(GUARD_FEEL.postGuardSlowMin, 500 * GUARD_FEEL.postGuardSlowFactor);
    for (let t = 0; t < 0.6; t += DT) { step(s); expect(b.velocityY).toBeLessThanOrEqual(slow + 1e-6); }
    for (let i = 0; i < 60; i++) step(s); // the slow spell (1.3 s) is over …
    expect(s.phase).toBe('PLAYING');
    expect(b.velocityY).toBeGreaterThan(slow + 50); // … and it falls at full speed again
  });

  it('GD-10/11 mashing across one contact: one success per episode, ground guard resets the combo', () => {
    const s = guardAt(6);
    s.combo = 9; s.comboMs = 1500;
    let contacts = 0;
    for (let i = 0; i < 20; i++) contacts += count(step(s, { guard: true, guardPressed: true }), 'guardContact');
    expect(contacts).toBe(1);
    expect(s.combo).toBe(0);
  });

  it('GD-12 air guard: combo kept, hold ~170 ms, push 18 wu', () => {
    const s = playing(building(tall(6)));
    s.player.y = 100;
    const b = s.building!;
    b.bottomY = guardPlaneY(s); b.baseSpeed = 0; b.velocityY = 0;
    s.combo = 7; s.comboMs = 1500;
    const ev = step(s, { guard: true, guardPressed: true });
    const g = ev.find((e) => e.t === 'guardContact');
    expect(g?.t === 'guardContact' && g.kind).toBe('air');
    expect(s.combo).toBe(7);
    const y0 = b.bottomY;
    let hold = 0;
    let landedMs = -1;
    while (s.guardPhase === 'HOLD') {
      step(s); hold += DT * 1000; expect(b.bottomY).toBe(y0);
      expect(s.player.y === 0 || s.player.vy < 0).toBe(true); // the building is pinned; the hero is knocked straight down
      if (landedMs < 0 && s.player.y === 0) landedMs = hold;
    }
    expect(landedMs).toBeGreaterThan(0); expect(landedMs).toBeLessThanOrEqual(120); // from 100 wu up: on the ground in ~0.1 s
    expect(hold).toBeGreaterThanOrEqual(160); expect(hold).toBeLessThanOrEqual(190);
    while (s.guardPhase === 'REPEL') step(s);
    expect(y0 - b.bottomY).toBeCloseTo(18, 5);
    for (let i = 0; i < 30 && s.player.y > 0; i++) step(s);
    expect(s.player.y).toBe(0); // straight back down to the ground, no clinging after the guard
  });

  it('GD-13 guarding gives no score, combo or special', () => {
    const s = guardAt(120, 300);
    for (let t = 0; t < 3; t += DT) step(s, { guard: true });
    expect([s.score, s.combo, s.special]).toEqual([0, 0, 0]);
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

  it('GD-15 Z + ↓ on the same contact frame, even about to crush: the guard wins, no damage, no life lost', () => {
    const s = guardAt(0, 650);
    s.building!.floors[0].hp = [1, 1, 1];
    const hp = hpSum(s);
    const ev = step(s, { guard: true, guardPressed: true, attack: true, attackPressed: true });
    expect(count(ev, 'guardContact')).toBe(1);
    expect(count(ev, 'hit') + count(ev, 'lifeLost')).toBe(0);
    expect(hpSum(s)).toBe(hp);
    expect(s.lives).toBe(3);
  });
});

describe('AIR — high jump up to the building, stuck to it: guard and attack work up there', () => {
  const leap = (bottom: number, speed = 0) => {
    const s = playing(building(tall(6), bottom));
    s.building!.baseSpeed = speed; s.building!.velocityY = speed;
    step(s, { jump: true, jumpPressed: true });
    let i = 0;
    while (attackSurfaceY(s) - s.building!.bottomY > 0.5 && i++ < 90) step(s, { jump: true });
    return s;
  };

  it('AIR-01 ↓ pressed any time while stuck under it (0–280 ms after touching) is a guard', () => {
    for (const bottom of [90, 160, 240]) for (const delay of [0, 50, 120, 200, 280]) {
      const s = leap(bottom, 190);
      expect(s.player.y).toBeGreaterThan(50);
      for (let t = 0; t < delay; t += 1000 / 60) step(s);
      const ev = step(s, { guard: true, guardPressed: true });
      const g = ev.find((e) => e.t === 'guardContact');
      expect(g?.t === 'guardContact' && g.kind).toBe('air');
    }
  });

  it('AIR-02 ↓ held from take-off guards on arrival; Z hits up there, then the hero comes back down', () => {
    const s = playing(building(tall(6), 120));
    s.building!.baseSpeed = 190; s.building!.velocityY = 190;
    let ev = step(s, { jump: true, jumpPressed: true, guard: true, guardPressed: true });
    for (let i = 0; i < 40; i++) ev = ev.concat(step(s, { guard: true }));
    expect(count(ev, 'guardContact')).toBeGreaterThanOrEqual(1);
    const a = leap(120, 190);
    let hits = 0;
    for (let i = 0; i < 60; i++) { hits += count(step(a, { attack: true, attackPressed: i === 0 }), 'hit'); }
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(a.player.y).toBe(0); // no staying up there just because Z is held
  });

  it('AIR-03 with nothing held the hero lets go after the short cling and falls back down', () => {
    const s = leap(150);
    for (let i = 0; i < 90; i++) step(s);
    expect(s.player.y).toBe(0);
  });
});

describe('FLOW — after a break the building pops up a little and the hero lands; every building starts on the ground', () => {
  const leapAndHit = (hp: [HP, HP, HP], floors = 4) => {
    const s = playing(building(tall(floors, hp, 30), 150));
    s.building!.baseSpeed = 0; s.building!.velocityY = 0;
    step(s, { jump: true, jumpPressed: true });
    for (let i = 0; i < 40 && s.player.y > 0 && attackSurfaceY(s) - s.building!.bottomY > 0.5; i++) step(s, { jump: true });
    return s;
  };

  it('FLOW-01 a floor broken in the air: the rest pops up a little, the hero drops straight to the ground', () => {
    const s = leapAndHit([1, 1, 1]);
    expect(s.player.y).toBeGreaterThan(100);
    const b = s.building!;
    const before = b.bottomY;
    const ev = step(s, { attack: true, attackPressed: true });
    expect(count(ev, 'floor')).toBe(1);
    const afterBreak = b.bottomY; // the broken floor's height is gone
    let top = afterBreak, t = 0;
    while (s.player.y > 0 && t < 1) { step(s, { attack: true }); top = Math.min(top, b.bottomY); t += DT; }
    expect(afterBreak).toBeLessThan(before);
    expect(afterBreak - top).toBeGreaterThan(5); // the little extra pop
    expect(afterBreak - top).toBeLessThan(20); // floats up ~14 wu, then comes down slowly
    expect(t).toBeLessThan(0.45); // landed quickly, even with Z held
    expect(s.player.y).toBe(0);
  });

  it('FLOW-02 holding Z under a building never keeps the hero hanging up there', () => {
    const s = leapAndHit([3, 3, 3], 6);
    let t = 0;
    while (s.player.y > 0 && t < 2) { step(s, { attack: true, attackPressed: t === 0 }); t += DT; }
    expect(t).toBeLessThan(0.8);
  });

  it('FLOW-03 the next building (and the next stage) starts with the hero on the ground', () => {
    const s = leapAndHit([1, 1, 1], 1); // one floor: breaking it clears the building
    expect(s.player.y).toBeGreaterThan(100);
    step(s, { attack: true, attackPressed: true });
    expect(s.phase).toBe('PLAYING'); // the next building falls at once, no pause for its name
    let i = 0;
    while (s.player.y > 0 && i++ < 60) step(s, { attack: true });
    expect(s.player.y).toBe(0); // landed within a second
    expect(s.building!.floors.length).toBeGreaterThan(0);
  });
});

describe('UP — ↑ always gets you up there fast', () => {
  it('UP-01 holding ↑ jumps again the instant the hero lands (no pause)', () => {
    const s = playing(building(tall(4), -3000)); // open sky
    s.building!.baseSpeed = 0; s.building!.velocityY = 0;
    let jumps = 0, lastLand = -1, gap = 99;
    for (let i = 0; i < 200; i++) {
      const ev = step(s, { jump: true, jumpPressed: i === 0 });
      for (const e of ev) { if (e.t === 'land') lastLand = i; if (e.t === 'jump') { jumps++; if (lastLand >= 0) gap = Math.min(gap, i - lastLand); } }
    }
    expect(jumps).toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(1); // next jump on the landing tick or the one after
  });

  it('UP-02 after a floor breaks in the air, ↑ while dropping leaps straight back up to the building', () => {
    const s = playing(building(tall(4, [1, 1, 1], 30), 150));
    s.building!.baseSpeed = 0; s.building!.velocityY = 0;
    step(s, { jump: true, jumpPressed: true });
    for (let i = 0; i < 40 && attackSurfaceY(s) - s.building!.bottomY > 0.5; i++) step(s, { jump: true });
    step(s, { attack: true, attackPressed: true }); // breaks a floor → the hero starts dropping
    for (let i = 0; i < 5; i++) step(s);
    const yDrop = s.player.y;
    expect(s.player.vy).toBeLessThan(0);
    expect(yDrop).toBeGreaterThan(50);
    step(s, { jump: true, jumpPressed: true }); // ↑ in mid-air
    let peak = 0, touched = false;
    for (let i = 0; i < 40; i++) { step(s, { jump: true }); peak = Math.max(peak, s.player.y); if (attackSurfaceY(s) - s.building!.bottomY <= 2) touched = true; }
    expect(peak).toBeGreaterThan(yDrop + 10);
    expect(touched).toBe(true); // back up at the next floor without landing first
  });

  it('UP-03 a press up to 0.25 s before landing still jumps; ↑ while stuck under the building never drops the hero', () => {
    const s = playing(building(tall(4), -3000));
    s.building!.baseSpeed = 0; s.building!.velocityY = 0;
    step(s, { jump: true, jumpPressed: true });
    while (s.player.vy > 0 || s.player.y > 120) step(s); // falling, still well above the ground
    step(s, { jumpPressed: true }); // early press, then let go
    let jumped = false;
    for (let i = 0; i < 30; i++) if (count(step(s), 'jump')) jumped = true;
    expect(jumped).toBe(true);
    const c = playing(building(tall(6), 200));
    c.building!.baseSpeed = 0; c.building!.velocityY = 0;
    step(c, { jump: true, jumpPressed: true });
    for (let i = 0; i < 40 && !c.player.clinging; i++) step(c, { jump: true });
    expect(c.player.clinging).toBe(true);
    const y = c.player.y;
    step(c, { jump: true, jumpPressed: true });
    expect(c.player.y).toBeGreaterThanOrEqual(y - 0.01);
  });

  it('UP-04 holding ↑ between buildings never stalls the next one', () => {
    const s = playing(building([floor([1, 1, 1], 1, 30)], CONTACT_Y_T));
    attack(s); // clears the building
    expect(s.phase).toBe('PLAYING'); // no hand-over pause at all
    const b = s.building!, y0 = b.bottomY;
    for (let i = 0; i < 20; i++) step(s, { jump: true, jumpPressed: i % 10 === 0 });
    expect(s.building).toBe(b);
    expect(b.bottomY).toBeGreaterThan(y0); // already falling
  });
});

describe('CR — crush: one life, the hero buried under the building, Z breaks out and blasts it back up', () => {
  const crush = (speed = 190) => { const s = playing(building(tall(5), DANGER_Y - 20)); s.building!.baseSpeed = speed; s.building!.velocityY = speed; return s; };
  const untilBuried = (s: RunState) => { const ev: GameEvent[] = []; while (s.phase === 'PLAYING') ev.push(...step(s)); for (let i = 0; i < 12; i++) ev.push(...step(s)); return ev; };

  it('CR-01 a crush costs exactly one life and the building comes all the way down over the hero', () => {
    const s = crush();
    const ev = untilBuried(s);
    expect(s.phase).toBe('BURIED');
    expect(count(ev, 'lifeLost')).toBe(1);
    expect(count(ev, 'buried')).toBe(1);
    expect(s.lives).toBe(2);
    expect(s.building!.bottomY).toBe(GROUND_Y); // the hero (head at 468) is completely under it
    for (let i = 0; i < 120; i++) step(s, { guard: true, guardPressed: true, jump: true, jumpPressed: true }); // nothing but Z gets out
    expect(s.phase).toBe('BURIED');
    expect(s.lives).toBe(2);
  });

  it('CR-02 Z breaks the floor on top of the hero (one floor) and the building flies back up high', () => {
    const s = crush();
    untilBuried(s);
    const b = s.building!;
    const floors = b.floors.length, score = s.score;
    const ev = step(s, { attack: true, attackPressed: true });
    expect(count(ev, 'buriedBreak')).toBe(1);
    expect(b.floors.length).toBe(floors - 1);
    expect(s.phase).toBe('ESCAPE');
    let prev = b.bottomY;
    while (s.phase === 'ESCAPE') { step(s, { attack: true, attackPressed: true }); expect(b.bottomY).toBeLessThanOrEqual(prev + 1e-9); prev = b.bottomY; }
    expect(s.phase).toBe('PLAYING');
    expect(b.bottomY).toBeLessThan(DANGER_Y - 200); // back up at its spawn height
    expect(s.lives).toBe(2);
    expect(s.score).toBe(score); // escaping is not scored
  });

  it('CR-03 mashing Z under the rubble breaks exactly one floor; no more lives are lost', () => {
    const s = crush();
    untilBuried(s);
    const floors = s.building!.floors.length;
    let ev: GameEvent[] = [];
    for (let i = 0; i < 30; i++) ev = ev.concat(step(s, { attack: true, attackPressed: true }));
    expect(count(ev, 'buriedBreak')).toBe(1);
    expect(s.building!.floors.length).toBeGreaterThanOrEqual(floors - 1 - count(ev, 'floor'));
    expect(count(ev, 'lifeLost')).toBe(0);
  });

  it('CR-04 breaking out from under a one-floor building clears it and the next one comes', () => {
    const s = playing(building([floor([3, 3, 3])], DANGER_Y - 5));
    untilBuried(s);
    step(s, { attack: true, attackPressed: true });
    expect(s.phase).toBe('PLAYING');
    expect(s.building!.id).not.toBe('test');
  });

  it('CR-05 the last life → buried, alive and waiting with no timer; only the attack press ends the run', () => {
    const s = crush();
    s.lives = 1;
    untilBuried(s);
    for (let i = 0; i < 600; i++) step(s, { guard: true, jump: true }); // 10 s buried: nothing happens
    expect(s.phase).toBe('BURIED');
    for (let i = 0; i < 5; i++) step(s, { attack: true, attackPressed: true });
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.building).toBeNull();
  });
});

describe('SP — v4 special sweep', () => {
  it('SP-01..06 X at 100: gauge 0, collision off at once; floors burst bottom → top, once each; finish; next building', () => {
    const s = playing(building(tall(12, [3, 3, 3], 40), DANGER_Y - 5));
    s.building!.baseSpeed = 650; s.building!.velocityY = 650;
    s.special = 100;
    const b = s.building!;
    const ids = b.floors.map((f) => f.id);
    let ev = step(s, { specialPressed: true });
    expect(s.special).toBe(0);
    expect(b.collisionDisabled).toBe(true);
    const scoreAfterStart = s.score;
    let t = 0;
    while (s.phase === 'SPECIAL' && t < 3) { ev = ev.concat(step(s, { attack: true, attackPressed: true })); t += DT; }
    expect(t).toBeGreaterThanOrEqual(1.0); expect(t).toBeLessThanOrEqual(1.5);
    const slashes = ev.filter((e) => e.t === 'specialSlash');
    expect(slashes.map((e) => e.t === 'specialSlash' && e.floor.id)).toEqual(ids); // every floor, bottom to top, once
    expect(count(ev, 'specialFinish')).toBe(1);
    expect(count(ev, 'building')).toBe(1);
    expect(count(ev, 'lifeLost') + count(ev, 'hit')).toBe(0);
    expect(s.score).toBe(scoreAfterStart); // paid once, at the start
    expect(s.special).toBe(0);
    expect(b.floors).toHaveLength(0);
    expect(s.phase).toBe('PLAYING');
    expect(s.building).not.toBe(b);
  });

  it('SP-03 a building far above the screen is still swept to its very top', () => {
    const s = playing(building(tall(20, [3, 3, 3], 40), 300)); // top at y = −500
    s.special = 100;
    special(s);
    let minSlash = Infinity;
    while (s.phase === 'SPECIAL') { step(s); if (s.specialSeq) minSlash = Math.min(minSlash, s.specialSeq.slashY); }
    expect(minSlash).toBeLessThanOrEqual(300 - 20 * 40 + 1);
  });
});

describe('VIS — judgement is independent of frame rate, camera and screen size', () => {
  function heldAttackRun(hz: number, mult: number) {
    const s = playing(building(tall(12, [2, 2, 2], 30), 300));
    s.building!.baseSpeed = 115 * mult; s.building!.velocityY = s.building!.baseSpeed; s.building!.pressure = 0;
    let hits = 0, floors = 0;
    for (let t = 0; t < 5 && s.phase === 'PLAYING'; t += 1 / hz) {
      const ev = step(s, { attack: true }, 1 / hz);
      hits += count(ev, 'hit'); floors += count(ev, 'floor');
    }
    return { hits, floors, lives: s.lives };
  }

  it('VIS-03 holding Z at 30 / 60 / 120 Hz and 1.0 / 1.7 / 2.4× speed: no skipped contact, no crush, same result ±2 floors in 3 s', () => {
    // (the game itself always simulates at a fixed 60 Hz; this checks the rules are not fragile to the step size —
    //  the remaining ±2 is only whether a fresh floor lands just before or just after a swing starts)
    for (const mult of [1, 1.7, 2.4]) {
      const r = [30, 60, 120].map((hz) => heldAttackRun(hz, mult));
      for (const x of r) { expect(x.lives).toBe(3); expect(x.hits).toBeGreaterThan(8); }
      expect(Math.max(...r.map((x) => x.floors)) - Math.min(...r.map((x) => x.floors))).toBeLessThanOrEqual(2);
    }
  });

  it('VIS-03 speeds 190–650 wu/s at 30 / 60 / 120 / 144 Hz with no pressure: holding Z never loses a hit to frame timing', () => {
    for (const sp of [190, 240, 300, 390, 490, 600, 650]) for (const hz of [30, 60, 120, 144]) {
      const s = playing(building(Array.from({ length: 14 }, (_, i) => floor([2, 3, 2], i + 1, 22 + (i % 3) * 9)), 100));
      s.building!.baseSpeed = sp; s.building!.velocityY = sp; s.building!.pressure = 0;
      let lost = 0, hits = 0;
      for (let t = 0; t < 5 && s.phase === 'PLAYING'; t += 1 / hz) {
        const ev = step(s, { attack: true }, 1 / hz);
        lost += count(ev, 'lifeLost'); hits += count(ev, 'hit');
        for (const e of ev) if (e.t === 'hit') expect(e.contact.gap).toBeLessThanOrEqual(2);
      }
      expect(lost).toBe(0);
      expect(hits).toBeGreaterThan(8);
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
      expect(hold).toBeGreaterThanOrEqual(190); expect(hold).toBeLessThanOrEqual(235);
    }
  });

  it('VIS-02/04 the simulation never reads the camera, the canvas or the screen size', () => {
    const src = readFileSync(new URL('../src/core/game.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const word of ['camera', 'canvas', 'window', 'document', 'devicePixelRatio', 'innerWidth']) expect(src.includes(word)).toBe(false);
  });
});

describe('STICK — the hero never hangs on the underside', () => {
  it('STICK-01 random ↑ / ↓ mashing and holding against falling buildings: never stuck up there over the 0.3 s cling', () => {
    let rnd = 12345;
    const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
    for (let run = 0; run < 40; run++) {
      const s = playing(building(tall(8), 200 + r() * 100));
      const b = s.building!;
      b.baseSpeed = b.velocityY = 150 + r() * 400;
      let down = false, stuck = 0, worst = 0, stuckDown = 0, worstDown = 0;
      for (let i = 0; i < 60 * 6 && s.phase === 'PLAYING'; i++) {
        if (r() < 0.06) down = !down; // ↓ held for a while, let go, held again …
        const up = r() < 0.08;
        const frozen = s.freezeMs > 0; // hit-stop pauses the cling clock too
        step(s, { jump: up, jumpPressed: up, guard: down, guardPressed: down && r() < 0.1, attack: !down && r() < 0.3 });
        const atUnderside = s.player.y > 0 && Math.abs(guardPlaneY(s) - b.bottomY) < 1 && s.player.vy === 0;
        stuck = atUnderside ? stuck + (frozen ? 0 : DT) : 0;
        stuckDown = atUnderside && down && !up ? stuckDown + DT : 0; // (a fresh ↑ is a deliberate leap back up)
        worst = Math.max(worst, stuck); worstDown = Math.max(worstDown, stuckDown);
      }
      expect(worst).toBeLessThanOrEqual(JUMP_FEEL.clingMs / 1000 + 2 * DT);
      expect(worstDown).toBeLessThanOrEqual(2 * DT); // ↓ up there: guarded and knocked down, or dropped — never hanging
    }
  });

  it('STICK-02 ↓ held but the guard already used: touching the building drops the hero at once', () => {
    const s = playing(building(tall(6), 300));
    const b = s.building!;
    b.baseSpeed = b.velocityY = 0;
    s.guardSpent = true;
    s.player.y = Math.max(0, DANGER_Y - CONTACT.attackReachAboveHead - b.bottomY);
    s.player.clinging = true; s.player.clingMs = JUMP_FEEL.clingMs;
    step(s, { guard: true });
    expect(s.player.clinging).toBe(false);
    let i = 0;
    while (s.player.y > 0 && i++ < 30) step(s, { guard: true });
    expect(i * DT).toBeLessThan(0.2);
  });
});
