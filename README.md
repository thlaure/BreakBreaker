# BreakBreaker

A 2D top-down pixel-art arcade web game, rewritten from the old Three.js prototype (kept in the git history). The game's text is in French.

Specification: [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md) (v1.9.13, French). Slice 2 design: [`docs/superpowers/specs/2026-10-20-slice-2-fun-design.md`](docs/superpowers/specs/2026-10-20-slice-2-fun-design.md).

## Features

A full session in a single district, playable with keyboard/mouse or touch (first playable slice + slice 2 phase A):

- **Rounds**: the game is split into rounds (`Manche N`), from 1 until Paul is knocked out (or the player quits); no global timer. Each round is announced (« MANCHE N ! » banner with its headline, e.g. « Voiture menacée · 18 casseurs », « Vol en cours » for a theft rescue), the HUD score list shows its objective (`MANCHE N · K/T`), a twist fires once half the roster is down (every round from 2 a weapon drop: a regular weapon in round 2, then a special picked among the unlocked ones, announced « BOUCLIER / ONDE D’ÉNERGIE / MODE FURIE DISPONIBLE ! »; odd rounds from 3 add a second urgency on top), and the last group comes in faster. When the whole roster is knocked out, a 6 s breather (no rioter enters) shows a non-blocking « Manche N terminée » panel (KOs, objectives réussi / perdu, points, +5 bonus when every objective succeeded) while heal stations recharge.
- **Mode furie**: from round 4 the half-roster twist drops a rare glowing lightning orb (and from round 6 about 1 in 6 street spawns); walking over it gives Paul 12 s of power (×1.35 speed, ×1.5 reach, up to 8 rioters per strike, one-hit KOs that do not wear the held weapon, half damage taken) with a yellow-white aura, and every rioter he knocks out flies off spinning.
- **Special weapons**: the **bouclier** (shield; twist drop from round 3) is a protection bubble around Paul: it lasts 20 s, blocks every rock and firebomb that would hit him from any side (blocked rocks drop and can be picked up; ground fire and contact blows still hurt), flickers faster in its last 3 s then pops, and bashes (one-hit KO, small knockback, no wear); the **onde d’énergie** (energy beam, internal id `kamehame`; twist drop from round 5) charges while Frapper is held for 1 s (Paul stands still), then fires a 320 px beam that knocks out every rioter on the line and shoots them into the sky (« satellisés »: they spin away along the beam, shrink and vanish with a star twinkle), stopped by walls, props and the peaceful group (2 shots). Specials (furie, bouclier, onde) are the only pickups with an edge indicator (« FURIE », « BOUCLIER », « RAYON »).
- **Floating score popups**: every score change shows where it happened, a pixel « +N » in green or « -N » in red that pops, rises and fades in about 1 s (the rioter knocked out, the place's door, the victim, the monument, Paul for the round bonus); bigger for bigger changes, staggered when many land at once, a simple 0.6 s fade under `prefers-reduced-motion`.
- **Runners, brutes and Le Caïd**: from round 3 a pack of 4–6 fast, fragile hooded runners (1 HP, ×1.6 speed) and « Le Caïd », a crowned mini-boss (6 HP, pushes Paul back 40 px, own HP bar, « LE CAÏD ARRIVE ! » banner and a « CAÏD » edge indicator) who is always the round's last rioter (+5 on top of the +1, and he drops a weapon); from round 4 helmeted brutes (4 HP, slow, push Paul back 28 px; 2 from round 6, 3 from round 8); a held weapon only does 2 damage to brutes and the Caïd.
- **Firebombers**: from round 3 a few rioters (about 1 fill rioter in 8, at most 3 per round, plus the last Molotov thrower of each site attack once its bottle hit the site) also throw Molotovs at Paul: a 1.2 s telegraphed windup aimed at where he stood, then a 3.5 s fire patch on the ground that burns him (4 hp every 0.5 s, halved in mode furie) while he stands in it; keep moving to dodge.
- **Buildings with health**: the school, two parked cars and a bus shelter have a health bar (on the map and in the HUD card). Molotov rioters wind up for 1.5 s (knock them out first and there is no bottle), then the target burns; degraders hit it too. Each attack brings several Molotov throwers, more as rounds go on (1, 2, 3, then 4; at most 2 on a car or the bus shelter); a bottle on a place already burning takes 8 HP off it at once. Knock out the attack's rioters before any fire and the place is saved (+8 school, +4 car / bus shelter); a fire never goes out by itself, only a toolbox puts it out. At 0 HP the place becomes a ruin (−3 / −2) that stays across rounds; the session goes on.
- **Toolboxes**: walk over a toolbox to carry it (its icon floats above Paul), go next to a ruin or a burning place with no rioter close and press F (touch: Agir; a fresh press, holding F on the way does nothing): 2 s later, without holding the key, the ruin is repaired or the fire put out, restoring full health (+5 / +3). A fire never goes out by itself.
- **Retro video-game shop**: a « JEUX RÉTRO » storefront (pixel joystick sign, striped awning, lit windows) is a 100 HP building to protect like the school: it joins the random headline draw from round 2 (round 1 is always the school; from round 2 the headline casse is a seeded random pick among every free place); saved +6, ruined −2, put out or repaired with a toolbox +4.
- **Equestrian monument and capture the flag**: a bronze rider on a stone plinth holds a waving French flag; from round 4 (every other round, instead of the rescue, while the flag is French) rioters rush the statue and swap it for a Palestinian flag in a few seconds (−3; all knocked out first: +4); the flag stays until Paul holds the zone for 8 s with no rioter inside (+10, « zone contestée » otherwise), even during the breather.
- **School defense**: the round-1 school assault has a first line, then, once it is down, a short "Renforts en approche !" sequence (skippable with Space or F, or a tap) announces 8 reinforcements.
- **Rescue**: reach a threatened victim (« À L’AIDE ! » bubble) and knock out the attackers: the rescue then ends by itself (« MERCI ! », +6), no key to press.
- **Stolen belongings**: while the attackers work on the victim they snatch its belongings (bag, hat, cane, backpack, scarf, cap) one by one; knock a thief out, walk over what it dropped and bring it back to the victim (+2 each; once safe, the victim waits up to 12 s for them).
- **Alerts**: each new incident pops a pixel-style banner (« ÉCOLE EN FEU ! », « VOITURE EN FEU ! », « ABRIBUS SACCAGÉ ! », « AGRESSION EN COURS ! », « VOL EN COURS ! ») with an arrow and the distance, and an indicator at the screen edge points to every active incident that is off-screen.
- **Rocks**: throwers telegraph their throws; Paul picks up fallen rocks (3 max) and throws them back.
- **Circular strikes**: Paul's strike hits all around him (up to 3 rioters).
- **Weapons**: a stick, a hammer or a road sign appears at random in the streets; walk over it to pick it up. Weapons knock a rioter out in one hit, reach further and wear out after a number of hits (15 / 8 / 10).
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
