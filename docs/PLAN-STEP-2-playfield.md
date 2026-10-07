# Step 2 — MVP playfield

Plan for [PLAN.md](../PLAN.md) §2. Extends it, doesn't replace it.

- Scope: fixed camera, background, lighting/material setup, play area bounds, responsive viewport. Steps 3–10 untouched.
- Target: a framed, bounded, themeable empty stage that step 3 can launch cubes into without rewriting anything.

Owner tags: **[I]** assistant, **[You]** user, **[Pair]** I scaffold, you decide/tune.
Workstreams run **sequentially A → B → C → D → E → F**, one per session. Each has a self-contained "Session start" block so a fresh session can begin without re-reading everything.

## What step 2 is really about

PLAN.md lists five bullets; four are structurally done in step 1 (`rendering/Camera.ts` exists, `rendering/Scene.ts` has lights, viewport sync exists). The real work:

1. **Hard problem: keep a fixed world-space play area fully framed on every aspect ratio.** A fixed camera + fixed FOV shows a *narrower* world slice on a portrait phone than on a desktop monitor. Spawn near a play edge on desktop → invisible on a phone → unfair. Fix is **fit-to-bounds**: derive camera distance from the bounds and the current aspect so the arena is always fully visible.
2. **Decision A — camera style:** straight-on modest perspective vs. the slight downward tilt step 1 has.
3. **Decision B — aspect policy:** fit the arena with background margin vs. fill the screen.

Two background sources currently fight: `Scene.background` (opaque color) **and** a CSS gradient behind the canvas. The canvas is opaque, so the CSS gradient is dead. Step 2 picks one source of truth.

## Decisions (locked)

| # | Decision | Choice | Rationale |
| - | -------- | ------ | --------- |
| A | Camera | Straight-on modest perspective | Tilt's fit math is a trapezoid; not worth it before step 9. Keeps `z = 0` play plane view-perpendicular, so fit math is exact and testable. |
| B | Aspect policy | Fit-bounds | Fair difficulty across devices. Play area always fully visible; extra space at wide aspects becomes background margin. |
| C | Background | `scene.backgroundNode` (TSL) | Themeable, no extra geometry, exercises the TSL skill step 8 needs. Cost is one full-screen fragment (no post-processing). |
| D | Play area proportions | Tall, portrait-first (`Wy > Wx`) | Keeps the limiting fit dimension stable across 9:16 and 16:9, so camera distance barely moves between orientations. |
| E | Shadow maps | No | Matches `docs/PERF-BUDGET.md`. WebGPU node shadows need explicit setup and step 2 has no flat-scene problem to solve. |

Portrait-first reasoning: with tall bounds the width is the binding constraint in portrait and the height is binding in landscape; the two distances land close, so the camera does not lurch between orientations. Wide bounds would make portrait distance huge and objects tiny.

## Already in place — no work

- `rendering/Camera.ts` — fixed camera, `createSwipeProjector` (NDC → `z = 0` plane), `createViewportSync` (resize/orientation events, not per-frame layout reads).
- `rendering/Scene.ts` — ambient + warm key / cool fill / white rim three-point rig.
- `rendering/Materials.ts` — TSL `time`-driven `mix` smoke test (proves the node pipeline compiles).
- `rendering/placeholder.ts` — proof-of-life sphere; **deleted this step**.
- `config.ts` — perf constants + `GAME_PLANE_DEPTH`, `CAMERA_*`.
- `ui/root.ts` + `style.css` — overlay layer, safe-area vars, `touch-action: none`.
- `scripts/verify-foundation.ts` — 52 checks incl. the real ray-plane projector.

## Files touched

```
src/config.ts                     CAMERA / PLAY_BOUNDS / BACKGROUND / DEBUG blocks       [I]
src/rendering/Camera.ts           fit math + reframe on aspect change                    [I] (decision A by [You])
src/rendering/Scene.ts            palette-driven lights; backgroundNode assignment       [I] + [You] tuning
src/rendering/Materials.ts        createBackgroundNode(palette)                          [You] body, [I] summon
src/rendering/PlayArea.ts         new: contains/clampToBounds + debug rect               [I] scaffold, [You] numbers
src/rendering/placeholder.ts      delete                                                  [I]
src/main.ts                       composition: reframe, background, play area, debug     [I]
src/content/themes/halloween.ts   new: first palette/theme data                          [You]
src/content/types.ts              real shape for Theme.background                        [I] after [You] fixes fields
src/style.css                     drop dead canvas gradient duplication                  [I]
scripts/verify-playfield.ts       new: fit math + bounds + projector checks              [I]
docs/PLAN-STEP-2-playfield.md     this file
CHANGELOG.md / README.md          entry + link                                            [I]
```

---

## Workstream A — Camera feel (session 1)

**Skill:** perspective projection, fov ↔ distance tradeoff, 2.5D composition, fit-vs-fill thinking.

**Prerequisite:** none. This is the first session.

### Session start
- Read: `src/config.ts` (CAMERA block), `src/rendering/Camera.ts`, `PLAN.md` §2.
- Run: `pnpm dev`, confirm the placeholder sphere renders and `stats.js` reads ~60.

### Work
- [I] Land the skeleton: structured `CAMERA` config block, pure `computeFitDistance(halfW, halfH, fovDeg, aspect)` + `applyFraming(camera, bounds, aspect)` in `Camera.ts`, reframe wired into `createViewportSync`, a DEV bounds rectangle so framing is visible.
- [I] Make the camera straight-on: position `(0, cy, z)`, target `(0, cy, 0)` where `cy` is the vertical centre of `PLAY_BOUNDS`. Drop the step-1 tilt.
- [You] Tune in `config.ts` with `pnpm dev` open:
  - `CAMERA_FOV` (start 60).
  - `PLAY_BOUNDS` half-extents (start `Wx = 3.5`, `Wy = 7`).
  - Safety `margin` added to the fit distance (start 1.0).
- [You] Decide the vertical placement: should the arena sit centred, or low with headroom for arcs?

### Success signal
Bounds rectangle fully on-screen with no clipping at 21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 9:19.5. Camera distance changes < ~15% between 9:16 and 16:9.

### Notes
- Fit formula (view-perpendicular plane): `d_h = halfH / tan(fov/2)`, `d_w = halfW / (tan(fov/2) * aspect)`, `d = max(d_h, d_w) + margin`.
- `createViewportSync` currently only fixes aspect; it must also re-run `applyFraming` because distance now depends on aspect.
- Keep the projector's `z = 0` plane unchanged; the fit must not move the play plane.

---

## Workstream B — Background TSL gradient (session 2)

**Skill:** TSL node graphs (`uv`/`screenUV`, `mix`, `smoothstep`, `time`, `uniform`), screen-space composition, themeability.

**Prerequisite:** A merged (bounds + reframed camera exist).

### Session start
- Read: `src/rendering/Materials.ts`, `src/rendering/Scene.ts`, `src/main.ts`.
- Pull current TSL docs via context7 (three.js): `backgroundNode`, `uv`/`screenUV`, `mix`, `smoothstep`. Do not rely on memory.
- Run: `pnpm dev`.

### Work
- [I] Add `createBackgroundNode(palette): Node` in `Materials.ts` returning a **flat color stub**, and assign `scene.backgroundNode` in `Scene.ts` (needs a cast/augmentation — `backgroundNode` is not in `@types/three`'s `Scene`; confirm tsc stays clean).
- [You] Replace the stub body with a vertical gradient + vignette, optional subtle noise, driven by a palette object (temporary literal until workstream C).
- [You] Decide: pure `backgroundNode`, or also a faint backdrop/floor plane for depth (extra draw + fragment cost — weigh against the perf budget).

### Success signal
Looks good in portrait and landscape; no extra draw call for the pure-node option; changing the palette literal updates the scene live; TSL graph compiles under `pnpm build`.

### Notes
- `scene.backgroundNode` is confirmed in three 0.185 (`three/src/nodes/accessors/SceneProperties.js:34`) but missing from `@types/three`.
- One full-screen fragment, no post-processing (perf budget).
- This is the transferable TSL skill for step 8; explore, don't just copy.

---

## Workstream C — Halloween palette data (session 3)

**Skill:** the content/theme separation the whole plan is built on — data vs. code.

**Prerequisite:** B merged (background reads a palette), A merged.

### Session start
- Read: `src/content/types.ts` (`Theme.background: unknown`), `src/rendering/Scene.ts`, `src/rendering/Materials.ts`.
- Run: `pnpm dev`.

### Work
- [You] Create `src/content/themes/halloween.ts` exporting a palette: background top/bottom, vignette tint, key/fill/rim light tints, and target/restricted accent colors.
- [You] Fix the palette's field names/types — this *is* the `Theme.background` shape.
- [I] Once fields are fixed: give `Theme.background` a real type in `content/types.ts` (replacing `unknown`) and thread the palette through `Scene.ts` lighting + `createBackgroundNode`.

### Success signal
Swapping only the palette changes the entire scene (background + lights + accents) with zero gameplay code change. `content/types.ts` no longer says `background: unknown`.

### Notes
- This is the first real `content/` data and the pattern every later theme (step 7) copies.
- Gameplay must never read any of this — keep palette access rendering-only.

---

## Workstream D — Lighting / tone-mapping mood pass (session 4)

**Skill:** PBR lighting, tone mapping, color management, why shadows are deferred.

**Prerequisite:** C merged (palette exists), A merged (framing stable).

### Session start
- Read: `src/rendering/Scene.ts`, `src/content/themes/halloween.ts`, `src/main.ts`, `docs/PERF-BUDGET.md`.
- Run: `pnpm dev` with the placeholder still present for a lit subject.

### Work
- [You] Tune ambient/key/fill/rim intensities and tints against real geometry and the background; land readable silhouettes.
- [I] Wire `renderer.toneMapping` (+ `toneMappingExposure`) and confirm `outputColorSpace`, so what you tune is what ships.
- [You] Decide tone mapping: `NoToneMapping` vs. `ACESFilmicToneMapping` (or similar) — pick by eye, note the tradeoff.
- [You] Confirm no shadows (Decision E): verify a flat, unshadowed cube still separates from the background via the rim light.

### Success signal
Cubes read clearly against the background; no blown highlights; the look survives with tone mapping on in both renderer backends.

### Notes
- Tone mapping changes *all* colors — do it before final palette judgement, not after.
- No post-processing, no shadow maps (perf budget).

---

## Workstream E — Play-area bounds numbers + debug overlay (session 5)

**Skill:** world-space reasoning, debug visualization as a habit, keeping debug out of production.

**Prerequisite:** A merged (bounds + fit), D merged (lighting) so the bounds read against the final look.

### Session start
- Read: `src/config.ts` (PLAY_BOUNDS), `src/rendering/Camera.ts`, `src/main.ts`.
- Run: `pnpm dev`.

### Work
- [I] New `src/rendering/PlayArea.ts`: allocation-free `contains(bounds, x, y)` / `clampToBounds(bounds, out)`, plus a `LineLoop` rect sized to `PLAY_BOUNDS`, gated behind `DEBUG_PLAYFIELD` in `config.ts`.
- [You] Set the final `PLAY_BOUNDS` numbers and the **launch line** (`minY`, where step 3 objects will appear); confirm the drawn rect matches.
- [You] Decide whether the swipe projector or input should ignore points outside bounds now, or defer to step 5 collision.

### Success signal
Drawn arena matches the numbers, stays fully framed per workstream A at every aspect, and the rect is absent from the production bundle when `DEBUG_PLAYFIELD` is false.

### Notes
- `contains`/`clampToBounds` are the contract step 3's `Spawner` consumes; keep them pure and testable.
- Debug geometry must be dead-code-eliminated in `pnpm build` (Vite drops `import.meta.env.DEV` blocks).

---

## Workstream F — Aspect policy confirmation + close-out (session 6)

**Skill:** separating a product decision from code; verification as a gate.

**Prerequisite:** A–E merged.

### Session start
- Read: this file end to end, `src/config.ts`, `scripts/verify-playfield.ts`.
- Run: `pnpm verify:playfield`, then `pnpm build`.

### Work
- [You] Confirm Decision B (fit-bounds) still holds after living with the look; sign off the aspect matrix.
- [Pair] Delete `rendering/placeholder.ts` and its import; remove the dead CSS-canvas gradient from `src/style.css`; make `main.ts` a clean composition root (reframe + background + play area).
- [I] Finalize `scripts/verify-playfield.ts` (see Verification), wire into `tsconfig` like the foundation harness.
- [I] `docs/PERF-BUDGET.md` note on the background fragment cost; `CHANGELOG.md` entry; README link to this file.
- [You] On-device sign-off: `pnpm preview:mobile` in portrait.

### Success signal
Definition of done below is fully checked; no draco/basis in `dist/assets`; device shows the arena fully framed.

### Notes
- Placeholder deletion belongs here, not earlier, so A–E have a lit subject to tune against.

---

## Boring work I take throughout

- `config.ts` restructure into `CAMERA` / `PLAY_BOUNDS` / `BACKGROUND` / `DEBUG` blocks with derived constants.
- Fit-to-bounds pure function + camera reframing in `createViewportSync`.
- `createCamera` signature refactor + `main.ts` composition.
- Palette-drive `Scene.ts`; wire `backgroundNode` incl. the `@types/three` gotcha; tone mapping / color space.
- Delete `placeholder.ts`; remove dead CSS gradient.
- `PlayArea.ts` helpers + debug rect scaffold.
- Type-up `Theme.background` after C fixes the fields.
- Verification harness + runs; docs; commit hygiene.

## Verification

```bash
pnpm verify:playfield
pnpm exec tsc --noEmit && pnpm exec oxfmt --check && pnpm exec oxlint && pnpm build
ls dist/assets | grep -E 'draco|basis|ktx2' # expect no output
```

`scripts/verify-playfield.ts` asserts:

- `computeFitDistance` is monotonic in aspect and always ≥ the pure-height distance.
- Projected `PLAY_BOUNDS` corners land inside NDC across the aspect matrix (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 9:19.5).
- `contains`/`clampToBounds` are correct at edges and out-of-range inputs.
- The swipe projector still lands exactly on `z = GAME_PLANE_DEPTH` (regression: framing must not move the play plane).

Dev smoke: background TSL compiles, debug rect visible, ~60 FPS, no console errors.

Device (the only measurement that counts): `pnpm preview:mobile` portrait — arena fully visible, backend logged as `WebGPUBackend` or `WebGL2Backend` — both must be checked.

## Risks / gotchas

- `scene.backgroundNode` is missing from `@types/three` → cast/module-augment; tsc must stay clean.
- Fit math is exact only because Decision A makes the play plane view-perpendicular; re-adding tilt in step 9 needs a margin or a numeric fit.
- WebGPU is only verifiable on a real device; many phones run the WebGL2 fallback (step 1 caveat still applies).
- Tone mapping done after palette tuning invalidates the tuning — order matters.
- Never import `three/examples/jsm/Addons.js` (step 1's 1.9 MB lesson).
- Background is one cheap full-screen pass; no post-processing.

## Definition of done

- [ ] Bounds rectangle fully framed at all target aspects; no unfair off-screen spawn region.
- [ ] Background is one theme-driven `backgroundNode`; dead CSS gradient removed.
- [ ] Lighting + palette live in `content/themes/halloween.ts`; swapping palette needs no code change.
- [ ] `content/types.ts` has a real `Theme.background` type (no `unknown`).
- [ ] `placeholder.ts` gone; `main.ts` is a clean composition root.
- [ ] `pnpm verify:playfield` green; tsc/lint/fmt/build green; no draco/basis.
- [ ] `docs/PLAN-STEP-2-playfield.md` + `CHANGELOG.md` + README link landed.
- [ ] Verified on a phone in portrait before calling step 2 shippable.

## Commit plan

1. `feat: playfield camera fit + bounds config` (A)
2. `feat: TSL gradient background` (B)
3. `feat: halloween palette + Theme.background type` (C)
4. `feat: lighting + tone-mapping pass` (D)
5. `feat: play-area helpers + debug overlay` (E)
6. `chore: drop placeholder, close step 2` + docs (F)
