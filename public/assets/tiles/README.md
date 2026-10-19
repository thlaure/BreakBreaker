# Tiles

Index = `row * columns + col` (0-based). No margin or spacing in any sheet.
Indices were identified by eye from the sheets; check against the PNG if a tile looks off.

## streets.png — 32 px, 10 columns, 25 rows (LPC Modern Streets, CC0)
Atlas assembled by `scripts/build-misc.mjs` from the pack's terrain files, stacked on a 32-px grid:
- rows 0-6: `sidewalk_terrain` — flat paving fill = 11 (col 1,row 1); rounded slab with edges = rows 3-5, cols 0-2; cracked paving = rows 5-6, cols 4-7; ring/circle pieces = cols 3-5, rows 3-5
- rows 7-13: `traffic_markings` — white line/arrow/box marking overlays (transparent background; draw over road)
- rows 14-16: `cracked_road` — cracked asphalt variants (cols 0-5)
- row 17: road base asphalt = 170 (col 0); manhole cover = 171-173 (cols 1-3)
- rows 18-24: `rain_gutter_terrain` — gutter edges to layer under sidewalks

## urban.png — 16 px, 27 columns x 18 rows (Kenney RPG Urban Pack, CC0)
- asphalt plain: 406 (col 1,row 15); crossing stripes: cols 0 and 3-6, rows 15-17; road with markings: cols 7-13, rows 16-17
- pavement (grey) fill: 36 (col 9,row 1); beige pavement fill: 117 (col 9,row 4) area cols 8-10, rows 3-5
- grass fill: 28 (col 1,row 1) (green pads at cols 0-7, rows 0-2); water pad: cols 8-15, rows 6-8
- roofs: red brick-style blocks cols 16-22, rows 0-5; orange/terracotta cols 16-22, rows 6-8
- building facade pieces (windows, doors, shopfronts): cols 11-15, rows 9-14 and cols 7-10, rows 13-15
- trees: green cols 16-22, rows 9-10 (trunk + foliage, 1x2 tiles; clusters at cols 19-20); autumn orange rows 11-14
- vehicles (taxi, bus, red/green cars): cols 16-22, rows 15-17; people: cols 23-26, rows 0-17

## city.png — 16 px, 37 columns x 28 rows (Kenney Roguelike Modern City, CC0)
- roofs (flat, 4x4 blocks): red cols 0-7, dark grey cols 8-15, light grey cols 16-23, tan cols 24-31 (rows 0-3); fill = (1,1) -> 38, (9,1) -> 46, (17,1) -> 54, (25,1) -> 62
- building walls: red brick rows 4-8 cols 0-7 (plain brick = 5*37+1 = 186), grey brick cols 8-11 (row 5: 197), sandstone cols 12-15; glass/window facades rows 6-12 cols 12-23
- awnings: green/white cols 24-30, orange/white cols 31-36, rows 9-13
- asphalt plain: 830 (col 16,row 22); road markings (lines, crossings, arrows, parking): cols 12-24, rows 19-24
- pavers: grey cols 0-3, beige cols 4-7, light blue-grey cols 8-11, rows 19-23 (grey fill = 20*37+1 = 741)
- grass: 888 (col 0,row 24); dirt: 892 (col 4,row 24); grass/dirt transitions rows 25-27
- trees: cols 32-36, rows 10-13 (green, orange, dark green; tall = 1x2 tiles, short below)
- street furniture (lamps, lights, signs, benches, mailboxes, bins): rows 14-18; fences (wood) cols 20-24, rows 14-18
- vehicles: green, grey and orange cars at cols 31-36, rows 17-27
