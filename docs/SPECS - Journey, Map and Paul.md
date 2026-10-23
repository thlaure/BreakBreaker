# BreakBreaker — Specifications: Journey, Map and Paul

> **Purpose of this file:** the player's journey, map and objectives, Paul (movement and camera), landing page and access to the game.  
> Part of the BreakBreaker specifications (version 1.0.1), split into several files. Back to the [specifications index](SPECS%20-%20Index.md) (overall table of contents, version history, conventions, file map).

## 4. Player journey

### 4.1 Landing

The site opens on a light landing page, separate from the game and deliberately plain: title, tagline, a « Jouer » (Play) button (which launches the game directly) and a « Commandes » (Controls) button (key bindings modal). **Confirmed (1.6):** the game rules and instructions are not on the landing page; they are displayed when the game launches (§26.4). Its detailed content is defined in section 26. No choice of gender or skin tone; no global duration limit announced.

### 4.2 Entry

**Confirmed:** « Jouer » opens `/play/?go`. The game page displays its loading progress (engine, sprites, tiles, collisions, useful sounds and first opponents), then, as soon as the essential resources are ready, the « Comment jouer » (How to play) card is displayed: **changed (v1.9.4)** it is blocking, the game waits for a key, a click or a tap (RC-70, RC-87), then starts (4 s intro, round 1). Sound unlocks on this first gesture. A direct visit to `/play/` (without `?go`) displays the rules screen with the « Commencer » (Start) action. Top-down camera as soon as control is taken, no over-the-shoulder cutscene and no 3D model.

The first school is indicated, along with a peaceful group and a nearby healing point. The first seconds allow moving around before being pressed by a horde. The first attack is announced and leaves time for the trip from the starting point (health only drops through fire or blows); it does not necessarily wait for Paul to enter the circle. The first thrower is introduced alone or in small numbers to teach recovery.

### 4.3 Loop

Explore → spot an objective / a healing point / a weapon → fight or bypass → dodge and collect stones → throw them back → resolve the objectives and neutralise the round's roster → « Manche N terminée » (Round N complete) panel (non-blocking) while the next round starts.

Succeeding at the objectives does not end the session. Health, score, KOs, healing used, carried stock and held weapon persist between objectives and rounds, under the resupply rules.

### 4.4 End

Health at zero: KO, summary and Replay. A voluntary stop remains available from Pause. Replay resets the whole session state, not the compatible preferences and records.

## 5. Map, exploration and objectives

### 5.1 Map

Fictional Paris in orthogonal tiles: ground, squares, open streets, buildings, school, monument, shop, healing and peaceful group locations. Template chosen for the first slice: 48 × 48 tiles of 32 pixels, i.e. 1,536 × 1,536 logical pixels, to be adjusted through testing.

The size must produce real route choices without long empty crossings. Two nearby objectives may be visible in different directions. The first destination remains quickly reachable from the start.

**Decor facades (v1.9.25).** Two free buildings on the map receive a purely decorative shopfront, with no interaction at all: they are ordinary solid buildings (obstacles for Paul and the rioters, like the others), never places (`DISTRICT.decor`, outside `DISTRICT.targets`): no incident, no draw, no fire, no health bar, no ruin, no repair, and no rioter heads for them. They are at least 64 px from spawn points, healing, rescues, toolboxes, guard posts, other places and the monument, and their door opens onto the street below the facade.
- **« CAF »** (building 2, to the north, R(26,4,7,5), door at C(29,9)): sober facade in light stone (courses, joints, cornice), two small frosted windows, a glazed counter window with an agent behind the speak-through grille and a stone ledge, an aluminium glass door, a notice board, and a small queue of five people waiting along the wall, facing the door (slight breathing sway, motionless with the reduced-motion preference); slate-blue « CAF » sign with a cardboard folder on the roof edge.
- **« POULET CROUSTI »** (building 8, east of the monument, R(38,16,6,6), door at C(41,22)): colourful fast-food shopfront (tomato-red wall, mustard trim, checkerboard plinth, striped awning), menu board, lit counter with a cook at the fryer and a tray on the stainless steel, red glass door, dining room with table and stools, warm light on the pavement; lit « POULET CROUSTI » sign with a halo that pulses gently (fixed with the reduced-motion preference), a big pixel chicken drumstick on the roof and fryer smoke rising from a chimney (particles; none with the reduced-motion preference).

The names are only the text of the signs, in our pixel style and our colours: no real logo. The sign, the drumstick and the chimney fade with the roof when Paul passes underneath. Rendering: `src/game/render/decor.ts` and its pure helpers `decorMath.ts`.

### 5.2 Free movement

No walls added as a mechanic, no imposed mazes of alleys. Building footprints, tree trunks and solid objects remain consistent obstacles. Paul cannot walk through them; the drawn foliage may be above the character without artificially enlarging the trunk's collision. Map limits are readable and the accesses do not form unintended traps.

No objective may have a single passage that a peaceful group could completely block. Healing points, toolboxes and rescue zones have practicable accesses. The real travel distance is used to plan an urgent event, not just the straight-line distance. Groups leave several possibilities for going around them; they are not closed, invulnerable refuges.

### 5.3 Layers

Ground; ground details; solid footprints; objects; characters; upper parts of buildings; effects; objective markers; HUD. Depth order tied to the feet position for overlapping elements.

Roofs or upper parts that hide Paul become transparent or disappear locally. A building's collision follows its footprint, not the whole drawn height of the sprite.

### 5.4 States

School degraded/on fire, rebuilding, open, lost then possibly reconquered. Monument with the French flag, attacked, flag replaced, contested zone, flag retaken (v1.9.4). Retro games shop, cars and bus shelters: intact, attacked, on fire, in ruins, repaired (same states as the school). Healing charged/exhausted; weapons on the ground; peaceful groups always recognisable.

Each new assault is announced and identified; bonuses are not replayed by a purely graphical change. A destroyed place stays in ruins until it has been repaired with a toolbox; a round transition does not repair it for free.

## 6. Paul, movement and camera

### 6.1 Hero

Paul's sprite with long hair, **black rectangular glasses** (v1.9.10, project owner's request; visible in the three front and side orientations, reused in the site icon and the landing image) and black clothes, with a light accent (white scarf or bib), readable in at least four orientations. Light accent, silhouette, animation and outline must make it possible to tell him apart from the standard rioters, who also wear dark colours.

Sprite chosen: character composed from the Universal LPC spritesheets, 64 × 64 pixel cells for a visible silhouette of about 32 × 48, with animation variants and separate props. The feet define the anchor and the small ground collision area.

### 6.2 Movement

Eight free directions. Left moves to the left of the map, up toward the top, regardless of the previous facing. The 3D scheme « left turns the nose » is replaced. Diagonals are normalised so as not to speed up.

Proposed initial values, adapted to 32-pixel tiles: 180 logical pixels/second walking, 250 running. The exact speed remains to be balanced. Quick stop and slight smoothing, without inertia that prevents dodging a pebble.

No jump, roll or essential stamina bar in V1. The requested dodging relies first on movement. A possible roll is an extension, not an implicit condition of playability.

### 6.3 Camera

Fixed-orientation top-down camera, centred with a small dead zone. No rotation control and no isometric perspective. Following is smooth but rounded to the pixel at render time to preserve sharpness; the camera zoom is always an integer.

Visibility around the hero must leave time to read a throw preparation. A threat indicator may announce an off-screen thrower; a projectile must not reach Paul without a signal or a sufficient delay.

Landscape/portrait adaptation through framing and HUD zones, without stretching sprites. An orientation change does not make enemies appear within immediate range and does not change their speed.

## 26. Landing page and access to the game

### 26.1 Role and scope

A single public page presents the game and allows launching it quickly. It conveys the genre and gives access to the controls (modal); the rules are explained in the game, at launch. It requires no account, no registration and no application download.

The functional structure and the contents are defined below. **Confirmed (1.6):** few elements, a crafted full-screen visual. **The landing visual is original**: a top-down pixel art scene, composed from the game's tiles and sprites (script `npm run hero`, a single decorative PNG image at its native size, enlarged without smoothing), **flags excluded** (cosmetic props of the game, never used as a promotional visual); no photograph of a real event, nor of real people, is used without rights or consent, and no image presents real demonstrators or groups as adversaries in the game. The final name and the promotional texts remain editable without changing the journey.

Landing and navigation are P0. The final dressing and a representative preview are P1, required for a public release of the finished version. No shop, newsletter, fake reviews, invented player counter or social network required for the first version.

### 26.2 Recommended content, in reading order

| Block | Expected content | Action |
| --- | --- | --- |
| Full-screen visual | Original pixel art scene composed from the game's tiles and sprites (school on fire, Paul, « standard » rioters, projectiles, road sign on the ground, healing kit, peaceful group with blank placards), flags excluded; decorative, with no text carrying information, with embers and glow animated in CSS (disabled if reduced animations are requested) | None |
| Presentation | Game name and a one-sentence promise (the genre is in the site description, not as a kicker) | Main button « Jouer »; secondary button « Commandes » |
| Controls | Modal (without JavaScript) with the table of computer and phone controls, drawn from the same source as the game | Opened by the « Commandes » button, closed by « Fermer » (Close), Esc or outside click |
| Footer | Version and prototype/playable version status, credits, link to the source code, satirical fiction notice | Credits, source code |
| Site icon | Pixel art favicon taken from Paul's head (`npm run favicon`: `favicon.png` 32 × 32 and `apple-touch-icon.png` 180 × 180), theme colour `#14121c`, linked from `/` and `/play/`, credited as an LPC derivative | None |

Chosen presentation text: **« Défends le quartier aussi longtemps que possible. »** (Defend the neighbourhood for as long as you can.)

**Confirmed (1.6):** no line of notices (solo, platforms, no account) under the Play button. If such a notice returns, it will only display the compatibilities actually verified. The « free » mention will only be added if that distribution model is confirmed.

Balancing figures, technical architecture, detailed rules and the feature list have no place on the landing page.

### 26.3 Rules to explain at game launch

**Confirmed (1.6):** these rules are displayed by the game, not by the landing page: on the launch card (§26.4) and in the game's « Commandes » modal.

- The session has no global time limit: it ends at KO or by voluntary stop.
- The game advances in rounds, with a short breather between two: neutralise the round's roster and handle its objectives to move on to the next. Attacked places have a health bar and rescues a local deadline. Missing an intervention does not stop the game; a toolbox and the F key (Act button) make it possible to extinguish a burning place or repair a ruin.
- Peaceful groups and victims are to be protected and bypassed. Paul's strike excludes them.
- Fallen enemy projectiles can be recovered then thrown back; weapons and, when things heat up, a shield appear in the streets; each KO fills an energy gauge that gives the energy wave (one press of C, from half) and fury mode (R, full gauge); health and healing are limited, a station heals when walked over.
- The controls displayed reflect the assignments actually delivered in section 7; do not maintain a second divergent list. Present keyboard and touch without implying that a mouse is required on a phone.

The game's satirical status is stated in one readable sentence. The site does not present the fictional scenes as a reconstruction; Paul is a fictional character. Gameplay markers and counters are explained in the rules and the summary, without attributing documentary value to them.

### 26.4 Navigation and launch

Proposed routes: **`/` for the landing page**, **`/play/` for the game**. They may be served as two static entries in the same repository, without any additional site framework. Both routes and their resources must work after direct navigation and reload on the chosen hosting.

**Confirmed:** « Jouer » is a real link to `/play/?go`, in the same tab. The game does not start loading on hover, scroll or when the landing page is opened. No automatic preloading of the engine or atlases. The game page displays progress, errors and a Retry action on failure. With `?go`, as soon as the essential resources are ready, **the « Comment jouer » card** (objective, main keys, « Appuie sur une touche pour commencer » (Press a key to start) / « Touche l’écran pour commencer » (Touch the screen to start)) is displayed over the game; **changed (v1.9.4):** it is blocking, the game waits for a key, a click or a tap to start, with no timer (RC-70, RC-87); a **« Commandes »** button remains in the interface and opens a modal (keys and rules) that pauses the game until it is closed. Audio unlocks on the first key press, first click or first tap.

Direct access to the game is allowed: the landing page is not a mandatory step. A direct visit to `/play/` displays the screen of essential rules and controls with the « Commencer » action. Audio activation happens on a gesture within the game page; a click made on another page must not be assumed sufficient.

Pause and summary offer « Retour au site » (Back to the site). From a session in progress, an integrated confirmation states that it will be abandoned, with « Continuer la partie » (Continue the game) and « Quitter la partie » (Leave the game). From the summary, a direct return. Reloading or closing does not guarantee resumption: no session save is planned in V1. The record and the preferences already stored remain local to the browser and the same origin.

Before delivery of the new 2D game, do not link a button announcing this game to the old 3D prototype without a warning. In internal review, a preview may be marked « mock-up »; for release, use a real capture of the playable version. A missing feature is removed from the presentation or clearly announced as upcoming.

### 26.5 Accessibility, phone and media

Semantic HTML, one main heading, consistent reading order, real links and buttons, full keyboard navigation, visible focus and sufficient contrast. The title, the buttons and the modal title use the pixel font Press Start 2P (SIL OFL 1.1 licence, Latin subset, credited in the credits) with a fallback font; body text stays in the system font. The presentation remains readable without JavaScript; the game displays its need for JavaScript and WebGL if these features are missing. The game's compatibility remains that of section 19.

The Play link must be easy to spot on the first screen on the target formats, without hiding the rules or covering content. Touch areas aim for at least 44 × 44 CSS pixels. Check small screens, browser zoom and the absence of horizontal overflow. An image is not the only carrier of the title, the rules or the controls.

No automatic sound. Any video starts voluntarily, with controls, a poster image and a text alternative; it does not block the game launch. Respect reduced animations. The preview uses a useful alternative text and reserved dimensions to avoid layout shifts. Its unavailability leaves the presentation and the Play link usable.

### 26.6 Loading and proposed budgets

| Measure | Starting target |
| --- | --- |
| HTML, CSS and JavaScript specific to the landing page | At most 300 KB transferred compressed, excluding the optional preview |
| Main static preview | At most 250 KB, suitable format, explicit dimensions |
| Engine, atlases and game sounds before navigating to Play | Zero downloads |
| Possible video | No video download before action, apart from the poster image |
| Resources below the fold | Deferred loading when useful |
| Measurements | Weight, visual stability and display time recorded separately from the game loading |

These budgets are project objectives to be verified on a documented network profile and device. The landing page uses a minimal script if needed; no additional framework, analytics service or tracking cookie is required. The game's resources remain subject to the budgets of section 19.

### 26.7 Deliverables and acceptance

Deliver the texts, the two entry points, the link to the game, the preview faithful to the version, the controls synchronised with the game and the credits. Provide the build and hosting instructions for the two routes. Claude's visual work will have to respect these navigation, loading and accessibility contracts.

Acceptance RC-69 to RC-78 and RC-86 to RC-90 completes the game's acceptance. It must verify the landing → game → summary → landing journey, as well as a direct entry to the game. This document describes that target; it is not proof that the landing page or the new game have already been built.
