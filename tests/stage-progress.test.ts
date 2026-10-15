import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_STAGE_IDS, STAGES } from '../src/game/StageConfigs';
import { StageManager } from '../src/game/StageManager';

describe('stages', () => {
  it('runs the eight P0 landmarks in order and ends after Burj Khalifa', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['gyeongbokgung', 'lotte_world_tower', 'tokyo_tower', 'eiffel_tower', 'big_ben', 'colosseum', 'taj_mahal', 'burj_khalifa']);
    const m = new StageManager();
    const seen = [m.current.id];
    while (m.advance()) seen.push(m.current.id);
    expect(seen).toHaveLength(8);
    expect(m.isLast).toBe(true);
    expect(m.advance()).toBe(false);
    m.reset();
    expect(m.current.id).toBe('gyeongbokgung');
  });

  it('hazard rate grows from 8% to 22%', () => {
    expect(STAGES[0].hazardRate).toBe(0.08);
    expect(STAGES[7].hazardRate).toBe(0.22);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].hazardRate).toBeGreaterThanOrEqual(STAGES[i - 1].hazardRate);
  });

  it('stage 1 charges SUPER at the spec rate (13 hits); later stages never charge faster', () => {
    expect(STAGES[0].gaugeGain).toBe(8);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].gaugeGain).toBeLessThanOrEqual(STAGES[i - 1].gaugeGain);
  });

  it('every landmark has a name in every UI language', () => {
    for (const s of STAGES) for (const l of ['ko', 'en', 'ja', 'zh'] as const) expect(s.names[l].length).toBeGreaterThan(0);
  });

  it('each city is a series of buildings: about 10, fewer for taller landmarks', () => {
    const by = Object.fromEntries(STAGES.map((s) => [s.id, s.buildings]));
    expect(by.gyeongbokgung).toBe(10);
    expect(by.colosseum).toBe(10);
    for (const s of STAGES) expect(s.buildings).toBeGreaterThanOrEqual(5);
    for (const s of STAGES.filter((x) => x.aspect === 'tall')) expect(s.buildings).toBeLessThan(by.gyeongbokgung);
  });

  it('P1 landmarks are reserved but not in the rotation', () => {
    for (const id of RESERVED_STAGE_IDS) expect(STAGES.find((s) => s.id === id)).toBeUndefined();
  });

  it('every stage points at local files that exist (never a remote URL)', () => {
    for (const s of STAGES) {
      for (const src of [s.buildingSrc, s.backgroundSrc]) {
        expect(src).toMatch(/^assets\//);
        expect(fs.existsSync(path.join(__dirname, '..', 'public', src))).toBe(true);
      }
    }
  });
});
