# AGENTS.md

Rules for AI agents (and humans) working on BreakBreaker. Written in English; the in-game text is French and American English. Keep this file current: when the owner sets a new rule, add it here in the same branch.

## The project

A free 2D top-down pixel-art arcade web game (Phaser 4 + TypeScript + Vite). The hero is Paul (fictional). Live at https://thlaure.github.io/BreakBreaker/ (CI/CD on GitHub Pages). Landing page at `/`, game at `/play/` (`/play/?go` starts at once). Full specification: `docs/SPECS - Index.md`. Player-facing history: `CHANGELOG.md` (French) and `CHANGELOG.en.md` (American English, same versions and points; update both). Plans: `ROADMAP.md`.

## Commands

```bash
npm run dev            # Vite dev server
npm run typecheck      # tsc --noEmit (TypeScript 7)
npm run lint           # ESLint (max-lines: warn above 400 code lines per file)
npm run format:check   # Prettier (npm run format to fix)
npm test               # Vitest, includes a production build check
npm run bench          # mean must stay <= 0.3 ms per simulation step
```

All of typecheck, lint, format:check, test and bench must pass before a branch is offered for merge. `typescript` is aliased to `@typescript/typescript6` for typescript-eslint; `tsc` comes from `@typescript/native` (revisit when typescript-eslint supports TS >= 7.1).

## Architecture rules

- `src/sim/` is a deterministic 60 Hz fixed-step simulation: no Phaser, no `Math.random`; one separate rng stream per feature; the order of calls inside `step()` is part of the behaviour (tests compare exact event sequences).
- `src/game/` renders only from `Snapshot` and events; render-only features (decor, the President, bubbles) never touch the sim or its rng.
- Keep files under 400 code lines; split by responsibility, keep public exports importable from the original path.
- Pure logic lives in `*Math.ts` helpers with unit tests; Phaser views are verified in a real browser.
- Seasonal themes live in `src/events/<event>/` (permanent, render only, dated windows in `src/events/schedule.ts`, `?event=<id>` / `?event=none` to force): never touch `src/sim` or the base map for a theme, and build nothing when no event is active.
- Design for performance: the simulation stays under 0.3 ms per step, the render path allocates little per frame (no per-frame object churn, cull what is off screen, cache what does not change), idle states cost nothing, and download weight stays low (compressed assets, cacheable chunks). Measure before and after (`npm run bench`, `npm run build` sizes), never guess.

## Language rules

- Technical content is English: code, identifiers, comments, file names, routes, specs, README, docs, commit messages.
- Game content is French: in-game text, the changelog, the roadmap (player-facing), design records under `docs/superpowers/specs/`.
- The game is bilingual: French (default) and American English. All user-visible text goes through `t()` (`src/content/i18n/`), with the same keys in both the `fr/` and `en/` catalogs (tests enforce parity). Never hard-code a phrase in the code.
- `src/sim` never contains phrases: it emits and stores identifiers, and the render and HUD layers translate them.
- Jokes are adapted for each language, not translated word for word, and follow the content rules below in both languages.
- New texts are added in both languages in the same change.

## Workflow

- One branch per feature or fix; test first for logic (TDD); small commits with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Never merge or push without the owner's explicit « push ».** After a push, watch CI until the deploy succeeds.
- Bigger work: brainstorm with the owner, write a design record and a plan (`docs/superpowers/specs/`, `docs/superpowers/plans/`), then build task by task with isolated subagents and review the diff before merging.
- Do not run Workflow-style multi-agent orchestration unless the owner asked for it.
- **Browser checks: once, at the end.** Per task, run only unit tests, typecheck, lint and format. Do not launch the game in a browser for each feature; do one global browser check (all languages, mobile, the new features together) after everything is implemented. Subagent briefs must say so.
- **End-of-development review (every feature or fix, before offering the branch):** check the tests (do they fail without the change? are they robust, deterministic, not tied to timing or machine load, covering edge cases?), code quality and good practices (naming, size, duplication, error handling, accessibility, i18n parity), performance (new per-frame or per-step cost, allocations, asset weight), and dead code (unused exports, files, keys, dependencies, stale comments and docs): remove it. Report what the review found and fixed.
- Dependencies are upgraded by hand, never unprompted. Dependabot version-update PRs are off; check for new versions only when asked.

## Docs go with every change

In the same branch as the code, update as needed: `docs/SPECS - *.md` (rule text, new RC rows, version-history entry), `README.md`, `ROADMAP.md`, `CHANGELOG.md`, and the version.

## Versioning

MAJOR.MEDIUM.MINOR: major = a big update that changes the game a lot (records reset), medium = new content, minor = fixes and polish. A release bumps `package.json`, `package-lock.json`, `CONFIG.appVersion`, `CHANGELOG.md`, `CHANGELOG.en.md` and the specs version line. `CONFIG.rulesVersion` keys the browser records: change it only for a deliberate records reset. CI tags and publishes the GitHub release (`vX.Y.Z`, notes from both changelogs) when `package.json` has a version without a release, so never create tags by hand.

## Content rules (satire and safety)

The game is satirical fiction. Binding decisions:

- Everything is invented: Paul, every character, every faction; no real person or real party is named or depicted.
- Satire of the powerful is fine, on every side, but recognisable only through props, attitudes and public quotes: never through physique, skin colour, weight, ethnicity or religion; no religious symbols or clothing on boss or enemy characters; no hate symbols; no harem or sexualised or degrading depiction of real people.
- The President (castle balcony) is a generic fictional figure with a dictionary of short public phrases and no attribution.
- No stand-in for a specific real person is made to be beaten or jailed (no Caïd or prisoner modelled on a real individual), even if the description avoids the name.
- Flags worn by the crowd are cosmetic, and every KO scores +1 for everyone; the counter is neutral (« Casseurs neutralisés »).
- Rescue victims are never undressed.
- Mixed appearances among characters are wanted; appearance is never the joke.

## UI and assets

Pixel art, original or free assets only, every asset credited in `public/CREDITS.md` (generated by `npm run assets`). Respect `prefers-reduced-motion`, and keep the HUD readable on phones (compact scale below 560 px wide or 520 px tall).
