import { GAME_CONFIG } from '../game/config';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const HEART = (full: boolean) =>
  `<svg viewBox="0 0 30 28" class="${full ? 'full' : 'empty'}"><path d="M15 26 C5 18 1 13 1 8 A6.5 6.5 0 0 1 15 5 A6.5 6.5 0 0 1 29 8 C29 13 25 18 15 26Z" ` +
  `fill="${full ? '#ff4a5e' : 'rgba(255,255,255,.18)'}" stroke="#1b1530" stroke-width="2.5" stroke-linejoin="round"/>` +
  (full ? '<path d="M7 9 A3 3 0 0 1 11 6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>' : '') + '</svg>';

export const pad8 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(8, '0');

export class HUD {
  private last = { lives: -1, score: -1, gauge: -1, guard: -1, stage: '' };
  private guardFill = $('guard-fill');
  private guardEl = $('guard');
  private hearts = $('hearts');
  private score = $('score');
  private gaugeEl = $('gauge');
  private gaugeFill = $('gauge-fill');
  private gaugePct = $('gauge-pct');
  private ult = $<HTMLButtonElement>('btn-ult');
  private keybar = $('keybar');

  setStage(n: number, city: string, name: string, nameEn: string, showEnglish: boolean, bIdx = 1, bTotal = 1) {
    $('stage-no').textContent = `STAGE ${String(n).padStart(2, '0')}`;
    $('stage-city').textContent = `${city} · ${bIdx}/${bTotal}`;
    const el = $('landmark-name');
    el.textContent = name;
    if (showEnglish) { const small = document.createElement('small'); small.textContent = nameEn; el.append(small); }
  }

  update(lives: number, score: number, gauge: number, ultUsable: boolean, guard = 100) {
    const gd = Math.round(guard);
    if (gd !== this.last.guard) {
      this.guardFill.style.width = `${gd}%`;
      this.guardEl.classList.toggle('low', gd < GAME_CONFIG.guardCost);
      this.last.guard = gd;
    }
    if (lives !== this.last.lives) {
      const lost = lives < this.last.lives;
      this.hearts.innerHTML = Array.from({ length: GAME_CONFIG.maxLives }, (_, i) => HEART(i < lives)).join('');
      if (lost) this.hearts.children[lives]?.classList.add('lost');
      this.last.lives = lives;
    }
    if (score !== this.last.score) {
      this.score.textContent = pad8(score);
      if (score > this.last.score && this.last.score >= 0) {
        this.score.classList.remove('bump'); void this.score.offsetWidth; this.score.classList.add('bump');
      }
      this.last.score = score;
    }
    const g = Math.round(gauge);
    if (g !== this.last.gauge) {
      this.gaugeFill.style.width = `${g}%`;
      this.gaugePct.textContent = `${g}%`;
      this.gaugeEl.classList.toggle('full', g >= 100);
      this.last.gauge = g;
    }
    this.ult.disabled = !ultUsable;
    this.keybar.classList.toggle('ready', ultUsable);
  }

  show(on: boolean) {
    for (const id of ['hud', 'gauge', 'guard', 'controls', 'keybar']) $(id).classList.toggle('hidden', !on);
  }
}
