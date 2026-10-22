# Cahier des charges audit (v1.9.10 → v1.9.11)

Branch `docs/cahier-sync`. Request from the product owner: « mets bien à jour le cahier des charges ». The spec
(`docs/SPECS - Index.md`) was read in full and checked against the code (`src/sim`, `src/game`, `src/content`),
the per-feature reports and the slice-2 design (`docs/superpowers/specs/2026-10-20-slice-2-fun-design.md`). The code
won wherever it disagreed; no code was changed. `npx vitest run` (496 tests, none reads the spec) and `npm run build`
pass.

## Corrections (section → what)

- **Header, Sommaire**: version 1.9.11; table of contents gains 10.9, 12.2, 12.10, 12.14, 12.15 (anchors match the
  renamed headings).
- **1.1, 1.5, 15.1, 25.1, 24**: Paul's rectangular black glasses added wherever his look is described (only 6.1 had them).
- **1.1, 2.2 (EX-07, EX-12, EX-14), 2.3**: firearms, field heals, students/formations marked as not delivered.
- **4.2, 26.4**: the « Comment jouer » card is blocking (v1.9.4, RC-70/RC-87); 26.4 still described the old
  non-blocking card with « Compris » and a 25 s auto-close.
- **5.4**: the shop states (« bloquée, dégagée, ouverte ») replaced by the real target states.
- **7 (controls)**: one strike per press (0.45 s); new rows for the onde d’énergie charge (hold Frapper 1 s), toolbox /
  stolen-item pickup, the school cinematic skip (F, Espace, clic, toucher); run on touch = joystick pushed fully; the
  furie does not replace the held weapon; remapping and the other options flagged as not delivered.
- **8.1, 12.3**: reinforced rioters (4 HP) marked to do (every rioter has 2 HP today).
- **8.7**: twist and breather drops lie outside the 2-weapon ground cap and vanish after 15 s; the HUD row is
  « ARME » « Bâton (12) » / « Mains nues » (not « Arme : … »); « Panneau » is the in-game name; gant and flashball rows
  marked to do and aligned with 12.14 (160 px spring punch); « Kamehame » row renamed onde d’énergie.
- **8.8, 8.9**: HUD wording → « ARME » row (furie value in yellow).
- **9.3, 12.2, 19.2, RC-85**: the entry gate is « fewer than 12 hostiles active » (`round.gate`), not « 12 waiting »;
  rescue aggressors spawn around the victim, outside the queue.
- **9.5**: one peaceful group of six delivered (three proposed).
- **10.2**: real lineups (buildings: +min(6, 2 + ⌊P/3⌋) alternating degraders/contacts; car and bus stop:
  +min(3, ⌊P/4⌋) contacts); kiosque, maternelle, mairie, bibliothèque marked to do.
- **10.3, 10.5, 10.6, 10.7, 13.1**: scores per target from `CONFIG.casse.scores` (school +8/−3/+5, shop +6/−2/+4,
  car and bus stop +4/−2/+3) instead of « bâtiment / mobilier ».
- **10.6**: putting a fire out **restores full health** (code: `Targets.extinguish` sets `hp = maxHp`); the spec said it
  restored none, contradicting 10.7. Toolbox sites: four, ≥ 64 px from Paul.
- **10.8**: students and formations are not implemented (no student entity in the sim) → marked to do; only the
  school's French flag is delivered.
- **12.2**: breather countdown is « dans 6… » (6 s), the breather weapon is a regular one 160–480 px away (15 s) and
  patrols leave; twist at ⌈T/2⌉ KOs; « formations » removed from what the player keeps; « défenseurs » → monument
  occupiers; the stale « commerce pillé dès la manche 2 » sentence replaced; the progression table rewritten as
  **Livré / À faire** per round; catalogue rows tagged livré / à faire; the « two places attacked at once from round 5 »
  rule marked to do and the delivered urgency rules documented (1 urgency in rounds 1–2, 2 from round 3 via the
  odd-round twist, weapon fallback); fill groups of about 6, 1 in 5 rock throwers from round 2, rescue aggressors 2–4
  in round 1 then 3.
- **12.3 table**: real formulas (windups min(4, 2 + ⌊P/4⌋), contact damage min(12, 5 + ⌊P/2⌋), rocks fixed 5,
  intervals 1.8 / 3 / 5 s fixed).
- **12.4**: the 20–30 s patrol replaced by the delivered 1.5 s flow keeper (RC-94).
- **12.5, 12.6**: field heals marked to do (phase C); stations: two, 28 px.
- **12.9**: « nouvelle manche déjà lancée » → 6 s breather then next round.
- **12.10, 12.11**: two rescue variants delivered (harassed group / elderly theft, 50/50); « manifestante agressée » and
  the couple marked to do; delay 25 s (`rescue.threatSeconds`); site 300–900 px of path; urgency cap per round.
- **12.12**: cross-reference « section 10 » → 9.2.
- **12.14, 12.15**: headings « (à faire) »; explicit « nothing here is delivered » plus what of phases B/D is already
  delivered; design references fixed (sections 2, 4, 5, 6 of the design); added from the design: runner rush twist,
  Caïd closes every round from 3, flashball aim assist on touch, rock fall, « SPLOTCH », pitch jitter, shorter freezes
  with reduced motion; gant consistent with 8.7.
- **13.1**: rows for shop, car/bus stop, repair/extinguish per target, stolen item +2, Caïd (to do); police/protected
  NPC penalties « sans objet »; round bonus delivered (smouldering counts as success); shop shutter row « non livré ».
- **13.3**: the delivered summary rows listed, missing ones flagged.
- **14.1**: incident card statuses (target %, rescue « Rends les objets », flag « à reprendre / en cours / zone
  contestée »), edge indicator labels (BOUTIQUE, MONUMENT, DRAPEAU, FURIE, BOUCLIER, RAYON), « Monument menacé »
  headline, « Frappe, ils volent ! » sub-line, casse alert table no longer « Proposé », to-do rows tagged, the
  « commerce en cours de pillage » indicator removed, minimap not delivered.
- **14.3**: only the normal mode exists.
- **16**: monument alarm, chimes (defended, flag back, item returned), swap / break sound, pickup sounds, 3 hit variants.
- **18.3**: event list replaced by the real `SimEvent` catalogue; missing target events listed.
- **18.4**: JSON: rulesVersion `slice-0.2.0`, capture 8 s, repair 2 s, health model instead of the 30 s reserve; note
  that `CONFIG` is the source of truth.
- **19.2**: budgets (gate, fire patches 6, satellites 16, popups 24, weapon drops, urgencies per round, to-do items).
- **21.2**: RC rows sorted by number (RC-79–85 and RC-112/113 were out of order; 1–118 all present, no duplicates);
  RC-28, RC-30, RC-33, RC-49, RC-79, RC-80, RC-82, RC-85, RC-91, RC-98, RC-99 adjusted.
- **23.1, 23.4**: shop shutter « non livré »; bouclier / onde delivered, gant to do.
- **24**: main table updated (hordes, objectives, score, access/interface rows; to-do: other peaceful groups, students,
  options, discovery mode); the phase paragraph turned into a **Livré / À faire** table per phase (phase C « two
  simultaneous urgencies » clarified: twist only; « two places at once from round 5 » still to do).
- **25.1**: rescue 25 s, smoulder and Molotov burst, monument row.
- **25.4**: changelog sorted ascending (1.9.5 → 1.9.10 were reversed) and 1.9.11 added.
- **26.3**: duplicate « La partie avance par manches » bullet merged; specials mentioned. **26.7**: landing RC range is
  RC-69–78 and RC-86–90 (was « RC-86 à RC-106 »).

Constants re-checked against `src/sim/config.ts`: player 100 HP / 180 / 250 px/s / 0.6 s; melee 56 px, 0.45 s, 3
targets; rocks 0.6 s, 280–360 px, 5 dmg, 28 px pickup, stock 3, return 1 dmg / 360 px / 0.5 s, caps 24 / 16; weapons
10 s, 15–25 s, cap 2, 20 px, 160–480 px, 15 s; furie 12 s, ×1.35, ×1.5, 8 targets, ×0.5, rounds 4 / 6; bouclier 20 s,
120°, 64 px, 24 px, rounds 3 / 5; kamehame 2 uses, 1 s, 320 px, 16 px, rounds 5 / 7, satellite 1100–1800 px, 6–10
turns, ±0.15 rad; targets 2 / 1.2 (×4) / 0.7 PV/s; Molotov 1.5 s, 96 px, 8; firebomber 140–260, 100, 1.2 s, 0.7 s, 5 s,
round 3, 1/8, 3 max; fire patch 30 px, 3.5 s, 6, 4 / 0.5 s; monument round 4, 6, 8, 4 s, 3, 8 s, +4/−3/+10; kit 2 / 20
/ 2 s / 48 / 64; rounds 10-14-18-22 +4 cap 40, 6 s, 4 s, 2 s, 1.5 s, 0.8 s, gate 12, groups 6, twist 0.5, +5; rescue
25 s, 1.5 s, +6, 3 items at 75/50/25 %, +2, 20 / 48 px, 12 s; pressure cap 12. All now match the spec.

## Code bugs or doubtful behaviours (not fixed, spec rule kept where relevant)

1. **Specials at the twist arrive one round later than announced.** The twist is `secondUrgency` on odd rounds ≥ 3,
   so the bouclier (dropFromRound 3) and the onde d’énergie (dropFromRound 5) can only be drawn at the twist from
   round 4 / round 6, except when the second urgency has no slot or free target and falls back to a weapon drop.
   The spec (8.8, 8.9, RC-117) keeps « dès la manche 3 / 5 »; the 12.2 table now says so explicitly. Decide whether
   to shift `dropFromRound` or allow a weapon twist on odd rounds.
2. **School flag after a ruin repair.** The French flag is drawn only while the current school incident is `saved`
   (`render/targets.ts`); a repaired ruin keeps the incident `destroyed`, so the flag stays down until the school is
   next saved. Doubtful against « sa fonction reprend » (10.7).
3. **Summary rows « École » / « Secours»** show one status for the whole session (any success wins: « sauvée »,
   « réussi ») instead of counts; the monument stats (`monumentsDefended`, `flagsLost`, `flagsCaptured`) are
   collected but never shown.
4. **Round headline of a rescue** is always « Agression en cours », even when the drawn rescue is a theft
   (« VOL EN COURS ! ») — the kind is drawn at launch, after the round banner.
5. **Agir is read as a held key** (`act: held.has('KeyF')`): holding F while walking to a ruin starts the repair
   as soon as conditions hold. Harmless, but it is not strictly « un appui ».
6. **Changelog gap:** there is no 1.9.2 entry in the history (not invented here).

## Not verified

- Visual details (Paul's glasses in game, icon and landing image; victim « repli » after a failed rescue; the
  grumbling bubble look; mobile layout at 375 × 812): read from code and earlier reports only, no browser pass.
- Audio behaviour by ear.
- Anything in sections 17, 19–22 and 26 that depends on real devices, hosting or network budgets.
