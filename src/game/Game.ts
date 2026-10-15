// State machine, fixed-step update loop and canvas rendering for WORLD BREAKER.
import { AudioManager } from './AudioManager';
import { Building } from './Building';
import { BUILDING_START_BASE, BUILDING_TOP, CRUSH_Y, GAME_CONFIG as C, GROUND_Y, STORAGE_BEST, STORAGE_SOUND, VIEW_H, VIEW_W } from './config';
import { DebrisSystem } from './Debris';
import { InputManager } from './InputManager';
import { HERO_H, Player } from './Player';
import { makeRng } from './rng';
import { ScoreManager } from './ScoreManager';
import { StageManager } from './StageManager';
import { stageName } from './StageConfigs';
import type { DestructibleTile, GameStatus } from './types';
import { HUD, pad8 } from '../ui/HUD';
import { applyDom, LANG_LABEL, LANGS, lang, onLangChange, setLang, t, type Lang } from '../i18n';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const STEP = 1 / 60;

interface Trail { x0: number; y0: number; x1: number; y1: number; life: number; }
interface Slash { x: number; y: number; dir: 1 | -1; life: number; }
interface Ring { x: number; y: number; life: number; max: number; r: number; color: string; }
interface Banner { text: string; sub?: string; life: number; max: number; color: string; size: number; }
interface Ultimate { t: number; order: DestructibleTile[]; next: number; boomed: boolean; gained: number; }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${t('imageError')}: ${src}`));
    img.src = src;
  });
}

const safeStorage = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export class Game {
  status: GameStatus = 'TITLE';
  private ctx: CanvasRenderingContext2D;
  private renderScale = 1;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly audio = new AudioManager();
  readonly input: InputManager;
  readonly score = new ScoreManager();
  readonly stages = new StageManager();
  private hud = new HUD();
  private rng = makeRng(Date.now() & 0xffffff);
  private debris: DebrisSystem;
  private player!: Player;
  private building: Building | null = null;
  private buildingImg: HTMLImageElement | null = null;
  /** which building of the current city's series is up (0-based) */
  buildingIdx = 0;
  private enterMs = 0; // a new building slides down into place
  private haltMs = 0; // GUARD / crush recoil: the building stops sinking
  guard: number = C.guardMax;
  private betweenBuildings = false;
  private bg: HTMLImageElement | null = null;
  private images = new Map<string, Promise<HTMLImageElement>>();

  private time = 0; // game clock in ms (stops while paused)
  private acc = 0;
  private lastFrame = 0;
  private hitStopMs = 0;
  private shake = { ms: 0, mag: 0 };
  private trails: Trail[] = [];
  private rings: Ring[] = [];
  private slashes: Slash[] = [];
  private banners: Banner[] = [];
  private ult: Ultimate | null = null;
  private stageMs = 0;
  private introMs = 0;
  private endMs = 0; // clear / game-over lead-out
  private stageStartScore = 0;
  private best = 0;
  private stageCleared = false;
  private lastComboShown = 0;
  private pausedFrom: GameStatus = 'PLAYING';
  private clearAutoTimer: number | undefined;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.input = new InputManager(() => this.audio.unlock());
    this.debris = new DebrisSystem(this.rng, (_x, big) => { if (big) this.audio.play('land'); });
    this.best = Number(safeStorage.get(STORAGE_BEST)) || 0;
    this.audio.enabled = safeStorage.get(STORAGE_SOUND) !== 'false';
    this.bindUi();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.pause(); this.audio.suspend(); } else this.audio.resume();
    });
    addEventListener('blur', () => this.pause());
  }

  private image(src: string) {
    let p = this.images.get(src);
    if (!p) { p = loadImage(src); this.images.set(src, p); }
    return p;
  }

  async boot() {
    $('title-best').textContent = pad8(this.best);
    this.syncSoundButtons();
    try {
      this.player = new Player();
      await this.loadStage(0);
      const start = $<HTMLButtonElement>('btn-start');
      start.disabled = false; start.dataset.i18n = 'start'; start.textContent = t('start');
      // warm the cache for the rest of the tour in the background
      for (const s of this.stages.stages) { void this.image(s.buildingSrc).catch(() => {}); void this.image(s.backgroundSrc).catch(() => {}); }
    } catch (e) {
      const el = $('load-error');
      el.textContent = `${(e as Error).message} — ${t('assetErrorHint')}`;
      el.classList.remove('hidden');
      $('btn-start').dataset.i18n = 'assetError'; $('btn-start').textContent = t('assetError');
    }
    requestAnimationFrame((t) => { this.lastFrame = t; this.frame(t); });
  }

  // ---------------------------------------------------------------- layout
  private resize() {
    const vw = innerWidth, vh = innerHeight;
    const style = getComputedStyle(document.documentElement);
    const insetY = (parseFloat(style.getPropertyValue('--sat')) || 0) + (parseFloat(style.getPropertyValue('--sab')) || 0);
    const u = Math.min(vw / VIEW_W, (vh - insetY) / VIEW_H);
    document.documentElement.style.setProperty('--u', `${u}px`);
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(VIEW_W * u * dpr);
    this.canvas.height = Math.round(VIEW_H * u * dpr);
    this.renderScale = (VIEW_W * u * dpr) / VIEW_W;
    this.ctx.imageSmoothingQuality = 'high';
  }

  // ---------------------------------------------------------------- UI wiring
  private bindUi() {
    document.querySelectorAll<HTMLSelectElement>('.lang-select').forEach((sel) => {
      sel.innerHTML = LANGS.map((l) => `<option value="${l}">${LANG_LABEL[l]}</option>`).join('');
      sel.addEventListener('change', () => setLang(sel.value as Lang));
    });
    applyDom();
    onLangChange(() => {
      this.syncSoundButtons();
      this.updateStageLabel();
    });
    const btn = (id: string, fn: () => void) => $(id).addEventListener('click', () => { this.audio.unlock(); fn(); });
    btn('btn-start', () => this.newGame());
    btn('btn-help', () => $('ov-help').classList.remove('hidden'));
    document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => $(b.dataset.close!).classList.add('hidden')));
    btn('btn-sound', () => this.toggleSound());
    btn('btn-pause-sound', () => this.toggleSound());
    btn('btn-pause', () => this.pause());
    btn('btn-resume', () => this.resume());
    btn('btn-quit', () => this.toTitle());
    btn('btn-next', () => this.nextStage());
    btn('btn-restart', () => this.newGame());
    btn('btn-home', () => this.toTitle());
    this.input.bindButton($('btn-left'), 'left');
    this.input.bindButton($('btn-right'), 'right');
    this.input.bindButton($('btn-attack'), 'attack');
    this.input.bindButton($('btn-ult'), 'ultimate');
    this.input.bindButton($('btn-guard'), 'guard');
    this.input.bindButton($('btn-jump'), 'jump');
    // keyboard shortcuts on overlays
    addEventListener('keydown', (e) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      if (this.status === 'STAGE_CLEAR' && !$('ov-clear').classList.contains('hidden')) this.nextStage();
    });
  }

  private toggleSound() {
    this.audio.enabled = !this.audio.enabled;
    safeStorage.set(STORAGE_SOUND, String(this.audio.enabled));
    this.syncSoundButtons();
  }

  private syncSoundButtons() {
    document.querySelectorAll<HTMLElement>('.sound-toggle').forEach((b) => {
      b.textContent = t(this.audio.enabled ? 'soundOn' : 'soundOff');
      b.setAttribute('aria-pressed', String(this.audio.enabled));
    });
  }

  private showOverlay(id: string | null) {
    for (const o of ['ov-title', 'ov-help', 'ov-intro', 'ov-pause', 'ov-clear', 'ov-over']) $(o).classList.toggle('hidden', o !== id);
  }

  // ---------------------------------------------------------------- flow
  private async loadStage(i: number) {
    this.stages.index = i;
    const s = this.stages.current;
    const [img, bg] = await Promise.all([this.image(s.buildingSrc), this.image(s.backgroundSrc)]);
    this.buildingImg = img;
    this.bg = bg;
    $('matte').style.backgroundImage = `url("${s.backgroundSrc}")`;
    this.debris.clear();
    this.trails = []; this.rings = []; this.slashes = []; this.banners = []; this.ult = null;
    this.player.reset(VIEW_W / 2);
    this.spawnBuilding(0, false);
    this.guard = C.guardMax;
    $('keybar').classList.toggle('ready', false);
  }

  /** Put building k of the current series up. `enter` slides it down from above the screen. */
  private spawnBuilding(k: number, enter: boolean) {
    const s = this.stages.current;
    this.buildingIdx = k;
    this.building = new Building(s, this.buildingImg!, this.renderScale, k);
    this.enterMs = enter ? 900 : 0;
    this.building.offsetY = enter ? -(BUILDING_START_BASE + 80) : 0;
    this.haltMs = 0;
    this.betweenBuildings = false;
    this.player.minX = Math.max(26, this.building.minX - 24);
    this.player.maxX = Math.min(VIEW_W - 26, this.building.maxX + 24);
    this.player.x = Math.max(this.player.minX, Math.min(this.player.maxX, this.player.x));
    this.updateStageLabel();
  }

  private updateStageLabel() {
    const s = this.stages.current;
    this.hud.setStage(this.stages.index + 1, s.city, stageName(s), s.nameEn, lang !== 'en', this.buildingIdx + 1, s.buildings);
  }

  newGame() {
    this.score.reset();
    this.stages.reset();
    this.input.clear();
    void this.startStage(0);
  }

  private async startStage(i: number) {
    window.clearTimeout(this.clearAutoTimer);
    await this.loadStage(i);
    this.spawnBuilding(0, true);
    this.score.startStage();
    this.stageStartScore = this.score.score;
    this.stageCleared = false;
    this.stageMs = 0;
    this.endMs = 0;
    this.lastComboShown = 0;
    const s = this.stages.current;
    $('intro-stage').textContent = `STAGE ${String(i + 1).padStart(2, '0')}`;
    $('intro-name').textContent = stageName(s);
    $('intro-en').textContent = lang === 'en' ? s.city : `${s.nameEn} · ${s.city}`;
    const intro = $('ov-intro').firstElementChild as HTMLElement;
    intro.style.animation = 'none'; void intro.offsetWidth; intro.style.animation = '';
    this.showOverlay('ov-intro');
    this.hud.show(true);
    this.status = 'STAGE_INTRO';
    this.introMs = 1200;
    this.audio.play('start');
  }

  private nextStage() {
    if (this.status !== 'STAGE_CLEAR') return;
    window.clearTimeout(this.clearAutoTimer);
    if (!this.stages.advance()) return;
    this.input.clear();
    void this.startStage(this.stages.index);
  }

  private toTitle() {
    window.clearTimeout(this.clearAutoTimer);
    this.status = 'TITLE';
    this.hud.show(false);
    $('title-best').textContent = pad8(this.best);
    void this.loadStage(0).then(() => this.showOverlay('ov-title'));
  }

  pause() {
    if (this.status !== 'PLAYING' && this.status !== 'STAGE_INTRO') return;
    this.pausedFrom = this.status;
    this.status = 'PAUSED';
    this.input.clear();
    this.showOverlay('ov-pause');
  }

  private resume() {
    if (this.status !== 'PAUSED') return;
    this.status = this.pausedFrom;
    this.input.clear();
    this.showOverlay(this.status === 'STAGE_INTRO' ? 'ov-intro' : null);
    this.lastFrame = performance.now();
  }

  private saveBest() {
    if (this.score.score > this.best) {
      this.best = this.score.score;
      safeStorage.set(STORAGE_BEST, String(this.best));
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- main loop
  private frame = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, (t - this.lastFrame) / 1000)); // clamp long frames (tab switch, GC)
    this.lastFrame = t;
    if (this.status !== 'PAUSED' && this.status !== 'TITLE') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 8) { this.step(STEP); this.acc -= STEP; n++; }
      if (n === 8) this.acc = 0;
    }
    if (this.status === 'PLAYING' || this.status === 'STAGE_INTRO' || this.status === 'PAUSED') {
      const ready = this.status === 'PLAYING' && this.score.gaugeFull && !this.ult && !this.endMs;
      this.hud.update(this.score.lives, this.score.score, this.score.gauge, ready, this.guard);
    }
    this.render(t);
    requestAnimationFrame(this.frame);
  };

  private step(dt: number) {
    const ms = dt * 1000;
    this.time += ms;
    const now = this.time;
    const b = this.building!;

    if (this.status === 'STAGE_INTRO') {
      this.introMs -= ms;
      this.input.clearPresses();
      this.updateSinking(ms, true); // the first building slides in behind the title card
      if (this.introMs <= 0) { this.status = 'PLAYING'; this.showOverlay(null); }
    }

    if (this.status === 'PLAYING') {
      if (this.input.consume('pause')) { this.pause(); return; }
      this.stageMs += ms;
      this.score.update(now);
      const lockedOut = this.endMs > 0;

      if (this.hitStopMs > 0) {
        this.hitStopMs -= ms; // only the hero and the building freeze; debris keeps flying
      } else {
        if (this.ult) this.updateUltimate(ms);
        else if (!lockedOut) {
          const dir = (this.input.held('right') ? 1 : 0) - (this.input.held('left') ? 1 : 0);
          this.player.move(this.player.hurtMs > 0 ? 0 : dir, dt);
          const wantAttack = this.input.consume('attack') || this.input.held('attack');
          if (wantAttack && this.player.canAttack()) this.attack();
          if (this.input.consume('jump') && this.player.jump()) this.audio.play('swing');
          if (this.input.consume('ultimate')) this.startUltimate();
          if (this.input.consume('guard')) this.doGuard();
        } else {
          this.input.clearPresses();
          this.player.move(0, dt);
        }
        // gravity; jumping into the building's underside stops the hero there
        const p = this.player;
        const under = b.undersideAt(p.x - 12, p.x + 12);
        p.physics(dt, under === -Infinity ? Infinity : GROUND_Y - HERO_H - under - 2);
        this.player.tick(ms);
        b.update(ms);
        for (const t of b.model.tick(ms)) this.breakTile(t, 'chain');
        this.updateSinking(ms, lockedOut);
      }
      this.guard = Math.min(C.guardMax, this.guard + C.guardRegenPerSec * dt);

      // hazards vs hero
      if (!lockedOut || this.score.lives > 0) {
        const hx = this.player.x, top = GROUND_Y - HERO_H * 0.85 - this.player.hop, bottom = GROUND_Y - this.player.hop;
        for (const h of this.debris.hazards) {
          if (h.age < 0.35 || h.dead) continue; // never an instant, unreadable hit
          const cx = Math.max(hx - 13, Math.min(hx + 13, h.x)), cy = Math.max(top, Math.min(bottom, h.y));
          if ((cx - h.x) ** 2 + (cy - h.y) ** 2 > h.r * h.r) continue;
          if (this.stageCleared) break;
          if (this.player.guardMs > 0) { // ↓ guard knocks falling stones away
            h.vy = -420; h.vx = (h.x >= hx ? 1 : -1) * 260; h.age = -1; // harmless while it flies off
            this.audio.play('crack');
            this.debris.popup(h.x, h.y - 10, 'CLANG!', 20, '#8ff0ff');
            continue;
          }
          if (this.score.takeHit(now)) {
            h.dead = true;
            this.player.hurt(h.x);
            this.audio.play('hurt');
            this.addShake(7, 220);
            this.debris.spawnShardBurst(h.x, h.y, h.color, this.stages.current.debris, 8);
            this.debris.popup(hx, GROUND_Y - HERO_H - 20, 'OUCH!', 20, '#ff6b5e');
            if (this.score.dead) { this.endMs = 1300; this.player.attackMs = 0; }
          }
        }
      }

      // a building is done when every static piece is gone (falling decoration never blocks it)
      if (!this.stageCleared && !this.betweenBuildings && !this.ult && b.model.activeCount() === 0 && !this.score.dead) {
        this.debris.hazards = [];
        const s = this.stages.current;
        if (this.buildingIdx < s.buildings - 1) {
          // on to the next building of this city's series
          this.betweenBuildings = true;
          this.endMs = 1000;
          const pts = this.score.add(C.buildingBonus * s.scoreMultiplier);
          this.banners.push({ text: `${this.buildingIdx + 1} / ${s.buildings}  +${pts}`, life: 1.0, max: 1.0, color: '#ffe066', size: 54 });
          this.audio.play('combo', { pitch: 1.2 });
        } else {
          this.stageCleared = true;
          this.endMs = 1500;
          this.banners.push({ text: 'CLEAR!', life: 1.4, max: 1.4, color: '#ffe066', size: 76 });
          this.audio.play('clear');
        }
      }

      if (this.endMs > 0) {
        this.endMs -= ms;
        if (this.endMs <= 0) {
          if (this.score.dead) this.gameOver();
          else if (this.stageCleared) this.showClear();
          else if (this.betweenBuildings) this.spawnBuilding(this.buildingIdx + 1, true);
        }
      }
    }

    this.debris.update(dt);
    if (this.shake.ms > 0) this.shake.ms -= ms;
    for (const tr of this.trails) tr.life -= dt;
    this.trails = this.trails.filter((t) => t.life > 0);
    for (const sl of this.slashes) sl.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const bn of this.banners) bn.life -= dt;
    this.banners = this.banners.filter((x) => x.life > 0);
  }

  private addShake(mag: number, ms: number) {
    const m = this.reducedMotion ? mag * 0.25 : mag;
    if (m >= this.shake.mag || this.shake.ms <= 0) { this.shake.mag = m; this.shake.ms = ms; }
  }

  private hazardsAllowed() {
    return !(this.stages.index === 0 && this.stageMs < C.tutorialMs) && !this.ult && !this.stageCleared && !this.betweenBuildings;
  }

  // ---------------------------------------------------------------- sinking building & guard
  /** The building sinks toward the hero; reaching head height crushes (one heart) and bounces it back up. */
  private updateSinking(ms: number, lockedOut: boolean) {
    const b = this.building!;
    if (this.enterMs > 0) {
      this.enterMs -= ms;
      const k = 1 - Math.max(0, this.enterMs) / 900;
      b.offsetY = -(BUILDING_START_BASE + 80) * (1 - k) ** 3; // ease out into its hanging spot
      return;
    }
    if (this.ult || lockedOut || this.betweenBuildings || this.stageCleared) return;
    if (this.haltMs > 0) { this.haltMs -= ms; return; }
    const s = this.stages.current;
    b.offsetY += s.sinkSpeed * (1 + this.buildingIdx * 0.04) * (ms / 1000);
    if (b.bottomY() >= CRUSH_Y) {
      if (this.score.takeHit(this.time)) {
        this.player.hurt(this.player.x + 1);
        this.audio.play('hurt');
        this.debris.popup(this.player.x, GROUND_Y - HERO_H - 20, 'CRUSH!', 24, '#ff6b5e');
        if (this.score.dead) { this.endMs = 1300; this.player.attackMs = 0; }
      }
      this.audio.play('ultBoom');
      this.addShake(9, 300);
      this.debris.addDust(this.player.x, GROUND_Y, 12);
      b.offsetY -= C.crushPushBack;
      this.haltMs = 900;
    }
  }

  /** GUARD (↓ / S): brace against the building's base so it stops sinking for a moment. */
  private doGuard() {
    if (this.guard < C.guardCost || this.enterMs > 0) { this.audio.play('swing'); return; }
    const b = this.building!;
    this.guard -= C.guardCost;
    this.haltMs = Math.max(this.haltMs, C.guardHaltMs);
    b.offsetY -= C.guardPush;
    this.player.guardMs = C.guardWindowMs;
    const by = Math.min(b.bottomY(), this.player.headY - 10);
    this.rings.push({ x: this.player.x, y: by, life: 0.35, max: 0.35, r: 70, color: '#8ff0ff' });
    this.addShake(4, 120);
    this.audio.play('hit', { pitch: 0.6 });
    this.debris.popup(this.player.x, by + 30, 'HALT!', 22, '#8ff0ff');
  }

  // ---------------------------------------------------------------- combat
  private attack() {
    const b = this.building!;
    const p = this.player;
    if (this.enterMs > 0) return;
    p.startAttack();
    // the sword only reaches just above the head: jump to hit a high building
    const head = p.headY;
    this.slashes.push({ x: p.x, y: head, dir: p.facing, life: 0.16 });
    const target = b.pieceIn(p.x - C.swordReachX, head - C.swordReachUp, p.x + C.swordReachX, head + 12, p.x);
    if (!target) { // whiff: no points, no gauge
      this.audio.play('swing');
      return;
    }
    const tx = b.tileWorldX(target), ty = b.tileWorldY(target);
    if (Math.abs(tx - p.x) > 4) p.facing = tx > p.x ? 1 : -1;
    const wasFull = this.score.gaugeFull;
    b.flash(target);
    const res = b.model.hit(target);
    b.touched();
    const destroyed = res === 'destroyed';
    const pts = this.score.registerHit(this.time, destroyed, this.stages.current.scoreMultiplier, this.stages.current.gaugeGain);
    this.hitStopMs = C.hitStopMs;
    this.addShake(destroyed ? 5 : 3, 100);
    this.rings.push({ x: tx, y: ty, life: 0.22, max: 0.22, r: 30, color: '#bfe3ff' });
    this.audio.play('hit', { pitch: 1 + Math.min(this.score.combo, 16) * 0.03 });
    if (destroyed) {
      this.breakTile(target, 'hit');
      this.debris.popup(tx, ty, `+${pts}`, 22);
    } else {
      this.audio.play('crack');
      this.debris.spawnShardBurst(tx, ty, b.piece(target).color, this.stages.current.debris, 3, 0.6);
      this.debris.popup(tx, ty, `+${pts}`, 16, '#d6ecff');
    }
    const combo = this.score.combo;
    if (combo >= 4 && combo % 4 === 0 && combo !== this.lastComboShown) {
      this.lastComboShown = combo;
      this.debris.popup(p.x, GROUND_Y - HERO_H - 60, `${combo} COMBO!`, 26 + Math.min(combo, 24) * 0.5, '#ffe066');
      this.audio.play('combo', { pitch: 1 + Math.min(combo, 24) * 0.02 });
    } else if (combo >= 2) {
      this.debris.popup(tx + 34, ty - 18, `${combo} COMBO`, 15, '#ffe9a6');
    }
    if (!wasFull && this.score.gaugeFull) {
      this.audio.play('gaugeFull');
      this.banners.push({ text: 'BREAK! READY', life: 1.1, max: 1.1, color: '#ffb21f', size: 34 });
    }
  }

  /** A static tile has just been destroyed (exactly once). Visuals, hazards and the score for chain/ult causes. */
  private breakTile(t: DestructibleTile, cause: 'hit' | 'chain' | 'ultimate') {
    const b = this.building!;
    const s = this.stages.current;
    b.detach(t);
    const piece = b.piece(t);
    this.debris.spawnPiece(piece, s.debris, cause === 'ultimate' ? 1.8 : 1);
    const x = b.tileWorldX(t), y = b.tileWorldY(t);
    if (cause === 'chain') {
      const pts = this.score.add(C.chainScore * s.scoreMultiplier);
      this.debris.popup(x, y, `+${pts}`, 15, '#ffd2a6');
      this.audio.play('crumble');
    } else if (cause === 'hit') {
      this.audio.play('crumble');
    }
    const rate = cause === 'chain' ? s.hazardRate * 0.6 : s.hazardRate;
    if (cause !== 'ultimate' && this.hazardsAllowed() && this.rng.next() < rate) this.debris.spawnHazard(x, y, piece.color);
    // anything now hanging in the air starts to tremble (it is cut out of the layer and drawn loose)
    if (cause !== 'ultimate') for (const loose of b.model.updateSupport()) b.detach(loose);
  }

  private startUltimate() {
    if (this.ult || this.endMs > 0 || this.enterMs > 0 || !this.score.useUltimate()) return;
    this.ult = { t: 0, order: [], next: 0, boomed: false, gained: 0 };
    this.score.grantInvulnerability(this.time, 2600); // the ultimate can never get you hit
    this.haltMs = Math.max(this.haltMs, 600);
    this.debris.hazards = [];
    this.audio.play('ultCharge');
    this.input.clearPresses(); // keep held keys/fingers: holding attack keeps working after the ultimate
  }

  private updateUltimate(ms: number) {
    const u = this.ult!;
    const b = this.building!;
    const s = this.stages.current;
    u.t += ms;
    this.input.clearPresses();
    const p = this.player;
    // move to the centre of the building while charging
    p.x += ((b.x + b.w / 2) - p.x) * Math.min(1, ms / 140);
    p.ultLift = u.t < 450 ? u.t / 450 : u.t < 1500 ? 1 : Math.max(0, 1 - (u.t - 1500) / 350);
    p.attackMs = 0;
    if (u.t < 450 && Math.random() < 0.5) this.rings.push({ x: p.x, y: GROUND_Y - HERO_H / 2 - p.hop, life: 0.35, max: 0.35, r: 50, color: '#ffe066' });
    if (!u.boomed && u.t >= 450) {
      u.boomed = true;
      u.order = b.model.ultimateOrder();
      this.audio.play('ultBoom');
      this.addShake(10, 700);
      this.banners.push({ text: 'FULL BREAK!', life: 1.3, max: 1.3, color: '#fff3b0', size: 62 });
    }
    if (u.boomed) {
      // pieces go bottom-to-top over ~750 ms
      const k = Math.min(1, (u.t - 450) / 750);
      const upTo = Math.ceil(k * u.order.length);
      let batch = 0;
      while (u.next < upTo) {
        const t = u.order[u.next++];
        if (!b.model.destroy(t)) continue; // already gone: never double-scored
        this.breakTile(t, 'ultimate');
        batch++;
        u.gained += this.score.add(C.ultimateTileScore * s.scoreMultiplier);
        this.debris.addDust(b.tileWorldX(t), b.tileWorldY(t), 2, 'rgba(255,240,200,');
      }
      if (batch) this.audio.play('crumble');
      if (k >= 1 && u.t > 1250 && u.gained) {
        this.debris.popup(b.x + b.w / 2, BUILDING_TOP + 120, `+${u.gained}`, 34, '#ffe066');
        u.gained = 0;
      }
    }
    if (u.t >= 1900) { this.ult = null; p.ultLift = 0; }
  }

  // ---------------------------------------------------------------- end states
  private showClear() {
    const s = this.stages.current;
    const stageScore = this.score.score - this.stageStartScore;
    const bonus = this.score.add(C.clearBonus * s.scoreMultiplier);
    const noDmg = this.score.hitsThisStage === 0 ? this.score.add(C.noDamageBonus) : 0;
    this.saveBest();
    this.hud.update(this.score.lives, this.score.score, this.score.gauge, false, this.guard);
    if (this.stages.isLast) { this.worldClear(); return; }
    this.status = 'STAGE_CLEAR';
    $('clear-name').textContent = stageName(s);
    $('clear-stage-score').textContent = stageScore.toLocaleString();
    $('clear-bonus').textContent = `+${bonus.toLocaleString()}`;
    $('clear-nodmg').textContent = noDmg ? `+${noDmg}` : '—';
    $('clear-total').textContent = pad8(this.score.score);
    $('clear-next').textContent = `${stageName(this.stages.next!)} (${this.stages.next!.city})`;
    this.showOverlay('ov-clear');
    this.clearAutoTimer = window.setTimeout(() => this.nextStage(), 2600);
  }

  private worldClear() {
    this.status = 'WORLD_CLEAR';
    this.finalScreen('WORLD CLEARED!', 'worldCleared');
  }

  private gameOver() {
    this.status = 'GAME_OVER';
    this.audio.play('gameOver');
    this.finalScreen('GAME OVER', 'gameOver');
  }

  private finalScreen(eyebrow: string, title: 'worldCleared' | 'gameOver') {
    const record = this.saveBest();
    this.input.clear();
    $('over-eyebrow').textContent = eyebrow;
    $('over-title').dataset.i18n = title;
    $('over-title').textContent = t(title);
    $('over-record').classList.toggle('hidden', !record);
    $('over-score').textContent = pad8(this.score.score);
    $('over-best').textContent = pad8(this.best);
    const s = this.stages.current;
    $('over-stage').textContent = `${this.stages.index + 1} / ${this.stages.stages.length} · ${stageName(s)} (${this.buildingIdx + 1}/${s.buildings})`;
    this.showOverlay('ov-over');
  }

  // ---------------------------------------------------------------- rendering
  private render(wallTime: number) {
    const ctx = this.ctx;
    const k = this.renderScale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const time = this.status === 'TITLE' ? wallTime : this.time;
    ctx.save();
    if (this.shake.ms > 0) {
      const m = this.shake.mag * Math.min(1, this.shake.ms / 120);
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    this.drawBackground(ctx);
    if (this.building) { this.drawCrushWarning(ctx); this.building.draw(ctx, time); }
    this.debris.drawBack(ctx, time);
    this.debris.draw(ctx, time);
    if (this.player) this.player.draw(ctx, time, this.score.isInvulnerable(this.time) && !this.ult && this.status !== 'TITLE');
    this.drawEffects(ctx, time);
    this.debris.drawPopups(ctx);
    ctx.restore();
    this.drawBanners(ctx);
    if (this.status === 'PLAYING' && this.stages.index === 0 && this.buildingIdx === 0 && this.stageMs < C.tutorialMs && !this.endMs) this.drawTutorial(ctx, time);
  }

  /** A red glow that grows as the sinking building nears the hero's head. */
  private drawCrushWarning(ctx: CanvasRenderingContext2D) {
    if (this.status !== 'PLAYING' || !this.building) return;
    const gap = CRUSH_Y - this.building.bottomY();
    if (!(gap < 120)) return;
    const k = Math.max(0, Math.min(1, 1 - gap / 120));
    const g = ctx.createLinearGradient(0, CRUSH_Y - 50, 0, CRUSH_Y);
    g.addColorStop(0, 'rgba(255,60,40,0)'); g.addColorStop(1, `rgba(255,60,40,${0.5 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(this.building.minX, CRUSH_Y - 50, this.building.maxX - this.building.minX, 50);
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const s = this.stages.current;
    ctx.fillStyle = s.skyTint;
    ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
    if (this.bg) {
      // cover the stage; the plate's low horizon sits just behind the hero's floor
      const w = VIEW_W + 20;
      const h = Math.max(GROUND_Y + 80, w * (this.bg.naturalHeight / this.bg.naturalWidth));
      const iw = h * (this.bg.naturalWidth / this.bg.naturalHeight);
      ctx.drawImage(this.bg, (VIEW_W - iw) / 2, GROUND_Y + 70 - h, iw, h);
    }
    // ground: a clean stage floor, then a darker strip behind the controls
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
    g.addColorStop(0, '#e9dfcb'); g.addColorStop(0.08, '#cbbd9f'); g.addColorStop(0.2, '#8a7c74'); g.addColorStop(0.32, '#3a3352'); g.addColorStop(1, '#221d3a');
    ctx.fillStyle = g;
    ctx.fillRect(-20, GROUND_Y, VIEW_W + 40, VIEW_H - GROUND_Y + 20);
    ctx.fillStyle = '#1b1530';
    ctx.fillRect(-20, GROUND_Y - 1, VIEW_W + 40, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = -20; x < VIEW_W + 20; x += 36) ctx.fillRect(x, GROUND_Y + 8, 22, 2);
  }

  private drawEffects(ctx: CanvasRenderingContext2D, time: number) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const t of this.trails) {
      const a = t.life / 0.16;
      ctx.strokeStyle = `rgba(90,160,255,${0.5 * a})`; ctx.lineWidth = 14 * a;
      ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
      ctx.strokeStyle = `rgba(235,248,255,${a})`; ctx.lineWidth = 4 * a;
      ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
    }
    for (const sl of this.slashes) {
      // white crescent sweeping over the head
      const k = 1 - sl.life / 0.16;
      const cx = sl.x, cy = sl.y + 18, r = 62;
      const a0 = sl.dir > 0 ? -Math.PI * 0.95 : -Math.PI * 0.05;
      const sweep = Math.PI * 0.9 * Math.min(1, k * 1.6) * sl.dir;
      ctx.globalAlpha = 1 - k * 0.7;
      ctx.strokeStyle = 'rgba(160,210,255,.55)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + sweep, sl.dir < 0); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + sweep, sl.dir < 0); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.r * k, 0, Math.PI * 2); ctx.stroke();
      if (k < 0.3) { ctx.fillStyle = '#fff'; ctx.globalAlpha = (0.3 - k) * 3; ctx.beginPath(); ctx.arc(r.x, r.y, 14, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    const u = this.ult;
    if (u) {
      const b = this.building!;
      // desaturate the world while charging, then the beam
      const dim = u.t < 450 ? u.t / 450 : Math.max(0, 1 - (u.t - 450) / 300);
      if (dim > 0) {
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = `rgba(128,128,128,${0.85 * dim})`;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(20,10,40,${0.25 * dim})`;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
      }
      const hx = this.player.x, hy = GROUND_Y - HERO_H / 2 - this.player.hop;
      if (u.t < 450) {
        const r = 20 + 30 * (u.t / 450);
        const grd = ctx.createRadialGradient(hx, hy, 2, hx, hy, r);
        grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.5, 'rgba(255,220,90,.6)'); grd.addColorStop(1, 'rgba(255,150,30,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
      } else if (u.t < 1350) {
        const k = (u.t - 450) / 900;
        const w = b.w * (0.35 + 0.65 * Math.sin(Math.min(1, k * 2) * Math.PI / 2)) * (1 - k * 0.6);
        const top = GROUND_Y - (GROUND_Y + 60) * Math.min(1, k * 3);
        const grd = ctx.createLinearGradient(b.x + b.w / 2 - w / 2, 0, b.x + b.w / 2 + w / 2, 0);
        grd.addColorStop(0, 'rgba(255,190,60,0)'); grd.addColorStop(0.35, 'rgba(255,230,140,.75)'); grd.addColorStop(0.5, 'rgba(255,255,255,.95)');
        grd.addColorStop(0.65, 'rgba(255,230,140,.75)'); grd.addColorStop(1, 'rgba(255,190,60,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grd;
        ctx.fillRect(b.x + b.w / 2 - w / 2, top, w, GROUND_Y - top);
        ctx.globalCompositeOperation = 'source-over';
        if (!this.reducedMotion && u.t < 560) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (u.t - 450) / 110)})`; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40); }
      }
      void time;
    }
    ctx.restore();
  }

  private drawBanners(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let y = 300;
    for (const bn of this.banners) {
      const age = 1 - bn.life / bn.max;
      const scale = age < 0.15 ? 0.6 + age / 0.15 * 0.55 : age < 0.25 ? 1.15 - (age - 0.15) : 1.05;
      ctx.globalAlpha = bn.life < 0.25 ? bn.life / 0.25 : 1;
      ctx.save();
      ctx.translate(VIEW_W / 2, y); ctx.rotate(-0.06); ctx.scale(scale, scale);
      ctx.font = `900 italic ${bn.size}px "Arial Black", Impact, sans-serif`;
      ctx.lineWidth = bn.size * 0.16; ctx.strokeStyle = '#1b1530'; ctx.strokeText(bn.text, 0, 0);
      ctx.fillStyle = bn.color; ctx.fillText(bn.text, 0, 0);
      ctx.restore();
      y += bn.size + 16;
    }
    ctx.restore();
  }

  private drawTutorial(ctx: CanvasRenderingContext2D, time: number) {
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const a = Math.min(1, (C.tutorialMs - this.stageMs) / 600);
    ctx.save();
    ctx.globalAlpha = a * (0.75 + 0.25 * Math.sin(time * 0.006));
    ctx.textAlign = 'center';
    ctx.font = '800 18px system-ui, sans-serif';
    const text = t(fine ? 'tutorialKeys' : 'tutorialTouch');
    const w = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(27,21,48,.82)';
    ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, 108, w, 34, 17); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, VIEW_W / 2, 131);
    ctx.restore();
  }
}
