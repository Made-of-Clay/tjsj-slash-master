---
name: Model Asset
description: Tune or extend the scripted Blender models in src/content/models — detail level, tri cuts, boolean-carved faces, regenerating the .glb. Use when editing a model generator, judging whether a model is too detailed for its on-screen size, or debugging boolean/manifold output.
---

# Model Asset

Sources are scripts: `src/content/models/<model>/<model>.py` → `.blend`, `.glb`,
`previews/`. The `.glb` is the only runtime asset; edit the script, never the blend.

## Budget from screen size

`size / (2 × PLAYFIELD.halfHeight)` is the model's share of the viewport — at
`size 1`, `halfHeight 7`, that is 1/14 ≈ 60 px. Detail is budgeted for that, not
for the 720 px preview. State it in the model README's budget line.

## Loop

1. Change constants in the `.py`.
2. `blender -b -P <model>.py -- --no-render` — prints tris per object.
3. Bake the new and current `.glb` through `renderObjectIconPixels` at 64/96 px
   (`scripts/read-asset.ts` + `preloadModels`), compare **interior pixel diff**.
   Silhouette IoU always reads 100 %: `fitToSize` normalises the bbox.
4. Then look at a 720 px preview. Below ~256 px, tri count is not the variable.

## Cut in this order

shell segments/rings → tube sides → face path points → never the face design.
The boolean, not the shell, is the cost: each path point costs ~4 tris plus
shell retriangulation near the outline.

Cutting rings raises dihedral angles: re-check the auto-smooth split (default
38°; the pumpkin body needs 62°) or the model flat-bands and looks cheaper than
it is. After every cut: 0 non-manifold edges, 0 degenerate faces, sane volume.

## Carve recipe

Solid body, no inner shell. Cutter = +Y prism with three rings: far outside,
opening at surface − 0.005, floor inset 0.96 riding the shell at +0.075.
Assign materials on the cutter _before_ the boolean (they transfer by pointer);
ear-clip the caps; keep `use_self=False`; keep cutter vertices off the body's
x = 0 column. Model-specific numbers: the model's own README.

## Ship

One headless run regenerates `.blend`, `.glb`, previews; commit all with the
script. `tsc` → `oxlint` → `pnpm verify` → `vite build`, and check the hashed
`.glb` size. Tri count changes no draw call (one instanced mesh per def), so
report bytes and boot parse, not fps.
