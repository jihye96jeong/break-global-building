// v5 §2 world map: one long road from a sunny morning (level 1, bottom) to the deepest night (level 10, top).
// Nodes are real buttons (click / tap / arrow keys + Enter); the scenery is CSS/SVG decoration only.
import { lang, t, tf } from '../i18n';
import { canEnterStoryLevel, type StoryProgress } from './progress';
import { STORY_LEVELS, STORY_STAGES, stageFor, TIME_NAMES } from './stages';

const MAP_H = 1560;
/** node centres: x in % of the map width, y in px from the top (level 1 at the bottom) */
const NODES: [number, number][] = [[24, 1440], [70, 1310], [34, 1175], [74, 1040], [30, 905], [70, 770], [30, 635], [72, 500], [34, 365], [62, 215]];

export interface MapCallbacks {
  onPlay(level: number): void;
  onEndless(): void;
  onSettings(): void;
}

const svgNS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export class WorldMap {
  readonly root: HTMLElement;
  private world!: HTMLElement;
  private scroller!: HTMLElement;
  private panel!: HTMLElement;
  private starsEl!: HTMLElement;
  private paths: SVGPathElement[] = [];
  private nodes: HTMLButtonElement[] = [];
  private selected = 1;
  private progress!: StoryProgress;

  constructor(root: HTMLElement, private cb: MapCallbacks) {
    this.root = root;
    this.build();
  }

  private build() {
    const r = this.root;
    r.innerHTML = '';
    const head = el('header', 'map-head');
    head.innerHTML = '<div class="map-title"><b class="logo-sm">WORLD BREAKER</b><span class="map-sub" data-i18n="mapSubtitle"></span></div>';
    this.starsEl = el('div', 'map-stars');
    head.append(this.starsEl);
    this.scroller = el('div', 'map-scroll');
    this.world = el('div', 'map-world');
    this.world.style.height = `${MAP_H}px`;
    // day → night: the sky behind the road follows the ten levels' palettes, bottom to top
    const stops = STORY_STAGES.map((s, i) => `${s.palette.skyBottom} ${(i / STORY_LEVELS) * 100}%, ${s.palette.skyTop} ${((i + 0.85) / STORY_LEVELS) * 100}%`);
    this.world.style.background = `linear-gradient(to top, ${stops.join(', ')})`;
    this.world.append(this.scenery());
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'map-road');
    svg.setAttribute('viewBox', `0 0 100 ${MAP_H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < STORY_LEVELS - 1; i++) {
      const [x0, y0] = NODES[i], [x1, y1] = NODES[i + 1];
      const p = document.createElementNS(svgNS, 'path');
      const my = (y0 + y1) / 2;
      p.setAttribute('d', `M${x0} ${y0} C${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(p);
      this.paths.push(p);
    }
    this.world.append(svg);
    NODES.forEach(([x, y], i) => {
      const b = el('button', 'map-node') as HTMLButtonElement;
      b.style.left = `${x}%`;
      b.style.top = `${y}px`;
      b.dataset.level = String(i + 1);
      b.addEventListener('click', () => this.select(i + 1, true));
      this.world.append(b);
      this.nodes.push(b);
    });
    this.scroller.append(this.world);
    this.panel = el('div', 'map-panel');
    const foot = el('footer', 'map-foot');
    const endless = el('button', 'small-btn', '') as HTMLButtonElement;
    endless.dataset.i18n = 'endless';
    endless.addEventListener('click', () => this.cb.onEndless());
    const settings = el('button', 'small-btn') as HTMLButtonElement;
    settings.dataset.i18n = 'settings';
    settings.addEventListener('click', () => this.cb.onSettings());
    const note = el('span', 'map-note');
    note.dataset.i18n = 'autosave';
    foot.append(endless, settings, note);
    r.append(head, this.scroller, this.panel, foot);
    r.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Sun and clouds low on the road, a sunset band, then stars, a moon and lit city windows toward the top. */
  private scenery() {
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('class', 'map-scenery');
    s.setAttribute('viewBox', `0 0 400 ${MAP_H}`);
    s.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    let h = '';
    h += `<circle cx="330" cy="${MAP_H - 210}" r="46" fill="#fff6c9" opacity=".95"/><circle cx="330" cy="${MAP_H - 210}" r="70" fill="#fff6c9" opacity=".25"/>`;
    for (const [cx, cy, w] of [[80, MAP_H - 120, 90], [250, MAP_H - 330, 110], [120, MAP_H - 520, 80], [300, MAP_H - 640, 70]]) {
      h += `<g fill="#ffffff" opacity=".8"><ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${w / 6}"/><ellipse cx="${cx - w / 5}" cy="${cy - w / 8}" rx="${w / 4}" ry="${w / 5}"/><ellipse cx="${cx + w / 6}" cy="${cy - w / 7}" rx="${w / 3.5}" ry="${w / 4.5}"/></g>`;
    }
    h += `<circle cx="70" cy="${MAP_H - 900}" r="40" fill="#ffb27a" opacity=".85"/>`; // the setting sun near level 5
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 140; i++) {
      const y = rnd() * (MAP_H * 0.5); // stars live in the upper (night) half
      const op = (0.25 + 0.75 * (1 - y / (MAP_H * 0.5))).toFixed(2);
      h += `<circle cx="${(rnd() * 400).toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + rnd() * 1.4).toFixed(1)}" fill="#fff" opacity="${op}"/>`;
    }
    h += `<circle cx="300" cy="120" r="34" fill="#f4f1dc"/><circle cx="314" cy="110" r="30" fill="${STORY_STAGES[9].palette.skyTop}" opacity=".9"/>`;
    // city silhouettes along the road; windows light up toward the night
    const city = (y: number, color: string, lit: number) => {
      let g = `<g>`;
      let x = -10;
      while (x < 410) {
        const w = 18 + rnd() * 26, hh = 26 + rnd() * 70;
        g += `<rect x="${x.toFixed(1)}" y="${(y - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${(hh + 40).toFixed(1)}" fill="${color}"/>`;
        if (lit > 0) for (let wy = y - hh + 6; wy < y - 4; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) if (rnd() < lit) g += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="3" height="4" fill="#ffd977"/>`;
        x += w + 2;
      }
      return g + '</g>';
    };
    h += city(MAP_H - 30, '#9fb6c9', 0) + city(MAP_H - 760, '#7c5a78', 0.12) + city(MAP_H - 1080, '#2c3566', 0.35) + city(MAP_H - 1330, '#141c3d', 0.6);
    s.innerHTML = h;
    return s;
  }

  /** Re-draw node states from the saved progress; optionally light up a newly unlocked road segment. */
  render(progress: StoryProgress, unlockedAnim: number | null = null) {
    this.progress = progress;
    this.starsEl.textContent = `★ ${progress.totalStars} / ${STORY_LEVELS * 3}`;
    this.nodes.forEach((b, i) => {
      const level = i + 1;
      const rec = progress.levels[level];
      const open = canEnterStoryLevel(level, progress);
      const cleared = !!rec?.cleared;
      const next = open && !cleared;
      b.className = `map-node${cleared ? ' cleared' : ''}${next ? ' next' : ''}${open ? '' : ' locked'}`;
      const stars = cleared ? '★'.repeat(rec.bestStars) + '☆'.repeat(3 - rec.bestStars) : '';
      b.innerHTML = `<span class="n">${open ? level : '🔒'}</span>${stars ? `<span class="st">${stars}</span>` : ''}`;
      const st = stageFor(level);
      b.setAttribute('aria-label', `${t('level')} ${level}: ${st.title[lang]}${open ? '' : ` — ${t('lockedMsg')}`}${cleared ? ` ★${rec.bestStars}` : ''}`);
    });
    this.paths.forEach((p, i) => {
      const lit = (progress.levels[i + 1]?.cleared ?? false) && i + 2 <= progress.unlockedLevel;
      p.setAttribute('class', lit ? 'lit' : 'dim');
      if (unlockedAnim === i + 2) { p.setAttribute('class', 'lit unlocking'); }
    });
    if (unlockedAnim) this.nodes[unlockedAnim - 1].classList.add('unlocking');
    const focus = Math.min(STORY_LEVELS, unlockedAnim ?? Math.max(1, Math.min(progress.unlockedLevel, STORY_LEVELS)));
    this.select(focus, false);
    requestAnimationFrame(() => this.scrollTo(focus, !unlockedAnim));
  }

  private scrollTo(level: number, instant: boolean) {
    const y = NODES[level - 1][1] - this.scroller.clientHeight * 0.55;
    this.scroller.scrollTo({ top: Math.max(0, y), behavior: instant ? 'auto' : 'smooth' });
  }

  select(level: number, fromClick: boolean) {
    this.selected = level;
    this.nodes.forEach((b, i) => b.classList.toggle('sel', i + 1 === level));
    const st = stageFor(level);
    const open = canEnterStoryLevel(level, this.progress);
    const rec = this.progress.levels[level];
    const best = rec?.cleared ? `<span class="best">${t('bestLbl')} ★${rec.bestStars} · ${rec.bestScore.toLocaleString()} · ×${rec.bestCombo}</span>` : '';
    this.panel.innerHTML = `
      <div class="lv">${t('level').toUpperCase()} ${level} <small>/ ${STORY_LEVELS}</small></div>
      <div class="ttl">${st.title[lang]}</div>
      <div class="meta"><span>${TIME_NAMES[st.timeOfDay][lang]}</span><span>${tf('buildingsN', { n: st.waveCount })}</span><span>${st.baseFallSpeed}–${Math.round(st.baseFallSpeed * 1.04)} wu/s</span></div>
      ${level === 1 && !rec?.cleared ? `<div class="tip">${t('firstHint')}</div>` : ''}
      ${best}
      ${open ? `<button class="big-btn map-go">${t('challenge')}</button>` : `<div class="lockmsg">🔒 ${t('lockedMsg')}</div>`}`;
    this.panel.style.setProperty('--sky-top', st.palette.skyTop);
    this.panel.style.setProperty('--sky-bottom', st.palette.skyBottom);
    const go = this.panel.querySelector<HTMLButtonElement>('.map-go');
    go?.addEventListener('click', () => this.play());
    if (fromClick) (open ? go : this.nodes[level - 1])?.focus();
  }

  /** Every way into a level goes through the unlock gate. */
  play(level = this.selected) {
    if (!canEnterStoryLevel(level, this.progress)) { this.select(level, false); return; }
    this.cb.onPlay(level);
  }

  private onKey(e: KeyboardEvent) {
    if (this.root.classList.contains('hidden')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); this.select(Math.min(STORY_LEVELS, this.selected + 1), false); this.scrollTo(this.selected, false); this.nodes[this.selected - 1].focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); this.select(Math.max(1, this.selected - 1), false); this.scrollTo(this.selected, false); this.nodes[this.selected - 1].focus(); }
    else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement && !e.target.classList.contains('map-node'))) { e.preventDefault(); this.play(); }
  }

  setNote(text: string) { const n = this.root.querySelector<HTMLElement>('.map-note'); if (n) { n.removeAttribute('data-i18n'); n.textContent = text; n.classList.add('warn'); } }

  focusSelected() { this.nodes[this.selected - 1]?.focus(); }
}
