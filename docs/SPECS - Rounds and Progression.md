# BreakBreaker — Specifications: Rounds and Progression

> **Purpose of this file:** arcade mode, rounds, events, healing, emergency services, prison, score and summary.  
> Part of the BreakBreaker specifications (version 1.0.2), split into several files. Back to the [specifications index](SPECS%20-%20Index.md) (overall table of contents, version history, conventions, file map).

## 12. Arcade mode, rounds, events, progression and healing

### 12.1 Central rule

**No session time limit. No global countdown. The session continues until the hero is KO.** The session is divided into rounds (section 12.2). Succeeding at the school, the monument or a round increases the score and renews the content, without resetting health and without showing a final victory. A failed objective never ends the session: only Paul's KO ends it.

The strike delays, the destruction of an attacked building, the distress of a rescue, the cutscenes, the capture and the interactions have local durations. A survival duration measure may appear in the summary, as elapsed time, without countdown pressure.

### 12.2 Round structure

**Confirmed:** rounds replace endless waves as the target structure. A round sets a number of rioters to knock out and one to three objectives. It ends when its whole roster has been neutralised and its objectives are resolved, succeeded or lost. A failed objective never ends the session; only Paul's KO ends it.

**Changed (v1.9) — round pacing.** A round alternates highs and lows: (1) **6 s breather** with no rioter entering, with the non-blocking panel « Manche N terminée » (Round N complete; KO, objectives « réussi » / « perdu » (succeeded / lost), points, « Bonus +5 » if earned, « Soins rechargés » (Heals recharged), countdown « Manche N+1 dans 6… » (Round N+1 in 6…) down to 1), healing stations recharged, health of intact places restored to maximum (never that of a place still on fire), toolboxes put back down (also at the start of the round) and, **changed (v1.9.16):** at the end of even-numbered rounds only, an ordinary weapon dropped 160–480 px from Paul (disappears after 15 s; none if a weapon is already on the ground within 200 px of Paul); pending patrols are cancelled and those still on the map leave; round 1 has no breather, the 4 s intro takes its place; (2) **announcement** by the pixel banner « MANCHE N ! » (ROUND N!) with the round's headline incident (« Voiture menacée · 18 casseurs » (Car threatened · 18 rioters): nothing is on fire yet); (3) **build-up**: the first group heads for the attacked place; (4) **twist** as soon as half of the roster (rounded up) is KO: **changed (v1.9.12):** a weapon to go and fetch from round 2 onwards (disappears after 15 s; **changed (v1.9.14, v1.9.16)**: from round 3 the shield, with its banner, one time in two; otherwise, and in round 2, an ordinary weapon without a banner one time in two, nothing otherwise; section 8.9), and **in addition**, in odd-numbered rounds from round 3, a second emergency elsewhere if the emergency cap allows it (the player chooses between running to the weapon and defending); (5) **climax**: the last group of the round enters tighter (0.8 s interval); (6) **reward**: +5 bonus if all objectives are succeeded, then back to the breather. The breather starts when the whole roster of the round is KO. The player keeps their health, score, KOs, stone stock, carried toolbox, held weapon with its remaining hits and healing history.

The rioters assigned to objectives (front line, reinforcements, monument occupants, rescue aggressors) are part of the round roster. An optional repair of an already lost building does not prevent the transition. A triggered rescue is always resolved (succeeded or missed) before the end of its round, since its aggressors are part of the roster. **Changed (v1.9.4, project owner's request):** the former "looted shop" (shutter, shopkeeper, section 23.1) is not delivered; the delivered shop is a **retro video game shop** (« JEUX RÉTRO »), a building to protect like the school (health, Molotov, degraders, smouldering fire up to the toolbox, repair at full health), without a shutter or a shopkeeper; it enters the headline incident draw from round 2 (random draw, v1.9.4).

**Round progression — delivered / to do items (v1.9.11, twist v1.9.12).** Rosters (parameters `round.totals`, `growth`, `maxTotal`); the "Delivered" column describes the current game, the "To do" column the novelties planned by the slice 2 design and not yet implemented (sections 12.14 and 12.15).

| Round | Rioters to neutralise | Delivered | To do |
| --- | ---: | --- | --- |
| 1 | 10 | School (Molotov, degraders, cutscene and eight reinforcements) then rescue; melee rioters, degraders and Molotov; stick, hammer, road sign in the street; energy gauge (wave at 50, fury mode at 100, v1.9.14) from round 1 | — |
| 2 | 14 | Headline incident drawn at random (school, retro games shop, car, bus shelter) then rescue; stone throwers; twist: ordinary weapon one time in two (v1.9.16); first breather weapon at the end of the round (even-numbered rounds, v1.9.16) | — |
| 3 | 18 | Throwers aimed at Paul; pack of runners and « Le Caïd » (the Caïd) as the last rioter of each round from this one on (v1.9.13; 14 HP, +2 every two rounds, v1.9.16); twist: shield one time in two, otherwise ordinary weapon one time in two (v1.9.14, v1.9.16) **and** second emergency (two simultaneous emergencies at most from this round); spring boxing glove in the street (v1.9.15); two phone booths in play, attackable from this round (v1.9.19); the first Caïd KO is locked up the prison (v1.9.20) | — |
| 4 | 22 | Monument alternating with the rescue; one brute per round (two from round 6, three from round 8, v1.9.13); twist: shield or ordinary weapon; **attackable prison (v1.9.20)**: 400 HP, the Caïds knocked out are locked up it (from round 3, as long as it stands), its 5 guards are posted from round 1 | — |
| 5 | 26 | Twist: shield or ordinary weapon, and second emergency; shield and flashball (v1.9.15) in the street; **two places attacked at once from the start of the round; nursery school and newsstand (v1.9.18)** | — |
| 6 | 30 | Cartoon AK-47 shooter (one per round in rounds 6–7, in the last group), flashball guaranteed with the first shooter of the game (v1.9.15) | — |
| 7 | 34 | Town hall (v1.9.18) | — |
| 8 | 38 | Two shooters per round (v1.9.15) | — |
| 9 and later | 40 (cap) | Same mix, increasing pressure; two shooters per round in round 9, **three from round 10 (v1.9.24, `shooter.counts`)**, never more than three (cap of `shooter.maxPerRound`); library (round 9, v1.9.18); roster that may exceed 40 (see below) | — |

**Incident catalogue.** Each incident element is a place on the map (existing building or added street furniture) with visible states: intact → attacked (fire, smoke, broken windows) → persistent ruin → repaired by toolbox. It reuses the school mechanic: health that only drops under fire or an effective degradation (section 10.2), ruin that persists between rounds, repair by toolbox (section 10.6), spawns counted in the round roster. A place in ruin is no longer drawn until it is repaired; if it was planned, its rioters join the round queue.

| Element | Place | Available from | Health | Points saved / lost / repaired |
| --- | --- | ---: | ---: | --- |
| School on fire (delivered) | School (north-west) | Round 1 | 100 HP | +8 / −3 / +5 |
| Retro games shop (delivered, v1.9.4) | Building 5, south-west of the centre (door to the south); no shutter | Round 2 | 100 HP | +6 / −2 / +4 |
| Car on fire (delivered) | Two parked-car spots | Round 2 | 60 HP | +4 / −2 / +3 |
| Wrecked bus shelter (delivered) | Bus shelter | Round 2 | 60 HP | +4 / −2 / +3 |
| Monument under attack (delivered, v1.9.4) | Equestrian statue with the French flag, east of the centre (section 11) | Round 4 | — (no health) | +4 defended / −3 flag replaced / +10 flag recaptured |
| Nursery school in danger (delivered, v1.9.18) | Building 9, south-west (R(6,30,7,6), door at C(9,36) on the street side, four attack points on row 36) | Round 5 | 100 HP | +8 / −3 / +5 |
| Wrecked newsstand (delivered, v1.9.18) | Newsstand, street furniture R(34,40,2,1) on open ground in the south-east, south of building 7 and west of building 11 | Round 5 | 60 HP | +4 / −2 / +3 |
| Town hall under attack (delivered, v1.9.18) | Building 1, in the north (R(15,3,6,4), door at C(18,7)) | Round 7 | 100 HP | +8 / −3 / +5 |
| Library on fire (delivered, v1.9.18) | Building 10, in the south (R(22,38,8,5), door at C(26,43), attacked by its south front, row 43) | Round 9 | 100 HP | +8 / −3 / +5 |
| Wrecked booth (delivered, v1.9.19) | Two phone booths, 1 × 1 street furniture: the red one at R(4,22), the blue one at R(5,22), side by side on the open square in the centre-west (section 12.16) | Round 3 | 60 HP | +4 / −2 / +3 |
| Prison under attack (delivered, v1.9.20) | Building 11, in the south-east (R(38,36,6,6), door at C(41,42) on street row 42, attack points at C(39|40|42|43, 42)); guards, locked-up Caïds and breakout (section 12.17) | Round 4 | 400 HP | +8 / −3 / +5 |

**Simultaneous emergencies.** Delivered: a single emergency at a time in rounds 1 and 2, two at most from round 3; the second comes from the twist of odd-numbered rounds (from round 3), in addition to the dropped weapon, on a free place drawn at random, preferably a place not yet attacked in the round (nothing more if there is no room or no free place; **changed v1.9.12**). **Delivered (v1.9.18):** from round 5 (`TWO_URGENCIES_FROM`), the first sequence of the round launches two incidents at once, on two distinct free places, at the start of the round. Selection rule: the types that open this round go first (round 5: nursery school then newsstand; round 7: town hall; round 9: library); the remaining slots are drawn by the existing weighted draw (weight 1 for a type from the first sequence of the previous round, 2 for the others, which favours the absent places). A different type is preferred; if none is left free, a second place of the same type is taken (car 1 and car 2). The two booths (v1.9.19) and the prison (v1.9.20) count as free places in this draw from round 5, like the two cars (the two booths can both be drawn). With a single free place, a single attack; with no free place, only the second sequence takes place. A place in ruin or on fire is never drawn. Place types open according to `CONFIG.casse.fromRound` (school 1; car, bus shelter, shop 2; nursery school, newsstand 5; town hall 7; library 9; booths 3, v1.9.19; prison 4, v1.9.20); rounds 2 to 4 draw exactly as before, apart from the booths from round 3 and the prison from round 4 (seeds from before v1.9.19, then from before v1.9.20, therefore no longer replay identically). The prison can be drawn as the first incident from round 4 and as the second emergency from round 4; it counts for the two-emergency rule like any place. The second sequence (rescue or monument in alternation) always waits for the first to be settled and for the emergency cap to be respected. **The twist of odd-numbered rounds never adds a third emergency:** it is ignored while two emergencies are in progress. Only the school of round 1 keeps the front line + reinforcements sequence; the other attacks have a single line of rioters. Each incident triggers the pixel alert of section 14.1. The added street furniture (cars, bus shelter, newsstand, booths) is solid, leaves at least one free tile around it, stays away from the peaceful group, the spawn points and the stations, and cuts off no passage.

Internal flow: rioters enter one by one, the first of a group 2 s after it is queued and then at 1.5 s intervals (0.8 s for the climax group), only while fewer than twelve hostiles are active on the map; the rest wait in an entry queue. The objective rioters go to the front of the queue. The rest of the roster (filler) is split into groups of about six (the largest last: the last one is the climax); a group only enters once the previous one has entirely entered and been KO'd. From round 2, one filler rioter in five throws stones; from round 3, a few throw Molotovs at Paul (section 10.9). A rescue has two to four aggressors in round 1, three afterwards. The roster T of the round is `max(objective rioters, [10, 14, 18, 22][N−1] or min(40, 22 + 4·(N − 4)))`; it counts all the rioters of the round (objectives, aggressors, twist), only the flow-keeping patrols are excluded from it. **Added (v1.9.18):** from round 5, T is raised if needed to "objective rioters + filler reserve" (`fillReserve`): the round's pack of runners plus the smallest filler whose "contact" slots (after the stone throwers and the Molotov throwers) hold the Caïd, the brutes and the shooters; two simultaneous attacks therefore never leave a round without a shooter, brute, Caïd or pack. The roster of a round can then **exceed 40 from round 9** (41 in round 9, about fifty at worst with two large buildings and the monument), but the cap of 40 simultaneously active hostiles remains in force.

**Round numbering and objective.** Rounds are numbered from 1 from the start of the game; the number never shows 0. Each round has a "K/T" objective: T rioters to neutralise, K rioters of this round already KO'd (bounded between 0 and T). During the 4 s intro, no objective is set yet (« Manche 1 »). **Changed (v1.9.4, project owner's request: « ça ne peut pas être aléatoire ? » — can't it be random?):** round 1 is the school then the rescue (learning: first Molotov, cutscene, reinforcements); **from round 2, the headline incident is drawn at random** (deterministic draw by seed) among all free places — standing, not on fire, no attack in progress: school, shop, cars, bus shelter — weight 2, weight 1 for the one from the previous round (it may come back, rarely; nothing is imposed). Second stage: the rescue, or from round 4 the monument in alternation (section 11). No free place: the second stage alone. Twist (**changed v1.9.12**): a weapon every round from round 2 (the shield one time in two from round 3, section 8.9), plus a second emergency in odd-numbered rounds from round 3 when the emergency cap allows it. Shop attack: its Molotov throwers at the front, then two degraders and a melee rioter, plus min(6, 2 + pressure ÷ 3) degraders and melee rioters in alternation, like the school after round 1; variants always mixed.

**Steady flow within a round, breather between rounds (RC-94).** Within a round, once the intro is over, no more than about 3 s ever elapse without an active rioter on the map: if nobody is active for 1.5 s, the next group enters immediately, otherwise an off-roster patrol. **Intended exception:** the 6 s of breather between two rounds are a deliberate low point, with no entry at all, requested by the project owner; they replace the former rule "the next round starts during the summary".

Prepare at least four assault compositions and several spawn points. No new objective must trigger during a suspended cutscene. The between-rounds summary panel is a local display delay; it does not impose a game timer.

### 12.3 Pressure director

The director tracks the round, its groups, the resolved objectives, the KOs, the entry queue and the active agents. Difficulty increases with progression, not only with the time spent waiting in a corner.

Proposed pressure level: `P = min(12, 1 + floor(round / 2) + floor(KO / 30))`, where `round` is the number of the current round (v1.9). It replaces the formula of revision 1.4 and remains a starting point to be tested. It makes the fight against additional opponents progressively more dangerous, even if the player delays an objective.

Parameters increase in steps with caps: total number of reinforcements per episode, behaviour variants, decision speed, resistance of some rioters and damage. Animation speed must never remove the legibility of the attack preparation.

| Parameter | Proposed normal start | Proposed cap |
| --- | --- | --- |
| Player health | 100 | 100, no automatic increase per round |
| Hits needed per rioter | 2 bare-handed; 1 with a weapon | 4 bare-handed for clearly signalled reinforced opponents (to do, section 12.14); always 1 with a weapon |
| Simultaneous preparations against the hero | 2 melee + 2 throws | min(4, 2 + ⌊P ÷ 4⌋) melee and as many throws (stones and bottles), with legible windows |
| Damage per enemy melee hit | 5 | min(12, 5 + ⌊P ÷ 2⌋); stones: fixed 5; fire puddle: 4 every 0.5 s |
| Individual attack interval | 1.8 s in melee, 3 s between two stones, 5 s between two bottles at Paul | Fixed today; no less than 1.2 s if sped up; preparation always visible |
| Round rioters on the map | Entering one by one every 1.5 s | Entry suspended at 12 active hostiles; technical cap of 40 active hostiles, aggressors included |
| Students on the move (to do, section 10.8) | Up to 5 | 5 |

Damage or resistance increases are announced by appearance, status or gauge, with no incomprehensible random bonus. The statistics of reinforced roles are a separate difficulty variation. The thrower or degrader roles are independent of the visual variant.

An agent cap is a computation cap, not an end to the assault: the director keeps reinforcements in the entry queue and has them enter once a slot is freed. The surviving agents of a lost objective occupy these slots. No active opponent must be silently removed to solve the problem.

### 12.4 Anti-stagnation

The player may leave an objective, but not wait indefinitely in an invulnerable refuge while earning points or healing. Active enemies chase the hero according to their role. **Changed (v1.9.11, aligned with the game):** during a round, if no hostile is active or waiting for 1.5 s, the director immediately brings in the next group, or failing that an off-roster patrol rioter (RC-94), under the same agent cap; the rule does not apply during the short end of a secured rescue nor during the breather, where the patrols leave. The former proposal of a patrol after 20 to 30 s of inactivity is replaced.

The patrol brings neither free points nor automatic healing. KOs increase pressure. Objective bonuses remain tied to unique occurrences, not to entering and leaving a circle.

### 12.5 Health and small heals

Maximum health: 100. No automatic passive regeneration in normal mode. The player must spot and reach healing. Each resource is a persistent gameplay state for the session, not an effect that reappears at every visit.

Two healing points are proposed in the district: a first-aid kit near a rescue post and a cupboard or kit in a back room (delivered: two « Soins » (Healing) stations, picked up in passing at 28 px or less). The small field heal below is **delivered (v1.9.18)**. It is signalled by a medical pictogram accompanied by text. Its placement leaves a retreat route without guaranteeing the absence of enemies.

| Proposed resource | Effect | Stock / how obtained |
| --- | --- | --- |
| Healing point | +25 HP applied on contact, without exceeding 100 | One charge per point and per round, two points at the start |
| Small field heal (delivered, v1.9.18) | +10 HP (`CONFIG.fieldHeal`) | One heal after each slice of 8 eligible KOs (KOs of the round's filler, domino victims included, never the patrols; the count restarts from 0 at each round, the slice counter is kept); at most two on the ground; each heal disappears 20 s after being dropped |
| Round resupply | Restores the charges of the two healing points | Once at the end of the round, not on simply returning to the point |

The quantities are to be balanced. The two points do not give a full healing; health is not set back to 100 after an objective or a round.

### 12.6 Healing on contact

**Confirmed:** walking onto a charged healing point immediately applies +25 HP, capped at 100, and consumes its charge for the round. No key, no hold, no possible interruption. The charge and the health gain are applied together, only once, per charge identifier.

At full health, no charge is consumed and the interface shows « Santé au maximum » (Health at maximum). Station used: « Épuisé » (Exhausted) until the next round. A station does not reset the enemies and does not suspend combat.

A charged kit floats and pulses gently (small animation) to be spotted from afar; an exhausted station stays still.

**Delivered (v1.9.18):** the small field heal (kit reduced to 0.625, green glow, « +10 » label, floating) is dropped on a clear tile 48–112 px from Paul, at least 14 px from any solid, outside the peaceful group, with a clear line to Paul and never on top of another healing; the draws have their own random stream. It is picked up in passing at 20 px or less, only below maximum health (at full health it stays on the ground); the actual gain is capped at 100 HP, a green « +N PV » (+N HP) floats above Paul and the pickup sound plays. Nothing is taken if Paul is KO or the session is over. It **expires 20 s after being dropped**: it blinks during the last 3 seconds, like the weapons, then disappears. No screen-edge indicator.

When two small heals are already on the ground, **a single healing may wait**: the next slice is dropped as soon as a slot is freed. The rest of the counter is kept and capped at 15 KOs (2 × 8 − 1), so that freeing slots never triggers a deferred pile. An object carries a unique identifier preventing double consumption.

### 12.7 Healing balance

Healing rewards movement and progression, without guaranteeing unlimited survival in place. Each new stock is tied to the round or to eligible KOs. No continuous resupply solely because time has elapsed or a menu has been opened.

Discovery mode may increase healing or reduce damage, with a separate record. The automatic adjustment of graphics quality never changes health, healing, pressure or the number of opponents to defeat.

### 12.8 Clocks and suspension

- **Active simulation**: movements, contacts, AI, healing, capture and reinforcement delays.
- **Suspended presentation**: menus, help, cutscenes and mandatory resource preparation; no health lost.
- **Survival duration**: optional monotonic measure of active time, shown in the summary if retained.

A drop in render frame rate must not change projectile trajectories and contacts, nor make a capture or a repair progress differently for an equal active duration. Going to the background suspends the simulation and releases the controls; resuming is explicit.

### 12.9 Session endings

| Cause | Result |
| --- | --- |
| Hero's health at zero | Arcade defeat and final summary |
| Objective lost | Penalty or missed bonus; session continues |
| Round completed | 6 s breather with the non-blocking panel « Manche N terminée » (Round N complete), stations recharged, then next round; health, score and weapon kept |
| Pause | Session suspended, no result validated |
| Voluntary stop | Summary marked « Session interrompue volontairement » (Session voluntarily interrupted) |
| Unrecoverable technical problem | Technical exit reported, no false defeat recorded |

A KO must not be cancelled by a healing processed later in the same step. Order the contacts, the damage, the KO check, then the interactions that are still valid. A terminal event prevents new gains after that point.


### 12.10 Dynamic rescue events

The design term is **dynamic event** or **random encounter**. It is a short incident that appears during exploration and invites the player to temporarily change priority.

Three variants proposed; the two delivered variants are drawn by coin flip at each rescue (**changed v1.9.12:** draw made when the rescue is prepared, at the start of the round, so that the announcement of a rescue round names the right variant; "RescueStarted" carries the same one):

| Encounter | Staging | Intervention |
| --- | --- | --- |
| Peaceful group harassed (delivered, « AGRESSION EN COURS ! » (ASSAULT IN PROGRESS!)) | Two to four rioters in round 1, three afterwards, threaten a person | Neutralise the aggressors; the victim says thanks (« MERCI ! » (THANKS!)) |
| Elderly person robbed (delivered, « VOL EN COURS ! » (THEFT IN PROGRESS!)) | An elderly person threatened, rioters nearby, personal belongings stolen (section 12.12) | Neutralise the aggressors; the victim says thanks, with no additional action |
| Female protester attacked; elderly couple (to do) | Victim in distress, intimidation or recoil animation; two civilians for the couple | Intervene before expiry then be taken care of |

**Added (v1.9.5, project owner's request):** in each rescue, the victim is gradually robbed of their belongings during the assault, and Paul can bring them back (section 12.12, "Stolen items to return"). Only ordinary personal items (bag, hat, cane, glasses, scarf, cap, backpack): never any worn clothing, undressing, nudity or anything degrading, neither in the sprites, nor in the texts, nor in the bubbles.

These encounters are fictional. The anecdotes cited by the user serve as narrative inspiration; the specification does not present them as verified historical facts. The gameplay requires neither the reproduction of a facial injury, nor nudity, nor a recipe or detailed simulation of an incendiary device. Violence is rendered through distress, recoil, calls for help and legible threat.

### 12.11 Triggering and fairness

The director chooses a reachable location, outside any obstacle and outside a group blocking a mandatory passage. The event does not appear under Paul's feet. Visual alert, direction, distance and deadline are available from the start, including off-screen: alert banner when it spawns (« AGRESSION EN COURS ! » or « VOL EN COURS ! ») then screen-edge indicator (section 14.1). As soon as Paul arrives, the victim shows a « À L’AIDE ! » (HELP!) bubble.

Delivered deadline: 25 s of effective threat for a rescue (`rescue.threatSeconds`; proposed range of twenty to thirty seconds). The minimum deadline must cover the practicable route, a reasonable confrontation and a reaction margin. The route is computed on the navigation, not through buildings: the rescue location is drawn among those 300–900 px of route from Paul (failing that, the nearest one beyond 300 px).

Delivered cap: one urgent incident at a time in rounds 1 and 2, then at most two, buildings, rescues and monument combined. Do not trigger two incidents that are impossible to reach in succession. Ordinary objectives with no deadline may stay active in parallel.

The director varies the types, locations and groups; it avoids immediately repeating the same scenario. The aggressors use the same forty-hostile cap as the hordes. The victims are taken from an existing group if possible; the number of additional characters remains bounded.

A rest window between encounters and a weighted selection suffice in V1. Random spawning is controlled: no need for full procedural generation or a scenario drawn without regard to the player's position.

### 12.12 Distress, rescue and local failure

Protection from Paul is permanent: his hits and his stones never hurt these victims. On the other hand, the designated aggressors can advance a **distress gauge / a rescue countdown**, only within the event concerned. Other passers-by do not suddenly become vulnerable to the whole crowd.

The threat within range is a continuous state during the intimidation or the assault cycle, not only the impact frame. The gauge and the displayed deadline represent a single authoritative reserve, with no second hidden health for the victim.

The deadline decreases as long as at least one aggressor of that event carries out a valid threat within range of the victim; it is suspended if that threat is interrupted. Do not remove a second independent life bar at the same rate: one source of truth per incident.

All the assigned aggressors KO'd before zero (hit or thrown-back stone, no matter which): threat stopped, deadline frozen, and the rescue ends **automatically**: no key, no hold, no distance to respect. The victim shows a « MERCI ! » bubble for about 1.5 seconds (parameter `rescue.thanksSec`), then the rescue is validated and the bonus granted only once, proposed at +6 per event, regardless of the number of victims. Pause also suspends this short delay.

Victim bubbles (pixel art, pixel font, above the head): « À L’AIDE ! » in red with a slight jerky bounce while threatened; « MERCI ! » in green once saved, until they walk away; no bubble in case of failure. Never an enemy marker on the victim.

**Stolen items to return (v1.9.5, project owner's request).** The victim carries three ordinary personal items: « sac à main » (handbag), « chapeau » (hat), « canne » (cane) (robbed elderly person) or « sac à dos » (backpack), « écharpe » (scarf), « casquette » (cap) (harassed group). When the distress reserve drops to 75%, 50% then 25% (`rescue.theftAt`), the active aggressor nearest to the victim takes the next item from them and carries it off (small pixel icon above its head); no theft without a standing aggressor at that moment, so aggressors neutralised before a threshold = item never stolen. A KO'd thief drops the item at the nearest free point (never inside an obstacle): the item floats on the ground with a slight halo. Paul picks it up by walking over it (20 px, `rescue.pickupRadius`, up to three, with no conflict with the weapon or the toolbox; « OBJETS N » (ITEMS N) line of the score list) then, at 48 px or less from the victim (`rescue.returnRadius`), hands back everything he is carrying at once: +2 per item (`rescue.itemBonus`, only once per item and per rescue) and « MERCI ! » bubble. No key.

Secured while a stolen item has not come back (on the ground or carried by Paul): the victim waits for their belongings for up to 12 s (`rescue.returnSec`; card « Rends les objets · 8 s » (Return the items · 8 s), screen-edge indicator toward the victim as long as an item is on the ground or carried), then the 1.5 s of « MERCI ! » and the +6 bonus once, as before; everything returned = the 1.5 s start immediately. Items not returned at the end of the wait are simply lost, with no penalty; items on the ground disappear when the rescue ends. Rescue missed: the items carried off, on the ground or carried are lost, nothing else changes. This wait is a timed objective ending: it adds no rioter and the round always closes at K = T. The rescue card shows « Objets 1/3 rendus » (Items 1/3 returned) (returned / victim's items) from the first theft. The aggressors of a rescue no longer leave the victim by themselves when few rioters remain (section 9.2, "Drawn to Paul"): only Paul approaching draws them away. Bubbles: « MON SAC ! » (MY BAG!) (« MON CHAPEAU ! », « MA CANNE ! », « MON SAC À DOS ! », « MON ÉCHARPE ! », « MA CASQUETTE ! ») about 2 s after a theft, and during the wait for the first missing item; « MERCI ! » at each handover. Pickup sound on taking, chime on handover. No new banner.

At zero before securing: rescue missed, bonus lost, session continued. The victim goes into a withdrawal state or is taken care of by the rescue services; no graphic death or nudity. The remaining aggressors become ordinary hostiles again. The failure does not increment the « Casseurs neutralisés » counter and does not reset Paul's health to zero.

A rescue does not reappear by entering/leaving a zone. A person already rescued is not immediately chosen again. The aggressors' KOs are counted only once, with the ordinary scale; the event bonus is separate.

### 12.13 Local deadlines and arcade mode

The building, distress, capture and interaction deadlines impose no total game duration. Their expiry affects only the incident concerned. Pause, help, cutscene and loss of focus suspend all deadlines and all hostile actions.

The reduction of graphics quality does not change these deadlines. A discovery mode may extend them explicitly with a separate record. The HUD reserves emergency numbers for active incidents, without bringing back a global "Time remaining" box.

### 12.14 New enemies and weapons of phase B (delivered)

Requirements from the slice 2 "Fun" design (sections 2, 4 and 5 of the [design](superpowers/specs/2026-10-20-slice-2-fun-design.md)); the enemies arrive progressively to break the "ever more rioters" pattern. **Delivered (v1.9.13):** runner, brute and « Le Caïd », with their damage rules; **delivered (v1.9.15):** cartoon AK-47 shooter and its bullets, flashball, spring boxing glove; the other already delivered elements of phase B (shield, energy gauge with the energy wave and fury mode — v1.9.14, they can no longer be picked up —, throwers aimed at Paul) are described in sections 8.8, 8.9 and 10.9. Phase B is entirely delivered. All these rioters are part of the round roster and replace filler slots without increasing it (+1 each on KO, whatever its variant, except the Caïd's own bonus); the cosmetic variants remain distributed in turn, never tied to a role.

| Enemy | From | Behaviour | Legibility | Status |
| --- | --- | --- | --- | --- |
| Runner (`runner`) | Round 3 | In melee, speed ×1.6, 1 HP. Each round, a **pack** of 4 + (round mod 3) runners (4 to 6) is taken from the filler: a group of its own (the second group when the rest makes at least two, otherwise the first), which enters tight (0.8 s interval), without a banner; stone throwers and throwers aimed at Paul are spread over the rest of the filler | Lighter hooded LPC silhouette (`rioter_runner_a/b`), fast walk, small puffs of dust | Delivered (v1.9.13) |
| Brute (`brute`) | Round 4 | In melee, speed ×0.75, 4 HP; a hit that lands pushes Paul back 28 px (movement blocked by obstacles, no extra damage). One per round, two from round 6, three from round 8 (cap), on "contact" slots of the filler | Sprite ×1.25, steel helmet, red health bar as soon as it is hit, deeper impact | Delivered (v1.9.13) |
| AK-47 shooter (cartoon, `shooter`) | Round 6 | Stands 220–300 px from Paul with a clear line (otherwise approaches, backs off if too close); aims for 0.8 s at the spot where Paul was at the start of the aim, then fires a burst of 3 bullets spaced 0.12 s apart **along that fixed line** (a moving Paul dodges it), reloads for 3 s; Paul within 100 px: it fights in melee; 3 HP (an ordinary weapon KOs it in one hit, three hits bare-handed). 1 shooter in rounds 6–7, 2 in rounds 8–9, 3 from round 10 (v1.9.24; 3 at most per round), on "contact" slots of the last filler group (the climax) | Dark pixel rifle drawn at runtime, raised along the line during the aim; thin red line of sight with a cross where Paul was (and screen-edge arrow if he is out of view); "!" above the head; small yellow puff at the muzzle; bullets as small yellow dashes; no blood, no shell casings | Delivered (v1.9.15) |
| « Le Caïd » (`boss`, mini-boss) | Round 3 | In melee, speed ×0.9. **Changed (v1.9.16, project owner's request: « pour les caïds, ils doivent être un peu plus résistants, là c’est un peu trop facile » — the caïds should be a bit tougher, it's a bit too easy):** HP that rise with the round, 14 + ⌊(round − 3) / 2⌋ × 2, capped at 26 (`caid.hp`, `hpStep`, `hpEvery`, `hpMax`: 14 in rounds 3–4, 16 in 5–6, … 26 from 15); damage taken depends on the source (`caid.damageFrom`, below); it hits harder: melee damage ×1.5 rounded (`damageMul`), Paul pushed back 52 px (`knockback`, 40 before), one hit every 0.85 × the rioters' interval (`attackIntervalMul`). It **closes every round** from round 3: last rioter of the last filler group (it counts in the roster; if the filler is empty, it is added as the last rioter and the roster increases by 1). KO: +1 like any rioter, **+5** once (`caid#<round>`, at its position) and, **changed (v1.9.16):** one time in two (seeded draw, `caid.dropShare`), an ordinary weapon drawn at random falls in its place (no indicator, disappears after 15 s; none if a weapon is already on the ground within 200 px of Paul). **Changed (v1.9.20):** a Caïd that is knocked out no longer disappears entirely: as long as the prison stands, a van takes it away and it is **locked up** (section 12.17, whatever the source of the KO, including the police or a guard); if the prison is in ruin, it simply stays KO as before. The destroyed prison frees them: they then come back as Caïds of the current round | Sprite ×1.5, golden crown, always-visible red health bar, **segmented (v1.9.16)**: one segment per 2 HP (13 at most) separated by a dark pixel, to read the progress; brief white flash and deeper impact on each hit taken; short banner without arrow « LE CAÏD ARRIVE ! » (THE CAÏD IS COMING!) / « Mets-le KO » (Knock him out) at its entry and screen-edge indicator « CAÏD » (crown) as long as it is standing, removed at its KO; prison van and « BOUCLÉ ! » (LOCKED UP!) (v1.9.20) | Delivered (v1.9.13) |

**Damage (v1.9.13, changed v1.9.16).** Bare-handed: 1 damage per hit. Ordinary weapon held (stick, hammer, road road sign, boxing glove, flashball): KO in one hit, except on a brute or the Caïd, who only take 2 damage (`toughWeaponDamage`: two hits for a brute). Fury mode and energy wave: immediate KO of all (damage 99), except the Caïd. Thrown-back stone: 1 damage. The shield bubble hurts no one (no more shield strike, v1.9.16). **The Caïd** takes its damage from the `caid.damageFrom` table: bare hands 1, held weapon hit, flashball shot or boxing glove hit 2, thrown-back stone 1, fury mode hit 5, energy wave 10, bubble 0; that is, in round 3 (14 HP), 14 bare-handed hits, 7 with the stick, 3 in fury mode, 2 waves. The brute's rules do not change. The `HitConfirmed` of a brute or the Caïd is marked "heavy" (deeper impact sound), and the `PlayerDamaged` of a hit that pushes back carries the displacement (`push`).

**Bullets (v1.9.15).** 260 px/s, 3 px radius, 1.6 s of flight at most; 8 damage to Paul through the normal damage path (invulnerability frames: a bullet arriving during them passes through him; fury mode: half); stopped by buildings, furniture, trunks, monument base (impact spark), by the peaceful group and the victim (without hurting them) and by the shield bubble from all sides (`ShieldBlocked`, the bullet disappears); they never hit a rioter; at most 30 in flight (a bullet beyond that is not fired).

**Weapons (v1.9.15, values from section 8.7)**: ordinary weapons (without a screen-edge indicator), with the damage rule above (2 on a brute or the Caïd, KO of the others). **Flashball** (« Flashball (6) »): shot aimed with the mouse, toward the facing direction on touch with slight aim assist, KO in one hit, stopped by walls, the peaceful group and the victim; one shot used per press, hit or not. On the entry of the **first shooter of the game** (round 6), a flashball is dropped 120–220 px from Paul (it does not disappear) with a short one-line banner « FLASHBALL AU SOL » (FLASHBALL ON THE GROUND) (arrow and distance, removed as soon as it is picked up). **Spring boxing glove** (« Gant de boxe (6) »): 160 px spring punch in a straight line, KO and 32 px knock-back of the first rioter hit (body thrown), bubble « BOING ! ». In fury mode, Strike remains the fury mode hit with these two weapons (nothing is used up). The "never any firearm" rule is lifted for these elements only, in cartoon style, without blood or gore (EX-07).

### 12.15 KO falls and hit effects of phase D (delivered, v1.9.17)

Requirements from section 6 of the [design](superpowers/specs/2026-10-20-slice-2-fun-design.md). **Delivered (v1.9.17):** KO falls by source, rare "WTF" falls, the domino effect, onomatopoeia by source, the shake, the impact freeze doubled on a "WTF" KO and the `prefers-reduced-motion` behaviour. **Already delivered before:** the whirlwind flight of fury mode KOs (section 8.8), the launch into orbit by the energy wave (section 8.9), the « POW ! » / « BOUM ! » bubbles of fury mode, the floating points (section 14.1) and three impact sound variants. **Still to do:** the slightly random sound pitch and the stun stars that precede the body's disappearance (a KO body stays lying down and faded).

**Fall by source (simulation, `src/sim/falls.ts`).** Each `ActorKnockedOut` carries a `fall` (`kind`, `wtf`, `dir`), chosen by the simulation on a **separate random stream** (`fallRand`, seed `seed ^ 0x9e3779b1`): three draws at each KO ("WTF" roll, subtype, variant), whatever the branch, so that the stream stays aligned. The source of the KO is given by the caller of the hit: bare hands, held weapon, thrown-back stone, fury mode, wave, flashball, boxing glove or falling body (domino). `dir` is the direction of the throw if there is one, otherwise the direction that moves the body away from Paul (that of the hit for a domino victim).

| Source | Fall | Rendering |
| --- | --- | --- |
| Bare hands | `crumple` or `spin` (variant, one chance in two) | standing slump (squash) then lying pose; or a turn on itself on the ground |
| Road sign, stick | `flyspin` | jump of about 70 px along `dir`, one and a half turns, dust on landing |
| Hammer | `pancake` | flattened (×1.5, ×0.15) 500 ms then straightening up with a rebound and a small jump, « SPLOTCH » |
| Boxing glove | `bounce` | the existing flight of the throw, with « BOING ! » on landing |
| Flashball | `backflip` | 40 px backward arc with a full turn |
| Thrown-back stone | `wobble` | three damped oscillations standing then tipping over to 90° |
| Fury mode, wave | `flyspin` (unchanged: the flight of the throw, sections 8.8 and 8.9, is still played) | existing flight and launch into orbit |
| Caïd | always `crumple` | slump, stronger shake; its possible throw (fury, wave) is still played |

**Rare "WTF" falls (`CONFIG.falls.wtfChance` = 0.1).** One KO in ten, never the Caïd, never a thrown body (fury, wave, boxing glove), never a domino victim. Subtype uniform among five: `tripleflip` (three somersaults, 60 px arc, 60 px run), `helicopter` (rises 60 px vertically while spinning five times, then falls back), `faceplant` (small jump then slide flat on the stomach of about 90 px with a dust trail), `trashcan` (dives head first into a trash can whose legs stick out for about 1.5 s, then the can fades away and the body stays beside it; with no free can in the pool of 3, the body simply lies down) and `domino`.

**Domino effect (the only simulation effect).** The `domino` body flies 80 px with two turns. At the moment of its KO, the simulation emits `DominoTriggered` (`from`, `lifeIds`) then knocks down up to `CONFIG.falls.dominoMax` = 2 living non-boss rioters within `CONFIG.falls.dominoRadius` = 56 px of the body, nearest first (tie: smallest `lifeId`). Each victim is a real KO (source "knocked", fall `knocked`: standing 150 ms then tipping over along `dir`), counted +1 and filling the energy gauge (except in fury mode). **No chain**: a victim does not trigger another domino. **Never the Caïd**. With no neighbour in range, the domino becomes a `faceplant`. The victims do not emit `HitConfirmed`. « DOMINO ×N ! » bubble (large).

**Onomatopoeia.** A pixel bubble at each hit, depending on the source: « POW ! » / « PAF ! » (bare hands), « BONK ! » / « TCHAC ! » (stick), « SPLOTCH ! » / « SPLATCH ! » (hammer), « BOING ! » / « BOÏNG ! » (boxing glove), « PIOU ! » / « PIOU PIOU ! » (flashball), « TOC ! » / « BLONK ! » (stone), drawn in the rendering alone (`Math.random`). On a hit that causes a KO in the same batch, the KO's word replaces the hit's; the wave and the boxing glove say nothing on the hit (the ray with its effect, the boxing glove's hit already says « BOING ! »). The WTF falls show « WTF !? », « OUPS ! », « WOUAAH ! » or « NOOON ! » in a large bubble (×1.5, longer duration).

**Screen shake.** Bare hands: 1 px for 80 ms; weapon, stone or flashball: 2 px for 110 ms; "WTF" KO, Caïd KO or domino: 4 px for 240 ms. A weaker shake never cuts off a stronger one.

**Impact freeze.** 60 ms at each hit; **doubled (120 ms) on a "WTF" KO**. The fall starts at the end of the freeze.

**Reduced motion (`prefers-reduced-motion`).** No shake; all freezes halved (30 ms, 60 ms on a "WTF" KO); falls at 0.6 of their duration, with no turn, jump or oscillation; the run, the pancake and the trash can remain.

**Cost and caps.** The falls are **cosmetic**, except the domino (section 18.3): they change neither health, nor the body's own score, nor the AI. At most **8 animated bodies** at a time (`MAX_FALLS`): beyond that, the body stays lying down without animation. At most 3 trash cans in the pool, 10 word bubbles. The run of a fall is limited to free ground (never into a wall or off the map). The pose computation (`src/game/render/fallMath.ts`) is pure and makes no allocation per frame.


### 12.16 Emergency services: booths, fire truck and police (delivered, v1.9.19)

Design: [emergency services](superpowers/specs/2026-10-22-emergency-services-design.md), validated by the project owner (« très bien, go pour ça » — very good, go for it — for the firefighters; « 3 de chaque » — 3 of each — for the uses). Reference values in `CONFIG.services` (`src/sim/config.ts`); call logic in `src/sim/services.ts`, allies in `src/sim/allies.ts`, rendering computations in `src/game/render/serviceMath.ts`. Points marked *(Claude's choice)* are proposals that the owner did not contradict. Anti-goals: no rescue that settles everything (limited calls), no invincible truck or police officer, no hold rule, no blood or realistic violence (cartoon baton), no real person.

**Booths.** Two booths side by side: the **red** one at R(4,22) calls the firefighters, the **blue** one at R(5,22) calls the police, on the open square in the centre-west, present from round 1 and usable on foot. *(location: Claude's choice)* They are targets like a prop ("attacked like the other constructions"): 60 HP, attack points, fire, ruin, repair, points saved / lost / repaired +4 / −2 / +3 *(values: Claude's choice)*. Before round 3 they are neither attacked nor on fire; they enter the headline incident draw and the second emergency draw from round 3, and count as places for the two-emergency rule from round 5. A booth in ruin can no longer be used (« Cabine hors service » (Booth out of service)); calls already spent are not refunded and, once repaired, the booth becomes usable again with the calls it had left.

**Calls.** 3 firefighter calls and 3 police calls per game. Paul standing within 40 px of the door presses Act once (F, « Appeler » (Call) button on phone); no hold. When several actions are possible, the nearest wins; on a tie, repair > red booth > blue booth; if the booth wins, the toolbox does not receive the press. A repair counts against a booth only if it could start (without a toolbox, a red booth on fire calls the firefighters). Refusals, in this order, without spending anything: « Cabine hors service », « Plus d’appels » (No more calls), « Déjà en route » (Already on the way) (a truck or a police group of the same type is still on the map), « Aucun feu à éteindre » (No fire to put out) (firefighters: no place is burning, booths included), « Pas assez de casseurs » (Not enough rioters) (police: fewer than 8 active rioters, entry queue not counted). An accepted call counts immediately, even if the truck is destroyed afterwards. A blinking "!" appears on the booth when the call would be accepted.

**Fire truck.** It arrives through a rioter entry point drawn on its own random stream; it follows the rioters' street graph at a different speed, without blocking anyone (rioters can hit it in melee). It drives to the nearest burning place by path, parks and fires its hose: **all fires within 80 px are put out together** (two booths side by side in a single parking), 2 s per fire. It chains fires as long as any remain, then leaves by the nearest edge; at most 60 s on the map. **It only puts out fires** and never repairs a place in ruin; putting out earns the same "saved" points as Paul (only once per fire), and the place **keeps the HP it has left** (no reset to 100%, unlike the toolbox). 60 HP: attacked by nearby rioters, it disappears in smoke at 0 HP and the call is lost. *(80 px, 60 s, 60 HP: Claude's choice)*

**Police.** 5 police officers of 1 HP arrive from an edge, siren on, run at the rioters and knock them out with the baton (+1 each, no energy). They stay 40 s then leave; a knocked-out officer is lost, and the group leaves as soon as all are lost. Once the group has left the map, the police can be called again if calls remain. *(40 s, fragility: Claude's choice)*

**Targeting and confrontations.** 160 px radius for the choice between Paul, the truck and a police officer; priority to a rioter's place objective (RC-145). The rioters therefore fight the police by themselves.

**Texts and signals.** Alert « CABINE SACCAGÉE ! » (BOOTH WRECKED!) (section 14.1), round subtitle « Cabine menacée » (Booth threatened), HUD cards « Cabine rouge » (Red booth) / « Cabine bleue » (Blue booth); prompts « F — Appeler les pompiers » (F — Call the fire brigade) / « F — Appeler la police » (F — Call the police); booth lines « Pompiers en route ! » (Firefighters on the way!), « Police en route ! » (Police on the way!) and the refusals above; sirens (section 16).

**Balance.** The booths change the draw from round 3: existing seeds may give other games and the draw tests have been rewritten. Existing caps (40 active hostiles) unchanged; truck and police officers are allies outside that cap.

### 12.17 Prison: locked-up Caïds, guards and breakout (delivered, v1.9.20; visible inmates, v1.9.22)

Design: [prison](superpowers/specs/2026-10-22-prison-design.md), validated by the project owner (« c’est parfait » — it's perfect). Reference values in `CONFIG.prison` and `CONFIG.casse` (`src/sim/config.ts`); logic in `src/sim/prison.ts` (cells, breakout, guards), `src/sim/allies.ts` (`guard` role) and `src/sim/director.ts` (`extend`); rendering computations in `src/game/render/prisonMath.ts`. Points marked *(Claude's choice)* are proposals that the owner did not contradict. Anti-goals: indestructible or too-easily-lost prison, guards that block the game, no real person nor reference to an individual.

**Why.** The Caïd was a mini-boss that disappeared after its KO. The prison gives a sequel to that KO (captured Caïds are kept) and a stake: if it falls, all the locked-up Caïds come back at once.

**Building.** The prison is building 11, in the south-east, R(38,36,6,6), the only free block on that side of the map, reachable on foot from Paul's spawn point and from each rioter entry. Door at C(41,42) on street row 42, attack points at C(39|40|42|43, 42). *(location: Claude's choice)* It is a building, not a prop, at **400 HP** (`CONFIG.prison.hp`, four times a building). Attack, fire, ruin, repair like a large building (Molotov, degraders, section 10); points saved / lost / repaired **+8 / −3 / +5** (`CONFIG.casse.scores.prison`). It enters the headline incident draw **from round 4** (`CONFIG.casse.fromRound.prison` = 4, `CONFIG.prison.fromRound`) and the second emergency from round 4; it counts for the two-emergency rule from round 5 on (section 12.2). At the end of each round, an intact prison regains its 400 HP like any intact place.

**Imprisonment.** A Caïd knocked out **while the prison stands** is locked up (`CaidJailed`, `lifeId`): only once per life, **whatever the source of the KO** (Paul, the blue booth's police, a guard). The Caïd's +1 and +5 are unchanged (section 13). No new scoring rule. If the prison is in ruin at the time of the KO, the Caïd is simply KO as before and is **not** locked up. The prison counts the locked-up Caïds (`Snapshot.prison.jailed`) and keeps **the identity of each one** (`Snapshot.prison.inmates`, in order of entry: stable `id` never reused in the game, `variant` = its appearance on the map, classic / Palestinian / antifa, `round` = round in which it was locked up; `jailed` is always the number of inmates) *(v1.9.22)*; it is empty at the start and after a rebuild. **The van takes the body away** *(v1.9.22)*: the KO body of a locked-up Caïd leaves the map `CONFIG.prison.pickupSec` = 1.6 s after its KO (it leaves the hostiles list), even if the prison falls in the meantime; a Caïd KO'd while the prison is in ruin stays on the ground as before.

**Breakout.** On the step when the prison ceases to stand (0 HP, by fire, bottle or rioters), **all** the locked-up Caïds come out **at the same time** in front of the door, spread over two rows 12 px apart (`PrisonBreakout`, `count`, `pos`), and aim at Paul. Each has the HP of a Caïd of the current round, the `boss` role and **the same appearance (`variant`) as at the time of its KO**. They are added to the round's roster T by `Director.extend(n)` (`RoundTotalChanged`; K stays ≤ T and each freed Caïd must be KO'd again, with the scale of the earlier KO: +1, and the +5 according to its `caid#<round>` key); during the breather, they are labelled with the next round and counted in its T when it starts. They join the round's rioter list (not the filler). A Caïd that the cap of 40 hostiles refuses comes out on a later step (it is already counted in T). **If nobody is locked up, the fall of the prison frees nothing** (neither a `PrisonBreakout` event, nor a change in T).

**Guards.** 5 guards (`CONFIG.prison.guards`), allies of role `guard`, posted at the five points of `PRISON_POSTS` around the block, each within 160 px of the door: C(37,40), C(38,43), C(41,43), C(44,43), C(44,40). They do **nothing else** than defend the prison: they only target rioters within 160 px of their post (`postRadius`) and never move away from that circle. Life = that of a Caïd of the current round (`guardHp(round)` = max(14, Caïd HP), that is 14 in rounds 1 to 4, 16 in 5–6, … 26 at most), hence "the same health bar as the Caïds". **Bare-handed: 1 HP per hit** (`damageFrom.hands` of the Caïd), and not with the police baton. *Reason (Claude's choice, measured):* with the baton, which knocks out an ordinary rioter in one hit, the guards made the prison untouchable in the test robot's games (seeds 1 to 6, rounds 4 to 11: never on fire, 399 HP at the lowest, no guard KO'd, all attacks saved), which contradicts the "indestructible prison" anti-goal; bare-handed, the same trial gives saved attacks, smouldering fires and 2 games out of 9 where the prison falls. A guard that is knocked out (`GuardDown`, `id`) is carried away after the usual delay. **At the breather** (end of each round, `onBreather`), if the prison stands, any missing or KO'd guard returns to its post (`GuardsBack`) and each guard receives the HP of the next round; a prison in ruin recalls none, and those still standing stay at their post (they return at the next breather after rebuilding). They are distinct from the blue booth's police (which stays at 1 HP, baton, and outside the prison), present from round 1 (the first attack on the prison is in round 4, but the first Caïd falls in round 3), and **outside the cap of 40 hostiles**.

**Rebuilding.** The toolbox rebuilds the prison like any building but **sets it back to 60% of its HP** (`CONFIG.prison.repairShare` = 0.6, that is 240 HP); the other places are still reset to 100%. *(60%: Claude's choice, from the design; specific to the prison.)* The freed Caïds **stay free**; the rebuilt prison is empty and locks up a Caïd knocked out afterwards again.

**Rendering and HUD.** Grey concrete facade with barred windows, steel door, barbed wire, watchtower with a searchlight sweeping the street (still with the reduced-motion preference) and flag, « PRISON » sign on the roof; ruined variant (watchtower reduced to a stump, door torn off, bars twisted). Counter « Caïds enfermés : N » (Locked-up Caïds: N) on the roof (it only appears while the prison stands and swells when N goes up). **Prison van** on `CaidJailed`: it stops near the body, where it is drawn (after its fall or its flight in fury mode), 600 ms after the KO; **the body is loaded**: the lying sprite disappears from the street when the Caïd jumps into the van (with its crown), and it is never drawn on the ground again (the simulator removes it shortly after, 1.6 s after the KO) *(v1.9.22; before, the body stayed on the ground and only the crown jumped)*. The van then goes to the door and drops it off with « BOUCLÉ ! »; the counter only counts it once it has entered (a Caïd on its way hides only one, and not two as before v1.9.22). Vans in progress are cancelled if the prison falls (the body is then removed too). **Visible inmates** *(v1.9.22, project owner's request)*: an exercise yard in the middle of the roof (`YARD`, `src/game/render/prisonMath.ts`), concrete floor and back wall, where the inmates stand facing the camera, with a slight sway and an occasional sideways glance (still with the reduced-motion preference): sprite of the Caïd of its variant at scale 1 and its crown, **up to 8** on two rows of 4 (centred), « +N » to the right of the yard beyond that; dark bars in front of them show that they are locked up; the yard and the inmates fade with the roof when Paul walks under it. A Caïd only appears there once dropped off at the door. At the breakout, the yard's inmates run to the door in 0.5 s (the real freed Caïds appear there), the yard stays empty, darkened, bars torn out in the middle and twisted, until rebuilding. **Entry point of future skins:** `inmateTextureKey(inmate)` (`prisonMath.ts`) gives each inmate's sheet (today that of the Caïd of its variant); it is the only place to change for skins specific to locked-up Caïds. Guards in grey uniform, burgundy beret, bare-handed (fist raised on hit), with a green segmented health bar of one segment per 2 HP (always visible while they are standing). On `PrisonBreakout`: dust, steel splinters, big screen shake, banner « ÉVASION ! » (BREAKOUT!) (subtitle « N Caïds libérés » (N Caïds freed), arrow and distance to the door, 3.6 s); each freed Caïd has its crown, its bar and its screen-edge indicator « CAÏD » (no « LE CAÏD ARRIVE ! » banner per Caïd). Attack alert « PRISON ATTAQUÉE ! » (PRISON UNDER ATTACK!) (section 14.1), round subtitle « Prison menacée » (Prison threatened), HUD card « Prison » with the line « Caïds enfermés : N » as long as N > 0. Police siren on the van, heavy thud and alarm at the breakout (section 16).

**Balance.** The prison changes the draw from round 4 (existing seeds give other games, draw tests rewritten); the guards are always on the map (measured cost about 0.25 ms per step, section 19.2).

## 13. Score, « Casseurs neutralisés » counter and summary

### 13.1 Reference scale

| Event | Points | Status |
| --- | ---: | --- |
| Rioter KO, whatever its variant or flag | +1 | Confirmed (revision 1.5), delivered |
| Valid hit on a police officer | −3 | Initial request; not applicable as long as no hittable NPC exists |
| Valid hit on another protected person outside the peaceful group | −2 | Legacy kept if these NPCs are hittable; not applicable today |
| Attempted hit or throw-back toward the peaceful group | 0; no damage contact accepted | Protection confirmed in revision 1.2, delivered |
| School saved (all its rioters KO without fire) | +8 per occurrence | Delivered |
| School destroyed | −3 once per occurrence, without ending the session | Delivered |
| Retro games shop saved / destroyed | +6 / −2 per occurrence | Delivered (v1.9.4) |
| Car or bus shelter saved / destroyed | +4 / −2 per occurrence | Delivered (v1.9) |
| Repair of a ruin or putting out a fire by toolbox | +5 school, +4 shop, +3 car or bus shelter; once per ruin or per fire, without the rescue bonus of the same occurrence | Delivered (v1.9.1) |
| Rescue succeeded | +6 per event, only once | Delivered |
| Stolen item returned to the victim | +2 per item, once per item and per rescue | Delivered (v1.9.5) |
| Rescue missed | No bonus; no global defeat | Delivered |
| Monument defended (all occupants KO before the replacement) | +4 per occurrence | Delivered (v1.9.4) |
| Monument flag replaced | −3 once per occurrence | Delivered (v1.9.4) |
| Monument flag recaptured (capture) | +10 per replacement | Delivered (v1.9.4) |
| Shop cleared then reopened (shutter) | +4 then +5 per occurrence | Initial brief, not delivered (section 23.1) |
| Round whose objectives are all succeeded (a place still burning but standing counts as succeeded) | +5 once at its closing | Delivered (v1.9) |
| « Le Caïd » knocked out | +5 on top of the +1, once per round (key `caid#<round>`); unchanged when it is locked up (v1.9.20): no more or fewer points for imprisonment, nor for the breakout | Delivered (v1.9.13) |
| Projected healing or training course | 0 | Proposal to avoid profitable waiting |
| Non-terminal hit on a rioter | 0 | Gain at KO only |

No bonus depends on remaining time. There is no finite maximum score for the whole arcade session. The previous reference of 51 points and the counter limited to 17 rioters are removed.

The roster of each round follows the progression proposed in section 12.2 (10, 14, 18, 22, then +4 per round), excluding additional patrols. The round bonus requires succeeding at its objectives; it does not trigger on the mere change of number after a lost objective. The endless chaining of rounds prevents deducing a limit on score or KOs.

### 13.2 « Casseurs neutralisés » counter

`Casseurs neutralisés = number of unique rioter identifiers that went from active to KO since the session was launched.`

Each variant adds 1, as in the score. A body already KO, a peaceful group, a victim, a healing, a toolbox, a repair, a rescue, a capture, a pickup or a training course never increments it. Bare hands, weapon and throw-back share the same KO event, so never two units for the same rioter. The counter does not reset at each round.

**Confirmed (revision 1.5):** the counter is neutral; it mentions neither nationality, nor administrative status, nor sanction.

### 13.3 Summary

Score, compatible record, cause of ending, round reached, neutralised rioters, weapons picked up and broken, buildings saved/destroyed/repaired, rescues succeeded/missed, objectives succeeded/lost, KOs, targeting errors, training courses, healing and toolboxes used. Optional elapsed survival duration, without a countdown during a mission.

Delivered summary (« Résumé de la partie » (Game summary), **changed v1.9.12**): cause (« KO » or « Session interrompue volontairement »), score, record, round reached, perfect rounds, neutralised rioters, places saved / destroyed, places repaired, **school in session counts** (« 2 sauvées · 1 perdue » (2 saved · 1 lost); « — » if no school attack is settled), **rescues in counts** (« 3 réussis · 1 raté » (3 succeeded · 1 missed); « — »), items returned, monument defences, flags lost, flags recaptured, healings used, stones picked up / thrown back / hit, active duration, and « Nouveau record ! » (New record!) (singular for 0 and 1). To do: weapons picked up and broken.

The summary shows a neutral line, delivered in the form « Casseurs neutralisés : X » (Rioters neutralised: X):

> X rioters neutralised

X equals the counter of section 13.2. The former satirical summary lines are removed (revision 1.5).

A voluntary stop produces an identified partial summary. A proposal for a final survival record is only validated at KO; a better provisional score from a stopped session may be kept separately, without being confused with a session ended by defeat.

### 13.4 Records

Records by rules version and difficulty; score as the main ranking, then round reached and possibly active duration as a tiebreaker. A longer duration brings no direct points and must not encourage motionless waiting. The statistics of projectiles recovered, thrown back and having hit may appear in the summary, with no point gain for a mere pickup.

Discovery mode and the settings that change healing or pressure use a distinct category. The record is local and editable in the browser storage; no secure global ranking is promised.

Deduplicate the score by event identifiers and objective occurrence identifiers. A model or agent-pool recycle assigns a new life identifier, without wrongly reusing the identity of the previous rioter.
