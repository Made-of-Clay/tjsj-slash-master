# Step 12 — Authored pumpkin asset

Index: [PLAN.md](../PLAN.md).

- **Scope** — the halloween pumpkin ships as the authored GLB in `src/content/models/pumpkin/`, fetched once at boot; every other model stays procedural.
- **Contracts** — `preloadModels` runs before any view exists and `modelGeometry` never fetches; a GLB flattens to one indexed vertex-coloured geometry, uv/tangent dropped, centred, max extent = `size`; an asset bakes to the same shape as `parts`; gameplay still reads only `size`.
- **Files** — `rendering/ModelAssets.ts`, `Model.ts`, `ObjectViews.ts`, `DebrisViews.ts`, `ui/objectIcons.ts`, `content/models/halloween.ts`, `content/types.ts`, `main.ts`, `vite.config.ts`, `scripts/read-asset.ts`, `verify-content.ts`, `verify-perf.ts`.
- **Acceptance** — `verify-content` reads the committed GLB and runs the shared flatten (fit, centre, icon pixels); `vite build` emits one hashed `.glb` precached by the service worker; the pumpkin still reads at `size: 1`.
- **Not doing** — glTF materials or emission at runtime, DRACO/KTX2, authored halves for the asset, a general asset pipeline or picker.
- **Decisions** — 12A–12D.

> **Why.** The Blender model carries the carved face, lobes and stem that procedural
> primitives cannot; keeping it out of the boot path would mean two render contracts.
> Supersedes the step-7 asset seam.

## Boot path

1. `main.ts` awaits `preloadModels(theme.objects + pieces)` before `createScene`.
2. `parts` bake via `bakeModel`; an `asset` reads its bytes (browser: `fetch`,
   harnesses: `readAssetBytes`) and parses with `GLTFLoader.parse`.
3. Each primitive is cloned, world-transformed, stripped, coloured from its
   material's base colour, merged, then fitted to `size`.
4. Views and legend icons call `modelGeometry` — a map lookup, never I/O.

The GLB faces +Z, so no rotation; the exporter already puts Blender −Y there.

## Gotchas

- Bun's `fetch` does not read `file:` URLs: the `AssetBytes` reader is injected so
  harnesses read the same committed bytes off disk.
- Merging drops material identity: the glow face becomes a bright vertex colour,
  so the face reads but does not emit. Runtime emission needs per-vertex emissive
  in the shared material — out of scope here.
- `vite.config.ts` precaches `glb`; without it the game works online and fails offline.
