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

Rules:

- Keep the generator and its output **co-located** — never a shared `blender/`
  dump. Adding a model adds a folder, nothing else.
- Every folder has a README stating its rebuild command, front/up convention and
  triangle budget, so a model can be re-tuned without reading the game code.
- Reference sheets live in `src/content/models/`; previews and `.blend1`
  autosaves are scratch — the latter is gitignored.
- Generated output is committed so the game builds without Blender installed.
- A `.glb` is fetched once at boot (`rendering/ModelAssets`) and flattened to
  vertex colours; every other model stays procedural and bakes in `parts`.

See `pumpkin/README.md` for the first instance.
