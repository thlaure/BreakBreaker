# BreakBreaker first playable slice: verification report (2026-10-20)

Scope: Task 16. Version `slice-0.1.0`, Phaser 4.2.1 + Vite 8, 32 px tiles, hero Paul, 141 unit tests.
Agreed deviations: fictional hero Paul; every rioter KO scores +1; neutral "Casseurs neutralisés" (no OQTF counter); no flag bonus.

## 1. Gates

`npm run typecheck`: clean. `npm test`: 16 files, 141 tests, all green. `npm run build`: OK (only the 500 kB chunk-size warning for the Phaser bundle).

## 2. Method and limits

- The in-app browser pane throttles `requestAnimationFrame` (2 to 5 fps measured: `loop.actualFps` 4.4). Real frame times, feel at 60 fps and animation smoothness could NOT be measured. Sim speed is covered by the Node bench instead.
- Browser walk-through used the dev server (`npm run dev`) plus the dev handle `window.__game` (RC-40, RC-41, RC-44, stress). Used helpers: `scene.getScene('world').sim.step(...)` to fast-forward, setting `sim.player.hp = 0 / ko = true` to force the KO summary, `window.dispatchEvent(new Event('blur'))` to test focus loss.
- RCs proven by unit tests cite the test file and test name.

## 3. RC table

Legend: PASS, PARTIAL, FAIL, HP = hors périmètre (slice), NV = non vérifié. **0 FAIL.**

| RC | Status | Evidence |
| --- | --- | --- |
| 01 | PARTIAL | Landing without account, single hero Paul, no customisation (browser, `/`). Hero uniqueness by design, no test. |
| 02 | PASS | Browser screenshots: orthogonal top-down, crisp pixels (pixelArt + integer camera zoom). |
| 03 | PASS | `combat.test.ts` "8-direction move: diagonal same speed as straight (RC-03)"; `map.test.ts` "diagonal move is not faster than straight". |
| 04 | PARTIAL | Free roaming on the 48x48 tile map, camera follows with deadzone, no arena (browser, code). No explicit test. |
| 05 | NV | Collision on footprint only is tested (RC-51); Paul visibility behind a building (depth/canopy fade) not inspected in motion. |
| 06 | PASS | `combat.test.ts` "sweep hits at most 3, each once per swing (RC-06)". |
| 07 | PASS | `combat.test.ts` "two hits KO a rioter, KO bodies take no more hits (RC-07, RC-08)". |
| 08 | PASS | `rules.test.ts` "every variant scores +1 at KO, counted once"; `sim.test.ts` "melee KO scores +1 and emits ActorKnockedOut". (No OQTF counter, by agreement.) |
| 09 | PASS | Stress screenshot: three variants (classic / palestinian / antifa flags) with contact and thrower roles (`snapshot` shows both roles, all 3 variants). |
| 10 | PASS | `hostiles.test.ts` "thrower windup >= 0.6 s before rock exits (RC-10)"; telegraph lines visible in screenshot. |
| 11 | PASS | `projectiles.test.ts` "dodged rock lands recoverable (RC-11)". |
| 12 | PASS | `projectiles.test.ts` "rock hitting Paul damages once then lands (RC-12)"; `combat.test.ts` "invulnerability window 0.6 s blocks the second hit". |
| 13 | PASS | `projectiles.test.ts` "flying rock is never picked up (RC-13)". |
| 14 | PASS | `projectiles.test.ts` "pick up within 28 px, once (RC-14, RC-20)". |
| 15 | PASS | `projectiles.test.ts` "stock full leaves rock on ground (RC-15)". |
| 16 | PASS | `projectiles.test.ts` "return consumes stock, empty stock does nothing (RC-16, RC-17)". |
| 17 | PASS | same test (RC-17). |
| 18 | PASS | `projectiles.test.ts` "returned rock hits one hostile then is removed (RC-18, RC-19)". |
| 19 | PASS | same test (RC-19): returned rock removed, no stock recycling. |
| 20 | PASS | `projectiles.test.ts` "pick up within 28 px, once (RC-14, RC-20)". |
| 21 | PARTIAL | No auto-targeting exists in code; peaceful group not damageable (sweep test RC-24). No dedicated "walk into group" test; browser screenshot shows group untouched. |
| 22 | PASS | `projectiles.test.ts` "returned rock stops on peaceful group without damage (RC-22, RC-24)". |
| 23 | PASS | `map.test.ts` "flow field routes around the peaceful group (RC-23)"; `hostiles.test.ts` "stuck hostiles still reach Paul around the group within 20 s". |
| 24 | PASS | `combat.test.ts` "sweep cannot reach through a building or the group (RC-24)"; `projectiles.test.ts` "enemy rock blocked by group drops recoverable on the free side". |
| 25 | PARTIAL | `sim.test.ts` "scripted bot survives intro: school incident starts within 6 s"; school.test covers first line / cinematic. "Attacked before the player arrives" with alarm/fire/3 rioters/circle visible: logic tested, rendering seen only in stress screenshots (school arrow + countdown shown). Not walked end to end. |
| 26 | PASS | `school.test.ts` "leaving/re-entering zone keeps same id and reserve (RC-26, RC-54)". |
| 27 | PASS | `school.test.ts` "first line KO -> cinematic 3 s -> exactly 8 reinforcements, skipping does not double (RC-27)"; reserve in RC-52/53 tests. |
| 28 | PASS | `school.test.ts` "saved: +8 once, stage saved (RC-28)". Students: not modelled (see RC-30). |
| 29 | PASS | `school.test.ts` "destroyed: -3 once, stays destroyed, no late wave (RC-29)". Repair by kit is HP. |
| 30 | NV | Student crowd entering the school is not implemented/tested in this slice (only the saved bonus). |
| 31 | HP | Monument capture out of slice. |
| 32 | HP | Monument capture out of slice. |
| 33 | HP | Shop out of slice. |
| 34 | HP | Rounds / shop out of slice. |
| 35 | HP | Rounds / re-taking objectives out of slice. |
| 36 | PASS | `healing.test.ts` "charged station heals +25 capped at 100, once (RC-36)". |
| 37 | PASS | `healing.test.ts` "interrupted heal gives nothing and keeps charge (RC-37)". |
| 38 | PASS | `healing.test.ts` "full health consumes nothing (RC-38)". |
| 39 | PARTIAL | Charge is consumed once and nothing recharges (healing.test, RC-36). No explicit "wait does not recharge" test, and per-round recharge is HP. |
| 40 | PASS | `input.test.ts` "blur releases all held inputs (RC-40)", "release-all + lifecycle guard pauses on blur/hidden/pointercancel"; `sim.test.ts` "pause freezes everything (RC-40, RC-67)". Browser: blur event opened the pause overlay, `sim.now` frozen, Reprendre resumed. |
| 41 | PASS | `sim.test.ts` "KO ends session; later steps award nothing (RC-41)", "heal that would complete on the KO step does not revive Paul"; `healing.test.ts` same. Browser: forced KO opened the "Résumé de la partie" (cause KO). |
| 42 | PARTIAL | No time limit, no end other than KO/quit (`sim.test.ts` 100 waves, quit rule). No victory screen exists. 30 min session not run. |
| 43 | PASS | `storage.test.ts` "storage throws -> game data falls back, no exception (RC-43)". |
| 44 | PARTIAL | Browser at 375x812 (portrait emulation): canvas 375x812, integer zoom 1, HUD + touch buttons (Frapper, Renvoyer, Agir, Pause) visible, no horizontal overflow. Live rotation and landscape phone not tested. |
| 45 | HP | Quality profiles out of slice. |
| 46 | PASS | `hostiles.test.ts` "spawn returns null beyond 40 active hostiles (RC-46)"; `projectiles.test.ts` "flying cap 24 and ground cap 16 recycle oldest away from Paul". |
| 47 | PARTIAL | `projectiles.test.ts` "ids and lifeIds unique, kinds cycle, removed rocks are pruned". No pooling in this slice (objects are created fresh), so reset-on-reuse is moot. |
| 48 | NV | 30 minute session: NOT DONE (needs the user, real device). Node bench of 10 simulated minutes at 40 hostiles is in section 4. |
| 49 | PARTIAL | Summary overlay shows consistent counters (browser; `hud.test.ts` formatSummary). The three satirical lines are out of the agreed scope (neutral wording). |
| 50 | PASS | `sim.test.ts` "hostile count never exceeds 40 over 100 waves (RC-50)"; KO always possible (tests RC-41). |
| 51 | PASS | `map.test.ts` "cannot walk through a building or a trunk (RC-51)". |
| 52 | PASS | `school.test.ts` "reserve not consumed while rioters walk (RC-52)". |
| 53 | PASS | `school.test.ts` "reserve decreases 1 s / s while degrading, pauses when interrupted (RC-53)". |
| 54 | PASS | `school.test.ts` "leaving/re-entering zone keeps same id and reserve (RC-26, RC-54)". |
| 55 | PARTIAL | Destroyed stays destroyed (`school.test.ts` RC-29); kit application and round change are HP. |
| 56 to 61 | HP | Repair kits out of slice. |
| 62 | PARTIAL | `rescue.test.ts` "starts pawn 2-4 aggressors >= 160 px from Paul", spawn-blocked retry. "No more than two urgencies": slice has a single urgency at a time (agreed). |
| 63 | PASS | `rescue.test.ts` "Paul's sweep and rocks never touch the victim (RC-63)". |
| 64 | PASS | `rescue.test.ts` "distress only decreases while an aggressor threatens (RC-64)". |
| 65 | PASS | `rescue.test.ts` "all aggressors KO freeze timer; act 1 s gives +6 once (RC-65)". |
| 66 | PASS | `rescue.test.ts` "timeout: failed, no bonus, aggressors turn on Paul (RC-66)". |
| 67 | PARTIAL | `sim.test.ts` pause freezes everything (RC-40, RC-67) covers destruction/distress timers; kit placing is HP. |
| 68 | PARTIAL | Rounds out of slice; incident persistence across waves covered by director/sim tests (ruin persists, rescue ends at outcome). |
| 69 | PASS | Browser: `/` shows presentation, rules, controls, Jouer link, no session started. |
| 70 | PASS | Browser: Jouer link is a real `<a href="/jouer/">` (same tab); `/jouer/` shows "Chargement..." bar then Commencer button; session starts only on click. |
| 71 | PASS | Browser: `/jouer/` opened directly, loaded and reloaded fine. |
| 72 | PASS | Browser network on `/`: only CSS and `preview.webp`; no JS (build.test "landing pulls no game code", "landing has one h1, a real /jouer/ link and no script"). |
| 73 | PARTIAL | No horizontal overflow at 375 px (landing and game). Keyboard focus-ring walk-through not done. |
| 74 | PARTIAL | Preview image shipped (25 kB, has width/height/alt, `build.test.ts`). Fidelity vs delivered version not compared; no 3D / duration claims in the copy (reviewed text). |
| 75 | PARTIAL | Audio is decoded only after Commencer (gesture); autoplay path not exercised with a blocked-audio browser. Muted mode exists ("Son : activé" toggle). Audibility NV. |
| 76 | NV | "Retour au site" exists in pause and summary menus; the confirm-before-abandon flow was not exercised. |
| 77 | PASS | Landing has no script and a real link (`build.test.ts`); preview image has alt text. |
| 78 | PARTIAL | `dist/` has both routes with hashed assets; both entries tested in `build.test.ts`. Not deployed to a real static host; budgets measured separately (section 5). |

Tally (78 cases): **PASS 45, PARTIAL 17, FAIL 0, HP 12, NV 4** (RC-05, RC-30, RC-48, RC-76).

## 4. Stress and performance

### 4.1 `?stress=40` (dev only)

`src/game/debug.ts` + `src/sim/stress.ts` (pure helper shared with the bench). `/jouer/?stress=40` keeps 40 active hostiles (about 30% throwers, all three variants), keeps the 24 flying rocks budget full (ground rocks land naturally, reaching 16), Paul invulnerable (`Sim` option). Guarded by `import.meta.env.DEV`; a grep over `dist/` for `stressTick|stressTarget|topUp|__game|?stress` finds nothing, so it is tree-shaken from production.

Browser check (throttled pane, 4.4 fps): 40 active hostiles, 24 rocks in flight, 16 on ground after fast-forward, roles contact + thrower, 3 variants, HP stayed 100, screenshot renders world, HUD, school arrow, telegraphs and rocks. No errors from the game. The console showed two `net::ERR_CONNECTION_RESET/REFUSED` entries at first load (pane tab opened before the dev server was up); every resource in the Performance entries loaded with status 200 afterwards.

Frame time p95 (target 20 ms) was NOT measured: pane throttling makes it meaningless.

### 4.2 Node bench (`npm run bench`, `scripts/bench-sim.mjs`)

10 simulated minutes = 36 000 steps, 40 hostiles (30% throwers) kept active, 24 rocks flying, 16 on ground, Paul invulnerable and wandering, hitting every 1.5 s (strikes rarely connect, so crowd stays 40). Loaded through Vite SSR loader. Three runs on the dev Mac:

| Metric | per step (ms) | per 60-step frame (ms) |
| --- | --- | --- |
| mean | 0.22 to 0.26 | 13.3 to 15.5 |
| p95 | 0.49 to 0.63 | 19.3 to 27.4 |
| max | 15.8 to 41.9 (JIT warm-up / GC) | 50 to 79 |

"Per 60-step frame" is the sum of 60 consecutive steps (one simulated second). At normal frame rate a render frame runs one sim step (0.2 ms mean, 0.6 ms p95), leaving the budget to rendering. Rendering cost at 40 sprites is not measured here (needs a real device).

## 5. Bundle

`npm run build`:

| Item | Bytes |
| --- | --- |
| `dist/` total | 3 256 472 (3.1 MiB), limit 8 MB: OK |
| `/jouer/` HTML + CSS + JS | 2 362 + 4 246 + 1 447 345 (JS gzip 383.9 kB) |
| chars (13 sheets + layout.json) | 1 560 300 |
| tiles (3 sheets) | 73 893 |
| props (flags) | 373 |
| sfx (10 ogg) | 122 817 |
| **First load of /jouer/ (everything fetched before control)** | **about 3 211 000 (3.06 MiB)**, of which 1.45 MB JS (0.38 MB gzipped) |
| Landing (`index.html` + CSS + `preview.webp`) | about 31 959 (HTML 4 432, CSS 2 517, preview 25 010), no JS |

Observation: in the dev run, the 10 sfx files were requested twice (BootScene preload and `GameAudio` decode after Commencer). Browser HTTP cache likely dedupes in production; unverified on a hosted build.

## 6. Known gaps (deferred minors, from progress.md; 33 entries, full text there)

Task 1: README "no OQTF" wording; `tests/build.test.ts` uses experimental `globSync`; `npm test` rebuilds dist; typescript 7.0.2 native compiler pinned.
Task 2: `clock.advance` no guard for negative/NaN dt; caps.windups* are readonly tuples.
Task 3: trunk marks the whole nav tile solid; no explicit 2-route test; spatial hash key stride implicit.
Task 4: `dedupSize()` public diagnostic.
Task 5: ProjectileReturned emitted on hit and miss alike; RockCtx.victimPos / spawnEnemy partly unused; no off-map landing test.
Task 6: school field always targets facadePoints[0]; melee reach = range + target radius (63 px); separation may nudge a thrower during windup.
Task 7: ThreatPaused not emitted on entering cinematic; re-entry test cannot fail; empty branch.
Task 8: RC-63 immunity test near tautological.
Task 9: dist computed twice; stale progress on KO.
Task 10: rescue path distance counts diagonal steps as 32 px; stale telegraph after thrower KO (until 0.6 s); dead 40-active clamp and `>300` vs `>=300` inconsistency; rocksReturned excludes blocked throws.
Task 11: fire_loop.ogg is a cloth-rustle placeholder.
Task 12: hit-stop visual only; Paul slash anim starts on input not accepted swing, no hurt flash/anim; `hasWebGL` context not released; victim removed abruptly if rescue becomes null; rock arc reads `sim.rocks.flying()` directly; antifa flag reads poorly at 16x12; completed victim also walks away; canopy fade rect 32 px too tall.
Task 13: no `user-scalable=no`; macOS Cmd-held keyup loss; game DESTROY without SHUTDOWN leaves listeners; joystick / drag-aim untested on a phone; first touch on a non-coarse device reveals UI but does not start the stick; mouse swallowed in left half after a touch.
Task 14: keydown with focus on body bypasses overlay stopPropagation (sim paused, harmless); score-0 records saved; real audio output and real-time feel unverified.
Task 15: `/__save-preview` dev middleware lacks size cap and Origin check; endpoint trigger not in repo; quote style slip; mobile nav wraps; controls.ts edits need dev restart.

New observations from this task: SFX requested twice at load (dev); Vite config uses extensionless imports (native config loader warning); in the pane, the KO summary showed "Durée active 00:00" after several seconds of play because the sim ran only a few steps at 4 fps (not a bug).

## 7. Not verified (needs the user or a real device)

- Real phone: touch joystick, drag-aim, button ergonomics, rotation, 375 px layout at real DPR.
- Real frame time / p95 at 60 fps with `?stress=40` on target devices.
- 30 minute endurance (RC-48); memory growth over time.
- Audio audibility and mix (the pane has no usable output), autoplay-blocked behaviour (RC-75).
- Feel at 60 fps: hit-stop, strike timing, camera follow.
- RC-05 (Paul visible behind buildings in motion), RC-30, RC-76 (abandon confirmation).
- Hosted static deploy (RC-78) and HTTP cache behaviour for sfx.

## 8. Out of scope: input for the next plan

Monument capture (RC-31/32), shop (RC-33), rounds/manches and re-taking objectives (RC-34/35/68), quality profiles incl. Économie (RC-45), repair kits and ruin repair (RC-56 to 61, RC-55 tail), multiple simultaneous urgencies (RC-62 "two"), small field heals beyond fixed stations, student formations (RC-30) and school-saved crowd, gamepad, remap UI, Discovery mode, dialogues, satirical summary lines (agreed deviation, would need re-decision), object pooling (RC-47), real-device performance pass (L6), 30 minute endurance (RC-48), code-splitting of the 1.45 MB JS chunk, replacing the fire_loop placeholder and reviewing audio.
