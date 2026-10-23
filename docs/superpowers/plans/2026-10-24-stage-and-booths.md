# Stage of skeletons and booths on the square Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the emergency phone booths to the main square, replace the unused north-east building by a decorative stage with a skeleton rock band (singer lines in two languages), and play an original synthesized riff whose volume follows the distance to the stage. Release 1.4.0.

**Architecture:** Map changes in `src/sim/map/district.ts` (new decor id `'stage'`, booths moved). The stage, the skeletons, their bubbles are render-only (`src/game/render/stage*.ts`); the riff is a new audio module (`src/game/audioStage.ts` + pure `stageMusicMath.ts`) driven by the distance from Paul to the stage; texts in the `world` i18n catalogs.

**Tech Stack:** TypeScript strict, Phaser 4, WebAudio (synth only), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-stage-and-booths-design.md`

## Global Constraints

- Follow `AGENTS.md` (rules, i18n, content rules, no per-task browser check, docs with the change).
- Sim stays language-free and deterministic; the stage is a solid decor building like the CAF.
- No copyrighted music or lyrics; original synthesized riff; the band is invented (no real musician).
- All texts through `t()` with identical keys in `fr/` and `en/` catalogs.
- Gates per task: `npx tsc --noEmit`, `npm run lint` (0 issues, files < 400 code lines), `npm run format:check`, `npx vitest run`, `npm run bench` ≤ 0.3 ms/step. Commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push.

## Review Focus

- Booths unreachable or inside a building / too close to a spawn after the move: the map test must fail on it.
- Emergency calls still work from the new booth positions (call range, refusals, attack points).
- Music audible while muted, paused or after the game ends; music starting before any user gesture.
- Volume curve outside [0,1] or jumping at the thresholds.
- Stage bubbles overflowing the screen (use the existing bubble clamp); reduced motion.

---

### Task 1: Map: booths on the square, stage footprint

**Files:** `src/sim/map/district.ts`, `src/sim/types.ts` or wherever `DecorId` lives, tests (`tests/sim/map.test.ts`, `decor.test.ts`, `services.test.ts` and any test hard-coding the old booth positions).

**Interfaces:** Produces `DecorId` gains `'stage'`; `DISTRICT.decor` entry `{ id: 'stage', footprint: R(36,3,8,5), door: C(40,8) }` (south front); building slot 3 stays the stage footprint; booths `boothRed`/`boothBlue` at free tiles on the square's edge (see spec §3).

- [ ] Write failing tests: stage decor present and not a target; booths on the square (within ~8 tiles of the church door C(27,30)), free tiles, reachable from every hostile spawn, ≥ 64 px from spawns/heals/toolboxes, door/attack points free; a fire-truck and police call from Paul standing next to the new booths are accepted (reuse the services tests).
- [ ] Implement; update the existing tests deliberately and list them.
- [ ] Gates; commit `feat(map): booths on the main square, stage footprint`.

### Task 2: Stage, skeleton band and lyrics (render + catalogs)

**Files:** create `src/game/render/stageFront.ts`, `skeletonBand.ts`, `stageMath.ts`; modify `world.ts` (register the decor like the château), `src/content/i18n/{fr,en}/world.ts` (+ `content.ts` for the lyric lines), tests `tests/game/stageMath.test.ts`, `tests/content/i18nContent.test.ts` (extend).

- [ ] Failing tests: lyric lists have 6 lines per language, ≤ 30 chars, no forbidden names/religious words, English differs from French; `stageMath` helpers (timing of the next lyric, sway offset 0 under reduced motion).
- [ ] Implement per spec §3: stage with lit front, amps, drum kit; five skeletons in generic rock outfits (singer, two guitarists, bassist, drummer); bubbles through the shared `SpeechBubble` with the clamp; lines from the catalog (rebuilt on locale change); sway and lights off under reduced motion; culled off-screen.
- [ ] Gates; commit `feat(render): the skeleton band on the stage`.

### Task 3: Original riff, distance-driven volume

**Files:** create `src/game/audioStage.ts`, `src/game/stageMusicMath.ts`; modify `src/game/audio.ts` (hook), `WorldScene.ts` (feed distance each frame), tests `tests/game/stageMusicMath.test.ts`.

**Interfaces:** `stageVolume(distPx: number): number` (0 beyond 12 tiles = 384 px, 1 within 4 tiles = 128 px, smooth monotonic between, never outside [0,1]); `riffSteps(): readonly RiffStep[]` (data of the loop: 16 steps, original notes/drums); `GameAudio.setStageProximity(dist: number | null): void` (null = silent).

- [ ] Failing tests for the curve (monotonic, clamped, 0 and 1 at the thresholds) and the riff data (16 steps, notes in range, loop length).
- [ ] Implement the synth loop (saturated guitar tone with a waveshaper, bass, kick/snare/hat noise) scheduled with the WebAudio clock; respects mute, pause, game over, user-gesture unlock; low maximum gain so sound effects stay audible; stops completely at volume 0 (no idle CPU).
- [ ] Gates; commit `feat(audio): original stage riff that follows the distance`.

### Task 4: Docs and release 1.4.0

Specs (English: map, places/decor, audio, rounds untouched; new RC rows after the current highest; version-history 1.4.0), README (stage mention if relevant), ROADMAP (« Fait »), CHANGELOG 1.4.0 (French), `AGENTS.md` unchanged, version bump (`package.json`, lock, `CONFIG.appVersion`). One global browser check at the end (stage, band, bubbles, music distance, booths calls, both languages, mobile).
