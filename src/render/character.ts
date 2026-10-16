// The hero: a deliberately simple blue stick figure with a sword, drawn in code.
import { BALANCE, GROUND_Y } from '../config/balance';
import { imageNow } from './assets';

/** xAI-generated ninja poses (development time, static files). The stick figure below is the fallback. */
export const NINJA_SPRITES = {
  idle: 'assets/characters/ninja_idle.webp',
  attack: 'assets/characters/ninja_attack.webp',
  jump: 'assets/characters/ninja_jump.webp',
  guard: 'assets/characters/ninja_guard.webp',
  hurt: 'assets/characters/ninja_hurt.webp',
};
const NINJA_H = 96; // world units, giant sword included

const BLUE = '#2f6bff';
const INK = '#14123a';

export interface HeroPose {
  x: number; y: number; facing: 1 | -1;
  attackK: number; // 0..1 progress of the current swing, -1 when not swinging
  guarding: boolean; air: boolean; moving: boolean; hurt: boolean;
  special: number; // 0..1 rise during the special
  time: number; blink: boolean;
}

function drawNinja(g: CanvasRenderingContext2D, p: HeroPose, lift: number): boolean {
  const pose = p.hurt ? 'hurt' : p.guarding ? 'guard' : p.attackK >= 0 || p.special > 0 ? 'attack' : p.air ? 'jump' : 'idle';
  const img = imageNow(NINJA_SPRITES[pose]);
  if (!img) return false;
  // the attack art is tall (sword overhead): scale by height so every pose reads the same size
  const h = pose === 'attack' ? NINJA_H * 1.25 : NINJA_H;
  const w = h * (img.naturalWidth / img.naturalHeight);
  const bob = pose === 'idle' ? Math.sin(p.time * 0.006) * 1.5 : 0;
  g.save();
  g.translate(p.x, GROUND_Y - lift + bob);
  g.scale(p.facing, 1);
  if (pose === 'idle' && p.moving) g.rotate(0.08);
  if (pose === 'attack' && p.attackK >= 0) g.translate(0, -Math.sin(p.attackK * Math.PI) * 6);
  g.drawImage(img, -w / 2, -h, w, h);
  g.restore();
  return true;
}

export function drawHero(g: CanvasRenderingContext2D, p: HeroPose) {
  const H = BALANCE.heroHeight;
  const lift = p.y + p.special * 70;
  const s = Math.max(0.35, 1 - lift / 200);
  g.fillStyle = 'rgba(20,20,40,0.3)';
  g.beginPath(); g.ellipse(p.x, GROUND_Y + 2, 18 * s, 4.5 * s, 0, 0, Math.PI * 2); g.fill();
  if (p.blink) return;
  if (drawNinja(g, p, lift)) return;

  const headR = H * 0.15, leg = H * 0.42, arm = H * 0.3, swordLen = H * 0.55;
  const hip = { x: 0, y: -H * 0.42 }, neck = { x: 0, y: -H * 0.74 };
  let lean = 0, lLeg = 0.15, rLeg = -0.15, lArm = -0.35, rArm = 0.5, sword = 2.2;
  if (p.guarding) { lLeg = 0.45; rLeg = -0.45; lArm = Math.PI - 0.55; rArm = -(Math.PI - 0.55); sword = Math.PI / 2; }
  else if (p.hurt) { lean = -0.35; lLeg = 0.5; rLeg = -0.2; lArm = -2.4; rArm = 2.1 + Math.sin(p.time * 0.05) * 0.5; sword = 2.6; }
  else if (p.attackK >= 0 || p.special > 0) {
    const k = p.special > 0 ? 0.6 : p.attackK; // overhead slash sweeping from front to back
    rArm = 2.0 + k * 1.6; sword = rArm; lArm = -0.6; lLeg = 0.35; rLeg = -0.1; lean = -0.1;
  } else if (p.air) { lLeg = 0.7; rLeg = -0.3; lArm = -1.2; rArm = 2.4; sword = 2.6; }
  else if (p.moving) { const sw = Math.sin(p.time * 0.03); lean = 0.15; lLeg = sw * 0.7; rLeg = -sw * 0.7; lArm = -sw * 0.8; rArm = 0.9; sword = 1.9; }
  else { const b = Math.sin(p.time * 0.004) * 0.05; lArm += b; rArm -= b; }

  g.save();
  g.translate(p.x, GROUND_Y - lift);
  g.scale(p.facing, 1);
  g.rotate(lean);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const end = (from: { x: number; y: number }, a: number, len: number) => ({ x: from.x + Math.sin(a) * len, y: from.y + Math.cos(a) * len });
  const limb = (from: { x: number; y: number }, a: number, len: number) => { const e = end(from, a, len); g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(e.x, e.y); g.stroke(); };
  const shoulder = { x: neck.x, y: neck.y + H * 0.04 };
  const hand = end(shoulder, rArm, arm), tip = end(hand, sword, swordLen);
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(hand.x, hand.y); g.lineTo(tip.x, tip.y); g.stroke();
  g.strokeStyle = '#e8eef8'; g.lineWidth = 3; g.beginPath(); g.moveTo(hand.x, hand.y); g.lineTo(tip.x, tip.y); g.stroke();
  const ga = sword + Math.PI / 2;
  g.strokeStyle = '#c99a2e'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(hand.x + Math.sin(ga) * 6, hand.y + Math.cos(ga) * 6); g.lineTo(hand.x - Math.sin(ga) * 6, hand.y - Math.cos(ga) * 6); g.stroke();
  for (const [w, c] of [[9, INK], [5.5, p.hurt ? '#e0405a' : BLUE]] as const) {
    g.lineWidth = w; g.strokeStyle = c;
    limb(hip, lLeg, leg); limb(hip, rLeg, leg);
    g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(neck.x, neck.y); g.stroke();
    limb(shoulder, lArm, arm); limb(shoulder, rArm, arm);
  }
  const head = { x: neck.x + H * 0.02, y: neck.y - headR * 0.95 };
  g.fillStyle = p.hurt ? '#e0405a' : BLUE; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.arc(head.x, head.y, headR, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath(); g.arc(head.x - headR * 0.35, head.y - headR * 0.35, headR * 0.28, 0, Math.PI * 2); g.fill();
  if (p.guarding) {
    g.strokeStyle = 'rgba(143,240,255,.9)'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, neck.y - headR, H * 0.6, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  }
  g.restore();
}
