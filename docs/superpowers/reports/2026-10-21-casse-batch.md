# Casse batch — report (2026-10-21)

Branch `feat/casse-shop-monument` (cut from `feat/furie-mode`), not pushed. One section per task of the batch.

## Task A — Firebombers (« Lanceurs sur Paul ») and ground fire patches

User request: « quelques-uns qui puissent aussi, en plus de les lancer sur les bâtiments, me les lancer dessus ».

| Commit | Scope |
| --- | --- |
| `65cf625` | sim: role `firebomber`, `FirePatches`, fill share, last-Molotov conversion, snapshot + events, tests |
| `c6327a8` | render / audio: bottle in hand, fire telegraph ring, firebomb flight, fire patch layer, whoosh; HUD/audio tests |
| (docs commit) | CAHIER_DES_CHARGES v1.9.4 (§10.9, §8 Molotov line, §16 sound, RC-103/RC-104, changelog), README, this report |

Final checks: `npx vitest run` 359/359 (335 before), `npm run typecheck` clean, `npm run build` ok, `npm run bench`
per-step mean ≈ 0.20–0.23 ms (budget 0.3 ms; the stress mix now includes ~10 % firebombers, so fire patches are
benched too).

### Sim (`src/sim`)

- `types.ts`: `Role` gains `'firebomber'`; events `FirebombThrown { from, to, until }` (bottle left the hand, lands at
  `until`) and `FirePatchStarted { id, pos }`. The windup telegraph reuses `EnemyThrowStarted { from, to, until }`.
- `config.ts`: `firebomber` (keep 140–260 px, fallback 100 px, windup 1.2 s, flight 0.7 s, interval 5 s, from round 3,
  1 in 8, max 3 per round) and `firePatch` (radius 30, 3.5 s, max 6, 4 hp every 0.5 s).
- `hostiles.ts`: `firebomber()` mirrors the rock thrower; windup kind `'bottle'` counts in the throw windup cap (with
  rocks). Aim = Paul's position at windup start; KO during the windup = nothing thrown. A Molotov spawned with
  `afterThrow: 'firebomber'` switches `role` right after its `MolotovThrown` at the site (the site throw itself is
  unchanged). `bottleUp(lifeId)` tells the render whether a lit bottle is raised (Molotov or bottle windup, not a melee
  blow).
- `firepatch.ts` (new): `FirePatches` holds bottles in flight and patches. Landing in a solid → nearest free point on
  rings up to 48 px (fixed angle order), none → no patch. A 7th patch pushes the oldest out. Damage: Paul's centre within
  30 px, every 0.5 s, through a `hurt` callback; a refused hit (i-frames) is retried next step, the 0.5 s restarts from
  the hit that landed.
- `sim.ts`: `FirebombThrown` → `firePatches.throwBottle`; patches stepped after the other damage, before the KO check;
  `hurt` = `damagePlayer` with the furie ×0.5 (emits the usual `PlayerDamaged`). Snapshot: `firebombs` (bottles in
  flight), `firePatches { id, pos, r, secondsLeft }`, `hostiles[].bottleUp`.
- `director.ts`: fill roles from round 3: slot 4, 12, 20… of the round's fill (i % 8 === 3), deferred to the next
  contact slot when that slot is a rock thrower, `min(3, floor((fill + 4) / 8))` per round (so >= 1 from a fill of 4).
  Rock throwers are untouched (balance test still sees exactly a fifth).
- `incidents/targetAttack.ts`: `lineup()` marks the last Molotov of the composition `afterThrow: 'firebomber'` from
  round 3 (school, car, bus stop, twist attacks alike). `entry.ts` carries `afterThrow` to `Horde.spawn`.
- `stress.ts`: the bench/debug mix is 30 % throwers, 10 % firebombers, 60 % contacts.

### Render / audio (`src/game`)

- `render/actors.ts`: `BottleProp` for Molotov and firebomber; it follows `bottleUp` (lit bottle + « ! »); a firebomber
  always has a bottle in hand again (a converted Molotov picks one up).
- `render/fx.ts`: `TelegraphLayer` draws a firebomber's telegraph in orange with a ring the size of the coming patch;
  `MolotovFx` takes its flight time (second instance for `snap.firebombs`, 0.7 s); new pooled `FirePatchLayer`
  (additive glow, faint red danger ring, 4 flickering flames, sparks; fades over the last 0.5 s).
- `audio.ts`: `FirebombThrown` plays the Molotov whoosh. No HUD change, no banner (tests assert `alertFromEvent` null).

### Tests

`tests/sim/firepatch.test.ts` (landing, tick every 0.5 s inside / none outside, expiry at 3.5 s, retry after a refused
hit, max 6, solid landing) and `tests/sim/firebomber.test.ts` (telegraph then bottle aimed at the windup-start position,
5 s interval, KO before throw, contact within 100 px, 140–260 px spacing, windup cap, Molotov conversion, sim damage
when standing still / none when walking off, snapshot flight, furie halves, pause freezes, rioters and targets
unhurt, determinism, lineup marking only from round 3, fill share 0 in rounds 1–2 and <= 3 per round, rounds close at
K = T with throwing Molotovs). Existing steady-flow / balance bot tests stay green: no re-tuning.

### Notes / concerns

- With `player.invulnSec` 0.6 > `tickSec` 0.5, standing in a patch actually loses 4 hp every 0.6 s when nothing else
  hurts Paul (the i-frames apply, as specified); the patch module itself ticks every 0.5 s.
- "1 in 8" is rounded (`floor((n + 4) / 8)`), which is what gives "at least 1 from 4"; the converted Molotov does not
  count in the 3-per-round fill cap.
- Visual pass not done in a browser (the preview pane was hidden, the game auto-pauses there); render verified by
  typecheck/build only.

## Task B — Retro video-game shop (« JEUX RÉTRO »), a new building to protect

User request: « Un autre type de bâtiment à protéger : un magasin, une boutique, par exemple une boutique de jeux vidéo
rétro ». Built as an ordinary destructible building like the school (no shutter, no shopkeeper NPC).

| Commit | Scope |
| --- | --- |
| `0419c52` | sim: target `shop` on building 5, building lineup, round plan (r2 shop, r3 car/bus stop, r4+ all), scores, HUD texts; tests |
| `17b0981` | render: storefront art; building parts kept per building (school and shop), flag mast for the school only |
| (docs commit) | CAHIER_DES_CHARGES v1.9.4 entry extended (§10.1, §10.2, §12.2, §14.1 alerts, §23.1, §24, RC-105/RC-106), README, this report |

Final checks: `npx vitest run` 371/371, `npm run typecheck` clean, `npm run build` ok, `npm run bench` per-step mean
≈ 0.20 ms (budget 0.3 ms).

### Sim (`src/sim`)

- `types.ts`: `TargetId` and `CasseKind` gain `'shop'`. `config.ts`: `casse.scores.shop = [6, -2, 4]`.
- `map/district.ts`: target `shop` (kind `shop`, prop false, 100 hp) on building 5 `R(12,15,4,4)`, attack points
  C(12,19), C(13,19), C(15,19), door C(14,19) — exactly as specified, no tile adjustment needed (all walkable, reachable
  from the spawn; kit sites stay >= 48 px away). Appended last in `DISTRICT.targets` so earlier target order is kept.
- `incidents/targetAttack.ts`: buildings (school, shop) share the 4-Molotov cap and the pressure extras
  (`min(6, 2 + floor(p / 3))`, degrader/contact alternating); the round-1 school special case is unchanged. Variants
  still round-robin; the round-3+ firebomber marking applies to the shop like any attack.
- `director.ts`: `TARGETS_OF` / counters get `shop`; at the time `headlineKinds(round)` scripted r2 `['shop']`, r3
  `['car','busStop']`, r4+ all four kinds. **Superseded in task C** (product-owner request): round 1 = school, from
  round 2 a seeded random draw among every free kind (weight 2, 1 for last round's); `headlineKinds` is gone. Twist second urgency picks the shop like any
  free target.
- Ignition, smoulder, toolbox extinguish/repair, ruin and award keys (`shop#n:saved`, `:lost`, `:extinguished`,
  `:repaired`) all come from the existing generic code.

### HUD / render (`src/game`)

- `hud/alerts.ts`: `INCIDENT_ALERTS.shop` « BOUTIQUE EN FEU ! » / « Défends la boutique » / BOUTIQUE, fire tone, flame;
  `ROUND_HEADLINES.shop` « Boutique menacée ». `hud/format.ts`: `TARGET_NAMES.shop` « Boutique » (card). Edge
  indicator warns then turns to fire after ignition (generic `incidentLook`).
- `render/world.ts`: `buildingParts: Map<buildingIndex, BuildingPart[]>` replaces `schoolParts`; building 5 gets
  original pixel art: two lit shop windows with shelves of coloured game boxes, a glazed door under a scalloped
  four-colour striped awning, a warm light ellipse on the sidewalk, and a « JEUX RÉTRO » plate with a pixel joystick on
  the roof's front edge (a container that fades with the roof). No brand or character.
- `render/targets.ts`: each building view gets its own parts (ruin: tile sprites tinted, texts/graphics at 45 %, the
  window glow off); the flag mast is only created for the school. Fire, smoke, debris and HP bar as the school's.
- Checked in the browser (dev server): storefront intact, burning (flames, bar, « Boutique · en feu » card), ruined
  (dimmed, debris) and repaired; school sign unchanged.

### Tests

`tests/sim/shop.test.ts` (definition on building 5, walkable/reachable points and door, Molotov counts per round and
lineups, scores, attack → ignite → smoulder → toolbox extinguish +4 → saved, ruin −2 → repair +4, saved +6, round 2
headline, round 3 car/bus stop, r4+ draw includes the shop, weighting, ruined/burning shop never drawn). Updated
`rounds.test.ts` (round 2 = shop in the sim with CasseStarted at the shop door; catalogue/weights/ruin fallbacks),
`firebomber.test.ts` (marking covers the shop), `alerts.test.ts` and `hud.test.ts` (shop alert, headline, silent start,
indicator, card). Steady-flow, balance and determinism tests stay green with no re-tuning.

### Notes / concerns

- (Superseded in task C) Rounds 2–3 were scripted here (shop, then car|busStop); since task C every kind, the school
  included, can be drawn from round 2.
- The CAHIER's earlier « Commerce pillé » proposal (shutter, shopkeeper, +4/+5) is marked as not delivered (§23.1) and
  its catalogue/alert rows now describe the delivered shop.
- Commit trailer uses `Claude Opus 5.5` (the model actually used), not the `Sonnet 5.5` named in the batch rules.

## Task C — Equestrian monument with a French flag + capture the flag (and random headline casse)

User requests: « une statue d'un cavalier qui tient un drapeau français […] ils arrivent à remplacer le drapeau français
par un drapeau palestinien. Le but : un capture the flag […] pour pouvoir remettre le drapeau français », then
(mid-task) « ça ne peut pas être aléatoire ? » about the headline casse of each round.

| Commit | Scope |
| --- | --- |
| `c35c8e2` | sim: `DISTRICT.monument`, solid plinth, `Monument` / `MonumentIncident`, director alternation, random headline from round 2, snapshot + events + stats; tests |
| `6661646` | render / HUD / audio: statue, waving flags, swap animation, zone ring, sparkle; banners, edge indicator, flag card; alarm / chime |
| `1d9e895` | sim: the snapshot shows an occupation from its first step (banner pruning) |
| (docs commit) | CAHIER_DES_CHARGES v1.9.4 entry extended (§11 rewritten, EX-15, §2.x states, §12.2, §13, §14.1, RC-32, RC-106, RC-107–RC-110), README, this report |

Final checks: `npx vitest run` 396/396, `npm run typecheck` clean, `npm run build` ok, `npm run bench` per-step mean
≈ 0.20–0.21 ms (budget 0.3 ms).

### Representation

The monument is **not** a target: no hp, not in `Targets`, no ruin/toolbox logic. To reuse the horde's site mechanism
without touching `TargetId`, horde sites are widened to `SiteId = TargetId | 'monument'` (`Hostile.site`,
`SpawnRequest.site`, `HordeCtx.sites`); `Sim.sites()` adds the plinth site (eight attack points, mast as "door", own
flow field) while an occupation's rioters are still standing. `MolotovThrown.target` stays a `TargetId` (Molotovs are
never monument-bound).

### Sim (`src/sim`)

- `map/district.ts`: `monument { plinth R(33,21,2,2), zone {1088,704,112}, mast {1088,672}, attackPoints }` (the eight
  free tiles around the plinth). `map/grid.ts`: the plinth is solid like a prop.
- `monument.ts` (new): `Monument` (flag `french` | `palestinian`, capture `progress`, `swaps`, `paulInZone`,
  `contested`) steps the capture any time the flag is Palestinian (breather included; pause / Paul KO freeze it as the
  sim does not step): Paul within 112 px and no active hostile within 112 px → +dt up to 8 s → `FlagCaptured {swap}`,
  `monument#<swap>:captured` +10. `MonumentIncident` (`monument#n`): occupiers = `occupierCount(n, round)` (6, then
  min(8, 5 + floor(round/3))), variants round-robin, role degrader, site 'monument', objective spawner (front);
  swap timer += dt × min(3, occupiers in state 'degrade') (kept while nobody is there) → at 4 s `FlagSwapped`,
  `:lost` −3, stage `swapped` (settled, not urgent; its rioters keep holding the plinth until KO'd); all KO first →
  `MonumentDefended`, `:saved` +4.
- `director.ts`: `BeatKind` gains `monument`; `roundPlan(round, rand, targets, last, monument)` — second beat =
  monument from round 4 when the flag is French and last round's plan had no monument, else rescue; no free casse →
  that beat alone (headline `monument` possible). Occupations count in the round total, are urgent while `occupy`,
  settle the beat on defended/swapped, summary « Monument : réussi/perdu ». Launch re-checks the flag (dropped → fill).
- **Random headline (product-owner request mid-task)**: round 1 stays the school; from round 2 the headline is a seeded
  draw among every kind with a free target (school, shop, car, bus stop), weight 2, 1 for last round's headline; the
  scripted r2 shop / r3 car|busStop of task B is gone. Twists, rescue fallback and "second urgency prefers a target not
  attacked this round" unchanged.
- `sim.ts`: occupations stepped after the target attacks, then the capture; snapshot `monument { flag, capture,
  captureSec, inZone, contested, swaps, occupation {id, stage, swap, swapSec} | null, mast, zone }`; stats
  `monumentsDefended`, `flagsLost`, `flagsCaptured`. Events `MonumentAttacked`, `MonumentDefended`, `FlagSwapped`,
  `FlagCaptured`; `RoundStarted.headline` may be `monument`.

### Render / HUD / audio (`src/game`)

- `render/monument.ts` (new): runtime 1-px textures drawn ×2 — stone plinth with a blank bronze plaque, dark bronze
  horse and rider holding a light flagpole with a gilded finial; cloths 12×9 in 3 ripple frames (tricolour; black /
  white / green with the red hoist triangle). Swap: the shown flag slides down and fades, the new one rises (0.5 s).
  Ground ring: faint neutral circle while French; red tint + ring while Palestinian, crawling red hatch marks when
  contested, blue/white arc filling with the capture. Tricolour sparkle on `FlagCaptured`.
- `hud/alerts.ts`: kinds `monument` (« MONUMENT ATTAQUÉ ! » / « Défends le drapeau », MONUMENT) and `flag`
  (« DRAPEAU REMPLACÉ ! » / « Reprends le monument », DRAPEAU), warn tone, new neutral pennant icon; short
  position-less `flagCaptured` « DRAPEAU RÉCUPÉRÉ ! » (tone `win`, 2.6 s); headline « Monument menacé ».
  `activeIncidents` id `monument` (flag while Palestinian, else occupation while `occupy`) so stale banners are pruned.
- `hud/format.ts` + `hud.ts`: card « Drapeau · capture N/8 s » with a blue capture bar, status « en cours » /
  « zone contestée » / « à reprendre »; no prompt (no key). `audio.ts`: alarm once per occupation, chime on defence /
  capture, the land thud on a swap. Checked in the browser: statue with the French flag, swap to the Palestinian flag,
  ring + arc + card during a capture, back to French with +10.

### Tests

`tests/sim/monument.test.ts` (map: plinth solid / non-overlapping / reachable points and zone edge; occupier counts and
mixed variants; swap at 4 s with one occupier, ×3 faster with three, no faster with five, none → no swap, timer kept;
defended +4; no occupation while Palestinian; capture 8 s +10 once, pause out of zone / contested keeps progress, KO
body does not contest; two cycles award both; in the sim: round 4 monument defended with K = T, swap → perdu, flag
persists rounds 5–7 with no new occupation, capture during the breather; determinism) and
`tests/game/monument-hud.test.ts` (banners, active incident ids, card, round panel name, Hud edge labels and card,
stale pruning, sounds). Updated `rounds.test.ts` / `shop.test.ts` (random headline: deterministic per seed, every kind
over seeds for round 2, round 1 always the school, ruined/burning never drawn, weights; alternation rounds 4–9),
`balance.test.ts` (round-4 objective counts the occupation), `rules.test.ts` (new stats). Steady-flow and balance bot
tests green with no re-tuning.

### Notes / concerns

- Occupiers are ordinary degraders: when Paul comes within 220 px they leave the plinth to fight him, which pauses the
  swap timer — defending works by going there, as intended; after a swap they hold the plinth (contesting the zone)
  until KO'd.
- West edge of the zone sits on the tile of a tree trunk (C(30,22), 113 px from the centre): the zone is still
  reachable on its other sides; the test checks east/south/north edge points.
- The rescue no longer appears in monument rounds (every other round from round 4 while the flag is French), as
  specified; with a Palestinian flag every round has the rescue.
- Commit trailer uses `Claude Opus 5.5` (the model actually used), as in tasks A and B.
