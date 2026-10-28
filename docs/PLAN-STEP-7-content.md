# Step 7 — Content/theme abstraction

Index: [PLAN.md](../PLAN.md).

- **Scope** — procedural multi-part models baked once, a second theme, and proof the swap is data-only.
- **Contracts** — gameplay never imports `content/themes`, `content/models` or `rendering/`; one baked geometry per def; `main.ts` injects the theme; `asset` stays an unused seam.
- **Files** — `content/types.ts`, `content/models/*`, `content/themes/*`, `rendering/Model.ts`, `Materials.ts`, `ObjectViews.ts`.
- **Acceptance** — `verify:content` (theme, bake, isolation); `?theme=christmas` changes art only; every model radius ≤ `sideMargin`.
- **Not doing** — runtime swap (10), glTF/textures, authored halves for every object.
- **Decisions** — 7A–7L.

> **Status note.** The seams already exist: `ObjectModel` (`model` + optional
> `pieces`), `GameObjectDefinition` (`id/score/category`), `Theme`, the
> `defId` → geometry maps in `ObjectViews`/`DebrisViews`, `Spawner` reading
> `defs`, and `main.ts` injecting a theme. This step fills the art seam — no
> gameplay rewrite.

## Session start (before workstream A)

- [I] Read: `src/content/types.ts`, `src/content/themes/halloween.ts`,
  `src/rendering/ObjectViews.ts`, `src/rendering/DebrisViews.ts`,
  `src/rendering/Materials.ts`, `src/game/Spawner.ts` (`def.model.size`),
  `src/main.ts` (theme injection), `docs/PERF-BUDGET.md` (payload note).
- [You] (non-blocking) carried-over tuning: CUT/SWIPE feel, palettes, arcs.
- [You] Move this plan to `docs/PLAN-STEP-7-content.md` when implementing
  (repo convention: one plan per step under `docs/`).

## What step 7 is really about

1. **Gameplay never learns a noun.** `src/game/**` may read numbers, ids and
   `category` — never a theme module and never a mesh. The swap has to be
   provably data-only, so the harness statically checks the import graph.
2. **Art needs a shape, not a colour.** The old seam is one primitive + one
   colour per category. Real objects need parts (stem, jaw, ribbon) and their
   own colours, while the 64-slot pooled view layer must not grow a draw call,
   a scene-graph node, or a per-frame allocation. Hence: **bake at boot, merge
   to one geometry, vertex colours, one material per category**.
3. **A second theme is the test, not the feature.** Christmas exists to prove
   the data-only claim end to end: boot selection, model resolution, material
   accents, spawn rules, rules unchanged.

## Decisions (locked 2026-10-22, [You])

> Detail + rationale only. Canonical one-line rows: [DECISIONS.md](DECISIONS.md).

| #   | Decision           | Choice                                                                                                                                                                         | Rationale                                                                                                       |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| A   | Model source       | Procedural builders in `src/content/models/*.ts` (code-authored geometry). Sync, no loader, no assets.                                                                         | Zero payload, no draco/basis risk, still exercises the real `ObjectModel` seam. PERF-BUDGET: assets are step 9. |
| B   | Model shape        | `ObjectModel = { kind: 'parts'; parts: ModelPart[]; size }` \| `{ kind: 'asset'; url; size }` (asset = documented step-9 seam, throws if baked).                               | Multi-part art without multi-mesh slots. `size` = max extent keeps gameplay's radius read unchanged.            |
| C   | Baking             | `rendering/Model.ts` → `bakeModel(model)`: clone parts, strip uv/uv1/tangent, apply local transform, add per-vertex colour, `mergeGeometries([...], false)`. Run once at boot. | One mesh per pool slot (as today), one draw call, no per-frame work.                                            |
| D   | Materials          | One `MeshStandardMaterial` per category, `vertexColors: true`; theme accents become **emissive** (restricted stronger) so category still reads.                                | Base colour is the model's; category readability is the accent's job.                                           |
| E   | Theme selection    | Boot-time only: `?theme=<id>` → `content/themes/index.ts` registry (`getTheme`, `resolveThemeId`, `DEFAULT_THEME_ID = 'halloween'`). Unknown/absent → default.                 | One code path before views are built; no teardown/dispose. Hot-swap = step 10.                                  |
| F   | Slice pieces       | Default `CUT.pieceScale` clone of the baked model. **Pumpkin gets authored halves** (two half-shells + flesh cap) to prove `def.pieces` is data-only.                          | PLAN puts "better slicing animation" in step 9; one authored example proves the seam.                           |
| G   | Sizing             | `size` = max world extent per def, centered on origin. `boxBoundingRadius(size)` stays the conservative radius. Every theme must satisfy `radius ≤ PLAYFIELD.sideMargin`.      | Spawner's inset/aim math is size-driven; harness guards theme authors.                                          |
| H   | Gameplay isolation | `src/game/**` must not import `content/themes/**` or `content/models/**` (type-only `content/types` allowed). Harness reads files and asserts it.                              | The whole point of §7/§10, enforced rather than assumed.                                                        |
| I   | Second theme       | Christmas per PLAN §7: ornament, candyCane, gift (+1), snowGlobe (−1). Own gradient/lighting/accents/spawn rules.                                                              | PLAN §7 list, verbatim.                                                                                         |
| J   | Dependencies       | None added. One addon import allowed: `three/addons/utils/BufferGeometryUtils.js` (`mergeGeometries`). Check `dist/assets` for draco/basis after build.                        | PAYLOAD guard rails.                                                                                            |
| K   | HUD                | Unchanged (neutral white). Theme-tinted HUD/card = step 9.                                                                                                                     | No churn in a verified step-6 surface.                                                                          |
| L   | Naming             | `setTheme` stays the step-10 ambition; step 7 ships `getTheme(id)` + boot resolution and documents the async/asset path.                                                       | Don't advertise what isn't built.                                                                               |

## Files touched

```
src/content/types.ts                 ObjectModel → parts/asset + ModelPart; docs      [I]
src/content/models/halloween.ts      pumpkin/candy/ghost/skull builders               [I] scaffold, [You] shapes
src/content/models/christmas.ts      ornament/candyCane/gift/snowGlobe builders        [I] scaffold, [You] shapes
src/content/themes/halloween.ts      real models; palette/spawn kept                  [I]
src/content/themes/christmas.ts      new theme (PLAN §7 objects)                      [I] scaffold, [You] palette
src/content/themes/index.ts          registry + resolveThemeId                         [I]
src/rendering/Model.ts               bakeModel + part transform/colour                 [I]
src/rendering/Materials.ts           createObjectMaterial (vertexColors + emissive)    [I]
src/rendering/ObjectViews.ts         bake instead of createGeometry; new materials     [I]
src/rendering/DebrisViews.ts         baked parent clone / authored piece bake          [I]
src/config.ts                        OBJECT_MATERIAL block; sideMargin comment         [I] scaffold, [You] numbers
src/main.ts                          resolve theme from URL; replace `halloween` refs  [I]
scripts/verify-content.ts            new harness                                      [I]
package.json                         verify:content script                            [I]
docs/PLAN-STEP-7-content.md          this file (copied from plan dir)                 [I]
AGENTS.md / CHANGELOG.md / README.md state + commands + link                        [I]
docs/PERF-BUDGET.md                  model-bake note (payload unchanged)              [I]
```

---

## Workstream A — Model seam + bake + materials (session 1)

**Skill:** content data → one GPU-ready geometry, allocation-free thereafter.

### Work

- [I] `content/types.ts`:
  - `ModelPart = { geometry: BufferGeometry; color: string; position?: readonly [number, number, number]; rotation?: readonly [number, number, number]; scale?: readonly [number, number, number] }`
    — rotation = Euler XYZ radians, uniform local transform baked into vertices.
  - `ObjectModel = { kind: 'parts'; parts: readonly ModelPart[]; size: number } | { kind: 'asset'; url: string; size: number }`.
  - Delete the `primitive`/`geometry` variants and their `createGeometry` switch — migrate `halloween.ts` in this workstream (no back-compat constraint).
  - Doc comments: `size` = max extent (used for radius + view scale), centered on
    origin; `asset` is the step-9 loader seam (async preload, gameplay unaffected).
- [I] `rendering/Model.ts`:
  - `bakeModel(model: ObjectModel): BufferGeometry`
    - `asset` → `throw new Error('asset models are the step-9 loader seam; bake parts instead')`.
    - per part: `clone()` the geometry (never mutate content-owned templates),
      `deleteAttribute('uv' | 'uv1' | 'tangent')`, `applyMatrix4(compose(position, Euler, scale))`
      (avoid negative scales: winding flips), `computeVertexNormals()` if absent,
      write a `color` Float32 attribute from `new Color().setStyle(part.color)`
      (three converts sRGB → working space; do **not** hand-roll hex).
    - Normalise indexing before merging: all standard three geometries are
      indexed, but if any part is non-indexed, `toNonIndexed()` **all** of them.
      `mergeGeometries(parts, false)`; dispose the clones after the merge; throw
      if the merge returns null (mismatched attributes/indexing — a builder bug).
  - Keep it DOM-free and GPU-free: `verify-content` runs it under bun.
  - Document the step-9 async path in the header: preload `asset.url` with
    `GLTFLoader` → merge its meshes (or resolve a geometry map) before
    `createObjectViews`; `main.boot` already awaits `renderer.init()`.
- [I] `rendering/Materials.ts`: `createObjectMaterial(accent: string, emissiveIntensity: number)` →
  `MeshStandardMaterial({ vertexColors: true, color: 0xffffff, emissive: accent, emissiveIntensity, roughness: OBJECT_MATERIAL.roughness, metalness: OBJECT_MATERIAL.metalness })`.
- [I] `config.ts`: `OBJECT_MATERIAL = { roughness: 0.55, metalness: 0.05, targetEmissive: 0.06, restrictedEmissive: 0.25 }` (scaffold; [You] tunes).
- [I] `rendering/ObjectViews.ts`: geometry map = `bakeModel(def.model)` per def; materials = `createObjectMaterial(accents.target, …targetEmissive)` / restricted. **`syncViews` unchanged.**
- [I] `rendering/DebrisViews.ts`: authored `def.pieces[i]` → `bakeModel` (final size, no extra scale); default → `bakeModel(def.model).clone().scale(pieceScale)`; cache once at boot.
- [I] `main.ts` piece radii: unchanged logic (`authored.size` vs parent size × `pieceScale`).

### Success signal

Dev: the old boxes are gone — each pool slot draws a multi-part, multi-coloured
object; cut still yields two correctly coloured, correctly sized pieces.
`tsc`/`lint` clean; no new per-frame allocation (`syncViews`/`syncDebrisViews`
still only copy).

### Notes

- `mergeGeometries` requires identical attribute sets: strip uv/uv1/tangent on
  **every** clone, not just some.
- Vertex-colour attribute length must equal `position.count`; harness checks it.
- Colours are linear after `Color.setStyle`; with ACES tone mapping a `#f2762e`
  reads darker than the hex, which is expected — tune by eye.
- Boot cost is one bake per def + one clone per debris slot geometry; no
  texture, no network. Precache delta is code only.

---

## Workstream B — Halloween models + authored pumpkin pieces (session 2)

**Prerequisite:** A merged.

**Skill:** recognizable silhouettes from low-poly primitives; the harness's
bounding-box contract is the authoring rule.

### Work

- [I] `content/models/halloween.ts` — factory per def, `ObjectModel` returned
  centered on origin. Targets ≤ ~350 tris/def. Recipes (tune by eye, keep the
  `size` contract):

  | id        | cat        | score | size | parts (geometry, colour, transform)                                                                                                                  |
  | --------- | ---------- | ----- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `pumpkin` | target     | +1    | 1.0  | squashed sphere body `Sphere(0.5,16,12)` scale (1.0,0.85,1.0) `#e8722c`; stem `Cylinder(0.04,0.06,0.14,6)` y 0.42 `#5c7c35`                          |
  | `candy`   | target     | +1    | 1.1  | body `Cylinder(0.22,0.22,0.44,12)` rot z π/2 `#ffbf3f`; wrapper `Cone(0.2,0.3,8)` at x ±0.36, rot z ∓π/2 `#f7f0d8`                                   |
  | `ghost`   | target     | +1    | 1.0  | `LatheGeometry` profile (~y −0.45→0.46, max r 0.42, 16 seg) `#e9f2f7`; two eye `Sphere(0.055,6,4)` at (±0.12,0.10,0.30) `#16252c`                    |
  | `skull`   | restricted | −1    | 1.0  | cranium `Sphere(0.38,16,12)` scale (1,0.9,1) `#e6dcc6`; jaw `Box(0.30,0.18,0.24)` y −0.34; sockets `Sphere(0.09,8,6)` at (±0.14,0.02,0.32) `#101820` |

- [I] `content/themes/halloween.ts`: objects reference the factories;
  background/lighting/accents/spawnRules keep their step-6 values (palette
  tuning stays [You]).
- [I] Authored pieces for `pumpkin` only (Decision F):
  - piece 0 = `Sphere(0.5,16,12, 0, π)` scaled (1,0.85,1) `#e8722c` + flesh cap
    `Circle(0.5,16)` scaled (1,0.85,1) at z=0 `#c9642a`;
  - piece 1 = mirror (`phiStart π`) + cap rotated y π;
  - each piece is `size: 1.0`; verify the cut face normal points **out of** the
    half (flip with `rotation` if it renders inside-out).
  - All other defs omit `pieces` → default scaled clone.

### Success signal

All four Halloween objects read as their nouns at phone size; pixeling/edge
aliasing acceptable. Pumpkin cut shows two shell halves with a flesh-coloured
flat face; others show coloured clones.

### Notes

- Keep every part's extent ≤ `size/2`: the harness asserts the baked box fits
  (ε 1e-3). It is the cheapest guard against "art drifted off the play plane".
- No textures in step 7 — colour is vertex colour. Stripes/faces beyond the
  eye sockets are step 9.
- `LatheGeometry` points must be `Vector2`, y increasing; both ends may be open
  (the profile above closes at the top).

---

## Workstream C — Christmas theme + registry + boot selection (session 3)

**Prerequisite:** A + B merged (A alone is enough to start; B supplies the
authoring pattern).

**Skill:** prove the swap without touching gameplay.

### Work

- [I] `content/models/christmas.ts` (same contract):

  | id          | cat        | score | size | parts (geometry, colour, transform)                                                                                                                                                  |
  | ----------- | ---------- | ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `ornament`  | target     | +1    | 1.1  | globe `Sphere(0.36,16,12)` `#c8203c`; cap `Cylinder(0.10,0.10,0.10,8)` y 0.43 `#d9b04a`; loop `Torus(0.05,0.018,6,10)` y 0.48 `#e8cf7a`                                              |
  | `candyCane` | target     | +1    | 1.1  | shaft `Cylinder(0.07,0.07,0.72,8)` y −0.12 `#f2efe6`; hook `Torus(0.16,0.07,6,12, π)` near y 0.24 `#cf2436` (orient the arc into a hook)                                             |
  | `gift`      | target     | +1    | 1.0  | box `Box(0.66,0.56,0.50)` `#2e7a58`; vertical ribbon `Box(0.12,0.58,0.52)` y 0 `#e0bd5a`; horizontal ribbon `Box(0.68,0.12,0.52)`; bow `Sphere(0.09,6,4)` at (±0.10,0.33,0)          |
  | `snowGlobe` | restricted | −1    | 1.1  | glass `Sphere(0.40,16,12)` y 0.04 `#cfe9f4`; base `Cylinder(0.34,0.40,0.20,12)` y −0.40 `#6d4a33`; tree `Cone(0.16,0.40,8)` y 0 `#2e8f5a` (opaque glass — no transparency in step 7) |

- [I] `content/themes/christmas.ts`: icy palette (e.g. top `#13294b`, bottom
  `#04070f`, vignette black 0.55), cool lighting tints, accents
  (target `#ffcf5a`, restricted `#7fd4e8`), four objects above, own
  `spawnRules` (e.g. slightly faster early cadence than Halloween — data-only
  proof that rules travel with the theme).
- [I] `content/themes/index.ts`:
  - `THEMES: Record<ThemeId, Theme>`; `ThemeId = 'halloween' | 'christmas'`;
    `DEFAULT_THEME_ID = 'halloween'`;
  - `getTheme(id: ThemeId): Theme`;
  - `resolveThemeId(value: string | null | undefined): ThemeId` — exact match
    else default (pure string logic, bun-testable);
  - comment: step 10's `setTheme` rebuilds on this registry; step 7 resolves
    once at boot.
- [I] `main.ts`: `const theme = getTheme(resolveThemeId(new URLSearchParams(window.location.search).get('theme')))`;
  log `theme: <id>` next to the backend log; replace every `halloween` reference
  (scene, object views, spawner, debris views, piece radii) with `theme`.
- [I] `index.html`: nothing required; document that the URL also drives
  `theme-color` only in step 9 if the HUD is tinted.

### Success signal

`pnpm dev` → Halloween as before (now with real models).
`pnpm dev/?theme=christmas` → full Christmas repaint + objects; score rules,
round length, HUD, restart identical. Unknown `?theme=nope` falls back to
Halloween with no error.

### Notes

- No gameplay file changes in C. If one is needed, the abstraction leaked —
  stop and fix the data instead.
- `?theme=` is read once; a reload switches. Document in README ("append
  `?theme=christmas`").
- Both themes must stay within `PLAYFIELD.sideMargin` (harness); if a model
  outgrows it, shrink the model before raising the margin, or raise the margin
  deliberately ([You]).

---

## Workstream D — Verification harness + close-out (session 4)

**Skill:** content-contract regression harness (step 3/5/6 style).

### Work

- [I] `scripts/verify-content.ts` + `pnpm verify:content` (~38 checks, plain
  `check(name, condition, detail)`, bun, no DOM/GPU):

  - **Registry (~6):** both ids resolve to distinct themes; `null`/`''`/
    `'nope'` → default; `resolveThemeId('christmas')` exact; `getTheme` returns
    the same object as the registry entry.
  - **Theme contract (~14, per theme):** unique object ids; ≥1 target and ≥1
    restricted; target `score > 0`, restricted `score < 0`, category/score
    agreement; `size > 0` for every def; authored pieces count ≤ 2 and
    `size > 0`; background/lighting/accents are 6-digit hex; spawn rules:
    every endpoint finite, `min ≤ max`, `interval* > 0`, batch endpoints
    `≥ 1`, `depthRange === [0,0]` (chopping guard), `sideLaunchChance ∈ [0,1]`,
    `speedRange`/`apexRange` > 0.
  - **Bake (~10):** each def bakes; attributes `position`/`normal`/`color`
    exist, `uv`/`uv1`/`tangent` do not, `color.count === position.count`;
    baked bounding box within `size/2 + 1e-3` on every axis; box center near
    origin (|c| ≤ 0.05) — catches art drifting off the cut sphere; authored
    pumpkin pieces bake and their radii are computed from their own `size`;
    `{kind:'asset'}` throws with a message mentioning the loader seam;
    source part geometry is not mutated by baking (clone check: transform of
    the template stays identity / vertex count unchanged).
  - **Spawn fit (~3):** for every theme, max `boxBoundingRadius(size)` ≤
    `PLAYFIELD.sideMargin` (spawner inset can't go negative); every def's id
    is a non-empty slug; model sizes within a sane band (e.g. 0.8–1.2).
  - **Gameplay isolation (~3):** read every `src/game/*.ts`; assert no import
    path matches `content/(themes|models)/`; assert `src/main.ts` is the only
    module importing `content/themes/`; assert rendering code never imports a
    concrete theme file (only `content/types` + injected `Theme`).
  - **Config (~2):** `OBJECT_MATERIAL.roughness/metalness ∈ [0,1]`; restricted
    emissive > target emissive (category must read).

- [I] Full chain: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` →
  `verify:playfield` → `verify:launch` → `verify:swipe` → `verify:cut` →
  `verify:rules` → `verify:content` → `npx vite build` →
  `ls dist/assets | grep -E 'draco|basis|ktx2'` (expect none) → precache delta
  in CHANGELOG (code only).
- [I] Update `AGENTS.md` (state → step 7 complete, decisions A–L, next step 8
  perf), `CHANGELOG.md`, README plan link + `?theme=` note, `PERF-BUDGET.md`
  (bake-once, no payload).
- [You] On device: both themes at 60 FPS both backends; silhouettes readable in
  portrait; restricted objects read as dangerous; cut pieces look right;
  `?theme=christmas` on the installed PWA.

### Success signal

Harness green; both themes play identically rule-wise; the only diff between
themes is data + baked geometry; full chain green.

## Locked decisions carried in

- 3D `main.ts` injects theme data; gameplay never imports the theme file.
- 3C plain meshes (step 8 owns `InstancedMesh`); one mesh per pool slot stays.
- 3E ramp with round progress; theme `spawnRules` still ramp-shaped.
- 5A pieces = separate debris ring; `def.pieces` authored at final size, default
  scaled clone; 5E score→pieces→release ordering.
- Chopping fix: `depthRange [0,0]`, `SPAWN.depthDrift = 0`; harness re-asserts.
- PERF-BUDGET: no steady-frame allocation; bake happens at boot only; no
  textures; no shadow maps; pixel ratio cap unchanged.

## Explicitly NOT in step 7

- Runtime `setTheme` hot-swap, theme picker UI — step 10 (`setTheme` ambition).
- glTF/texture assets, async loading, draco/basis — step 9 payload work.
- Authored slice halves for every object; juice/particles/sound — step 9.
- Theme-tinted HUD/card/CSS vars — step 9.
- `InstancedMesh`, draw-call consolidation — step 8.
- Spawn weighting between defs (uniform pick stays; note as a future knob).

## Risks / gotchas

- **Attribute/index mismatch on merge** → null geometry; strip uv/uv1/tangent on
  all clones, normalise indexing (`toNonIndexed()` all or none) and throw loudly
  if merge fails.
- **Colour space**: vertex colours must be linear (`Color.setStyle`), or every
  model reads washed out under ACES.
- **Negative scale** flips winding; models vanish with front-face culling.
- **Half-shell caps** can render inside-out; verify the authored pumpkin pieces
  by eye and flip the cap rotation, not the material side (shared material).
- **`size` vs actual extents**: too small clips spawn insets/radius; harness
  box check + margin check keep it honest.
- **Tube/cone segment creep**: keep every part ≤ ~350 tris; the 64 debris slots
  each draw the baked piece geometry.
- **Boot ordering**: theme must resolve **before** `createScene`,
  `createObjectViews`, `Spawner`, `createDebrisViews`; `?theme=` is read in
  `main.ts` only (no module-level side effects).
