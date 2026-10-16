import { describe, expect, it } from 'vitest';
import { DANGER_Y } from '../src/config/balance';
import { attack, newRun, NO_INPUT, pause, resume, special, startRun, takeEvents, tick } from '../src/core/game';
import { building, floor, playing } from './helpers';

const DT = 1 / 60;
const tall = (n: number) => Array.from({ length: n }, (_, i) => floor([3, 3, 3], i + 1));

describe('combo, score, special (spec §7)', () => {
  it('T10 holding Z under a building in contact: real hits build combo, score and special', () => {
    const s = playing(building(tall(10)));
    for (let t = 0; t < 2; t += DT) tick(s, DT, { ...NO_INPUT, attack: true, attackPressed: t === 0 });
    expect(s.combo).toBeGreaterThanOrEqual(10);
    expect(s.lives).toBe(3);
    expect(s.score).toBeGreaterThan(0);
    expect(s.special).toBeGreaterThan(0);
  });

  it('T11 a swing with no building to hit changes nothing', () => {
    const s = playing(building([floor([1, 1, 1])]));
    s.building!.defeated = true;
    attack(s);
    for (let i = 0; i < 6; i++) tick(s, DT);
    expect([s.combo, s.score, s.special]).toEqual([0, 0, 0]);
    expect(takeEvents(s).map((e) => e.t)).toContain('whiff');
  });

  it('combo breaks after 1.5 s without a hit', () => {
    const s = playing(building(tall(10), 100));
    attack(s);
    for (let t = 0; t < 1.6; t += DT) tick(s, DT);
    expect(s.combo).toBe(0);
  });

  it('T15/T16 special at 99 does nothing; at 100 it empties the gauge, stops collision, then sweeps every floor away', () => {
    const s = playing(building(tall(8)));
    s.special = 99;
    expect(special(s)).toBe(false);
    expect(s.building!.floors).toHaveLength(8);
    s.special = 100;
    expect(special(s)).toBe(true);
    expect(s.special).toBe(0);
    expect(s.building!.collisionDisabled).toBe(true);
    expect(s.destroyedBuildings).toBe(1);
    expect(s.phase).toBe('SPECIAL');
    const b = s.building!;
    for (let t = 0; t < 2 && s.phase === 'SPECIAL'; t += DT) tick(s, DT);
    expect(b.floors).toHaveLength(0);
    expect(b.defeated).toBe(true);
    expect(s.phase).toBe('WAVE_TRANSITION');
  });

  it('T27 special pays each floor once at 65% and never twice', () => {
    const s = playing(building([floor([3, 3, 3], 1), floor([3, 3, 3], 2)]));
    s.special = 100;
    special(s);
    const floorPay = Math.round(105 * 0.65) + Math.round(110 * 0.65);
    const bonus = 500 + 100 + 2 * 20;
    expect(s.score).toBe(floorPay + bonus);
    expect(special(s)).toBe(false);
    expect(s.score).toBe(floorPay + bonus);
  });

  it('holding X never re-fires: the special needs a fresh press', () => {
    const s = playing(building(tall(5)));
    s.special = 100;
    tick(s, DT, { ...NO_INPUT }); // X held but not newly pressed: nothing
    expect(s.building!.floors).toHaveLength(5);
    tick(s, DT, { ...NO_INPUT, specialPressed: true });
    expect(s.phase).toBe('SPECIAL');
  });

  it('T17 the building touching the ground during the special costs no life', () => {
    const s = playing(building(tall(3), DANGER_Y - 1));
    s.special = 100;
    special(s);
    for (let t = 0; t < 1; t += DT) tick(s, DT);
    expect(s.lives).toBe(3);
  });
});

describe('lives, pause and restart', () => {
  it('T18/T19 exactly three real crashes end the run; one crash never costs two lives', () => {
    const s = playing(building(tall(5), DANGER_Y - 1));
    tick(s, DT); tick(s, DT); tick(s, DT); // the same contact over several frames
    expect(s.lives).toBe(2);
    for (let t = 0; t < 12 && s.phase !== 'GAME_OVER'; t += DT) {
      if (s.building && s.phase === 'PLAYING') s.building.bottomY = Math.max(s.building.bottomY, DANGER_Y - 1);
      tick(s, DT, { ...NO_INPUT, attackPressed: s.phase === 'BURIED' }); // break out each time
    }
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.building).toBeNull();
  });

  it('T20 five seconds paused changes nothing', () => {
    const s = playing(building(tall(5), 200));
    s.combo = 5; s.comboMs = 1000; s.special = 40;
    pause(s);
    const snap = JSON.stringify({ ...s, events: [] });
    for (let t = 0; t < 5; t += DT) tick(s, DT, { ...NO_INPUT, attack: true, attackPressed: true });
    expect(JSON.stringify({ ...s, events: [] })).toBe(snap);
    resume(s);
    expect(s.phase).toBe('PLAYING');
  });

  it('T21 pause/resume 20 times returns to the same phase without side effects', () => {
    const s = playing(building(tall(5), 200));
    for (let i = 0; i < 20; i++) { pause(s); resume(s); }
    expect(s.phase).toBe('PLAYING');
    expect(s.pausedFrom).toBeNull();
  });

  it('T28 a new run resets lives, score and gauges', () => {
    const s = newRun(1);
    s.score = 999; s.lives = 0; s.special = 80; s.combo = 9; s.damageSequences = 2;
    startRun(s, 2);
    expect([s.lives, s.score, s.special, s.combo, s.damageSequences, s.phase]).toEqual([3, 0, 0, 0, 0, 'COUNTDOWN']);
  });

  it('the countdown hands over to the first building within about a second', () => {
    const s = newRun(1);
    startRun(s);
    let t = 0;
    while (s.phase !== 'PLAYING' && t < 3) { tick(s, DT); t += DT; }
    expect(s.phase).toBe('PLAYING');
    expect(t).toBeLessThan(1.3);
    expect(s.building).not.toBeNull();
  });
});
