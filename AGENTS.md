# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 3 (`docs/PLAN-STEP-3-launching.md`)

Workstreams run **sequentially A → B → C → D → E** (one per session). Step 2 is
fully committed and closed; its pending [You] eyeball tuning (lighting/palette,
`PLAYFIELD` numbers, aspect sign-off) is still welcome, nothing blocks on it.

- **A — pooled sim + physics:** DONE (`72f13ad`). `game/SpawnedObject.ts` (state struct;
  `resetSpawnedObject` zeroes rotation/velocity on recycle; `boxBoundingRadius`);
  `game/Physics.ts` (`step(pool, bounds, dt)`: integrate, despawn past launch line /
  outside sideways → `pool.release`); `Pool` gained `items` (construction-order slots,
  view binding only — sim iterates with `each`); `GRAVITY = 20` in `PHYSICS` block.
- **B — object views:** DONE (`95ba761`). `rendering/ObjectViews.ts`: `createObjectViews`
  (one mesh/slot, geometry shared per model, one material per category tinted from
  `theme.accents`) + `syncViews` in `render` (latest-state copy, no interpolation).
- **C — spawn rules + theme objects:** DONE (`d906a88`). Real `SpawnRules`
  (`RampRange{early,late}` for interval/batch, constant tuples for speed/apex/depth/spin,
  `sideLaunchChance`); `halloween.ts` has `pumpkin` (target +1) / `skull` (restricted −1),
  edge-1.0 boxes; `PLAYFIELD.sideMargin` 0.6 → 1.0 (covers radius 0.87); volley fires
  random theme defs so both accents show.
- **TEMP in `main.ts`:** hand-launch volley — 3 at a time, refills when the field empties,
  closed-form aim. Workstream D replaces it wholesale with `Spawner`; only the
  acquire → fill → `active = true` contract survives.
- **Course correction (2026-10-18, [You]):** decision E overridden — interval/batch
  **ramp with round progress** (interval 1.2–2.0s → 0.6–1.1s, batch 1 → 2–3). D threads
  `progress` (0→1); stubbed until step 6 owns the round timer.
- Blade trail (step-4 visual) done early: `src/rendering/BladeTrail.ts` + `Input` handlers.
- `rendering/DevCube.ts` deleted — pooled cubes are the lit subject now.
- Real models/assets are **not now**: step 7 (content) / step 9 (payload). The
  `ObjectModel` union is already paid for — swapping art touches only `halloween.ts`.

### NEXT: step 3 workstream D — Spawner trajectories (then E, close-out)

- [I] Real `Spawner` (`game/Spawner.ts`): timer on `dt`, batch from `batchRange`, aim math
  (`vy = sqrt(2g·apexΔy)`, `tFlight = 2·vy/g`, `vx = (targetX − x0)/tFlight`), side launches
  at `sideLaunchChance`, injectable `rand`, pool exhaustion = skip, never grow. Read plan
  workstream D before starting.
- [You] Tune interval/batch/apex/spin + `GRAVITY` by eye.
- [I then] Workstream E: `scripts/verify-launch.ts` + `pnpm verify:launch`, delete the TEMP
  volley, close-out docs. Plan §E lists the exact assertions.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress *(overridden 2026-10-18)* · F injectable `rand`.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
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
