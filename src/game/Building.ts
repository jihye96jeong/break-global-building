// Turns one transparent landmark image into destructible pieces.
// The intact building is a single cached layer derived from the art; breaking a piece ERASES its exact cut from that
// layer (so the sky shows through and nothing can ghost) and hands a pre-cut image of that piece to the debris system.
// The building hangs above the hero and sinks (offsetY); all world positions include that offset.
import { BUILDING_MAX_H, BUILDING_MAX_W, BUILDING_START_BASE, VIEW_W } from './config';
import { BreakModel, buildGrid, isStatic, type TileGroup } from './Destruction';
import { hashString, makeRng } from './rng';
import type { DestructibleTile, Point, StageConfig } from './types';

export interface PieceImage {
  canvas: HTMLCanvasElement;
  /** world-space rect the piece canvas covers (at the current sink offset) */
  x: number; y: number; w: number; h: number;
  color: string;
}

/** Surface patterns that tell weak / middle / hard pieces apart at a glance. */
function makePatterns(ctx: CanvasRenderingContext2D, k: number) {
  const mk = (size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(4, Math.round(size * k));
    const g = c.getContext('2d')!;
    draw(g, c.width);
    return ctx.createPattern(c, 'repeat')!;
  };
  const middle = mk(14, (g, s) => { // amber hazard stripes
    g.fillStyle = 'rgba(255,170,30,0.42)'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(120,60,0,0.55)'; g.lineWidth = s * 0.22;
    g.beginPath(); g.moveTo(-s, s); g.lineTo(s, -s); g.moveTo(0, 2 * s); g.lineTo(2 * s, 0); g.stroke();
  });
  const hard = mk(10, (g, s) => { // steel plate cross-hatch
    g.fillStyle = 'rgba(40,52,78,0.62)'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(190,210,235,0.5)'; g.lineWidth = Math.max(1, s * 0.12);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke();
  });
  return { middle, hard };
}

export class Building {
  readonly model: BreakModel;
  /** world rect of the whole sprite at offsetY = 0 */
  x = 0; y = 0; w = 0; h = 0;
  /** how far the building has sunk from its hanging start position (can be negative while it enters) */
  offsetY = 0;
  private layer: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private marks: HTMLCanvasElement; // hardness overlay, clipped to the art, rebuilt only when a piece changes
  private marksDirty = true;
  private patterns: ReturnType<typeof makePatterns>;
  private scale = 1; // layer px per world px
  private pieces = new Map<number, PieceImage>();
  private groups = new Map<number, TileGroup>();
  private cracks = new Map<number, Point[][]>();
  private flashes = new Map<number, number>();
  /** world x-range the building actually occupies */
  minX = 0; maxX = 0;

  constructor(readonly stage: StageConfig, img: HTMLImageElement, dpr: number, variant = 0) {
    const s = Math.min(BUILDING_MAX_W / img.naturalWidth, BUILDING_MAX_H / img.naturalHeight);
    this.w = img.naturalWidth * s;
    this.h = img.naturalHeight * s;
    this.x = (VIEW_W - this.w) / 2;
    this.y = BUILDING_START_BASE - this.h;
    const mirror = variant % 2 === 1; // every other building in a series is mirrored for variety

    // alpha coverage sampled once on a small copy
    const sw = Math.min(320, img.naturalWidth), sh = Math.round(img.naturalHeight * (sw / img.naturalWidth));
    const sample = document.createElement('canvas');
    sample.width = sw; sample.height = sh;
    const sctx = sample.getContext('2d', { willReadFrequently: true })!;
    if (mirror) { sctx.translate(sw, 0); sctx.scale(-1, 1); }
    sctx.drawImage(img, 0, 0, sw, sh);
    const px = sctx.getImageData(0, 0, sw, sh).data;
    const coverage = (x0: number, y0: number, x1: number, y1: number) => {
      const ax = Math.floor(x0 * sw), bx = Math.ceil(x1 * sw), ay = Math.floor(y0 * sh), by = Math.ceil(y1 * sh);
      let n = 0, tot = 0;
      for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) { tot++; if (px[(y * sw + x) * 4 + 3] > 40) n++; }
      return tot ? n / tot : 0;
    };
    const grid = buildGrid(coverage, {
      cols: stage.breakGrid.cols, rows: stage.breakGrid.rows, hpPerTile: stage.breakGrid.hpPerTile,
      hardness: stage.hardness, seed: hashString(stage.id) + variant * 7919,
    });
    this.model = new BreakModel(grid);
    for (const g of grid.groups) this.groups.set(g.tile.id, g);

    // cached building layer at screen resolution
    this.scale = Math.min(dpr, img.naturalWidth / this.w);
    this.layer = document.createElement('canvas');
    this.layer.width = Math.round(this.w * this.scale);
    this.layer.height = Math.round(this.h * this.scale);
    this.lctx = this.layer.getContext('2d')!;
    this.lctx.imageSmoothingQuality = 'high';
    this.lctx.save();
    if (mirror) { this.lctx.translate(this.layer.width, 0); this.lctx.scale(-1, 1); }
    this.lctx.drawImage(img, 0, 0, this.layer.width, this.layer.height);
    this.lctx.restore();
    for (const p of grid.emptyPolys) this.erasePoly(p); // nothing may remain that no piece owns
    this.marks = document.createElement('canvas');
    this.marks.width = this.layer.width; this.marks.height = this.layer.height;
    this.patterns = makePatterns(this.marks.getContext('2d')!, this.scale);

    // pre-cut every piece once (never per frame)
    const rng = makeRng(hashString(stage.id) + 7 + variant);
    let minX = Infinity, maxX = -Infinity;
    for (const g of grid.groups) {
      const piece = this.cutPiece(g, px, sw, sh);
      this.pieces.set(g.tile.id, piece);
      minX = Math.min(minX, piece.x); maxX = Math.max(maxX, piece.x + piece.w);
      this.cracks.set(g.tile.id, makeCracks(g.tile, rng));
    }
    this.minX = minX; this.maxX = maxX;
  }

  private polyPath(ctx: CanvasRenderingContext2D, poly: Point[], ox = 0, oy = 0) {
    ctx.moveTo(poly[0].x * this.layer.width - ox, poly[0].y * this.layer.height - oy);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x * this.layer.width - ox, poly[i].y * this.layer.height - oy);
    ctx.closePath();
  }

  private erasePoly(poly: Point[]) {
    const c = this.lctx;
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    this.polyPath(c, poly);
    c.fill();
    // the anti-aliased rim of a fill leaves a faint outline: stroke it too
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  private cutPiece(g: TileGroup, px: Uint8ClampedArray, sw: number, sh: number): PieceImage {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of g.polys) for (const v of p) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
    const L = this.layer;
    const ox = Math.floor(x0 * L.width) - 1, oy = Math.floor(y0 * L.height) - 1;
    const cw = Math.ceil(x1 * L.width) - ox + 2, ch = Math.ceil(y1 * L.height) - oy + 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, cw); c.height = Math.max(1, ch);
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    for (const p of g.polys) this.polyPath(ctx, p, ox, oy);
    ctx.clip();
    ctx.drawImage(L, -ox, -oy);
    // average colour of the piece for shards
    let r = 0, gg = 0, b = 0, n = 0;
    const t = g.tile;
    const ax = Math.floor((t.col / this.model.grid.cols) * sw), bx = Math.ceil(((t.col + 1) / this.model.grid.cols) * sw);
    const ay = Math.floor((t.row / this.model.grid.rows) * sh), by = Math.ceil(((t.row + 1) / this.model.grid.rows) * sh);
    for (let y = ay; y < by; y += 2) for (let x = ax; x < bx; x += 2) {
      const i = (y * sw + x) * 4;
      if (px[i + 3] > 128) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
    }
    const color = n ? `rgb(${(r / n) | 0},${(gg / n) | 0},${(b / n) | 0})` : '#999';
    return { canvas: c, x: this.x + ox / this.scale, y: this.y + oy / this.scale, w: cw / this.scale, h: ch / this.scale, color };
  }

  tileWorldX = (t: DestructibleTile) => this.x + t.cx * this.w;
  tileWorldY = (t: DestructibleTile) => this.y + this.offsetY + t.cy * this.h;
  piece(t: DestructibleTile): PieceImage {
    const p = this.pieces.get(t.id)!;
    return { ...p, y: p.y + this.offsetY };
  }

  /** World y of the lowest standing piece's bottom edge, or -Infinity when nothing stands. */
  bottomY() {
    let row = -1;
    for (const t of this.model.tiles) if (isStatic(t) && t.row > row) row = t.row;
    return row < 0 ? -Infinity : this.y + this.offsetY + ((row + 1) / this.model.grid.rows) * this.h;
  }

  /** Cut a piece out of the standing building: its exact shape disappears from the layer. */
  detach(t: DestructibleTile) {
    const g = this.groups.get(t.id);
    if (!g) return;
    for (const p of g.polys) this.erasePoly(p);
    this.marksDirty = true;
  }

  /** A piece lost HP: its surface marking must change. */
  touched() { this.marksDirty = true; }

  flash(t: DestructibleTile) { this.flashes.set(t.id, 70); }

  update(dtMs: number) {
    for (const [id, ms] of this.flashes) { if (ms - dtMs <= 0) this.flashes.delete(id); else this.flashes.set(id, ms - dtMs); }
  }

  private rebuildMarks() {
    const c = this.marks.getContext('2d')!;
    const L = this.layer;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, L.width, L.height);
    for (const g of this.groups.values()) {
      const t = g.tile;
      if (t.state !== 'intact' && t.state !== 'damaged') continue;
      if (t.hp < 2) continue; // weak pieces stay bare
      const hard = t.hp >= 3;
      c.beginPath();
      for (const p of g.polys) this.polyPath(c, p);
      c.fillStyle = hard ? this.patterns.hard : this.patterns.middle;
      c.fill();
      c.lineWidth = (hard ? 3 : 2) * this.scale;
      c.strokeStyle = hard ? 'rgba(20,28,50,0.95)' : 'rgba(150,80,0,0.9)';
      c.beginPath(); this.polyPath(c, t.poly); c.stroke();
      if (hard) { // rivets
        c.fillStyle = 'rgba(225,235,250,0.95)';
        const cx = t.cx * L.width, cy = t.cy * L.height, d = Math.min(L.width / this.model.grid.cols, L.height / this.model.grid.rows) * 0.22;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(cx + dx * d, cy + dy * d, 2.2 * this.scale, 0, Math.PI * 2); c.fill(); }
      }
    }
    // only where the art actually is: patterns never paint the sky between lattice beams
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(L, 0, 0);
    c.globalCompositeOperation = 'source-over';
    this.marksDirty = false;
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    if (this.marksDirty) this.rebuildMarks();
    ctx.save();
    ctx.translate(0, this.offsetY);
    ctx.drawImage(this.layer, this.x, this.y, this.w, this.h);
    ctx.drawImage(this.marks, this.x, this.y, this.w, this.h);
    for (const t of this.model.tiles) {
      if (t.state === 'unsupported') {
        // already erased from the layer: drawn loose and trembling until it drops
        const p = this.pieces.get(t.id)!;
        const j = 1.6;
        ctx.drawImage(p.canvas, p.x + Math.sin(time * 0.09 + t.id) * j, p.y + Math.cos(time * 0.11 + t.id * 2) * j * 0.6, p.w, p.h);
      }
    }
    // cracks on damaged pieces
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const t of this.model.tiles) {
      if (t.state !== 'damaged') continue;
      const cr = this.cracks.get(t.id)!;
      ctx.beginPath();
      for (const line of cr) {
        ctx.moveTo(this.x + line[0].x * this.w, this.y + line[0].y * this.h);
        for (let i = 1; i < line.length; i++) ctx.lineTo(this.x + line[i].x * this.w, this.y + line[i].y * this.h);
      }
      ctx.strokeStyle = 'rgba(255,240,220,0.55)'; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(25,10,10,0.95)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // white hit flash on the struck piece
    for (const [id, ms] of this.flashes) {
      const t = this.model.tiles[id];
      if (t.state !== 'intact' && t.state !== 'damaged') continue;
      const p = this.pieces.get(id)!;
      ctx.globalAlpha = Math.min(1, ms / 70) * 0.85;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(p.canvas, p.x, p.y, p.w, p.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

function makeCracks(t: DestructibleTile, rng: ReturnType<typeof makeRng>): Point[][] {
  const lines: Point[][] = [];
  const xs = t.poly.map((p) => p.x), ys = t.poly.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const c = { x: t.cx + rng.range(-0.1, 0.1) * w, y: t.cy + rng.range(-0.1, 0.1) * h };
  const n = 4 + Math.floor(rng.next() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const line: Point[] = [c];
    let x = c.x, y = c.y;
    for (let k = 0; k < 3; k++) {
      const step = 0.15 + rng.next() * 0.1;
      x += Math.cos(a + rng.range(-0.5, 0.5)) * w * step;
      y += Math.sin(a + rng.range(-0.5, 0.5)) * h * step;
      line.push({ x, y });
    }
    lines.push(line);
  }
  return lines;
}
