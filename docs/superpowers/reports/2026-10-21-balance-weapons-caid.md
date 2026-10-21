# Balance: fewer weapons, protection-only bouclier, tougher Caïd — report (2026-10-21)

Branch `fix/balance-weapons-caid` (from `main`). Product owner, after a play session: « il y a peut-être un poil trop
d’armes. Aussi, le bouclier doit juste protéger, pas faire des dégâts supplémentaires. Et pour les caïds, ils doivent
être un peu plus résistants, là c’est un peu trop facile. » Cahier bumped to **1.9.16**.

## 1. Fewer weapons lying around

No weapon type was removed; every source just drops less often.

- Street timer: the first weapon comes at 20 s, then one every 30–45 s, and only while **no** weapon lies on the ground
  (`maxGround` 1, all sources counted). A skipped spawn waits for the next tick of the timer; it is not retried every step.
- No piles: no regular weapon is dropped (street, twist, breather, Caïd) while a weapon already lies within 200 px of
  Paul (`Weapons.crowded`). The bouclier and the first shooter's guaranteed flashball are exempt.
- Twist drop (every round from 2, still the « special » moment): from round 3 a bouclier 1 time in 2 (unchanged).
  Otherwise, and always in round 2, a regular weapon 1 time in 2 (second seeded draw), else nothing. When nothing drops,
  `TwistStarted` still fires with `pos: null` (regular drops never had a banner, so nothing shows on screen).
- Breather drop: only at the end of even rounds (`round % breatherEvery === 0`).
- Caïd drop: 1 time in 2 (one seeded draw from the weapons stream), where he fell. `Weapons.dropAt(pos, player)` now
  returns `GroundWeapon | null`.
- The first-shooter flashball and its « FLASHBALL AU SOL » banner are unchanged.

**How many weapons now.** I probed this with the autopilot over seeds 1–6, 10 rounds each. The bot KOs every rioter
6 s or 12 s after it enters, and Paul "picks up" every ground item 4 s after it appears: a player who grabs everything.
The numbers count every pickup that appeared, boucliers and flashballs included.

| Bot pace | Session length (10 rounds) | Before | After |
| --- | ---: | ---: | ---: |
| KO after 6 s | ≈ 654 s | 61 appeared / 53 picked | 31 appeared / 27 picked |
| KO after 12 s | ≈ 951 s | 76 appeared / 68 picked | 39 appeared / 35 picked |

So about **27–35 pickups per 10 rounds** (≈ 3 a round), down from 53–68: about half. Mix after the change, at the 12 s
pace, per 10 rounds: bâton 8.2, panneau 8.3, marteau 6.8, bouclier 7.5, flashball 4.7, gant 3.5. If Paul never picks
anything up, the 1-on-the-ground cap and the 200 px rule make it far fewer.

## 2. The bouclier only protects

- No bash any more: `CONFIG.bouclier.bashRange` and `knockback`, `Sim.knockback()`, the bash branch of the strike and of
  `Weapons.range()` / `strikeMode()` are gone. With the bubble on, Frapper is exactly Paul's normal strike: his held
  weapon's reach, damage and wear, or bare hands.
- It no longer takes the weapon slot. `Weapons.shieldLeft` is a protection timer on top of whatever Paul holds (same
  pattern as the furie timer): `startShield()` on pickup (a second pickup resets it to 20 s), it ticks with the sim steps
  (frozen while paused), `endShield()` when Paul is KO'd. The new `ShieldEnded` event replaces `WeaponBroken { kind: 'bouclier' }`
  (audio plays the same « land » sound).
- Types: `HeldKind` = `WeaponKind`; `PickupKind` = `WeaponKind | SpecialKind`; `HeldWeapon` lost `secondsLeft`.
- Snapshot: `weapon: { kind, uses } | null` plus a new `shield: { secondsLeft } | null`. `BubbleView.update` reads
  `snap.shield`; `HeldWeaponView` always draws the held weapon.
- HUD ARME row: « Bâton (12) · Bouclier 14 s », « Mains nues · Bouclier 1 s », « Marteau (2) · Bouclier 4 s · Mode furie 3 s ».
  The pickup sprite, edge indicator and banner are unchanged.
- Rules text (`src/content/controls.ts`): « … il protège Paul en plus de son arme, en arrêtant pierres, bouteilles et
  balles de tous les côtés (il ne frappe pas). »
- The bubble itself is unchanged: 360°, blocks rocks, firebombs and bullets, even during invulnerability frames.

## 3. Le Caïd is clearly tougher

- HP: `caidHp(round) = min(26, 14 + floor((round − 3) / 2) × 2)`. Round 3 → 14, round 5 → 16, round 7 → 18, round 15+ → 26.
  `roleHp(role, round)` and `Horde.spawn` take the round from the entry request; with no round given, he gets the
  round-3 value.
- Damage table `CONFIG.caid.damageFrom`, applied by `damageOn(role, source)` in `hostiles.ts`, which the Sim uses for
  melee, rock, flashball, gant and beam hits. Brutes and ordinary rioters keep their old values through the same
  function.

| Source | Caïd (new) | Caïd (old) | Brute |
| --- | ---: | ---: | ---: |
| Bare hands | 1 | 1 | 1 |
| Held weapon swing / flashball / gant | 2 | 2 | 2 |
| Returned rock | 1 | 1 | 1 |
| Mode furie hit | 5 | 99 (KO) | 99 (KO) |
| Energy beam | 10 | 99 (KO) | 99 (KO) |
| Bubble | 0 | — | 0 |

  Hits to KO at round 3: 14 bare hands, 7 baton, 3 furie, 2 beams. Before, it was 6 bare hands, 3 baton, and 1 for furie
  or the beam.
- He hits harder: contact damage × 1.5, rounded (5 → 8 at low pressure, capped pressure damage 12 → 18), knockback
  40 → 52 px, attack interval × 0.85 (1.8 s → 1.53 s). Speed stays × 0.9.
- Render: his HP bar is always visible and now segmented, one 2-px segment per 2 HP with 1-px ink ticks between them, at
  most 13 segments (`hpSegments`, `hpSegmentFills` in `roleLook.ts`). Brutes keep the plain bar. The white hit flash
  and the heavier hit sound already fire on every `HitConfirmed` (`heavy: true`), so no snapshot flag was needed.
- Unchanged: KO bonus +5, energy +20, last in the fill, round closing rule.

## Every tunable changed

| Tunable | Old | New |
| --- | --- | --- |
| `weapons.firstSpawn` | 10 | 20 |
| `weapons.spawnEvery` | [15, 25] | [30, 45] |
| `weapons.maxGround` | 2 | 1 |
| `weapons.clearRadius` | — | 200 |
| `weapons.twistRegularShare` | — (always) | 0.5 |
| `weapons.breatherEvery` | — (every round) | 2 |
| `caid.dropShare` | — (always) | 0.5 |
| `bouclier.bashRange` | 64 | removed |
| `bouclier.knockback` | 24 | removed |
| `caid.hp` | 6 | 14 (base at round 3) |
| `caid.hpStep` / `hpEvery` / `hpMax` | — | 2 / 2 / 26 |
| `caid.damageFrom` | — | { hands 1, weapon 2, rock 1, furie 5, beam 10, bubble 0 } |
| `caid.damageMul` | — (1) | 1.5 |
| `caid.knockback` | 40 | 52 |
| `caid.attackIntervalMul` | — (1) | 0.85 |

Unchanged: `bouclier.durationSec` 20, `dropShare` 0.5, `spawnShare` 1/6, `caid.speedMul` 0.9, `bonus` 5,
`energy.gain.boss` 20, `toughWeaponDamage` 2, brute values.

## Tests

- New `tests/sim/weapon-frequency.test.ts` (12 tests). It covers the tunables, the 20 s first spawn and 30–45 s gaps,
  never more than one street weapon on the ground, the 200 px no-pile rule (regular drop, street timer with reschedule,
  Caïd drop) with the bouclier exempt, the twist split (round 2 ≈ 50 % regular / 50 % none; round 3+ ≈ 50 / 25 / 25),
  the Caïd 50 % drop, the breather drop only after even rounds, and determinism.
- `tests/sim/specials.test.ts`: the bash block is replaced by « protection only » (10 tests). They cover: no bash tunables;
  pickup keeps the held weapon and its uses; bare hands stay bare hands; a weapon picked up during the bubble; a second
  pickup resets the timer; no bash (1 damage, no knockback, bare-hands reach); a weapon strike with the bubble; the
  flashball still fires; expiry with `ShieldEnded`, the held weapon kept, pause freezes the timer; it ends on Paul's KO.
  The existing 360° blocking tests (rocks, firebombs, bullets, all sides, determinism) now use `startShield()`.
- New `tests/sim/caid.test.ts` (17 tests). It covers the HP formula and cap, HP per spawn round and in play (14/16/18 in
  rounds 3/5/7), every damage source value, brutes unchanged, hits to KO (bare 14, baton/marteau/panneau 7 at round 3
  and 8 at round 5, furie 3, beam 2), flashball and gant 2, rock 1, bubble 0, ×1.5 blow and 52 px push, the 0.85
  interval, unchanged rewards, and K === T plus determinism over 6 rounds.
- `tests/game/roleLook.test.ts`: segment count and fills. `tests/game/hud.test.ts`: the new ARME row, the in-sim pickup
  row, and the rules text no longer mentions « repousse ».
- Adjusted to the new rules: `enemies.test.ts` (Caïd 14 HP, beam damage, ×1.5 / 52 px blow, 50 % drop),
  `energy.test.ts` (KO helper no longer uses the bash), `shooters.test.ts`, and `weapons.test.ts` / `specials.test.ts`
  (1 on the ground, twist outcomes).
- Balance and autopilot tests: unchanged and green, no re-tuning needed. They KO with `applyHit(99)`, which bypasses the
  damage table. The steady-flow and K === T tests pass as before.
- Final run: 48 files, 662 tests passed; `npm run typecheck` and `npm run build` clean; `npm run bench` mean
  0.21–0.23 ms/step across the runs (p95 ≈ 0.37–0.41 ms), limit 0.3.

## Concerns

- **Twist in round 2**: the request read « in round 2 drop nothing special: regular ». I applied the same « regular 1 time
  in 2 » rule there (a round 2 twist can drop nothing). If round 2 should always drop a regular weapon, as a tutorial
  moment, it is a one-line change in `Weapons.dropTwist`.
- **An empty twist is silent**: `TwistStarted { kind: 'weaponDrop', pos: null }` with no `WeaponSpawned`. That was
  already possible when no free spot was found, and regular drops never had a banner, so nothing is announced.
- **Street cap counts every ground weapon** (twist, breather and Caïd drops too), not only street spawns. It is stricter
  than « at most 1 from the street timer ». It is clearer on screen, but a long-lived timed weapon that nobody picks up
  blocks the timer. Those never expire, as before.
- **The Caïd is much tougher at once**: 7 baton hits instead of 3, his blows do 8 instead of 5, and furie no longer
  one-shots him. Bot tests can't judge feel; this needs a playtest, mainly round 3, where he arrives together with the
  runners pack. The likely knobs are `caid.hp` and `damageFrom.weapon`.
- **Not checked in the browser**: the segmented bar and the HUD row were checked by unit tests only. There is no debug
  hook to jump to round 3, and the Phaser layer has no scene tests.
- `bench` max per step varies between runs (10–110 ms spikes, GC). The mean stays under the limit.

## Commits

1. `fix(sim): fewer weapons lying around …`
2. `fix(sim): the bouclier only protects …`
3. `fix(sim): Le Caïd is tougher …`
4. `docs: cahier 1.9.16 …` (cahier, README, this report)
