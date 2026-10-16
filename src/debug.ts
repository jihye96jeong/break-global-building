// Developer-only feel panel: ?debugFeel=1. Live sliders for the feel config, scenario buttons and an event log.
// Never shown to players (only mounted when the query flag is present).
import { BALANCE, DANGER_Y } from './config/balance';
import { ATTACK_FEEL, CAMERA_FEEL, GUARD_FEEL, HITSTOP_MS, JUMP_FEEL } from './config/gameFeel';
import type { FallingBuilding, Floor, HP } from './core/building';
import { guardPlaneY, type RunState } from './core/game';
import type { Camera } from './render/camera';
import type { Particles } from './render/particles';

interface Ctx { state: RunState; eventLog: string[]; camera: Camera; fx: Particles; startTest: () => void }

export function mountDebugPanel(ctx: Ctx) {
  const panel = document.createElement('div');
  panel.id = 'debug-feel';
  panel.style.cssText = 'position:fixed;right:8px;top:70px;z-index:50;width:290px;max-height:80vh;overflow:auto;background:rgba(10,8,25,.92);color:#e9e4ff;font:12px/1.35 monospace;padding:10px;border:1px solid #6a5acd;border-radius:8px;';
  const sliders: [string, { [k: string]: unknown }, string, number, number, number][] = [
    ['jump velocity', JUMP_FEEL, 'jumpVelocity', 650, 1000, 10],
    ['gravity up', JUMP_FEEL, 'gravityAscending', 1300, 2200, 10],
    ['gravity down', JUMP_FEEL, 'gravityDescending', 1900, 3400, 10],
    ['contact look-ahead', GUARD_FEEL, 'contactLookAhead', 8, 22, 1],
    ['hit-stop hit (ms)', HITSTOP_MS, 'hit', 0, 85, 1],
    ['hit-stop floor (ms)', HITSTOP_MS, 'floor', 0, 85, 1],
    ['attack interval (ms)', BALANCE, 'attackIntervalMs', 80, 120, 1],
  ];
  const nested: [string, Record<string, number>, 'ground' | 'air', number, number][] = [
    ['hold ground (ms)', GUARD_FEEL.holdMs, 'ground', 80, 180], ['hold air (ms)', GUARD_FEEL.holdMs, 'air', 80, 180],
    ['repel ground (wu)', GUARD_FEEL.repelUnits, 'ground', 55, 110], ['repel air (wu)', GUARD_FEEL.repelUnits, 'air', 20, 55],
    ['repel ground (ms)', GUARD_FEEL.repelMs, 'ground', 120, 300], ['repel air (ms)', GUARD_FEEL.repelMs, 'air', 120, 300],
  ];
  const row = (label: string, obj: { [k: string]: unknown }, key: string, min: number, max: number, step = 1) => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:block;margin:4px 0';
    const val = document.createElement('b');
    val.textContent = String(obj[key]);
    const r = document.createElement('input');
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(obj[key]); r.style.width = '100%';
    r.oninput = () => { obj[key] = Number(r.value); val.textContent = r.value; };
    wrap.append(`${label}: `, val, r);
    panel.append(wrap);
  };
  panel.innerHTML = '<b style="color:#ffcc33">debugFeel</b><br>';
  for (const [l, o, k, a, b, st] of sliders) row(l, o, k, a, b, st);
  for (const [l, o, k, a, b] of nested) row(l, o, k, a, b);
  const shake = { m: 1 };
  row('camera ×', shake, 'm', 0, 1.3, 0.1);
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label; b.style.cssText = 'margin:3px 3px 0 0;font:11px monospace;padding:3px 6px';
    b.onclick = () => { ctx.startTest(); fn(); };
    panel.append(b);
  };
  const s = ctx.state;
  const testFloors = (hp: [HP, HP, HP][]) => hp.map((h, i): Floor => ({ id: `dbg${Date.now()}-${i}`, ordinal: i + 1, hp: [...h] as [HP, HP, HP], initialHp: h as [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3], height: 40, v0: i / hp.length, v1: (i + 1) / hp.length, segment: 'dbg' }));
  const setBottom = (y: number) => { if (s.building) { s.building.bottomY = y; s.building.velocityY = s.building.baseSpeed; } };
  btn('Jump Test', () => setBottom(-400));
  btn('Guard Ground', () => setBottom(guardPlaneY(s) - 40));
  btn('Guard Air', () => setBottom(DANGER_Y - 230));
  btn('One-Hit [1,2,3]', () => { const b = s.building as FallingBuilding | null; if (b && b.floors[0]) { b.floors[0].hp = [1, 2, 3]; b.floors[0].initialHp = [1, 2, 3]; } });
  btn('Special 100', () => { s.special = 100; });
  btn('Tier 6', () => { s.destroyedBuildings = 20; });
  void testFloors; void ATTACK_FEEL;
  const info = document.createElement('pre');
  info.style.cssText = 'white-space:pre-wrap;margin:8px 0 0;color:#bff3ff';
  panel.append(info);
  document.body.append(panel);
  return () => {
    ctx.camera.scale = shake.m;
    const b = s.building;
    info.textContent = `phase ${s.phase}  guard ${s.guardPhase}\nfeetY ${s.player.y.toFixed(1)} vy ${s.player.vy.toFixed(0)} apex ${s.player.peakY.toFixed(1)}\n` +
      `bottomY ${b ? b.bottomY.toFixed(1) : '-'} plane ${guardPlaneY(s).toFixed(1)} gap ${b ? (guardPlaneY(s) - b.bottomY).toFixed(1) : '-'}\n` +
      `freeze ${s.freezeMs.toFixed(0)}ms particles ${ctx.fx.parts.length}\ncamera cap ${CAMERA_FEEL.cap}\n---\n${ctx.eventLog.join('\n')}`;
  };
}
