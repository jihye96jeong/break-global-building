import './style.css';
import { AudioManager } from './audio/audio';
import { BALANCE } from './config/balance';
import { LANDMARKS, landmarkById } from './config/landmarks';
import { buildingRng, pickLandmark } from './core/building';
import { newRun, pause, resume, startRun, takeEvents, tick, tierOf, type GameEvent, type RunState } from './core/game';
import { loadSave, recordRun, writeSave } from './core/persistence';
import { applyDom, lang, LANG_LABEL, LANGS, onLangChange, setLang, t, type Lang } from './i18n';
import { Input } from './input';
import { imageNow, loadImage, preload } from './render/assets';
import { buildVisual, type BuildingVisual } from './render/landmark';
import { NINJA_SPRITES } from './render/character';
import { Particles } from './render/particles';
import { Renderer, type FrameFx } from './render/renderer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const STEP = 1 / 60;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const save = loadSave();
const audio = new AudioManager();
audio.enabled = save.sound;
const input = new Input();
const renderer = new Renderer($<HTMLCanvasElement>('view'));
const fx = new Particles();
const state: RunState = newRun(Date.now() >>> 0);
state.phase = 'BOOT';

let visual: BuildingVisual | null = null;
let bgLandmark = LANDMARKS[0].id;
const effects = { shake: 0, shakeMs: 0, flash: 0, red: 0, cutin: 0, hitStop: 0 };
const pendingBursts: { at: number; fn: () => void }[] = [];
let hintStep = 0, hintTimer = 0, hint3Shown = false, tutorialActive = !save.tutorialSeen;

// ---------------------------------------------------------------- HUD
const HEART = (full: boolean) =>
  `<svg viewBox="0 0 30 28"><path d="M15 26 C5 18 1 13 1 8 A6.5 6.5 0 0 1 15 5 A6.5 6.5 0 0 1 29 8 C29 13 25 18 15 26Z" fill="${full ? '#ff4a5e' : 'rgba(255,255,255,.18)'}" stroke="#1b1530" stroke-width="2.5" stroke-linejoin="round"/>${full ? '<path d="M7 9 A3 3 0 0 1 11 6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>' : ''}</svg>`;
const last = { lives: -1, score: -1, combo: -1, guard: -1, special: -1, bid: '', lang: '' };
const pad9 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(9, '0');

function nextLandmarkName() {
  // the next building's landmark is already decided by the run seed: show it honestly
  const l = pickLandmark(buildingRng(state.seed, state.buildingIndex + 1), state.recentLandmarks);
  return landmarkById(l.id).names[lang];
}

function updateHud() {
  if (state.lives !== last.lives) {
    const lost = state.lives < last.lives;
    $('hearts').innerHTML = Array.from({ length: BALANCE.lives }, (_, i) => HEART(i < state.lives)).join('');
    if (lost) $('hearts').children[state.lives]?.classList.add('lost');
    last.lives = state.lives;
  }
  if (state.score !== last.score) {
    const el = $('score');
    el.textContent = pad9(state.score);
    if (state.score > last.score && last.score >= 0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    last.score = state.score;
    $('best').textContent = String(Math.max(save.bestScore, state.score));
  }
  if (state.combo !== last.combo) {
    $('combo').classList.toggle('hidden', state.combo < 2);
    $('combo-n').textContent = String(state.combo);
    last.combo = state.combo;
  }
  const gd = Math.round(state.guard);
  if (gd !== last.guard) {
    $('guard-fill').style.width = `${gd}%`;
    $('guard-fill').classList.toggle('low', gd < BALANCE.air.cost);
    $('guard-pct').textContent = `${gd}%`;
    last.guard = gd;
  }
  const sp = Math.round(state.special);
  if (sp !== last.special) {
    $('special-fill').style.width = `${sp}%`;
    $('special-pct').textContent = `${sp}%`;
    const full = sp >= BALANCE.specialMax;
    $('special-wrap').classList.toggle('full', full);
    $('special-ready').classList.toggle('hidden', !full);
    $<HTMLButtonElement>('pb-special').disabled = !full;
    last.special = sp;
  }
  const b = state.building;
  const bid = `${b?.id ?? ''}${b?.floors.length ?? 0}`;
  if (bid !== last.bid || last.lang !== lang) {
    const tier = tierOf(state);
    $('tier').textContent = `TIER ${tier.tier} · ${tier.name}${b?.elite ? ' · ELITE' : ''}`;
    $('bname').textContent = b ? `${landmarkById(b.landmarkId).names[lang]} · ${b.floors.length}${lang === 'en' ? ' ' : ''}${t('floors')}` : '';
    $('next-name').textContent = nextLandmarkName();
    last.bid = bid; last.lang = lang;
  }
}

function showHint(text: string, ms: number) {
  const el = $('hint');
  el.textContent = text;
  el.classList.remove('hidden');
  hintTimer = ms;
}

// ---------------------------------------------------------------- flow
function showOverlay(id: string | null) {
  for (const o of ['ov-title', 'ov-help', 'ov-pause', 'ov-over']) $(o).classList.toggle('hidden', o !== id);
  const playing = id === null;
  for (const o of ['hud', 'status']) $(o).classList.toggle('hidden', !playing && id !== 'ov-pause');
}

function toTitle() {
  state.phase = 'TITLE';
  state.building = null;
  fx.clear();
  $('title-best').textContent = String(save.bestScore);
  $('title-combo').textContent = String(save.bestCombo);
  showOverlay('ov-title');
}

function begin() {
  audio.unlock();
  input.clear();
  fx.clear();
  pendingBursts.length = 0;
  startRun(state, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  last.lives = -1; last.score = -1; last.combo = -1; last.special = -1; last.guard = -1; last.bid = '';
  hintStep = 0; hint3Shown = false; tutorialActive = !save.tutorialSeen;
  $('hint').classList.add('hidden');
  showOverlay(null);
  audio.play('start');
}

function doPause() {
  if (state.phase === 'TITLE' || state.phase === 'GAME_OVER' || state.phase === 'BOOT') return;
  if (state.phase === 'PAUSED') { doResume(); return; }
  pause(state);
  input.clear();
  showOverlay('ov-pause');
}
function doResume() {
  resume(state);
  input.clear();
  showOverlay(null);
  lastFrame = performance.now();
}

function toggleSound() {
  audio.enabled = !audio.enabled;
  if (audio.enabled) audio.unlock();
  save.sound = audio.enabled;
  writeSave(save);
  syncSound();
}
function syncSound() {
  document.querySelectorAll<HTMLElement>('.sound-toggle').forEach((b) => { b.textContent = t(audio.enabled ? 'soundOn' : 'soundOff'); });
  $('btn-mute').setAttribute('aria-pressed', String(!audio.enabled));
}

// ---------------------------------------------------------------- events → effects
function shake(mag: number, ms: number) { if (mag >= effects.shake || effects.shakeMs <= 0) { effects.shake = mag; effects.shakeMs = ms; } }

function floorWorldRect(bottomY: number, height: number) {
  const w = visual?.width ?? 300;
  return { x: renderer.worldW / 2 - w / 2, y: bottomY - height, w, h: height };
}

function onEvent(e: GameEvent) {
  const p = state.player;
  const lx = renderer.laneX(p.lane);
  switch (e.t) {
    case 'countdown': audio.play('crack'); break;
    case 'jump': audio.play('swing'); break;
    case 'whiff': audio.play('swing'); break;
    case 'hit': {
      const by = state.building?.bottomY ?? 200;
      const headY = 530 - BALANCE.heroHeight - p.y;
      fx.streak(lx, Math.min(by, headY), headY);
      fx.sparks(lx, by, 3 + Math.floor(Math.random() * 6));
      fx.pop(lx + 28, by - 6, `+${e.score}`, 15, '#d6ecff');
      audio.play('hit', { pitch: 1 + Math.min(state.combo, 30) * 0.02 });
      if (e.hpLeft > 0) audio.play('crack');
      shake(2.5, 80);
      break;
    }
    case 'floor': {
      const fv = visual?.floors.get(e.floor.id);
      const r = floorWorldRect(e.bottomY, e.floor.height);
      if (fv) fx.burstFloor(fv.canvas, r.x, r.y - fv.padTop, r.w, r.h + fv.padTop + fv.padBottom, landmarkById(e.landmarkId).debrisPalette, 3 + Math.floor(Math.random() * 3));
      fx.pop(lx, r.y - 8, `+${e.score}`, 24);
      audio.play('crumble');
      shake(5, 120);
      if (tutorialActive && hintStep === 1) { hintStep = 2; showHint(t('hint2'), 1800); }
      break;
    }
    case 'building': {
      fx.pop(renderer.worldW / 2, 220, `+${e.bonus}`, 36, '#ffe066');
      if (e.elite) fx.pop(renderer.worldW / 2, 180, 'ELITE CLEAR', 30, '#ffcc33');
      audio.play('clear');
      shake(8, 260);
      break;
    }
    case 'guard': {
      fx.ring(lx, 530 - BALANCE.heroHeight - p.y, 70, '#8ff0ff', 0.35, 6);
      if (e.kind === 'ground') { fx.ring(lx, 528, 120, '#bff3ff', 0.4, 8); shake(6, 160); }
      fx.pop(lx, 400, e.kind === 'air' ? 'AIR GUARD · COMBO KEEP' : 'GUARD!', e.kind === 'air' ? 18 : 22, '#8ff0ff');
      audio.play('hit', { pitch: e.kind === 'air' ? 0.9 : 0.55 });
      audio.play('crack');
      break;
    }
    case 'guardBreak': fx.pop(lx, 420, 'GUARD BREAK', 22, '#ff6b5e'); audio.play('swing'); break;
    case 'lifeLost': effects.red = 1; shake(11, 320); audio.play('hurt'); audio.play('ultBoom'); break;
    case 'specialReady': audio.play('gaugeFull'); break;
    case 'combo': { const el = $('combo'); el.classList.remove('big'); void el.offsetWidth; el.classList.add('big'); fx.pop(renderer.worldW / 2, 260, `${e.combo} COMBO!`, 34 + Math.min(e.combo, 100) * 0.1, '#ffe066'); audio.play('combo', { pitch: 1.2 }); break; }
    case 'special': {
      effects.cutin = 1; effects.flash = 1; effects.hitStop = 80;
      audio.play('ultCharge');
      // the floors are already gone in the game state; here they burst one after another, bottom to top
      let bottom = e.bottomY;
      const v = visual;
      e.floors.forEach((f, i) => {
        const b = bottom, fv = v?.floors.get(f.id);
        bottom -= f.height;
        pendingBursts.push({ at: state.timeMs + 120 + i * (420 / Math.max(1, e.floors.length)), fn: () => {
          const r = floorWorldRect(b, f.height);
          if (fv) fx.burstFloor(fv.canvas, r.x, r.y - fv.padTop, r.w, r.h + fv.padTop + fv.padBottom, landmarkById(e.landmarkId).debrisPalette, 3, 1.3);
          if (i === 0) { audio.play('ultBoom'); shake(10, 500); }
          else audio.play('crumble');
        } });
      });
      fx.pop(renderer.worldW / 2, 300, `+${e.score}`, 34, '#ffe066');
      break;
    }
    case 'wave': {
      visual = buildVisual(e.building, renderer.worldW, renderer.scale);
      const asset = landmarkById(e.building.landmarkId).asset;
      if (visual.fallback) void loadImage(asset).then((img) => { // art still on its way: swap it in once it arrives
        if (img && state.building?.id === e.building.id && state.building) visual = buildVisual(state.building, renderer.worldW, renderer.scale);
      });
      bgLandmark = e.building.landmarkId;
      if (tutorialActive && hintStep === 0) { hintStep = 1; showHint(t('hint1'), 1800); }
      break;
    }
    case 'gameOver': {
      const record = recordRun(save, state.score, state.maxCombo);
      if (!save.tutorialSeen) { save.tutorialSeen = true; writeSave(save); }
      audio.play('gameOver');
      $('over-record').classList.toggle('hidden', !record);
      $('over-score').textContent = state.score.toLocaleString();
      $('over-destroyed').textContent = String(state.destroyedBuildings);
      $('over-combo').textContent = String(state.maxCombo);
      $('over-best').textContent = save.bestScore.toLocaleString();
      window.setTimeout(() => { if (state.phase === 'GAME_OVER') { showOverlay('ov-over'); $('btn-restart').focus(); } }, 700);
      break;
    }
  }
}

// ---------------------------------------------------------------- loop
let acc = 0;
let lastFrame = performance.now();

function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)); // clamp: no runaway after a background tab
  lastFrame = now;
  const running = state.phase !== 'PAUSED' && state.phase !== 'TITLE' && state.phase !== 'BOOT';
  if (running) {
    if (effects.hitStop > 0) effects.hitStop -= dt * 1000;
    else acc += dt;
    while (acc >= STEP) {
      tick(state, STEP, input.take());
      for (const e of takeEvents(state)) onEvent(e);
      fx.update(STEP);
      for (let i = pendingBursts.length - 1; i >= 0; i--) if (state.timeMs >= pendingBursts[i].at) { pendingBursts[i].fn(); pendingBursts.splice(i, 1); }
      acc -= STEP;
    }
    effects.shakeMs = Math.max(0, effects.shakeMs - dt * 1000);
    if (effects.shakeMs <= 0) effects.shake = 0;
    effects.flash = Math.max(0, effects.flash - dt * 4);
    effects.red = Math.max(0, effects.red - dt * 2.5);
    effects.cutin = state.phase === 'SPECIAL_CUTIN' ? Math.min(1, state.phaseMs / 200) : Math.max(0, effects.cutin - dt * 4);
    // tutorial hint 3: when the building first gets close
    if (tutorialActive && !hint3Shown && hintStep >= 1 && state.building && state.building.bottomY > 530 - 150 && state.phase === 'PLAYING') {
      hint3Shown = true; showHint(t('hint3'), 2000);
    }
    if (hintTimer > 0) { hintTimer -= dt * 1000; if (hintTimer <= 0) $('hint').classList.add('hidden'); }
    updateHud();
  } else input.take();

  const b = state.building;
  const fxState: FrameFx = {
    shake: effects.shake, flash: effects.flash, redFlash: effects.red, cutin: effects.cutin, reducedMotion,
    countdown: state.phase === 'COUNTDOWN' ? state.countdown : null,
    waveCard: state.phase === 'WAVE_TRANSITION' && b ? {
      name: landmarkById(b.landmarkId).names[lang], elite: b.elite, k: 1 - state.phaseMs / BALANCE.waveGapMs,
      sub: `${landmarkById(b.landmarkId).names.en.toUpperCase()} · ${b.floors.length} ${t('floors')} · TIER ${b.tier}`,
    } : null,
    showHp: save.showHpNumbers,
  };
  renderer.draw(state, visual, fx, fxState, state.phase === 'TITLE' ? now : state.timeMs, bgLandmark);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- wiring
function layout() {
  const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  document.documentElement.style.setProperty('--pad-h', coarse ? (innerHeight > innerWidth ? '30vh' : '26vh') : '0px');
  renderer.resize();
  if (state.building && visual) visual = buildVisual(state.building, renderer.worldW, renderer.scale); // pixels only; state untouched
}

function bind() {
  document.querySelectorAll<HTMLSelectElement>('.lang-select').forEach((sel) => {
    sel.innerHTML = LANGS.map((l) => `<option value="${l}">${LANG_LABEL[l]}</option>`).join('');
    sel.addEventListener('change', () => setLang(sel.value as Lang));
  });
  applyDom();
  onLangChange(() => { syncSound(); last.lang = ''; });
  const click = (id: string, fn: () => void) => $(id).addEventListener('click', () => { audio.unlock(); fn(); });
  click('btn-start', begin);
  click('btn-restart', begin);
  click('btn-home', toTitle);
  click('btn-quit', toTitle);
  click('btn-resume', doResume);
  click('btn-pause', doPause);
  click('btn-mute', toggleSound);
  click('btn-sound', toggleSound);
  click('btn-pause-sound', toggleSound);
  click('btn-help', () => {
    $<HTMLInputElement>('opt-tutorial').checked = !save.tutorialSeen;
    $<HTMLInputElement>('opt-hp').checked = save.showHpNumbers;
    $('ov-help').classList.remove('hidden');
  });
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => $(b.dataset.close!).classList.add('hidden')));
  $<HTMLInputElement>('opt-tutorial').addEventListener('change', (e) => { save.tutorialSeen = !(e.target as HTMLInputElement).checked; writeSave(save); });
  $<HTMLInputElement>('opt-hp').addEventListener('change', (e) => { save.showHpNumbers = (e.target as HTMLInputElement).checked; writeSave(save); });
  input.onGesture = () => audio.unlock();
  input.onSystem = (a) => (a === 'pause' ? doPause() : toggleSound());
  input.bind($('pb-left'), 'left'); input.bind($('pb-right'), 'right');
  input.bind($('pb-jump'), 'jump'); input.bind($('pb-guard'), 'guard');
  input.bind($('pb-attack'), 'attack'); input.bind($('pb-special'), 'special');
  // touch: tap a lane on the playfield to go there
  $('view').addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && state.phase === 'PLAYING') input.tapLane(renderer.laneAtClientX(e.clientX)); });
  // Enter starts / restarts from the title and result screens
  addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' || !$('ov-help').classList.contains('hidden')) return;
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) return; // let the focused control act
    const onTitle = state.phase === 'TITLE' && !$('ov-title').classList.contains('hidden');
    const onOver = state.phase === 'GAME_OVER' && !$('ov-over').classList.contains('hidden');
    if (onTitle || onOver) begin();
  });
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 150));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state.phase !== 'PAUSED') doPause(); audio.suspend(); } else audio.resume(); });
  addEventListener('blur', () => { if (state.phase !== 'PAUSED') doPause(); });
}

async function boot() {
  bind();
  syncSound();
  layout();
  // the title shows at once; images stream in, and any that fail are drawn with fallback shapes
  toTitle();
  requestAnimationFrame((n) => { lastFrame = n; frame(n); });
  const srcs = [...new Set(LANDMARKS.flatMap((l) => [l.asset, l.background])), 'assets/fx/special_cutin.webp', ...Object.values(NINJA_SPRITES)];
  await preload(srcs);
  if (!imageNow(LANDMARKS[0].background)) console.warn('background art missing: using drawn fallbacks');
}

void boot();
(window as unknown as { __wb?: unknown }).__wb = { state, renderer, save }; // QA hook for automated playtests
