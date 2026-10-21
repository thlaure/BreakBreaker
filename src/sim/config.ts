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
  weapons: { firstSpawn: 10, spawnEvery: [15, 25] as const, maxGround: 2, pickupRadius: 20, minDist: 160, maxDist: 480, dropLifetime: 15 },
  /**
   * Mode furie (power-up pickup): lasts `durationSec` (a second pickup resets it). While active Paul moves `speedMul`
   * faster, strikes `reachMul` farther at up to `maxTargets` rioters, every strike KOs (`damage`) without using the
   * weapon, and he takes `damageTakenMul` of the damage. The twist weapon drop is a furie from `dropFromRound`; from
   * `spawnFromRound` a timed spawn is a furie with probability `spawnShare`. Every rioter KO'd by Paul's strike is
   * launched (cosmetic): `launchPower` px, `launchSpin` turns, direction away from Paul ± `launchJitter` rad.
   */
  furie: {
    durationSec: 12,
    speedMul: 1.35,
    reachMul: 1.5,
    maxTargets: 8,
    damage: 99,
    damageTakenMul: 0.5,
    dropFromRound: 4,
    spawnFromRound: 6,
    spawnShare: 1 / 6,
    launchPower: [220, 420] as const,
    launchSpin: [2, 5] as const,
    launchJitter: 0.35,
  },
  /**
   * Bouclier (special weapon, held): lasts `durationSec` of active sim time, then breaks; no strike counter. Rocks and
   * firebombs hitting Paul from within `frontDeg` (total cone) of his facing are blocked. A strike is a bash: reach
   * `bashRange`, one-hit KO, `knockback` px away from Paul, no charge used. Twist drop from `dropFromRound`, timed spawn
   * from `spawnFromRound` with weight `spawnShare` (same rule as the furie).
   */
  bouclier: {
    durationSec: 20,
    frontDeg: 120,
    bashRange: 64,
    knockback: 24,
    dropFromRound: 3,
    spawnFromRound: 5,
    spawnShare: 1 / 6,
  },
  /**
   * Kamehame (« Onde d’énergie », special weapon, held): `uses` beams. Holding Frapper charges `chargeSec` (Paul cannot
   * move), then a beam `length` px long KOs every active rioter within `halfWidth` + its radius of the line, which stops
   * at the first solid (buildings, props, trunks, plinth, the peaceful group). Twist drop from `dropFromRound`, timed
   * spawn from `spawnFromRound` with weight `spawnShare`.
   */
  kamehame: {
    uses: 2,
    chargeSec: 1,
    length: 320,
    halfWidth: 16,
    dropFromRound: 5,
    spawnFromRound: 7,
    spawnShare: 1 / 6,
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
