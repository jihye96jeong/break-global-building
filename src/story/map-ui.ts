// v5 §2 world map: one long horizontal road from a sunny morning (level 1, left) to the deepest night (level 10, right).
// Nodes are real buttons (click / tap / arrow keys + Enter); the scenery is CSS/SVG decoration only.
import { landmarkById } from '../config/landmarks';
import { lang, t, tf } from '../i18n';
import { canEnterStoryLevel, type StoryProgress } from './progress';
import { STORY_LEVELS, STORY_STAGES, stageFor, TIME_NAMES } from './stages';

const STEP = 230; // px between levels along the road
const MAP_W = STEP * (STORY_LEVELS + 0.6);
/** node centres: x in px from the left (level 1 first), y in % of the map height */
const NODES: [number, number][] = STORY_STAGES.map((_, i) => [STEP * (i + 0.8), [64, 44, 66, 42, 64, 44, 66, 42, 64, 48][i]]);
/** the landmark that stands for each level on the road: its final building, else the first in its pool */
const iconOf = (level: number) => { const st = stageFor(level); return landmarkById(st.finalWaveLandmark ?? st.landmarkPool[0]); };

export interface MapCallbacks {
  onPlay(level: number): void;
  onEndless(): void;
  onSettings(): void;
  onHome(): void; // back to the intro
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
  private icons: HTMLImageElement[] = [];
  private goBtn!: HTMLButtonElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
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
    head.innerHTML = '<button class="map-title map-home" aria-label="Intro"><b class="logo-sm">WORLD BREAKER</b><span class="map-sub" data-i18n="mapSubtitle"></span></button>';
    head.querySelector('.map-home')!.addEventListener('click', () => this.cb.onHome());
    this.starsEl = el('div', 'map-stars');
    head.append(this.starsEl);
    this.scroller = el('div', 'map-scroll');
    this.world = el('div', 'map-world');
    this.world.style.width = `${MAP_W}px`;
    // day → night: the sky behind the road follows the ten levels' palettes, left to right
    const top = STORY_STAGES.map((st, i) => `${st.palette.skyTop} ${((i + 0.5) / STORY_LEVELS) * 100}%`);
    const bottom = STORY_STAGES.map((st, i) => `${st.palette.skyBottom} ${((i + 0.5) / STORY_LEVELS) * 100}%`);
    this.world.style.background = `linear-gradient(to right, ${top.join(', ')})`;
    const low = el('div', 'map-sky-low');
    low.style.background = `linear-gradient(to right, ${bottom.join(', ')})`;
    this.world.append(low, this.scenery());
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'map-road');
    svg.setAttribute('viewBox', `0 0 ${MAP_W} 100`);
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < STORY_LEVELS - 1; i++) {
      const [x0, y0] = NODES[i], [x1, y1] = NODES[i + 1];
      const p = document.createElementNS(svgNS, 'path');
      const mx = (x0 + x1) / 2;
      p.setAttribute('d', `M${x0} ${y0} C${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(p);
      this.paths.push(p);
    }
    this.world.append(svg);
    NODES.forEach(([x, y], i) => {
      const lm = iconOf(i + 1);
      const icon = el('img', 'map-icon') as HTMLImageElement;
      icon.src = lm.asset; icon.alt = ''; icon.draggable = false;
      icon.style.left = `${x}px`;
      icon.style.top = `${y}%`;
      this.world.append(icon);
      this.icons.push(icon);
      const b = el('button', 'map-node') as HTMLButtonElement;
      b.style.left = `${x}px`;
      b.style.top = `${y}%`;
      b.dataset.level = String(i + 1);
      b.addEventListener('click', () => this.select(i + 1, true));
      this.world.append(b);
      this.nodes.push(b);
    });
    this.scroller.append(this.world);
    // a mouse wheel moves the road sideways
    this.scroller.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { this.scroller.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    // the dock: the selected level's card, then the big buttons (play, endless) and settings
    const dock = el('footer', 'map-dock');
    this.panel = el('div', 'map-panel');
    const actions = el('div', 'map-actions');
    this.goBtn = el('button', 'big-btn map-go') as HTMLButtonElement;
    this.goBtn.addEventListener('click', () => this.play());
    const endless = el('button', 'big-btn map-endless') as HTMLButtonElement;
    endless.innerHTML = '<span class="inf">∞</span> <span data-i18n="endless"></span>';
    endless.addEventListener('click', () => this.cb.onEndless());
    const settings = el('button', 'small-btn map-settings') as HTMLButtonElement;
    settings.dataset.i18n = 'settings';
    settings.addEventListener('click', () => this.cb.onSettings());
    actions.append(this.goBtn, endless, settings);
    const note = el('span', 'map-note');
    note.dataset.i18n = 'autosave';
    dock.append(this.panel, actions, note);
    // on-screen arrows move the road a page at a time (no scrollbar)
    const view = el('div', 'map-view');
    this.prevBtn = el('button', 'map-arrow prev', '◀') as HTMLButtonElement;
    this.nextBtn = el('button', 'map-arrow next', '▶') as HTMLButtonElement;
    this.prevBtn.setAttribute('aria-label', 'Previous');
    this.nextBtn.setAttribute('aria-label', 'Next');
    this.prevBtn.addEventListener('click', () => this.page(-1));
    this.nextBtn.addEventListener('click', () => this.page(1));
    this.scroller.addEventListener('scroll', () => this.syncArrows(), { passive: true });
    addEventListener('resize', () => this.syncArrows());
    view.append(this.scroller, this.prevBtn, this.nextBtn);
    r.append(head, view, dock);
    r.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Sun and clouds on the left, a sunset in the middle, then stars, a moon and lit city windows toward the right. */
  private scenery() {
    const wrap = el('div', 'map-scenery');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const H = 100; // the svg is stretched to the map height: only rectangles and tiny stars, so nothing looks squashed
    let h = '';
    for (let i = 0; i < 170; i++) {
      const x = MAP_W * (0.42 + rnd() * 0.58); // stars live in the right (night) part
      const op = (0.2 + 0.8 * ((x / MAP_W - 0.42) / 0.58)).toFixed(2);
      h += `<rect x="${x.toFixed(0)}" y="${(rnd() * H * 0.62).toFixed(1)}" width="${(1.5 + rnd() * 2).toFixed(1)}" height="${(0.3 + rnd() * 0.35).toFixed(2)}" fill="#fff" opacity="${op}"/>`;
    }
    // city silhouettes along the bottom; windows light up toward the night
    const colors = ['#a9c2d6', '#9fb6c9', '#93a8bd', '#a08a86', '#8a5f7a', '#4a3f74', '#2c3566', '#1c2650', '#141c3d', '#0e1532'];
    const lit = [0, 0, 0, 0, 0.08, 0.25, 0.4, 0.55, 0.65, 0.7];
    let x = -10;
    while (x < MAP_W + 10) {
      const lv = Math.max(0, Math.min(STORY_LEVELS - 1, Math.floor(x / STEP - 0.3)));
      const w = 22 + rnd() * 34, hh = 7 + rnd() * 13;
      h += `<rect x="${x.toFixed(0)}" y="${(H - hh).toFixed(2)}" width="${w.toFixed(0)}" height="${hh.toFixed(2)}" fill="${colors[lv]}"/>`;
      if (lit[lv] > 0) for (let wy = H - hh + 1.4; wy < H - 1; wy += 2.4) for (let wx = x + 4; wx < x + w - 5; wx += 8) if (rnd() < lit[lv]) h += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(2)}" width="4" height="1.1" fill="#ffd977"/>`;
      x += w + 2;
    }
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('class', 'map-scenery-svg');
    s.setAttribute('viewBox', `0 0 ${MAP_W} ${H}`);
    s.setAttribute('preserveAspectRatio', 'none');
    s.innerHTML = h;
    // round things stay round: sun, setting sun, moon and clouds are their own elements
    const deco = (cls: string, left: number, top: number) => { const d = el('div', cls); d.style.left = `${left}px`; d.style.top = `${top}%`; return d; };
    wrap.append(s,
      deco('map-sun', STEP * 0.35, 10), deco('map-sun set', STEP * 4.55, 30), deco('map-moon', MAP_W - STEP * 0.9, 8),
      deco('map-cloud', STEP * 1.2, 14), deco('map-cloud', STEP * 2.3, 6), deco('map-cloud small', STEP * 3.4, 18), deco('map-cloud small', STEP * 0.1, 30));
    return wrap;
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
      this.icons[i].classList.toggle('locked', !open);
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

  /** Slide the road by about one screen (dir −1 = toward the morning, +1 = toward the night). */
  private page(dir: number) {
    const sc = this.scroller;
    sc.scrollTo({ left: Math.max(0, sc.scrollLeft + dir * Math.max(STEP, sc.clientWidth - STEP)), behavior: 'smooth' });
  }

  private syncArrows() {
    const sc = this.scroller;
    this.prevBtn.disabled = sc.scrollLeft <= 2;
    this.nextBtn.disabled = sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 2;
  }

  private scrollTo(level: number, instant: boolean) {
    const x = NODES[level - 1][0] - this.scroller.clientWidth * 0.5;
    this.scroller.scrollTo({ left: Math.max(0, x), behavior: instant ? 'auto' : 'smooth' });
    this.syncArrows();
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
      <div class="ttl">${st.title[lang]} <span class="lm">· ${iconOf(level).names[lang]}</span></div>
      <div class="meta"><span>${TIME_NAMES[st.timeOfDay][lang]}</span><span>${tf('buildingsN', { n: st.waveCount })}</span><span>${st.baseFallSpeed}–${Math.round(st.baseFallSpeed * 1.04)} wu/s</span></div>
      ${level === 1 && !rec?.cleared ? `<div class="tip">${t('firstHint')}</div>` : ''}
      ${best}
      ${open ? '' : `<div class="lockmsg">🔒 ${t('lockedMsg')}</div>`}`;
    this.panel.style.setProperty('--sky-top', st.palette.skyTop);
    this.panel.style.setProperty('--sky-bottom', st.palette.skyBottom);
    const go = this.goBtn;
    go.innerHTML = `▶ ${t('challenge')} <small>${t('level').toUpperCase()} ${level}</small>`;
    go.disabled = !open;
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
    else if (e.key === 'Escape') { e.preventDefault(); this.cb.onHome(); }
    else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement && !e.target.classList.contains('map-node'))) { e.preventDefault(); this.play(); }
  }

  setNote(text: string) { const n = this.root.querySelector<HTMLElement>('.map-note'); if (n) { n.removeAttribute('data-i18n'); n.textContent = text; n.classList.add('warn'); } }

  focusSelected() { this.nodes[this.selected - 1]?.focus(); }
}
