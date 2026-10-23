# Main square, church, castle and sauna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a central square with a defendable church, the town hall moved next to it, a castle with a balcony President, three peaceful groups and a sauna egg, as release 1.1.0.

**Architecture:** Map data lives in `src/sim/map/district.ts` (deterministic; reuse building slots 6 and 7 so existing `buildings[i]` indexes stay valid). The church is a new `Targets` kind handled like the town hall. The castle, sauna and President are render-only decor (`src/game/render/decor*.ts` pattern); the President draws from a French quote dictionary with a render-side RNG.

**Tech Stack:** TypeScript strict, Phaser 4.2.1, Vitest, ESLint + Prettier (max-lines 400 code lines per file).

**Spec:** `docs/superpowers/specs/2026-10-23-main-square-design.md`

## Global Constraints

- Sim is deterministic: no `Math.random`, no Phaser in `src/sim`; own rng stream per feature.
- `max-lines` 400 code lines per file; new render code goes in new files (`church*.ts`, `chateau*.ts`, `sauna*.ts`, `president*.ts`).
- In-game text French; code, comments and file names English; no real names (people or parties); no physique, origin or religion caricature; no sexualised depiction.
- Church: 150 HP, appears in the casse table from round 3, counts toward the two-urgency rule, +8 saved / −3 lost / +5 repaired, repair restores 60 % HP, banner « ÉGLISE ATTAQUÉE ! ».
- Version 1.1.0 (medium): bump `package.json`, `package-lock.json`, `CONFIG.appVersion`; keep `rulesVersion` `1.0.0`.
- `npx tsc --noEmit`, `npm run lint` (0 warnings on touched files), `npm run format:check`, `npx vitest run`, `npm run bench` (≤ 0.3 ms/step) must pass.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push.

## Review Focus

- A rioter spawn, heal station, toolbox kit site or Paul's start inside or within 64 px of a new building: the map test must fail on it.
- The church is unreachable (no path from a spawn to its door): test with the flow field.
- Church burning or ruined at the same time as the town hall and a third place: two-urgency cap still holds (never more than two urgent places).
- Three peaceful groups: no overlap with each other, buildings or the monument; the group counter and rescue rules behave as before.
- President off-screen or with reduced motion: nothing animates, no error when the dictionary is exhausted or the camera is far.

---

### Task 1: Map layout and three peaceful groups

**Files:**
- Modify: `src/sim/map/district.ts`, `src/sim/map/grid.ts`, `src/sim/sim.ts` and `src/sim/snapshot.ts` (peaceful group lines), `src/game/render/crowd.ts`, `src/game/render/world.ts`
- Test: `tests/sim/map.test.ts`, `tests/sim/places.test.ts` (extend)

**Interfaces:**
- Produces: `DISTRICT.peacefulGroups: { area: Rect; members: Vec[] }[]` (replaces `peacefulGroup`), `DISTRICT.buildings` slot 1 = town hall `R(15,15,6,4)`, slot 6 = church `R(22,22,4,5)`, slot 7 = château `R(27,14,6,4)`, slot 12 appended = sauna `R(31,29,4,3)`; `DecorId` gains `'chateau' | 'sauna'` with `DISTRICT.decor` entries (`sign: 'CHÂTEAU'`/`'SAUNA'`, doors `C(30,18)` and `C(33,32)`); monument unchanged.

- [ ] **Step 1: Write failing tests** in `tests/sim/map.test.ts`: `three peaceful groups, 6 members each, none overlapping a building, the monument or each other`; `every spawn, heal station, kit site and Paul's start is free and ≥ 64 px from new building doors`; `a flow-field path exists from each hostile spawn to the church door C(24,27) and the town hall door`.
- [ ] **Step 2: Run** `npx vitest run tests/sim/map.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the layout in `district.ts` per the Interfaces block. Groups: areas `R(17,21,3,2)`, `R(27,24,3,2)`, `R(22,29,3,2)` with 6 members laid out like the current one. Move `stations`, `playerSpawn`, `kitSites`, `trunks` and `peacefulGroup` users (`grid.ts`, `sim.ts`, `snapshot.ts`, `crowd.ts`, `world.ts`) only as needed to pass the free-space tests; update the town hall target footprint/door/attack points (`C(16..20,19)`, door `C(18,19)`); the snapshot group field becomes an array (adapt `Snapshot['group']` consumers). Church/château/sauna get no target here (Task 2 adds the church).
- [ ] **Step 4: Run** the full suite; fix fallout from the moved town hall and groups. Expect PASS.
- [ ] **Step 5: Commit** `feat(map): central square layout, three peaceful groups, church/château/sauna footprints`.

### Task 2: Church target in the simulation

**Files:**
- Modify: `src/sim/types.ts` (`CasseKind`, `TargetId`), `src/sim/config.ts`, `src/sim/map/district.ts` (church `building(...)` target), `src/sim/director*.ts` (casse table, `casse.fromRound`), `src/sim/targets.ts` if kinds are listed, `src/game/hud/incidents.ts` (label, banner « ÉGLISE ATTAQUÉE ! »)
- Test: `tests/sim/church.test.ts` (new, model on the town hall/library tests)

**Interfaces:**
- Consumes: Task 1 slot 6 footprint and `C(24,27)` door.
- Produces: `CasseKind` `'church'`, `TargetId` `'church'`, `CONFIG.church = { hp: 150, fromRound: 3 }`.

- [ ] **Step 1: Failing tests** in `tests/sim/church.test.ts`: `church has 150 hp and a reachable door`; `never chosen before round 3, chosen sometimes from round 3 over ten bot rounds`; `burns and ruins like the town hall; repair restores 60 %`; `scores +8 saved, −3 lost, +5 repaired`; `counts toward the two-urgency rule (never more than two urgent places)`; `a ruined church reduces nothing else (rioters re-target)`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** by following the town hall's code path wherever `'townHall'` appears (grep it); church-specific only in config, label and banner copy.
- [ ] **Step 4: Run** the full suite plus `npm run bench` — PASS, ≤ 0.3 ms/step.
- [ ] **Step 5: Commit** `feat(sim): the church, a fifth building to defend from round 3`.

### Task 3: Render the square (church, town hall, castle shell, sauna shell, groups)

**Files:**
- Create: `src/game/render/churchFront.ts`, `src/game/render/chateauFront.ts`, `src/game/render/saunaFront.ts`
- Modify: `src/game/render/world.ts`, `src/game/render/buildingFronts.ts` (town hall at its new place), `src/game/render/decor.ts` registration, `src/game/render/crowd.ts`, `src/game/render/targets.ts` if textures per kind
- Test: `tests/game/` pure-helper tests for any new `*Math.ts`; browser check

**Interfaces:**
- Consumes: Task 1 `DISTRICT.decor` ids `'chateau'`/`'sauna'`, slot 6 church footprint, Task 2 `'church'` target kind (HP bar, fire, ruin textures like the town hall).
- Produces: `buildChateauFront(...)` returning an anchor `{ balcony: Vec }` used by Task 4.

- [ ] **Step 1: Implement** the church front (bell tower, slate roof, arched door, stained glass; ruin/fire states via the existing target textures), castle shell (stone walls, towers, battlements, balcony ledge facing the square; balcony position returned), sauna shell (wooden front, lantern, steamed window, sign « Sauna – Ne pas déranger »; steam particles off under `prefers-reduced-motion`), three crowd groups from `DISTRICT.peacefulGroups`. Follow the existing front/decor patterns; no logic in sim.
- [ ] **Step 2: Browser check** (`preview_start` dev, `/play/?go&stress=8`): screenshots of the square, church burning and ruined (use `window.__game`), castle, sauna; `read_console_messages` has no errors; mobile 375×812 shows the HUD unchanged.
- [ ] **Step 3: Run** tsc, lint, format, vitest. Commit `feat(render): church, castle, sauna and three peaceful groups on the square`.

### Task 4: The President on the balcony

**Files:**
- Create: `src/game/render/president.ts`, `src/game/render/presidentMath.ts` (pure mood/timing helpers), `src/content/quotes.ts` (dictionary)
- Modify: `src/game/render/chateauFront.ts` (mount), `src/game/render/world.ts` (update hook)
- Test: `tests/game/presidentMath.test.ts`, `tests/content/quotes.test.ts`

**Interfaces:**
- Consumes: Task 3 `buildChateauFront` balcony anchor.
- Produces: `QUOTES: readonly string[]` (20–30 short French public phrases, no names), `nextMood(rand: () => number, current: Mood): Mood` with `type Mood = 'arms' | 'cry' | 'angry' | 'calm'`, `moodHoldMs(rand: () => number): number` (3000–6000), `quoteDelayMs(rand: () => number): number` (8000–14000), `pickQuote(rand: () => number, last: string | null): string` (never repeats `last`).

- [ ] **Step 1: Failing tests**: `quotes are 20–30 entries, each ≤ 60 characters, none contains a name from a forbidden list (macron, sarkozy, hollande, chirac, royal, trump, poutine, putin, khamenei)`; `nextMood never returns the current mood`; `moodHoldMs in [3000, 6000]`; `quoteDelayMs in [8000, 14000]`; `pickQuote never repeats last and covers the whole list over many draws`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** the helpers and the dictionary (e.g. « C'est de la poudre de perlimpinpin ! », « Abracadabrantesque ! », « Moi, président de la République… », « On est en guerre ! », plus others kept short and public), then the pixel President (blue suit, generic face, four mood poses, speech bubble) driven by a render-side seeded rng; stronger agitation when Paul is within 6 tiles; nothing drawn or updated off-screen; reduced motion: frozen pose, bubble still shown.
- [ ] **Step 4: Browser check**: screenshots of two moods and a bubble; no console error. Commit `feat(render): the President on the castle balcony with quote bubbles`.

### Task 5: Release 1.1.0

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/sim/config.ts` (`appVersion: '1.1.0'`), `CHANGELOG.md`, `ROADMAP.md`, `README.md`, `docs/SPECS - *.md`, `tests/build.test.ts` if it pins a version

- [ ] **Step 1:** Update the specs in English (map section, the church and its scoring, decor castle/sauna, President behaviour, peaceful groups, version history 1.1.0) with the next RC numbers after the current highest; CHANGELOG 1.1.0 (French, player-facing: place, église, château et Président, sauna, trois groupes pacifiques); ROADMAP: move the castle and sauna to « Fait » (link to the changelog), keep « La France d'abord » as 2.0.0; bump versions.
- [ ] **Step 2:** Run all gates from Global Constraints, run the bot over ten rounds to check balance (the church must not make round 3 unwinnable; report how often it is attacked), re-run the link checker for docs. Commit `release: 1.1.0`.
