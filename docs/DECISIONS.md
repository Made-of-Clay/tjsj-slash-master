# Decisions

Canonical home for every locked call. IDs are `step + letter` (`9C`); cite the ID in plans, commits and reviews instead of restating the reasoning.

Rules: rows are permanent. A reversal gets a dated **superseded by** note on the old row and a new row — never a silent rewrite. **[You]** locks; **[I]** proposes.

## Step 1 — foundation

| ID  | Decision                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------- |
| 1A  | `WebGPURenderer` from `three/webgpu` immediately, TSL from `three/tsl`; WebGL2 backend is the fallback. |
| 1B  | A working skeleton, not empty stubs — nothing is verifiable otherwise.                                  |
| 1C  | Prune the starter template; `Addons.js` alone costs ~1.9 MB wasm.                                       |
| 1D  | Formatting baseline from the first commit; new code lands formatted.                                    |

## Step 2 — playfield

| ID  | Decision                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| 2A  | Straight-on modest perspective; `z = 0` is view-perpendicular, so fit math is exact.                              |
| 2B  | Full-width aspect policy (supersedes fit-bounds): field spans the screen width, `sideMargin` guards edge objects. |
| 2C  | Background via `scene.backgroundNode` (TSL) — themeable, one fragment, no extra geometry.                         |
| 2D  | Height fixed, width derived from aspect (supersedes portrait-first): camera distance is constant across devices.  |
| 2E  | No shadow maps — matches `PERF-BUDGET`; nothing needs them.                                                       |

## Step 3 — launching

| ID  | Decision                                                                                 |
| --- | ---------------------------------------------------------------------------------------- |
| 3A  | No interpolation: render latest sim state, keep the `render(alpha)` signature.           |
| 3B  | Depth band ±1, pinned to `z = 0` 2026-10-21 (chopping bug); collision stays 3D.          |
| 3C  | Plain `Mesh` per slot, shared geometry/materials; instancing is step 8's call.           |
| 3D  | `main.ts` injects theme data; gameplay never imports the theme or reads palette fields.  |
| 3E  | Spawn cadence + batch ramp with round progress (overrides constant cadence, 2026-10-18). |
| 3F  | Spawner takes injectable `rand`; deterministic harness, `Math.random` default.           |

## Step 4 — swipe

| ID  | Decision                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------- |
| 4A  | Buffer home is `game/Swipes.ts`; `Input` stays a dumb DOM adapter.                                      |
| 4B  | Gate = displacement from stroke origin ≥ `SWIPE.gateDistance`; opens once, holds to stroke end.         |
| 4C  | Drain at the top of `fixedUpdate`, so cuts test pre-move positions.                                     |
| 4D  | `visibilitychange` clears the buffer in `main.ts`.                                                      |
| 4E  | Blade trail stays on stroke handlers — a visual need not be sim-deterministic.                          |
| 4F  | `Collision.ts` stays a stub until step 5; only its header comment is fixed.                             |
| 4G  | Held-pointer jitter is filtered in `Input` (pixel floor) and again by the origin gate (2026-10-26 fix). |

## Step 5 — cutting

| ID  | Decision                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 5A  | Pieces are a separate debris ring, never the object pool — re-slice/score impossible by construction.        |
| 5B  | Piece geometry = authored `def.pieces?` at final size, else a scaled clone (`pieceScale`).                   |
| 5C  | Score rides on `SpawnedObject.score` (launch-set, reset-zeroed).                                             |
| 5D  | Hit test = pure scalar 3D sphere-vs-segment plus `CUT.pad`; first hit wins, one payout per object per drain. |
| 5E  | Cut runs inside the drain, pre-move; score and pieces fire before `pool.release`.                            |

## Step 6 — rules

| ID  | Decision                                                                       |
| --- | ------------------------------------------------------------------------------ |
| 6A  | Round clock is scalar state in `game/Round.ts` with an `over` latch.           |
| 6B  | `round.step` runs last in `fixedUpdate`; `over` freezes objects mid-air.       |
| 6C  | `round.progress` feeds the spawn ramp (un-parks 3E).                           |
| 6D  | HUD on the step-1 root; DOM writes only when the displayed integer changes.    |
| 6E  | Restart re-arms every mutable system (score/round/spawner/pool/debris/swipes). |
| 6F  | Missed fruit has no consequence — PLAN §6.                                     |

## Step 7 — content

| ID  | Decision                                                                          |
| --- | --------------------------------------------------------------------------------- |
| 7A  | Procedural parts models, no assets.                                               |
| 7B  | `ObjectModel` = `parts` or `asset`; `asset` is the step-9 seam.                   |
| 7C  | Bake once at boot to one geometry per def.                                        |
| 7D  | One material per category; the theme accent is emissive.                          |
| 7E  | Boot-time `?theme=` through the registry.                                         |
| 7F  | Default piece geometry is a scaled clone; pumpkin has authored halves.            |
| 7G  | `size` = max extent, and radius ≤ `sideMargin`.                                   |
| 7H  | Gameplay never imports themes/models; the harness proves the import graph.        |
| 7I  | Christmas object set per PLAN §7.                                                 |
| 7J  | No dependencies; only the `BufferGeometryUtils` addon.                            |
| 7K  | HUD stays neutral across themes.                                                  |
| 7L  | `getTheme` + boot resolution; `setTheme` superseded by step 10 (no runtime swap). |

## Step 8 — perf

| ID  | Decision                                                                              |
| --- | ------------------------------------------------------------------------------------- |
| 8A  | One `InstancedMesh` per def (per-category would need merged shapes).                  |
| 8B  | Capacity = `POOL_SIZE` for objects, `CUT.capacity` for pieces.                        |
| 8C  | `count` is the draw count; one reused `Object3D`; no instance ids.                    |
| 8D  | `frustumCulled = false` — instance bounds are not tracked.                            |
| 8E  | Scene graph = defs × 3, independent of pool size.                                     |
| 8F  | Zero steady-frame allocation, harness-guarded.                                        |
| 8G  | `verify:perf` is headless; draw calls + frame time are measured on device.            |
| 8H  | `DEBUG_PERF` gives a 1 Hz draw/triangle readout.                                      |
| 8I  | Pools, pixel cap, hidden-tab pause, low-poly, TSL were already done before this step. |
| 8J  | No dependencies.                                                                      |

## Step 9 — polish

| ID  | Decision                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------- |
| 9A  | Sparks = one `InstancedMesh` per category over one unit shard; per-instance colour unproven on `WebGPURenderer`.                  |
| 9B  | Shake = scalar trauma, quadratic falloff, applied after `syncViewport` from the captured base pose.                               |
| 9C  | Combo = time-window chain; the k-th cut banks `COMBO.step × (k − 1)` and pays on window lapse (re-keyed from stroke, 2026-10-26). |
| 9D  | Hazard = third category, negative score, max shake, never ends the round.                                                         |
| 9E  | Spawn rarity = per-def `weight`, prefix sums at construction.                                                                     |
| 9F  | Records = guarded `localStorage`, in-memory fallback, write only on a beaten score.                                               |
| 9G  | Audio = procedural synth, unlocked inside the first gesture, one context per page.                                                |
| 9H  | Haptics = `navigator.vibrate`, silent no-op where absent, follows mute.                                                           |
| 9I  | Flow = start card + pause card; restart skips the start card; hidden-tab pause stays authoritative.                               |
| 9J  | Verification = `verify:polish` for audio/haptics/records/flow; sparks/shake → perf, combo → rules, hazard/weight → content.       |
| 9K  | Draw budget ≤ 17 while swiping: 12 instanced + 3 spark meshes + background + blade trail.                                         |
| 9L  | No deps, no assets; app chunk +3.2 kB gzip (target was ~2.5).                                                                     |

## Step 10 — content pipeline

| ID  | Decision                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 10A | Exactly two selection paths: build default and boot `?theme=`. No picker, no persistence, no runtime API.     |
| 10B | Default comes from `import.meta.env.VITE_DEFAULT_THEME` in source; `define` rejected (Vite 8 dev ignores it). |
| 10C | Missing or invalid env → `halloween`.                                                                         |
| 10D | `?theme=` is read once in `main.ts`; exact registry match, else the built default.                            |
| 10E | Boot-only: no listeners, no disposal, no swap path.                                                           |
| 10F | Both themes stay in every bundle; no tree-shaking of the non-default.                                         |
| 10G | Gameplay isolation unchanged; still one registry importer (`main.ts`).                                        |
| 10H | `theme-color` meta follows the resolved theme; manifest `theme_color` follows the built default.              |
| 10I | Selection checks live in `verify:content`, above its failure gate.                                            |
| 10J | No dependencies.                                                                                              |

## Step 11 — card object legend

| ID  | Decision                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 11A | Legend appears on start, pause and game-over cards; one shared row builder per card.                           |
| 11B | Thumbnails = boot-time CPU orthographic z-buffer over the theme's baked geometry; no GPU readback, no art.     |
| 11C | `name` lives in `GameObjectDefinition`; `main.ts` hands the HUD `{ name, score, icon }` primitives.            |
| 11D | Rendered once at boot as PNG data URLs; three cards reuse the URL, steady frame unchanged.                    |
