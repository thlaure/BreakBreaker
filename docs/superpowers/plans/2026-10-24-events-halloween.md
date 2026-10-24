# Seasonal events and Halloween theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A permanent `src/events/` registry and a Halloween layer (zombie rioters, map decorations) on from 24 Oct to 2 Nov, render only. Release 1.5.0.

**Architecture:** `src/events/schedule.ts` (pure: which event is active for a date and `?event=`), `src/events/index.ts` (active event, sheet theming, decor builder), `src/events/halloween/*` (pure zombie choice and pixel paint; Phaser sheets and decor). Hooks: `BootScene` (paint sheets), `charView.createCharAnims` (`zombie_` keys), `hostileView` (sheet), `world.ts` (decor).

**Tech Stack:** TypeScript strict, Phaser 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-events-halloween-design.md`

## Global Constraints

- Follow `AGENTS.md`; sim untouched; no text in the sim; no per-task browser check; zero cost when no event is active.
- Gates: `npm run typecheck`, `lint`, `format:check`, `npm test`, `npm run bench`. Commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push without the owner's « push ».

## Review Focus

- Date edges (23 Oct off, 24 Oct on, 2 Nov on, 3 Nov off), `?event=` overrides, bad values ignored.
- Caïd never a zombie; same lifeId always the same look; about half the others.
- Paint never touches outline or transparent body pixels except the hat; no sheet created outside the event.

### Task 1: Schedule (`src/events/schedule.ts`) with tests.
### Task 2: Zombie choice and paint (`zombieMath.ts`, `zombiePaint.ts`) with tests; sheets and hooks.
### Task 3: Halloween decor (`decor.ts`) wired in `world.ts`.
### Task 4: Review, docs (specs RC rows, history, README, ROADMAP, both changelogs), release 1.5.0, one browser check.
