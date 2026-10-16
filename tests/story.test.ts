// v5 story mode: stage data, wave generation fairness, progression rules, saving, and the story run flow.
import { describe, expect, it } from 'vitest';
import { DANGER_Y, fallSpeedFor, GROUND_Y, HERO_HEIGHT } from '../src/config/balance';
import { CONTACT } from '../src/config/gameFeel';
import { landmarkById } from '../src/config/landmarks';
import { newRun, NO_INPUT, special, startRun, startStoryRun, takeEvents, tick, type GameEvent, type Intents, type RunState } from '../src/core/game';
import { makeRng } from '../src/core/rng';
import { createStageWaves, generateStageFloorHp } from '../src/story/generator';
import { applyClear, canEnterStoryLevel, defaultProgress, parseProgress, starsFor, StoryStore, STORY_SAVE_KEY, type KV } from '../src/story/progress';
import { resolveStageFallSpeed, STORY_STAGES } from '../src/story/stages';

const DT = 1 / 60;
const GUARD_Y = GROUND_Y - HERO_HEIGHT - CONTACT.attackReachAboveHead;

describe('v5 stage data (§3)', () => {
  it('ten levels with the table values: wave counts, first speeds, floors', () => {
    expect(STORY_STAGES.map((s) => s.waveCount)).toEqual([3, 3, 4, 4, 4, 5, 5, 5, 5, 6]);
    expect(STORY_STAGES.map((s) => s.baseFallSpeed)).toEqual([190, 225, 260, 305, 355, 405, 455, 505, 560, 620]);
    expect(STORY_STAGES.map((s) => resolveStageFallSpeed(s, s.waveCount - 1))).toEqual([198, 234, 270, 317, 369, 421, 473, 525, 582, 645]);
    expect(STORY_STAGES.map((s) => s.floorsRange)).toEqual([[3, 4], [3, 5], [4, 6], [5, 7], [6, 8], [6, 9], [7, 10], [8, 11], [9, 12], [9, 14]]);
  });

  it('every level starts faster than the previous level ended; speeds rise within a level; never above 650', () => {
    for (let l = 0; l < 10; l++) {
      const st = STORY_STAGES[l];
      const speeds = Array.from({ length: st.waveCount }, (_, w) => resolveStageFallSpeed(st, w));
      for (let w = 1; w < speeds.length; w++) expect(speeds[w]).toBeGreaterThanOrEqual(speeds[w - 1]);
      expect(Math.max(...speeds)).toBeLessThanOrEqual(650);
      if (l > 0) { const prev = STORY_STAGES[l - 1]; expect(st.baseFallSpeed).toBeGreaterThan(resolveStageFallSpeed(prev, prev.waveCount - 1)); }
    }
  });

  it('every pooled landmark exists; levels 1–3 never use a top-tier tower', () => {
    for (const st of STORY_STAGES) for (const id of [...st.landmarkPool, ...(st.finalWaveLandmark ? [st.finalWaveLandmark] : [])]) expect(landmarkById(id)).toBeTruthy();
    for (const st of STORY_STAGES.slice(0, 3)) for (const id of st.landmarkPool) expect(['burj_khalifa', 'lotte_world_tower', 'petronas_towers', 'taipei_101']).not.toContain(id);
  });
});

describe('v5 wave generation (§6, §10.2)', () => {
  it('every generated wave: right count, pool, speed, floors; level 10 wave 6 is always the Burj Khalifa', () => {
    for (const st of STORY_STAGES) for (let seed = 1; seed <= 25; seed++) {
      const waves = createStageWaves(st, seed);
      expect(waves).toHaveLength(st.waveCount);
      waves.forEach((b, w) => {
        expect(b.baseSpeed).toBe(resolveStageFallSpeed(st, w));
        expect(b.floors.length).toBeGreaterThanOrEqual(st.floorsRange[0]);
        expect(b.floors.length).toBeLessThanOrEqual(st.floorsRange[1]);
        if (w === st.waveCount - 1 && st.finalWaveLandmark) expect(b.landmarkId).toBe(st.finalWaveLandmark);
        else expect(st.landmarkPool).toContain(b.landmarkId);
        if (w > 0 && st.landmarkPool.length > 2) expect(b.landmarkId === waves[w - 1].landmarkId && w !== st.waveCount - 1).toBe(false);
      });
    }
  });

  it('the same seed gives the same waves (reproducible); story speed never comes from the endless tiers', () => {
    const a = createStageWaves(STORY_STAGES[6], 42), b = createStageWaves(STORY_STAGES[6], 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const w of a) expect([fallSpeedFor(0), fallSpeedFor(20)]).not.toContain(w.baseSpeed);
  });

  it('weak-floor guarantee, no HP3×3 twice in a row, levels 1–2 always have a weak lane', () => {
    for (const st of STORY_STAGES) for (let seed = 0; seed < 120; seed++) for (const n of [st.floorsRange[0], st.floorsRange[1]]) {
      const hp = generateStageFloorHp(makeRng(seed * 7 + st.level), st, n);
      expect(hp.filter((h) => h.includes(1)).length).toBeGreaterThanOrEqual(Math.ceil(n * st.weakFloorGuarantee));
      for (let i = 1; i < n; i++) expect(hp[i - 1].every((x) => x === 3) && hp[i].every((x) => x === 3)).toBe(false);
      if (st.level <= 2) for (const h of hp) expect(h).toContain(1);
    }
    const l10 = generateStageFloorHp(makeRng(9), STORY_STAGES[9], 14);
    expect(l10.filter((h) => h.includes(1)).length).toBeGreaterThanOrEqual(8);
  });

  it('levels 1–4: the weak spot never ping-pongs far left ↔ far right for 3 floors in a row', () => {
    const end = (h: number[]) => { const w = [0, 1, 2].filter((i) => h[i] === 1); return w.length === 1 && w[0] !== 1 ? w[0] : -1; };
    for (const st of STORY_STAGES.slice(0, 4)) for (let seed = 0; seed < 200; seed++) {
      const hp = generateStageFloorHp(makeRng(seed), st, st.floorsRange[1]);
      for (let i = 2; i < hp.length; i++) {
        const a = end(hp[i - 2]), b = end(hp[i - 1]), c = end(hp[i]);
        expect(a >= 0 && b >= 0 && c >= 0 && a !== b && b !== c).toBe(false);
      }
    }
  });

  it('spawn → first guard contact (TTC) is inside each level band, and nothing spawns on the hero', () => {
    for (const st of STORY_STAGES) for (let seed = 1; seed <= 10; seed++) createStageWaves(st, seed).forEach((b) => {
      const ttc = (GUARD_Y - b.bottomY) / b.baseSpeed;
      expect(ttc).toBeGreaterThanOrEqual(st.ttcTarget[0] - 0.03); // later waves are up to 4% faster
      expect(ttc).toBeLessThanOrEqual(st.ttcTarget[1]);
      expect(b.bottomY).toBeLessThan(DANGER_Y - 150);
    });
  });
});

describe('v5 progress & unlocking (§9)', () => {
  const mem = (): KV & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }; };

  it('first run: only level 1 is open; locked or invalid levels can never be entered', () => {
    const p = defaultProgress();
    expect(canEnterStoryLevel(1, p)).toBe(true);
    for (const l of [2, 6, 10, 0, 11, 1.5, NaN, '1', null]) expect(canEnterStoryLevel(l, p)).toBe(false);
  });

  it('clearing level N unlocks exactly N+1; bests only go up; stars 3 / 2 / 1 by lives left', () => {
    expect([3, 2, 1].map((l) => starsFor(l))).toEqual([3, 2, 1]);
    let p = defaultProgress();
    let r = applyClear(p, 1, 5000, 20, 3); p = r.progress;
    expect([p.unlockedLevel, r.newlyUnlocked, p.levels[1].bestStars, p.totalStars]).toEqual([2, 2, 3, 3]);
    r = applyClear(p, 1, 100, 2, 1); p = r.progress; // a worse replay changes nothing
    expect([p.unlockedLevel, r.newlyUnlocked, p.levels[1].bestStars, p.levels[1].bestScore, p.totalStars]).toEqual([2, null, 3, 5000, 3]);
    for (let l = 2; l <= 10; l++) p = applyClear(p, l, 1, 1, 1).progress;
    expect([p.unlockedLevel, p.highestClearedLevel, p.totalStars]).toEqual([10, 10, 12]);
  });

  it('a clear is committed exactly once per attempt and survives a reload; endless records are untouched', () => {
    const kv = mem();
    kv.setItem('world-breaker-save-v2', JSON.stringify({ bestScore: 777 }));
    const a = new StoryStore(kv);
    expect(a.commitClear('L1:5', 1, 1000, 9, 2)?.saved).toBe(true);
    expect(a.commitClear('L1:5', 1, 1000, 9, 2)).toBeNull(); // duplicate callback
    const b = new StoryStore(kv); // reload
    expect([b.progress.unlockedLevel, b.progress.levels[1].bestStars]).toEqual([2, 2]);
    expect(JSON.parse(kv.getItem('world-breaker-save-v2')!).bestScore).toBe(777);
  });

  it('corrupted save → defaults with a notice; values are clamped', () => {
    expect(parseProgress('{oops').corrupted).toBe(true);
    const p = parseProgress(JSON.stringify({ schemaVersion: 5, unlockedLevel: 99, highestClearedLevel: -3, levels: { 1: { cleared: true, bestStars: 9 } } })).progress;
    expect([p.unlockedLevel, p.highestClearedLevel, p.levels[1].bestStars]).toEqual([10, 0, 3]);
    const kv = mem(); kv.setItem(STORY_SAVE_KEY, 'garbage');
    expect(new StoryStore(kv).corrupted).toBe(true);
  });
});

describe('v5 story run flow (§5)', () => {
  const step = (s: RunState, input: Partial<Intents> = {}) => { tick(s, DT, { ...NO_INPUT, ...input }); return takeEvents(s); };
  const toPlaying = (s: RunState) => { while (s.phase !== 'PLAYING') step(s); };
  const clearWithSpecial = (s: RunState) => { toPlaying(s); s.special = 100; special(s); const ev: GameEvent[] = []; while (s.phase === 'SPECIAL') ev.push(...step(s)); return ev; };

  it('level 1: three buildings down → STAGE CLEAR once; two is not enough', () => {
    const s = newRun(1);
    startStoryRun(s, 1, 77);
    expect(s.lives).toBe(3);
    clearWithSpecial(s);
    clearWithSpecial(s);
    expect(s.story!.wavesCleared).toBe(2);
    expect(s.phase).toBe('WAVE_TRANSITION');
    clearWithSpecial(s);
    let ev: GameEvent[] = [];
    for (let i = 0; i < 60; i++) ev = ev.concat(step(s));
    expect(ev.filter((e) => e.t === 'stageClear')).toHaveLength(1);
    expect(s.phase).toBe('GAME_OVER');
  });

  it('the waves come in the pre-generated order with their own speeds (not the endless tiers)', () => {
    const s = newRun(1);
    startStoryRun(s, 7, 5);
    const plan = s.story!.waves.map((w) => [w.landmarkId, w.baseSpeed]);
    const seen: (string | number)[][] = [];
    for (let i = 0; i < plan.length; i++) { toPlaying(s); seen.push([s.building!.landmarkId, s.building!.baseSpeed]); clearWithSpecial(s); }
    expect(seen).toEqual(plan);
  });

  it('a crush never counts as a cleared wave; the same wave comes back; losing every life fails the stage', () => {
    const s = newRun(1);
    startStoryRun(s, 2, 3);
    toPlaying(s);
    const wave = s.story!.waveIndex, landmark = s.building!.landmarkId;
    let ev: GameEvent[] = [];
    for (let k = 0; k < 3; k++) {
      while (s.phase === 'PLAYING' || s.phase === 'WAVE_TRANSITION') ev = ev.concat(step(s)); // crushed
      for (let i = 0; i < 15; i++) ev = ev.concat(step(s));
      // break out until the building is gone or the stage ended
      for (let i = 0; i < 400 && (s.phase as string) !== 'PLAYING' && s.phase !== 'GAME_OVER'; i++) ev = ev.concat(step(s, { attackPressed: s.phase === 'BURIED' }));
      expect(s.story!.wavesCleared).toBe(0);
      if ((s.phase as string) === 'PLAYING') { expect(s.story!.waveIndex).toBe(wave); expect(s.building!.landmarkId).toBe(landmark); }
    }
    expect(s.lives).toBe(0);
    expect(ev.filter((e) => e.t === 'stageFailed')).toHaveLength(1);
    expect(ev.filter((e) => e.t === 'stageClear')).toHaveLength(0);
  });

  it('the endless mode is untouched by story runs', () => {
    const s = newRun(1);
    startStoryRun(s, 9, 1);
    startRun(s, 1);
    expect([s.mode, s.story]).toEqual(['endless', null]);
    toPlaying(s);
    expect(s.building!.baseSpeed).toBe(190);
  });
});
