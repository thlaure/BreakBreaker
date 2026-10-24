# BreakBreaker — Specifications: Technical

> **Purpose of this file:** technical choices, architecture and data, performance, storage, loading and distribution.  
> Part of the BreakBreaker specifications (version 1.4.0), split into several files. Back to the [specifications index](SPECS%20-%20Index.md) (overall table of contents, version history, conventions, file map).

## 17. Technical choices

### 17.1 Chosen stack

| Area | Choice | Rationale |
| --- | --- | --- |
| Language | TypeScript compiled to JavaScript | Typed states, objects, collisions and tests |
| Build | Vite, pinned version | Local development and static build |
| 2D engine | Phaser 4.2.1, pinned version | Rendering of sprites, animations, camera, input, sound and scenes |
| Simulation | Pure, deterministic TypeScript module with a fixed step (60 Hz), with no dependency on Phaser, separate from rendering | Testable and reproducible rules |
| Rendering | WebGL, pixelArt enabled, RESIZE scale mode, integer camera zoom, base 640 × 360 / 360 × 640 | Sharpness without stretching |
| Collisions | 2D circles and rectangles computed by the simulation; 32-pixel tile grid | Contacts, projectiles and top-down view without depending on the rendering engine |
| Projectiles | 2D trajectories and a separate visual arc | Control and predictable cost |
| Map | Orthogonal tiles and JSON objects | Ground, collisions, objectives, groups and spawns |
| Animation | Spritesheets/atlases | No 3D skeleton required |
| AI | States, horde director, grid and spatial neighbourhood | Many simple agents, testable logic |
| Interface | Game HUD and accessible HTML/CSS menus | Separate game controls from menu navigation |
| Sound | Phaser audio system / Web Audio | Mixing and resumption after interruption |
| Tests | Vitest for the simulation and the rules; browser walkthroughs | Throwing, picking up, throwing back, protecting the groups, striking, weapons |
| Resources | Universal LPC, Kenney / LPC CC0, Kenney CC0 sounds | Credits in `public/CREDITS.md` |
| Delivery | Static files over HTTPS | No account, paid API or application server |

### 17.2 Change from Three.js

The visual direction has changed: keeping the 3D engine is no longer a goal. Phaser was chosen in order to use a 2D game framework rather than rebuild sprites, scenes and collisions around a 3D engine.

The pure rules for score, capture, health and objectives can be reused after adaptation. The rendering, camera, directional input and resources must be redone. No automatic port of the prototype's procedural models and animations will give a final pixel art result.

Three.js, Rapier 3D, KTX2, GLB and the WebGPU choice are no longer part of the target. They must not be loaded in the production 2D build.

### 17.3 References and limits

The [official download](https://phaser.io/download) and the [version archives](https://phaser.io/download/archive) list the available versions. The [Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade) documentation remains a reference; the first slice, however, computes its collisions in the pure simulation.

The [Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager) and the [cameras](https://docs.phaser.io/phaser/concepts/cameras) are used to adapt the display. The [pixel art](https://docs.phaser.io/api-documentation/typedef/types-core) options make it possible to preserve sharp pixels.

Phaser 4's Canvas renderer is announced as deprecated in the [official presentation of the renderer](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games). The specification therefore does not promise an equivalent Canvas fallback mode before testing. The acceptance baseline is WebGL; the lack of support produces a clear message.

### 17.4 First technical validation

Before freezing the version: get Paul, forty opponents, three peaceful groups, the collisions and projectiles working on the target phones. Check the real weight of the engine and the atlases, not just how easily it starts on a computer.

No backend, no generative AI at runtime, no network dependency in every round, no full debris physics and no mandatory WebGPU effect.

## 18. Software architecture and data

### 18.1 Systems

```text
src/
  site/         landing HTML/CSS, content, preview and link to the game; flags.ts (pixel flags), landingContent.ts (static pages per language)
  content/i18n/ catalogs fr/ and en/ by domain (core, hud, world, content, landing), t(), locale
  app/          startup, menus, loading and errors
  scenes/       home, district, HUD, pause and summary
  sim/          pure, deterministic simulation, without Phaser: entities, rules, rounds, weapons
  core/         states, clocks, identifiers, events
  input/        keyboard, mouse, touch, gamepad
  player/       Paul, movement, aiming, circular strike, health
  weapons/      ground weapons, spawning, pickup, wear and breakage
  projectiles/  throws, trajectories, impacts, pickup, stock, return
  crowds/       peaceful groups and protected volumes
  ai/           hordes, roles, pressure, navigation and neighbourhood
  objectives/   school, monument, shop, local resistance and occurrences
  incidents/    director, building emergencies and victim rescue
  repairs/      toolboxes, stock, repair / extinguishing launched by Act, interruption and restoration
  healing/      contact stations, small heals and charges
  rules/        damage, KO, score, neutralised rioters and summary
  rendering/    atlases, animations, depth, effects and quality
  audio/        sound groups and interruptions
  storage/      versioned preferences and records
  data/         map, atlas, rounds, compositions and parameters
public/assets/  exported sprites, tiles, atlases, sounds and maps
public/CREDITS.md  authors and licences of the resources
assets-source/  art sources and map files
tests/          rules, integration, browser and endurance
```

This tree is a target; the first slice groups the simulation in `src/sim/` and the rendering, input and interface in `src/game/`. The mission logic must not depend on a visible sprite or on an image name. A separation between game entities and rendering objects eases testing and recycling.

### 18.2 Projectile states

`EnemyWindup → EnemyFlying → LandedRecoverable → InInventory → PlayerFlying → Inert/Removed`.

Each projectile has an identifier, owner, visual type, state, position, velocity, lifetime and impact identifier. A transition event is accepted only once. A pool fully resets the fields before reuse and assigns a new life identity.

Only `LandedRecoverable` can enter the stock. `PlayerFlying` does not become recoverable again. The stock is never greater than three or less than zero. A removed object cannot be consumed again.

### 18.3 Events

**Changed (v1.9.11):** delivered catalogue (`src/sim/types.ts`, type `SimEvent`):

- Rounds: `RoundStarted` (with `rescueKind` when the headline incident is the rescue, v1.9.12), `RoundTotalChanged`, `TwistStarted` (in round 3, two in a row: `weaponDrop` then `secondUrgency`, v1.9.12; every odd round from 3 before v1.1.1), `RoundCompleted`, `StationsRecharged`.
- Combat and projectiles: `HitConfirmed`, `ActorKnockedOut` (carries `fall` since v1.9.17), `DominoTriggered` (`from`, `lifeIds`, v1.9.17), `PlayerDamaged`, `PlayerKnockedOut`, `EnemyThrowStarted`, `EnemyRockThrown`, `ProjectileLanded`, `ProjectilePickedUp`, `ProjectileReturned`, `ProtectedGroupBlockedImpact`, `ShieldBlocked`.
- Places: `SchoolStarted` and `CasseStarted` (position), `MolotovThrown`, `TargetIgnited`, `BuildingThreatStarted`, `BuildingThreatPaused`, `TargetSaved`, `SchoolRestored`, `BuildingDestroyed`, `FirebombThrown`, `FirePatchStarted`.
- Field small heals (v1.9.18): `SmallHealDropped` (`id`, `pos`), `SmallHealPicked` (`id`, `amount` = HP actually gained). The snapshot adds `fieldHeals` (`id`, `pos`, `expiresAt`).
- Emergency services (v1.9.19): `ServiceCalled` (`kind` 'fire' or 'police'), `ServiceRefused` (`kind`, `reason` among `noFire`, `fewRioters`, `noCalls`, `busy`, `ruined`), `TruckArrived` (`from`), `TruckSprayed` (`target`, once per place), `TruckDestroyed` (`pos`), `TruckLeft`, `PoliceArrived` (`from`, `count`), `PoliceDown` (`id`), `PoliceLeft`. The snapshot adds `services` (`calls` { fire, police } = remaining calls; `hint` { fire, police } = a call would be accepted right now) and `allies` (`truck`: `pos`, `hp`, `maxHp`, `state` 'arriving' / 'spraying' / 'leaving', `target`, or null; `police`: list of agents `id`, `role`, `pos`, `hp`, `maxHp`, `state` 'run' / 'strike' / 'down').
- Prison (v1.9.20): `CaidJailed` (`lifeId`, once per life of a jailed Caïd), `PrisonBreakout` (`count` Caïds freed, `pos` = the door; never emitted if nobody is jailed), `GuardDown` (`id`, a guard KO; a police officer from the phone booth gives `PoliceDown`), `GuardsBack` (during the breather, guards come back). `Director.extend` emits `RoundTotalChanged` when T grows. The snapshot adds `prison` (`jailed` = jailed Caïds; `guards`: list of `id`, `pos`, `hp`, `maxHp`, `state`; `standing`). `allies.police` lists only the police, never the guards.
- Main square (v1.1.0): no new event; the church reuses the place events above with the `church` kind. The snapshot's single `peacefulGroup` becomes `peacefulGroups` (three areas). The President, his bubbles and the sauna steam are render only: they read the camera and Paul's position, never write to the simulation, and use their own generator (`presidentRng`).
- Toolboxes: `ToolboxSpawned`, `ToolboxPickedUp`, `FireOut`, `TargetRepaired`.
- Rescue: `RescueStarted` (position and type, emitted once; it triggers the alert), `ItemStolen`, `ItemDropped`, `ItemPickedUp`, `ItemReturned`, `RescueSecured`, `RescueCompleted`, `RescueFailed`.
- Monument: `MonumentAttacked`, `FlagSwapped`, `MonumentDefended`, `FlagCaptured`.
- Weapons and specials: `WeaponSpawned`, `WeaponPickedUp`, `WeaponBroken`, `FurieStarted`, `FurieEnded`, `BeamCharging`, `BeamCancelled`, `BeamFired`, `ShieldBlocked`.
- Shooters and weapons of phase B (v1.9.15): `ShooterAimStarted` (`lifeId`, `from`, `to`, `until`), `BulletFired` (`id`), `BulletImpact` (`pos`, `owner`), `FlashballFired` (`id`, `from`, `dir`), `FlashballDropped` (`pos`), `GlovePunched` (`from`, `to`, `lifeId`); `HitConfirmed.source` can also be 'gant' or 'flashball'. The snapshot adds `aims`, `bullets`, `flashballs` and `hostiles[].aiming`.
- Energy gauge (v1.9.14): `EnergyReady` (`level` 'onde' or 'furie', once per crossing), `EnergyRefused` (`need`). The `InputFrame` input carries `chargeHeld` (C or the Onde button held; **changed v1.9.23:** only its rising edge counts, the charge then ends by itself) and `furie` (press of R or Furie); `strikeHeld` is removed.
- Heals and score: `HealCompleted`, `ScoreChanged` (points and position, section 14.1).

The events of the initial target that were not carried over (`SessionStarted`, `SessionEnded`, `ObjectiveActivated`, `ObjectiveLost`, `RepairStarted`, `RepairCancelled`, `StudentEnteredSchool`, `WaveStarted`) remain to be added if a need appears; the end of a session goes through the simulation's `ended` state.

The rules system is the sole author of the score and of the « Casseurs neutralisés » counter. KOs, heal consumptions, pickups and objective bonuses are deduplicated. Peaceful groups and victims can never emit a valid KO. Place health, rescue deadlines, toolbox consumption, repair and rescue bonuses are deduplicated by their own identifier. An older loss that is still repairable keeps only its minimal state; it does not require keeping the whole historical log.

### 18.4 Target configuration

```json
{
  "rulesVersion": "1.0.0",
  "appVersion": "1.4.0",
  "sessionMode": "arcade",
  "view": "top-down-orthogonal",
  "artStyle": "pixel-art",
  "districtId": "paris-sciences",
  "playerCharacterId": "paul",
  "characterCustomization": false,
  "tileSize": 32,
  "flagAffectsScore": false,
  "playerStrikeArcDegrees": 360,
  "playerStrikeRange": 56,
  "maxStrikeTargets": 3,
  "sessionTimeLimitSeconds": null,
  "endOnPlayerKnockout": true,
  "endOnObjectiveLoss": false,
  "playerMaxHealth": 100,
  "captureSeconds": 8,
  "maxCarriedProjectiles": 3,
  "recoverFlyingProjectiles": false,
  "recoverReturnedProjectiles": false,
  "pacifistGroupsTargetable": false,
  "pacifistGroupsDamageableByPlayer": false,
  "rescueVictimsThreatenedByHostiles": true,
  "rescueUsesDistressMeter": true,
  "buildingHealth": 100,
  "propHealth": 60,
  "fireDamagePerSecond": 2,
  "degraderDamagePerSecond": 1.2,
  "smoulderDamagePerSecond": 0.7,
  "rescueThreatSeconds": 25,
  "maxUrgentIncidents": 2,
  "destroyedBuildingsPersistAcrossRounds": true,
  "maxCarriedRepairKits": 1,
  "maxGroundRepairKits": 2,
  "repairApplicationSeconds": 2,
  "repairSafetyRadius": 64,
  "repairBonus": 5,
  "rescueBonus": 6,
  "maxActiveHostiles": 40,
  "maxFlyingProjectiles": 24,
  "maxRecoverableProjectiles": 16,
  "maxActiveStudents": 5,
  "maxGroundHeals": 2,
  "stationHealAmount": 25,
  "stationHealOnContact": true,
  "firstWeaponSpawnSeconds": 20,
  "weaponSpawnIntervalSeconds": [30, 45],
  "weaponSpawnDistance": [160, 480],
  "maxGroundWeapons": 1,
  "weaponClearRadius": 200,
  "twistRegularWeaponShare": 0.5,
  "breatherWeaponEveryRounds": 2,
  "shieldSeconds": 20,
  "caidHealth": { "base": 14, "step": 2, "everyRounds": 2, "max": 26 },
  "caidDamageFrom": { "hands": 1, "weapon": 2, "rock": 1, "furie": 5, "beam": 10, "bubble": 0 },
  "caidContactDamageMultiplier": 1.5,
  "caidKnockback": 52,
  "caidAttackIntervalMultiplier": 0.85,
  "caidWeaponDropShare": 0.5,
  "prison": { "hp": 400, "guards": 5, "postRadius": 160, "fromRound": 4, "repairShare": 0.6 },
  "church": { "hp": 150, "fromRound": 3, "repairShare": 0.6 },
  "roundEnemyCounts": [10, 14, 18, 22],
  "roundEnemyIncrement": 4,
  "maxRoundEnemies": 40,
  "maxRoundEnemiesOnMap": 12,
  "enemyEntryIntervalSeconds": 1.5,
  "waveRestSeconds": 6,
  "smallHealAmount": 10
}
```

**Changed (v1.9.11):** this block is a summary; the source of truth for the parameters is `CONFIG` in `src/sim/config.ts` (the former 30 s reserve replaced by place health, 8 s capture, 2 s repair; `repairBonus` is the school's value; `smallHealAmount` corresponds to the small heals delivered in v1.9.18, `CONFIG.fieldHeal`). The values are proposed. The simulation caps are shared by all graphics profiles; a separate difficulty setting can change the rosters, but not an automatic drop in quality.

**Render and content modules of the main square (v1.1.0).** `src/content/quotes.ts` (the dictionary `QUOTES`); `src/game/render/squareMath.ts` (pure: `SAUNA_SIGN`, `BALCONY_HALF_W`, `chateauBalcony`, `steamSpec`, `lanternGlow`, `silhouetteDrift`); `src/game/render/presidentMath.ts` (pure: `MOODS`, `nextMood`, `moodHoldMs`, `quoteDelayMs`, `pickQuote`, `agitation`, `poseFrame`, `presidentBob`, `presidentRng`, `QUOTE_SHOW_MS`, `AGITATION_RADIUS`); `src/game/render/president.ts` (Phaser view of the figure and its bubble); fronts `churchFront.ts`, `chateauFront.ts` and `saunaFront.ts`. Simulation constants: `CONFIG.church` (`hp` 150, `fromRound` 3, `repairShare` 0.6), `CONFIG.casse.fromRound.church`, `CONFIG.casse.scores.church`, `DISTRICT.decor` (château and sauna added) and `DISTRICT.peacefulGroups`. Tests: `tests/sim/church.test.ts`, `tests/content/quotes.test.ts`.

**Render, content and audio modules of the stage (v1.4.0).** `src/game/render/stageFront.ts` (the stage front, drum kit and lights), `src/game/render/skeletonBand.ts` (the five skeletons, the singer's bubble, reduced motion, culling), `src/game/render/stageMath.ts` (pure: `LYRIC_SHOW_MS`, `lyricDelayMs`, `pickLyric`, `initSinger`, `stepSinger`, `swayOffset`, `headBang`, `lightPulse`), `src/content/stage.ts` (`STAGE_LYRIC_COUNT`, `stageLyricKey`, `stageLyricsFor`; catalog keys `content.stage.lyric1` to `lyric6` and `sign.stage`), `src/game/stageMusicMath.ts` (pure: `stageVolume`, `STAGE_NEAR_PX` 128, `STAGE_FAR_PX` 384, `RIFF_STEPS`, `RIFF_TEMPO_BPM` 150, `midiHz`, `driveCurve`) and `src/game/audioStage.ts` (`StageRiff`, bus gain `STAGE_MAX_GAIN` 0.16, driven through `GameAudio.setStageProximity`). Simulation: `DISTRICT.decor` gains `stage` (R(36,3,8,5), door C(40,8)) and the booths move to R(21,30,1,1) and R(22,30,1,1); nothing else changes, `rulesVersion` stays `1.0.0`. Tests: `tests/game/stageMath.test.ts`, `tests/game/stageMusicMath.test.ts`, `tests/content/i18nContent.test.ts`, `tests/sim/places.test.ts`.

### 18.5 Collisions and time

Fixed simulation targeting 60 Hz, rendering separate. Floating-point logical coordinates; rounding only at render time. Use foot volumes for agents, separate building footprints and group volumes.

Fast projectiles use a check of the segment travelled or bounded sub-steps to avoid passing through a small hitbox between two frames. Protected groups and obstacles must be considered before a target behind them.

Pause: place health, fire, distress, capture, repair, weapon spawning, rioter entry, AI, projectiles, useful particles and damage are suspended. Loss of focus: controls released and explicit resumption. Do not replay a whole trajectory in fast-forward when returning to the tab.

### 18.6 Bounded resources

Pool of sprites, bodies, stones, weapons, heals, toolboxes, victims and effects. The rescue director uses the same caps on hostile agents; its aggressors are not an additional population outside the budget. Separate caps for flying projectiles and stones on the ground. Once the ground cap is reached, either replace the oldest recoverable stone with a new fall or remove the new one, according to a single documented rule; proposal: recycle the oldest one outside the player's immediate vicinity.

Projectiles waiting to be thrown do not create an infinite reserve: the director delays preparation when the flight budget is reached. Bodies and stones are cleaned up between rounds or out of view according to the announced rules. No removal of a dangerous flying projectile without explicit resolution.

Keep historical totals, not all events, bodies or identifiers since launch. Replaying and chaining rounds must not make textures, listeners, timers or sounds grow indefinitely.

### 18.7 Languages and catalogs (v1.3.0)

**Catalogs.** `src/content/i18n/` holds one folder per language, `fr/` and `en/`, each with the same five domain files: `core` (short labels and states that simulation ids resolve to: toolbox, station, school, objective, held item, sign), `hud` (HUD, alerts, banners), `world` (place names, signs, world labels), `content` (the President's quotes, the Caïd looks and slogans, crowd grumbles, shouts, onomatopoeias) and `landing` (the two static pages). The French object of a domain defines the keys, the English one is typed against it; `DOMAINS` in `index.ts` registers a domain in one line. `locale.ts` keeps the current language (`getLocale`, `setLocale`, `onLocaleChange`, `initLocale`; see section 14.4).

**`t(key, params?)`** is a pure lookup in the current language: `{name}` placeholders are filled from `params`; with a numeric `params.n` and both `key.one` and `key.other` in the catalog, the plural form of the language is chosen with `Intl.PluralRules` (French: 0 and 1 are singular; English: only 1), for example « 1 Caïd libéré » / « 2 Caïds libérés » and « 1 rioter » / « 15 rioters ». A missing key reads as the key itself and never throws. The keys are a typed union, so a typo fails the type check.

**The simulation never contains phrases.** Everything the simulation emits or stores (events, snapshots, labels, names) is a stable identifier or code; the render and HUD layers translate it with `t()`. `src/sim` never reads the language, so determinism is unchanged (same seed, same events, whatever the language). All user-visible text goes through `t()` or the language-aware content lists.

**Content by language.** Quotes, slogans and cries have one list per language of comparable length and tone (jokes adapted for an American audience, with no real person, party or religion); the content tests (length, forbidden names and words) apply to both lists and also check that the English lines are not copies of the French ones.

**Static landing pages.** The shared template `index.html` is rendered at build time by `src/site/landingContent.ts` (through the Vite plugin in `vite.config.ts`) into two static pages, `/` (French) and `/en/` (English), each with exactly one `h1`, no client JavaScript, relative links, flags as links with `hreflang`, and a « Play » link to `play/?go&lang=<language>` so that the game starts in the language of the page. The build emits both; the dev server serves `/en/` from the same template.

**Tests.** Catalog parity (same keys in both languages for each domain, no empty string, no English identical to French outside a short allow-list such as « Paul » and « BreakBreaker », plurals with both forms), locale storage and override, a sim test that scans events and snapshots for phrases, the content tests of the lists, the flag grids, the landing pages and the HUD and menu live switch.

## 19. Performance and compatibility

### 19.1 Status

Proposed budgets to be measured on a real 2D prototype. Pixel art is not an automatic guarantee of performance: transparencies, projectiles, paths and collisions can remain costly.

### 19.1b Simulation cost (v1.4.0)

`Grid.isSolidPx` (the hottest function of the step: line-of-sight sampling, collisions) answers from a per-tile cover table built once (tile empty, fully covered by one rectangle, or partial; only partial tiles run the exact scan), with results identical to the scan for any geometry (test against a brute-force reference). `npm run bench` stays under 0.3 ms per step (about 0.15 ms after this change). The bench follows one fixed Paul path, so a change of obstacles near that path can swing the figure by about ±30 % for reasons of game state, not of map cost: compare branches by alternating runs.

### 19.2 Starting budgets

| Indicator | Proposed target |
| --- | --- |
| First playable load | At most 8 MB transferred |
| Full district | At most 20 MB of resources, audio included |
| Reference modest mobile | Nominal target 30 frames/s, 95% of active frames ≤ 40 ms |
| Reference computer | Nominal target 60 frames/s, 95% of active frames ≤ 20 ms |
| Active hostiles | 40 at most; queue entry suspended at 12 active hostiles (a round's roster can exceed 40, v1.9.18, about 42 at most up to round 9 since v1.1.1, without changing this cap) |
| Peaceful groups | 3 groups of 6 to 8 sprites in the reference map (1 group of 6 delivered) |
| Active students | 5 at most (to do) |
| Flying projectiles | 24 stones at most, plus 30 shooter bullets (v1.9.15) and Paul's flashball shots |
| Recoverable stones on the ground | 16 at most |
| Fire patches | 6 at most |
| Small heals on the ground | 2 at most, 20 s lifetime (v1.9.18) |
| Emergency service allies | 1 truck and 5 police officers at most at a time (v1.9.19), outside the cap of 40 active hostiles; measured cost of about 0.02 ms per step with the truck, 5 police officers and 40 rioters, full bench ≤ 0.3 ms per step |
| Prison (v1.9.20) | 5 guards always on the map, outside the cap of 40 active hostiles, plus at most the freed Caïds (counted in the round's roster); full bench measured at 0.248 to 0.253 ms per step under load (0.233 without the prison, same load), under the limit of 0.3 ms per step |
| Ground weapons | 1 timed spawn at most (v1.9.16), plus the drops of the twist, the breather and the Caïd (15 s); no ordinary drop within 200 px of Paul of a weapon already on the ground |
| Toolboxes on the ground / carried | 2 on the ground and 1 carried at most |
| Simultaneous urgent incidents | 1 in rounds 1 and 2, then 2 at most (two from the start of the round from round 5, v1.9.18) |
| Purely visual effects | 16 rioters launched into orbit in flight, 24 floating points at a time |
| Visible / persistent bodies | Bounded budget, proposed at 16 before recycling out of view |
| Load then control | Target ≤ 8 seconds on the fast acceptance profile |

Fast profile: cold cache, 20 Mbit/s down, 80 ms latency, documented device. Constrained profile: 5 Mbit/s and 150 ms, explicit progress and possible resumption, with no eight-second promise.

Percentiles on a reproducible ten-minute scenario, excluding loading/pause, five trials per configuration. Endurance on a real device for thirty minutes; one hundred rounds in simulation.

### 19.3 Pixel art rendering

Reasonable atlases, proposed at 2,048 × 2,048 pixels maximum per page for the acceptance baseline. Share atlases between variants, avoid permanent texture and blend mode changes. Text and crowd drawings are not recreated as bitmaps on every frame.

The internal resolution is not multiplied without limit by the phone's pixel ratio. A sharp enlargement is preferred; no blur, anti-aliasing or mandatory continuous zoom. Light effects and shadows are simple and can be disabled without hiding the readability of the combat.

### 19.4 Quality

Economy, Standard, High: vary particles, decorative details, shadows and effects. Do not silently reduce the hordes, the throw alerts, the protected groups or the hitboxes. Projectiles remain visible in Economy.

Positions and collisions are computed with the same system whatever the rendering. Portrait/landscape formats can change the visible field but not the simulation or the speed.

### 19.5 Compatibility

WebGL as the production baseline, detection at startup, no mandatory WebGPU or physics WebAssembly. No blank screen if the context is not available. An equivalent Canvas mode is not promised without specific validation.

Acceptance: older compatible and recent iPhone Safari; modest and recent Android Chrome; Chrome/Edge/Firefox on an integrated Windows laptop; Safari/Chrome on Mac. Exact models and versions recorded before validation. A browser embedded in another application is not declared compatible without testing.

Check heating, memory, multi-touch, interruptions, rotation, audio resumption and at least twenty round transitions. Textures must stabilise after the map is loaded; session duration must not make the number of objects grow.

## 20. Storage, loading and distribution

### 20.1 Local

Preferences for controls, audio, accessibility, quality and **language** (`bb:locale`, section 14.4), and records per rules version/difficulty. No hero appearance choice, no account. An old gender/skin tone preference from the prototype is ignored during migration.

Unavailable storage does not prevent play. The record of an interrupted session is distinguished according to the arcade rule. Loading old invalid data falls back to safe values.

**Seasonal events (v1.5.0).** `src/events/` is render only and permanent: `schedule.ts` (pure `activeEventId(date, search)`), `index.ts` (the event decided once per page load; `prepareEvent` at boot, `themedSheet` for a rioter's sheet, `buildEventDecor` for the map) and `halloween/` (pure `zombieMath.ts`, `zombiePaint.ts`, `decorMath.ts`; Phaser `zombieSheets.ts`, `decor.ts`). With no event active nothing is created, requested or downloaded; with Halloween on, ten extra character sheets are loaded at boot (`public/assets/events/halloween/`, built by `scripts/build-lpc.mjs` from `scripts/lpc-recipes-halloween.json`: the LPC zombie body and head, torn clothes, flashy hair or hoods, the spellcast animation on the casters' attack rows; a failed load is not fatal), the spell orb texture is baked once (`orb.ts`) and the decor is a few dozen static images and graphics plus ten animated sprites. `flyingRockTexture` swaps the enemy's flying rocks for the orb; `flagFor` and `hostileExtra` (pumpkin heads, `textures.ts` bakes orb, skull flag and heads once) hook into `HostileView`. Landing (v1.5.1): the static pages inline `eventActivationScript()` (generated from the same windows) that sets `data-event` on `<html>`; `src/events/halloween/landing.css` is dormant until then and swaps the hero (`hero.png`, `npm run hero:halloween`). Tests: `tests/events/`, `tests/build.test.ts`.

**Static drawings (v1.5.4).** Phaser replays a Graphics' whole command list every frame, so a drawing that never changes is baked: `src/game/render/bake.ts` turns a finished Graphics made of fill styles and rectangles (`bakeMath.ts`, pure) into one canvas texture and image, called by `WorldView` for the building fronts once the district is built. Do not bake a Graphics that is redrawn later (health bars, rings, the President).

### 20.2 Assets

The landing page (two static pages, `/` in French and `/en/` in English, section 18.7) and the game have separate entry points. The landing page downloads neither the engine nor the atlases nor the sounds of the game; loading of these resources begins when the game page is opened. The detailed navigation and weight requirements are in section 26.

Engine, atlas of Paul and the enemies, weapons, map, collisions, stones, heals and essential alerts loaded before control. Other sounds and details can follow. Subsequent hordes do not re-download the same atlas every round.

Load weight: PNG assets are lossless indexed PNGs (at most 256 colors; `scripts/optimize-png.mjs`), and the engine is a separate `phaser` chunk so a game update does not invalidate it in the browser cache.

While an overlay pauses the sim, the scene behind it is redrawn at 15 fps only (the overlays are DOM), and the page-hidden and window-blur events open the pause menu; the browser itself stops animation frames in a hidden tab.

Sprites reuse shared textures but keep their animation state independent. No synchronous loading at the first strike or the first thrown-back stone.

### 20.3 Delivery

Static HTTPS build, versioned files and suitable compression. Sprites and sounds hosted with the game, with no dependency on an external demo URL. The session continues offline after the district has fully loaded; offline reloading is reserved for a PWA evolution.

No backend, advertising, audience analytics or generative API needed. Development diagnostics are local. The specification authorises neither a purchase nor a new external publication.
