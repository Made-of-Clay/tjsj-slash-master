# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 6 COMPLETE (`docs/PLAN-STEP-6-rules.md`)

Workstreams **A → B → C → D** all landed (`a4cf524` + `a088c64`, 2026-10-21).
Steps 1–5 committed and closed (chopping-bug fix `72bb752`); pending [You]
eyeball tuning unchanged, nothing blocks on it.

- **A+B — round + HUD:** `a4cf524`. `game/Round.ts` — countdown, `over` latch,
  `progress`, `secondsLeft` (ceil); `ROUND.duration = 30`; `fixedUpdate`
  early-returns while over (freeze mid-air, Decision C), clock runs **last**
  (Decision B), and `spawner.step(…, round.progress)` finally un-parks the
  spawn ramp (3E). `ui/hud.ts` — centered `Score: N / Time: T` bar + game-over
  card (final score, whole card = restart button); DOM writes only when a
  displayed integer changes. `restart()` re-arms score/round/spawner,
  `Pool.releaseAll()`, debris + swipes clear. Review fixes: `.game-over[hidden]`
  (CSS display beat the `hidden` attr) and `pointer-events: auto` on the card.
- **C — verification:** `a088c64`. `scripts/verify-rules.ts` + `pnpm verify:rules`
  (32 checks): buzzer latches exactly once, ceil `secondsLeft`, reset round =
  round 1 (clock + spawner cadence + skip counter), ramp bites (7 launches vs
  2 at flat progress), `Pool.releaseAll` semantics, config sanity.
- Missed fruit: no consequence (PLAN §6 — nothing implemented). No start
  screen (step 9). Real models/assets: step 7; InstancedMesh: step 8.

### Open items for next session

- **[You] Step 6 by eye/on device:** HUD look (sizes/colours), card copy, 30 s
  length + ramp feel — tune `ROUND.duration` and theme RampRanges; on-device
  portrait, 60 FPS, both backends.
- **[You] Step 2/3/4/5 tuning (carry-over):** `CUT` knob feel, `SWIPE.gateDistance`
  by thumb, lighting/palette, `PLAYFIELD` numbers, arcs by eye; deferred `GRAVITY`
  naming (2026-10-20, options listed in CHANGELOG).
- **Next step:** step 7 (content/theme abstraction) — write
  `docs/PLAN-STEP-7-content.md` at session start: real models behind the
  `ObjectModel`/`pieces?` seams, a second theme proving the data-only swap
  (PLAN §7/§10 `setTheme`), gameplay stays theme-ignorant (Decision 3D).

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) _(band pinned to z=0 2026-10-21 — chopping bug; collision stays 3D)_ · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.
**Step 5:** A pieces = separate debris ring, never the object pool (re-slice/score impossible by construction) · B piece geometry = `def.pieces?` authored at final size, else scaled clone (`pieceScale`) · C score rides on `SpawnedObject.score` (launch-set, reset-zeroed) · D hit test = pure scalar 3D sphere-vs-segment + `CUT.pad` · E cut runs inside the drain (pre-move); score + pieces fire BEFORE release.
**Step 6:** A round clock = `game/Round.ts` (scalar state, `over` latch) · B `round.step` runs last in `fixedUpdate`; `over` → freeze mid-air · C `round.progress` feeds the spawn ramp (3E un-parked) · D HUD = `ui/hud.ts` on the step-1 root, DOM writes only on integer change · E restart re-arms every mutable system (score/round/spawner/pool/debris/swipes) · F missed fruit: no consequence (PLAN §6).

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (44 checks)
pnpm verify:cut          # bun scripts/verify-cut.ts — hit test/slicer/score/debris (68 checks)
pnpm verify:rules       # bun scripts/verify-rules.ts — round/reset/ramp (32 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:launch` → `pnpm verify:swipe` → `pnpm verify:cut` → `pnpm verify:rules` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- **Code comments:** aim for 0 (self-documenting names/structure). 1–2 lines when
  a why, invariant, or non-obvious contract must be stated; 4+ only for real
  gotchas. Never narrate what the code visibly does. Update stale comments with
  the code — a wrong comment is worse than none.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
