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

/**
 * strike/throwRock/furie are edge-triggered presses; act and chargeHeld are held. The Sim only acts on the rising edge
 * of `act` (a fresh press of Agir) and of `chargeHeld`; the input layer latches a tap so it lasts one read.
 */
export interface InputFrame {
  move: Vec;
  aim: Vec | null;
  run: boolean;
  strike: boolean;
  /** Onde held down (C / touch Onde): charges the onde d’énergie from the energy gauge (CONFIG.energy.ondeCost). */
  chargeHeld: boolean;
  throwRock: boolean;
  act: boolean;
  /** Furie pressed (R / touch Furie): starts the mode furie when the energy gauge is full. */
  furie: boolean;
}

/**
 * Regular street weapons (limited strikes): the swung ones, the spring-loaded boxing glove (`gant`, a straight punch) and
 * the cartoon `flashball` (aimed shots).
 */
export type WeaponKind = 'baton' | 'marteau' | 'panneau' | 'gant' | 'flashball';
/** The one special pickup (the mode furie and the onde d’énergie come from the energy gauge, never from the ground). */
export type SpecialKind = 'bouclier';
/** What Paul can hold: a regular weapon or the bouclier. */
export type HeldKind = WeaponKind | 'bouclier';
/** What can lie on the ground. */
export type PickupKind = HeldKind;
/** The two energy thresholds: the onde d’énergie (CONFIG.energy.ondeCost) and the mode furie (full gauge). */
export type EnergyLevel = 'onde' | 'furie';

export type Variant = 'classic' | 'palestinian' | 'antifa';
/**
 * 'runner' (fast, fragile), 'brute' (tough, slow, pushes Paul) and 'boss' (« Le Caïd ») fight as contacts; 'shooter'
 * (cartoon AK-47) keeps its distance and fires bursts of bullets along a telegraphed line.
 */
export type Role =
  | 'contact'
  | 'thrower'
  | 'degrader'
  | 'aggressor'
  | 'molotov'
  | 'firebomber'
  | 'runner'
  | 'brute'
  | 'boss'
  | 'shooter';
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
  /** `heavy`: the rioter hit is a brute or the Caïd (render / audio: a heavier hit). */
  /** `source`: 'gant' = the boxing glove's punch, 'flashball' = a flashball shot. */
  | { type: 'HitConfirmed'; targetLifeId: number; damage: number; source: 'melee' | 'rock' | 'beam' | 'gant' | 'flashball'; heavy?: boolean }
  | { type: 'EnemyThrowStarted'; from: Vec; to: Vec; until: number }
  /** An enemy rock actually left the thrower's hand (not emitted when the flying cap cancels the throw). */
  | { type: 'EnemyRockThrown'; rockId: number }
  | { type: 'ProjectileLanded'; rockId: number }
  | { type: 'ProjectilePickedUp'; rockId: number }
  | { type: 'ProjectileReturned'; rockId: number }
  | { type: 'ProtectedGroupBlockedImpact' }
  /**
   * A shooter (`lifeId`) starts aiming from `from` at where Paul stands (`to`) until `until`; its burst then follows
   * that fixed line.
   */
  | { type: 'ShooterAimStarted'; lifeId: number; from: Vec; to: Vec; until: number }
  /** A shooter's bullet left the barrel (not emitted when the flying cap swallows it). */
  | { type: 'BulletFired'; id: number }
  /** A bullet or a flashball shot stopped against a solid at `pos` (render: impact spark). */
  | { type: 'BulletImpact'; pos: Vec; owner: 'enemy' | 'player' }
  /** Paul fired the flashball (`id` = the shot) from `from` along `dir`; one shot used. */
  | { type: 'FlashballFired'; id: number; from: Vec; dir: Vec }
  /** The flashball guaranteed with the session's first shooter lies at `pos` (one-line hint banner). */
  | { type: 'FlashballDropped'; pos: Vec }
  /** The boxing glove punched from `from` to `to` (the rioter hit, else the end of its reach); `lifeId` = who it hit. */
  | { type: 'GlovePunched'; from: Vec; to: Vec; lifeId: number | null }
  /**
   * `launch`: set when Paul's strike KO'd the rioter during the mode furie (render only: the body flies `power` px along
   * `dir` while spinning `spin` turns, signed).
   */
  | { type: 'ActorKnockedOut'; lifeId: number; launch?: Launch }
  /**
   * `push`: the blow of a brute or the Caïd also pushes Paul by this vector (its length = the role's knockback); the Sim
   * moves him through the map's solids when the damage is applied.
   */
  | { type: 'PlayerDamaged'; amount: number; push?: Vec }
  /** « Le Caïd » walked in (the round's last fill rioter): banner and edge indicator while he stands. */
  | { type: 'CaidArrived'; lifeId: number; pos: Vec; round: number }
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
  /** A pickup appears: a regular weapon or the bouclier. */
  | { type: 'WeaponSpawned'; kind: PickupKind; pos: Vec }
  /** Paul spent a full energy gauge (Furie): the mode is on for `secondsLeft` s. */
  | { type: 'FurieStarted'; secondsLeft: number }
  /** The mode furie is over (time out, or Paul KO). */
  | { type: 'FurieEnded' }
  | { type: 'WeaponPickedUp'; kind: HeldKind }
  /** The held weapon is gone: no strikes left, or the bouclier's time is up. */
  | { type: 'WeaponBroken'; kind: HeldKind }
  /** The bouclier's bubble stopped a rock, a firebomb or a bullet, from any side (`pos` = where it was stopped, on Paul). */
  | { type: 'ShieldBlocked'; pos: Vec }
  /** Paul started charging the onde d’énergie (Onde pressed with enough energy). */
  | { type: 'BeamCharging' }
  /** The onde d’énergie fired from `from` to `to` (truncated at the first solid), knocked out `kos` rioters, cost paid. */
  | { type: 'BeamFired'; from: Vec; to: Vec; kos: number }
  /** The charge stopped before firing (released, damage, a mode furie started, KO): no energy spent. */
  | { type: 'BeamCancelled' }
  /** The energy gauge just rose to a threshold: the onde d’énergie (`onde`) or the mode furie (`furie`) is available. */
  | { type: 'EnergyReady'; level: EnergyLevel }
  /** Furie or Onde pressed with too little energy: `need` = the energy it takes. */
  | { type: 'EnergyRefused'; need: number }
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
   * `special` = the bouclier when the weapon drop is one (from CONFIG.bouclier.dropFromRound, CONFIG.bouclier.dropShare of
   * the drops); absent for a regular weapon drop.
   */
  | { type: 'TwistStarted'; kind: 'weaponDrop' | 'secondUrgency'; pos: Vec | null; special?: SpecialKind }
  | { type: 'StationsRecharged' }
  /**
   * The score changed by `points` (signed, never 0) at `pos` (the rioter KO'd, the target's door, the victim, the
   * monument, Paul for the round bonus): what the floating score popups show. One per Rules change, in order.
   */
  | { type: 'ScoreChanged'; points: number; pos: Vec }
  | { type: 'PlayerKnockedOut' };
