# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; portrait-first tall play area.

## Current state — Step 2 (`docs/PLAN-STEP-2-playfield.md`)

Workstreams run **sequentially A → B → C → D → E → F** (one per session).

- **A — camera fit + bounds config:** DONE (`5d60461`). `PLAY_BOUNDS`, `CAMERA`,
  `DEBUG_PLAYFIELD` in `src/config.ts`; `computeFitDistance`/`applyFraming`/
  `createViewportSync` in `src/rendering/Camera.ts`; DEV arena outline in `main.ts`.
- **B — TSL gradient background:** DONE (`3d6158d`). `createBackgroundNode(palette)`
  plus `BackgroundPalette` in `src/rendering/Materials.ts`; `scene.backgroundNode`
  set in `src/rendering/Scene.ts`; dead CSS canvas gradient removed from `src/style.css`.
- **Blade trail** (step-4 visual) was done early: `src/rendering/BladeTrail.ts` +
  `Input` stroke handlers (`3102827`).

### NEXT: Workstream C — Halloween palette data

Goal: first real `content/` data; the data-vs-code separation the plan is built on.

1. [You] Create `src/content/themes/halloween.ts`: background top/bottom, vignette
   tint, key/fill/rim light tints, accent colors.
2. [You] Fix the palette field names/types — this _is_ the `Theme.background` shape.
3. [I] Then give `Theme.background` a real type in `src/content/types.ts`
   (replacing `unknown`) and thread the palette through `Scene.ts` lighting +
   `createBackgroundNode`.
   Success: swapping only the palette changes background + lights + accents, with
   zero gameplay code change; `content/types.ts` no longer says `background: unknown`.
   Note: gameplay must never read theme/palette data — rendering-only.

## Locked decisions (Step 2)

A straight-on perspective · B fit-bounds aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D tall portrait-first bounds · E no shadow maps.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 52 foundation checks
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
