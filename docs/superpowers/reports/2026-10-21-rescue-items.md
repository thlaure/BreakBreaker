# Rescue upgrade — stolen belongings to bring back (« objets volés à rendre ») — report (2026-10-21)

Branch `feat/rescue-stolen-items` (cut from `main`), not pushed.

User request (product owner): people attacked in a rescue are progressively robbed while the aggressors work on them;
once the aggressors are KO'd, Paul picks up what was taken and gives it back to the victim. Content rule applied
throughout: **ordinary belongings only** (bag, hat, cane, glasses, scarf, cap, backpack); never clothing, undressing,
nudity or anything degrading, in sprites, text, bubbles, docs or tests.

| Commit | Scope |
| --- | --- |
| `a76b468` | sim: belongings, thefts, drops, pickup/return, return wait, snapshot + events, tests |
| `edd57ee` | render / HUD / audio: item icons and layer, victim shouts, card progress and slot, edge indicator, sounds; tests |
| (docs commit) | CAHIER_DES_CHARGES v1.9.5 (§12.10, §12.12, RC-111/RC-112, changelog), README, this report |

Final checks: `npx vitest run` 418/418 (399 before), `npm run typecheck` clean, `npm run build` ok, `npm run bench`
per-step mean ≈ 0.21–0.23 ms (budget 0.3 ms).

## Sim (`src/sim`)

- `config.ts` → `CONFIG.rescue` tunables: `itemCount: 3`, `theftAt: [0.75, 0.5, 0.25]` (share of the reserve left),
  `itemBonus: 2`, `pickupRadius: 20`, `returnRadius: 48`, `returnSec: 12` (with the existing `threatSeconds: 25`,
  `thanksSec: 1.5`, `bonus: 6`).
- `incidents/rescue.ts`: `RESCUE_ITEMS` (by kind: `handbag` « sac à main », `hat` « chapeau », `cane` « canne »;
  `backpack` « sac à dos », `scarf` « écharpe », `cap` « casquette »), `RescueIncident.items`
  (`held → carried-by-thief → dropped → carried → returned`, or `lost`), `returnLeft`, `carried`, `outstanding()`.
  - Theft: each threshold passed steals the next held item by the nearest active (non-KO) aggressor of the rescue,
    measured from the victim. No aggressor standing → that threshold is spent, nothing stolen. The reserve only drains
    while one threatens, so no theft once all are KO.
  - A thief KO'd (or its body pruned from the horde) drops the item at its position, moved to the nearest point where
    a Paul-sized circle is free (rings of 8 px up to 96 px, fixed angle order; the victim's spot as a last resort).
  - Pickup (any stage while live): Paul within 20 px of a dropped item, up to 3. Return: Paul within 48 px of the
    victim → every carried item is handed back in the same step: `award(`${rescueId}:item:${itemId}`, 2)` each and
    `ItemReturned`.
  - Secured: `returnLeft = returnSec` when something is still out (thief, ground or Paul), else `null` and the usual
    1.5 s beat. While waiting: all back → the beat starts in that step; timeout → the rest is `lost`, then the beat.
    Completion (+6 once, unchanged) and failure both mark whatever is still out as `lost`.
- `types.ts`: events `ItemStolen { rescueId, item, thiefLifeId }`, `ItemDropped { rescueId, item, pos }`,
  `ItemPickedUp { rescueId, item }`, `ItemReturned { rescueId, item }` (`item` = the item id).
- `sim.ts`: snapshot `rescue.items: { id, name, state, pos }[]` (pos = victim, thief, ground or Paul),
  `rescue.returnLeft`, top-level `carriedItems`.
- Director: unchanged. A secured rescue waiting for its items is still `secured`, so `windingDown()` treats it as the
  timed wind-down it is (flow keeper quiet), `settled()` waits for `completed`, no new rioters → K === T unchanged.

## Render / HUD / audio (`src/game`)

- `render/items.ts` (new): `item_<id>` 12×12 textures drawn at runtime (bag, hat, cane, glasses, scarf, cap, backpack;
  glasses is drawn but not used by any victim yet), shown ×2. `ItemLayer`: icon bobbing above the thief's head; on the
  ground a float + pulse + soft additive glow; above Paul (left of the head, clear of a carried toolbox) with « ×N »
  when more than one. Keyed by `rescueId:itemId`.
- `render/belongings.ts` (new, no Phaser): `ITEM_SHOUTS` and `VictimMood`, which derives the bubble from snapshot
  changes: « MON SAC ! » / « MON CHAPEAU ! » / « MA CANNE ! » / « MON SAC À DOS ! » / « MON ÉCHARPE ! » /
  « MA CASQUETTE ! » for 2 s after a theft, « MERCI ! » for 2 s after a hand-back, « À L’AIDE ! » otherwise while
  threatened; secured and waiting → the shout of the first item still out; otherwise « MERCI ! » as before. Resets on
  a new rescue id.
- `render/crowd.ts`: `Bubble` accepts `shout:<id>` kinds (red, like the call for help); `VictimView` uses `VictimMood`.
  The view is still keyed on the rescue id (the invisible-victim fix is kept).
- HUD: rescue card gets an `items` span « Objets 1/3 rendus » (returned / stolen so far) after the first theft; during
  the wait the time reads « Rends les objets · 8 s »; slot « Objets 2 » beside « Caisse » while carrying (hidden at 0).
  `activeIncidents` keeps the rescue while threatened or while secured with an item on the ground or carried, so the
  edge indicator points to the victim and an announced banner is not pruned too early. No new banner.
- Audio: `ItemPickedUp` → `pickup`; `ItemReturned` → the chime, once per batch (shared with saves and round wins).

## How to trigger it from the console (dev build)

```js
const sim = __game.scene.getScene('world').sim;
const { RescueIncident } = await import('/src/sim/incidents/rescue.ts');
const r = new RescueIncident('rescue#test');
const p = sim.player.pos;
r.start(sim.horde, { x: p.x + 120, y: p.y }, sim.rand, { x: p.x + 400, y: p.y }, sim.grid, { count: 4 });
sim.rescue = r;
for (const h of sim.horde.list) if (h.incidentId === r.id) h.state = 'threaten';
r.remaining = 13; // two thresholds passed on the next step: two items stolen at once
```

Then KO the thieves, walk over the dropped icons and back to the victim. (Replacing `sim.rescue` by hand bypasses the
director: fine for a look, not for round flow.)

## Tests

- `tests/sim/rescue-items.test.ts` (new): items by kind; thefts exactly at 75/50/25 % by the nearest aggressor, item
  follows its thief; KO before a threshold → never stolen, usual 1.5 s completion; no theft after securing; thief KO
  in a wall → item on a free point; pickup radius (21 px no, 19 px yes), carry 3; return radius (50 px no, 47 px yes),
  +2 each once, then +6 once after 1.5 s; wait of 12 s then items lost and +6 once; failure loses thief-held and
  carried items; unique bonus keys over two rescues; full sim: round 1 closes with K === T with every stolen item
  returned, deterministic per seed (events and snapshot); items left on the ground → wait seen, rescue completes, round
  closes; snapshot shape, plain data, pause freezes.
- `tests/game/rescue-items-hud.test.ts` (new): card progress and wait text, « Objets N » slot, edge-indicator rule,
  belonging events raise no banner and the rescue banner is pruned only once the rescue is over, shouts for every
  belonging, `VictimMood` sequence (help → shout 2 s → help → thanks), secured wait, new rescue id starts afresh.
- Existing fixtures (`alerts.test.ts`, `hud.test.ts`) gained `items: [], returnLeft: null`. Rounds, steady-flow,
  balance and bot tests unchanged and green; nothing re-tuned.

## Notes / concerns

- **Thefts are rare when few rioters are on the map.** With at most `CONFIG.hostile.fewLeft` (3) hostiles active,
  aggressors at their post for more than `postSec` (6 s) leave the victim for Paul, so the reserve stops draining at
  about 19 s left — just above the first threshold (18.75 s). A small rescue alone on the map (round 1 often, or 2–3
  aggressors) therefore usually steals nothing; with 4 aggressors, or fill rioters around, the thefts happen as
  designed. The full-sim test adds two patrols for that reason. If the owner wants thefts in every rescue, options:
  thresholds earlier (e.g. 0.85/0.6/0.35) or exempt rescue aggressors from the `postSec` pull while Paul is far away —
  not done here (it is a design call).
- One thief can carry several items (nearest aggressor each time); its KO drops them all on the same spot, and one
  walk over picks them all up.
- « Objets n/m rendus » counts against items stolen so far, not the 3 the victim carries (so « 2/2 » reads complete).
- The thief's icon follows the thief's snapshot position; the « carried » item's `pos` is Paul's.
- Commit trailer: the commits carry `Co-Authored-By: Claude Opus 5.5` (the model that did the work), not the
  « Sonnet 5.5 » written in the brief.
