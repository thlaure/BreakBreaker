# Changelog

BreakBreaker release notes, newest first. This is the English edition of `CHANGELOG.md` (the French one is the reference): same versions, same dates, same number of points.
It is read at build time and feeds the "What’s new" block and the "Changelog" window of the English landing page (`/en/`).

Format: one `## <version> - <date YYYY-MM-DD>` heading per version, then short `- ` bullets, most important first.
The first three bullets of the latest version are shown on the landing page.

## 1.5.9 - 2026-10-24

- A small cleanup after the smoothness fixes: the frozen decor images are released at each new game instead of piling up in memory.

## 1.5.8 - 2026-10-24

- The game is much smoother: your measurements showed that switching off any one of the "graphics", "shapes" or "tiles" layers brought it back to almost 60 frames per second. Those three object types were breaking the browser's draw batching. Walls, roofs, rectangles and shadows are now images, and fixed decor is frozen once: from 173 down to 60 draw calls per frame in my test.

## 1.5.7 - 2026-10-24

- The `?perf` meter now also measures the graphics card's time (in browsers that allow it) and accepts `&off=hud,graphics,shapes,particles,texts,images,tiles` to switch one layer off at a time and find what costs time on a given machine.
- The prison's « ringleaders locked up » text is no longer redrawn every frame (a small image was being sent to the graphics card 60 times a second for nothing).

## 1.5.6 - 2026-10-24

- The Halloween pumpkin heads are real heads: the rioter's or ringleader's head is replaced by a pumpkin that moves with his body (from behind it has no face), instead of a mask on top.
- The game is a little lighter: the shadows of objects, rocks and decor use images instead of shapes redrawn every frame.
- The `?perf` meter also shows the game's own work time, the number of objects and the screen size, to better pin down where a lack of smoothness comes from.

## 1.5.5 - 2026-10-24

- New measuring tool: adding `?perf` to the game address shows a small meter at the bottom left (frames per second, frame times, hitching frames, and the delay between a key press and the frame that applies it). It helps find where a feeling of lag comes from. Without `?perf`, nothing changes.

## 1.5.4 - 2026-10-24

- The game runs smoother: the building fronts, which never change, were redrawn rectangle by rectangle on every frame (close to 20,000 drawing commands per frame). They are now frozen into images once, which takes a lot of work off the browser and shortens the delay between a key press and the action.

## 1.5.3 - 2026-10-24

- During Halloween, some rioters and some ringleaders (about one in four, one in three for the ringleaders) have a jack-o'-lantern head, smiling, grimacing or surprised, which makes them easy to spot.
- Zombies no longer carry their camp's flag: some wave a black skull flag instead, like a pirate flag.

## 1.5.2 - 2026-10-24

- The Halloween zombies are characters in their own right, no longer simple skins: green skin, glowing yellow eyes, torn clothes, flashy hair or a hood.
- New spellcaster zombies: hooded, robed zombies who throw green magic orbs instead of rocks. It is purely visual, nothing changes in the rules.
- These images are only downloaded during the event; the rest of the year the game loads nothing extra.

## 1.5.1 - 2026-10-24

- The landing page also dresses up for Halloween: a new night illustration (zombies, pumpkins, ghosts, bats, pennants) replaces the background during the event, with orange and violet colors.

## 1.5.0 - 2026-10-24

- Halloween is here, from 24 October to 2 November: about one rioter in two turns into a goofy zombie (grey-green skin, blue, pink, violet, turquoise or yellow hair, some with a road cone or a bucket on the head). Nothing changes in the game: same rules, same scores.
- The map dresses up for the occasion: pennant garlands on the front walls, grinning pumpkins in front of the buildings, little floating ghosts and circling bats (still with reduced motion).
- The theme switches itself on and off by date, every year. To force or cut it, add `?event=halloween` or `?event=none` to the game address.

## 1.4.5 - 2026-10-24

- The sauna is now a glazed three-seat cabin: its three guests are real characters, drawn with the same parts as the people walking around the map, told apart by accessories only (cap and long tie, judo belt, felt hat).

## 1.4.4 - 2026-10-24

- The game uses far less power while paused (pause menu, controls, instructions card, end screen): the frozen scene is only redrawn at a low rate, saving CPU, GPU and battery.

## 1.4.3 - 2026-10-24

- The game loads faster: the images weigh six times less (1.8 MB to 0.3 MB), with no visible difference.
- The game engine lives in a separate file that the browser keeps in its cache, so future updates download much faster.

## 1.4.2 - 2026-10-24

- The old /jouer/ address is gone: the game lives only at /play/.

## 1.4.1 - 2026-10-24

- The changelog on the landing page now follows the language: the /en/ page shows the English notes.

## 1.4.0 - 2026-10-24

- A rock stage in the north-east of the map: a band of five skeletons in rock gear, colored spotlights and a singer who shouts fed-up one-liners, in both languages.
- Original music that swells as you walk up to the stage and fades as you leave; it follows the Sound button, the pause and the end of the game.
- The emergency booths (fire and police) move to the edge of the main square, next to the town hall: you call them as before, but right in the middle of the action.
- With reduced motion, the skeletons stand still and the spotlights stop flashing.

## 1.3.0 - 2026-10-23

- The game is available in American English: two small flags (French, American) at the top left of the landing page, lined up with the first "B", and in the pause menu.
- The one-liners are adapted for English (the President, the ringleaders, the crowd), not translated word for word.
- Your language is remembered, and you can switch in the middle of a game without losing anything.
- Two landing pages: / in French and /en/ in English.

## 1.2.1 - 2026-10-23

- When Paul is hit while repairing (blow, stone, shot, fire), the repair stops, but he keeps his toolbox.

## 1.2.0 - 2026-10-23

- The ringleaders have style: five leader looks (the tribune, the march leader, the comrade in a suit, the old hand, the young agitator).
- Each has a prop (megaphone, banner, "COMMITTEE" briefcase, whistle, poster roll) and slogans in a speech bubble.
- A ringleader keeps his look all the way into the prison yard.

## 1.1.4 - 2026-10-23

- The sauna: the third silhouette wears a dark turban and a grey beard.

## 1.1.3 - 2026-10-23

- Mobile: speech bubbles (protesters, the President) are no longer cut off at the screen edge.

## 1.1.2 - 2026-10-23

- The sauna: the three silhouettes in the steam each have their own props (cap and long tie, judo belt and cane, glasses and pennant).

## 1.1.1 - 2026-10-23

- Rounds 1 to 9 rebalanced: difficulty climbs more steadily, rounds 5 to 9 are less crowded.
- From round 5 on, no third place is attacked mid-round: the two attacks at the start are enough.
- Brutes and shooters arrive one at a time: the second brute in round 7, the second shooter in round 9.

## 1.1.0 - 2026-10-23

- A big square in the heart of the neighborhood: the church, the town hall and the castle surround it.
- The church is a new place to defend (fire, ruin, repair), from round 3.
- The President's castle: an invented President fidgets on the balcony and throws out offbeat one-liners.
- Three groups of peaceful protesters on the square.
- A mysterious sauna with three silhouettes in the steam.
- The town hall moves; so do the bus stop and a few buildings.

## 1.0.2 - 2026-10-23

- The game's address becomes /play/ (the old /jouer/ address redirects).
- The "Retro Games" shop becomes "Micro Retro".
- Shorter welcome line: "Defend the neighborhood as long as you can."

## 1.0.1 - 2026-10-23

- Mobile display: smaller stats, alerts, banners and edge indicators; pause menu on two columns in landscape.
- The "Tasty Crousty" storefront becomes "Poulet Crousti".
- New: this changelog, visible on the landing page.

## 1.0.0 - 2026-10-22

- First public version: defend the neighborhood with Paul, help passers-by and send projectiles back.
- Prison: knocked-out ringleaders are locked up there; if it falls, they escape. Five guards defend it and it rebuilds itself.
- Emergency services: red and blue booths to call a fire truck or the police (3 calls of each).
- New places to defend: nursery, kiosk, town hall and library; healing in the field.
- Energy wave on a single press and a longer fury mode (18 s).
- KO drops depending on the weapon, with rare WTF drops, onomatopoeia, screen shakes and freeze frames.
- More visible alerts, an "F" action prompt and repair guidance.
- Decor fronts: CAF and Poulet Crousti.
- Records start over with version 1.0.0.
