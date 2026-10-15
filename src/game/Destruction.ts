// Pure destruction model: grid cutting, tile state, structural support and once-only scoring.
// No DOM or canvas here so it can be unit tested; Building.ts turns it into pixels.
import { GAME_CONFIG } from './config';
import { makeRng } from './rng';
import type { DestructibleTile, Point } from './types';

/** Returns the share (0..1) of non-transparent art pixels inside a normalised rect. */
export type CoverageFn = (x0: number, y0: number, x1: number, y1: number) => number;

export interface GridOptions {
  cols: number;
  rows: number;
  seed: number;
  hpPerTile?: number;
  /** share of middle (2-hit) and hard (3-hit) pieces */
  hardness?: { middle: number; hard: number };
  minCoverage?: number;
  minActive?: number;
}

export interface TileGroup {
  tile: DestructibleTile;
  /** polygons this tile owns: its own cut plus nearby slivers too sparse to be their own tile */
  polys: Point[][];
}

const STATIC: ReadonlySet<string> = new Set(['intact', 'damaged', 'unsupported']);
export const isStatic = (t: DestructibleTile) => STATIC.has(t.state);
export const isTargetable = (t: DestructibleTile) => t.state === 'intact' || t.state === 'damaged';

/**
 * Jagged cut lines: every interior grid vertex and every edge midpoint is jittered once and shared by the
 * cells on both sides, so neighbouring pieces fit exactly and the untouched building shows no seams.
 */
function cutPolygons(cols: number, rows: number, seed: number): Point[][] {
  const rng = makeRng(seed);
  const cw = 1 / cols, ch = 1 / rows;
  const V: Point[][] = [];
  for (let i = 0; i <= cols; i++) {
    V[i] = [];
    for (let j = 0; j <= rows; j++) {
      const inner = i > 0 && i < cols && j > 0 && j < rows;
      V[i][j] = { x: i * cw + (inner ? rng.range(-0.16, 0.16) * cw : 0), y: j * ch + (inner ? rng.range(-0.16, 0.16) * ch : 0) };
    }
  }
  // H[i][j]: midpoint on the horizontal edge between V[i][j] and V[i+1][j]; Vm[i][j]: on vertical edge V[i][j]–V[i][j+1]
  const H: Point[][] = [], Vm: Point[][] = [];
  for (let i = 0; i <= cols; i++) {
    H[i] = []; Vm[i] = [];
    for (let j = 0; j <= rows; j++) {
      if (i < cols) {
        const a = V[i][j], b = V[i + 1][j];
        const inner = j > 0 && j < rows;
        H[i][j] = { x: (a.x + b.x) / 2 + (inner ? rng.range(-0.12, 0.12) * cw : 0), y: (a.y + b.y) / 2 + (inner ? rng.range(-0.2, 0.2) * ch : 0) };
      }
      if (j < rows) {
        const a = V[i][j], b = V[i][j + 1];
        const inner = i > 0 && i < cols;
        Vm[i][j] = { x: (a.x + b.x) / 2 + (inner ? rng.range(-0.2, 0.2) * cw : 0), y: (a.y + b.y) / 2 + (inner ? rng.range(-0.12, 0.12) * ch : 0) };
      }
    }
  }
  const polys: Point[][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      polys[r * cols + c] = [V[c][r], H[c][r], V[c + 1][r], Vm[c + 1][r], V[c + 1][r + 1], H[c][r + 1], V[c][r + 1], Vm[c][r]];
    }
  }
  return polys;
}

export interface Grid {
  cols: number;
  rows: number;
  tiles: DestructibleTile[];
  groups: TileGroup[];
  /** polygons that hold no art (or orphaned slivers); they must be cleared from the drawn building */
  emptyPolys: Point[][];
}

export function buildGrid(coverage: CoverageFn, opts: GridOptions): Grid {
  const minActive = opts.minActive ?? 25;
  const minCoverage = opts.minCoverage ?? 0.06;
  let { cols, rows } = opts;
  for (let attempt = 0; attempt < 4; attempt++) {
    const grid = buildOnce(coverage, cols, rows, minCoverage, opts);
    if (grid.tiles.filter((t) => t.state !== 'inactive').length >= minActive || attempt === 3) return grid;
    cols += 2; rows += 2; // too few real pieces: cut finer
  }
  throw new Error('unreachable');
}

function buildOnce(coverage: CoverageFn, cols: number, rows: number, minCoverage: number, opts: GridOptions): Grid {
  const rng = makeRng(opts.seed ^ 0x9e3779b9);
  const polys = cutPolygons(cols, rows, opts.seed);
  const tiles: DestructibleTile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cov = coverage(c / cols, r / rows, (c + 1) / cols, (r + 1) / rows);
      const active = cov >= minCoverage;
      const hp = opts.hpPerTile ?? 1;
      tiles.push({
        id: r * cols + c, col: c, row: r, state: active ? 'intact' : 'inactive', hp, maxHp: hp,
        poly: polys[r * cols + c], cx: (c + 0.5) / cols, cy: (r + 0.5) / rows, coverage: cov,
        grounded: false, shakeMs: 0, scored: false,
      });
    }
  }
  const active = tiles.filter((t) => t.state !== 'inactive');
  assignHardness(active, rows, opts.hardness ?? { middle: 0, hard: 0 }, opts.hpPerTile ?? 1, rng);
  // ground = the lowest row that holds any piece
  const bottom = Math.max(...active.map((t) => t.row), -1);
  for (const t of active) t.grounded = t.row === bottom;

  const groups = new Map<number, TileGroup>();
  for (const t of active) groups.set(t.id, { tile: t, polys: [t.poly] });
  const emptyPolys: Point[][] = [];
  const at = (c: number, r: number) => (c >= 0 && c < cols && r >= 0 && r < rows ? tiles[r * cols + c] : null);
  for (const t of tiles) {
    if (t.state !== 'inactive') continue;
    // a cut may reach up to ~0.2 cell into a neighbour, so a sparse cell or one beside art may still hold pixels
    let maybeArt = t.coverage > 0;
    for (let dr = -1; dr <= 1 && !maybeArt; dr++) for (let dc = -1; dc <= 1; dc++) if ((at(t.col + dc, t.row + dr)?.coverage ?? 0) > 0) maybeArt = true;
    if (!maybeArt || !active.length) { emptyPolys.push(t.poly); continue; }
    let best = active[0], bestD = Infinity;
    for (const a of active) {
      const d = (a.col - t.col) ** 2 + (a.row - t.row) ** 2 + (a.row < t.row ? 0.1 : 0) + (a.col !== t.col ? 0.01 : 0);
      if (d < bestD) { bestD = d; best = a; }
    }
    groups.get(best.id)!.polys.push(t.poly);
  }
  return { cols, rows, tiles, groups: [...groups.values()], emptyPolys };
}

/**
 * Every floor (row) mixes weak (1 hit), middle (2) and hard (3) pieces. A floor with three or more pieces always has
 * at least one of each; the rest follow the stage's shares.
 */
function assignHardness(active: DestructibleTile[], rows: number, mix: { middle: number; hard: number }, base: number, rng: ReturnType<typeof makeRng>) {
  if (mix.middle <= 0 && mix.hard <= 0) return;
  for (let r = 0; r < rows; r++) {
    const floor = active.filter((t) => t.row === r);
    const kinds: number[] = floor.map(() => { const x = rng.next(); return x < mix.hard ? 2 : x < mix.hard + mix.middle ? 1 : 0; });
    if (floor.length >= 3) {
      for (const need of [0, 1, 2]) {
        if (kinds.includes(need)) continue;
        // turn the most common kind on this floor into the missing one
        const counts = [0, 1, 2].map((k) => kinds.filter((x) => x === k).length);
        const from = counts.indexOf(Math.max(...counts));
        const idxs = kinds.map((k, i) => (k === from ? i : -1)).filter((i) => i >= 0);
        kinds[idxs[Math.floor(rng.next() * idxs.length)]] = need;
      }
    }
    floor.forEach((t, i) => { t.hp = t.maxHp = base + kinds[i]; });
  }
}

export type BreakCause = 'hit' | 'chain' | 'ultimate';

export class BreakModel {
  readonly tiles: DestructibleTile[];
  readonly initialActive: number;
  private readonly byPos: (DestructibleTile | null)[][];

  constructor(readonly grid: Grid) {
    this.tiles = grid.tiles;
    this.initialActive = this.tiles.filter(isStatic).length;
    this.byPos = [];
    for (let c = 0; c < grid.cols; c++) this.byPos[c] = [];
    for (const t of this.tiles) this.byPos[t.col][t.row] = t;
  }

  activeCount() {
    let n = 0;
    for (const t of this.tiles) if (isStatic(t)) n++;
    return n;
  }

  /** Nearest targetable tile horizontally within range; ties go to the lowest one. */
  pickTarget(heroX: number, tileWorldX: (t: DestructibleTile) => number, range: number): DestructibleTile | null {
    let best: DestructibleTile | null = null, bestDx = Infinity;
    for (const t of this.tiles) {
      if (!isTargetable(t)) continue;
      const dx = Math.abs(tileWorldX(t) - heroX);
      if (dx > range) continue;
      if (dx < bestDx - 1e-6 || (Math.abs(dx - bestDx) <= 1e-6 && best && t.row > best.row)) { best = t; bestDx = dx; }
    }
    return best;
  }

  /** One normal attack on a tile. Returns what happened. */
  hit(t: DestructibleTile): 'destroyed' | 'damaged' | 'none' {
    if (!isTargetable(t)) return 'none';
    t.hp -= 1;
    if (t.hp > 0) { t.state = 'damaged'; return 'damaged'; }
    return this.destroy(t) ? 'destroyed' : 'none';
  }

  /** Atomic static -> fallen transition. True exactly once per tile, whatever breaks it. */
  destroy(t: DestructibleTile): boolean {
    if (!isStatic(t) || t.scored) return false;
    t.state = 'fallen';
    t.scored = true;
    t.hp = 0;
    return true;
  }

  /**
   * Find pieces no longer connected to the ground. Chunks small enough fall after a short shake, lower rows first;
   * big chunks stay up so one lucky hit can never drop most of the landmark.
   */
  updateSupport(): DestructibleTile[] {
    const reached = new Set<number>();
    const queue: DestructibleTile[] = [];
    for (const t of this.tiles) if (isStatic(t) && t.grounded) { reached.add(t.id); queue.push(t); }
    while (queue.length) {
      const t = queue.pop()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.byPos[t.col + dc]?.[t.row + dr];
        if (n && isStatic(n) && !reached.has(n.id)) { reached.add(n.id); queue.push(n); }
      }
    }
    const cap = Math.max(3, Math.ceil(this.initialActive * GAME_CONFIG.maxChainShare));
    const seen = new Set<number>();
    const newlyLoose: DestructibleTile[] = [];
    for (const start of this.tiles) {
      if (!isTargetable(start) || reached.has(start.id) || seen.has(start.id)) continue;
      const comp: DestructibleTile[] = [];
      const stack = [start];
      seen.add(start.id);
      while (stack.length) {
        const t = stack.pop()!;
        comp.push(t);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.byPos[t.col + dc]?.[t.row + dr];
          if (n && isTargetable(n) && !reached.has(n.id) && !seen.has(n.id)) { seen.add(n.id); stack.push(n); }
        }
      }
      if (comp.length > cap) {
        // too big to drop: its lowest pieces become its new footing
        const low = Math.max(...comp.map((t) => t.row));
        for (const t of comp) if (t.row === low) t.grounded = true;
        continue;
      }
      const low = Math.max(...comp.map((t) => t.row));
      for (const t of comp) {
        t.state = 'unsupported';
        t.shakeMs = GAME_CONFIG.supportShakeMs + (low - t.row) * 45 + (t.col % 2) * 15;
        newlyLoose.push(t);
      }
    }
    return newlyLoose;
  }

  /** Advance shaking pieces; returns the ones that drop now (already destroyed and flagged as scored). */
  tick(dtMs: number): DestructibleTile[] {
    const dropped: DestructibleTile[] = [];
    for (const t of this.tiles) {
      if (t.state !== 'unsupported') continue;
      t.shakeMs -= dtMs;
      if (t.shakeMs <= 0 && this.destroy(t)) dropped.push(t);
    }
    return dropped;
  }

  /** Remaining pieces in the order the ultimate breaks them: bottom to top, centre outwards. */
  ultimateOrder(): DestructibleTile[] {
    return this.tiles.filter(isStatic).sort((a, b) => b.row - a.row || Math.abs(a.cx - 0.5) - Math.abs(b.cx - 0.5));
  }
}
