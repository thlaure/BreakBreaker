export interface Vec {
  x: number;
  y: number;
}

/**
 * Cosmetic flight of a knocked-out body: unit `dir`, `power` px, `spin` turns (signed). `kind`: 'tumble' = mode furie
 * (flies off spinning, lands on the map); 'satellite' = onde d’énergie (shot into the sky along the beam, never lands).
 */
export interface Launch {
  dir: Vec;
  power: number;
  spin: number;
  kind?: 'tumble' | 'satellite';
}

/** strike/throwRock are edge-triggered presses; act and strikeHeld are held. */
export interface InputFrame {
  move: Vec;
  aim: Vec | null;
  run: boolean;
  strike: boolean;
  /** Frapper is held down (Space / left mouse / touch Frapper): charges the onde d’énergie. */
  strikeHeld: boolean;
  throwRock: boolean;
  act: boolean;
}

/** Regular street weapons (limited strikes). */
export type WeaponKind = 'baton' | 'marteau' | 'panneau';
/** Special pickups: the mode furie power-up and the two special weapons. */
export type SpecialKind = 'furie' | 'bouclier' | 'kamehame';
/** What Paul can hold: a regular weapon, the bouclier or the onde d’énergie (kamehame). */
export type HeldKind = WeaponKind | 'bouclier' | 'kamehame';
/** What can lie on the ground. */
export type PickupKind = HeldKind | 'furie';

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
  | { type: 'HitConfirmed'; targetLifeId: number; damage: number; source: 'melee' | 'rock' | 'beam' }
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
  /** A pickup appears: a weapon, a special weapon, or the mode furie (`kind: 'furie'`). */
  | { type: 'WeaponSpawned'; kind: PickupKind; pos: Vec }
  /** Paul walked over a furie: the mode is on for `secondsLeft` s (reset when already on). */
  | { type: 'FurieStarted'; secondsLeft: number }
  /** The mode furie is over (time out, or Paul KO). */
  | { type: 'FurieEnded' }
  | { type: 'WeaponPickedUp'; kind: HeldKind }
  /** The held weapon is gone: no strikes left, the bouclier's time is up, or the last onde d’énergie fired. */
  | { type: 'WeaponBroken'; kind: HeldKind }
  /** The bouclier stopped a rock or a firebomb coming from the front (`pos` = where it was stopped). */
  | { type: 'ShieldBlocked'; pos: Vec }
  /** Paul started charging the onde d’énergie (Frapper held). */
  | { type: 'BeamCharging' }
  /** The onde d’énergie fired from `from` to `to` (truncated at the first solid) and knocked out `kos` rioters. */
  | { type: 'BeamFired'; from: Vec; to: Vec; kos: number }
  /** The charge stopped before firing (released, damage, weapon lost, KO): nothing used. */
  | { type: 'BeamCancelled' }
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
  /** `rescueKind`: set when the headline is the rescue (its variant, drawn at round start; RescueStarted has the same). */
  | {
      type: 'RoundStarted';
      index: number;
      total: number;
      headline: CasseKind | 'rescue' | 'monument';
      rescueKind?: 'groupHarassed' | 'elderlyRobbed';
    }
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
  /**
   * `special` = the special pickup the weapon drop is (furie from CONFIG.furie.dropFromRound, bouclier and kamehame from
   * their own `dropFromRound`); absent for a regular weapon drop.
   */
  | { type: 'TwistStarted'; kind: 'weaponDrop' | 'secondUrgency'; pos: Vec | null; special?: SpecialKind }
  | { type: 'StationsRecharged' }
  /**
   * The score changed by `points` (signed, never 0) at `pos` (the rioter KO'd, the target's door, the victim, the
   * monument, Paul for the round bonus): what the floating score popups show. One per Rules change, in order.
   */
  | { type: 'ScoreChanged'; points: number; pos: Vec }
  | { type: 'PlayerKnockedOut' };
