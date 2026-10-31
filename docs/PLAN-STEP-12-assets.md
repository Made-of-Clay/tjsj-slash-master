# Step 12 — Authored GLB assets

Index: [PLAN.md](../PLAN.md).

- **Scope** — the halloween pumpkin, skull and candy ship as authored GLBs under `src/content/models/`, fetched once at boot; every other model stays procedural.
- **Contracts** — `preloadModels` runs before any view exists and `modelGeometry` never fetches; a GLB flattens to one indexed vertex-coloured geometry, uv/tangent dropped, centred, max extent = `size`; an asset bakes to the same shape as `parts`; gameplay still reads only `size`.
- **Files** — `rendering/ModelAssets.ts`, `Model.ts`, `ObjectViews.ts`, `DebrisViews.ts`, `ui/objectIcons.ts`, `content/models/halloween.ts`, `content/models/skull/`, `content/models/candy/`, `content/types.ts`, `main.ts`, `vite.config.ts`, `scripts/read-asset.ts`, `verify-content.ts`, `verify-perf.ts`.
- **Acceptance** — `verify-content` reads each committed GLB and runs the shared flatten (fit, centre, icon pixels, tri/byte/viewport budget); `vite build` emits one hashed `.glb` per asset, precached by the service worker; pumpkin and skull read at `size: 1`, candy at `1.1` (its widest def).
- **Not doing** — glTF materials or emission at runtime, DRACO/KTX2, authored halves for either asset, a general asset pipeline or picker.
- **Decisions** — 12A–12D.

> **Why.** The Blender models carry the carved face, lobes, stem and skull pockets
> that procedural primitives cannot; keeping them out of the boot path would mean two
> render contracts. Supersedes the step-7 asset seam.

## Boot path

1. `main.ts` awaits `preloadModels(theme.objects + pieces)` before `createScene`.
2. `parts` bake via `bakeModel`; an `asset` reads its bytes (browser: `fetch`,
   harnesses: `readAssetBytes`) and parses with `GLTFLoader.parse`.
3. Each primitive is cloned, world-transformed, stripped, coloured from its
   material's base colour, merged, then fitted to `size`. Per-asset materials
   collapse into vertex colours: bone, cavity, socket and teeth survive as colour.
4. Views and legend icons call `modelGeometry` — a map lookup, never I/O.

The GLB faces +Z, so no rotation; the exporter already puts Blender −Y there.

## Gotchas

- Bun's `fetch` does not read `file:` URLs: the `AssetBytes` reader is injected so
  harnesses read the same committed bytes off disk.
- Merging drops material identity: the glow face becomes a bright vertex colour,
  so the face reads but does not emit. Runtime emission needs per-vertex emissive
  in the shared material — out of scope here.
- `vite.config.ts` precaches `glb`; without it the game works online and fails offline.
