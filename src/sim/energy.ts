import { CONFIG } from './config';
import type { EnergyLevel, Role, SimEvent } from './types';

/** Energy a KO of a rioter of `role` brings (CONFIG.energy.gain). */
export function energyGain(role: Role): number {
  const g = CONFIG.energy.gain;
  return role === 'boss' ? g.boss : role === 'brute' ? g.brute : g.rioter;
}

/**
 * The energy gauge (« mana »): 0..CONFIG.energy.max, filled by KOs (`gain`), spent by the mode furie and the onde
 * d’énergie (`spend`). No decay. EnergyReady is emitted each time the value rises to a threshold from below it (once per
 * fill cycle: spending back under the threshold re-arms it).
 */
export class Energy {
  value = 0;

  /** The two activations available now. */
  ready(): { onde: boolean; furie: boolean } {
    return { onde: this.value >= CONFIG.energy.ondeCost, furie: this.value >= CONFIG.energy.furieCost };
  }

  /** Adds the energy of a KO of `role` (capped at max); EnergyReady for every threshold crossed upward. */
  gain(role: Role): SimEvent[] {
    const before = this.value;
    this.value = Math.min(CONFIG.energy.max, before + energyGain(role));
    const ev: SimEvent[] = [];
    const cross = (at: number, level: EnergyLevel): void => {
      if (before < at && this.value >= at) ev.push({ type: 'EnergyReady', level });
    };
    cross(CONFIG.energy.ondeCost, 'onde');
    cross(CONFIG.energy.furieCost, 'furie');
    return ev;
  }

  /** Spends `amount` if there is that much; false (nothing spent) otherwise. */
  spend(amount: number): boolean {
    if (this.value < amount) return false;
    this.value -= amount;
    return true;
  }
}
