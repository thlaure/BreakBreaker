export interface Vec {
  x: number;
  y: number;
}

/** Cosmetic flight of a body knocked out during the mode furie: unit `dir`, `power` px, `spin` turns (signed). */
export interface Launch {
  dir: Vec;
  power: number;
  spin: number;
}

/** strike/throwRock are edge-triggered presses; act is held. */
export interface InputFrame {
  move: Vec;
  aim: Vec | null;
  run: boolean;
  strike: boolean;
  throwRock: boolean;
  act: boolean;
}

export type Variant = 'classic' | 'palestinian' | 'antifa';
export type Role = 'contact' | 'thrower' | 'degrader' | 'aggressor' | 'molotov' | 'firebomber';
export type TargetId = 'school' | 'car1' | 'car2' | 'busStop' | 'shop';
/** What kind of attack a round's "casse" is (Phase C extends both unions). */
export type CasseKind = 'school' | 'car' | 'busStop' | 'shop';
/**
 * Where a site-bound rioter (degrader) goes: a target, or the equestrian monument's plinth. The monument has no hp and
 * is not a target: it only shares the horde's site mechanism (attack points, flow field).
 */
export type SiteId = TargetId | 'monument';
/** The flag the rider of the equestrian monument holds. */
export type MonumentFlag = 'french' | 'palestinian';

export type SimEvent =
  | { type: 'HitConfirmed'; targetLifeId: number; damage: number; source: 'melee' | 'rock' }
  | { type: 'EnemyThrowStarted'; from: Vec; to: Vec; until: number }
  /** An enemy rock actually left the thrower's hand (not emitted when the flying cap cancels the throw). */
  | { type: 'EnemyRockThrown'; rockId: number }
  | { type: 'ProjectileLanded'; rockId: number }
  | { type: 'ProjectilePickedUp'; rockId: number }
  | { type: 'ProjectileReturned'; rockId: number }
  | { type: 'ProtectedGroupBlockedImpact' }
  /**
   * `launch`: set when Paul's strike KO'd the rioter during the mode furie (render only: the body flies `power` px along
   * `dir` while spinning `spin` turns, signed).
   */
  | { type: 'ActorKnockedOut'; lifeId: number; launch?: Launch }
  | { type: 'PlayerDamaged'; amount: number }
  | { type: 'BuildingThreatStarted'; incidentId: string }
  | { type: 'BuildingThreatPaused'; incidentId: string }
  | { type: 'BuildingDestroyed'; incidentId: string; target: TargetId }
  | { type: 'SchoolRestored'; incidentId: string }
  /** A school attack starts; `wave` = the round, `total` = the round's roster. */
  | { type: 'SchoolStarted'; incidentId: string; pos: Vec; wave: number; total: number }
  /** A rescue starts; `wave` = the round, `total` = the round's roster. */
  | { type: 'RescueStarted'; incidentId: string; pos: Vec; kind: 'groupHarassed' | 'elderlyRobbed'; wave: number; total: number }
  | { type: 'RescueSecured'; incidentId: string }
  | { type: 'RescueCompleted'; incidentId: string }
  | { type: 'RescueFailed'; incidentId: string }
  /** A rescue aggressor (`thiefLifeId`) took one of the victim's belongings (`item` = its id, see RESCUE_ITEMS). */
  | { type: 'ItemStolen'; rescueId: string; item: string; thiefLifeId: number }
  /** The thief was knocked out: the belonging lies at `pos` and can be picked up. */
  | { type: 'ItemDropped'; rescueId: string; item: string; pos: Vec }
  | { type: 'ItemPickedUp'; rescueId: string; item: string }
  /** Paul handed the belonging back to the victim (+CONFIG.rescue.itemBonus). */
  | { type: 'ItemReturned'; rescueId: string; item: string }
  | { type: 'HealCompleted' }
  /** A pickup appears: a weapon, or the mode furie (`kind: 'furie'`). */
  | { type: 'WeaponSpawned'; kind: 'baton' | 'marteau' | 'panneau' | 'furie'; pos: Vec }
  /** Paul walked over a furie: the mode is on for `secondsLeft` s (reset when already on). */
  | { type: 'FurieStarted'; secondsLeft: number }
  /** The mode furie is over (time out, or Paul KO). */
  | { type: 'FurieEnded' }
  | { type: 'WeaponPickedUp'; kind: 'baton' | 'marteau' | 'panneau' }
  | { type: 'WeaponBroken'; kind: 'baton' | 'marteau' | 'panneau' }
  /** A non-school target comes under attack. */
  | { type: 'CasseStarted'; incidentId: string; kind: CasseKind; target: TargetId; pos: Vec; round: number; total: number }
  | { type: 'MolotovThrown'; from: Vec; to: Vec; target: TargetId }
  /** A firebomber's bottle left its hand toward `to` (where Paul stood when the windup began); it lands at `until`. */
  | { type: 'FirebombThrown'; from: Vec; to: Vec; until: number }
  /** A firebomb landed: a fire patch burns at `pos` (Paul only; never a target). */
  | { type: 'FirePatchStarted'; id: number; pos: Vec }
  /**
   * A Molotov set a target on fire: what the HUD announces (« ÉCOLE EN FEU ! »…) and the alarm cue. `pos` = the
   * target's door, `round` = the attack's round, `total` = the round roster when known.
   */
  | { type: 'TargetIgnited'; target: TargetId; incidentId: string; kind: CasseKind; pos: Vec; round: number; total?: number }
  | { type: 'FireOut'; target: TargetId }
  | { type: 'TargetSaved'; incidentId: string; target: TargetId }
  | { type: 'TargetRepaired'; target: TargetId; incidentId: string }
  | { type: 'ToolboxSpawned'; id: number; pos: Vec }
  | { type: 'ToolboxPickedUp'; id: number }
  | { type: 'RoundStarted'; index: number; total: number; headline: CasseKind | 'rescue' | 'monument' }
  /** Occupiers head for the monument's plinth (round `round`, roster `total`); `pos` = the flag mast. */
  | { type: 'MonumentAttacked'; incidentId: string; pos: Vec; round: number; total: number }
  /** Every occupier KO'd before the swap: the French flag stays. */
  | { type: 'MonumentDefended'; incidentId: string }
  /** The occupiers replaced the French flag with a Palestinian one (capture the flag opens). */
  | { type: 'FlagSwapped'; incidentId: string; pos: Vec }
  /** Paul held the zone for CONFIG.monument.captureSec: the French flag is back; `swap` = the swap it answers (1-based). */
  | { type: 'FlagCaptured'; swap: number; pos: Vec }
  | { type: 'RoundCompleted'; index: number; bonus: boolean }
  | { type: 'RoundTotalChanged'; index: number; total: number }
  /** `furie: true` when the weapon drop is a mode furie pickup (from round CONFIG.furie.dropFromRound). */
  | { type: 'TwistStarted'; kind: 'weaponDrop' | 'secondUrgency'; pos: Vec | null; furie?: true }
  | { type: 'StationsRecharged' }
  | { type: 'PlayerKnockedOut' };
