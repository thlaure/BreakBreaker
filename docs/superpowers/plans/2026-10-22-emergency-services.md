# Services d'urgence (cabines, pompiers, police) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Two phone booths (red = fire truck, blue = police, 3 calls each), attackable like other props; a fire truck that extinguishes fires, 5 police officers that fight rioters.

**Architecture:** Booths are two new prop targets in `Targets`/`DISTRICT.targets` (open from round 3). A new sim module `Services` owns call counters, call acceptance/refusal and the active truck/police allies; allies are a new `Allies` list (units with hp, pos, role) stepped in `Sim.step`, targeted by hostiles. Render/HUD only read the snapshot and events.

**Tech Stack:** TypeScript, Phaser 4, Vitest, deterministic 60 Hz sim in `src/sim`.

**Spec:** `docs/superpowers/specs/2026-10-22-emergency-services-design.md` (sections 2–7; section 7 overrides earlier text).

## Global Constraints

- Pure deterministic sim in `src/sim` (no Phaser, no `Math.random`); separate rng stream for the arrival edge.
- 3 fire calls + 3 police calls per game; at most 1 truck and 1 police group on the map; police call needs >= 8 active hostiles; fire call needs >= 1 burning target; Paul within 40 px of the booth door, booth standing.
- Booth: 60 hp, points +4 saved / −2 lost / +3 repaired; not attackable or burning before round 3; counts as a place for the two-urgencies rule from round 5.
- Truck: only extinguishes (never repairs), keeps the target's remaining hp, same «sauvé» points as Paul's extinguish, <= 60 s on the map, ~60 hp, hostiles within 160 px may target it. Police: 5 officers, 40 s, KO rioters (+1 each), can be knocked out by rioters, no firearms.
- Every KO = +1; neutral counter; French UI; pixel art; no real persons.
- `npm run typecheck`, `npx vitest run`, `npm run bench` (mean <= 0.3 ms/step), `npm run build` must pass. Commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch `feat/emergency-services`; never merge or push without the user's go.

## Review Focus

- Paul stands at both booths' doors / near a toolbox or kiosk: Agir picks the nearest, ties: repair > red > blue (test).
- Call while the previous truck/police is still on the map is refused without spending a call (test).
- Truck destroyed mid-way: the call stays spent, no extinguish afterward, no crash with a target removed (test).
- Booth ruined: refuses calls, repaired later keeps remaining uses (test).
- Determinism: same seed and inputs give the same arrival edges and outcomes (test).
- No burning place left when the truck arrives: it leaves at once (test).

---

### Task 1: Booths, call mechanism, refusals (sim)

**Files:** Modify `src/sim/types.ts`, `src/sim/map/district.ts`, `src/sim/config.ts`, `src/sim/director.ts`, `src/sim/sim.ts`, HUD text tables as the cars/kiosk did; Create `src/sim/services.ts`; Test `tests/sim/services.test.ts` (+ update draw tests).
**Interfaces — Produces:**
- `TargetId` += `'boothRed' | 'boothBlue'`; `CasseKind` += `'booth'`; `CONFIG.casse.fromRound.booth = 3`.
- `class Services { calls: { fire: number; police: number }; tryCall(kind: 'fire' | 'police', ctx: {burning: number; activeHostiles: number; boothStanding: boolean; busy: boolean}): { ok: true } | { ok: false; reason: 'noFire' | 'fewRioters' | 'noCalls' | 'busy' | 'ruined' } }` (decrements only on ok).
- Events `ServiceCalled { kind: 'fire' | 'police' }`, `ServiceRefused { kind; reason }`; Snapshot `services: { calls: { fire: number; police: number }; hint: { fire: boolean; police: boolean } }` (hint = call currently useful).
- Agir handling: Paul within 40 px of a booth door and Agir pressed (edge) => tryCall; priority per Global Constraints.
- [ ] Tests first: booth targets exist, reachable, door on street row; not drawn/attacked before round 3; points; refusal reasons; counters 3/3 reset on new Sim; Agir priority tie; ruined booth refuses and repair restores uses kept.
- [ ] Implement; island of two booths side by side on a free central-west plaza (check map for a free walkable 4x2 tile area, away from spawns/stations/peaceful group); texts: « CABINE SACCAGÉE ! » banner, cards « Cabine rouge » / « Cabine bleue »; make existing round 3+ draw tests pass or rewrite them (spec §7.5).
- [ ] typecheck, vitest, bench, commit.

### Task 2: Fire truck and police allies (sim)

**Files:** Create `src/sim/allies.ts`; Modify `src/sim/sim.ts`, `src/sim/hostiles.ts` (target choice), `src/sim/types.ts`, `src/sim/config.ts`; Test `tests/sim/allies.test.ts`.
**Interfaces — Consumes:** `ServiceCalled`. **Produces:** `Snapshot.allies: { truck: {pos; hp; maxHp; state: 'arriving'|'spraying'|'leaving'; target: TargetId | null} | null; police: { id: number; pos; hp; state: 'run'|'strike'|'down' }[] }`; events `TruckArrived { from: Vec }`, `TruckSprayed { target: TargetId }`, `TruckDestroyed`, `TruckLeft`, `PoliceArrived { from: Vec; count: number }`, `PoliceDown { id }`, `PoliceLeft`. `CONFIG.services = { truck: { hp: 60, speed, sprayRadius, sprayRate, maxStaySec: 60 }, police: { count: 5, hp, speed, staySec: 40, hitRange }, hostileTargetRadius: 160 }`.
- [ ] Tests first: truck enters from a seeded edge, goes to nearest burning target by the hostile graph, extinguishes several adjacent targets at once, no hp refill, leaves when none burn or after 60 s; truck destroyed by rioters (call stays spent, no later extinguish); police KO rioters (+1 each via `Rules`, energy not gained), police knocked out by rioters, leave after 40 s; hostiles without a place objective choose nearest of Paul/truck/police within 160 px; determinism.
- [ ] Implement with the hostiles' movement/pathing at other speeds; allies outside the 40-hostile cap; Rules award points via unique keys.
- [ ] typecheck, vitest, bench, commit.

### Task 3: Render and HUD

**Files:** Create `src/game/render/booths.ts`, `src/game/render/services.ts` (truck, police, spray, sirens); Modify `src/game/scenes/WorldScene.ts`, `src/game/hud/*`, `src/game/render/targets.ts`; sounds as existing synth helpers.
- [ ] Pixel booths (red/blue, call-count pill, grey when spent, blinking « ! » when `hint`), ruin variant via `TargetView`; fire truck sprite (4 directions or flip), water spray particles, siren sound at call, police pixel sprites (blue uniform, cap, baton), stun stars when down; refusal text under the booth (« Aucun feu à éteindre », « Pas assez de casseurs », « Plus d'appels », « Déjà en route »); truck/police hp bars; edge indicator none; mobile Agir unchanged.
- [ ] Browser check via `/jouer/?go` and `window.__game` console; screenshot booth, truck extinguishing two adjacent targets, police fighting.
- [ ] typecheck, vitest, build, commit; report.

### Task 4: Cahier and final checks

- [ ] Update `docs/SPECS - Index.md` to v1.9.19 (new §, RC numbers continuing from the highest, events, HUD texts, changelog) and README bullet; run all checks; commit.
