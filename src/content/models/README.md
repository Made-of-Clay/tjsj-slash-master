# models/

One folder per model, self-contained under `src/content/models/`. The folder
name is the model name:

```
src/content/models/<model>/
  <model>.py        generator (or <model>.blend only, if hand-modelled)
  <model>.blend     editable scene
  <model>.glb       export consumed by the game
  previews/*.png    front / side / top / hero
  README.md         rebuild command, conventions, tri budget
```

No Blender install in this repo; the portable 4.5 LTS build lives in the
gitignored `tmp/`. Any 4.5+ `blender` binary rebuilds any model here.

Rules:

- Keep the generator and its output **co-located** — never a shared `blender/`
  dump. Adding a model adds a folder, nothing else.
- Every folder has a README stating its rebuild command, triangle budget and
  any deviation from the conventions below, so a model can be re-tuned without
  reading the game code.
- Reference sheets live in `src/content/models/`; previews and `.blend1`
  autosaves are scratch — the latter is gitignored.
- Generated output is committed so the game builds without Blender installed.
- Authored `.glb`s are fetched once at boot (`rendering/ModelAssets`) and
  flattened to vertex colours; every other model stays procedural and bakes in
  `parts`.

## Shared conventions

- Front is −Y, up is +Z in the source. The Y-up export turns that into facing
  +Z, which is what `ObjectViews` draws; anything else needs a runtime rotation.
- Shade smooth, then split normals by angle (38° default). Cutting rings raises
  dihedral angles: re-check the threshold or the model flat-bands.

## Previews

720², EEVEE Next, one three-point rig, ortho front/side/top plus a perspective
hero, framed on the bounds. Render with the **Standard** view transform — AgX
desaturates emissive material until a glowing face reads cream. Previews come
from the same headless run as the `.glb`, never from a hand-edited scene, and
stay at those four names.

See `pumpkin/README.md` for the first instance.
