import { describe, expect, it } from 'vitest';
import { BreakModel, buildGrid, isStatic, type CoverageFn } from '../src/game/Destruction';

const full: CoverageFn = () => 1;
// a "tower": only the middle third of the image has art
const tower: CoverageFn = (x0, _y0, x1) => Math.max(0, Math.min(x1, 2 / 3) - Math.max(x0, 1 / 3)) / (x1 - x0);

describe('grid cutting', () => {
  it('never makes a piece where the art is transparent', () => {
    const g = buildGrid(tower, { cols: 9, rows: 5, seed: 1, minActive: 1 });
    for (const t of g.tiles) {
      if (t.coverage === 0) expect(t.state).toBe('inactive');
      if (t.state !== 'inactive') expect(t.coverage).toBeGreaterThan(0);
    }
  });

  it('cuts finer when too few real pieces exist', () => {
    const g = buildGrid(tower, { cols: 3, rows: 3, seed: 1, minActive: 25 });
    expect(g.tiles.filter((t) => t.state !== 'inactive').length).toBeGreaterThanOrEqual(25);
  });

  it('neighbouring pieces share exactly the same cut line (no seams)', () => {
    const g = buildGrid(full, { cols: 4, rows: 4, seed: 42, minActive: 1 });
    const a = g.tiles[0], right = g.tiles[1], below = g.tiles[4];
    // a's right edge = points 2,3,4 ; right's left edge = points 0,7,6
    expect([a.poly[2], a.poly[3], a.poly[4]]).toEqual([right.poly[0], right.poly[7], right.poly[6]]);
    // a's bottom edge = 6,5,4 ; below's top edge = 0,1,2
    expect([a.poly[6], a.poly[5], a.poly[4]]).toEqual([below.poly[0], below.poly[1], below.poly[2]]);
  });

  it('every sparse cell next to art is owned by a real piece; others are cleared', () => {
    const g = buildGrid(tower, { cols: 9, rows: 5, seed: 3, minActive: 1 });
    const owned = g.groups.reduce((n, gr) => n + gr.polys.length, 0);
    expect(owned + g.emptyPolys.length).toBe(g.tiles.length);
  });
});

describe('breaking', () => {
  it('a broken piece leaves a real hole and scores once', () => {
    const m = new BreakModel(buildGrid(full, { cols: 5, rows: 5, seed: 1 }));
    const before = m.activeCount();
    const t = m.tiles[12];
    expect(m.hit(t)).toBe('destroyed');
    expect(t.state).toBe('fallen');
    expect(m.activeCount()).toBe(before - 1);
    expect(m.destroy(t)).toBe(false); // ultimate/chain on the same tile: no second score
    expect(m.hit(t)).toBe('none');
  });

  it('hard pieces take three hits, middle two, weak one', () => {
    const m = new BreakModel(buildGrid(full, { cols: 6, rows: 4, seed: 1, hardness: { middle: 0.3, hard: 0.2 } }));
    for (const hp of [1, 2, 3]) {
      const t = m.tiles.find((x) => x.maxHp === hp)!;
      for (let i = 1; i < hp; i++) { expect(m.hit(t)).toBe('damaged'); expect(t.hp).toBe(hp - i); }
      expect(m.hit(t)).toBe('destroyed');
    }
  });

  it('every floor has weak, middle and hard parts', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = buildGrid(full, { cols: 7, rows: 6, seed, minActive: 1, hardness: { middle: 0.3, hard: 0.15 } });
      for (let r = 0; r < 6; r++) {
        const hps = new Set(g.tiles.filter((t) => t.row === r).map((t) => t.maxHp));
        expect([...hps].sort()).toEqual([1, 2, 3]);
      }
    }
  });

  it('targets the nearest column, lowest piece first, within range only', () => {
    const m = new BreakModel(buildGrid(full, { cols: 5, rows: 5, seed: 1 }));
    const worldX = (t: { cx: number }) => t.cx * 500; // columns at 50,150,250,350,450
    const t = m.pickTarget(160, worldX, 85)!;
    expect(t.col).toBe(1);
    expect(t.row).toBe(4);
    expect(m.pickTarget(600, worldX, 85)).toBeNull();
  });

  it('small cut-off chunks fall after a shake; big ones never drop in one hit', () => {
    const m = new BreakModel(buildGrid(full, { cols: 5, rows: 6, seed: 1 }));
    // cut a 1-wide pillar loose: remove its neighbours on row 5 and the bottom piece
    const at = (c: number, r: number) => m.tiles[r * 5 + c];
    // break the whole bottom row: everything above is one huge floating chunk -> stays up
    for (let c = 0; c < 5; c++) m.hit(at(c, 5));
    expect(m.updateSupport()).toHaveLength(0);
    expect(m.activeCount()).toBe(25);

    const m2 = new BreakModel(buildGrid(full, { cols: 5, rows: 6, seed: 1 }));
    const at2 = (c: number, r: number) => m2.tiles[r * 5 + c];
    // isolate the top-left corner piece
    m2.hit(at2(1, 0)); m2.hit(at2(0, 1));
    const loose = m2.updateSupport();
    expect(loose.map((t) => t.id)).toEqual([at2(0, 0).id]);
    expect(at2(0, 0).state).toBe('unsupported');
    expect(m2.tick(100)).toHaveLength(0); // still shaking
    const dropped = m2.tick(400);
    expect(dropped).toHaveLength(1);
    expect(at2(0, 0).state).toBe('fallen');
    expect(m2.tick(1000)).toHaveLength(0); // never twice
  });

  it('ultimate order covers every remaining piece, bottom first, and clears the stage', () => {
    const m = new BreakModel(buildGrid(tower, { cols: 9, rows: 5, seed: 9, hardness: { middle: 0.3, hard: 0.2 } }));
    m.hit(m.tiles.find(isStatic)!);
    const order = m.ultimateOrder();
    expect(order.length).toBe(m.activeCount());
    for (let i = 1; i < order.length; i++) expect(order[i].row).toBeLessThanOrEqual(order[i - 1].row);
    let scored = 0;
    for (const t of order) if (m.destroy(t)) scored++;
    for (const t of order) if (m.destroy(t)) scored++; // same frame double-break attempt
    expect(scored).toBe(order.length);
    expect(m.activeCount()).toBe(0);
  });

  it('no piece can stay floating forever: repeated hits always clear the building', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const m = new BreakModel(buildGrid(tower, { cols: 5, rows: 12, seed }));
      const worldX = (t: { cx: number }) => t.cx * 300;
      let guard = 0;
      while (m.activeCount() > 0 && guard++ < 1000) {
        for (const x of [100, 150, 200]) {
          const t = m.pickTarget(x, worldX, 85);
          if (t) m.hit(t);
          m.updateSupport();
          m.tick(16);
        }
        m.tick(1000);
      }
      expect(m.activeCount()).toBe(0);
    }
  });
});
