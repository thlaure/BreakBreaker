# Phase A playtest fixes — report (2026-10-21)

Branch `fix/phase-a-playtest`, five commits on top of `6f241ad` (not pushed):

| Commit | Problem |
| --- | --- |
| `af00120` | 1. Fire announced only when the bottle is thrown |
| `65d2c92` | 2. Rioters drawn to Paul (aggro, pull, nearer entries) |
| `b18e990` | 3. Toolbox repair started with Agir (F / touch Agir), no holding; toolboxes at round start |
| `fd9cb96` | 4. A burning / destroyed place stays so until repaired (smoulder) |
| `a3e51d9` | Docs: CAHIER_DES_CHARGES v1.9.1 + README |

Final checks: `npx vitest run` 301/301 (278 before), `npm run typecheck` clean, `npm run build` ok,
`npm run bench` per-step mean 0.215 ms (budget 0.3 ms).

## 1. « ÉCOLE EN FEU ! » before any Molotov

- `TargetIgnited` now carries `incidentId`, `kind`, `pos` (door), `round` (`total?` optional, not filled: the attack does not know the roster).
- `alertFromEvent`: `TargetIgnited` → incident banner; `SchoolStarted` / `CasseStarted` → null (still emitted for sim/stats).
  Banner meta line is « Manche N » when the total is unknown.
- `ROUND_HEADLINES`: « École menacée », « Voiture menacée », « Abribus menacé », « Agression en cours ».
- Audio alarm: on `TargetIgnited` (and `RescueStarted`), no longer on `CasseStarted`.
- Edge indicator and card icon of a target: warn tone / alert icon until burning, then fire tone / flame (`incidentLook`).
- Tests: alerts.test (event mapping, banner texts, attack start silent, indicator tone switch), hud.test (alarm on fire only), targetAttack.test (event payload).
  RED: 11 failing alert tests + 2 others before the change; GREEN after.

## 2. Rioters drawn to Paul

- `CONFIG.hostile`: `aggroRadius` 220, `aggroRelease` 320, `fewLeft` 3, `postSec` 6 (documented in config).
- `Horde.engage`: a degrader / victim aggressor turns on Paul (target `player`) within 220 px with `grid.lineClear`,
  returns to its post beyond 320 px. With ≤ 3 active hostiles, one at its post (first `degrade`/`threaten`) for > 6 s
  leaves it for good (a pulled aggressor no longer threatens, so the rescue reserve stops draining). Molotovs are not concerned.
- `spawnPoints`: candidates ≥ 320 px sorted by distance, the nearest 3 only (queue/spawner cycle over them).
- Tests (hostiles.test, sim.test): hysteresis, blocked line, aggressor engage/release, Molotov not diverted, pull with 3 but not 4,
  pulled aggressor, spawn points. RED 6 / GREEN. Steady-flow (no gap > 3 s) and balance bot tests unchanged and green — no re-tuning.

## 3. Toolbox key

- `Toolboxes.step` ctx gets `act`; a `started` latch is set by a press while carried + in range + safe; progress then runs 2 s
  without holding; leaving range / hostile close / KO / target change reset progress and latch. `ready` = a press would start.
- Snapshot `toolboxes` gains `canRepair`, `repairKind` ('ruin' | 'fire' | null), `started`.
- `contextPrompt`: « F — Réparer » / « F — Éteindre le feu » (touch without « F — », label « Réparer » / « Éteindre » shows the Agir button),
  « Réparation… » once started, messages unchanged.
- `CONTROLS` row « Réparer / éteindre (caisse à outils) » / F / « Bouton Agir (près d’un lieu à réparer) »; RULES line updated.
- Toolboxes are also placed at `startRound`.
- Tests rewritten (repair.test now presses; old "automatic repair" tests replaced, no coverage dropped), new: no press = nothing,
  hostile/no-kit press starts nothing, new press needed after a reset; rounds.test round-start toolboxes and sim-level press flow;
  hud/alerts prompt and touch-button tests. RED 13 / GREEN.

## 4. Burning / destroyed stays until repaired

- `AttackStage` loses `fireOut`, gains `smoulder`; `settled()` = resolved or smoulder. All rioters KO: not burning → saved (+8/+4,
  `TargetSaved`, `SchoolRestored`) at once; burning → smoulder, `CONFIG.target.smoulderDps` 0.7 hp/s until put out (→ saved silently,
  stats events only) or hp 0 (→ ruin, `:lost` once, `BuildingDestroyed`). `fireOutSec` removed.
- `Targets.ignite(id, incidentId)`, `extinguish(id): string | null`, `refill()` skips burning.
- Toolbox: `repairTarget` returns ruins first, then burning targets; finishing on a fire → `extinguish` (hp unchanged), `FireOut` +
  `TargetRepaired`, award `${incident}:extinguished` (scores[kind][2]), toolbox used. Allowed mid-attack.
- Director: beats/completion/`windingDown` use `settled`; `succeeded` = saved or smoulder; `free()` excludes burning targets;
  `roundPlan` skips burning targets; start-of-round prune still removes only resolved attacks (smouldering ones keep stepping through breather).
- Sim: snapshot target state `'burning'`; horde sites skip settled attacks. HUD: cards « en feu » and flame indicators for `burning`
  targets, no banner repeat. Render already follows `burning`; school flag only on `saved`.
- Tests: targetAttack (saved at once, smoulder, smoulder to ruin, ruin from elsewhere), targets (ignite/extinguish/refill), repair
  (extinguish +5 once, car +3 per fire), rounds.test new describe (smoulder through round end + breather, no refill, round completes
  réussi with bonus; press F → saved +5 once, hp unchanged; burnt down −3 once; burning never re-attacked), alerts (burning card/indicator).
  The failed-rescue test, which relied on the 1.5 s fire-out gap before the rescue launched, was rewritten to keep the school's last
  rioters standing until the map is full of patrols (same intent). RED 12 / GREEN.

## Tunable constants

`hostile.aggroRadius` 220, `hostile.aggroRelease` 320, `hostile.fewLeft` 3, `hostile.postSec` 6, `SPAWN_NEAREST` 3 (director),
`target.smoulderDps` 0.7, `kit.repairSec` 2 (unchanged).

## Concerns

- The alarm no longer sounds on `BuildingThreatStarted` (first hp lost) either, otherwise it would be used up by degraders before the fire
  ("alarm = fire"). An attack whose Molotov is KO'd before throwing is therefore silent.
- An extinguish counts in `stats.repairs` (it emits `TargetRepaired`) and the smouldering attack also adds `targetsSaved` when put out.
- The fire loop (audio) keeps playing during the breather while a place smoulders — intended, but audible.
- "Ruins first if both near" has no geometric test: no two target doors are within 2 × 48 px on the current map.
- A degrader engaged with Paul does not degrade, so aggro also slows damage to the place; balance tests stay green but this was not playtested.
- Commit trailer uses `Claude Opus 5.5` (the model actually doing the work) instead of the brief's `Claude Sonnet 5.5`.

## Follow-up: more Molotov throwers (product owner: « dès qu'on élimine le gars, on n'a plus de feu »)

Commits on top of `7763f64` (repairs to 100 %, committed by the coordinator):

| Commit | Change |
| --- | --- |
| `e9c273e` | A bottle on an already burning target deals `CONFIG.molotov.burstDamage` = 8 hp, emits no TargetIgnited (no banner / alarm); a burst to 0 goes through the shared `destroy()` helper (ruin, `:lost` once, BuildingDestroyed). `onMolotov(e, ctx)` now takes the attack ctx. Render: such a landing flares the running fire (extra flame particles + glow spike, 350 ms) without cutting it. |
| `c10b8de` | `molotovCount(kind, round)` = min(4, 1 + floor(round / 2)), props capped at 2; extra rioters at the head of the first line; round-1 school: 1 in the first line, 1 with the reinforcements. Molotovs of one site winding up together are staggered (+0.25 s per one already in windup), so bottles never leave on the same step. Molotov windups are not counted in the contact/throw windup caps, so nothing blocks them. |
| docs | CAHIER v1.9.1 (§10.2, RC-95, changelog) and README (also fixed a stale "the fire goes out by itself" line). |

Tests: burst (8 hp, no ignition, ruin once / −3 once, no bottle after resolution); lineup counts per round and kind, extras not
replacements, round-1 split; 3 Molotovs on one building: 3 bottles in 3 different steps, one ignition, hp ≤ 100 − 2 × 8;
staggered windups ≥ 0.25 s apart (RED before the stagger: 0 s apart); several Molotovs not diverted by Paul close by.
Totals in tests follow the compositions. The fill-group balance test moved from round 2 to round 4 (round 2's car now has 5
rioters, leaving a single fill group of 6) and computes group sizes from the roster; the failed-rescue test accepts the school
smouldering (the reinforcements' Molotov may throw). No re-tuning: steady-flow, K===T and balance tests green.
Full suite 306/306, typecheck clean, build OK, bench mean ≈ 0.21 ms/step.

Concerns: later windups of a site are longer than 1.5 s (stagger); round totals grow by the extra throwers (round 1 school: 11);
the burst flare is not covered by automated tests (render).
