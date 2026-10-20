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
