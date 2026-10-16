// Visuals for one falling building: the landmark art cut into one image per logical floor along jagged lines
// shared by neighbouring floors (no seams while standing, a broken edge when one falls). The art is shown as it is
// (no crack overlays); what each lane takes to break is shown by the chips under the lowest floor.
import { landmarkById, type Landmark } from '../config/landmarks';
import type { FallingBuilding } from '../core/building';
import { hashString, makeRng } from '../core/rng';
import { imageNow } from './assets';

export interface FloorVisual {
  canvas: HTMLCanvasElement; // the floor's art (alpha), includes the jag margin above and below
  padTop: number; // world units of canvas above the floor's top edge
  padBottom: number;
  color: string; // average colour for chips
}

export interface BuildingVisual {
  buildingId: string;
  landmark: Landmark;
  width: number; // world units
  floors: Map<string, FloorVisual>;
  fallback: boolean;
}

const JAG = 7; // world units the cut line wanders above/below the floor boundary

/** Width of the building on screen: keep the art's aspect, but never so narrow that lanes overlap or so wide it leaves the screen. */
export function displayWidth(landmark: Landmark, totalHeight: number, worldW: number) {
  const img = imageNow(landmark.asset);
  const aspect = img ? img.naturalHeight / img.naturalWidth : landmark.displayHeight > 300 ? 2.2 : 0.65;
  return Math.max(210, Math.min(totalHeight / aspect, Math.min(560, worldW * 0.82)));
}

function fallbackArt(l: Landmark, w: number, h: number): HTMLCanvasElement {
  // A recognisable flat silhouette per landmark family, used when its art failed to load.
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const g = c.getContext('2d')!;
  const { shape, color, accent } = l.fallback;
  g.fillStyle = color; g.strokeStyle = '#1b1530'; g.lineWidth = 3;
  const rect = (x: number, y: number, rw: number, rh: number) => { g.fillRect(x, y, rw, rh); g.strokeRect(x, y, rw, rh); };
  const windows = (x: number, y: number, rw: number, rh: number) => {
    g.fillStyle = accent;
    for (let yy = y + 8; yy < y + rh - 8; yy += 14) for (let xx = x + 6; xx < x + rw - 8; xx += 12) g.fillRect(xx, yy, 6, 8);
    g.fillStyle = color;
  };
  if (shape === 'wide' || shape === 'arches' || shape === 'domes' || shape === 'shells') {
    rect(w * 0.05, h * 0.55, w * 0.9, h * 0.45);
    windows(w * 0.05, h * 0.55, w * 0.9, h * 0.45);
    g.beginPath();
    if (shape === 'domes') g.ellipse(w / 2, h * 0.55, w * 0.22, h * 0.42, 0, Math.PI, 0);
    else if (shape === 'shells') { g.moveTo(w * 0.1, h * 0.55); g.quadraticCurveTo(w * 0.3, 0, w * 0.5, h * 0.55); g.quadraticCurveTo(w * 0.7, h * 0.05, w * 0.9, h * 0.55); }
    else { g.moveTo(0, h * 0.58); g.lineTo(w * 0.5, h * 0.2); g.lineTo(w, h * 0.58); }
    g.closePath(); g.fill(); g.stroke();
  } else if (shape === 'twin') {
    rect(w * 0.12, h * 0.1, w * 0.3, h * 0.9); rect(w * 0.58, h * 0.1, w * 0.3, h * 0.9);
    windows(w * 0.12, h * 0.1, w * 0.3, h * 0.9); windows(w * 0.58, h * 0.1, w * 0.3, h * 0.9);
    rect(w * 0.42, h * 0.45, w * 0.16, h * 0.04);
  } else if (shape === 'lattice') {
    g.beginPath(); g.moveTo(w * 0.1, h); g.lineTo(w * 0.47, 0); g.lineTo(w * 0.53, 0); g.lineTo(w * 0.9, h); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = accent; g.lineWidth = 2;
    for (let y = 10; y < h; y += 18) { const k = y / h; g.beginPath(); g.moveTo(w * (0.47 - 0.37 * k), y); g.lineTo(w * (0.53 + 0.37 * k), y + 9); g.stroke(); }
  } else { // tower / stepped
    const steps = shape === 'stepped' ? 4 : 1;
    for (let i = 0; i < steps; i++) {
      const k = i / steps, ww = w * (0.6 - 0.12 * i);
      rect((w - ww) / 2, h * (k * 0.8), ww, h * (1 - k * 0.8));
    }
    windows(w * 0.25, h * 0.1, w * 0.5, h * 0.9);
  }
  return c;
}

/** Jagged boundary line across the building, shared by the floor below and above it. */
function cutLine(seed: number, width: number, steps = 9) {
  const rng = makeRng(seed);
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) pts.push(i === 0 || i === steps ? 0 : rng.range(-JAG, JAG));
  return (x: number) => {
    const f = (x / width) * steps, i = Math.min(steps - 1, Math.floor(f)), k = f - i;
    return pts[i] * (1 - k) + pts[i + 1] * k;
  };
}

export function buildVisual(b: FallingBuilding, worldW: number, scale: number): BuildingVisual {
  const landmark = landmarkById(b.landmarkId);
  const totalH = b.totalHeight;
  const width = displayWidth(landmark, totalH, worldW);
  const img = imageNow(landmark.asset);
  const pw = Math.max(1, Math.round(width * scale)), ph = Math.max(1, Math.round(totalH * scale));
  const full = document.createElement('canvas');
  full.width = pw; full.height = ph;
  const fg = full.getContext('2d')!;
  fg.imageSmoothingQuality = 'high';
  const mirror = b.index % 2 === 0;
  if (img) {
    fg.save();
    if (mirror) { fg.translate(pw, 0); fg.scale(-1, 1); }
    fg.drawImage(img, 0, 0, pw, ph);
    fg.restore();
  } else fg.drawImage(fallbackArt(landmark, pw, ph), 0, 0);

  // boundary below floor ordinal k is shared with floor k-1; the very bottom and top edges are straight
  const seed = hashString(b.id);
  const top = b.floors.length ? b.floors[b.floors.length - 1].ordinal : 0;
  const lineBelow = (ordinal: number) => (ordinal === 1 ? () => 0 : cutLine(seed + ordinal * 977, width));
  // floors are laid out from the top of the art down, so cut-away floors never move the ones above
  const tops: number[] = new Array(b.floors.length);
  let acc = 0;
  for (let i = b.floors.length - 1; i >= 0; i--) { tops[i] = acc; acc += b.floors[i].height; }

  const floors = new Map<string, FloorVisual>();
  b.floors.forEach((f, i) => {
    const ftop = tops[i], bottom = ftop + f.height;
    const lineTop = f.ordinal === top ? () => 0 : lineBelow(f.ordinal + 1), lineBottom = lineBelow(f.ordinal);
    const padTop = f.ordinal === top ? 0 : JAG, padBottom = f.ordinal === 1 ? 0 : JAG;
    const c = document.createElement('canvas');
    c.width = pw; c.height = Math.max(1, Math.round((f.height + padTop + padBottom) * scale));
    const g = c.getContext('2d')!;
    const oy = (ftop - padTop) * scale;
    g.beginPath();
    const N = 24;
    for (let k = 0; k <= N; k++) { const x = (k / N) * width; const y = ftop + lineTop(x); k ? g.lineTo(x * scale, y * scale - oy) : g.moveTo(x * scale, y * scale - oy); }
    for (let k = N; k >= 0; k--) { const x = (k / N) * width; g.lineTo(x * scale, (bottom + lineBottom(x)) * scale - oy); }
    g.closePath();
    g.clip();
    g.drawImage(full, 0, -oy);
    // average colour for debris chips
    let color = landmark.debrisPalette[0];
    try {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let r = 0, gg = 0, bb = 0, n = 0;
      for (let p = 0; p < d.length; p += 4 * 37) if (d[p + 3] > 128) { r += d[p]; gg += d[p + 1]; bb += d[p + 2]; n++; }
      if (n) color = `rgb(${(r / n) | 0},${(gg / n) | 0},${(bb / n) | 0})`;
    } catch { /* tainted canvas: palette colour */ }
    floors.set(f.id, { canvas: c, padTop, padBottom, color });
  });
  return { buildingId: b.id, landmark, width, floors, fallback: !img };
}
