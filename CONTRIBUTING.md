# Contributing to BreakBreaker

Thanks for wanting to help Paul defend the district!

## Ways to help

- **Report a bug**: open an issue with the *Bug report* template (browser, device, steps to reproduce).
- **Suggest an idea**: open an issue with the *Idea* template. Check the [roadmap](ROADMAP.md) first.
- **Send a pull request**: for anything bigger than a typo, open an issue first so we can agree on the approach.

## Ground rules

- The game is satirical fiction: no real person, no real-life likeness, no real logo. In-game text stays in French; code and docs are in English.
- Assets must be free to use, with their author and license added to [`public/CREDITS.md`](public/CREDITS.md) (via `npm run assets`).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests + production build check
npm run typecheck
npm run bench      # one simulation step must stay under ~0.3 ms
```

The simulation in `src/sim/` is deterministic and must stay free of Phaser and `Math.random`; rendering in `src/game/` only reads snapshots. Add or update tests with your change (`npm test` must pass). The full specification is in [`docs/`](docs/SPECS%20-%20Index.md).

## Pull requests

Keep them small and focused, describe what changes for the player, and make sure CI is green. Add a line to [`CHANGELOG.md`](CHANGELOG.md) when the change is visible in the game.

By contributing you agree that your code is released under the [MIT license](LICENSE).
