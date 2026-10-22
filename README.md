# BreakBreaker

A 2D top-down pixel-art arcade web game, rewritten from the old Three.js prototype (kept in the git history). The game's text is in French.

Specification: [`docs/SPECS - Index.md`](docs/SPECS%20-%20Index.md) (v1.0.0, English; in-game texts quoted in French), the index of the split spec files in `docs/` (vision, journey and map, controls and interface, combat, places, rounds, art and sound, technical, acceptance). Slice 2 design: [`docs/superpowers/specs/2026-10-20-slice-2-fun-design.md`](docs/superpowers/specs/2026-10-20-slice-2-fun-design.md).

## Features

A full session in a single district, playable with keyboard/mouse or touch (first playable slice + slice 2 phase A):

- **Rounds**: the game is split into rounds (`Manche N`), from 1 until Paul is knocked out (or the player quits); no global timer. Each round is announced (« MANCHE N ! » banner with its headline, e.g. « Voiture menacée · 18 casseurs », « Vol en cours » for a theft rescue), the HUD score list shows its objective (`MANCHE N · K/T`), a twist fires once half the roster is down (every round from 2 a weapon drop: from round 3 the bouclier half the time, announced « BOUCLIER DISPONIBLE ! », otherwise a regular weapon half the time, else nothing; odd rounds from 3 add a second urgency on top), and the last group comes in faster. When the whole roster is knocked out, a 6 s breather (no rioter enters) shows a non-blocking « Manche N terminée » panel (KOs, objectives réussi / perdu, points, +5 bonus when every objective succeeded) while heal stations recharge.
- **Energy gauge** (« ÉNERGIE », v1.9.14): every knocked-out rioter fills it (+6, +10 for a brute, +25 for Le Caïd; nothing during the mode furie or from the beam's own KOs), it is kept across rounds and never decays. From 50, a single press of **C** (touch: Onde) charges the onde d’énergie for 0.7 s on its own (no need to hold; only Paul's KO or the mode furie cancels it; costs 50 when it fires); full, press **R** (touch: Furie) to spend it all on the **mode furie**: 18 s of power (×1.35 speed, ×1.5 reach, up to 8 rioters per strike, one-hit KOs that do not wear the held weapon, half damage taken) with a yellow-white aura, and every rioter he knocks out flies off spinning. Too little energy: « Énergie insuffisante ». HUD row with a segmented bar and the key to press (« C · Onde » from 50, « R · Furie » when full), a thin bar under Paul's health bar, glowing touch buttons, ready chimes.
- **Special weapons**: the **bouclier** (shield; the only special pickup: half the twist drops from round 3, 1 in 6 street spawns from round 5) is protection only (v1.9.16): picking it up starts a 20 s bubble around Paul on top of the weapon he holds (HUD « Bâton (12) · Bouclier 14 s »; a second one restarts it; no bash, Frapper stays his normal strike); it blocks every rock, firebomb and bullet that would hit him from any side (blocked rocks drop and can be picked up; ground fire and contact blows still hurt), flickers faster in its last 3 s then pops; the **onde d’énergie** (energy beam, internal id `kamehame`, from the energy gauge) charges for 0.7 s after one press of C (Paul stands still inside a charge ring; releasing C or being hit no longer cancels it, a KO or the mode furie does, at no cost), then fires a 320 px beam that knocks out every rioter on the line and shoots them into the sky (« satellisés »: they spin away along the beam, shrink and vanish with a star twinkle), stopped by walls, props and the peaceful group. Only the bouclier on the ground has an edge indicator (« BOUCLIER »).
- **Floating score popups**: every score change shows where it happened, a pixel « +N » in green or « -N » in red that pops, rises and fades in about 1 s (the rioter knocked out, the place's door, the victim, the monument, Paul for the round bonus); bigger for bigger changes, staggered when many land at once, a simple 0.6 s fade under `prefers-reduced-motion`.
- **KO falls** (v1.9.17): every knocked-out rioter falls according to what hit him (bare hands crumple or spin, sign and stick fly off spinning, hammer pancake, glove bounce, flashball backflip, returned rock wobble); about 1 KO in 10 is a rare « WTF » fall (triple flip, helicopter, faceplant slide, head-first in a trash can, or a **domino** that knocks down up to 2 neighbours within 56 px, +1 each, never Le Caïd). Falls are cosmetic except the domino. Onomatopoeias per source, three screen-shake levels, doubled hit-stop on a WTF KO, at most 8 animated bodies; with reduced motion: no shake, halved freezes, shorter falls without spins or hops.
- **Runners, brutes and Le Caïd**: from round 3 a pack of 4–6 fast, fragile hooded runners (1 HP, ×1.6 speed) and « Le Caïd », a crowned mini-boss (v1.9.16: 14 HP in round 3, +2 every 2 rounds up to 26; takes 1 from bare hands and returned rocks, 2 from a weapon / flashball / glove, 5 per mode furie hit, 10 per energy beam; hits ×1.5 harder, pushes Paul back 52 px, attacks a bit faster; segmented HP bar, one segment per 2 HP; « LE CAÏD ARRIVE ! » banner and a « CAÏD » edge indicator) who is always the round's last rioter (+5 on top of the +1, and he drops a weapon half the time); from round 4 helmeted brutes (4 HP, slow, push Paul back 28 px; 2 from round 6, 3 from round 8); a held weapon only does 2 damage to brutes and the Caïd.
- **Shooters, flashball and boxing glove** (v1.9.15): from round 6 cartoon AK-47 shooters (1 a round, 2 from round 8, 3 from round 10 (v1.9.24), in the climax group; 3 HP) keep 220–300 px away, draw a red aim line with a « ! » for 0.8 s, then fire a 3-bullet burst along that fixed line (step aside to dodge; 8 damage, stopped by walls, the peaceful group, the victim and the bouclier bubble). Two new street weapons: the **spring-loaded boxing glove** (from round 3, 6 uses: a 160 px straight punch that knocks the first rioter out and back, « BOING ! ») and the cartoon **flashball** (from round 5, 6 shots toward the mouse, light aim assist on touch; one is dropped near Paul with « FLASHBALL AU SOL » when the first shooter walks in).
- **Firebombers**: from round 3 a few rioters (about 1 fill rioter in 8, at most 3 per round, plus the last Molotov thrower of each site attack once its bottle hit the site) also throw Molotovs at Paul: a 1.2 s telegraphed windup aimed at where he stood, then a 3.5 s fire patch on the ground that burns him (4 hp every 0.5 s, halved in mode furie) while he stands in it; keep moving to dodge.
- **Buildings with health**: the school, two parked cars and a bus shelter have a health bar (on the map and in the HUD card). Molotov rioters wind up for 1.5 s (knock them out first and there is no bottle), then the target burns; degraders hit it too. Each attack brings several Molotov throwers, more as rounds go on (1, 2, 3, then 4; at most 2 on a car or the bus shelter); a bottle on a place already burning takes 8 HP off it at once. Knock out the attack's rioters before any fire and the place is saved (+8 school, +4 car / bus shelter); a fire never goes out by itself, only a toolbox puts it out. At 0 HP the place becomes a ruin (−3 / −2) that stays across rounds; the session goes on.
- **Toolboxes**: walk over a toolbox to carry it (its icon floats above Paul), go next to a ruin or a burning place with no rioter close and press F (touch: Agir; a fresh press, holding F on the way does nothing): 2 s later, without holding the key, the ruin is repaired or the fire put out, restoring full health (+5 / +3). A fire never goes out by itself.
- **Retro video-game shop**: a « JEUX RÉTRO » storefront (pixel joystick sign, striped awning, lit windows) is a 100 HP building to protect like the school: it joins the random headline draw from round 2 (round 1 is always the school; from round 2 the headline casse is a seeded random pick among every free place); saved +6, ruined −2, put out or repaired with a toolbox +4.
- **Equestrian monument and capture the flag**: a bronze rider on a stone plinth holds a waving French flag; from round 4 (every other round, instead of the rescue, while the flag is French) rioters rush the statue and swap it for a Palestinian flag in a few seconds (−3; all knocked out first: +4); the flag stays until Paul holds the zone for 8 s with no rioter inside (+10, « zone contestée » otherwise), even during the breather.
- **More places, two attacks at once, field heals** (v1.9.18): four new places to defend, a nursery (south-west building, from round 5), a newspaper kiosk (prop, from round 5), the town hall (north building, round 7) and the library (south building, round 9); from round 5 two places are attacked at the same time from the start of the round (new kinds first; the odd-round twist never adds a third urgency); a roster that would be too thin grows past 40 (the 40 active-hostile cap holds); every 8 round KOs a small +10 heal drops near Paul (two on the ground at most, 20 s, blinking at the end, « +N PV » popup on pickup).
- **Phone booths, fire truck and police** (v1.9.19): two phone booths on the centre-west plaza, a red one (fire truck) and a blue one (police), are 60 HP places that join the casse draw from round 3. Stand at one and press **F** (touch: Appeler) for 3 fire calls and 3 police calls per game: the truck drives in from a map edge, sprays every fire within 80 px (never repairs, keeps the place's remaining HP; 60 HP, 60 s at most), the police send 5 one-HP officers who baton rioters (+1 each, 40 s). Rioters near them fight them. Refusals: « Aucun feu à éteindre », « Pas assez de casseurs » (under 8 rioters), « Plus d’appels », « Déjà en route ».
- **Prison** (v1.9.20): a 400 HP prison on the south-east block (round 4+, +8 / −3 / +5, two-urgencies rule applies). A Caïd you knock out while it stands is carried off by a jail van and locked up (« BOUCLÉ ! », counter « Caïds enfermés : N »; the +5 is unchanged, also when the police or a guard knocked him out). If the prison falls, every jailed Caïd breaks out at once at its door (« ÉVASION ! », counted in the round's total; nothing happens if the cells are empty). 5 bare-handed guards (1 HP per blow, a Caïd's HP for the round, min 14) hold posts within 160 px and come back in the breather unless the prison is ruined; they are outside the 40-hostile cap. A toolbox rebuilds it to 60 % HP, and released Caïds stay free.
- **Decor fronts** (v1.9.25): two free buildings get a purely decorative front, never attacked, no health bar, no interaction (solid like any other building): « CAF », a sober pale-stone office with a glazed counter window and a small queue of people waiting outside, and « TASTY CROUSTY », a colourful fast food with a lit sign, a counter, a big pixel drumstick on the roof and fryer smoke rising from a chimney (the queue's bob, the sign's pulse and the smoke are off under reduced motion). Only the names as sign text, no real logo.
- **Clearer actions and louder alerts** (v1.9.21): whenever **F** (touch: Agir) would do something, a pixel bubble floats above the place — « F · Réparer », « F · Éteindre », « F · Appeler les pompiers / la police » (only when the call would be accepted), a ring filling during the 2 s repair, or « Il faut une caisse à outils » with an arrow to the nearest toolbox; the touch Agir button pulses with the verb. Carrying a toolbox, ruins show a wrench and RÉPARER edge indicators (OUTILS ones for toolboxes otherwise); a one-time help line at the first ruin. Bigger banners (3.5 s minimum, a shake, the Caïd's alarm), attacked places flash red with a ring pulsing faster as they lose health, larger edge indicators, a red screen-edge glow on each new attack; all softened under reduced motion.
- **School defense**: the round-1 school assault has a first line, then, once it is down, a short "Renforts en approche !" sequence (skippable with Space or F, or a tap) announces 8 reinforcements.
- **Rescue**: reach a threatened victim (« À L’AIDE ! » bubble) and knock out the attackers: the rescue then ends by itself (« MERCI ! », +6), no key to press.
- **Stolen belongings**: while the attackers work on the victim they snatch its belongings (bag, hat, cane, backpack, scarf, cap) one by one; knock a thief out, walk over what it dropped and bring it back to the victim (+2 each; once safe, the victim waits up to 12 s for them).
- **Alerts**: each new incident pops a pixel-style banner (« ÉCOLE EN FEU ! », « VOITURE EN FEU ! », « ABRIBUS SACCAGÉ ! », « AGRESSION EN COURS ! », « VOL EN COURS ! ») with an arrow and the distance, and an indicator at the screen edge points to every active incident that is off-screen.
- **Rocks**: throwers telegraph their throws; Paul picks up fallen rocks (3 max) and throws them back.
- **Circular strikes**: Paul's strike hits all around him (up to 3 rioters).
- **Weapons**: a stick, a hammer or a road sign appears at random in the streets (v1.9.16: rarer — the first at 20 s, then every 30–45 s, one on the ground at a time, never a new one within 200 px of a weapon already near Paul; the round-end drop only after even rounds; v1.9.24: one nobody picks up vanishes after 60 s, blinking its last 3 s, which frees the slot); walk over it to pick it up. Weapons knock a rioter out in one hit, reach further and wear out after a number of hits (15 / 8 / 10).
- **Healing**: walk over a "Soins" kit to recover 25 HP (one charge per kit).
- End-of-session summary (score, local best, round reached, perfect rounds, places saved / destroyed / repaired, school and rescue counts « 2 sauvées · 1 perdue », belongings returned, monument defences and flags, stats) and Replay.

The landing page (title, "Jouer", "Commandes" modal) has an original pixel-art hero: a top-down street scene (burning school, Paul, rioters, flying rocks, a heal kit, a peaceful group) composed from the game's own tiles and LPC sprites by `npm run hero`, shown full-bleed with `image-rendering: pixelated`, with the Press Start 2P pixel font (SIL OFL 1.1) for the title and buttons. Its "Jouer" link (`/jouer/?go`) starts the game right away, with a blocking "Comment jouer" card (the game waits for a key or tap); a "Commandes" button in the game opens the keys and rules. Opening `/jouer/` directly shows the rules screen first.

Design choices:

- The hero is **Paul**, a fictional character; no character represents a real person.
- Every rioter knocked out scores **+1**; the HUD shows a neutral **"Casseurs neutralisés"** counter (« NEUTRALISÉS » in the score list).
- **32 px** tiles, LPC sprites in **64×64** frames.
- Scaling: `Scale.RESIZE` (the canvas fills the window, 1 CSS px = 1 canvas px) with an **integer camera zoom** (landscape: `floor(min(w/640, h/360))`, portrait: `floor(min(w/360, h/640))`, minimum 1). Crisp pixel art, never stretched.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | ZQSD, WASD or arrows | Joystick (left half of the screen) |
| Strike | Space or left click | Frapper button |
| Throw a rock back | E or right click (aim with the mouse) | Renvoyer button (tap = last aim, drag = aim) |
| Run | Shift | Push the joystick all the way |
| Onde d’énergie (gauge ≥ 50) | C (one press) | Onde button (one press) |
| Mode furie (full gauge) | R | Furie button |
| Pause | Esc | Pause button |

## Stack

Vite, TypeScript (strict), Phaser 4.2.1, Vitest. Deterministic fixed-step simulation (60 Hz) in `src/sim/` (no Phaser), rendering and UI in `src/game/`.

Two entry points:

- `/`: static landing page (title, play button, controls modal, credits), no game code, no JavaScript.
- `/jouer/`: the Phaser game.

## Scripts

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build into dist/
npm run preview    # preview the build
npm test           # vitest run (includes a production build check, in a temp folder)
npm run typecheck  # tsc --noEmit
npm run assets     # download and assemble assets (LPC sprites, tiles, sounds) and regenerate public/CREDITS.md
npm run hero       # regenerate the landing hero src/site/hero.png from the game tiles and sprites (deterministic, offline)
npm run bench      # cost of one simulation step under load (40 rioters, 24 rocks in flight)
```

To test on a phone on the same Wi-Fi: `npm run dev -- --host`, then open the "Network" address.

## Roadmap

Slice 2 « Fun » ([design](docs/superpowers/specs/2026-10-20-slice-2-fun-design.md)), after phase A (rhythm + buildings): phase B new enemies (runner, brute, cartoon AK-47 shooter, « Le Caïd » mini-boss) and weapons (flashball, spring boxing glove, shield, kamehame); phase C more places to defend (shop, monument, nursery, kiosk, town hall, library); phase D funny KO falls and hit juice.

## Credits

Sprites, tiles and sounds are free assets (notably LPC, CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0, and Kenney, CC0). Every author and license is listed in [`public/CREDITS.md`](public/CREDITS.md), generated by `npm run assets` from `scripts/credits-template.md`, and linked from the landing page footer and the in-game pause menu.
