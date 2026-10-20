# BreakBreaker

A 2D top-down pixel-art arcade web game, rewritten from the old Three.js prototype (kept in the git history). The game's text is in French.

Specification: [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md) (v1.9, French). Slice 2 design: [`docs/superpowers/specs/2026-10-20-slice-2-fun-design.md`](docs/superpowers/specs/2026-10-20-slice-2-fun-design.md).

## Features

A full session in a single district, playable with keyboard/mouse or touch (first playable slice + slice 2 phase A):

- **Rounds**: the game is split into rounds (`Manche N`), from 1 until Paul is knocked out (or the player quits); no global timer. Each round is announced (« MANCHE N ! » banner with its headline, e.g. « Voiture en feu · 18 casseurs »), the HUD shows its objective (`Manche N : K/T casseurs`), a twist fires once half the roster is down (a second urgency or a special weapon drop, « ARME SPÉCIALE ! »), and the last group comes in faster. When the whole roster is knocked out, a 6 s breather (no rioter enters) shows a non-blocking « Manche N terminée » panel (KOs, objectives réussi / perdu, points, +5 bonus when every objective succeeded) while heal stations recharge.
- **Buildings with health**: the school, two parked cars and a bus shelter have a health bar (on the map and in the HUD card). A Molotov rioter winds up for 1.5 s (knock him out first and there is no fire), then the target burns; degraders hit it too. Knock out the attack's rioters and the fire goes out by itself (+8 school, +4 car / bus shelter). At 0 HP the place becomes a ruin (−3 / −2) that stays across rounds; the session goes on.
- **Toolboxes**: walk over a toolbox to carry it (`Caisse 1/1`), go next to a ruin or a burning place with no rioter close and press F (touch: Agir): 2 s later, without holding the key, the ruin is repaired or the fire put out, restoring full health (+5 / +3). A fire never goes out by itself.
- **School defense**: the round-1 school assault has a first line, then, once it is down, a short "Renforts en approche !" sequence (skippable with Space or F, or a tap) announces 8 reinforcements.
- **Rescue**: reach a threatened victim (« À L’AIDE ! » bubble) and knock out the attackers: the rescue then ends by itself (« MERCI ! », +6), no key to press.
- **Alerts**: each new incident pops a pixel-style banner (« ÉCOLE EN FEU ! », « VOITURE EN FEU ! », « ABRIBUS SACCAGÉ ! », « AGRESSION EN COURS ! », « VOL EN COURS ! ») with an arrow and the distance, and an indicator at the screen edge points to every active incident that is off-screen.
- **Rocks**: throwers telegraph their throws; Paul picks up fallen rocks (3 max) and throws them back.
- **Circular strikes**: Paul's strike hits all around him (up to 3 rioters).
- **Weapons**: a stick, a hammer or a road sign appears at random in the streets; walk over it to pick it up. Weapons knock a rioter out in one hit, reach further and wear out after a number of hits (15 / 8 / 10).
- **Healing**: walk over a "Soins" kit to recover 25 HP (one charge per kit).
- End-of-session summary (score, local best, round reached, perfect rounds, places saved / destroyed, repairs, stats) and Replay.

The landing page (title, "Jouer", "Commandes" modal) has an original pixel-art hero: a top-down street scene (burning school, Paul, rioters, flying rocks, a heal kit, a peaceful group) composed from the game's own tiles and LPC sprites by `npm run hero`, shown full-bleed with `image-rendering: pixelated`, with the Press Start 2P pixel font (SIL OFL 1.1) for the title and buttons. Its "Jouer" link (`/jouer/?go`) starts the game right away, with a "Comment jouer" card over the running game; a "Commandes" button in the game opens the keys and rules. Opening `/jouer/` directly shows the rules screen first.

Design choices:

- The hero is **Paul**, a fictional character; no character represents a real person.
- Every rioter knocked out scores **+1**; the HUD shows a neutral **"Casseurs neutralisés"** counter.
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
