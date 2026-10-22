# BreakBreaker — Specifications: Art Direction and Sound

> **Purpose of this file:** art direction, pixel art assets, animations and sound.  
> Part of the BreakBreaker specifications (version 1.9.25), split into several files. Back to the [specifications index](SPECS%20-%20Index.md) (overall table of contents, version history, conventions, file map).

## 15. Art direction and pixel art assets

### 15.1 Style

Hand-drawn pixel art, a consistent palette and sprites at the same scale. Orthogonal top-down view, no isometry. Paul keeps his long hair, black rectangular glasses (v1.9.10) and black outfit; the white scarf or bib and a contrasting outline set him apart from the ground and the crowd.

Paris is evoked by the cobblestones, signs, facades, shopfronts, school and monument. Silhouettes and signs must remain understandable at game size. Flags are readable without enlarging all the opponents.

### 15.2 Chosen templates

| Element | Template |
| --- | --- |
| Ground tile | 32 × 32 logical pixels (Kenney / LPC CC0 tiles) |
| Paul and common characters | 64 × 64 cells from the Universal LPC spritesheets, visible silhouette of about 32 × 48, anchored at the feet |
| Large contact animations | Wider cell if needed, separate hitbox |
| Flag | Separate prop, readable and not flipped with mirrored text |
| Pebble / cobblestone / brick | About 8 to 16 pixels, visible outline |
| Weapon on the ground | Readable sprite with halo, floating and oscillation |
| Internal landscape view | Base of 640 × 360 logical pixels |
| Internal portrait view | Base of 360 × 640 logical pixels, no stretching |

Chosen scaling: Phaser's RESIZE mode (the canvas fills the window) and an integer camera zoom, computed from the landscape or portrait base, minimum 1. Pixels stay sharp; margins or a wider visible field are accepted rather than distortion.

### 15.3 Assets

One set of Paul sprites; weapons on the ground and outfits (stick, hammer, road sign); individual victims and the elderly couple; toolbox on the ground and carried; personal rescue items; three rioter variants with contact/thrower roles; demonstrators in a group with placards; students and rescue workers; ground and building tiles; school with several states; monument and flags; shop; healing stations; stones in flight and on the ground; icons.

Peaceful groups must read as a calm whole. Avoid giving neutral sprites the same charge or throw animations as the hostile ones.

Sources chosen for the first slice: Universal LPC characters, Kenney and LPC tiles under CC0, Kenney sounds under CC0. Each author and licence is listed in `public/CREDITS.md`, reachable from the landing page and the Pause menu.

### 15.4 Animations

At minimum: idle, movement, circular strike, rotation of the held weapon on each hit, floating and halo of weapons on the ground, floating and pulsing of charged kits, reaction, KO, brief pickup or pickup indication, throw-back, healing, enemy throw, degradation, flag carrying, calm demonstration, call for help, victim recoil, help/reassurance, repair, students walking, fire, ruin, repair and flag change. No nudity or graphic burn animation is needed.

At least four drawn directions; eight logical movement directions. Drawing eight directions is an improvement, not a prerequisite for the first prototype. Contact effects do not replace a readable hero animation.

**KO falls (v1.9.17).** Thirteen fall types (`crumple`, `spin`, `flyspin`, `pancake`, `bounce`, `backflip`, `wobble`, `tripleflip`, `helicopter`, `faceplant`, `trashcan`, `domino`, `knocked`) played by transforming the existing KO sprite (pivot, squash, rotation, height), with no new sheet; the trash can is a texture created at runtime (12×14, ×2). Details in section 12.15.

### 15.5 Preparation

Editable sources for sprites and map; PNG exports with transparency; texture atlases and animation data; map as JSON of tiles and objects; validation of anchors, collisions and frames. No GLB model pipeline or 3D skeleton in this version.

Register of authors, licences, attributions, sources and modifications (`public/CREDITS.md`). Prototype assets must not be mere coloured squares presented as a final pixel art direction. Artistic creation or adaptation is still required.

## 16. Sound

The first relevant click, touch or keyboard gesture authorises audio initialisation. Sound can be turned off from the landing page and the pause menu. An audio failure does not block the game.

Provide separate volume groups: ambience, effects, optional music, voice. Music is optional; combat readability comes first. Nearby sounds are spatialised with moderation and the number of simultaneous voices is capped.

The first slice's sounds come from Kenney (CC0). Footsteps follow the movement rhythm; impacts match the contact; alarms or crackling indicate the presence of fire. Repeated hits use several variants to avoid a mechanical effect. **Added (v1.9.24):** every impact sound (the `hit1`–`hit3` blows, « hurt », the dull `land` thuds, and the WebAudio « tock », « pop », « thump », « boing », « clank » sounds) is played with a slightly random pitch, ±6% (`PITCH_JITTER`, on the playback rate or the frequencies), drawn on the render side only (`Math.random`, never the simulator's draw) and only when the voice actually plays (nothing without audio or in mute mode); sirens, alarm, chimes, and the hums of fury mode and of charging keep their exact pitch.

Sound cues of slice 2 (phase A): alarm once per attack, when the place catches fire (v1.9.1), and once per rescue, a brief whoosh on each Molotov throw (at a place or, v1.9.4, at Paul), crackling of the fire that follows the most affected place as long as a place is attacked or burning, a brief two-note chime when a place is saved, extinguished or repaired and at the end of a round (only one per frame), a pickup sound for the toolbox. **Added (v1.9.11, aligned with the game):** alarm also at the start of a monument occupation; chime when the monument is defended, when the flag is retaken and for each returned item; a drop sound when the flag is replaced and when a weapon breaks; a pickup sound for stones, weapons, stolen items and healing; three impact sound variants drawn at random. Whoosh and chime are synthesised (WebAudio), with no new file. **Added (v1.9.3):** fury mode (section 8.8): synthetic rise on pickup, low hum for as long as the mode lasts (one voice of the cap of eight, subject to mute and suspended on pause), fall at the end; no new file. **Added (v1.9.7):** rising hum while the energy wave charges (cut at firing or on cancel), discharge on firing, metallic clang when the shield blocks (section 8.9); synthesised, within the voice cap. **Added (v1.9.14):** energy gauge (section 8.8): a soft little « ping » (sine) when it reaches 50, a brighter arpeggio when it is full, once per fill; a dull « toc » when Fury or Wave is refused; the fury mode rise sounds on activation.

Phase B sound cues (v1.9.15, WebAudio, within the voice cap): a small cartoon « pop » on each shooter bullet, a low « thump » when the flashball fires, a springy « boing » when the boxing glove connects (a simple whoosh if it hits empty air).

Emergency services sirens (v1.9.19, WebAudio, through the same voice helper and within the voice cap): on `ServiceCalled`, the fire truck siren (triangle wave, « pin-pon » at 580 / 435 Hz, 4 notes of 0.32 s) or the police siren (square wave low-pass filtered, 880 / 660 Hz, 6 notes of 0.18 s); on `ServiceRefused`, the existing « tock »; on `TruckDestroyed`, a heavy landing thud.

Prison sounds (v1.9.20, WebAudio, within the voice cap): on `CaidJailed`, the existing police siren (the van); on `PrisonBreakout`, a heavy thud followed by the alarm.

A cutscene must not trigger a second copy of the scene's sounds when it resumes. Tab return and audio context resumption are handled explicitly.
