# Audit follow-ups and the shield bubble (cahier v1.9.12)

Branch `fix/audit-followups`, cut from `main` after the cahier audit
(`docs/superpowers/reports/2026-10-21-cahier-audit.md`). Product owner: « fix tout » and « il faut que le bouclier soit
une sorte de bulle de protection ». Every item below is delivered; nothing was re-tuned.

## 1. Specials appear when unlocked (audit item 1)

- `RoundPlan.twist` became `twists`: `[]` in round 1, `['weaponDrop']` from round 2, `['weaponDrop', 'secondUrgency']`
  on odd rounds from 3. Both fire together at half the roster, the drop first. The second urgency only starts when the
  urgency cap allows and a target is free. Otherwise nothing more happens: the weapon is already on the ground.
- So the bouclier is a possible twist drop from round 3 and the onde d'énergie from round 5, as the spec says.
- Tests: plan table, round 3 = bouclier drop and second urgency (`TwistStarted` ×2, `RoundTotalChanged`), one weapon
  twist every round 2–6 in a session, the onde as a round-5 twist drop over seeds, furie gating unchanged. The
  steady-flow, urgency-cap and balance bots stay green with no re-tune.

## 2. School flag after repair (audit item 2)

- Pure helper `schoolFlagShown` (`src/game/render/targetMath.ts`). The flag shows when the school target is standing and
  not burning. It reads the drawn fire, which is held back while the bottle is in the air, and no longer looks at the
  incident stage.
- Effects: the flag now shows from the start of the game, comes back after a ruin repair or after a fire is put out, and
  is absent while the school burns or is in ruins.
- Tests: `tests/game/schoolFlag.test.ts`, covering the helper, ruin → repair, and fire → extinguish.

## 3. End-of-game summary (audit item 3)

- « École » shows counts such as « 2 sauvées · 1 perdue ». « Secours » shows counts such as « 3 réussis · 1 raté ».
  Both show « — » when there is nothing to count, and use the singular for 0 and 1.
- New rows: « Objets rendus » (new `SessionStats.itemsReturned`, counted from `ItemReturned`), « Défenses du monument »,
  « Drapeaux perdus » and « Drapeaux repris ».
- « Réparations » is renamed « Lieux réparés ». « Casseurs neutralisés » is kept.
- Tests: `tests/game/hud.test.ts`, covering counts, plurals, the new rows, and a real `ItemReturned` counted in a Sim.

## 4. Rescue headline by kind (audit item 4)

- The director draws the rescue kind when it prepares the rescue at round start (`drawRescueKind`, one draw from the
  same stream). The new `RescueIncident(id, kind)` keeps it, and `start()` no longer draws it.
- `RoundStarted` carries `rescueKind` when the headline is the rescue. The HUD maps it to « Agression en cours » or
  « Vol en cours » (`ROUND_HEADLINES` gained `groupHarassed` / `elderlyRobbed`).
- `RescueStarted.kind` and the snapshot's rescue kind equal the prepared kind (tested over 8 seeds, both kinds seen).

## 5. Agir is a press (audit item 5)

- The Sim keeps `prevAct` and passes only the rising edge to the toolboxes. It updates `prevAct` on every step it sees,
  including paused steps and cinematic steps. Holding F while walking into range, while a hostile leaves, or while
  picking up the toolbox starts nothing.
- Keyboard and touch latch an Agir press: a tap released before the next read still reads `act: true` once.
- Tests: held F before entering does nothing, a press in range starts the action, release/press cycles neither restart
  nor double it, a hostile or leaving range resets it and needs a fresh press, a toolbox picked up with F held does not
  start it, and the latched taps on keyboard and touch.

## 6. Shield → protection bubble

- **Sim.** `CONFIG.bouclier.frontDeg` and `shieldBlocks` are removed. The shield is now a boolean: while Paul holds the
  bouclier, every rock that would hit him is blocked, from any side. A blocked rock lands recoverable at the hit point.
  A rock that would miss him is not stopped.
- **Firebombs.** A bottle landing on Paul fizzles. Its `ShieldBlocked` is reported on his rim, toward the thrower.
- **Unchanged.** Ground fire patches and contact blows still hurt. The bash (64 px, KO, 24 px knockback) and the 20 s
  timer are unchanged.
- **Render.** `BubbleView` replaces `ShieldView`. It draws a translucent film (r ≈ 24 px, light blue and white) with an
  additive glow, a 1 px lighter rim, a highlight arc circling once every 4 s with a specular dot, and a ±1 px pulse.
- **Hits.** A hit flashes the rim and starts a ripple ring at the rim point (`rimPoint`), with the existing sparks
  there.
- **Expiry.** In the last 3 s the bubble fades and flickers, the period shrinking from 240 to 60 ms. Then it pops: a
  ring growing by 10 px plus 8 droplets.
- **Layering and pixels.** The bubble sits above Paul (body depth + 0.15) and below the health bar (overlay + 1). It
  uses whole-pixel positions and two reused Graphics.
- **Reduced motion.** No pulse, no flicker, and a fixed highlight.
- **Pickup.** The pickup keeps the round shield icon, consistent with the « BOUCLIER » edge indicator.
- **HUD.** The weapon row still reads « Bouclier (N s) ».
- **Tests.** Sim: blocks from 8 directions, a rock that misses is not stopped, bottles fizzle from any side while one
  landing away still lights, Sim rocks from front, side and behind are blocked, determinism. The existing fire patch,
  contact, bash and expiry tests pass. Render curves: `tests/game/bubbleMath.test.ts` (radius, alpha and flicker,
  reduced motion, highlight, pop, ripple, rim point).
- **Browser check.** Checked in the dev server's browser pane: the bubble around Paul, a rock from behind blocked at
  100 HP, and the pop (film hidden, ring shown, then cleared).

## Docs

`docs/SPECS - Index.md` is now 1.9.12. Updated sections:

- 8.8 and 8.9: effect, presentation, pickup, who drops it.
- 10.3, 10.6 and 10.8.
- 12.2: rhythm, progression rows 3–5, simultaneous urgencies, numbering.
- 12.10, 13.3, 14.1 and 18.3, plus the section 24 « Projectiles » row.
- RC-28, RC-49, RC-93, RC-97, RC-102, RC-113 and RC-117.
- The 1.9.12 changelog entry.

`README.md` is updated for the rounds line, the bouclier, the toolbox press and the summary.

## Checks

`npx vitest run`: 520 tests, all passing; it was 496 before this branch. `npm run typecheck` and `npm run build` pass.
`npm run bench`: mean about 0.21 ms per step. Some runs during one commit read up to 0.32 ms while the machine was under
load (load average around 24); a re-run read 0.24 ms, and later commits read 0.20–0.21 ms.

## Notes

- The rescue kind draw moved earlier in the director's stream, and round 3/5 twists now draw a weapon from the weapons
  stream. Seeded sessions therefore play out differently from before, while staying deterministic per seed. No test
  needed new expectations beyond those written for these items.
- Changelog gap 1.9.2 (audit item 6) was left as is, since no history was invented.
