# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 2 (`docs/PLAN-STEP-2-playfield.md`)

Workstreams run **sequentially A → B → C → D → E → F** (one per session).

- **A — camera fit + bounds config:** DONE (`5d60461`). `PLAY_BOUNDS`, `CAMERA`,
  `DEBUG_PLAYFIELD` in `src/config.ts`; `computeFitDistance`/`applyFraming`/
  `createViewportSync` in `src/rendering/Camera.ts`; DEV arena outline in `main.ts`.
- **B — TSL gradient background:** DONE (`3d6158d`). `createBackgroundNode(palette)`
  plus `BackgroundPalette` in `src/rendering/Materials.ts`; `scene.backgroundNode`
  set in `src/rendering/Scene.ts`; dead CSS canvas gradient removed from `src/style.css`.
- **C — Halloween palette data:** DONE (`5125a01`). `Theme.background` is typed
  (`ThemeGradient`/`ThemeLighting` in `content/types.ts`); `halloween.ts` palette
  threads through `Scene.ts` lights + `createBackgroundNode`.
- **D — lighting/tone-mapping pass:** DONE (uncommitted). `TONE_MAPPING` (default
  `'aces'`) + `TONE_MAPPING_EXPOSURE` + `LIGHTING` intensities in `config.ts`
  (RENDER block); applied in `main.ts` (`toneMapping`/`toneMappingExposure`/
  `outputColorSpace`). Gotcha learned: `backgroundNode` is composited through the
  same output transform, so tone mapping shifts palette colors too — tune palette
  with the final tone-mapping setting.
- **E — play-area bounds + debug overlay:** DONE (uncommitted).
  `src/rendering/PlayArea.ts` (`contains`/`clampToBounds`/`createDebugRect`);
  `LAUNCH_LINE_Y`
  derived in `config.ts`; `main.ts` gated `DEBUG_PLAYFIELD` block. Verified the
  rect is dead-code-eliminated from `dist` (grep `3074208`/`2ee6a0` → none).
- **F — close-out:** DONE (uncommitted). `placeholder.ts` + `createPulseMaterial`
  deleted; `main.ts` is composition-only; `scripts/verify-playfield.ts` +
  `pnpm verify:playfield` wired; CHANGELOG/README/PERF-BUDGET updated.
- **Blade trail** (step-4 visual) was done early: `src/rendering/BladeTrail.ts` +
  `Input` stroke handlers (`3102827`).
- **Course correction (2026-10-16, [You], uncommitted):** Decision B flipped to
  **full-width**. `PLAY_BOUNDS` → `PLAYFIELD` (`{ halfHeight, centerY, sideMargin }`);
  `computeFitDistance`/`applyFraming` → `computePlayBounds` + `createPlayField`
  (constant camera distance); `createViewportSync` reframes the live `playfield` and
  redraws the debug rect via `writeDebugRect`. Both harnesses rewritten. Also added
  a temporary `src/rendering/DevCube.ts` lit subject (tilted 45° on X, spinning on Y).

### NEXT: step-2 [You] sign-offs, then step 3 (object launching)

Step-2 code is complete; these are human calls, not code:

1. [You] Tune `LIGHTING` + `halloween.ts` palette by eye (placeholder is gone —
   re-add one locally or wait for step-3 cubes as the lit subject); pick
   `TONE_MAPPING` (`'aces'` default, `'none'`/`'neutral'` available).
2. [You] Set final `PLAYFIELD.halfHeight` + `sideMargin` (width is derived) +
   `LAUNCH_LINE_Y`; confirm the drawn rect matches.
3. [You] Decide: projector/input ignores out-of-bounds points now, or defers to
   step 5 collision (currently defers).
4. [You] Confirm full-width (Decision B) across the aspect matrix + on device
   (`pnpm preview:mobile`), both renderer backends.

No workstream to implement next — step 3 (`docs/` plan TBD) starts fresh.

## Locked decisions (Step 2)

A straight-on perspective · B **full-width** aspect policy (was fit-bounds) · C background = `scene.backgroundNode` (TSL, not a plane) · D **height fixed, width derived from aspect** (was portrait-first bounds) · E no shadow maps.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
