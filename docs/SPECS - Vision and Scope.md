# BreakBreaker — Specifications: Vision and Scope

> **Purpose of this file:** game vision, validated requirements, scope and priorities, production and deliverables, planned extensions, remaining decisions and sources.  
> Part of the BreakBreaker specifications (version 1.1.4), split into several files. Back to the [specifications index](SPECS%20-%20Index.md) (overall table of contents, version history, conventions, file map).

## 1. Vision and positioning

### 1.1 Concept

Arcade action web game in **2D pixel art, top-down view, with no isometry**, close to a retro hack-and-slash. The player plays Paul, a fictional neighbourhood shopkeeper, shown with long hair, black rectangular glasses, a black outfit and a white scarf that sets him apart from the rioters.

He moves freely through a fictional Parisian map: squares, school, monument and shops. Hordes of rioters arrive through several entrances. The player fights them in close combat, bare-handed or with weapons picked up in the streets, dodges their projectiles, can recover some fallen stones and throw them back, defends the school and retakes flags.

Groups of peaceful demonstrators occupy parts of the map. They are not targets for Paul and must be walked around. Some may be threatened by rioters during rescue events. Other encounters feature an elderly person or couple who are victims of theft or intimidation, to be helped quickly.

The session is divided into rounds: each round sets a number of rioters to neutralise and one to three objectives. Health, healing (stations; small field heals delivered, v1.9.18) and survival until KO are kept. There is no global countdown and no victory that automatically ends the session. A health bar, however, shows the state of an attacked place, and a local deadline shows the time left to step in for threatened people. A destroyed place can be repaired with a toolbox found on the map.

### 1.2 Promise

« Move around, push back the hordes, pick up weapons, throw their cobblestones back and hold the neighbourhood round after round, for as long as possible. »

The fun rests on movement, reading the groups, strikes, dodging by moving, throwing projectiles back, defending places and managing health. Item pickup is limited and easy to understand; no complex inventory.

### 1.3 Visual direction

Orthogonal top-down view, map with horizontal/vertical axes, sprites and scenery drawn in pixels. Small drawn volumes and building faces may improve legibility, without isometric projection or diamond-shaped grids.

The GTA / The Division reference is no longer a rendering target. Credibility now comes from recognisable details, animations, reactions and sound, in a coherent retro representation.

### 1.4 Audience and access

Browser on computer and phone, with no account and no mandatory installation. Automatic camera, simple controls and a touch version. Pixel art reduces some graphical needs, but does not remove the need to limit hordes, collisions and effects, nor to test on a real phone.

### 1.5 Paul, sole protagonist

**Confirmed (revision 1.5):** the hero is Paul, an entirely fictional neighbourhood shopkeeper. Visual markers: long hair, black rectangular glasses (v1.9.10), black clothes and a light accent (white scarf or bib) that sets him apart from the dark-clothed rioters; silhouette identifiable at the real sprite size. No choice of gender, skin tone or another hero.

Paul does not represent any real person. The Parisian missions, the dialogues and the positions expressed in the game are fiction. No surname, biographical element or press reference is associated with the character.

## 2. Validated requirements and proposed decisions

### 2.1 Status

- **Confirmed** (« Confirmé »): explicitly requested by the project owner.
- **Proposed** (« Proposé »): concrete design solution to try out.
- **Initial parameter** (« Paramètre initial »): balancing value that can be changed without changing the vision.
- **Extension**: outside the first release.

This revision replaces the 3D target. The latest requests cancel the over-the-shoulder view, customisation and the global timer. The idea of imposed walls or alleys was withdrawn by the user; it must not become a feature to develop.

Revision 1.5 incorporates **confirmed** decisions: fictional hero Paul, equal scoring scale for all rioters, neutral « Casseurs neutralisés » (Rioters neutralised) counter, circular strike, healing applied on contact, pickup weapons, fixed-roster rounds and direct launch from the landing page. The associated figures remain initial parameters unless stated otherwise.

### 2.2 Confirmed requirements

| ID | Requirement |
| --- | --- |
| EX-01 | Web game, one player, computer and phone, no account. |
| EX-02 | 2D pixel art, top-down view, non-isometric, retro hack-and-slash-style action. |
| EX-03 | Free movement on the map; Paris for the first version. |
| EX-04 | Paul, a fictional shopkeeper, sole hero; no appearance selection screen; no reference to a real person. |
| EX-05 | Three rioter variants: classic, Palestinian flag, Antifa flag. The flag is purely cosmetic: same scoring scale (+1 on KO), same possible roles. |
| EX-06 | Arrival of hordes; rioters hostile until KO, with no surrender or arrest. |
| EX-07 | Close combat, bare-handed or with picked-up weapons; no gore, no blood. **Changed (v1.9):** the project owner lifts the former ban on firearms for enemy shooters (AK-47, late rounds) and for Paul's flashball, in cartoon style, with readable and dodgeable shots; delivered in phase B of slice 2 (v1.9.15, section 12.14). |
| EX-08 | Enemy projectiles of the pebble, cobblestone or brick type. |
| EX-09 | Ability to recover projectiles and throw them back at the rioters. |
| EX-10 | Groups of peaceful demonstrators to be avoided and not targetable by Paul; some may suffer an enemy threat and be rescued. |
| EX-11 | Students, teachers, police officers, firefighters, carers and shopkeepers remain non-enemies. |
| EX-12 | Health and small heals kept (healing stations delivered; small field heals delivered in v1.9.18, section 12.5). |
| EX-13 | Arcade session with no time limit, divided into rounds, continued until the player's KO. |
| EX-14 | School to defend: front line, reinforcements, repair, return of the students and projected training courses (students and training courses to do, section 10.8). |
| EX-15 | Flag captures on monuments, with a contested zone and flag change. **Changed (v1.9.4, project owner's request):** an equestrian statue whose rider holds a French flag; rioters attack the statue and, within a few seconds, replace the French flag with a Palestinian flag; Paul retakes it through flag capture (section 11). |
| EX-16 | Arrow and ground zone for the objectives. |
| EX-17 | Each KO'd rioter adds one unit to the neutral « Casseurs neutralisés » counter, with no duplicates. |
| EX-18 | Score, local record, pause, voluntary stop and sound after a user gesture. |
| EX-19 | Enough content and renewal for several rounds. |
| EX-20 | Health of an attacked place (fire, degraders) before its destruction, to create a defence emergency; it replaces the former local deadline (v1.9, section 10.2). |
| EX-21 | Toolboxes recoverable on the map; near a destroyed or burning place, a press of Agir (Act; F key or Agir button) starts the repair or extinction, which finishes 2 s later without holding the key, safe surroundings (v1.9.1, section 10.6). A place on fire or destroyed stays so until it is repaired. |
| EX-22 | Dynamic rescue events: demonstrators attacked, elderly person or couple threatened or robbed; local intervention deadline. |
| EX-23 | Free movement, but impossible to cross buildings, tree trunks and solid obstacles. |
| EX-24 | Simple public landing page giving access to the game; content and behaviour defined here, visual direction handled separately with Claude. |
| EX-25 | Pickup weapons appearing randomly in the streets, in small numbers (v1.9.16, section 8.7); each one KOs a rioter in one hit (only 2 damage on a brute or on « Le Caïd » (the Caïd), section 12.14), with its own range and number of hits; cartoon firearms only under the conditions of EX-07 (section 8.7). |
| EX-26 | Fixed-roster rounds: a number of rioters to neutralise and one to three objectives per round, non-blocking « Manche N terminée » (Round N complete) panel during an intended 6 s breather with no rioter entering, then the next round is announced (v1.9, section 12.2). |
| EX-27 | Sober landing page (title, tagline, Jouer (Play) and Commandes (Controls) buttons, footer) with an original visual; rules and instructions shown at game launch; « Commandes » button (modal) on the landing page and in the game (section 26). |
| EX-28 | Visible alert in the game's pixel style when each incident spawns (« ÉCOLE EN FEU ! » (School on fire!), « AGRESSION EN COURS ! » (Assault in progress!), « VOL EN COURS ! » (Theft in progress!)) with arrow and distance, then a screen-edge indicator for each active off-screen incident; generic system reused by future incident events (section 14.1). |

### 2.3 Starting proposals

| Subject | Proposal |
| --- | --- |
| Map | Single neighbourhood, 48 × 48 tiles of 32 pixels (1,536 × 1,536 logical pixels) |
| View | Camera that follows Paul, fixed orientation and integer zoom |
| Movement | Eight directions, normalised diagonals; at least four drawn orientations |
| Contact | **Confirmed:** 360° circular strike around Paul, nearest first, up to three rioters, each hit only once; Paul turns towards the nearest |
| Weapons | **Confirmed:** weapons picked up by walking over them, one held at a time, one-hit KO (2 damage on a brute or the Caïd, v1.9.13), wear per useful hit (section 8.7) |
| Stones | Automatic pickup of enemy stones already fallen, maximum stock of three |
| Throw-back | Distinct action, chosen direction; no perfect catch of an in-flight projectile in V1 |
| Demonstrators | Not targetable by Paul; enemy threat represented by a distress state during a rescue event |
| Objectives | School, monument, shop proposed to vary the rounds |
| Rounds | **Confirmed:** fixed-roster rounds and one to three objectives; roster progression proposed in section 12.2, with a simulation cap |
| Healing | **Confirmed:** limited stations applied on contact (+25); small field heals (+10, delivered in v1.9.18), no passive regeneration |
| Repair after loss | Toolbox distinct from healing, one carried at most, repair or extinction started by a press of F (Agir), interruptible |
| Emergencies | One health bar per attacked place, one local deadline per rescue, no game over on their failure |
| Technical | Chosen: Phaser 4.2.1, TypeScript, Vite and Vitest; pure simulation separated from rendering; validation on real devices |

The precise thresholds are proposed, not already validated by the user, except where marked « Confirmed ». Ground pickup is a first interpretation of « recover in order to throw back », more accessible than in-flight interception.

## 3. Scope and priorities

| Priority | Contents |
| --- | --- |
| P0 | Non-isometric top-down view, sole Paul, free movement, hordes and three variants, circular strike, pickup weapons, recoverable projectiles and throw-back, protected peaceful groups, health, healing, toolboxes, local emergencies and rescues, arcade mode in rounds with no limit, school and capture, score, « Casseurs neutralisés » counter, pause. |
| P1 | Polished pixel art, shop, new weapons unlocked by round (section 8.7), variety of assaults, spotting, accessibility, optimisation and long session on a real phone. |
| P2 | Other maps/cities, full dialogues, in-flight projectile recovery if useful, PWA. |

The release target includes P0 and P1. Proposed minimum content: one neighbourhood, three recurring objectives, three hostile visual variants and two combat behaviours (contact/thrower), three peaceful groups, two healing points, three contact weapons and at least four assault compositions.

The map must be freely traversable, including between two objectives. Objectives can be activated gradually for learning; the player is not locked into a succession of closed arenas. The camera must not pull the player by force towards a mission.

Out of scope: 3D, isometry, large open world, wall building, mandatory corridors, driving, realistic firearms, gore, multiplayer, account and complex inventory. The enemy shooters and the cartoon flashball of EX-07 (v1.9) are an exception.

Variety target: several different situations in the first ten minutes if the player survives, with no minimum or maximum duration imposed.

## 22. Production and deliverables

| Package | Deliverable | Passing condition |
| --- | --- | --- |
| L0 | Pixel-art reference, Paul, map and rules | Orthogonal view and templates validated at real size |
| L1 | 2D scene with movement, circular strike, pickup weapons and three variants | Precise control on keyboard and touch |
| L2 | Protected groups, thrower, stones, stock and throw-back | No damage from Paul to the groups; coherent projectile cycle |
| L3 | School and capture | Objectives legible in the top-down view |
| L4 | Healing, toolboxes, place health and dynamic rescues | Legible emergencies, repairable ruins, protection of victims from Paul |
| L4b | Shop, fixed-roster rounds, new weapons and hordes | Arcade session renewed until KO |
| L5 | Finish, sounds, menus, accessibility and records | Complete journey without development tools |
| L5b | Landing page and game access | Presentation, rules, controls, direct navigation and separate loading validated |
| L6 | Profiling and endurance | Forty hostiles, groups and projectiles on real devices |
| L7 | Delivery | Sources, build, assets, measurements and limits |

L1 and L2 precede the production of all scenery. The change of engine and art direction requires a new reference scene; the results of the 3D prototype are not enough.

Deliverables: locked code and dependencies, static build, sprite/map/sound sources, asset register, horde and healing parameters, tests and real-device reports, gameplay videos. Skills: 2D web game development, pixel art and animation, map design, balancing, sound and mobile QA.

The budget and the schedule remain to be costed after the 2D reference scene. No purchase or firm schedule is implicitly approved by this document.

## 23. Planned extensions

### 23.1 Shop — content proposed for the arcade V1 (not delivered)

Disperse a gathering of rioters in front of a shop: +4. If a destruction incident targets this shop, its health follows the same rules as the school (section 10.2). Then stay 2 s at the door to raise the shutter, automatically (v1.9): +5, once. The shopkeeper remains protected and striking him costs −2. The shutter cannot be raised while the required rioters are active. If the building is destroyed, a toolbox is needed for restoration, and the late bonus replaces the unearned rescue gains to avoid a double payment. Leaving the door resets the shutter progress to zero.

**Changed (v1.9.4):** the delivered shop is the retro video-game shop of section 12.2, an ordinary incident place (health, fire, ruin, toolbox; +6 / −2 / +4). The shutter, the shopkeeper and the reopening bonus described above are not delivered.

This mission becomes the third proposed objective type to vary the arcade session. It is repeatable on new announced occurrences, with its own identifiers. It does not restore health to 100. A healing point in the back room can be made easier to reach after reopening, without becoming an unlimited stock.

### 23.2 Students and teachers: dialogues

Conversation nearby, three lines, Next / Finish / Later commands (« Suivant / Terminer / Plus tard »); simulation pause and a +3 bonus once per session when the exchange is finished. Leaving gives no bonus; resuming must not duplicate the gain.

Contents requested initially: an institution damaged by the rioters rather than by the march; a line attributing 32 % of the national education budget to pensions; for teachers, an argument about salaries, working conditions and hiring.

The 32 % figure is kept here as a requested wording for a character's argument, not as data verified by this specification. Before its final integration, specify the period, scope and wording, or keep a line without a figure. These dialogues are not a prerequisite for the Paris V1.

### 23.3 Other cities and tension

Lille, Limoges, Bordeaux, Lyon, Grenoble, Marseille and Nice, in addition to Paris. Possible return of the map of France only at this stage, with no hero customisation screen. Each destination has a public place and students or teachers. A tension between 2 and 5 changes the size of the waves according to a documented configuration.

Do not publish eight names for an identical neighbourhood by presenting them as eight distinct environments. Reusing a kit is possible, but each destination must bring an identifiable layout or finish.

### 23.4 Additional weapons

The former « contact props » extension is replaced by the pickup weapons of section 8.7 (Stick, Hammer, Road sign). Among the weapons unlocked by round, the shield is delivered (v1.9.7, section 8.9); the energy wave (« kamehame ») and fury mode are delivered as powers of the energy gauge (v1.9.14, sections 8.8 and 8.9); the spring boxing glove and the flashball are delivered (v1.9.15, sections 8.7 and 12.14). Firearms follow EX-07 (v1.9): cartoon flashball for Paul, enemy shooters from round 6 (delivered, v1.9.15). Any new weapon defines animations, range, number of hits and rarity before being added; the score of a KO stays the same whatever the weapon.

### 23.5 Distribution and comfort

Optional PWA installation, offline start after full caching, extended gamepad support, other languages, more settings and new neighbourhoods. A global leaderboard or a multiplayer mode would be a separate project with its own backend and rules.

## 25. Remaining decisions and sources

### 25.1 Parameters to validate with the 2D prototype

| Subject | Working proposal |
| --- | --- |
| Direction | Orthogonal top-down pixel art, no isometry |
| Hero | Paul (fictional), long hair, black rectangular glasses, black outfit, light accent, single sprite |
| Templates | 32 × 32 tile; LPC cells 64 × 64, silhouette about 32 × 48 |
| Movement | Eight directions, normalised diagonals |
| Contact | 56 px circular strike bare-handed, three targets maximum (confirmed) |
| Weapons | Ranges, hits and spawn rhythm of section 8.7 |
| Rounds | Rosters 10, 14, 18, 22 then +3 (v1.1.1); at most 12 rioters on the map |
| Recovery | Fallen enemy stones, automatic pickup |
| Stock | Three stones; thrown-back stones not recoverable |
| Peaceful groups | Not targetable by Paul; enemy distress only in an announced event |
| Urgent buildings | Health 100 HP (buildings) / 60 HP (furniture); fire 2 HP/s, degrader 1.2 HP/s (four at most), smouldering fire 0.7 HP/s; Molotov on a burning place −8 HP |
| Monument | 6 occupants the first time, then min(8, 5 + ⌊round ÷ 3⌋); replacement in 4 s (three occupants counted at most); 8 s capture in a 112 px zone |
| Rescue | Local deadline of 25 s (range 20 to 30 s), two simultaneous emergencies at most from round 3 |
| Toolboxes | One carried, two on the ground (placed at the start and end of a round), repair or extinction started by F / Agir, 2 s without holding and with no rioter within 64 px |
| Other neutrals | Former penalties kept if they remain touchable; generalised protection option to be decided |
| Hordes | Forty hostiles maximum for the normal reference |
| Projectiles | Twenty-four in flight and sixteen recoverable on the ground at most |
| Engine | Phaser 4.2.1 chosen; compatibility to be confirmed on real devices |
| Duration | Arcade mode in rounds with no limit, health and healing kept |
| Assets and distribution | Universal LPC, Kenney / LPC CC0 chosen; no new publication authorised by this specification |

These parameters make it possible to build a working version without waiting for every artistic detail. The first 2D slice exists (section 24); it does not yet validate these parameters on real devices.

### 25.2 Technical sources

Consulted on 19 October 2026, updated on 20 October 2026. The budgets and rules are project choices, not guarantees provided by the sources.

- [Phaser — official download](https://phaser.io/download).
- [Phaser — archives and versions](https://phaser.io/download/archive).
- [Phaser — Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade).
- [Phaser — cameras](https://docs.phaser.io/phaser/concepts/cameras).
- [Phaser — Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager).
- [Phaser — rendering options and pixel art](https://docs.phaser.io/api-documentation/typedef/types-core).
- [Phaser — state of the renderer and Canvas](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games).
- [Vite](https://vite.dev/guide/).
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/basic/).
- [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
- [Kenney — CC0 assets](https://kenney.nl/assets).

The hero Paul is a fictional character; no source links him to a real person.

### 25.3 Definition of “done”

Landing page accessible and game directly accessible; separate loading; Paul playable in a non-isometric top-down map; reference pixel art reached; free movement; legible hordes; coherent circular strike, weapons and projectiles; recovery/stock/throw-back without duplication; groups protected from Paul and rescuable; health/healing; place health and fair rescue deadlines; persistent ruins and toolboxes; school/capture and fixed-roster rounds; end at KO; performance and long session validated on real devices.

A pixelated screenshot, a perspective conversion or the former 3D tests are not enough.

> Subsection 25.4 (History) is kept in the [specifications index](SPECS%20-%20Index.md#254-history).
