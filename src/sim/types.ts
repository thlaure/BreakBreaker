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
 * How a knocked-out body falls (render only, but for 'domino'). By source: bare hands 'crumple' / 'spin'; panneau and
 * bâton 'flyspin'; marteau 'pancake'; gant 'bounce'; flashball 'backflip'; a returned rock 'wobble'; mode furie and
 * the beam 'flyspin' (the render plays their `launch` instead). The rare WTF falls (`wtf` true): 'tripleflip',
 * 'helicopter', 'faceplant', 'trashcan', 'domino' (the body knocks 1–2 neighbours down: DominoTriggered).
 * 'knocked' = a rioter toppled by a domino. `dir`: unit, away from the blow.
 */
export type FallKind =
  | 'crumple'
  | 'spin'
  | 'flyspin'
  | 'pancake'
  | 'bounce'
  | 'backflip'
  | 'wobble'
  | 'tripleflip'
  | 'helicopter'
  | 'faceplant'
  | 'trashcan'
  | 'domino'
  | 'knocked';
export interface Fall {
  kind: FallKind;
  wtf: boolean;
  /** Unit, away from the blow. */
  dir: Vec;
}

/**
 * strike/throwRock/furie are edge-triggered presses; act and chargeHeld are held. The Sim only acts on the rising edge
 * of `act` (a fresh press of Agir) and of `chargeHeld`; the input layer latches a tap of either so it lasts one read
 * (a C tap starts a charge that then completes on its own, or is refused under the onde cost).
 */
export interface InputFrame {
  move: Vec;
  aim: Vec | null;
  run: boolean;
  strike: boolean;
  /**
   * Onde down (C / touch Onde): its rising edge starts the onde d’énergie's charge from the energy gauge
   * (CONFIG.energy.ondeCost); holding it longer changes nothing.
   */
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
/** What Paul can hold in his hands: a regular weapon (the bouclier is a protection timer on top of it, not held). */
export type HeldKind = WeaponKind;
/** What can lie on the ground: a regular weapon or the bouclier. */
export type PickupKind = WeaponKind | SpecialKind;
/** The two energy thresholds: the onde d’énergie (CONFIG.energy.ondeCost) and the mode furie (full gauge). */
export type EnergyLevel = 'onde' | 'furie';

export type Variant = 'classic' | 'palestinian' | 'antifa';
/**
 * 'runner' (fast, fragile), 'brute' (tough, slow, pushes Paul) and 'boss' (« Le Caïd ») fight as contacts; 'shooter'
 * (cartoon AK-47) keeps its distance and fires bursts of bullets along a telegraphed line.
 */
export type Role = 'contact' | 'thrower' | 'degrader' | 'aggressor' | 'molotov' | 'firebomber' | 'runner' | 'brute' | 'boss' | 'shooter';
export type TargetId =
  'school' | 'car1' | 'car2' | 'busStop' | 'shop' | 'nursery' | 'kiosk' | 'townHall' | 'library' | 'boothRed' | 'boothBlue' | 'prison';
/** What kind of attack a round's "casse" is (Phase C extends both unions; 'booth' = the two phone booths). */
export type CasseKind = 'school' | 'car' | 'busStop' | 'shop' | 'nursery' | 'kiosk' | 'townHall' | 'library' | 'booth' | 'prison';
/** The emergency services a phone booth calls: the red one the fire truck, the blue one the police. */
export type ServiceKind = 'fire' | 'police';
/** Why a booth call was refused (nothing spent). */
export type ServiceRefusal = 'noFire' | 'fewRioters' | 'noCalls' | 'busy' | 'ruined';
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
  | {
      type: 'HitConfirmed';
      targetLifeId: number;
      damage: number;
      source: 'melee' | 'rock' | 'beam' | 'gant' | 'flashball';
      heavy?: boolean;
    }
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
   * `launch`: set when Paul's strike KO'd the rioter during the mode furie, with the gant or the beam (render only: the
   * body flies `power` px along `dir` while spinning `spin` turns, signed). `fall`: always set (see Fall).
   */
  | { type: 'ActorKnockedOut'; lifeId: number; launch?: Launch; fall: Fall }
  /**
   * A WTF 'domino' fall (right after its ActorKnockedOut): the body at `from` knocked down `lifeIds` (nearest first),
   * each KO'd through the normal path (+1, ActorKnockedOut with a 'knocked' fall).
   */
  | { type: 'DominoTriggered'; from: Vec; lifeIds: number[] }
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
  /** A small field heal (CONFIG.fieldHeal) dropped at `pos` near Paul. */
  | { type: 'SmallHealDropped'; id: number; pos: Vec }
  /** Paul took field heal `id`: `amount` = the health actually gained (clamped at max health). */
  | { type: 'SmallHealPicked'; id: number; amount: number }
  /** A pickup appears: a regular weapon or the bouclier. */
  | { type: 'WeaponSpawned'; kind: PickupKind; pos: Vec }
  /** Paul spent a full energy gauge (Furie): the mode is on for `secondsLeft` s. */
  | { type: 'FurieStarted'; secondsLeft: number }
  /** The mode furie is over (time out, or Paul KO). */
  | { type: 'FurieEnded' }
  /** Paul took a pickup: a regular weapon (into his hands) or the bouclier (its protection timer starts / restarts). */
  | { type: 'WeaponPickedUp'; kind: PickupKind }
  /** The held weapon is gone: no strikes left. */
  | { type: 'WeaponBroken'; kind: HeldKind }
  /** The bouclier's protection is over: its time is up, or Paul was KO'd. */
  | { type: 'ShieldEnded' }
  /** The bouclier's bubble stopped a rock, a firebomb or a bullet, from any side (`pos` = where it was stopped, on Paul). */
  | { type: 'ShieldBlocked'; pos: Vec }
  /** Paul started charging the onde d’énergie (Onde pressed with enough energy). */
  | { type: 'BeamCharging' }
  /** The onde d’énergie fired from `from` to `to` (truncated at the first solid), knocked out `kos` rioters, cost paid. */
  | { type: 'BeamFired'; from: Vec; to: Vec; kos: number }
  /** The charge stopped before firing (a mode furie started, or Paul KO): no energy spent. */
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
  /** Paul called the fire truck (red booth) or the police (blue booth): one call of that kind spent. */
  | { type: 'ServiceCalled'; kind: ServiceKind }
  /** A booth call was refused (nothing spent): see ServiceRefusal. */
  | { type: 'ServiceRefused'; kind: ServiceKind; reason: ServiceRefusal }
  /** The fire truck came in at the entry point `from` (siren). */
  | { type: 'TruckArrived'; from: Vec }
  /** The parked truck started spraying `target` (water); its FireOut follows when the fire is out. */
  | { type: 'TruckSprayed'; target: TargetId }
  /** Rioters brought the truck's hp to 0 at `pos`: it is gone (smoke), the call stays spent. */
  | { type: 'TruckDestroyed'; pos: Vec }
  /** The truck drove off the map (nothing left burning, or its time is up). */
  | { type: 'TruckLeft' }
  /** `count` police officers came in at the entry point `from` (siren). */
  | { type: 'PoliceArrived'; from: Vec; count: number }
  /** A rioter knocked officer `id` out (stun stars; it is lost). */
  | { type: 'PoliceDown'; id: number }
  /** The police group left (its time is up, or every officer was knocked out). */
  | { type: 'PoliceLeft' }
  /** A KO'd Caïd (`lifeId`) was taken to the standing prison (jail van): one more Caïd jailed. */
  | { type: 'CaidJailed'; lifeId: number }
  /** The prison fell: `count` jailed Caïds (>= 1) burst out at its door `pos`, added to the round's roster. */
  | { type: 'PrisonBreakout'; count: number; pos: Vec }
  /** A rioter knocked prison guard `id` out (stun stars; back in the breather while the prison stands). */
  | { type: 'GuardDown'; id: number }
  /** Missing prison guards came back to their posts (breather, prison standing). */
  | { type: 'GuardsBack' }
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
