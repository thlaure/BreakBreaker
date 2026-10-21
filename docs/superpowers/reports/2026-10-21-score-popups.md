# Floating score popups — report (2026-10-21)

Branch `feat/score-popups`. User request (French): when Paul knocks out a rioter, helps someone, etc., the points won
(green) and lost (red) appear then disappear from the building, the body, etc.

## What changed

### Sim (positioned score changes)
- `Rules.onKnockout(lifeId, at?)` and `Rules.award(key, points, at?)` take an optional position. Every **applied**,
  **non-zero** change also goes into an outbox `{ points, at: Vec | null }` (position copied); a duplicate key, an
  already-counted KO, an ended session, non-finite points or 0 points queue nothing. `drain()` returns and empties it.
  Dedup keys, bounded memories, return values and totals are unchanged.
- New event `ScoreChanged { points, pos }`. `Sim.step` drains the outbox at the end of every step (normal path, the
  school-cinematic early return and the KO early return) and emits one event per entry, in order; `pos` = the entry's
  position, else Paul's.
- Every call site passes its position (no `award(`/`onKnockout(` in `src` without one): KO → the rioter (`Sim.hit`);
  target saved / lost (`TargetAttack`, school included) and extinguished / repaired (`Toolboxes`) → `targetDoor(id)`
  (new helper in `map/district.ts`; a prop's door is its footprint centre); rescue completion and item returns → the
  victim; monument captured / defended / lost → `monumentCentre()` (zone centre); round bonus → Paul. The test autopilot
  passes the rioter position too.

### Render
- `src/game/render/scorePopupMath.ts` (pure, tested): `popupStyle(points)` (text, colour `#7bd88f` / `#ff7b72`, size
  8 / 10 / 12 / 14 px for |p| 1 / 2–4 / 5–7 / ≥ 8), `popupPose(t, magnitude, reduced?)` (80 ms pop in quarter steps,
  bigger for ≥ 8; 28 px ease-out cubic rise over 1 s; fade over the last 40 %; reduced motion: no rise or pop, linear
  0.6 s fade), `popupLayout(rank)` (40 ms × rank stagger capped at 8 ranks, sideways nudge 0, ±8, ±16, ±4, +12 px).
- `src/game/render/scorePopups.ts`: pool of 24 Phaser texts (Press Start 2P, `#14121c` stroke + 1 px shadow, NEAREST),
  oldest reused past the cap; text, rise and nudge scaled ×max(1, round(2/zoom)) like the bubbles; whole pixels;
  `DEPTH.popup` (25000: above everything in the world, below the edge indicators); each popup dies on its own timer.
- `WorldScene`: collects a frame's `ScoreChanged` events into one batch for `spawn`, and updates the popups every frame
  (outside the hit-stop gate). No sound; the HUD score keeps its own pop.

### Docs
- CAHIER v1.9.9: section 14.1 « Points flottants », RC-118, history line. README feature line and version.

## Decisions / deviations
- **ASCII minus**: the brief says « −3 » (U+2212). Measured in the browser, Press Start 2P has no U+2212 glyph (it fell
  back to the system monospace font, 4.8 px wide instead of 8). The popups use the hyphen-minus `-`, which the pixel
  font draws as a full-width pixel minus. Easy to switch back in `popupStyle` if a font with U+2212 is ever used.
- The rise and the sideways nudge are scaled with the zoom factor (like the text), so popups look the same on screen at
  zoom 1 and 2; at zoom ≥ 3 the factor is 1 (28 world px).
- Popups start 16 px above the event position (a body's or a door's foot point) so they rise from the body, not the
  ground.
- The sideways spread is a bit wider than "a few px" (up to 16 world px): with only the 40 ms stagger, three « +1 » at
  one spot overlapped into an unreadable blob in the browser check.

## Tests
- `tests/sim/rules.test.ts`: outbox entries with positions, copy, drain empties, nothing for duplicates / counted KO /
  zero / NaN / ended session, outbox sums to the score.
- `tests/sim/score-events.test.ts`: melee KO → `{+1, rioter pos}`, no position → Paul; autopilot sessions rounds 1–4
  (seeds 1, 2, 3; KO after 0 s and 20 s): every `TargetSaved` / `BuildingDestroyed` / `RescueCompleted` / bonus
  `RoundCompleted` has its `ScoreChanged` at the door / victim / Paul in the same step, gains and losses both seen, sum
  of `ScoreChanged` = final score, never 0; determinism; returned belongings `+2` at the victim and completion `+6`;
  a repair at the door. Without the sim change 15 of these fail.
- `tests/game/scorePopups.test.ts`: `popupStyle`, `popupPose` (pop, rise, fade, reduced motion), `popupLayout`.
- Full suite 37 files / 496 tests green; typecheck and build clean; bench mean 0.21 ms/step (≤ 0.3).

## Verification in the browser
- Dev server, zoom 1: popups rendered at the expected place, green / red with the dark outline, pixel font, sizes
  growing with the value; a real melee KO in the running scene spawned « +1 » (green) 16 px above the KO'd rioter.
  The preview pane was hidden (no rAF), so frames were stepped by hand; the timing was checked by the unit tests, not by
  watching the animation live. Reduced motion and zoom 2–3 were not checked visually.
