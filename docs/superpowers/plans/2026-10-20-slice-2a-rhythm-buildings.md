# BreakBreaker — Slice 2 Phase A (Round rhythm + buildings with health) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace endless waves with rounds (manches) that have a rhythm — breather, announcement, build-up, twist, climax, reward — and make the casse targets (school, two cars, bus shelter) real buildings with a health bar that a Molotov sets on fire, degraders hit, and a toolbox repairs once destroyed.

**Architecture:** Gameplay stays in the pure deterministic sim (`src/sim`, no Phaser). A `Targets` registry owns every destructible target's HP and state; a generic `TargetAttack` incident (Molotov → fire + degraders → saved / destroyed) replaces the school's reserve countdown, the school keeping its round-1 reinforcement cinematic. A rewritten `Director` runs rounds from a small catalogue with an `EntryQueue`. Phaser and the HTML HUD only read the extended `Snapshot` and events.

**Tech Stack:** unchanged — TypeScript, Vite, Phaser 4.2.1, Vitest (+ jsdom for `tests/game`). No new dependency, no new image or sound file (props, toolbox, bottle drawn at runtime like `src/game/render/weapons.ts`).

**Spec:** `docs/superpowers/specs/2026-10-20-slice-2-fun-design.md` (the design; wins over older RCs) — §2 rhythm, §3 buildings, §8 Phase A, §9 builder answers. Older reference for geometry and conventions: `docs/superpowers/plans/2026-10-20-slice-2.md` (Tasks 1–3, 6, 9 ideas reused here; its reserve model, held-F repair and "next round in the same step" are **replaced**).

## Global Constraints

- Pure deterministic 60 Hz sim; Phaser/HUD read `Snapshot` + events only. Same seed + same inputs = same events.
- Binding user decisions: hero **Paul**; **every rioter KO = +1**; neutral counter « Casseurs neutralisés »; no OQTF wording; French UI.
- **No held key** to complete anything: repair and fire-out are automatic. F / Agir only skips the school cinematic.
- Caps: 40 active hostiles; entry gate 12 active for queued rioters; 24 flying rocks.
- Every bonus goes through `Rules.award(key, pts)` with an occurrence-unique key.
- Scores `[saved, lost, repaired]`: school `[8, -3, 5]`; car / busStop `[4, -2, 3]`. A destroyed target never ends the session.
- HP: buildings 100, props 60; fire 2 HP/s; each degrader in `degrade` state 1.2 HP/s, at most 4 counted; repair restores 60 % of max; a saved or repaired target refills to max at round end.
- Molotov windup 1.5 s within 96 px of its target with a clear line; KO during the windup = no fire.
- Fire goes out by itself 1.5 s after the attack's last rioter is KO'd (`fireOutSec`).
- Toolbox: max 2 on the ground, 1 carried, pickup 20 px, repair = stay within 48 px of a ruin's door for 2 s with no active hostile within 64 px, Paul not KO; moving away or a hostile coming close resets progress.
- Round: breather 6 s (no entry) after the whole roster is KO'd, round 1 has none (4 s intro). Inside a round, never > 3 s without an active rioter (RC-94). First rioter of a group 2 s after it is queued, then 1.5 s apart; climax group 0.8 s apart.
- Round totals: `max(objective rioters, [10, 14, 18, 22][r−1] ?? min(40, 22 + 4·(r − 4)))`.
- `rulesVersion: 'slice-0.2.0'`.

## Review Focus

1. **A round never closes** — a queued rioter refused by the 40 cap, an old KO body pruned from `horde.list`, or a planned attack on a ruined target must not freeze the round. Test in Task 4.
2. **Molotov KO'd mid-windup or target already burning** — no fire event, no double ignite, the attack still resolves. Test in Task 2.
3. **Paul KO / pause during repair or breather** — nothing progresses; repair never completes on the step Paul is KO'd. Test in Task 3 and Task 5.
4. **Empty map inside a round** — twist/climax groups and beats chain without a gap > 3 s; the breather is the only allowed gap. Test in Task 4.
5. **Two attacks at once (round 3+)** — both targets lose HP independently, both banners queue, both edge indicators show. Tests in Task 4 and Task 6.

---

## File Structure

```text
src/sim/config.ts              + target, molotov, kit, round, casse scores; rulesVersion
src/sim/types.ts               + TargetId, CasseKind, Role 'molotov', new events; WaveAnnounced removed
src/sim/map/district.ts        + targets (school, car1, car2, busStop), kitSites
src/sim/map/grid.ts            prop rects solid
src/sim/targets.ts             NEW Targets registry (HP, fire, ruin)
src/sim/hostiles.ts            per-site degraders, molotov role, round tag
src/sim/entry.ts               NEW EntryQueue
src/sim/incidents/targetAttack.ts NEW Molotov/fire/degraders incident
src/sim/incidents/school.ts    SchoolIncident extends TargetAttack (round-1 cinematic)
src/sim/repair.ts              NEW Toolboxes
src/sim/healing.ts             Stations.recharge()
src/sim/director.ts            REWRITE rounds
src/sim/sim.ts, rules.ts       wiring, snapshot, stats
src/game/render/targets.ts     NEW TargetView (HP bar, fire, ruin; car/busStop props), ToolboxView, MolotovFx
src/game/render/world.ts, actors.ts, scenes/WorldScene.ts
src/game/hud/alerts.ts, format.ts, hud.ts, hud.css, ui.ts, audio.ts
docs/CAHIER_DES_CHARGES.md     v1.9
tests/sim/autopilot.ts         NEW test helper
```

---

### Task 1: Targets, district props, config, types

**Files:**
- Create: `src/sim/targets.ts`
- Modify: `src/sim/config.ts`, `src/sim/types.ts`, `src/sim/map/district.ts`, `src/sim/map/grid.ts`
- Test: `tests/sim/targets.test.ts`, `tests/sim/map.test.ts` (extend)

**Interfaces:**
- Produces:
  - `types.ts`: `TargetId = 'school' | 'car1' | 'car2' | 'busStop'`; `CasseKind = 'school' | 'car' | 'busStop'` (Phase C extends both); `Role` adds `'molotov'`. New `SimEvent`s: `CasseStarted {incidentId; kind: CasseKind; target: TargetId; pos: Vec; round: number; total: number}` (non-school attacks), `MolotovThrown {from: Vec; to: Vec; target: TargetId}`, `TargetIgnited {target: TargetId}`, `FireOut {target: TargetId}`, `TargetSaved {incidentId; target}`, `TargetRepaired {target; incidentId}`, `ToolboxSpawned {id; pos}`, `ToolboxPickedUp {id}`, `RoundStarted {index; total; headline: CasseKind | 'rescue'}`, `RoundCompleted {index; bonus: boolean}`, `RoundTotalChanged {index; total}`, `TwistStarted {kind: 'weaponDrop' | 'secondUrgency'; pos: Vec | null}`, `StationsRecharged`. `BuildingDestroyed` gains `target: TargetId`. `SchoolStarted` / `RescueStarted` keep their shape; their `wave` field now carries the **round** index. `WaveAnnounced` is removed.
  - `District` gains `targets: TargetDef[]`, `TargetDef { id: TargetId; kind: CasseKind; footprint: Rect; attackPoints: Vec[]; door: Vec; prop: boolean; maxHp: number }` and `kitSites: Vec[]`. Values (from the old plan, verified reachable): `school` = building 0, attack points `DISTRICT.school.facadePoints`, door `C(7,9)`, 100 HP; `car1` `R(17,10,2,1)` points `C(16,10), C(19,10), C(17,11), C(18,11)`; `car2` `R(26,34,2,1)` points `C(25,34), C(28,34), C(26,35), C(27,35)`; `busStop` `R(28,13,2,1)` points `C(27,13), C(30,13), C(28,14), C(29,14)`; props 60 HP, door = rect centre. `kitSites = [C(18,12), C(28,25), C(8,26), C(36,44)]`.
  - `Grid`: prop footprints solid in `isSolid`, `isSolidPx`, `circleBlocked`, `lineClear`.
  - `CONFIG` additions: `target: { fireDps: 2, degradeDps: 1.2, maxDegraders: 4, repairPct: 0.6, fireOutSec: 1.5 }`, `molotov: { windup: 1.5, range: 96 }`, `kit: { maxGround: 2, pickupRadius: 20, repairSec: 2, applyRange: 48, safetyRadius: 64, minPlaceFromPlayer: 64 }`, `round: { totals: [10, 14, 18, 22], growth: 4, maxTotal: 40, breatherSec: 6, introSec: 4, firstDelay: 2, interval: 1.5, climaxInterval: 0.8, gate: 12, groupSize: 6, twistAt: 0.5, bonus: 5 }`, `casse: { scores: { school: [8, -3, 5], car: [4, -2, 3], busStop: [4, -2, 3] } }`, `rulesVersion: 'slice-0.2.0'`. Remove `school.threatSeconds`, `idlePatrolSec`.
  - `class Targets { constructor(defs = DISTRICT.targets); get(id): { hp: number; maxHp: number; burning: boolean; state: 'intact' | 'ruined'; lostIncidentId: string | null }; damage(id, hp): boolean /* true when this call ruins it */; ignite(id): boolean /* false if already burning or ruined */; extinguish(id): void; ruin(id, incidentId): void; repair(id): string | null /* lost incident id, hp = 60 % */; refill(): void /* intact targets back to max, end of round */; standing(id): boolean; intact(): TargetId[] }`.

- [ ] **Step 1: Write failing tests** (`tests/sim/targets.test.ts`, `tests/sim/map.test.ts`)

```ts
test('damage lowers hp; reaching 0 ruins once and returns true only that time')
test('ignite twice returns false the second time; a ruin cannot ignite')
test('repair returns the lost incident id once and restores 60 % of max hp (60 for school, 36 for a car)')
test('refill brings intact targets back to max, leaves ruins at 0')
test('every target attack point and door, kit site, station, rescue site and hostile spawn is reachable from spawn')
test('props block movement and line of sight: walking into car1 from the left keeps x < 544')
test('kit sites are walkable and >= 48 px from every target footprint')
```

- [ ] **Step 2:** `npx vitest run tests/sim/targets.test.ts tests/sim/map.test.ts` → FAIL.
- [ ] **Step 3:** Implement types, config, district data, grid solids, `Targets`. Keep old fields that later tasks remove (compile must stay green: leave `WaveAnnounced` usage until Task 4 removes it, or keep the union member until then).
- [ ] **Step 4:** `npx vitest run && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(sim): destructible targets with health, props and kit sites`.

---

### Task 2: Horde per-site degraders and Molotov rioters; TargetAttack; school on top of it

**Files:**
- Create: `src/sim/incidents/targetAttack.ts`, `src/sim/entry.ts`
- Modify: `src/sim/hostiles.ts`, `src/sim/incidents/school.ts`, `tests/sim/hostiles.test.ts` (ctx fixture), `tests/sim/school.test.ts` (rewrite reserve assertions to HP)
- Test: `tests/sim/targetAttack.test.ts`, `tests/sim/entry.test.ts`

**Interfaces:**
- Consumes: `Targets`, `TargetDef`, CONFIG from Task 1.
- Produces:
  - `Hostile` gains `site: TargetId | null`, `round: number | null`. `HordeCtx`: `sites: Partial<Record<TargetId, { points: Vec[]; standing: boolean; field: FlowField }>>` replaces `facadePoints`, `schoolStanding`, `fields.school`; flow-field rebuild throttle per site. A degrader or Molotov whose site is missing or ruined retargets Paul.
  - Molotov behaviour: steer toward the site's nearest attack point; once within `CONFIG.molotov.range` with `grid.lineClear` → state `windup` for 1.5 s (`windKind 'molotov'`), then emit `MolotovThrown {from, to: site door, target}` and become a `contact` (`target = 'player'`). KO during the windup → nothing.
  - `Horde.spawn` opts gain `site?: TargetId; round?: number`.
  - `SpawnRequest { variant: Variant; role: Role; incidentId?: string; site?: TargetId; round?: number }`; `interface Spawner { request(reqs: SpawnRequest[], opts?: { front?: boolean; interval?: number }): void }`.
  - `class EntryQueue implements Spawner { constructor(cfg = CONFIG.round); length: number; pendingForRound(round: number): number; clear(): void; step(dt: number, horde: Horde, points: Vec[]): Hostile[] }` — a batch's first entry `firstDelay` after `request`, then one per batch `interval` (default 1.5), only while fewer than `gate` hostiles are active; refused by the 40 cap → stays at the head; `front` batches go before the rest.
  - `AttackComposition { firstLine: SpawnRequest[]; reinforcements: SpawnRequest[] }`.
  - `class TargetAttack { constructor(spec: { id: string; target: TargetId; comp: AttackComposition; round: number }, targets: Targets, spawner: Spawner); readonly id; readonly target; readonly kind: CasseKind; stage: 'idle' | 'attack' | 'cinematic' | 'reinforcements' | 'fireOut' | 'saved' | 'destroyed'; start(): boolean /* false on a ruined target */; onMolotov(e: MolotovThrown): SimEvent[] /* ignite → TargetIgnited */; step(dt, ctx: { horde: Horde; rules: Rules }): SimEvent[]; urgent(): boolean /* attack|cinematic|reinforcements */; resolved(): boolean /* saved|destroyed */; requiredActive(horde): boolean; total(): number }`.
    - Damage per step: `(burning ? fireDps : 0) + min(maxDegraders, degraders of this attack in 'degrade') × degradeDps` × dt via `targets.damage`. Reaching 0 → `destroyed`, `targets.ruin`, `award(`${id}:lost`, scores[1])`, `BuildingDestroyed {incidentId, target}`; any queued rioters of this attack stay in the round (they fight Paul).
    - All of its rioters KO'd (pending included; pruned bodies count as KO): with reinforcements left → `cinematic` (school only, `CONFIG.school.cinematicSec`), else → `fireOut`; 1.5 s later `extinguish`, `FireOut`, `saved`, `award(`${id}:saved`, scores[0])`, `TargetSaved` (+ `SchoolRestored` for the school).
  - `lineup(kind: CasseKind, round: number, pressure: number): AttackComposition`: school round 1 = first line `[molotov, degrader, degrader]`, reinforcements `[degrader×4, contact×3]` (10 total, matches today's 11 minus the old 4th thrower-free slot); school later = first line `[molotov, degrader×2, contact]`, no reinforcements, plus `min(6, 2 + floor(P/3))` cycling `degrader, contact`; car/busStop = `[molotov, degrader, degrader, contact]` + `min(3, floor(P/4))` contacts. Every request carries `site`, `incidentId`, `round`; variants round-robin `classic, palestinian, antifa`.
  - `class SchoolIncident extends TargetAttack` — `skipCinematic()`, `suspended()` (stage `cinematic`), `status()` French labels `'en feu' | 'attaquée' | 'renforts' | 'perdue' | 'sauvée'`, `integrity()` = hp % .

- [ ] **Step 1: Write failing tests**

```ts
test('entry queue: first entry 2 s after request, then 1.5 s apart, none while 12 active, front batch jumps the line')
test('entry queue keeps a refused request at the head when the 40 cap is reached')
test('a molotov walks to the car, winds up 1.5 s, emits MolotovThrown at the car door, then chases Paul')
test('a molotov KO during its windup throws nothing and the car never burns')
test('burning school with 3 degraders loses (2 + 3 × 1.2) hp per second; a 5th degrader adds nothing over 4')
test('a degrader of a ruined site retargets Paul')
test('all attackers KO: fire out 1.5 s later, saved +8 once, TargetSaved and SchoolRestored')
test('hp 0: destroyed, target ruined, −3 once, BuildingDestroyed carries the target; start() on a ruin returns false')
test('round-1 school: 3 first-line, cinematic, 7 reinforcements, total 10')
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement; update `tests/sim/hostiles.test.ts` `mkCtx` mechanically; rewrite school tests from reserve seconds to HP.
- [ ] **Step 4:** `npx vitest run tests/sim && npm run typecheck` → PASS (sim.ts may still use the old school API: adapt minimally so it compiles; Task 4 rewires).
- [ ] **Step 5: Commit** `feat(sim): molotov rioters, burning targets with health and a generic attack incident`.

---

### Task 3: Toolboxes and station recharge

**Files:**
- Create: `src/sim/repair.ts`
- Modify: `src/sim/healing.ts`
- Test: `tests/sim/repair.test.ts`, `tests/sim/healing.test.ts` (extend)

**Interfaces:**
- Produces:
  - `class Toolboxes { ground: { id: number; pos: Vec }[]; carried: boolean; progress: number; repairing: TargetId | null; place(sites: Vec[], player: Vec): SimEvent[] /* fill ground to 2 on free sites >= 64 px from Paul, ToolboxSpawned each */; repairTarget(player: Vec, targets: Targets): TargetId | null /* ruined target whose door is within 48 px */; step(dt, ctx: { player: Player; horde: Horde; targets: Targets; rules: Rules }): { events: SimEvent[]; message: 'Caisse à outils requise' | 'Abords non sécurisés' | null } }`.
  - Pickup automatic within 20 px when not carrying (`ToolboxPickedUp`). Repair as Global Constraints; at 2 s → `lost = targets.repair(t)`, `carried = false`, `award(`${lost}:repaired`, scores[2] of its kind)`, `TargetRepaired`. Messages: near a ruin without toolbox → `Caisse à outils requise`; with toolbox and a hostile within 64 px → `Abords non sécurisés`.
  - `Stations.recharge(): void`.

- [ ] **Step 1: Write failing tests**

```ts
test('place fills to 2 on free sites, never within 64 px of Paul, ids never reused')
test('walk over a toolbox picks it up; carrying one leaves the next on the ground')
test('2 s next to the ruined school with no rioter near: repaired to 60 hp, toolbox used, +5, the −3 stays')
test('a burnt car repairs for +3')
test('a hostile within 64 px or leaving range resets progress and consumes nothing')
test('Paul KO on the completing step: no repair')
test('next to an intact target nothing happens')
test('recharge restores used stations')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): toolboxes repair ruined targets automatically; stations recharge`.

---

### Task 4: Round director and sim wiring

**Files:**
- Rewrite: `src/sim/director.ts`
- Modify: `src/sim/sim.ts`, `src/sim/rules.ts`, `src/sim/weapons.ts` (`dropSpecial(player: Vec): GroundWeapon | null`, ground weapons gain `expiresAt: number | null`), `src/sim/incidents/rescue.ts` (`start(..., opts?: { count?: number; round?: number })`, aggressors tagged with `round`), `src/sim/stress.ts` / `scripts/bench-sim.mjs` if they read removed fields
- Create: `tests/sim/autopilot.ts`, `tests/sim/rounds.test.ts`
- Delete/rewrite: `tests/sim/waves.test.ts`, wave parts of `tests/sim/sim.test.ts` and `tests/sim/balance.test.ts` (same intents, rounds instead of waves)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - **Catalogue (Phase A)** — `roundPlan(round, rand, targets): { headline: CasseKind | 'rescue'; beats: ('school' | 'car' | 'busStop' | 'rescue')[][]; twist: 'weaponDrop' | 'secondUrgency' | null }`:
    - r1: beats `[[school], [rescue]]`, twist null.
    - r2: `[[car|busStop], [rescue]]` (rand among intact), twist `weaponDrop`.
    - r3+: beat 0 = one intact target kind drawn with weight 2 if not used last round else 1; beat 1 = rescue; twist alternates `secondUrgency` (odd rounds) / `weaponDrop` (even). A car beat uses whichever of `car1`/`car2` is intact; a beat with no intact target is dropped and its rioters go to the fill.
  - `urgentCap(round) = round < 3 ? 1 : 2`.
  - Director state: `round` (1-based, 1 from the start), `phase: 'intro' | 'play' | 'breather'`, `breatherLeft`, `total`, `roundKos(host)` (KOs of hostiles tagged with this round, clamped to total), `lastSummary: RoundSummary | null`, `pressure(kos)` = `min(12, 1 + floor(round/2) + floor(kos/30))`.
  - `RoundSummary { index; kos; objectives: { kind: CasseKind | 'rescue'; result: 'réussi' | 'perdu' }[]; points: number; bonus: boolean }`.
  - Behaviour:
    - Intro 4 s → round 1. **Round start**: plan; total = max(table total, objective rioters); objective rioters requested `front`; fill = total − objective rioters split in groups of `groupSize` (contacts; throwers 20 % from round 2 via `floor((i+1)·0.2) > floor(i·0.2)`), the **last** group is the climax (`climaxInterval`). `RoundStarted {index, total, headline}`; beat 0 starts at once (school → `SchoolStarted`, others → `CasseStarted`, rescue → `RescueStarted`, `wave` = round index, `total` = round total).
    - Beat k > 0 starts as soon as beat k−1 is resolved and the urgency cap allows. Fill group n+1 is queued only when group n is entirely KO.
    - **Twist** fires once when `roundKos ≥ ceil(twistAt × total)`: `weaponDrop` → `weapons.dropSpecial(player)` (new method: spawns a random weapon 160–480 px away now, ignoring the timer, lifetime 15 s, `TwistStarted`); `secondUrgency` → start an extra attack on another intact target if `urgentCap` allows (its rioters are added to the total and to `RoundStarted`'s count via a new `RoundTotalChanged {index; total}` event), else falls back to `weaponDrop`.
    - **Flow keeper (RC-94)**: in `play`, no active hostile and nothing queued for 1.5 s → queue the next fill group with its first entry at once; if no fill is left, one patrol contact (`round: null`, outside K/T, never blocks the round).
    - **Round completion**: all beats resolved, nothing queued for the round, no active hostile tagged with the round → `bonus` = every objective succeeded → `award('round#<n>:bonus', 5)`; `RoundCompleted`; `stations.recharge()` + `StationsRecharged`; `targets.refill()`; `toolboxes.place(...)`; one `weapons.dropSpecial`; `lastSummary`; phase `breather` 6 s (nothing enters, patrols off); then next round.
  - `Sim`: `targets`, `queue`, `attacks: TargetAttack[]` (school included), `toolboxes`; mutable `school`. Step order: move → strike/return → hostiles → queue entries → rocks → damage → KO check → `MolotovThrown` routed to the attack owning that target → attacks → rescue → toolboxes → stations → weapons → director. `suspended()` = school cinematic. Pause freezes everything (unchanged).
  - `SessionStats` adds `targetsSaved, targetsLost, repairs, roundsCompleted, roundsPerfect` (school counters fed from the school's events as today).
  - `Snapshot`: remove `phase`, `wave`, `waveTotal`, `waveKos`; add `round`, `roundPhase`, `roundTotal`, `roundKos`, `breatherLeft`, `lastSummary`, `targets: { id; kind; hp; maxHp; burning; state: 'intact' | 'attacked' | 'ruined'; door: Vec; footprint: Rect; prop: boolean }[]` (`attacked` = an urgent attack on it), `toolboxes: { ground; carried; progress; message; repairTarget }`, `molotovs: { from; to; until }[]` (bottles in flight 0.6 s, render only), `hostiles[].role` includes `'molotov'` and `hostiles[].windup: boolean`. `school` snapshot keeps `stage`, `integrity` (= hp %), `status`; `remaining` removed.
  - `tests/sim/autopilot.ts`: `autopilot(sim, opts?: { koAfterSec?: number }): InputFrame` — KOs each active hostile once it has been active `koAfterSec` (default 0), skips the cinematic, idles otherwise.

- [ ] **Step 1: Write failing tests** (`tests/sim/rounds.test.ts`)

```ts
test('round is 1 from the start; intro 4 s; round 1 = school then rescue, RoundStarted {1, total: 10 + rescue}')
test('round 2 headline is car or busStop and its twist drops a weapon at half the roster')
test('round 3 secondUrgency starts a second attack and raises the total (RoundTotalChanged)')
test('never more than 1 urgent incident in rounds 1-2 and 2 from round 3')       // autopilot {koAfterSec: 15}, invulnerable, 6 rounds
test('breather: 6 s with no entry after the whole roster is KO; stations recharged; toolboxes refilled to 2; RoundCompleted bonus only if all objectives succeeded')
test('K counts only round-tagged KOs, never exceeds T; patrols do not count')
test('a queued rioter refused by the 40 cap keeps the round open; pruned KO bodies do not')
test('a ruined target is never drawn again until repaired; its planned rioters join the fill')
test('steady flow: autopilot {koAfterSec: 2} over 5 rounds never leaves > 3 s without an active rioter outside intro, cinematic and breather')
test('HP, score, rocks, held weapon and toolbox carry over between rounds; a lost target never ends the session')
test('determinism over 4 rounds with autopilot; hostile count never exceeds 40 over 20 rounds')
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement director + wiring; rewrite the wave tests with the same intents for rounds.
- [ ] **Step 4:** `npx vitest run && npm run typecheck && npm run bench` → PASS, mean per step ≤ 0.3 ms.
- [ ] **Step 5: Commit** `feat(sim): rounds with breather, twist and climax; casse targets wired into the sim`.

---

### Task 5: Rendering — targets, props, fire, ruins, Molotov, toolboxes

**Files:**
- Create: `src/game/render/targets.ts`
- Modify: `src/game/render/world.ts` (SchoolView becomes a `TargetView` instance or delegates to it), `src/game/render/actors.ts`, `src/game/scenes/WorldScene.ts`

**Interfaces:**
- Consumes: `Snapshot.targets`, `toolboxes`, `molotovs`, `hostiles[].role/windup`; events `TargetIgnited`, `FireOut`, `BuildingDestroyed`, `TargetRepaired`, `ToolboxPickedUp`.
- Produces:
  - `TargetView(scene, def)` per target: pixel **HP bar** above the footprint (hidden at full HP when not attacked; green > 50 %, yellow > 25 %, red; flashes white on damage), fire + smoke particles while `burning` (reuse SchoolView's emitters, zone from the footprint), ruin (scorched tint, debris, smoke wisps) when `ruined`, back to normal when repaired. Props as runtime textures, 2× pixels, outline `#14121c`: `car` (top-down compact, two palette variants) → burnt wreck; `busStop` (glass panels, roof, bench) → shattered frame with shards. School keeps today's flag behaviour.
  - Molotov rioter: small bottle in hand; during `windup` a flickering flame on the bottle and a "!" over the head. `MolotovFx`: bottle arc tween `from → to` over 0.6 s, then a flame burst at the door.
  - `ToolboxView`: runtime texture (red-orange toolbox, grey handle), same float/pulse as stations; a toolbox icon over Paul while carried; a ring that fills with `progress / 2` around Paul while repairing.
- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** in the browser pane (`npm run dev`, drive with `window.__game` + the sim): screenshots of the school and a car intact / burning with HP bar / ruined / repaired, a Molotov windup, a toolbox on the ground and carried. Console clean.
- [ ] **Step 3:** `npm run typecheck && npx vitest run` → PASS. **Commit** `feat(game): render target health, fire, ruins, props, molotovs and toolboxes`.

---

### Task 6: HUD, alerts, round panel, audio, spec v1.9

**Files:**
- Modify: `src/game/hud/alerts.ts`, `format.ts`, `hud.ts`, `hud.css`, `ui.ts`, `src/game/audio.ts`, `src/content/controls.ts` (rule lines), `docs/CAHIER_DES_CHARGES.md`, `README.md`
- Test: `tests/game/alerts.test.ts`, `tests/game/hud.test.ts` (update + extend)

**Interfaces:**
- Produces:
  - Alerts: `IncidentKind` adds `car | busStop`; entries `car: { 'VOITURE EN FEU !', 'Chasse les casseurs', 'VOITURE', fire, flame }`, `busStop: { 'ABRIBUS SACCAGÉ !', 'Arrête la casse', 'ABRIBUS', warn, glass }` (new pixel icon `glass`: cracked pane with shards, same palette, ≤ 10×11 art pixels). `AlertKind` `'wave'` → `'round'`: title `MANCHE ${n} !`, sub = headline line (`École en feu`, `Voiture en feu`, `Abribus saccagé`, `Agression en cours`) + ` · ${casseurs(total)}`, label `MANCHE`, no position. Incident meta line `Manche N · T casseurs`. `alertFromEvent`: `CasseStarted`, `RoundStarted`; `TwistStarted weaponDrop` → banner `ARME SPÉCIALE !` / `Fonce la ramasser` positioned at the drop. `activeIncidents` from `snapshot.targets` (`attacked` → kind of the target, pos = door) + rescue.
  - HUD line « Manche N : K/T casseurs » (K clamped to T); a mini HP bar per attacked target in the incident cards (`École 64 %`); toolbox slot `Caisse 0/1` / `1/1`; `contextPrompt` shows `Caisse à outils requise`, `Abords non sécurisés`, `Réparation…` (informational, no Agir button).
  - **Round panel** (HTML, non-modal, top-centre under the HUD, never over Paul or the health panel) while `roundPhase === 'breather'`: `Manche N terminée`, KOs, each objective `réussi / perdu`, `+points`, `Bonus +5` when earned, `Soins rechargés`, and a countdown `Manche N+1 dans 4…`.
  - Summary rows: `Manche atteinte` (replaces `Vague atteinte`), `Manches parfaites`, `Lieux sauvés / détruits`, `Réparations`.
  - Audio: `CasseStarted` → `alarm` once per incident id; `MolotovThrown` → a short whoosh (noise burst, synthesised); `TargetIgnited` → fire loop follows any burning target; `TargetSaved`, `TargetRepaired`, `RoundCompleted` → `chime()` (sine 660 → 880 Hz, 120 ms each); `ToolboxPickedUp` → `pickup`. Threat level follows the lowest attacked target HP.
  - Spec `docs/CAHIER_DES_CHARGES.md` → **v1.9**: rounds with breather/twist/climax (§12.2, RC-94 breather exception), health model + Molotov + fire out (§10), toolbox without F (§10.6–10.7, RCs), firearms rule change and Phase B–D outline (pointer to the design doc). README: link spec v1.9 (fixes the stale "v1.5").

- [ ] **Step 1: Write failing tests**

```ts
test('RoundStarted shows « MANCHE N ! » with its headline and casseurs count, no arrow or distance')
test('CasseStarted car → « VOITURE EN FEU ! » positioned at the car; busStop → « ABRIBUS SACCAGÉ ! »')
test('two attacked targets: second banner waits, both edge indicators show')
test('HUD reads « Manche N : K/T casseurs »; incident card shows the target hp %')
test('round panel lists objectives réussi/perdu, points, bonus only when earned, countdown; hidden outside the breather')
test('toolbox prompts are informational (no Agir button)')
test('summary shows Manche atteinte, Lieux sauvés / détruits, Réparations')
test('chime plays once per TargetSaved / TargetRepaired / RoundCompleted')
```

- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Verify** in the browser pane at desktop and 375×812: play rounds 1–3 (school + Molotov + rescue, a car/bus shelter, a second urgency, a breather panel, a repair). Screenshots; console clean; no gap > 3 s inside a round (timed with `window.__game`).
- [ ] **Step 6:** `npm run typecheck && npm test && npm run build` → PASS. **Commit** `feat(game): round HUD, panel and alerts for burning targets; spec v1.9`.
