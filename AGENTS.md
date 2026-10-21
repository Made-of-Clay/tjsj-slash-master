# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 3 COMPLETE (`docs/PLAN-STEP-3-launching.md`)

Workstreams **A → B → C → D → E** all landed (D/E uncommitted as of 2026-10-20).
Step 2 is committed and closed; its pending [You] eyeball tuning (lighting/palette,
`PLAYFIELD` numbers, aspect sign-off) is still welcome, nothing blocks on it.

- **A — pooled sim + physics:** `72f13ad`. `game/SpawnedObject.ts`; `game/Physics.ts`
  (`step(pool, bounds, dt)`: integrate, despawn past launch line / sideways → `pool.release`);
  `Pool.items`; `GRAVITY = 20`.
- **B — object views:** `95ba761`. `rendering/ObjectViews.ts` (`createObjectViews` +
  `syncViews` in `render`, latest-state copy, no interpolation).
- **C — spawn rules + theme objects:** `d906a88`. Real `SpawnRules`
  (`RampRange{early,late}` for interval/batch); halloween `pumpkin`/`skull` boxes;
  `PLAYFIELD.sideMargin` 1.0.
- **D — Spawner trajectories:** `game/Spawner.ts` real — `dt` timer, ramped interval/batch
  on `progress`, closed-form aim (`launchVy`/`flightTime`/`aimVx`, exported pure), side
  launches, injectable `rand`, pool exhaustion = skip+count. `SPAWN` + `DEBUG_SPAWN` config.
  TEMP volley deleted; `main.ts` runs `spawner.step(objects, bounds, dt, 0)` + `physics.step`.
  **`apexRange` = fraction of FULL field height above the launch line** (per the `SpawnRules`
  contract, not the older plan formula); a hard `vy` ceiling keeps any data in frame.
- **E — verification + close-out:** `scripts/verify-launch.ts` + `pnpm verify:launch`
  (38 checks). PERF-BUDGET allocation item closed. `DevCube.ts` gone.
- `progress` stubbed at `0` until step 6 owns the round timer.
- Blade trail (step-4 visual) done early: `src/rendering/BladeTrail.ts` + `Input` handlers.
- Real models/assets are **not now**: step 7 (content) / step 9 (payload).

### Open items for next session

- **D/E uncommitted.** Intended commits: `feat: trajectory spawner` (D) +
  `chore: launch verification harness, close step 3` (E). Touched: `src/config.ts`,
  `src/main.ts`, `src/game/Spawner.ts`, `scripts/verify-launch.ts`, docs. Nothing else is dirty.
- **[You] Step 3 tuning:** interval/batch/apex/spin + `GRAVITY` by eye; on-device portrait
  (`pnpm preview:mobile`) — arcs in frame, 60 FPS, both backends.
- **[You] deferred — `GRAVITY` name (2026-10-20).** It is literal acceleration in `Physics`,
  but the Spawner's closed-form aim (`vy=√(2g·Δy)`, `tFlight=2vy/g`) cancels it out of the
  apex — so it tunes arc **tempo**, not height (`apexRange` is the height knob). Options:
  keep + doc · `ARC_GRAVITY` · `ARC_TEMPO` · reshape for real-gravity feel. Config comment
  is stale. **No change made.**
- **Next step undecided:** step 4 (swipe system) vs step 5 (cutting) — no plan doc yet. Author
  `docs/PLAN-STEP-4-*.md` at session start. `Input` + `BladeTrail` already exist; step 5
  collision consumes the live pooled objects + `radius` (Decision 3B: 3D sphere-vs-segment).

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:launch` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
