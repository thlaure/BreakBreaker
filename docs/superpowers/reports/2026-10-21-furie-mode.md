# Mode furie — report (2026-10-21)

Branch `feat/furie-mode` (cut from `fix/phase-a-playtest`), four commits on top of `d173cc1` (not pushed):

| Commit | Scope |
| --- | --- |
| `e23a9e1` | sim: `furie` pickup, timer, effects, launch payload, round gating, snapshot + events |
| `bef0dcb` | render: aura, launched KO bodies, POW / BOUM bubbles, pickup orb, furie camera shake |
| `77bb687` | HUD / audio: weapon line, alerts and edge indicator, help rule, power-up / hum / power-down |
| docs commit | CAHIER_DES_CHARGES v1.9.3 (section 8.8, RC-99 to RC-102, changelog), README, this report |

Final checks: `npx vitest run` 335/335 (306 before), `npm run typecheck` clean, `npm run build` ok,
`npm run bench` per-step mean ≈ 0.20 ms (budget 0.3 ms; 0.203 before the change).

## What changed

### Sim (`src/sim`)

- `weapons.ts`: `PickupKind = WeaponKind | 'furie'`; a ground pickup of kind `furie` does not touch `held`: it sets
  `furieLeft = CONFIG.furie.durationSec` (12 s; a second pickup resets to 12) and emits `FurieStarted { secondsLeft }`.
  The timer is decremented in `Weapons.step` (so it stops with the sim: pause, school cinematic, end of session);
  at 0 it emits `FurieEnded`. `endFurie()` ends it at once (Paul KO). `range()` is ×`reachMul` while on.
  Timed spawns take `round`: from round 6 a draw `r < spawnShare` (1/6) is a furie, else the weapon is picked from the
  rescaled draw (same number of draws, so the weapon stream is unchanged before round 6).
  `dropSpecial(pos, kind?)` drops a given kind.
- `director.ts`: the twist weapon drop (even rounds, and the fallback when a second urgency does not fit) is a furie
  from round `dropFromRound` (4); `TwistStarted` then carries `furie: true`. The breather drop (`finish`) is unchanged.
- `player.ts`: `stepPlayer(..., speedMul)`, `sweep(..., range, maxTargets)`.
- `sim.ts`: while on, ×1.35 move, strike damage `CONFIG.furie.damage` (99) at up to 8 targets, `onSwing` skipped (no
  weapon use), `PlayerDamaged.amount` ×0.5 (the emitted event carries the halved amount). On Paul KO, `FurieEnded`
  before `PlayerKnockedOut`. KOs from Paul's strike in furie carry `launch: { dir, power, spin }` from a separate
  seeded stream (`seed ^ 0x85ebca6b`, 4 draws per KO): away from Paul ± 0.35 rad, 220–420 px, ±2–5 turns. Rock KOs
  have no launch. Scoring is unchanged (one `onKnockout` per KO).
- Snapshot: `furie: { secondsLeft } | null`; `weaponsOnGround[].kind` is a `PickupKind`.

### Render (`src/game/render`)

- `furie.ts`: runtime textures `furie_aura` (three nested spiky flames), `weapon_furie` (orb + lightning bolt),
  `pow_burst`. `FurieAura`: two additive aura images pulsing out of phase behind Paul, one spark emitter (started /
  stopped, never re-created), a timer ring arc at the feet (one Graphics, cleared each frame), fade + faster blink in
  the last 2 s (`auraAlpha`). `PowBubbles`: pool of 8 containers (burst + 8 px pixel text), oldest reused.
- `furieMath.ts` (pure, tested): `launchPose` (ease-out cubic travel, sin arc 26 px, eased spin, squash wobble),
  `landingDistance` (farthest free sample of the path inside the world with a 12 px margin), `auraAlpha`.
- `actors.ts`: `PaulView.update(..., furie)` warm multiply tint + gold outline. `HostileLayer.launch` stores a flight
  on the body's view; while airborne the sprite spins around its middle at depth `foliage + 2` (above roofs and trees),
  with a shared trail emitter; it then lies at the landing point (depth by its y, alpha 0.6, like other bodies).
  The landing check uses its own `Grid(DISTRICT)` (static map data, no sim state).
- `weapons.ts`: the furie pickup floats higher, pulses in size and has a larger additive golden glow; it blinks before
  expiry like other special drops.
- `WorldScene`: on `ActorKnockedOut` with `launch` → `hostiles.launch`; on a melee `HitConfirmed` while the snapshot is
  in furie → POW bubble at the target and one tiny shake per frame (90 ms, 1.5 px), skipped under
  `prefers-reduced-motion: reduce`.

### HUD / audio / content

- `weaponLine`: « Arme : Bâton (12) · Mode furie 9 s » (seconds rounded up; gold via `.stat.furie`).
- Alerts: kinds `furieDrop` (banner « MODE FURIE DISPONIBLE ! » / « Fonce le ramasser », indicator « FURIE », tone
  `furie`, new pixel icon `bolt`) and `furie` (pickup: « MODE FURIE ! » / « Frappe, ils volent ! », no arrow, 2.2 s
  `FURIE_ALERT_MS`). `activeIncidents` lists a furie drop as `furieDrop`; a timed furie spawn (no expiry) has no
  indicator, like ordinary weapons.
- Audio: `powerUp` (square sweep 196 → 1046 Hz), a hum (sawtooth 55 Hz, low-pass, 5 Hz tremolo; one voice of
  `MAX_VOICES`, on the sfx bus so the master mute applies, paused with the context), `powerDown` (660 → 140 Hz).
  `reset()` (Rejouer) stops the hum.
- `RULES`: « Un éclair jaune rare apparaît quand ça chauffe : passe dessus pour déclencher le mode furie. »

## Tunables (`CONFIG.furie`)

`durationSec` 12, `speedMul` 1.35, `reachMul` 1.5, `maxTargets` 8, `damage` 99, `damageTakenMul` 0.5,
`dropFromRound` 4, `spawnFromRound` 6, `spawnShare` 1/6, `launchPower` [220, 420], `launchSpin` [2, 5],
`launchJitter` 0.35 rad. Render-only: `LAUNCH_MS` 700, `LAUNCH_ARC_PX` 26, `LAUNCH_EDGE_PX` 12, `FURIE_FADE_SEC` 2
(`furieMath.ts`), `FURIE_SHAKE_MS` / `FURIE_SHAKE_PX` (WorldScene), `FURIE_ALERT_MS` (alerts).

## Tests

- `tests/sim/furie.test.ts` (new, 16): pickup activates and keeps the weapon; 12 s timer, reset on a second pickup;
  pause freezes; KO ends it (`FurieEnded` before `PlayerKnockedOut`); a new Sim (Rejouer) has none; speed ×1.35 walk
  and run; reach ×1.5 bare and armed; 8 one-hit KOs bare-handed, damage 99, KOs = score; no weapon use; damage
  halved; launch in range and away from Paul; same seed → same launches, other seed differs, none outside furie, same
  KO count and score; launch stream does not shift `sim.rand`; timed spawns: none before round 6, ≈1/6 from round 6;
  `dropSpecial` kind; autopilot run to round 6: twist drop a weapon in round 2, a furie in rounds 4 and 6, round-end
  drops never a furie.
- `tests/game/furieMath.test.ts` (new, 5): pose start/end/spin, never off the map, lands past walls on the farthest
  free point, real-map launches land on walkable spots, aura fade/blink.
- `tests/game/alerts.test.ts` (+5): specs, event mapping, `activeIncidents`, HUD indicator « FURIE » + short banner,
  gold weapon line. `tests/game/hud.test.ts` (+3, 1 changed): weapon line, sim → snapshot → line, audio cues and hum
  stop on reset; the content test now allows 4–6 rules (was 4–5) because of the new rule line.
- Steady-flow and balance bot tests unchanged and green; no re-tuning was needed (the autopilot KOs through
  `applyHit`, so a furie on the ground does not change its runs).

## Trigger it from the console (dev build)

```js
const sim = __game.scene.getScene('world').sim;
sim.weapons.ground.push({ id: 9999, kind: 'furie', pos: { ...sim.player.pos }, expiresAt: null }); // picked up next step
// or set it directly: sim.weapons.furieLeft = 12;
// a crowd to send flying:
const p = sim.player.pos;
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sim.horde.spawn({ variant: 'classic', role: 'contact', pos: { x: p.x + Math.cos(a) * 50, y: p.y + Math.sin(a) * 50 } }); }
```

Then strike (Espace). A twist furie drop: play to round 4, or `sim.weapons.dropSpecial(sim.player.pos, 'furie')`
(no banner that way: the banner comes with the director's `TwistStarted`).

## Concerns

- Balance: 8 one-hit KOs per swing for 12 s at ×1.5 reach clears a whole fill group quickly; with half damage the
  round 4+ twist becomes a strong breather. Easy to tune via `CONFIG.furie` (e.g. `maxTargets` 5–6, `durationSec` 8–10).
- The twist is also the fallback when a second urgency does not fit on odd rounds, so rounds 5, 7… can also drop a
  furie (brief: « from round 4 the twist weapon drop is always a furie »).
- Launched bodies are cosmetic: the sim keeps the body where it was hit. A flying body lands on the farthest free point
  of its path, which can be on the other side of a building or a car.
- `ActorKnockedOut` from rocks is never launched (brief: only Paul's strike).
- Version: the brief asked for v1.9.3; the document was at v1.9.1 (no 1.9.2 exists on any local branch), so 1.9.2 is
  skipped.
- Commits carry the `Co-Authored-By: Claude Opus 5.5` trailer from the session's attribution instruction rather than
  the « Sonnet 5.5 » line of the brief (the session runs on Opus 5.5).

## Not verified visually

Checked in the dev build only through a hidden browser pane, driving `__game.loop.step` by hand: the pickup orb, the
aura behind Paul (with gold outline and ring) and launched bodies spreading 240–400 px around Paul with spin and depth
above roofs were seen in a couple of frames and confirmed by reading sprite state. Not checked by eye at full frame
rate: the sparks' look, the spin readability, the POW bubble size at zoom 1–3, the shake strength, the hum and the
sweeps (audio not heard), the phone layout of the new banners, and `prefers-reduced-motion`.
