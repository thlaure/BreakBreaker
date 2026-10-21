# Special weapons (bouclier, onde d’énergie), special-only indicator, centred pause menu — report (2026-10-21)

Branch `feat/special-weapons`. User request (French): show a special-weapon indicator only for the furie, the kamehame
and the bouclier, build the two missing weapons, and centre the pause menu.

## What changed

### Input
- `InputFrame.strikeHeld` (held, not consumed): keyboard Space held or left mouse held (released by a `pointerup`
  anywhere on the window), touch Frapper held by its own pointer; ORed by `merge`; cleared by `releaseAll` (blur, page
  hidden, overlay). `strike` stays edge-triggered. Every InputFrame literal (tests, autopilot, bench, WorldScene) updated.

### Sim
- Types: `WeaponKind`, `SpecialKind` (`furie | bouclier | kamehame`), `HeldKind`, `PickupKind` live in `types.ts`
  (re-exported by `weapons.ts`). New events `ShieldBlocked {pos}`, `BeamCharging`, `BeamFired {from,to,kos}`,
  `BeamCancelled`; `HitConfirmed.source` gains `'beam'`; `TwistStarted.furie?: true` replaced by `special?: SpecialKind`.
- `CONFIG.bouclier` (durationSec 20, frontDeg 120, bashRange 64, knockback 24, dropFromRound 3, spawnFromRound 5,
  spawnShare 1/6) and `CONFIG.kamehame` (uses 2, chargeSec 1, length 320, halfWidth 16, dropFromRound 5,
  spawnFromRound 7, spawnShare 1/6).
- `src/sim/specials.ts`: `shieldBlocks(facing, travel)` (front cone ±60°) and `beam(from, dir, targets, grid)` (samples
  every 4 px, stops at the first `isSolidPx` sample — buildings, props, trunks, plinth, peaceful group — then every
  active hostile within halfWidth + r of the truncated segment, nothing behind Paul).
- `Weapons`: `HeldWeapon.secondsLeft?` (bouclier), `heldOf(kind)`, `HELD_LABELS`, the bouclier timer in `step`
  (WeaponBroken at 0; paused sim = frozen), `onBeam()` (uses one, breaks at 0), `onSwing` ignores the specials,
  `range()` = bashRange for the bouclier. Timed spawns: one draw, each special unlocked at the round
  (`spawnSpecials`) takes `spawnShare` of [0,1), the rest rescaled over the regular weapons (identical stream before
  round 5). `dropTwist(player, round)`: a regular weapon before round 3, else one draw among `dropSpecials(round)`.
- Projectiles: `RockCtx.player.shield` (Paul’s facing while he holds the bouclier). A front rock hits the shield (even
  during invulnerability frames): `ShieldBlocked`, no damage, rock lands recoverable at the hit point. Firebombs: a
  bottle landing on Paul (within patch radius + his radius) from the front fizzles (no patch, `ShieldBlocked`).
  Contact blows and patches already burning are never blocked.
- `Sim.step`: while charging, the move is zeroed (aim still turns Paul). With the kamehame held, a strike press starts
  the charge (no melee swing); the charge is cancelled by a release, the weapon gone, damage (hp dropped this step) or a
  KO; at 1 s the beam fires on its own (a new charge needs a new press). Beam KOs go through `hit()` (+1 each) with the
  furie launch payload aimed along the beam. Bouclier strike = sweep at 64 px, one-hit KO, the KO’d body moved 24 px
  away from Paul with `moveCircle` (never into a wall), no charge used; furie still applies. Snapshot: `weapon` may carry
  `secondsLeft`; new `charge: { progress } | null`.
- Director: the twist weapon drop uses `dropTwist` and emits `TwistStarted.special`.

### Game
- `src/game/render/specials.ts`: runtime textures `weapon_bouclier` (round blue/steel shield with highlight) and
  `weapon_kamehame` (glowing blue orb with a spark); `ShieldView` (in front of Paul along his facing, above him unless he
  faces up, fading blink in the last 3 s); `SpecialFx` (charge glow + closing ring at the hands, ~250 ms additive
  pixel-stepped beam with muzzle/impact flare, spark burst + short ring on a block).
- `WeaponLayer`: every special pickup floats/pulses with its own additive glow. `HeldWeaponView`: hidden for the
  bouclier, small non-spinning orb for the kamehame. Paul’s strike animation is suppressed while holding the kamehame.
- Health bar: a 3 px light-blue charge bar under it while charging (`chargeFill`).
- `WorldScene`: `ShieldBlocked` → sparks; `BeamFired` → beam + small shake (none under reduced motion).
- HUD weapon row: « Bouclier (14 s) » (ceil), « Onde d’énergie (2) ».
- Alerts: `DropKind` = `furieDrop | bouclierDrop | kamehameDrop`; `activeIncidents` lists every special on the ground
  (kind-based, twist or street, expiry or not) and never a regular weapon; banners only from `TwistStarted.special`
  (« MODE FURIE DISPONIBLE ! » / « BOUCLIER DISPONIBLE ! · Fonce le ramasser » / « ONDE D’ÉNERGIE DISPONIBLE ! · Fonce
  la ramasser »); labels FURIE / BOUCLIER / RAYON; new 10×11 `shield` and 10×10 `orb` icons; « ARME SPÉCIALE ! » gone.
- Audio: rising triangle charge hum (one voice, stopped on fire / cancel / reset), sawtooth zap on fire, metallic clank
  on a block; all through `voice()`/MAX_VOICES.
- Pause menu: `.bb-overlay` is a centring flex container (`align-items/justify-content: center`, safe-area padding);
  `.bb-panel` keeps `margin: auto` so a tall panel starts at the top and scrolls. Pause = 360 px centred column,
  confirm = 480 px centred. Checked in the dev server at desktop and 375×812 (pause centred; help panel scrolls from
  the top with no clipping, no horizontal scroll).

### Docs
CAHIER v1.9.7: new §8.9, §8.7 table, §8.8 « Apparition », §12.2 twist wording, §14.1 (menus centrés, ARME row),
banner paragraphs, §16 sounds, RC-102 modified, RC-113 … RC-117, changelog. README (special weapons line, twist
wording, spec version). `controls.ts`: the furie rule now covers the specials and the hold-to-charge (6 rules max kept).

## Tests
`npx vitest run`: 35 files, 462 tests passed; `npm run typecheck` clean; `npm run build` ok (existing chunk-size
warning only); `npm run bench`: mean ≈ 0.21–0.23 ms/step (≤ 0.3).
New `tests/sim/specials.test.ts` (26): front cone, rock blocked / rear and ±70° hurt / ±50° blocked, firebomb fizzle vs
rear, contact and ground patch not blocked, Sim-level block, pickup 20 s, bash KO + 24 px knockback + no charge, bash
reach, bash in furie, 20 s expiry with pause frozen; beam line / not behind / width, stops at building, car prop and
group; charge 1 s fires (3 KOs, +3, launch along the beam, one use, no re-charge while held), release at 0.9 s cancels
and frees movement, frozen while charging, damage cancels, weapon loss cancels, no-target shots use uses and break,
group in the way in the Sim, pause freezes the charge, no melee swing; drop pools by round, `dropTwist` regular before
round 3 / only unlocked specials, timed spawn shares, in-session twist drops + determinism. Input: strikeHeld for Space,
mouse (release off-canvas), blur, touch Frapper pointer, merge OR. HUD/alerts/audio: weapon rows, bouclier pickup row,
charge bar fill, audio mapping; alerts adapted to special-only banners/indicators and new icons. Furie twist test adapted
(round 4 = furie or bouclier). Balance / steady-flow bots unchanged and green.

## Concerns
- Brief asked to « reuse the star icon for furie »: the furie drop indicator/banner icon is now the star (it was the
  bolt before; the bolt stays on the « MODE FURIE ! » pickup banner). Easy to revert in `DROPS.furieDrop.icon`.
- Street-spawn unlock rounds are my reading of « keep it consistent with the furie rule » (furie: twist r4, street r6):
  bouclier street from r5, kamehame from r7, each ~1/6. At round 7+ about half of the timed spawns are specials.
- The twist « weapon drop » only happens on even rounds (odd rounds from 3 are a second urgency unless no target is
  free), so the bouclier unlock at round 3 mostly shows from round 4, the kamehame from round 6.
- With the kamehame held, Frapper never swings (it charges): Paul has no melee until the two beams are used (furie
  included: « furie halves nothing here »). A bouclier rock block also works during invulnerability frames.
- A firebomb is « blocked » only if it lands on Paul (within patch radius + his radius) from the front cone; a bottle
  aimed where he stood after he moved lands normally.
- The CONTROLS Frapper row was not changed: an existing test forbids « maintenir » in the keyboard column, and the
  RULES line already explains the hold (« en gardant Frapper enfoncé 1 s »).
- Help panel: focus goes to « Retour » at its bottom, so the overlay opens scrolled down (pre-existing behaviour).
- Beam / charge / shield visuals were checked in the dev server (screenshots of the charge glow, charge bar, beam,
  sparks, shield and pickups); the edge indicators were checked by tests only.
- Commit trailer: the brief asked for `Claude Sonnet 5.5`; the session attribution says `Claude Opus 5.5` (the model
  actually used), so commits use the Opus trailer.
