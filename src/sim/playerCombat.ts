import { CONFIG } from './config';
import type { FallSource } from './falls';
import { damageOn, isTough, type DamageSource } from './hostiles';
import type { Hits } from './hits';
import { moveCircle } from './map/collide';
import { dist, inArc, len, norm, segmentCircleHit, sub, v } from './math';
import { readyStrike, sweep } from './player';
import type { Sim } from './sim';
import { beam } from './specials';
import type { InputFrame, SimEvent, Vec } from './types';
import { WEAPONS } from './weapons';

/** Paul's own attacks: the strike (swing, gant punch, flashball shot), the bouclier, the mode furie and the onde d'énergie. */
export class PlayerCombat {
  /** Onde d'énergie charge under way: seconds since the press (it runs on its own once started). */
  charge: { t: number } | null = null;
  /** The flashball guaranteed with the session's first shooter was dropped. */
  flashballGiven = false;

  constructor(
    private readonly sim: Sim,
    private readonly hits: Hits,
  ) {}

  /** How Paul's strike works now: mode furie and bare hands swing, else the held weapon's own way. */
  strikeMode(furie: boolean): 'swing' | 'punch' | 'shot' {
    const k = this.sim.weapons.held?.kind;
    if (furie || k === undefined) return 'swing';
    return WEAPONS[k].strike;
  }

  /** A swing (bare hands, a regular weapon or the mode furie) through the melee sweep. */
  swing(furie: boolean, now: number, ev: SimEvent[]): void {
    const sim = this.sim;
    // Bare hands: 1 damage. A regular weapon: KO in one hit, but CONFIG.toughWeaponDamage on a brute or the Caïd.
    // Mode furie: KO in one hit (CONFIG.caid.damageFrom.furie on the Caïd), more targets, the weapon is not used,
    // every KO is launched. The bouclier changes nothing.
    const source: DamageSource = furie ? 'furie' : sim.weapons.held ? 'weapon' : 'hands';
    const fall: FallSource = furie ? 'furie' : (sim.weapons.held?.kind ?? 'hands');
    const maxTargets = furie ? CONFIG.furie.maxTargets : CONFIG.melee.maxTargets;
    const { hits } = sweep(sim.player, now, sim.horde.views(), sim.grid, sim.weapons.range(), maxTargets);
    for (const id of hits) {
      const tough = this.hits.tough(id);
      const damage = this.hits.damageTo(id, source);
      ev.push(
        tough
          ? { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee', heavy: true }
          : { type: 'HitConfirmed', targetLifeId: id, damage, source: 'melee' },
      );
      this.hits.hit(id, damage, ev, fall);
    }
    if (!furie) ev.push(...sim.weapons.onSwing(hits.length));
  }

  /**
   * Flashball: one shot (strike cooldown as a swing) along the mouse aim; without one, along the facing snapped to the
   * nearest active rioter within ±assistDeg and assistRange with a clear line. The shot is used whether it hits or not.
   */
  fireFlashball(input: InputFrame, now: number, ev: SimEvent[]): void {
    const sim = this.sim;
    const p = sim.player;
    if (!readyStrike(p, now)) return;
    let dir = norm(input.aim && len(input.aim) > 0 ? input.aim : p.facing);
    if (!input.aim || len(input.aim) === 0) {
      const c = CONFIG.flashball;
      let best: { pos: Vec; d: number; id: number } | null = null;
      for (const h of sim.horde.list) {
        if (h.state === 'ko') continue;
        if (!inArc(p.pos, dir, h.pos, c.assistRange, c.assistDeg * 2) || !sim.grid.lineClear(p.pos, h.pos)) continue;
        const d = dist(p.pos, h.pos);
        if (!best || d < best.d || (d === best.d && h.lifeId < best.id)) best = { pos: h.pos, d, id: h.lifeId };
      }
      if (best && best.d > 1e-6) dir = norm(sub(best.pos, p.pos));
    }
    p.facing = dir;
    const shot = sim.bullets.shoot(p.pos, dir);
    ev.push({ type: 'FlashballFired', id: shot.id, from: v(p.pos), dir: v(dir) });
    ev.push(...sim.weapons.onShot());
  }

  /**
   * Gant de boxe: a straight punch of CONFIG.gant.reach px along the facing (the aim), cut at the first solid (the
   * peaceful group included) or the victim. The first active rioter on it takes a weapon hit and is pushed
   * CONFIG.gant.knockback px along the punch (a KO body is launched); a use is spent only on a hit.
   */
  punch(now: number, ev: SimEvent[]): void {
    const sim = this.sim;
    const p = sim.player;
    if (!readyStrike(p, now)) return;
    const dir = norm(p.facing);
    const reach = CONFIG.gant.reach;
    let to = { ...p.pos };
    for (let s = 2; s <= reach; s += 2) {
      const q = { x: p.pos.x + dir.x * s, y: p.pos.y + dir.y * s };
      if (sim.grid.isSolidPx(q)) break;
      to = q;
    }
    const vp = sim.rescue?.stage === 'threat' ? sim.rescue.victimPos : null;
    const vt = vp ? segmentCircleHit(p.pos, to, vp, 8) : null;
    if (vt !== null) to = { x: p.pos.x + (to.x - p.pos.x) * vt, y: p.pos.y + (to.y - p.pos.y) * vt };
    let best: { id: number; t: number } | null = null;
    for (const h of sim.horde.views()) {
      if (!h.active) continue;
      const t = segmentCircleHit(p.pos, to, h.pos, h.r);
      if (t !== null && (!best || t < best.t || (t === best.t && h.lifeId < best.id))) best = { id: h.lifeId, t };
    }
    if (!best) {
      ev.push({ type: 'GlovePunched', from: v(p.pos), to: v(to), lifeId: null });
      return;
    }
    const h = sim.horde.list.find((x) => x.lifeId === best!.id)!;
    ev.push({ type: 'GlovePunched', from: v(p.pos), to: v(h.pos), lifeId: h.lifeId });
    const tough = isTough(h.role);
    const damage = damageOn(h.role, 'weapon');
    ev.push(
      tough
        ? { type: 'HitConfirmed', targetLifeId: h.lifeId, damage, source: 'gant', heavy: true }
        : { type: 'HitConfirmed', targetLifeId: h.lifeId, damage, source: 'gant' },
    );
    const k = CONFIG.gant.knockback;
    h.pos = moveCircle(sim.grid, h.pos, { x: dir.x * k, y: dir.y * k }, CONFIG.hostile.radius);
    this.hits.hit(h.lifeId, damage, ev, 'gant');
    ev.push(...sim.weapons.onSwing(1));
  }

  /** The session's first shooter walked in: a flashball dropped CONFIG.flashball.dropMin–dropMax px from Paul (once). */
  giveFlashball(ev: SimEvent[]): void {
    const c = CONFIG.flashball;
    const w = this.sim.weapons.dropNear(this.sim.player.pos, 'flashball', c.dropMin, c.dropMax);
    if (!w) return;
    this.flashballGiven = true;
    ev.push({ type: 'WeaponSpawned', kind: w.kind, pos: v(w.pos) });
    ev.push({ type: 'FlashballDropped', pos: v(w.pos) });
  }

  /** The bouclier's protection is on: its bubble blocks every rock, firebomb and bullet that would hit Paul, from any side. */
  shield(): boolean {
    return this.sim.weapons.shield() && !this.sim.player.ko;
  }

  /**
   * Furie pressed: with a full gauge (and Paul up, no mode furie already on) the whole gauge is spent and the mode
   * starts (a charge under way is cancelled at no cost); with less: EnergyRefused.
   */
  activateFurie(ev: SimEvent[]): void {
    const sim = this.sim;
    if (sim.player.ko || sim.weapons.furie()) return;
    const cost = CONFIG.energy.furieCost;
    if (!sim.energy.spend(cost)) {
      ev.push({ type: 'EnergyRefused', need: cost });
      return;
    }
    if (this.charge !== null) this.cancelCharge(ev);
    ev.push(...sim.weapons.startFurie());
  }

  /** Onde pressed: with at least ondeCost energy (and Paul up) the charge starts (BeamCharging); else EnergyRefused. */
  startCharge(ev: SimEvent[]): void {
    if (this.sim.player.ko) return;
    if (this.sim.energy.value < CONFIG.energy.ondeCost) {
      ev.push({ type: 'EnergyRefused', need: CONFIG.energy.ondeCost });
      return;
    }
    this.charge = { t: 0 };
    ev.push({ type: 'BeamCharging' });
  }

  /**
   * The charge grows on its own (Onde need not stay held: releasing it changes nothing); at CONFIG.kamehame.chargeSec
   * the beam fires and the energy is spent then. Paul KO (or, defensively, the energy gone): cancelled, nothing spent.
   */
  stepCharge(dt: number, ev: SimEvent[]): void {
    if (this.charge === null) return;
    if (this.sim.player.ko) {
      this.cancelCharge(ev);
      return;
    }
    this.charge.t += dt;
    if (this.charge.t + 1e-9 < CONFIG.kamehame.chargeSec) return;
    if (!this.sim.energy.spend(CONFIG.energy.ondeCost)) {
      this.cancelCharge(ev);
      return;
    }
    this.charge = null;
    this.fireBeam(ev);
  }

  cancelCharge(ev: SimEvent[]): void {
    this.charge = null;
    ev.push({ type: 'BeamCancelled' });
  }

  /**
   * The beam along Paul's facing: every rioter on it is KO'd (+1 each, no energy) and launched along the beam; the Caïd
   * takes CONFIG.caid.damageFrom.beam.
   */
  private fireBeam(ev: SimEvent[]): void {
    const sim = this.sim;
    const p = sim.player;
    const dir = norm(p.facing);
    const shot = beam(p.pos, dir, sim.horde.views(), sim.grid);
    let kos = 0;
    for (const id of shot.lifeIds) {
      const damage = this.hits.damageTo(id, 'beam');
      ev.push({ type: 'HitConfirmed', targetLifeId: id, damage, source: 'beam' });
      if (this.hits.hit(id, damage, ev, 'beam', dir)) kos += 1;
    }
    ev.push({ type: 'BeamFired', from: v(p.pos), to: v(shot.to), kos });
  }
}
