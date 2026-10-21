export const CONFIG = {
  step: 1 / 60,
  maxCatchUpSteps: 5,
  tile: 32,
  mapTiles: 48,
  player: { maxHp: 100, walk: 90 * 2, run: 125 * 2, radius: 7, invulnSec: 0.6 },
  melee: { cooldown: 0.45, range: 28 * 2, arcDeg: 360, maxTargets: 3 },
  /**
   * Site-bound rioters (degraders, victim aggressors) are drawn to Paul: they engage him within `aggroRadius` px with a
   * clear line and go back to their post beyond `aggroRelease` px; with at most `fewLeft` hostiles active, one at its
   * post for more than `postSec` s leaves it for Paul for good (degraders only: a victim aggressor stays on the victim
   * until Paul comes within `aggroRadius`). A Molotov is never diverted before its throw.
   */
  hostile: {
    baseHp: 2,
    contactDamage: 5,
    attackInterval: 1.8,
    windup: 0.5,
    radius: 7,
    speed: 70 * 2,
    aggroRadius: 220,
    aggroRelease: 320,
    fewLeft: 3,
    postSec: 6,
  },
  rock: {
    windupMin: 0.6,
    rangeMin: 140 * 2,
    rangeMax: 180 * 2,
    flightMin: 0.5,
    damage: 5,
    pickupRadius: 14 * 2,
    maxCarried: 3,
    returnDamage: 1,
    returnRange: 180 * 2,
    returnCooldown: 0.5,
    maxFlying: 24,
    maxGround: 16,
    throwInterval: 3.0,
  },
  school: { cinematicSec: 3 },
  /**
   * Rescue (§12.10–12.12). The victim carries `itemCount` belongings: at each `theftAt` share of the reserve left, the
   * nearest active aggressor steals one. A thief KO drops it; Paul picks it up within `pickupRadius` px (carries up to
   * `itemCount`) and hands every carried item back within `returnRadius` px of the victim (+`itemBonus` each). Secured
   * with items still out: the victim waits up to `returnSec` s for them, then the `thanksSec` beat and `bonus`.
   */
  rescue: {
    threatSeconds: 25,
    aggressors: [2, 4],
    thanksSec: 1.5,
    bonus: 6,
    itemCount: 3,
    theftAt: [0.75, 0.5, 0.25],
    itemBonus: 2,
    pickupRadius: 20,
    returnRadius: 48,
    returnSec: 12,
  },
  heal: { amount: 25 },
  /**
   * Weapon pickups. Street timer: the first at `firstSpawn` s, then every `spawnEvery` s (random in the range), only
   * while fewer than `maxGround` weapons lie on the ground. No regular weapon is dropped (street timer, twist, breather,
   * the Caïd's) while one already lies within `clearRadius` px of Paul (no piles; the bouclier and the first shooter's
   * flashball are exempt). The twist drop, when it is not a bouclier, is a regular weapon `twistRegularShare` of the
   * time (else nothing); the breather drop comes at the end of every `breatherEvery`-th round only (even rounds).
   */
  weapons: {
    firstSpawn: 20,
    spawnEvery: [30, 45] as const,
    maxGround: 1,
    pickupRadius: 20,
    minDist: 160,
    maxDist: 480,
    dropLifetime: 15,
    clearRadius: 200,
    twistRegularShare: 0.5,
    breatherEvery: 2,
  },
  /**
   * Energy gauge (« mana », 0..`max`): every rioter KO counted by Rules fills it by `gain` (`boss` for Le Caïd, `brute`
   * for a brute, `rioter` for anyone else), except while the mode furie is on and for the onde d’énergie's own KOs. It
   * is kept across rounds (a new session starts at 0) and never decays. Full (`furieCost` = `max`): Furie (R) spends it
   * all on the mode furie. At `ondeCost` or more: Onde (C held) charges the beam, which spends `ondeCost` when it fires.
   */
  energy: { max: 100, ondeCost: 50, furieCost: 100, gain: { rioter: 4, brute: 8, boss: 20 } },
  /**
   * Mode furie (from a full energy gauge): lasts `durationSec`. While active Paul moves `speedMul` faster, strikes
   * `reachMul` farther at up to `maxTargets` rioters, every strike KOs (`damage`) without using the weapon, and he
   * takes `damageTakenMul` of the damage. Every rioter KO'd by Paul's strike is launched (cosmetic): `launchPower` px,
   * `launchSpin` turns, direction away from Paul ± `launchJitter` rad.
   */
  furie: {
    durationSec: 12,
    speedMul: 1.35,
    reachMul: 1.5,
    maxTargets: 8,
    damage: 99,
    damageTakenMul: 0.5,
    launchPower: [220, 420] as const,
    launchSpin: [2, 5] as const,
    launchJitter: 0.35,
  },
  /**
   * Bouclier (the one special pickup): protection only. Picking it up starts a protection bubble around Paul for
   * `durationSec` of active sim time (frozen while paused; a second pickup restarts it; it ends at once if Paul is KO'd),
   * on top of whatever he holds: it never takes the weapon slot and adds no damage (Frapper stays Paul's normal strike).
   * Every rock, firebomb and shooter's bullet that would hit Paul is blocked, from any side (360°); ground fire and
   * contact blows are not. From `dropFromRound` the twist weapon drop is a bouclier with probability `dropShare`; from
   * `spawnFromRound` a timed street spawn is one with probability `spawnShare`.
   */
  bouclier: {
    durationSec: 20,
    dropFromRound: 3,
    dropShare: 0.5,
    spawnFromRound: 5,
    spawnShare: 1 / 6,
  },
  /**
   * Kamehame (« Onde d’énergie », from the energy gauge): holding Onde charges `chargeSec` (Paul cannot move), then a
   * beam `length` px long KOs every active rioter within `halfWidth` + its radius of the line, which stops at the first
   * solid (buildings, props, trunks, plinth, the peaceful group).
   */
  kamehame: {
    chargeSec: 1,
    length: 320,
    halfWidth: 16,
    /**
     * Cosmetic « satellisation » of the beam's KOs: `satellitePower` px along the beam ± `satelliteJitter` rad,
     * `satelliteSpin` turns.
     */
    satellitePower: [1100, 1800] as const,
    satelliteSpin: [6, 10] as const,
    satelliteJitter: 0.15,
  },
  caps: { hostiles: 40, windupsContact: [2, 4], windupsThrow: [2, 4] },
  /**
   * `fireDps` while the attack lasts; `smoulderDps` once its rioters are all KO but the fire still burns (school 100 hp
   * ≈ 143 s, car 60 hp ≈ 86 s): a fire never goes out by itself, only a toolbox puts it out.
   */
  target: { fireDps: 2, degradeDps: 1.2, maxDegraders: 4, smoulderDps: 0.7 },
  /** `burstDamage`: hp a bottle takes off a target already on fire (no new ignition, no new announcement). */
  molotov: { windup: 1.5, range: 96, burstDamage: 8 },
  /**
   * Firebombers (« Lanceurs sur Paul »): ranged rioters who throw Molotovs at Paul. They keep `keepMin`–`keepMax` px
   * from him with a clear line, raise a lit bottle for `windup` s (aimed at where Paul stood when it started), throw
   * every `throwInterval` s; the bottle flies `flightSec` s and leaves a fire patch. Paul within `fallback` px → they
   * fight as contacts. From `fromRound`: about 1 fill rioter in `fillEvery` (>= 1 once the fill has 4, at most
   * `maxPerRound` per round), and the last Molotov of each site attack turns firebomber after its throw at the site.
   */
  firebomber: {
    keepMin: 140,
    keepMax: 260,
    fallback: 100,
    windup: 1.2,
    flightSec: 0.7,
    throwInterval: 5,
    fromRound: 3,
    fillEvery: 8,
    maxPerRound: 3,
  },
  /**
   * Runners (§12.14): contact rioters at `speedMul` × the hostile speed with `hp` HP. From `fromRound`, one fill group
   * of each round becomes a pack of `pack` rioters (4–6, never added to the roster), entering CONFIG.round.climaxInterval
   * apart, without a banner.
   */
  runner: { speedMul: 1.6, hp: 1, fromRound: 3, pack: [4, 6] as const },
  /**
   * Brutes: contact rioters at `speedMul` × speed with `hp` HP; a blow that lands pushes Paul `knockback` px away
   * (blocked by solids, no extra damage). `counts`: [from round, brutes per round] (replacing contact slots of the fill).
   */
  brute: { speedMul: 0.75, hp: 4, knockback: 28, counts: [[4, 1], [6, 2], [8, 3]] as const },
  /**
   * « Le Caïd » (mini-boss, role 'boss'): `hp` HP, `speedMul` × speed, `knockback` px push; from `fromRound` he closes
   * every round (last fill rioter). KO'd: +1 as usual, +`bonus` (once per round) and, `dropShare` of the time (seeded), a
   * regular weapon dropped where he fell.
   */
  caid: { speedMul: 0.9, hp: 6, knockback: 40, fromRound: 3, bonus: 5, dropShare: 0.5 },
  /**
   * Shooters (cartoon AK-47, role 'shooter'): `hp` HP; keep `keepMin`–`keepMax` px from Paul with a clear line (else
   * walk in); aim `aimSec` at where Paul stands (red aim line, « ! »), then a burst of `burst` bullets `burstGap` s apart
   * along that fixed line, then reload `reloadSec`. Paul within `fallback` px → they fight as contacts. `counts`: [from
   * round, shooters per round] (contact slots of the fill, last group first), at most `maxPerRound`.
   */
  shooter: {
    hp: 3,
    keepMin: 220,
    keepMax: 300,
    fallback: 100,
    aimSec: 0.8,
    burst: 3,
    burstGap: 0.12,
    reloadSec: 3,
    counts: [[6, 1], [8, 2]] as const,
    maxPerRound: 3,
  },
  /**
   * Shooters' bullets: `speed` px/s, `damage` to Paul (normal damage path: invulnerability frames, mode furie), `radius`
   * px, `lifeSec` s; stopped by solids, the peaceful group, the victim and the bouclier's bubble; never hurt rioters; at
   * most `maxFlying` in flight.
   */
  bullet: { speed: 260, damage: 8, radius: 3, lifeSec: 1.6, maxFlying: 30 },
  /**
   * Flashball (regular weapon, 6 shots): a strike fires a shot at `speed` px/s for at most `range` px along the mouse aim,
   * else the facing snapped to the nearest active rioter within ±`assistDeg`° and `assistRange` px (clear line). The first
   * rioter hit takes a weapon hit (one-hit KO; CONFIG.toughWeaponDamage on a brute or the Caïd); solids, the peaceful group
   * and the victim stop it. In the street pool from `fromRound`; one is dropped `dropMin`–`dropMax` px from Paul when the
   * session's first shooter enters (never expires).
   */
  flashball: { speed: 420, range: 480, radius: 4, assistDeg: 12, assistRange: 320, fromRound: 5, dropMin: 120, dropMax: 220 },
  /**
   * Gant de boxe à ressort (regular weapon, 6 uses): a strike is a straight punch of `reach` px along the facing (the aim);
   * the first active rioter on it takes a weapon hit and is pushed `knockback` px; a KO body is launched (tumble,
   * `launchPower` px, `launchSpin` turns). Stopped by the first solid, the peaceful group, the victim. A use is spent
   * only on a hit. In the street pool from `fromRound`.
   */
  gant: { reach: 160, knockback: 32, fromRound: 3, launchPower: [70, 120] as const, launchSpin: [1, 2] as const },
  /** Damage of a held regular weapon's strike on a brute or the Caïd (everyone else: one-hit KO). */
  toughWeaponDamage: 2,
  /**
   * Ground fire left by a firebomb: `radius` px, `lifeSec` s, at most `maxAlive` (a new one pushes the oldest out).
   * Paul standing inside takes `damage` every `tickSec` s through the normal damage path (invulnerability frames and
   * mode furie apply). Rioters are not hurt; a patch never ignites a target.
   */
  firePatch: { radius: 30, lifeSec: 3.5, maxAlive: 6, damage: 4, tickSec: 0.5 },
  /**
   * Equestrian monument (§11). Occupation: `firstOccupiers` the first time, then min(`maxOccupiers`, 5 + floor(round /
   * 3)); the swap timer runs 1 s/s per occupier at the plinth (at most `swapCounted`) up to `swapSec`. Capture the flag:
   * Paul in the zone with no active hostile inside for `captureSec`. Scores [defended, swapped, captured].
   */
  monument: {
    fromRound: 4,
    firstOccupiers: 6,
    maxOccupiers: 8,
    swapSec: 4,
    swapCounted: 3,
    captureSec: 8,
    scores: { defended: 4, lost: -3, captured: 10 },
  },
  kit: { maxGround: 2, pickupRadius: 20, repairSec: 2, applyRange: 48, safetyRadius: 64, minPlaceFromPlayer: 64 },
  round: {
    totals: [10, 14, 18, 22],
    growth: 4,
    maxTotal: 40,
    breatherSec: 6,
    introSec: 4,
    firstDelay: 2,
    interval: 1.5,
    climaxInterval: 0.8,
    gate: 12,
    groupSize: 6,
    twistAt: 0.5,
    bonus: 5,
  },
  casse: { scores: { school: [8, -3, 5], car: [4, -2, 3], busStop: [4, -2, 3], shop: [6, -2, 4] } },
  pressureMax: 12,
  rulesVersion: 'slice-0.2.0',
} as const;
