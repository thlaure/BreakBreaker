# BreakBreaker — Slice 2 « Fun » design

Date: 2026-10-20. Status: approved in chat by the user ("ça me plaît bien, tu peux implémenter"). Historical design record: the delivered state
is described in the `docs/SPECS - *.md` files, which win over this document.

## 1. Why

After the first round (school + rescue), every wave is the same thing with more rioters (3, 5, 7, 9…). The user's
words: repetitive, *mou*, "le gameplay ne proposait pas un bon rythme". Rioters are threatening enough; what is missing is:

1. **Rhythm** — ups and downs inside a round, a breath between rounds.
2. **Variety** — something new every round or two: a new casse, a new enemy, a new weapon.
3. **Fun tools and reactions** — weapons that are funny to use and to look at, and KO falls that make you laugh,
   sometimes completely "what the fuck".

Success = a player who keeps going "oh, what's this one?" until round 8+, and laughs at a fall now and then.

**Anti-goals:** unfair deaths (shots must be readable and dodgeable); gore (no blood, ever); a wall of text or menus
between rounds; holding a key to complete something (the user removed that from rescues and wants it gone everywhere).

## 2. Round rhythm (user + Claude's proposal, accepted)

Waves become **rounds (manches)**. One round:

1. **Breather (6 s)** — no new rioter enters. A non-modal panel « Manche N terminée » (KOs, objectives réussi/perdu,
   points, bonus). Stations recharge. One weapon drop appears near Paul. Round 1 has no breather (the 4 s intro plays that role).
2. **Announcement** — pixel banner « MANCHE N ! » with the round's headline casse (e.g. « MAGASIN EN DANGER ! » sub-line).
3. **Build-up** — the first group heads for the casse spot while Paul rushes there.
4. **Twist** — once half of the round's roster is KO'd, one twist from the round's list fires: a second urgency
   elsewhere, a rush of fast rioters, or a special weapon drop to race for.
5. **Climax** — the round's last group includes its strongest element: a mini-boss (from round 3), the shooters
   (late rounds), or simply a big group (rounds 1–2).
6. **Reward** — round completed: bonus, summary, back to step 1.

Inside a round the old "no hole longer than ~3 s" rule (RC-94) still holds. **Between rounds the 6 s breather is
intentional** and replaces the "next round in the same step" rule of the old plan (the user explicitly wants a down
beat). The breather starts when the round's whole roster is KO'd (see §9.1).

**One new thing per round** (round → novelty) — the catalogue the director follows:

| Round | Headline casse | New enemy | New weapon | Twist |
| ---: | --- | --- | --- | --- |
| 1 | School (Molotov → fire) | contact, degrader, Molotov | (baton/marteau/panneau as today) | — |
| 2 | Looted shop + rescue | rock thrower | — | weapon drop |
| 3 | Burning car / bus shelter | **runner** (fast, fragile) | **boxing glove** | runner rush |
| 4 | Occupied monument | **brute** (tough, slow) | — | second urgency |
| 5 | Nursery + kiosk | — | **shield** | second urgency |
| 6 | Drawn | **shooter (AK-47)** | **flashball** (guaranteed drop with the first shooter) | weapon drop |
| 7 | Town hall | — | **kamehame** (rare) | drawn |
| 8 | Drawn | 2 shooters per round | — | drawn |
| 9+ | Library at r9, then drawn | mixes | — | drawn |

Mini-boss (« Le Caïd », big sprite, 6 HP, knockback on Paul, +5 when KO'd, drops a weapon) closes every round from round 3.
Round totals keep the old plan's growth (10, 14, 18, 22, then +4, cap 40).

## 3. Buildings with health, Molotovs and fire (user)

- Every target (school, shop, nursery, town hall, library; props car, bus shelter, kiosk) starts **intact** with a
  **health bar** (buildings 100 HP, props 60 HP), drawn above it on the map and mirrored in its alert card.
- An attack begins with a **Molotov rioter**: walks to the building, a visible windup (lit bottle raised, ~1.5 s),
  throws → the building **catches fire**. KO him before the throw = no fire. Later attacks may bring 2 Molotovs.
- **Fire** burns the building over time. **Degraders** hit the building and also drain its health. Other rioters of the
  same attack go for Paul. The mix (who hits the building, who hits Paul) is the balance knob; start with roughly
  half/half and tune.
- Fire goes out on its own 1.5 s after the last rioter of that attack is KO'd (*Claude's call*, mirrors the rescue).
  Building saved → bonus, and its health refills to full at the end of the round.
- **Destroyed** (0 HP) → points lost, ruin drawn (scorched, smoke), it stays destroyed across rounds and is never
  attacked again until repaired.
- **Toolbox (caisse à outils)**: lies on the map like the heal kits, with its own look (orange/red toolbox, same
  float/pulse animation). Walk over it to pick it up (one carried). Walk to a ruin and **stay next to it ~2 s with no
  rioter close** → repaired, automatically (no key — *Claude's call*, consistent with the user's "no holding F").
  Repaired building comes back at 60 % health, full at the next round end.
- **Points (user)**: destroyed = lose points; repaired = gain points; left destroyed = just the loss. Values from the old
  plan: buildings saved +8 / destroyed −3 / repaired +5; props +4 / −2 / +3; shop +4 dispersed, 0 lost, +5 repaired.
  A destroyed building never ends the game; only Paul at 0 HP does.

The old « réserve » countdown (30 s) is replaced by this health model everywhere, school included. The school's
reinforcement cinematic stays for round 1 only.

The shop's shutter (old plan Task 4) also becomes automatic: stand at the shop door 2 s once looters are dispersed.
After this slice, F / Agir is only used to skip the school cinematic.

## 4. Enemies (user: AK-47 late; Claude: progressive archetypes)

| Enemy | From | Behaviour | Readability |
| --- | --- | --- | --- |
| contact | r1 | as today | — |
| degrader | r1 | hits its target building | — |
| Molotov | r1 | walks to the building, 1.5 s windup, throws, then fights Paul | lit bottle + flame glow in hand |
| thrower | r2 | as today (rocks) | existing telegraph |
| runner | r3 | 1.6× speed, 1 HP, comes in packs of 4–6 | lighter, hooded sprite, dust puffs |
| brute | r4 | 4 HP, 0.75× speed, hit knocks Paul back | bigger sprite, helmet |
| shooter (AK-47) | r6 | stops 220–300 px from Paul, red aim line for 0.8 s, then a 3-bullet burst along that line, 3 s reload; 3 HP | aim line + "!" above head; bullets are slow, visible yellow dashes, dodgeable |
| Le Caïd (mini-boss) | r3 | 6 HP, closes the round, knockback, +5 | 1.5× sprite, crown/cap, own HP bar |

Shooters are capped (1 at r6–7, 2 from r8, 3 max). Bullets: 8 damage each, blocked by buildings, props, the peaceful
group and the shield. Cartoon only: small dark pixel rifle, no blood, no muzzle gore.

## 5. Weapons and tools (user + old plan)

Melee (one-hit KO, limited strikes, as today): bâton, marteau, panneau, **gant de boxe à ressort** (long punch 160 px,
knocks back). Ranged: **flashball** (aim with the mouse / toward the facing on touch with a light aim assist, 6 shots,
one-hit KO, stops at walls), **kamehame** (hold Frapper 1 s, beam KOs everything on a line, 2 uses). Defence:
**bouclier** (20 s, blocks rocks and bullets from the front, bash KOs). Unlock rounds per §2 table. Weapons stay
cartoonish and are drawn as pixel sprites at runtime like today's.

## 6. Funny KO falls and hit "juice" (user)

- Every KO picks a **fall** that depends on the weapon, with randomness:
  bare hands → crumple / spin to the ground; panneau → flies far spinning; marteau → flattened like a pancake then pops
  back; gant → pinball bounce off walls; flashball → backflip; kamehame → launched off-screen with a star twinkle;
  rock → wobble and topple.
- About **1 KO in 10** is a rare **WTF fall**: triple backflip, helicopter spin straight up, faceplant slide across the
  street, lands head-first in a trash can (legs sticking out), or **domino** (the flying body knocks down 1–2 rioters
  next to it — they count as KOs, +1 each, and a « DOMINO ×2 ! » pop).
- The fall kind is chosen by the sim (separate random stream, deterministic) and sent with the KO event; the domino is
  a real sim effect, every other fall is pure rendering. Rioters lie dazed with stars, then fade (as today).
- **Hit juice** on every hit: 2–3-frame freeze, small camera shake (bigger for kamehame / domino / Caïd), pixel
  onomatopoeia bubbles (« POW ! », « BONK ! », « PAF ! », « BOING ! » for the glove, « SPLOTCH » for the pancake),
  sound variations (pitch jitter). Respect `prefers-reduced-motion`: no shake, shorter freezes.

## 7. Constraints (unchanged unless stated)

- Pure deterministic 60 Hz sim in `src/sim` (no Phaser); rendering and HUD only read the snapshot and events.
- Free assets only, no new paid asset; new sprites drawn at runtime or from the existing LPC/Kenney sheets; sounds
  synthesised or from the existing CC0 packs.
- Binding user decisions stay: Paul, every KO +1, neutral counter, no OQTF wording, BreakBreaker name, French UI.
- **Changed:** the old plan's "No firearms" rule is lifted by the user for the AK-47 shooters and the flashball —
  cartoon style, no blood, no realistic gore.
- Caps: 40 hostiles, 24 flying rocks; bullets cap 30 in flight.
- Spec `docs/SPECS - Index.md` updated (v1.9) with this design: rounds rhythm, building HP, Molotov, toolbox,
  enemies, firearms rule change, falls.

## 8. Delivery in four playable phases (Claude's call)

- **Phase A — Rhythm + buildings**: rounds with breather/announcement/twist/climax skeleton; building HP, Molotov,
  fire, degraders; ruins; toolbox repair; school, car, bus shelter targets; round summary. Rounds 1–3 playable.
- **Phase B — Enemies + weapons**: runner, brute, shooter, Caïd; flashball, gant, bouclier, kamehame; held-strike input.
- **Phase C — More casse**: shop (auto shutter), monument capture, nursery, kiosk, town hall, library, field heals,
  two simultaneous urgencies.
- **Phase D — Falls + juice**: fall catalogue, rare WTF falls, domino, hitstop, shake, onomatopoeias, sounds.

The user can play after each phase; each phase ends with tests green, a browser check and a push request.

## 9. Builder-check answers (Claude's calls)

1. **Round roster = every rioter the round spawns**: objective rioters (Molotovs, degraders, attackers), rescue
   aggressors, twist spawns, shooters and the Caïd all count in T. The breather starts when the whole roster is KO'd,
   so nobody from the round is alive during it. Only flow-keeper patrols are outside the roster (never block a round).
2. **Rescues**: round 1 = school, then a rescue (as today). From round 2 a rescue is one of the beats (alternating with
   the monument from round 4), as in the old plan. **The shop has HP like every target** and can be destroyed
   (−2, ruin, toolbox repair +5); once its looters are KO'd, standing 2 s at its door reopens it (+5, automatic).
3. **Weapon-drop twist**: rioters never pick up weapons. The drop is a special weapon placed away from Paul with an edge
   indicator; it vanishes after 15 s if nobody takes it.
4. **Phase A's round 3** runs with Phase A content only (car / bus shelter attack, more rioters). Runner, glove and Caïd
   arrive with Phase B; until then round 3's novelty is the new casse.
5. **Spec first**: the cahier is updated to v1.9 at the start of Phase A (RC-94 breather, health model, toolbox without
   F, firearms rule, falls). This design wins over older RCs; tests target the new rules, and tests asserting replaced
   rules (reserve countdown, wave announcements, held-F repair) are rewritten, not kept.

## 10. Left to the builder

Exact HP/damage numbers (start from the values above and tune with the bot test), sprite details, sound synthesis
parameters, which twist a drawn round picks, exact panel layout (must stay non-modal and never cover Paul).
