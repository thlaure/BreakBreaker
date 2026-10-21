import type Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import { DEPTH } from './depth';

/** Bar body (outline included) in world px at scale 1; the heart sits to its left. */
export const HEALTH_BAR_W = 28;
export const HEALTH_BAR_H = 5;
/** Bottom of the bar above Paul's feet (just over his head, under a carried toolbox). */
const LIFT = 46;
const HEART_GAP = 1;
const INK = 0x14121c;
const TRACK = 0x3a3448;
const HEART = 0xff7b72;
const HEART_ALPHA = 0.75;
/** White flash and 1-px shake on a hit. */
const FLASH_MS = 120;
const SHAKE_MS = 180;
const SHAKE_STEP_MS = 45;

export const HEALTH_GREEN = 0x7bd88f;
export const HEALTH_YELLOW = 0xffd166;
export const HEALTH_RED = 0xff5a4e;

/** Fill colour of Paul's health bar: green above 50 %, yellow above 25 %, red below. */
export function healthColor(hp: number, max: number): number {
  const f = max > 0 ? hp / max : 0;
  if (f > 0.5) return HEALTH_GREEN;
  if (f > 0.25) return HEALTH_YELLOW;
  return HEALTH_RED;
}

/** Onde d’énergie charge bar under the health bar: height (outline included), gap, fill colour. */
export const CHARGE_BAR_H = 3;
const CHARGE_GAP = 1;
const CHARGE = 0x8fd3ff;

/** Filled inner pixels of the charge bar for a charge `progress` in [0, 1] (0 = none drawn). */
export function chargeFill(progress: number): number {
  const inner = HEALTH_BAR_W - 2;
  return Math.max(0, Math.min(inner, Math.round(inner * progress)));
}

/** Energy gauge bar right under the health bar (always shown): height (outline included), gap, colours. */
export const ENERGY_BAR_H = 3;
const ENERGY_GAP = 1;
export const ENERGY_CYAN = 0x5fc8ff;
export const ENERGY_GOLD = 0xffd23a;

/**
 * The world energy bar: filled inner pixels and colour. Cyan while filling (brighter once the onde is available),
 * gold when full; in mode furie it shows the time left (gold, draining over CONFIG.furie.durationSec).
 */
export function energyBar(s: Pick<Snapshot, 'energy' | 'furie'>): { fill: number; color: number } {
  const inner = HEALTH_BAR_W - 2;
  const px = (f: number): number => Math.max(0, Math.min(inner, Math.round(inner * f)));
  if (s.furie) return { fill: px(s.furie.secondsLeft / CONFIG.furie.durationSec), color: ENERGY_GOLD };
  const e = s.energy;
  const fill = px(e.max > 0 ? e.value / e.max : 0);
  return { fill, color: e.ready.furie ? ENERGY_GOLD : e.ready.onde ? 0x8fe4ff : ENERGY_CYAN };
}

/** 5×5 pixel heart, row by row ('#' = filled). */
const HEART_ROWS = ['.#.#.', '#####', '#####', '.###.', '..#..'];

/**
 * Pixel health bar over Paul's head (world space, whole-pixel coordinates, crisp under the integer camera zoom):
 * dark outline, track, coloured fill (healthColor), a faint heart on the left. It scales like the victim bubbles
 * (×2 at zoom 1) to stay readable, flashes white with a 1-px shake when Paul loses health (no shake under
 * prefers-reduced-motion) and hides while he is KO. Drawn above Paul and his props (the furie aura stays behind).
 * A thin energy bar (energyBar: cyan, gold when full or in mode furie) always sits right under it; while the onde
 * d’énergie charges, a small light-blue charge bar shows under that.
 */
export class PaulHealthBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private lastHp = Number.NaN;
  private flashUntil = 0;
  private shakeUntil = 0;
  /** Last drawn state (redraw only when it changes). */
  private drawn = '';

  constructor(
    scene: Phaser.Scene,
    private readonly reducedMotion = false,
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.overlay + 1).setVisible(false);
  }

  /** `anchor` = Paul's sprite (feet origin); the bar follows it. */
  update(s: Pick<Snapshot, 'hp' | 'hpMax' | 'player'> & Partial<Pick<Snapshot, 'charge' | 'energy' | 'furie'>>, anchor: { x: number; y: number }, nowMs: number): void {
    const g = this.g;
    const p = { hp: s.hp, ko: s.player.ko };
    const hpMax = s.hpMax;
    if (p.hp < this.lastHp) {
      this.flashUntil = nowMs + FLASH_MS;
      if (!this.reducedMotion) this.shakeUntil = nowMs + SHAKE_MS;
    }
    this.lastHp = p.hp;
    if (p.ko) {
      g.setVisible(false);
      return;
    }
    const zoom = g.scene.cameras.main.zoom || 1;
    const scale = Math.max(1, Math.round(2 / zoom));
    const shake = nowMs < this.shakeUntil ? (Math.floor(nowMs / SHAKE_STEP_MS) % 2 === 0 ? 1 : -1) : 0;
    g.setVisible(true)
      .setScale(scale)
      .setPosition(Math.round(anchor.x) + shake, Math.round(anchor.y) - LIFT);
    const inner = HEALTH_BAR_W - 2;
    const frac = hpMax > 0 ? Math.max(0, Math.min(1, p.hp / hpMax)) : 0;
    const fill = p.hp > 0 ? Math.max(1, Math.round(inner * frac)) : 0;
    const flash = nowMs < this.flashUntil;
    const color = flash ? 0xffffff : healthColor(p.hp, hpMax);
    const charge = s.charge ? chargeFill(s.charge.progress) : -1;
    const energy = s.energy ? energyBar({ energy: s.energy, furie: s.furie ?? null }) : null;
    const key = `${fill}:${color}:${charge}:${energy ? `${energy.fill}:${energy.color}` : '-'}`;
    if (key === this.drawn) return;
    this.drawn = key;
    // local origin = bottom centre of the bar
    const left = -Math.floor(HEALTH_BAR_W / 2);
    const top = -HEALTH_BAR_H;
    g.clear();
    g.fillStyle(INK, 1).fillRect(left, top, HEALTH_BAR_W, HEALTH_BAR_H);
    g.fillStyle(TRACK, 1).fillRect(left + 1, top + 1, inner, HEALTH_BAR_H - 2);
    if (fill > 0) g.fillStyle(color, 1).fillRect(left + 1, top + 1, fill, HEALTH_BAR_H - 2);
    let below = 0;
    if (energy) {
      const ey = ENERGY_GAP;
      g.fillStyle(INK, 1).fillRect(left, ey, HEALTH_BAR_W, ENERGY_BAR_H);
      g.fillStyle(TRACK, 1).fillRect(left + 1, ey + 1, inner, ENERGY_BAR_H - 2);
      if (energy.fill > 0) g.fillStyle(energy.color, 1).fillRect(left + 1, ey + 1, energy.fill, ENERGY_BAR_H - 2);
      below = ey + ENERGY_BAR_H;
    }
    if (charge >= 0) {
      const cy = below + CHARGE_GAP;
      g.fillStyle(INK, 1).fillRect(left, cy, HEALTH_BAR_W, CHARGE_BAR_H);
      g.fillStyle(TRACK, 1).fillRect(left + 1, cy + 1, inner, CHARGE_BAR_H - 2);
      if (charge > 0) g.fillStyle(CHARGE, 1).fillRect(left + 1, cy + 1, charge, CHARGE_BAR_H - 2);
    }
    const hx = left - HEART_GAP - HEART_ROWS[0]!.length;
    HEART_ROWS.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') g.fillStyle(HEART, HEART_ALPHA).fillRect(hx + x, top + y, 1, 1);
    });
  }

  destroy(): void {
    this.g.destroy();
  }
}
