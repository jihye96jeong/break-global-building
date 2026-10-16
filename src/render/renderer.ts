// Canvas drawing in world units: the world is 600 tall; its width follows the screen's aspect (spec §11.1).
import { BALANCE, DANGER_Y, GROUND_Y, WORLD_H } from '../config/balance';
import { GUARD_FEEL, JUMP_FEEL, SPECIAL_SEQ } from '../config/gameFeel';
import { landmarkById } from '../config/landmarks';
import type { StoryStage } from '../story/stages';
import { attackSurfaceY, guardPlaneY, headY, heroLanePos, motionOwner, type RunState } from '../core/game';
import type { Banners, Camera } from './camera';
import { imageNow } from './assets';
import { drawHero } from './character';
import { refreshMarks, type BuildingVisual } from './landmark';
import type { Particles } from './particles';

const SKY_GRAD: Record<string, [string, string]> = { day: ['#7cc4f2', '#d9f0ff'], sunset: ['#ff9a62', '#ffe0b0'], night: ['#0d1638', '#33407a'] };

export interface FrameFx {
  camera: Camera;
  banners: Banners;
  recoil: number; // render-only upward kick of the building after a floor break (wu)
  danger: number; // 0..1 DANGER pulse
  debug: boolean;
  debugContact: boolean;
  panY: number; // v4 special: the world slides down so the slash can be followed up to the top
  slashGlow: number;
  flash: number; // 0..1 white flash
  redFlash: number; // 0..1 hurt tint
  cutin: number; // 0..1 special cut-in strength
  waveCard: { name: string; sub: string; elite: boolean; eliteLabel?: string; k: number } | null;
  /** v5 story mode: the level's time of day, and its intro card while it shows */
  story: { stage: StoryStage; waveIndex: number; intro: number | null; title: string; goal: string; keys: string; levelLabel: string } | null;
  countdown: number | null;
  showHp: boolean;
  reducedMotion: boolean;
}

export class Renderer {
  readonly g: CanvasRenderingContext2D;
  scale = 1; // device px per world unit
  worldW = 960;
  laneGap = 120; // eased toward the current building's lane spacing
  private cssScale = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
  }

  /** Recompute pixel mapping only; world state never changes on resize (spec §14.3). */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.cssScale = r.height / WORLD_H;
    this.scale = this.cssScale * dpr;
    this.worldW = r.width / this.cssScale;
  }

  /** Works for fractional lanes too: the hero mid-slide is drawn at exactly the position the contact test uses. */
  laneX(lane: number) { return this.worldW / 2 + (lane - 1) * this.laneGap; }

  /** Screen (CSS px) x → lane index, for touch lane taps. */
  laneAtClientX(clientX: number): 0 | 1 | 2 {
    const r = this.canvas.getBoundingClientRect();
    const wx = (clientX - r.left) / this.cssScale;
    const d = (wx - this.worldW / 2) / this.laneGap;
    return (d < -0.5 ? 0 : d > 0.5 ? 2 : 1);
  }

  draw(s: RunState, visual: BuildingVisual | null, fx: Particles, f: FrameFx, time: number, bgLandmarkId: string) {
    const g = this.g;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.save();
    g.translate(f.camera.x, f.camera.y + f.panY); // world layer only: hero and building shake (and pan) together, HUD stays put
    if (f.story) this.drawStorySky(f.story.stage, f.story.waveIndex, s, time);
    else this.drawBackground(bgLandmarkId);

    const b = s.building;
    if (visual) this.laneGap += (visual.width / 3 - this.laneGap) * 0.2;
    if (b && visual && visual.buildingId === b.id && !b.defeated) {
      g.save(); g.translate(0, -f.recoil);
      this.drawBuilding(s, visual, time, f.showHp);
      g.restore();
    }

    const p = s.player;
    const x = this.laneX(heroLanePos(p));
    if (s.phase === 'SPECIAL' && s.specialSeq) this.drawSpecialSlash(s, x, time, f.reducedMotion);
    fx.draw(g);
    const invuln = s.invulnMs > 0 && s.phase !== 'SPECIAL';
    const c = s.guardContact;
    const guardK = c ? Math.min(1, c.phaseMs / (s.guardPhase === 'HOLD' ? GUARD_FEEL.holdMs[c.kind] : s.guardPhase === 'REPEL' ? GUARD_FEEL.repelMs[c.kind] : GUARD_FEEL.releaseBlendMs)) : 0;
    const ceiling = b && !b.defeated ? Math.max(0, GROUND_Y - p.y - b.bottomY) : Infinity;
    // rising speed lines and falling streaks
    if (p.y > 20 && !f.reducedMotion) {
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
      const n = p.vy > 0 ? 2 : p.vy < -400 ? 4 : 0;
      for (let i = 0; i < n; i++) { const ox = (i - (n - 1) / 2) * 12; const top = GROUND_Y - p.y + (p.vy > 0 ? 6 : -BALANCE.heroHeight - 26); g.beginPath(); g.moveTo(x + ox, top); g.lineTo(x + ox, top + 22); g.stroke(); }
    }
    // pressure near the hero when the building is about to land on them
    if (b && !b.defeated && s.phase === 'PLAYING' && DANGER_Y - b.bottomY < 40 && s.guardPhase !== 'HOLD' && s.guardPhase !== 'REPEL') {
      g.strokeStyle = 'rgba(255,90,70,.7)'; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { const xx = x + i * 14, yy = GROUND_Y - BALANCE.heroHeight - p.y - 10 - Math.abs(i) * 3; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + i * 3, yy - 10); g.stroke(); }
    }
    // night levels: a soft light pool keeps the dark ninja readable against the dark city (render only)
    if (f.story && f.story.stage.level >= 6 && s.phase !== 'BURIED') {
      const hy = GROUND_Y - p.y - BALANCE.heroHeight / 2;
      const lg = g.createRadialGradient(x, hy, 4, x, hy, 70);
      lg.addColorStop(0, 'rgba(190,225,255,.42)'); lg.addColorStop(0.55, 'rgba(150,200,255,.16)'); lg.addColorStop(1, 'rgba(150,200,255,0)');
      g.fillStyle = lg; g.fillRect(x - 70, hy - 70, 140, 140);
    }
    if (s.phase !== 'BURIED') drawHero(g, { // buried: the hero is completely under the building
      x, y: p.y, facing: p.facing,
      attackK: p.attackAnimMs > 0 ? 1 - p.attackAnimMs / BALANCE.attackAnimMs : -1,
      variant: (p.swingCount + 2) % 3,
      guarding: p.guarding, guardPhase: s.guardPhase, guardK,
      air: p.y > 0, rising: p.vy > 0 && p.jumpElapsed < JUMP_FEEL.takeoffStretchMs / 1000, moving: p.laneAnimMs > 0, hurt: false,
      landK: p.landMs / JUMP_FEEL.landingSquashMs,
      special: this.specialLift(s),
      ceiling, time, blink: invuln && Math.floor(time / 80) % 2 === 0,
    });
    if (f.debug || f.debugContact) this.drawDebug(s, x);
    fx.drawPops(g);
    g.restore();

    // full-screen layers (no shake)
    if (f.cutin > 0) this.drawCutin(f.cutin);
    if (f.flash > 0) { g.fillStyle = `rgba(255,255,255,${(f.reducedMotion ? 0.3 : 0.75) * f.flash})`; g.fillRect(0, 0, this.worldW, WORLD_H); }
    if (f.redFlash > 0) { g.fillStyle = `rgba(220,30,40,${0.35 * f.redFlash})`; g.fillRect(0, 0, this.worldW, WORLD_H); }
    if (f.countdown) this.bigText(String(f.countdown), WORLD_H * 0.42, 120, '#ffe066');
    if (f.waveCard) this.drawWaveCard(f.waveCard);
    if (f.story && f.story.intro !== null) this.drawStageIntro(f.story);
    // banners sit just under the HUD so they never cover the weak spots
    // when a high building's underside (and the hero stuck to it) is up there, banners go below them instead
    const hb = s.building;
    let by = hb && !hb.defeated && hb.bottomY > 110 && hb.bottomY < 300 ? Math.max(hb.bottomY + 110, 330) : 168;
    for (const bn of f.banners.list) {
      const age = 1 - bn.life / bn.max;
      const sc = age < 0.15 ? 0.7 + age / 0.15 * 0.4 : age < 0.25 ? 1.1 - (age - 0.15) : 1;
      g.save(); g.globalAlpha = bn.life < 0.2 ? bn.life / 0.2 : 1;
      g.translate(this.worldW / 2, by); g.scale(sc, sc);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = `900 italic ${bn.size}px "Arial Black", Impact, system-ui, sans-serif`;
      g.lineWidth = bn.size * 0.16; g.strokeStyle = '#1b1530'; g.strokeText(bn.text, 0, 0);
      g.fillStyle = bn.color; g.fillText(bn.text, 0, 0);
      g.restore();
      by += bn.size + 8;
    }
    if (f.debugContact) this.drawContactPanel(s);
    if (f.danger > 0) {
      // small and beside the hero (world space, follows the shake): never over the HUD, hints or the building
      g.save(); g.globalAlpha = f.danger;
      g.translate(f.camera.x, f.camera.y + f.panY);
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '900 italic 20px "Arial Black", Impact, system-ui, sans-serif';
      const dx = this.laneX(heroLanePos(s.player)) + 46, dy = headY(s) - 6;
      g.lineWidth = 4; g.strokeStyle = '#1b1530'; g.strokeText('DANGER!', dx, dy);
      g.fillStyle = '#ff6b5e'; g.fillText('DANGER!', dx, dy);
      g.restore();
    }
  }

  /** Hero pose during the special: crouch on the charge, spring up with the slash, land on the return. */
  private specialLift(s: RunState) {
    const q = s.phase === 'SPECIAL' ? s.specialSeq : null;
    if (!q) return 0;
    if (q.elapsedMs < SPECIAL_SEQ.chargeMs) return 0.05;
    const after = q.elapsedMs - SPECIAL_SEQ.chargeMs - q.sweepMs;
    if (after <= 0) return Math.min(1, (q.elapsedMs - SPECIAL_SEQ.chargeMs) / 140);
    return Math.max(0, 1 - after / (SPECIAL_SEQ.finishStopMs + SPECIAL_SEQ.returnMs * 0.8));
  }

  /** v4 §7: a giant blade of light rising from the hero to the slash front, with side shock planes and a hot tip. */
  private drawSpecialSlash(s: RunState, heroX: number, time: number, reduced: boolean) {
    const q = s.specialSeq!, g = this.g;
    const charge = q.elapsedMs < SPECIAL_SEQ.chargeMs;
    const after = q.elapsedMs - SPECIAL_SEQ.chargeMs - q.sweepMs;
    const fade = after > 0 ? Math.max(0, 1 - after / (SPECIAL_SEQ.finishStopMs + SPECIAL_SEQ.returnMs * 0.7)) : 1;
    const baseY = GROUND_Y - s.player.y - 30;
    const tipY = charge ? baseY : q.slashY;
    g.save();
    // slight darkening of the world while the special runs
    g.fillStyle = `rgba(10,8,30,${0.22 * fade})`; g.fillRect(-40, -1200, this.worldW + 80, WORLD_H + 2400);
    if (charge) {
      const k = q.elapsedMs / SPECIAL_SEQ.chargeMs;
      g.strokeStyle = `rgba(255,240,180,${0.9 * k})`; g.lineWidth = 4;
      g.beginPath(); g.ellipse(heroX, GROUND_Y - 4, 30 + 50 * k, 7 + 6 * k, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      return;
    }
    const w = this.laneGap * 1.35;
    // wide shock plane
    const grd = g.createLinearGradient(heroX - w, 0, heroX + w, 0);
    grd.addColorStop(0, 'rgba(120,200,255,0)'); grd.addColorStop(0.5, `rgba(190,235,255,${0.45 * fade})`); grd.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = grd; g.fillRect(heroX - w, tipY, w * 2, baseY - tipY);
    // bright core with a slight diagonal lean, flickering
    const lean = reduced ? 0 : Math.sin(time * 0.05) * 4;
    g.globalCompositeOperation = 'lighter';
    for (const [hw, a] of [[22, 0.35], [10, 0.7], [4, 1]] as const) {
      g.fillStyle = `rgba(255,250,225,${a * fade})`;
      g.beginPath(); g.moveTo(heroX - hw - lean, baseY); g.lineTo(heroX + hw - lean, baseY); g.lineTo(heroX + hw * 0.6 + lean, tipY); g.lineTo(heroX - hw * 0.6 + lean, tipY); g.closePath(); g.fill();
    }
    // the hot front: a flare and two crack-wings racing across the building
    if (after <= 0) {
      const fl = g.createRadialGradient(heroX, tipY, 0, heroX, tipY, 70);
      fl.addColorStop(0, 'rgba(255,255,255,1)'); fl.addColorStop(0.35, 'rgba(255,230,140,.8)'); fl.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = fl; g.fillRect(heroX - 70, tipY - 70, 140, 140);
      g.strokeStyle = 'rgba(255,245,200,.95)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(heroX - this.laneGap * 1.5, tipY + 12); g.lineTo(heroX, tipY); g.lineTo(heroX + this.laneGap * 1.5, tipY + 12); g.stroke();
    }
    g.restore();
  }

  /** Thin lines in the same camera transform as the sprites: attack surface, guard surface, the lane's underside, gap. */
  private drawDebug(s: RunState, heroX: number) {
    const g = this.g;
    const b = s.building;
    const line = (y: number, x0: number, x1: number, col: string, dash: number[] = []) => {
      g.strokeStyle = col; g.setLineDash(dash); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    };
    g.save();
    g.lineWidth = 1;
    const half = this.laneGap * 0.32;
    line(attackSurfaceY(s), heroX - half, heroX + half, '#ffe14a');
    line(guardPlaneY(s), heroX - half, heroX + half, '#00e0ff', [4, 3]);
    line(DANGER_Y, 0, this.worldW, 'rgba(255,64,64,.8)', [6, 4]);
    if (b && !b.defeated && b.floors[0]) {
      const lx = this.laneX(s.player.lane);
      line(b.bottomY, lx - this.laneGap / 2, lx + this.laneGap / 2, '#7dff6a');
      g.setLineDash([]);
      g.strokeStyle = 'rgba(125,255,106,.35)';
      g.strokeRect(this.worldW / 2 - this.laneGap * 1.5, b.bottomY - b.floors[0].height, this.laneGap * 3, b.floors[0].height);
      // gap connector + number
      const gap = attackSurfaceY(s) - b.bottomY;
      g.strokeStyle = Math.abs(gap) <= 2 ? '#7dff6a' : '#ff9a62';
      g.beginPath(); g.moveTo(heroX + half + 6, attackSurfaceY(s)); g.lineTo(heroX + half + 6, b.bottomY); g.stroke();
      g.fillStyle = '#fff'; g.font = '700 10px ui-monospace, monospace'; g.textAlign = 'left';
      g.fillText(`${gap >= 0 ? '+' : ''}${gap.toFixed(1)}`, heroX + half + 10, (attackSurfaceY(s) + b.bottomY) / 2 + 3);
    }
    if (s.contact.lastEvent === 'ATTACK_HIT' && s.player.attackAnimMs > 0) { g.strokeStyle = '#7dff6a'; g.beginPath(); g.arc(heroX, attackSurfaceY(s), 3, 0, Math.PI * 2); g.stroke(); }
    if (s.guardPhase === 'HOLD' && s.guardContact) { g.strokeStyle = '#00e0ff'; g.beginPath(); g.arc(heroX, s.guardContact.contactY, 7, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  /** ?debugContact=1: the numbers that prove a hit or guard really touched (spec v3 §9). Screen space, no shake. */
  private drawContactPanel(s: RunState) {
    const g = this.g, b = s.building, c = s.contact;
    const fmt = (n: number) => (Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}wu` : '—');
    const lines = [
      `ATTACK [${c.lastEvent === 'ATTACK_HIT' ? 'HIT' : c.lastEvent === 'ATTACK_WHIFF' ? 'WHIFF' : '-'}]  lane=${s.player.lane}`,
      `Attack gap: ${b ? fmt(attackSurfaceY(s) - b.bottomY) : '—'}`,
      `Guard gap:  ${b ? fmt(guardPlaneY(s) - b.bottomY) : '—'}`,
      `Player attackSurface Y: ${attackSurfaceY(s).toFixed(1)}`,
      `Player guardSurface  Y: ${guardPlaneY(s).toFixed(1)}  head ${headY(s).toFixed(1)}`,
      `Building visibleBottom Y: ${b ? b.bottomY.toFixed(1) : '—'}`,
      `TOI: ${c.toi === null ? 'none' : c.toi.toFixed(2)}   X overlap: ${c.xOverlap}`,
      `phase ${s.phase}  guard ${s.guardPhase}  owner ${motionOwner(s)}`,
      `fall ${b ? b.velocityY.toFixed(0) : '—'} / target ${b ? b.baseSpeed.toFixed(0) : '—'}wu/s  tier ${b?.tier ?? '—'}  TTC ${b && b.baseSpeed > 0 ? Math.max(0, (guardPlaneY(s) - b.bottomY) / b.baseSpeed).toFixed(2) + 's' : '—'}`,
      `guardHeld ${s.guardHeld}  pressed ${s.guardPressedThisTick}  guards ${s.guardContacts}`,
      `life ${s.lives}  damageSeq ${s.damageSequences}  invuln ${Math.round(s.invulnMs)}ms`,
      `special floors left ${s.specialSeq ? s.specialSeq.total - s.specialSeq.exploded : '—'}`,
      `Contact ID: ${c.contactId || '—'}`,
      `Attack id: A${String(s.swingIds).padStart(5, '0')}`,
      `Last confirmed event: ${c.lastEvent || '—'}`,
    ];
    g.save();
    g.fillStyle = 'rgba(10,8,24,.78)';
    g.fillRect(8, 70, 300, lines.length * 13 + 10);
    g.fillStyle = '#d7ffe0'; g.font = '600 10.5px ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    lines.forEach((l, i) => g.fillText(l, 14, 76 + i * 13));
    g.restore();
  }

  /**
   * v5 §7: the level's time of day — palette gradient, sun or moon, the time-of-day plate, stars, and a near city
   * silhouette whose windows light up as night falls. Slight parallax with the hero; render only (no hitboxes).
   */
  private drawStorySky(st: StoryStage, waveIndex: number, s: RunState, time: number) {
    const g = this.g;
    const W = this.worldW;
    const px = (heroLanePos(s.player) - 1); // −1..1 for parallax
    const grd = g.createLinearGradient(0, 0, 0, GROUND_Y);
    grd.addColorStop(0, st.palette.skyTop); grd.addColorStop(1, st.palette.skyBottom);
    g.fillStyle = grd; g.fillRect(-20, -1200, W + 40, WORLD_H + 1240);
    const img = imageNow(st.plate);
    if (img) {
      const h = Math.max(GROUND_Y + 40, (W + 60) * (img.naturalHeight / img.naturalWidth));
      const w = h * (img.naturalWidth / img.naturalHeight);
      g.save(); g.globalAlpha = st.plateAlpha;
      g.drawImage(img, (W - w) / 2 - px * 8, GROUND_Y + 40 - h, w, h);
      g.restore();
    }
    if (st.sun) {
      const sy = 90 + (st.level - 1) * 55;
      const sg = g.createRadialGradient(W * 0.8, sy, 0, W * 0.8, sy, 90);
      sg.addColorStop(0, 'rgba(255,250,215,.95)'); sg.addColorStop(0.35, 'rgba(255,240,180,.45)'); sg.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = sg; g.fillRect(W * 0.8 - 90, sy - 90, 180, 180);
    }
    if (st.stars > 0) {
      let seed = 11;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 90 * st.stars; i++) {
        const x = rnd() * W, y = rnd() * GROUND_Y * 0.6, tw = 0.55 + 0.45 * Math.sin(time * 0.002 + i);
        g.fillStyle = `rgba(255,255,255,${(0.35 + 0.5 * rnd()) * tw})`;
        g.fillRect(x - px * 3, y, 1.6, 1.6);
      }
    }
    if (st.moon && !img) { // the night plates have their own moon
      g.fillStyle = '#f4f1dc'; g.beginPath(); g.arc(W * 0.16, 80, 24, 0, Math.PI * 2); g.fill();
      g.fillStyle = st.palette.skyTop; g.beginPath(); g.arc(W * 0.16 + 10, 74, 21, 0, Math.PI * 2); g.fill();
    }
    // near skyline with lit windows (from twilight on); a touch darker with every wave of the level
    if (st.windowLights > 0) {
      let seed = 3 + st.level;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      let x = -30 - px * 14;
      while (x < W + 30) {
        const w = 26 + rnd() * 40, h = 40 + rnd() * 90;
        g.fillStyle = 'rgba(12,14,36,.82)'; g.fillRect(x, GROUND_Y - h, w, h);
        for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 6; wy += 11) for (let wx = x + 5; wx < x + w - 5; wx += 9) if (rnd() < st.windowLights * 0.55) { g.fillStyle = 'rgba(255,214,120,.85)'; g.fillRect(wx, wy, 4, 5); }
        x += w + 3;
      }
    }
    const dim = waveIndex / Math.max(1, st.waveCount) * 0.05;
    if (dim > 0) { g.fillStyle = `rgba(5,8,30,${dim})`; g.fillRect(-20, -1200, W + 40, GROUND_Y + 1200); }
    const ground = g.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
    const night = st.level >= 6;
    ground.addColorStop(0, night ? '#5c5a78' : '#d9cdb5'); ground.addColorStop(0.25, night ? '#3d3a58' : '#9b8b78'); ground.addColorStop(1, '#22203a');
    g.fillStyle = ground; g.fillRect(-20, GROUND_Y, W + 40, WORLD_H - GROUND_Y + 20);
    g.fillStyle = '#1b1530'; g.fillRect(-20, GROUND_Y - 1.5, W + 40, 3);
  }

  /** v5 §8.1: LEVEL 05 / 10, the title, the goal, READY → BREAK IT! (skippable). */
  private drawStageIntro(i: { stage: StoryStage; intro: number | null; title: string; goal: string; keys: string; levelLabel: string }) {
    const g = this.g, k = i.intro ?? 1;
    const a = k < 0.12 ? k / 0.12 : k > 0.88 ? (1 - k) / 0.12 : 1;
    g.save(); g.globalAlpha = Math.max(0, a);
    g.fillStyle = 'rgba(16,12,36,.62)'; g.fillRect(0, WORLD_H * 0.24, this.worldW, i.keys ? 210 : 180);
    const y0 = WORLD_H * 0.24;
    this.bigText(`${i.levelLabel} ${String(i.stage.level).padStart(2, '0')} / 10`, y0 + 30, 22, '#ffe066');
    this.bigText(i.title, y0 + 74, 38, '#ffffff');
    this.bigText(i.goal, y0 + 114, 18, '#d8d2ff');
    this.bigText(k < 0.6 ? 'READY' : 'BREAK IT!', y0 + 152, 26, k < 0.6 ? '#8ff0ff' : '#ffcc33');
    if (i.keys) this.bigText(i.keys, y0 + 190, 14, '#ffffff');
    g.restore();
  }

  private drawBackground(landmarkId: string) {
    const g = this.g;
    const l = landmarkById(landmarkId);
    const [a, b] = SKY_GRAD[l.sky];
    const grd = g.createLinearGradient(0, 0, 0, GROUND_Y);
    grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(-20, -20, this.worldW + 40, WORLD_H + 40);
    const img = imageNow(l.background);
    if (img) {
      const h = Math.max(GROUND_Y + 40, (this.worldW + 20) * (img.naturalHeight / img.naturalWidth));
      const w = h * (img.naturalWidth / img.naturalHeight);
      g.drawImage(img, (this.worldW - w) / 2, GROUND_Y + 40 - h, w, h);
    }
    const ground = g.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
    ground.addColorStop(0, '#d9cdb5'); ground.addColorStop(0.25, '#9b8b78'); ground.addColorStop(1, '#3a3352');
    g.fillStyle = ground; g.fillRect(-20, GROUND_Y, this.worldW + 40, WORLD_H - GROUND_Y + 20);
    g.fillStyle = '#1b1530'; g.fillRect(-20, GROUND_Y - 1.5, this.worldW + 40, 3);
  }

  private drawBuilding(s: RunState, v: BuildingVisual, time: number, showHp: boolean) {
    const g = this.g;
    const b = s.building!;
    const x0 = this.worldW / 2 - v.width / 2;
    // danger: red glow on the ground as the building nears it
    const gap = GROUND_Y - b.bottomY;
    if (gap < 140) {
      const k = Math.max(0, 1 - gap / 140);
      const grd = g.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
      grd.addColorStop(0, 'rgba(255,50,40,0)'); grd.addColorStop(1, `rgba(255,50,40,${0.55 * k})`);
      g.fillStyle = grd; g.fillRect(x0 - 20, GROUND_Y - 60, v.width + 40, 60);
    }
    if (b.elite) {
      g.save();
      g.shadowColor = `rgba(255,200,60,${0.6 + 0.3 * Math.sin(time * 0.008)})`; g.shadowBlur = 24;
    }
    let bottom = b.bottomY;
    for (const f of b.floors) {
      const fv = v.floors.get(f.id);
      if (!fv) { bottom -= f.height; continue; }
      refreshMarks(v, f, this.scale, time);
      const top = bottom - f.height;
      const y = top - fv.padTop, h = f.height + fv.padTop + fv.padBottom;
      const lowest = f === b.floors[0];
      if (lowest) { g.save(); g.beginPath(); g.rect(x0 - 40, top - fv.padTop - 2, v.width + 80, b.bottomY - top + fv.padTop + 2); g.clip(); } // nothing drawn below the collision line
      g.drawImage(fv.canvas, x0, y, v.width, h);
      g.drawImage(fv.marks, x0, y, v.width, h);
      if (lowest) g.restore();
      bottom = top;
    }
    if (b.elite) g.restore();

    // lane chips under the current lowest floor: what each lane takes to break
    const f0 = b.floors[0];
    if (!f0 || b.collisionDisabled) return;
    // v3 VIS-01: a solid underside beam across all three lanes, its lower edge exactly on the collision line, so the
    // surface the blade meets is always visible even where the landmark art is narrow or transparent
    const bx = this.worldW / 2 - this.laneGap * 1.5, bw = this.laneGap * 3, beam = 6;
    g.fillStyle = v.floors.get(f0.id)?.color ?? '#8a8378';
    g.fillRect(bx, b.bottomY - beam, bw, beam);
    g.fillStyle = 'rgba(20,16,40,.55)';
    g.fillRect(bx, b.bottomY - 2, bw, 2);
    g.strokeStyle = '#1b1530'; g.lineWidth = 1.5;
    g.strokeRect(bx, b.bottomY - beam, bw, beam);
    for (let lane = 0; lane < 3; lane++) {
      const hp = f0.hp[lane];
      // inside the lowest floor, just above its underside: the guard contact point stays clear
      const cx = this.laneX(lane), cy = b.bottomY - 16;
      const w = Math.min(46, this.laneGap * 0.7), h = 14;
      const col = hp === 1 ? '#ffd84a' : hp === 2 ? '#e9eef7' : '#5d6f94';
      const active = s.player.lane === lane;
      g.fillStyle = 'rgba(20,16,40,0.75)';
      g.beginPath(); g.roundRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, 8); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, 6); g.fill();
      if (hp === 3) { g.strokeStyle = '#e2b54a'; g.lineWidth = 2; g.stroke(); }
      // pips: one per hit still needed
      g.fillStyle = hp === 3 ? '#e2b54a' : '#1b1530';
      for (let k = 0; k < hp; k++) { g.beginPath(); g.arc(cx + (k - (hp - 1) / 2) * 9, cy, 2.6, 0, Math.PI * 2); g.fill(); }
      if (hp === 1) { g.strokeStyle = '#1b1530'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - w / 2 + 4, cy - 3); g.lineTo(cx - 6, cy + 3); g.lineTo(cx - 2, cy - 2); g.stroke(); }
      if (active) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 10); g.stroke(); }
      if (showHp) { g.fillStyle = '#fff'; g.font = '900 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`HP${hp}`, cx, cy - 12); }
    }
  }

  private drawCutin(k: number) {
    const g = this.g;
    const img = imageNow('assets/fx/special_cutin.webp');
    g.save();
    g.globalAlpha = Math.min(1, k * 1.4) * 0.85;
    const bandH = WORLD_H * 0.34, y = WORLD_H * 0.3;
    if (img) g.drawImage(img, 0, y, this.worldW, bandH);
    else { const grd = g.createLinearGradient(0, y, this.worldW, y + bandH); grd.addColorStop(0, '#1d1a5a'); grd.addColorStop(0.5, '#cfe8ff'); grd.addColorStop(1, '#1d1a5a'); g.fillStyle = grd; g.fillRect(0, y, this.worldW, bandH); }
    g.restore();
    this.bigText('FULL BREAK!', y + bandH / 2, 72, '#fff3b0', -0.08);
  }

  private drawWaveCard(c: { name: string; sub: string; elite: boolean; eliteLabel?: string; k: number }) {
    const g = this.g;
    const a = c.k < 0.2 ? c.k / 0.2 : c.k > 0.8 ? (1 - c.k) / 0.2 : 1;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(20,16,40,0.55)';
    g.fillRect(0, WORLD_H * 0.36, this.worldW, 96);
    g.restore();
    g.save(); g.globalAlpha = a;
    if (c.elite) this.bigText(c.eliteLabel ?? 'ELITE', WORLD_H * 0.36 + 18, 20, '#ffcc33');
    this.bigText(c.name, WORLD_H * 0.36 + 52, 40, '#ffffff');
    this.bigText(c.sub, WORLD_H * 0.36 + 82, 15, '#d8d2ff');
    g.restore();
  }

  bigText(text: string, y: number, size: number, color: string, rot = 0) {
    const g = this.g;
    g.save();
    g.translate(this.worldW / 2, y); g.rotate(rot);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
    g.lineWidth = size * 0.16; g.strokeStyle = '#1b1530'; g.strokeText(text, 0, 0);
    g.fillStyle = color; g.fillText(text, 0, 0);
    g.restore();
  }
}
