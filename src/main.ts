import './style.css';
import { AudioManager } from './audio/audio';
import { BALANCE, DANGER_Y, GROUND_Y } from './config/balance';
import { CAMERA_FEEL, COMBO_TIERS, DEBRIS_FEEL } from './config/gameFeel';
import { LANDMARKS, landmarkById } from './config/landmarks';
import { buildingRng, pickLandmark } from './core/building';
import { attackSurfaceY, guardPlaneY, heroLanePos, newRun, pause, resume, skipIntro, startRun, startStoryRun, storyStage, takeEvents, tick, tierOf, type GameEvent, type RunState } from './core/game';
import { WorldMap } from './story/map-ui';
import { canEnterStoryLevel, StoryStore } from './story/progress';
import { STORY_LEVELS, STORY_STAGES, stageFor } from './story/stages';
import { loadSave, recordRun, writeSave } from './core/persistence';
import { applyDom, lang, LANG_LABEL, LANGS, onLangChange, setLang, t, tf, type Lang } from './i18n';
import { Input } from './input';
import { imageNow, loadImage, preload } from './render/assets';
import { buildVisual, type BuildingVisual } from './render/landmark';
import { NINJA_SPRITES } from './render/character';
import { Banners, BANNER_PRIORITY as P, Camera } from './render/camera';
import { mountDebugPanel } from './debug';
import { Particles } from './render/particles';
import { Renderer, type FrameFx } from './render/renderer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const STEP = 1 / 60;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const debugFeel = new URLSearchParams(location.search).has('debugFeel');
let debugContact = new URLSearchParams(location.search).has('debugContact') || new URLSearchParams(location.search).has('debug');
addEventListener('keydown', (ev) => { if (ev.key === 'F3') { ev.preventDefault(); debugContact = !debugContact; } }); // dev overlay toggle

const save = loadSave();
// v5 story progress: its own key, never mixed with the endless records above
const safeStorage = (() => { try { return window.localStorage; } catch { return null; } })();
const story = new StoryStore(safeStorage);
const params = new URLSearchParams(location.search);
// development only: ?dev=1 opens every level (never in a production build)
if (import.meta.env.DEV && params.has('dev')) story.progress.unlockedLevel = STORY_LEVELS;
let pendingUnlockAnim: number | null = null;
const audio = new AudioManager();
audio.enabled = save.sound;
const input = new Input();
const renderer = new Renderer($<HTMLCanvasElement>('view'));
const fx = new Particles();
const camera = new Camera();
const banners = new Banners();
const state: RunState = newRun(Date.now() >>> 0);
state.phase = 'BOOT';

let visual: BuildingVisual | null = null;
let bgLandmark = LANDMARKS[0].id;
const effects = { flash: 0, red: 0, cutin: 0, recoil: 0, recoilMs: 0, danger: 0, panY: 0, slashGlow: 0 };
let keyGuideMs = 0; // v4: the in-game key row shows for 4 s at the start of a run, then fades
const pendingBursts: { at: number; fn: () => void }[] = [];
const eventLog: string[] = []; // debug panel only

/** Effects LOW (or reduced motion): no camera shake, fewer particles. Game rules never change. */
function applyEffectsLevel() {
  const low = reducedMotion || save.effectsLow;
  camera.scale = low ? 0 : 1;
  fx.low = low;
  fx.cap = low || matchMedia('(pointer: coarse)').matches ? DEBRIS_FEEL.maxParticlesMobile : DEBRIS_FEEL.maxParticlesDesktop;
}
let hintStep = 0, hintTimer = 0, hint3Shown = false, tutorialActive = !save.tutorialSeen;

// ---------------------------------------------------------------- HUD
const HEART = (full: boolean) =>
  `<svg viewBox="0 0 30 28"><path d="M15 26 C5 18 1 13 1 8 A6.5 6.5 0 0 1 15 5 A6.5 6.5 0 0 1 29 8 C29 13 25 18 15 26Z" fill="${full ? '#ff4a5e' : 'rgba(255,255,255,.18)'}" stroke="#1b1530" stroke-width="2.5" stroke-linejoin="round"/>${full ? '<path d="M7 9 A3 3 0 0 1 11 6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>' : ''}</svg>`;
const last = { lives: -1, score: -1, combo: -1, special: -1, bid: '', lang: '', wave: -1 };
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
  const st = state.story;
  if (st && (bid !== last.bid || last.lang !== lang || last.wave !== st.wavesCleared)) {
    $('tier').textContent = `${t('level').toUpperCase()} ${st.level}/${STORY_LEVELS}`;
    $('bname').textContent = `${st.wavesCleared} / ${st.waveCount} ${t('buildingsLbl')}`;
    $('next-name').textContent = stageFor(st.level).title[lang];
    last.bid = bid; last.lang = lang; last.wave = st.wavesCleared;
  } else if (!st && (bid !== last.bid || last.lang !== lang)) {
    const tier = tierOf(state);
    $('tier').textContent = `TIER ${tier.tier} · ${tier.name}${b?.elite ? ' · ELITE' : ''}`;
    $('bname').textContent = b ? `${landmarkById(b.landmarkId).names[lang]} · ${b.floors.length}${lang === 'en' ? ' ' : ''}${t('floors')}` : '';
    $('next-name').textContent = nextLandmarkName();
    last.bid = bid; last.lang = lang;
  }
}

/** The key list as separate unbreakable chips (one row, wraps between chips only). */
function renderKeyGuide() {
  const html = t('keyGuide').split(' · ').map((k) => `<span>${k}</span>`).join('');
  $('keyguide').innerHTML = html;
  $('pause-keys').innerHTML = html;
}

function showHint(text: string, ms: number) {
  const el = $('hint');
  el.textContent = text;
  el.classList.remove('hidden');
  hintTimer = ms;
}

// ---------------------------------------------------------------- flow
function showOverlay(id: string | null) {
  for (const o of ['ov-title', 'ov-help', 'ov-pause', 'ov-over', 'ov-map', 'ov-clear', 'ov-fail']) $(o).classList.toggle('hidden', o !== id);
  const playing = id === null;
  for (const o of ['hud', 'status']) $(o).classList.toggle('hidden', !playing && id !== 'ov-pause');
}

/** v5: the world map is home. */
function toMap() {
  state.phase = 'TITLE';
  state.building = null;
  state.mode = 'endless'; state.story = null;
  document.body.classList.remove('story');
  fx.clear();
  worldMap.render(story.progress, pendingUnlockAnim);
  pendingUnlockAnim = null;
  showOverlay('ov-map');
  worldMap.focusSelected();
}

let currentLevel = 1;
/** Start (or retry) a story level — only through the unlock gate. */
function playStory(level: number) {
  if (!canEnterStoryLevel(level, story.progress)) { toMap(); return; }
  currentLevel = level;
  resetForRun();
  startStoryRun(state, level, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  document.body.classList.add('story');
  bgLandmark = stageFor(level).landmarkPool[0];
  showOverlay(null);
  audio.play('start');
}

function resetForRun() {
  audio.unlock();
  input.clear();
  fx.clear(); camera.clear(); banners.clear();
  pendingBursts.length = 0;
  last.lives = -1; last.score = -1; last.combo = -1; last.special = -1; last.bid = '';
  hintStep = 0; hint3Shown = false; tutorialActive = !save.tutorialSeen;
  $('hint').classList.add('hidden');
  keyGuideMs = 4000; $('keyguide').classList.remove('faded');
}

function begin() {
  document.body.classList.remove('story');
  audio.unlock();
  input.clear();
  fx.clear(); camera.clear(); banners.clear();
  pendingBursts.length = 0;
  startRun(state, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  last.lives = -1; last.score = -1; last.combo = -1; last.special = -1; last.bid = '';
  hintStep = 0; hint3Shown = false; tutorialActive = !save.tutorialSeen;
  $('hint').classList.add('hidden');
  keyGuideMs = 4000; $('keyguide').classList.remove('faded');
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

// ---------------------------------------------------------------- events → effects (v2 §11 effect director)
const kick = (k: { amp: number; ms: number }, dx = 0, dy = 1) => camera.kick(k.amp, k.ms, dx, dy);

function floorWorldRect(bottomY: number, height: number) {
  const w = visual?.width ?? 300;
  return { x: renderer.worldW / 2 - w / 2, y: bottomY - height, w, h: height };
}

function onEvent(e: GameEvent) {
  const p = state.player;
  const lx = renderer.laneX(heroLanePos(p)); // where the hero is actually drawn (mid-slide included)
  const b = state.building;
  const material = landmarkById(b?.landmarkId ?? bgLandmark).material;
  if (debugFeel) { eventLog.unshift(`${(state.timeMs / 1000).toFixed(2)} ${e.t} g=${state.guardPhase} b=${b ? b.bottomY.toFixed(1) : '-'} gap=${b ? (guardPlaneY(state) - b.bottomY).toFixed(1) : '-'} y=${p.y.toFixed(0)}`); eventLog.length = Math.min(eventLog.length, 10); }
  switch (e.t) {
    case 'countdown': audio.play('crack'); break;
    case 'jump':
      audio.play('jump');
      fx.smoke(lx, GROUND_Y, 4, 'rgba(232,222,204,', 0.8);
      break;
    case 'land':
      audio.play('land');
      fx.smoke(lx, GROUND_Y, e.fromHeight > 120 ? 6 : 3, 'rgba(232,222,204,', 0.9);
      if (e.fromHeight > 120) kick(CAMERA_FEEL.land);
      break;
    case 'swing': {
      // the slash is drawn at once, hit or not; only a confirmed 'hit' adds sparks, cracks and shake
      fx.slash(lx, attackSurfaceY(state) + 10, e.variant, p.facing, state.combo);
      audio.play('swing');
      break;
    }
    case 'whiff': break;
    case 'hit': {
      // everything lands on the real blade-to-underside contact point
      const by = e.contact.y;
      const cx = renderer.laneX(e.contact.lanePos);
      fx.streak(cx, by, by + 14, 'rgba(220,240,255,.95)', 9, 0.06);
      fx.sparks(cx, by, 4, ['#ffffff', '#fff3b0']);
      audio.play('hit', { pitch: 1 + Math.min(state.combo, 40) * 0.012 });
      if (e.hpLeft > 0) {
        const fv = visual?.floors.get(e.floor.id);
        fx.damage(cx, by, e.hpLeft, fv?.color ?? '#999', material);
        audio.play(e.hpLeft === 1 ? 'crack' : 'stone', { pitch: e.hpLeft === 1 ? 1.2 : 1.6 });
        kick(e.hpBefore === 2 ? CAMERA_FEEL.heavyHit : CAMERA_FEEL.hit, p.facing * -0.6, 1);
      } else kick(CAMERA_FEEL.hit, p.facing * -0.6, 1);
      fx.pop(cx + 30, by - 4, `+${e.score}`, 14, '#d6ecff');
      if (e.counter) banners.offer('COUNTER!', P.CLUTCH - 0.5, '#8ff0ff', 28);
      break;
    }
    case 'floor': {
      const fv = visual?.floors.get(e.floor.id);
      const r = floorWorldRect(e.bottomY, e.floor.height);
      if (fv) fx.burstFloor(fv.canvas, r.x, r.y - fv.padTop, r.w, r.h + fv.padTop + fv.padBottom, landmarkById(e.landmarkId).debrisPalette, material, lx, e.last ? 1.25 : 1);
      fx.sparks(lx, e.bottomY, 10, ['#ffffff', '#fff3b0']);
      fx.pop(lx, r.y - 6, `+${e.score}`, 24);
      audio.play(material);
      audio.play('crumble');
      kick(CAMERA_FEEL.floor, (Math.random() - 0.5) * 0.8, 1);
      effects.recoil = DEBRIS_FEEL.recoilUnits; effects.recoilMs = DEBRIS_FEEL.recoilMs; // render-only lift of what remains
      if (e.last && e.aerial) banners.offer('AERIAL FINISH!', P.FINISH, '#ffe066', 38);
      else if (e.chain >= 3) banners.offer(`CHAIN CUT! ×${e.chain}`, P.CHAIN, '#ffd28a', 30);
      else if (e.oneHit) banners.offer('ONE HIT BREAK!', P.NORMAL, '#fff6c2', 26);
      if (tutorialActive && hintStep === 1) { hintStep = 2; showHint(t('hint2'), 1800); }
      break;
    }
    case 'building': {
      const cx = renderer.worldW / 2;
      fx.ring(cx, e.building.bottomY, 220, 'rgba(255,240,180,.95)', 0.45, 10, 0.4);
      fx.pop(cx, 230, `+${e.bonus}`, 34, '#ffe066');
      banners.offer(e.elite ? 'ELITE CLEAR!' : lang === 'ko' ? '완파!' : 'DESTROYED!', P.FINISH - 0.5, '#ffe066', 44, 0.9);
      audio.play('finish');
      kick(CAMERA_FEEL.building, 0, 1);
      break;
    }
    case 'guardContact': {
      // v3 §7: one heavy THUD at the exact contact point; strength (visual only) scales with the impact speed
      const n = Math.max(0, Math.min(1, (e.impactSpeed - 100) / 600));
      fx.sparks(lx, e.planeY, Math.round(5 + 5 * n), ['#ffffff', '#bff3ff', '#8ff0ff']);
      fx.ring(lx, e.planeY, 40, '#bff3ff', 0.12, 5, 0.35);
      fx.smoke(lx, e.planeY, e.kind === 'ground' ? 5 : 3, 'rgba(232,222,204,', 0.7);
      audio.play(e.kind === 'ground' ? 'guardThud' : 'guardClang', { pitch: 1 - 0.08 * n });
      camera.kick(2.5 + 1.5 * n, e.kind === 'ground' ? CAMERA_FEEL.guardGround.ms : CAMERA_FEEL.guardAir.ms, 0, 1);
      if (state.lives === 1) banners.offer('CLUTCH!', P.CLUTCH, '#8ff0ff', 30);
      else banners.offer(e.kind === 'air' ? 'AIR GUARD · COMBO KEEP' : 'GUARD!', P.NORMAL, '#8ff0ff', e.kind === 'air' ? 22 : 26, 0.6);
      break;
    }
    case 'guardRepel': {
      const y = state.guardContact?.contactY ?? guardPlaneY(state);
      audio.play('repel');
      fx.ring(lx, y, e.kind === 'ground' ? 120 : 70, 'rgba(191,243,255,.9)', 0.3, e.kind === 'ground' ? 8 : 5, 0.3);
      fx.smoke(lx, state.building?.bottomY ?? y, e.kind === 'ground' ? 6 : 3, 'rgba(232,222,204,', 0.9);
      if (e.kind === 'ground') fx.smoke(lx, GROUND_Y, 4);
      break;
    }
    case 'guardRelease': break;
    case 'danger': effects.danger = 1; audio.play('danger'); break;
    case 'lifeLost': effects.red = 1; kick(CAMERA_FEEL.damage, 0, 1); audio.play('hurt'); break;
    case 'crushed': kick(CAMERA_FEEL.damage, 0, 1); break;
    case 'buried': {
      // the building has slammed down over the hero: dust, a heavy thud, and the way out
      fx.smoke(lx, GROUND_Y, 12, 'rgba(232,222,204,', 1.2);
      kick(CAMERA_FEEL.building, 0, 1);
      audio.play('stone'); audio.play('crumble');
      showHint(t(state.lives > 0 ? "escapeHint" : "escapeLast"), 1600);
      break;
    }
    case 'buriedBreak': {
      // Z from under the rubble: the floor on top of the hero bursts and the building is blasted back up
      $('hint').classList.add('hidden');
      const fv = visual?.floors.get(e.floor.id);
      const r = floorWorldRect(e.bottomY, e.floor.height);
      if (fv) fx.burstFloor(fv.canvas, r.x, r.y - fv.padTop, r.w, r.h + fv.padTop + fv.padBottom, landmarkById(e.landmarkId).debrisPalette, material, lx, 1.3);
      fx.ring(lx, GROUND_Y - 30, 150, 'rgba(255,240,180,.95)', 0.35, 9, 0.35);
      fx.sparks(lx, GROUND_Y - 40, 14, ['#ffffff', '#fff3b0']);
      kick(CAMERA_FEEL.floor, 0, -1);
      audio.play(material); audio.play('ultBoom');
      banners.offer(lang === 'ko' ? '탈출!' : 'BREAK OUT!', P.CLUTCH, '#8ff0ff', 32, 0.6);
      break;
    }
    case 'escaped': break;
    case 'speedUp': banners.offer('SPEED UP!', P.CHAIN, '#ff9a62', 28, 0.5); break;
    case 'specialReady': audio.play('gaugeFull'); banners.offer('SPECIAL READY', P.NORMAL, '#ffcc33', 26); break;
    case 'combo': {
      const el = $('combo'); el.classList.remove('big'); void el.offsetWidth; el.classList.add('big');
      const tierText = COMBO_TIERS.find((c) => e.combo >= c.at)!;
      banners.offer(tierText.text === 'COMBO' ? `${e.combo} COMBO` : tierText.text, P.COMBO, '#ffe066', 30 + Math.min(e.combo, 100) * 0.08);
      audio.play('stinger', { pitch: 1 + COMBO_TIERS.length * 0.02 - COMBO_TIERS.indexOf(tierText) * 0.05 });
      break;
    }
    case 'special': {
      // A: charge — ring at the hero's feet, slight darkening (the building stays on screen, collision already off)
      effects.cutin = 1; effects.slashGlow = 1;
      audio.play('ultCharge');
      fx.ring(lx, GROUND_Y - 6, 160, 'rgba(255,240,180,.95)', 0.35, 10, 0.35);
      if (e.clutch) banners.offer('CLUTCH!', P.CLUTCH, '#8ff0ff', 30);
      banners.offer('FULL BREAK!', P.SPECIAL, '#fff3b0', 44, 0.9);
      fx.pop(renderer.worldW / 2, 230, `+${e.score}`, 32, '#ffe066');
      break;
    }
    case 'specialSlash': {
      // B/C: each floor bursts as the slash passes it, bottom to top (score was already paid at the start)
      const fv = visual?.floors.get(e.floor.id);
      const r = floorWorldRect(e.bottomY, e.floor.height);
      if (fv) fx.burstFloor(fv.canvas, r.x, r.y - fv.padTop, r.w, r.h + fv.padTop + fv.padBottom, landmarkById(e.landmarkId).debrisPalette, material, lx, 1.25);
      fx.sparks(lx, e.bottomY - e.floor.height / 2, 8, ['#ffffff', '#fff3b0', '#bff3ff']);
      if (e.index === 0) { audio.play('ultBoom'); kick(CAMERA_FEEL.special, 0, 1); }
      else { audio.play(material, { pitch: 1 + e.index * 0.03 }); kick({ amp: 2.5, ms: 60 }, (e.index % 2 ? 1 : -1) * 0.4, 1); }
      break;
    }
    case 'specialFinish': {
      // D: the top — the biggest blast and a radial shockwave
      fx.ring(lx, e.topY, 260, 'rgba(255,240,180,.95)', 0.5, 12, 0.45);
      fx.sparks(lx, e.topY, 22, ['#ffffff', '#ffe066', '#ff8a1f']);
      effects.flash = 0.35;
      audio.play('ultBoom'); audio.play('finish');
      kick(CAMERA_FEEL.building, 0, -1);
      break;
    }
    case 'wave': {
      visual = buildVisual(e.building, renderer.worldW, renderer.scale);
      const asset = landmarkById(e.building.landmarkId).asset;
      if (visual.fallback) void loadImage(asset).then((img) => { // art still on its way: swap it in once it arrives
        if (img && state.building?.id === e.building.id && state.building) visual = buildVisual(state.building, renderer.worldW, renderer.scale);
      });
      bgLandmark = e.building.landmarkId;
      if (e.building.elite) banners.offer('WARNING · ELITE', P.CHAIN, '#ffcc33', 30, 0.6);
      if (tutorialActive && hintStep === 0) { hintStep = 1; showHint(t('hint1'), 1800); }
      break;
    }
    case 'stageClear': {
      const res = story.commitClear(e.attemptId, e.level, e.score, e.maxCombo, e.livesLeft);
      if (!res) break; // already committed (a duplicate callback never unlocks twice)
      pendingUnlockAnim = res.newlyUnlocked;
      if (!save.tutorialSeen) { save.tutorialSeen = true; writeSave(save); }
      audio.play('finish');
      $('clear-title').textContent = `${t('level').toUpperCase()} ${String(e.level).padStart(2, '0')} ${t('stageClear')}`;
      $('clear-stars').textContent = '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars);
      $('clear-score').textContent = e.score.toLocaleString();
      $('clear-combo').textContent = `×${e.maxCombo}`;
      $('clear-lives').textContent = '♥'.repeat(e.livesLeft);
      $('clear-unlock').textContent = res.newlyUnlocked ? tf('unlockedNew', { n: res.newlyUnlocked }) : '';
      $('clear-unlock').classList.toggle('hidden', !res.newlyUnlocked);
      $('clear-world').classList.toggle('hidden', e.level !== STORY_LEVELS);
      $('clear-save').classList.toggle('hidden', res.saved);
      $('btn-next').classList.toggle('hidden', e.level >= STORY_LEVELS);
      showOverlay('ov-clear');
      (e.level >= STORY_LEVELS ? $('btn-clear-map') : $('btn-next')).focus();
      break;
    }
    case 'stageFailed': {
      audio.play('gameOver');
      $('fail-title').textContent = `${t('level').toUpperCase()} ${String(e.level).padStart(2, '0')} ${t('stageFailed')}`;
      $('fail-progress').textContent = tf('destroyedOf', { a: e.wavesCleared, n: e.waveCount });
      $('fail-score').textContent = e.score.toLocaleString();
      $('fail-combo').textContent = `×${e.maxCombo}`;
      window.setTimeout(() => { if (state.phase === 'GAME_OVER') { showOverlay('ov-fail'); $('btn-fail-retry').focus(); } }, 600);
      break;
    }
    case 'gameOver': {
      if (state.mode === 'story') break; // the story result screens handle it
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
// Gameplay advances in fixed 1/60 s steps (and pauses itself during hit-stop); effects run on real time so
// sparks, shake and debris keep moving through a hit-stop (v2 §11.2).
let acc = 0;
let lastFrame = performance.now();
let effectClock = 0;
const MAX_STEPS = 5;

function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)); // clamp: no runaway after a background tab
  lastFrame = now;
  const running = state.phase !== 'PAUSED' && state.phase !== 'TITLE' && state.phase !== 'BOOT';
  if (running) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      tick(state, STEP, input.take());
      for (const e of takeEvents(state)) onEvent(e);
      banners.flush();
      acc -= STEP; steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    effectClock += dt * 1000;
    fx.update(dt);
    camera.update(dt * 1000);
    banners.update(dt);
    for (let i = pendingBursts.length - 1; i >= 0; i--) if (effectClock >= pendingBursts[i].at) { pendingBursts[i].fn(); pendingBursts.splice(i, 1); }
    effects.flash = Math.max(0, effects.flash - dt * 4);
    effects.red = Math.max(0, effects.red - dt * 2.5);
    effects.danger = Math.max(0, effects.danger - dt * 1.6);
    effects.recoilMs = Math.max(0, effects.recoilMs - dt * 1000);
    effects.recoil = DEBRIS_FEEL.recoilUnits * Math.sin((effects.recoilMs / DEBRIS_FEEL.recoilMs) * Math.PI) * (effects.recoilMs > 0 ? 1 : 0);
    effects.cutin = Math.max(0, effects.cutin - dt * 3.2); // a brief band only: the slash itself is the show
    // the camera follows the special's slash up the building (and comes back during the return)
    const q = state.phase === 'SPECIAL' ? state.specialSeq : null;
    const panTarget = q && !q.finished ? Math.max(0, Math.min(420, 120 - q.slashY)) : 0;
    effects.panY += (panTarget - effects.panY) * Math.min(1, dt * (panTarget > effects.panY ? 14 : 7));
    effects.slashGlow = q ? 1 : Math.max(0, effects.slashGlow - dt * 4);
    if (keyGuideMs > 0) { keyGuideMs -= dt * 1000; if (keyGuideMs <= 0) $('keyguide').classList.add('faded'); }
    // tutorial hint 3: when the building first gets close
    if (tutorialActive && !hint3Shown && hintStep >= 1 && state.building && state.building.bottomY > DANGER_Y - 110 && state.phase === 'PLAYING') {
      hint3Shown = true; showHint(t('hint3'), 2000);
    }
    if (hintTimer > 0) { hintTimer -= dt * 1000; if (hintTimer <= 0) $('hint').classList.add('hidden'); }
    updateHud();
  } else input.take();

  const b = state.building;
  const fxState: FrameFx = {
    camera, banners, recoil: effects.recoil, danger: effects.danger, debug: debugFeel, debugContact, panY: effects.panY, slashGlow: effects.slashGlow,
    flash: effects.flash, redFlash: effects.red, cutin: effects.cutin, reducedMotion: reducedMotion || save.effectsLow,
    countdown: state.phase === 'COUNTDOWN' ? state.countdown : null,
    waveCard: state.phase === 'WAVE_TRANSITION' && b ? {
      name: landmarkById(b.landmarkId).names[lang], elite: b.elite,
      eliteLabel: state.story ? t('finalBuilding') : 'ELITE',
      k: 1 - state.phaseMs / (state.story && b.elite ? BALANCE.finalIntroMs : state.buildingIndex <= 3 ? BALANCE.waveGapMs : BALANCE.waveGapFastMs),
      sub: state.story
        ? `${t('level').toUpperCase()} ${state.story.level} · ${state.story.waveIndex + 1} / ${state.story.waveCount} · ${b.floors.length} ${t('floors')}`
        : `${landmarkById(b.landmarkId).names.en.toUpperCase()} · ${b.floors.length} ${t('floors')} · TIER ${b.tier}`,
    } : null,
    story: storyStage(state) ? {
      stage: storyStage(state)!, waveIndex: state.story!.waveIndex,
      intro: state.phase === 'COUNTDOWN' ? 1 - state.phaseMs / BALANCE.stageIntroMs : null,
      title: storyStage(state)!.title[lang], goal: tf('goalN', { n: state.story!.waveCount }), keys: state.story!.level === 1 ? t('level1Keys') : '',
      levelLabel: t('level').toUpperCase(),
    } : null,
    showHp: save.showHpNumbers,
  };
  renderer.draw(state, visual, fx, fxState, state.phase === 'TITLE' ? now : state.timeMs, bgLandmark);
  if (debugFeel) debugTick();
  requestAnimationFrame(frame);
}
let debugTick = () => {};

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
  onLangChange(() => { syncSound(); last.lang = ''; renderKeyGuide(); });
  renderKeyGuide();
  const click = (id: string, fn: () => void) => $(id).addEventListener('click', () => { audio.unlock(); fn(); });
  click('btn-start', begin);
  click('btn-restart', begin);
  click('btn-home', toMap);
  click('btn-quit', () => { resume(state); toMap(); });
  click('btn-pause-map', () => { resume(state); toMap(); });
  click('btn-pause-retry', () => { resume(state); playStory(currentLevel); });
  click('btn-next', () => { toMap(); });
  click('btn-clear-retry', () => playStory(currentLevel));
  click('btn-clear-map', toMap);
  click('btn-fail-retry', () => playStory(currentLevel));
  click('btn-fail-map', toMap);
  click('btn-reset-story', () => {
    if (!window.confirm(t('resetConfirm'))) return;
    story.reset();
    $('ov-help').classList.add('hidden');
    toMap();
  });
  click('btn-resume', doResume);
  click('btn-pause', doPause);
  click('btn-keys', doPause); // the full key list lives in the pause menu
  click('btn-mute', toggleSound);
  click('btn-sound', toggleSound);
  click('btn-pause-sound', toggleSound);
  click('btn-help', () => {
    $<HTMLInputElement>('opt-tutorial').checked = !save.tutorialSeen;
    $<HTMLInputElement>('opt-hp').checked = save.showHpNumbers;
    $<HTMLInputElement>('opt-fx').checked = save.effectsLow;
    $('ov-help').classList.remove('hidden');
  });
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => $(b.dataset.close!).classList.add('hidden')));
  $<HTMLInputElement>('opt-tutorial').addEventListener('change', (e) => { save.tutorialSeen = !(e.target as HTMLInputElement).checked; writeSave(save); });
  $<HTMLInputElement>('opt-hp').addEventListener('change', (e) => { save.showHpNumbers = (e.target as HTMLInputElement).checked; writeSave(save); });
  $<HTMLInputElement>('opt-fx').addEventListener('change', (e) => { save.effectsLow = (e.target as HTMLInputElement).checked; writeSave(save); applyEffectsLevel(); });
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
    const onOver = state.phase === 'GAME_OVER' && !$('ov-over').classList.contains('hidden');
    if (onOver) begin();
  });
  // the level intro can always be skipped
  const skip = () => { if (state.phase === 'COUNTDOWN' && state.mode === 'story') skipIntro(state); };
  addEventListener('keydown', (e) => { if (!e.repeat && $('ov-map').classList.contains('hidden')) skip(); });
  $('view').addEventListener('pointerdown', skip);
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 150));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state.phase !== 'PAUSED') doPause(); audio.suspend(); } else audio.resume(); });
  addEventListener('blur', () => { if (state.phase !== 'PAUSED') doPause(); });
}

const worldMap = new WorldMap($('ov-map'), {
  onPlay: (level) => playStory(level),
  onEndless: () => begin(),
  onSettings: () => {
    $<HTMLInputElement>('opt-tutorial').checked = !save.tutorialSeen;
    $<HTMLInputElement>('opt-hp').checked = save.showHpNumbers;
    $<HTMLInputElement>('opt-fx').checked = save.effectsLow;
    $('ov-help').classList.remove('hidden');
  },
});

async function boot() {
  bind();
  applyEffectsLevel();
  if (debugFeel) debugTick = mountDebugPanel({ state, eventLog, camera, fx, startTest: () => { if (state.phase === 'TITLE' || state.phase === 'GAME_OVER') begin(); } });
  syncSound();
  layout();
  // the world map shows at once; images stream in, and any that fail are drawn with fallback shapes
  toMap();
  if (story.corrupted) worldMap.setNote(t('saveCorrupt'));
  // ?level=N goes straight into a level — but only one that is unlocked
  const want = Number(params.get('level'));
  if (params.has('level') && canEnterStoryLevel(want, story.progress)) playStory(want);
  requestAnimationFrame((n) => { lastFrame = n; frame(n); });
  const srcs = [...new Set([...LANDMARKS.flatMap((l) => [l.asset, l.background]), ...STORY_STAGES.map((st) => st.plate)]), 'assets/fx/special_cutin.webp', ...Object.values(NINJA_SPRITES)];
  await preload(srcs);
  if (!imageNow(LANDMARKS[0].background)) console.warn('background art missing: using drawn fallbacks');
}

void boot();
(window as unknown as { __wb?: unknown }).__wb = { state, renderer, save, story, playStory, toMap }; // QA hook for automated playtests
