# BreakBreaker — First Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Three.js prototype with a playable 2D top-down Phaser 4 slice: Paul moves freely in one Paris district, fights rioter hordes in melee, picks up thrown rocks and throws them back, defends the school under a local countdown, answers one rescue event, heals at two stations, and plays until KO — on desktop and phone, reached from a light landing page.

**Architecture:** All gameplay lives in a pure, deterministic TypeScript simulation (`src/sim/`, no Phaser import) stepped at a fixed 60 Hz and fully unit-tested with Vitest. Phaser scenes only read a sim snapshot each frame to draw sprites and feed an `InputFrame` back in; HUD and menus are HTML/CSS over the canvas. Two Vite entry points: `/` (landing, zero game assets) and `/jouer/` (game).

**Tech Stack:** TypeScript 5, Vite (locked), Phaser 4 (exact version locked), Vitest, Node 22. Art: Universal LPC spritesheets (characters, 64×64 frames), LPC Modern Streets + Kenney RPG Urban / Roguelike Modern City (tiles, CC0), Kenney Impact Sounds + RPG Audio (CC0).

**Spec:** `docs/CAHIER_DES_CHARGES.md` (v1.4). Agreed deviations from the spec, binding for this plan:
- Hero is **Paul**, a fictional shopkeeper — no Micromania, no real-person references, no press links.
- **Every rioter KO scores +1**, whatever its flag. Flags are cosmetic only.
- No OQTF counter and no satirical deportation/denationalisation lines: the HUD and summary show a neutral **"Casseurs neutralisés"** count.
- Tiles are **32 px**, characters use LPC **64×64 frames** (visible body ≈ 32×48); internal view **640 × 360** landscape / **360 × 640** portrait (replaces spec 15.2 sizes).

## Slice scope

In: landing + `/jouer/`, loading + Commencer, one district, 8-direction movement with solid buildings/trunks, melee sweep, contact and thrower rioters in 3 visual variants, rock cycle (throw → land → pick up → throw back → inert), one peaceful group (protected, blocks Paul's hits and rocks), school incident (30 s reserve, 3 + 8 rioters, saved/destroyed), one rescue event, two heal stations, endless waves with pressure formula until KO, pause, summary, local record, keyboard + mouse + touch.

Out (later plans): monument capture, shop, repair kits, rounds/round transitions, small field heals, multiple rescues and simultaneous urgencies, gamepad, remapping UI, quality profiles, Discovery mode, dialogues.

## Global Constraints

- Static build only; no backend, no analytics, no cookies, no network after load (spec 17.1, 20.3).
- Three.js, Rapier, GLB, KTX2 must not be in the build (spec 17.2).
- Landing downloads zero engine/atlas/sound bytes; ≤ 300 KB own HTML/CSS/JS compressed (spec 26.6).
- Simulation 60 Hz fixed step, render separate; logical float coords, rounded only at render (spec 18.5).
- Pixel art: Phaser `pixelArt: true`, `roundPixels: true`, integer zoom when possible, never stretched (spec 15.2, 19.3).
- No firearms, no gore, no surrender/arrest state (EX-06, EX-07).
- Peaceful group and rescue victim never take damage, score or KO from Paul (EX-10, 8.5).
- Caps: 40 active hostiles, 24 flying projectiles, 16 recoverable rocks, 3 carried rocks (18.4).
- No global countdown; session ends only on KO or voluntary quit (12.1).
- Pause / tab hidden: all timers, AI, projectiles suspended; all inputs released (12.8, 14.1).
- `localStorage` access always wrapped in try/catch; game plays without it (20.1, RC-43).
- UI text in French; every asset author and license listed in `public/CREDITS.md` and reachable from landing footer and game pause menu (LPC CC-BY-SA requirement).
- Touch targets ≥ 44 × 44 CSS px; no page zoom/scroll/text selection from game controls (7, 26.5).

## Review Focus

1. **Low frame rate / tab switching** — a 15 fps device or a returning background tab must not make rocks tunnel through Paul or timers jump: the sim caps catch-up steps (max 5 per frame) and segment-tests projectiles. Test in Task 2 and Task 5.
2. **Rioter stuck behind the peaceful group or a building** — agents must reach Paul or the school facade, never freeze in place. Test in Task 3 (flow field routes around group volume).
3. **Multi-touch** — holding the joystick while tapping Frapper/Renvoyer must work; a lost pointer (`pointercancel`, blur) releases everything. Test in Task 11.
4. **Same-step KO and heal** — a heal completing in the step Paul reaches 0 HP must not revive him. Test in Task 9.
5. **Rock landing inside a building, group volume or off-map** — it must be removed, never become an unreachable recoverable. Test in Task 5.

---

## File Structure

```text
index.html                     landing (Vite entry 1)
jouer/index.html               game page (Vite entry 2)
src/site/landing.css           landing styles (no JS needed)
src/game/main.ts               boot Phaser, loading UI, Commencer, errors/Réessayer
src/game/scenes/BootScene.ts   preload atlases, tiles, sounds with progress events
src/game/scenes/WorldScene.ts  draws tiles, actors, rocks, telegraphs; drives Sim
src/game/render/actors.ts      LPC animation keys, depth by feet, flag props
src/game/hud/hud.ts            HTML HUD (HP, score, KO, rocks, incidents, arrow)
src/game/hud/menus.ts          pause, quit confirm, summary, credits
src/game/input/keyboard.ts     keys + mouse -> InputFrame
src/game/input/touch.ts        joystick + buttons -> InputFrame
src/game/audio.ts              unlock on gesture, sound groups, mute
src/game/storage.ts            versioned prefs + record, try/catch
src/sim/config.ts              all tuning values (CONFIG)
src/sim/types.ts               Vec, InputFrame, entities, SimEvent union
src/sim/math.ts                vec helpers, segment-vs-circle, angle tests
src/sim/clock.ts               FixedClock (accumulator, pause, catch-up cap)
src/sim/rng.ts                 seeded mulberry32
src/sim/map/district.ts        district data: size, buildings, trunks, zones, spawns
src/sim/map/grid.ts            solid grid from district, isSolid, line of sight
src/sim/map/collide.ts         moveCircle against grid (slide)
src/sim/map/flowfield.ts       BFS flow fields toward targets
src/sim/spatial.ts             spatial hash for neighbours/contacts
src/sim/player.ts              movement, facing, sweep, invulnerability
src/sim/hostiles.ts            rioter roles, state machines, separation
src/sim/projectiles.ts         rock lifecycle and pools
src/sim/rules.ts               score, KO registry, session stats
src/sim/incidents/school.ts    school incident
src/sim/incidents/rescue.ts    rescue incident
src/sim/healing.ts             heal stations
src/sim/director.ts            sequencing, pressure, spawns, caps
src/sim/sim.ts                 Sim class: wires everything, step(), snapshot()
scripts/fetch-assets.mjs       download pinned asset packs to assets-source/
scripts/build-lpc.mjs          compose LPC layers into sheets + credits
public/assets/...              exported sheets, tiles, sounds
public/CREDITS.md              authors/licenses
tests/sim/*.test.ts            Vitest unit tests per sim module
tests/build.test.ts            build output checks
```

---

### Task 1: Scaffold Vite + TS + Phaser, remove the 3D prototype

**Files:**
- Delete: `dist/`, `server.mjs`, `tests/mission.test.mjs`, `tests/rules.test.mjs`, `preview.png`, `preview-paris.png`, `.openai/` (user said hosting is not that target)
- Create: `package.json` (replace), `tsconfig.json`, `vite.config.ts`, `index.html`, `jouer/index.html`, `src/game/main.ts`, `src/site/landing.css`, `.gitignore`, `tests/build.test.ts`
- Modify: `README.md` (rewrite: slice description, `npm run dev|test|build`, deviations listed above)

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`). Build output in `dist/` with `dist/index.html` and `dist/jouer/index.html`.

- [ ] **Step 1:** `git init`, add `.gitignore` (`node_modules`, `dist`, `assets-source`), commit current state as `chore: snapshot 3D prototype before rewrite` so the old code stays in history.
- [ ] **Step 2:** Delete the files listed above. Run `npm view phaser versions --json` and pick the newest stable `4.x` published ≥ 14 days ago (spec cites 4.2.1); install `phaser@<exact>` and dev deps `vite typescript vitest @types/node` with exact versions (`--save-exact`).
- [ ] **Step 3:** `vite.config.ts`: `build.rollupOptions.input = { main: 'index.html', jouer: 'jouer/index.html' }`, `base: './'` is NOT used (absolute `/` routes required). `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`.
- [ ] **Step 4: Write the failing test** `tests/build.test.ts` (runs `vite build` once in `beforeAll` via `execSync`):

```ts
test('two entry points are emitted', () => {
  expect(existsSync('dist/index.html')).toBe(true);
  expect(existsSync('dist/jouer/index.html')).toBe(true);
});
test('landing pulls no game code', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html).not.toMatch(/phaser|<script/i);
});
test('no three.js anywhere in build', () => {
  const all = globSync('dist/**/*.js').map(f => readFileSync(f, 'utf8')).join('');
  expect(all).not.toMatch(/THREE\.|three\.module/);
});
```

- [ ] **Step 5:** Run `npx vitest run tests/build.test.ts` → FAIL (no html files).
- [ ] **Step 6:** Create `index.html` with a placeholder `<h1>BreakBreaker</h1>` and `<a href="/jouer/">Jouer</a>` (no script tag; styles via `<link>` to `src/site/landing.css`). Create `jouer/index.html` with `<div id="game"></div>` and `<script type="module" src="/src/game/main.ts">`. `main.ts` creates a `Phaser.Game` with `type: Phaser.WEBGL, pixelArt: true, roundPixels: true, scale: { mode: Phaser.Scale.FIT, autoCenter: CENTER_BOTH, width: 640, height: 360 }` and an empty scene.
- [ ] **Step 7:** Run `npx vitest run` and `npx tsc --noEmit` → PASS. `npm run dev`, open `/` and `/jouer/` → both load, no console errors.
- [ ] **Step 8: Commit** `chore: replace Three.js prototype with Vite + TS + Phaser 4 scaffold`.

---

### Task 2: Sim foundations — config, types, math, fixed clock, rng

**Files:**
- Create: `src/sim/config.ts`, `src/sim/types.ts`, `src/sim/math.ts`, `src/sim/clock.ts`, `src/sim/rng.ts`
- Test: `tests/sim/clock.test.ts`, `tests/sim/math.test.ts`

**Interfaces:**
- Produces:
  - `CONFIG` (readonly object). Values: `step: 1/60`, `maxCatchUpSteps: 5`, `tile: 32`, `mapTiles: 48`, `player: { maxHp: 100, walk: 90*2, run: 125*2, radius: 7, invulnSec: 0.6 }` (spec speeds ×2 because tiles are 32 px), `melee: { cooldown: 0.45, range: 28*2, arcDeg: 90, maxTargets: 3 }`, `hostile: { baseHp: 2, contactDamage: 5, attackInterval: 1.8, windup: 0.5, radius: 7, speed: 70*2 }`, `rock: { windupMin: 0.6, rangeMin: 140*2, rangeMax: 180*2, flightMin: 0.5, damage: 5, pickupRadius: 14*2, maxCarried: 3, returnDamage: 1, returnRange: 180*2, returnCooldown: 0.5, maxFlying: 24, maxGround: 16, throwInterval: 3.0 }`, `school: { threatSeconds: 30, firstLine: 3, reinforcements: 8, cinematicSec: 3, saveBonus: 8, lossPenalty: -3 }`, `rescue: { threatSeconds: 25, aggressors: [2, 4], helpSec: 1, bonus: 6 }`, `heal: { amount: 25, interactSec: 1.5 }`, `caps: { hostiles: 40, windupsContact: [2, 4], windupsThrow: [2, 4] }`, `pressureMax: 12`, `idlePatrolSec: 25`, `rulesVersion: 'slice-0.1.0'`.
  - `types.ts`: `Vec {x,y}`; `InputFrame { move: Vec; aim: Vec | null; run: boolean; strike: boolean; throwRock: boolean; act: boolean }` (strike/throwRock are edge-triggered presses, act is held); `Variant = 'classic' | 'palestinian' | 'antifa'`; `Role = 'contact' | 'thrower' | 'degrader' | 'aggressor'`; `SimEvent` discriminated union with `type` from spec 18.3 names used in this slice (`HitConfirmed`, `EnemyThrowStarted`, `ProjectileLanded`, `ProjectilePickedUp`, `ProjectileReturned`, `ProtectedGroupBlockedImpact`, `ActorKnockedOut`, `PlayerDamaged`, `BuildingThreatStarted`, `BuildingThreatPaused`, `BuildingDestroyed`, `SchoolRestored`, `RescueStarted`, `RescueSecured`, `RescueCompleted`, `RescueFailed`, `HealCompleted`, `HealInterrupted`, `WaveAnnounced`, `PlayerKnockedOut`).
  - `math.ts`: `len, norm, sub, add, scale, dist`, `inArc(origin: Vec, facing: Vec, target: Vec, range: number, arcDeg: number): boolean`, `segmentCircleHit(a: Vec, b: Vec, c: Vec, r: number): number | null` (returns t∈[0,1] of first contact).
  - `FixedClock { constructor(step: number, maxSteps: number); paused: boolean; advance(realDtSec: number): number /* steps to run */; activeTime: number }`.
  - `rng(seed: number): () => number`.

- [ ] **Step 1: Write failing tests**

```ts
test('clock yields whole steps and keeps remainder', () => {
  const c = new FixedClock(1/60, 5);
  expect(c.advance(1/60 * 2.5)).toBe(2);
  expect(c.advance(1/60 * 0.5)).toBe(1);
});
test('clock caps catch-up after a long frame and drops the excess', () => {
  const c = new FixedClock(1/60, 5);
  expect(c.advance(3)).toBe(5);
  expect(c.advance(0)).toBe(0);
});
test('paused clock yields no steps and no active time', () => {
  const c = new FixedClock(1/60, 5); c.paused = true;
  expect(c.advance(1)).toBe(0); expect(c.activeTime).toBe(0);
});
test('inArc: 90° arc, range 56', () => {
  expect(inArc({x:0,y:0},{x:1,y:0},{x:50,y:10},56,90)).toBe(true);
  expect(inArc({x:0,y:0},{x:1,y:0},{x:0,y:50},56,90)).toBe(false);
  expect(inArc({x:0,y:0},{x:1,y:0},{x:60,y:0},56,90)).toBe(false);
});
test('segmentCircleHit catches a fast segment passing through', () => {
  expect(segmentCircleHit({x:-100,y:0},{x:100,y:0},{x:0,y:0},7)).toBeCloseTo(93/200, 2);
  expect(segmentCircleHit({x:-100,y:20},{x:100,y:20},{x:0,y:0},7)).toBeNull();
});
```

- [ ] **Step 2:** Run `npx vitest run tests/sim` → FAIL.
- [ ] **Step 3:** Implement the modules above.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(sim): config, types, math helpers, fixed clock`.

---

### Task 3: District map, collision and navigation

**Files:**
- Create: `src/sim/map/district.ts`, `src/sim/map/grid.ts`, `src/sim/map/collide.ts`, `src/sim/map/flowfield.ts`, `src/sim/spatial.ts`
- Test: `tests/sim/map.test.ts`

**Interfaces:**
- Produces:
  - `District { tiles: 48; buildings: Rect[]; trunks: Circle[]; peacefulGroup: { area: Rect; members: Vec[] }; school: { footprint: Rect; facadePoints: Vec[]; zone: Circle; door: Vec }; stations: Vec[2]; playerSpawn: Vec; hostileSpawns: Vec[]; rescueSites: Vec[] }` with `Rect {x,y,w,h}` in pixels, `Circle {x,y,r}`. `DISTRICT: District` hand-authored constant: 1536×1536 px, ~10 buildings, ~8 trees, school north-west reachable in ≤ 12 s walk from spawn, peaceful group in a square leaving ≥ 2 routes around it, 6 hostile spawns on map edges, 3 rescue sites, stations near spawn and east side.
  - `Grid { constructor(d: District); isSolid(tx: number, ty: number): boolean; isSolidPx(p: Vec): boolean; lineClear(a: Vec, b: Vec): boolean }` — buildings and trunks are solid; the peaceful group area is solid for **movement** and line tests (they are volumes to walk around), flagged separately as `isGroup(p)`.
  - `moveCircle(grid: Grid, pos: Vec, delta: Vec, r: number): Vec` — axis-separated slide; never ends inside solid.
  - `FlowField { constructor(grid: Grid); rebuild(target: Vec): void; dirAt(p: Vec): Vec }` — BFS over 8-neighbour tiles (no corner cutting), rebuilt at most every 0.25 s per target.
  - `SpatialHash<T extends {id:number,pos:Vec}> { constructor(cell: number); clear(); insert(e: T); query(p: Vec, r: number): T[] }`.

- [ ] **Step 1: Write failing tests**

```ts
test('diagonal move is not faster than straight', () => {
  const p1 = moveCircle(grid, open, {x: 3, y: 0}, 7);
  const p2 = moveCircle(grid, open, scale(norm({x:1,y:1}), 3), 7);
  expect(dist(open, p2)).toBeCloseTo(dist(open, p1), 5);
});
test('cannot walk through a building or a trunk (RC-51)', () => {
  let p = leftOfBuilding;
  for (let i = 0; i < 200; i++) p = moveCircle(grid, p, {x: 3, y: 0}, 7);
  expect(grid.isSolidPx(p)).toBe(false);
  expect(p.x).toBeLessThan(DISTRICT.buildings[0].x);
});
test('flow field routes around the peaceful group (RC-23)', () => {
  const ff = new FlowField(grid); ff.rebuild(behindGroup);
  let p = frontOfGroup;
  for (let i = 0; i < 2000 && dist(p, behindGroup) > 16; i++) p = moveCircle(grid, p, scale(ff.dirAt(p), 2), 7);
  expect(dist(p, behindGroup)).toBeLessThanOrEqual(16);
});
test('every station, school door and rescue site is reachable from spawn', () => {
  const ff = new FlowField(grid); ff.rebuild(DISTRICT.playerSpawn);
  for (const t of [...DISTRICT.stations, DISTRICT.school.door, ...DISTRICT.rescueSites])
    expect(ff.dirAt(t)).not.toEqual({x:0,y:0});
});
test('spatial hash returns only nearby entities', () => {
  const h = new SpatialHash(64); h.insert({id:1,pos:{x:10,y:10}}); h.insert({id:2,pos:{x:500,y:500}});
  expect(h.query({x:0,y:0}, 50).map(e => e.id)).toEqual([1]);
});
```

(`open`, `leftOfBuilding`, `frontOfGroup`, `behindGroup` are fixtures computed from `DISTRICT` in the test file.)

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5: Commit** `feat(sim): district map, collisions, flow fields, spatial hash`.

---

### Task 4: Rules — score and KO registry

**Files:**
- Create: `src/sim/rules.ts`
- Test: `tests/sim/rules.test.ts`

**Interfaces:**
- Produces: `class Rules { score: number; kos: number; stats: SessionStats; ended: boolean; onKnockout(actorLifeId: number): boolean /* false if duplicate */; award(occurrenceKey: string, points: number): boolean /* dedup by key */; end(cause: 'ko' | 'quit'): void }`. `SessionStats { schoolsSaved, schoolsLost, rescuesOk, rescuesFailed, healsUsed, rocksPicked, rocksReturned, rocksHit, activeSeconds }`. After `end()`, `onKnockout` and `award` return false and change nothing.

- [ ] **Step 1: Write failing tests**

```ts
test('every variant scores +1 at KO, counted once (RC-08, equal scoring)', () => {
  const r = new Rules();
  expect(r.onKnockout(1)).toBe(true); expect(r.onKnockout(1)).toBe(false); r.onKnockout(2);
  expect(r.score).toBe(2); expect(r.kos).toBe(2);
});
test('occurrence bonuses are awarded once per key', () => {
  const r = new Rules();
  r.award('school#1:saved', 8); r.award('school#1:saved', 8);
  expect(r.score).toBe(8);
});
test('no gains after session end', () => {
  const r = new Rules(); r.end('ko');
  expect(r.onKnockout(5)).toBe(false); expect(r.award('x', 6)).toBe(false); expect(r.score).toBe(0);
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): scoring and KO registry with dedup`.

---

### Task 5: Projectiles — throw, land, pick up, return

**Files:**
- Create: `src/sim/projectiles.ts`
- Test: `tests/sim/projectiles.test.ts`

**Interfaces:**
- Consumes: `Grid`, `segmentCircleHit`, `CONFIG.rock`.
- Produces:
  - `RockState = 'EnemyFlying' | 'LandedRecoverable' | 'PlayerFlying' | 'Removed'` (windup lives on the hostile, not the rock).
  - `Rock { id: number; lifeId: number; state: RockState; owner: 'enemy' | 'player'; kind: 'caillou' | 'pave' | 'brique'; pos: Vec; from: Vec; to: Vec; t: number; duration: number; landedAt: number }`.
  - `class Rocks { constructor(grid: Grid); carried: number; flying(): Rock[]; ground(): Rock[]; spawnEnemy(from: Vec, to: Vec, now: number): Rock | null /* null if maxFlying */; returnRock(from: Vec, dir: Vec, now: number): Rock | null /* null if carried 0 or cooldown */; step(dt: number, now: number, ctx: RockCtx): SimEvent[] }`.
  - `RockCtx { player: { pos: Vec; r: number; invulnerable: boolean }; hostiles: { lifeId: number; pos: Vec; r: number; active: boolean }[]; groupBlocks(a: Vec, b: Vec): number | null; victimPos: Vec | null }`.
  - Enemy rock: straight 2D segment from `from` to `to`, `duration = max(flightMin, dist/220)`; each step tests swept segment vs Paul circle (first, unless invulnerable), vs group, vs solid grid; on Paul hit → `PlayerDamaged {amount: 5}` then lands at hit point; on solid or group → stop; landing tile must be non-solid, non-group, inside map, else `Removed`. Enemy rocks never damage hostiles or victim.
  - Pickup: auto when `LandedRecoverable` within `pickupRadius` and `carried < 3`; emits `ProjectilePickedUp` once.
  - Player rock: from Paul along `dir` up to `returnRange`, hits first active hostile along the segment (one only) → `HitConfirmed {targetLifeId, damage: 1, source: 'rock'}`; group or solid first → `ProtectedGroupBlockedImpact` / stop; always ends `Removed` (never recoverable).
  - Ground cap 16: on overflow recycle the oldest ground rock farther than 64 px from Paul, else remove the new one.

- [ ] **Step 1: Write failing tests** (one `test` each; values from spec 8.3 / RC-11…RC-22):

```ts
test('dodged rock lands recoverable (RC-11)')            // spawnEnemy, step past duration, ground().length === 1
test('rock hitting Paul damages once then lands (RC-12)') // events filter PlayerDamaged length 1, amount 5
test('flying rock is never picked up (RC-13)')            // Paul on its path mid-flight: carried stays 0 until landed
test('pick up within 28 px, once (RC-14, RC-20)')         // two steps on top: carried 1, one ProjectilePickedUp
test('stock full leaves rock on ground (RC-15)')          // carried = 3, ground().length stays 1
test('return consumes stock, empty stock does nothing (RC-16, RC-17)') // returnRock with 0 -> null, carried never < 0
test('returned rock hits one hostile then is removed (RC-18, RC-19)')  // two hostiles in line: one HitConfirmed; rock Removed, never ground
test('returned rock stops on peaceful group without damage (RC-22, RC-24)') // ProtectedGroupBlockedImpact, no HitConfirmed for hostile behind
test('fast rock at 12 fps does not tunnel through Paul')  // step(1/12) x N still yields PlayerDamaged
test('rock landing on building/group/off-map is removed')  // to = point inside building -> state Removed, ground() empty
test('flying cap 24 and ground cap 16 recycle oldest away from Paul (RC-46)')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): rock throw/land/pickup/return lifecycle`.

---

### Task 6: Player and hostiles — movement, sweep, roles, AI

**Files:**
- Create: `src/sim/player.ts`, `src/sim/hostiles.ts`
- Test: `tests/sim/combat.test.ts`, `tests/sim/hostiles.test.ts`

**Interfaces:**
- Consumes: `moveCircle`, `FlowField`, `SpatialHash`, `inArc`, `Rocks.spawnEnemy`, `CONFIG`.
- Produces:
  - `Player { pos: Vec; facing: Vec; hp: number; invulnUntil: number; strikeReadyAt: number; swingId: number; ko: boolean }`; `stepPlayer(p: Player, input: InputFrame, dt: number, now: number, grid: Grid): void` (aim overrides facing; else last non-zero move); `sweep(p: Player, now: number, targets: HostileView[]): { swingId: number; hits: number[] /* lifeIds */ }` — active hostiles in arc, nearest first, max 3, blocked if `grid.lineClear` false or group between; never includes group members or victim (they are not in `targets` by construction). `damagePlayer(p, amount, now): boolean` respects invulnerability 0.6 s; sets `ko` at hp ≤ 0.
  - `Hostile { lifeId: number; variant: Variant; role: Role; pos: Vec; hp: number; maxHp: number; state: 'approach' | 'windup' | 'recover' | 'degrade' | 'threaten' | 'ko'; stateUntil: number; nextAttackAt: number; incidentId: string | null; target: 'player' | 'facade' | 'victim' }`.
  - `class Horde { list: Hostile[]; spawn(opts: { variant: Variant; role: Role; pos: Vec; maxHp?: number; incidentId?: string; target?: Hostile['target'] }): Hostile | null /* null at cap 40 */; applyHit(lifeId: number, dmg: number): 'hit' | 'ko' | 'ignored'; step(dt: number, now: number, ctx: HordeCtx): SimEvent[]; active(): Hostile[] }`.
  - `HordeCtx { player: Player; grid: Grid; fields: { player: FlowField; school: FlowField; victim: FlowField | null }; rocks: Rocks; facadePoints: Vec[]; victimPos: Vec | null; schoolStanding: boolean; pressure: number }`.
  - Behaviour: contact → approach, windup 0.5 s at ≤ 20 px, hit 5 (scaled by pressure, cap 12), recover until interval; thrower → keep 160–300 px from Paul with `lineClear`, windup ≥ 0.6 s (emits `EnemyThrowStarted {from, to}` at windup start so the renderer shows the target marker), spawn rock at end, else falls back to contact when < 80 px; degrader → go to nearest facade point, `degrade` state while within 24 px and school standing, switch to `player` target when school destroyed; aggressor → `threaten` within 24 px of victim. Director limit: at most `windupsContact`/`windupsThrow` hostiles in windup at once (others wait in approach/reposition). Separation via spatial hash. KO hostiles are skipped everywhere and do not block movement. Stuck detection: no progress > 8 px in 2 s → rebuild field / pick next facade point.

- [ ] **Step 1: Write failing tests**

```ts
test('sweep hits at most 3, each once per swing (RC-06)')   // 5 hostiles in arc -> hits.length 3; same swingId again -> no repeat
test('two hits KO a rioter, KO body takes no more hits (RC-07, RC-08)') // applyHit -> 'hit','ko','ignored'
test('sweep cannot reach through a building or the group (RC-24)')
test('8-direction move: diagonal same speed as straight (RC-03)')
test('invulnerability window 0.6 s blocks the second hit (RC-12)')
test('thrower winds up >= 0.6 s before rock exists (RC-10)') // EnemyThrowStarted at t0, Rocks flying empty until t0+0.6
test('no more than 2 contact windups at pressure 1')         // 6 contact hostiles adjacent: count state==='windup' <= 2
test('degrader reaches facade and enters degrade; switches to player when school destroyed')
test('spawn returns null beyond 40 active hostiles (RC-46)')
test('stuck hostile still reaches Paul around the group within 20 s')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): player melee and rioter roles with windup limits`.

---

### Task 7: School incident

**Files:**
- Create: `src/sim/incidents/school.ts`
- Test: `tests/sim/school.test.ts`

**Interfaces:**
- Consumes: `Horde`, `Rules`, `CONFIG.school`.
- Produces: `class SchoolIncident { id: string /* 'school#1' */; stage: 'idle' | 'firstLine' | 'cinematic' | 'reinforcements' | 'saved' | 'destroyed'; remaining: number /* seconds reserve */; integrity(): number /* 100*remaining/30 */; status(): 'en cours' | 'interrompu' | 'perdu' | 'sauvé'; start(horde: Horde, spawns: Vec[]): void /* 3 degraders, one per variant */; step(dt: number, ctx: { horde: Horde; rules: Rules; playerInZone: boolean; spawns: Vec[] }): SimEvent[]; suspended(): boolean /* true during cinematic */ }`.
- Rules: `remaining -= dt` only while ≥ 1 hostile of this incident is in state `degrade`; does not depend on Paul entering; first line all KO → `cinematic` 3 s (sim reports `suspended()` so Sim freezes all other timers) → spawn 8 reinforcements (mixed roles: 4 degraders, 2 contact, 2 throwers, variants round-robin) → all KO with `remaining > 0` → `saved`, `award('school#1:saved', 8)`, `SchoolRestored`. `remaining` hits 0 → `destroyed`, `award('school#1:lost', -3)`, `BuildingDestroyed`, survivors retarget player, no reinforcement spawned if not yet spawned. Re-entering the zone changes nothing (RC-26, RC-54).

- [ ] **Step 1: Write failing tests**

```ts
test('reserve not consumed while rioters walk (RC-52)')
test('reserve decreases 1 s/s while degrading, pauses when interrupted (RC-53)') // 3 degraders still 1 s/s, not 3
test('integrity derives from reserve')                     // remaining 15 -> integrity 50
test('first line KO -> cinematic 3 s -> exactly 8 reinforcements, skipping does not double (RC-27)')
test('saved: +8 once, stage saved (RC-28)')
test('destroyed: -3 once, stays destroyed, no late wave (RC-29)')
test('leaving/re-entering zone keeps same id and reserve (RC-26, RC-54)')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): school incident with single-source countdown`.

---

### Task 8: Rescue incident

**Files:**
- Create: `src/sim/incidents/rescue.ts`
- Test: `tests/sim/rescue.test.ts`

**Interfaces:**
- Produces: `class RescueIncident { id: string; kind: 'groupHarassed' | 'elderlyRobbed'; victimPos: Vec; stage: 'threat' | 'secured' | 'completed' | 'failed'; remaining: number; helpProgress: number; start(horde: Horde, site: Vec, rng: () => number): void /* 2–4 aggressors, spawned ≥ 160 px from Paul */; step(dt: number, ctx: { horde: Horde; rules: Rules; player: Player; actHeld: boolean; playerDamaged: boolean }): SimEvent[] }`.
- Rules: `remaining` starts 25, decreases only while ≥ 1 aggressor is `threaten` near victim; all aggressors KO → `secured`, timer frozen; then `act` held within 32 px for 1 s → `completed`, `award(id+':ok', 6)`; moving away or damage resets `helpProgress`. `remaining` 0 before secured → `failed`, aggressors become `role: 'contact'` targeting player, no award. Victim is never in sweep/rock target lists.

- [ ] **Step 1: Write failing tests**

```ts
test('distress only decreases while an aggressor threatens (RC-64)')
test('all aggressors KO freezes timer; act 1 s gives +6 once (RC-65)')
test('timeout: failed, no bonus, aggressors turn on Paul (RC-66)')
test("Paul's sweep and rocks never touch the victim (RC-63)") // victim not in targets; rock through victim pos -> no HitConfirmed on victim
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): rescue incident with distress reserve`.

---

### Task 9: Heal stations

**Files:**
- Create: `src/sim/healing.ts`
- Test: `tests/sim/healing.test.ts`

**Interfaces:**
- Produces: `class Stations { list: { id: string; pos: Vec; charged: boolean; progress: number }[]; step(dt: number, ctx: { player: Player; actHeld: boolean; moved: boolean; damagedThisStep: boolean; rules: Rules }): { events: SimEvent[]; message: 'Santé au maximum' | 'Épuisé' | null } }`.
- Rules: within 28 px of a charged station, `act` held 1.5 s → +25 HP capped 100, `charged = false`, `HealCompleted` (charge and HP applied together); move, damage or release → progress 0, `HealInterrupted`; full HP → no progress, message `Santé au maximum`; uncharged → `Épuisé`. Order inside `Sim.step`: hits/damage → KO check → heals; if `player.ko` heal step is skipped.

- [ ] **Step 1: Write failing tests**

```ts
test('charged station heals +25 capped at 100, once (RC-36)')
test('interrupted heal gives nothing and keeps charge (RC-37)')
test('full health consumes nothing (RC-38)')
test('heal completing on the KO step does not revive (RC-41)') // set hp 3, damage 5 and heal complete same step -> ko true, hp 0, charge kept
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): heal stations with interruptible interaction`.

---

### Task 10: Director and Sim wiring

**Files:**
- Create: `src/sim/director.ts`, `src/sim/sim.ts`
- Test: `tests/sim/sim.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `pressure(waveIndex: number, kos: number): number = min(12, 1 + waveIndex + floor(kos / 12))` — waves replace "manche" in this slice.
  - `class Director { phase: 'intro' | 'school' | 'breather' | 'rescue' | 'waves'; step(dt, sim): SimEvent[] }` — sequence: 4 s free movement → school incident starts (3 degraders walk in) → when school saved/destroyed: 8 s breather → rescue at a site chosen by path distance 300–900 px from Paul → then endless waves: every wave announced (`WaveAnnounced {index}`), size `min(40 - active, 4 + 2*pressure)`, roles mix contact/thrower (throwers 30 %), variants round-robin, spawns at edge points ≥ 320 px from Paul; next wave when active hostiles ≤ 3; idle 25 s with nobody active → small patrol of 3. Windup limits scale `2 + floor(pressure/4)` capped 4. Damage `5 + floor(pressure/2)` capped 12. Never more than one urgent incident at once in this slice.
  - `class Sim { constructor(seed: number); step(input: InputFrame): SimEvent[] /* one fixed step */; snapshot(): Snapshot; pause(): void; resume(): void; quit(): void; rules: Rules }`. Step order: player move → sweep/return → hostiles → rocks → apply damage → KO check (`PlayerKnockedOut`, `rules.end('ko')`) → incidents → heals → director. Nothing advances while school `suspended()` except the cinematic timer.
  - `Snapshot` = plain readonly data for rendering: player, hostiles (with `state`, `variant`, `role`, `facing`), rocks, telegraphs (`{from, to, until}`), group members, victim, school stage/integrity/remaining, rescue stage/remaining, stations, objective arrow target, score, kos, hp, carried, wave index, stats.

- [ ] **Step 1: Write failing tests**

```ts
test('scripted bot survives intro: school incident starts within 6 s, no hostile in strike range before 4 s')
test('pressure formula and caps')                 // pressure(0,0)=1, pressure(3,24)=6, pressure(50,500)=12
test('hostile count never exceeds 40 over 100 waves (RC-50)') // fast-forward with invulnerable test flag, assert max active <= 40 and arrays bounded (<= 40 hostiles + 24 + 16 rocks)
test('KO ends session; later steps award nothing (RC-41)')
test('determinism: same seed + same inputs => same snapshot after 3000 steps')
test('pause freezes everything (RC-40, RC-67)')    // pause, step via clock 10 s -> snapshot deep-equal
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(sim): director sequencing and Sim facade`.

---

### Task 11: Assets pipeline and credits

**Files:**
- Create: `scripts/fetch-assets.mjs`, `scripts/build-lpc.mjs`, `scripts/lpc-recipes.json`, `public/CREDITS.md`
- Output: `public/assets/chars/*.png` (+ `.json` frame maps), `public/assets/tiles/*.png`, `public/assets/sfx/*.ogg`, `public/assets/props/flags.png`

**Interfaces:**
- Produces asset keys used by Task 12: character sheets `paul`, `rioter_classic_a|b`, `rioter_palestinian_a|b`, `rioter_antifa_a|b`, `protester_1..4`, `elder_1|2`; each sheet in LPC universal layout (64×64 frames; rows `walk_n,w,s,e` = 8–11, `slash_n,w,s,e` = 12–15, `hurt` = 20) — **verify rows against the downloaded sheets and record the actual indices in `public/assets/chars/layout.json`**; tiles `streets` (LPC Modern Streets 32 px), `urban` (Kenney RPG Urban, 16 px drawn ×2), `city` (Kenney Roguelike Modern City, 16 px ×2); sfx `hit1..3`, `throw`, `land`, `pickup`, `hurt`, `fire_loop`, `alarm`, `ui_click`; props sprite `flags.png` (16×12 per flag: French, Palestinian, Antifa — drawn in code with `pngjs`, simple geometric shapes, no text).

- [ ] **Step 1:** `fetch-assets.mjs` downloads, into `assets-source/` (git-ignored), pinned URLs: LPC generator repo `spritesheets/` + `CREDITS.csv` (git clone `--depth 1` of `github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator` at a pinned commit), Kenney RPG Urban Kit, Kenney Roguelike Modern City, LPC Modern Streets (OpenGameArt), Kenney Impact Sounds, Kenney RPG Audio. Record each URL, version/commit and license in `scripts/assets.lock.json`. Verify each license file says CC0 or lists LPC licenses before continuing.
- [ ] **Step 2:** `lpc-recipes.json` lists layers per character (body, head, hair, clothing, accessories). Paul: long dark hair, black shirt, black pants, shoes — **with one contrasting accent (e.g. light grey sleeves) so he is distinguishable from dark-clad rioters** (spec 6.1). Rioters: hoodies/dark tees, varied skin tones, bandana/face cover from LPC catalog if available. Protesters: bright tees, varied skin tones. Elders: grey hair, cardigan.
- [ ] **Step 3:** `build-lpc.mjs` composites the layers in z-order with `pngjs` (dev dep), writes sheets, and appends each used file's authors/licenses from `CREDITS.csv` to `public/CREDITS.md` (deduplicated). Exit non-zero if any layer has no credit row.
- [ ] **Step 4:** Add `npm run assets` = fetch + build. Run it. Check `public/assets` total ≤ 8 MB (spec 19.2 first load).
- [ ] **Step 5: Commit** sheets, tiles, sfx, credits, lock file, scripts: `feat(assets): LPC characters, CC0 tiles and sounds with credits`.

---

### Task 12: World rendering

**Files:**
- Create: `src/game/scenes/BootScene.ts`, `src/game/scenes/WorldScene.ts`, `src/game/render/actors.ts`
- Modify: `src/game/main.ts`

**Interfaces:**
- Consumes: `Sim`, `Snapshot`, `FixedClock`, asset keys from Task 11.
- Produces: `WorldScene` with `setInputSource(fn: () => InputFrame)`, emits Phaser events `hud` (snapshot) and `sim-events` (SimEvent[]) each frame for HUD/audio.

- [ ] **Step 1:** BootScene loads all assets, forwards `progress` to the HTML loading bar; on error shows message + `Réessayer` (reload). If WebGL is unavailable show "Ce jeu nécessite WebGL" instead of a blank screen (RC: spec 19.5).
- [ ] **Step 2:** WorldScene: build ground/building tilemap layers from `DISTRICT` (ground layer under actors; building fronts as images with depth = footprint bottom y; roof layer above actors with alpha 0.35 when Paul's feet are inside its rect — spec 5.3). Trees: trunk below, foliage above.
- [ ] **Step 3:** `update(time, delta)`: `steps = clock.advance(delta/1000)`; for each step `sim.step(input())`; render from `sim.snapshot()`; all sprite depths = feet y. Camera: `startFollow(paulSprite, true)`, small deadzone 24×16, bounds = map, integer zoom = `max(1, floor(min(viewW/640, viewH/360)))`.
- [ ] **Step 4:** Actors: LPC walk/slash/hurt animations from `layout.json`, facing → 4 rows; KO = hurt last frame, alpha 0.6; flag prop attached above shoulder for palestinian/antifa variants; Paul has a 1-px light outline (shader-free: draw a pre-tinted copy under the sprite). Thrower windup: raised-arm frame + red dashed line and ground ring at `to` until rock lands (spec 8.2, RC-10). Rocks: shadow on ground + sprite offset by arc height `sin(πt)*12` (visual only). Recoverable rocks: small white outline + slow bob. Peaceful group: protesters with sign rectangles, calm idle; blue neutral icon above group. Victim: yellow "!" distress icon (never red enemy marker, spec 14.1). School: fire particles + smoke while threatened, ruin frame when destroyed, French flag when saved. Offscreen threat indicators at screen edge for thrower windups (spec 6.3).
- [ ] **Step 5:** Hit feedback: 60 ms hit-stop (skip render-step interpolation, not sim), 2 px camera shake on Paul hit, white flash on hit target.
- [ ] **Step 6: Verify** with `npm run dev` in the browser pane: walk around, collide with a building, see school burning, a thrower telegraph, rocks landing and being picked up; console clean. **Commit** `feat(game): world rendering from sim snapshot`.

---

### Task 13: Input — keyboard, mouse, touch

**Files:**
- Create: `src/game/input/keyboard.ts`, `src/game/input/touch.ts`, `src/game/input/merge.ts`
- Test: `tests/game/input.test.ts` (add exact-pinned `jsdom` dev dep; `// @vitest-environment jsdom` at top of each `tests/game/*` file)

**Interfaces:**
- Produces: `createKeyboard(target: Window, canvas: HTMLCanvasElement, worldFromScreen: (x: number, y: number) => Vec, playerPos: () => Vec): InputSource`; `createTouch(root: HTMLElement): InputSource`; `merge(...sources: InputSource[]): () => InputFrame`; `InputSource { read(): Partial<InputFrame>; releaseAll(): void }`. Edge-triggered `strike`/`throwRock` are consumed on read.
- Bindings (spec 7): move ZQSD / WASD / arrows (use `KeyboardEvent.code` so AZERTY and QWERTY both work); aim = mouse world position − Paul, falls back to null; strike = Space or left click; throw = E or right click (`contextmenu` prevented on canvas); act = F (held); run = Shift (held); Escape → pause callback. Touch: left-half dynamic joystick (dead zone 0.2, run when > 0.9), buttons Frapper, Renvoyer (tap = last aim; drag from button = aim direction, release throws), Agir (held), Pause; each control tracks its own `pointerId`; `touch-action: none`, `user-select: none` on the game root. `blur`, `visibilitychange` hidden, `pointercancel` → `releaseAll()` on every source + pause.

- [ ] **Step 1: Write failing tests**

```ts
test('diagonal keys produce normalized move')          // KeyW+KeyD -> move length 1
test('physical codes: AZERTY Z (code KeyW) moves up')
test('strike press is edge-triggered')                  // keydown Space -> read().strike true, next read false
test('blur releases all held inputs (RC-40)')
test('joystick and button pointers are independent')   // pointerdown id1 on stick, id2 on Frapper, pointerup id2 -> move unchanged
test('drag-aim from Renvoyer sets aim and throws on release')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Verify** on a phone-size viewport (browser pane `resize_window` mobile) and, if available, on a real phone over LAN (`vite --host`). **Commit** `feat(game): keyboard, mouse and touch input`.

---

### Task 14: HUD, menus, audio, storage

**Files:**
- Create: `src/game/hud/hud.ts`, `src/game/hud/menus.ts`, `src/game/hud/hud.css`, `src/game/audio.ts`, `src/game/storage.ts`
- Test: `tests/game/storage.test.ts`
- Modify: `jouer/index.html`, `src/game/main.ts`

**Interfaces:**
- Produces: `storage.loadRecord(): number | null`, `storage.saveRecord(score: number, cause: 'ko' | 'quit'): void` (key `bb:${rulesVersion}:record` for KO, `bb:${rulesVersion}:record-quit` for quit), `storage.loadPrefs()/savePrefs({ muted, runToggle })`; all wrapped in try/catch, invalid JSON → defaults.

- [ ] **Step 1: Write failing tests**

```ts
test('storage throws -> game data falls back, no exception (RC-43)') // stub localStorage getter throwing
test('invalid saved JSON returns defaults')
test('quit record kept apart from KO record')
```

- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** HUD (HTML, CSS-scaled, readable size): HP bar with number, score, "Casseurs neutralisés: N", vague, three rock slots, incident cards (name, `remaining` seconds, status `en cours / interrompu / perdu / sauvé`, distance), screen-edge arrow toward the active objective, contextual prompt ("F — Se soigner", "F — Aider", "Santé au maximum", "Épuisé"). Colour never sole signal (icons + text).
- [ ] **Step 6:** Start screen on `/jouer/` (shown after load): title, 4 short rules (spec 26.3), controls for keyboard and touch, `Commencer` button (also unlocks audio), sound toggle. Pause (Esc / button): Reprendre, Son on/off, Crédits (renders `CREDITS.md`), Retour au site → confirm dialog "La partie en cours sera abandonnée." with `Continuer la partie` / `Quitter la partie`; Arrêter la partie → summary marked "Session interrompue volontairement". Summary: score, record, cause, vague atteinte, casseurs neutralisés, école sauvée/détruite, secours réussi/manqué, soins utilisés, pierres ramassées/renvoyées/touchées, durée active; buttons Rejouer (new `Sim`, same prefs) and Retour au site.
- [ ] **Step 7:** Audio: create `AudioContext` only on the Commencer click; groups `sfx`, `ambience` with gains; max 8 simultaneous voices; random choice among `hit1..3`; fire loop volume follows school threat; resume context on `visibilitychange` visible after explicit Reprendre. Failure to init audio → game continues muted.
- [ ] **Step 8: Verify** full loop in the browser pane: Commencer → play → Pause → Retour au site confirm → landing; replay to KO → summary → Rejouer. **Commit** `feat(game): HUD, menus, summary, audio and local record`.

---

### Task 15: Landing page

**Files:**
- Modify: `index.html`, `src/site/landing.css`
- Create: `public/preview.png` (real gameplay capture from Task 12/14, ≤ 250 KB, explicit width/height)
- Test: extend `tests/build.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
test('landing has one h1, a real /jouer/ link and no script', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html.match(/<h1/g)?.length).toBe(1);
  expect(html).toMatch(/href="\/jouer\/"/);
  expect(html).not.toMatch(/<script/);
});
test('landing own bytes <= 300 KB gzipped (excluding preview)')
test('preview image has width, height and alt')
```

- [ ] **Step 2–4:** FAIL → implement → PASS. Content in order (spec 26.2): header with name + anchors Présentation / Commandes + Jouer; hero "Défends le quartier. Tiens aussi longtemps que possible." + one-line description with **Paul** + Jouer (primary) + Comment jouer (secondary) + "Solo · Ordinateur et téléphone · Sans compte"; preview image; four actions; rules (26.3 bullets) and controls table generated from the same strings as the in-game help (copy into a shared `src/content/controls.ts` imported by the game and inlined into landing at build via a tiny Vite `transformIndexHtml` plugin, so there is one list); footer: version `slice-0.1.0`, "prototype jouable", crédits link, one-sentence fiction/satire notice. Semantic HTML, visible focus, 44 px targets, no horizontal overflow at 320 px, `prefers-reduced-motion` respected. The landing's visual design is to be refined later with the user; keep CSS plain and tokenised (`:root` variables).
- [ ] **Step 5: Verify** in the browser pane at 375 px and desktop; network tab on `/` shows no Phaser/asset requests (RC-72). **Commit** `feat(site): landing page`.

---

### Task 16: Slice verification

**Files:**
- Create: `docs/superpowers/reports/2026-xx-slice-verification.md`
- Create: `src/game/debug.ts` (dev-only `?stress=40` URL flag spawning 40 hostiles + 3 groups worth of protesters + 24 rocks; stripped from prod by `import.meta.env.DEV`)

- [ ] **Step 1:** `npm run typecheck && npm test && npm run build` → all green.
- [ ] **Step 2:** `npm run preview`; in the browser pane walk the acceptance cases covered by this slice: RC-01…RC-30, RC-36…RC-41, RC-43, RC-44, RC-51…RC-54, RC-62…RC-67, RC-69…RC-78. Note pass/fail per ID.
- [ ] **Step 3:** Stress: `?stress=40` on desktop — record frame time p95 from the Performance panel over 60 s; target ≤ 20 ms. Note bundle sizes (`dist/` total, first-load bytes; target ≤ 8 MB).
- [ ] **Step 4:** Write the report: results per RC, numbers, known gaps, and the out-of-scope list from this plan as the next plan's input. Real-phone testing is listed as **not done** unless the user ran it.
- [ ] **Step 5: Commit** `docs: slice verification report`.
