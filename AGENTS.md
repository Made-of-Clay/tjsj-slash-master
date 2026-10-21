# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 4 COMPLETE (`docs/PLAN-STEP-4-swipe.md`)

Workstreams **A → B → C → D → E** all landed (`9c52911` + `898db5e`, 2026-10-20).
Steps 1–3 are committed and closed; their pending [You] eyeball tuning (lighting/palette,
`PLAYFIELD` numbers, arcs/interval-batch by eye) is still welcome, nothing blocks on it.

- **A–C — gated swipe buffer:** `9c52911`. `game/Swipes.ts` — ring buffer (cap 32,
  copy-on-push, drop-oldest); gate: per-stroke travel ≥ `SWIPE.gateDistance` (0.5 world
  units on the play plane, 0 = ungated) opens once and holds until stroke end, crossing
  segment buffered whole; `beginStroke`/`endStroke` wired from `Input`. `main.ts`: drain at
  top of `fixedUpdate` (pre-spawner/physics), `visibilitychange` → `clear()`, dev probe
  removed. `Collision.ts` header → Step 5.
- **D — verification:** `898db5e`. `scripts/verify-swipe.ts` + `pnpm verify:swipe`
  (44 checks): buffer/ring/copy/gate/allocation proxy + `Input` driven by synthetic
  pointer events (bun has no DOM — minimal `EventTarget` stand-in).
- Blade trail landed in the step-3 session: `src/rendering/BladeTrail.ts` + `Input` stroke
  handlers; visual polish stays step 9. `DEBUG_SWIPE` logs consumption only.
- `progress` stubbed at `0` until step 6 owns the round timer.
- Real models/assets are **not now**: step 7 (content) / step 9 (payload).

### Open items for next session

- **[You] Step 4 by thumb:** `SWIPE.gateDistance` (0.5) in `pnpm dev` — tap/jitter must not
  slash, slow drag must; on-device portrait (`pnpm preview:mobile`) — trail latency both
  backends, fast flicks + slow drags feel right.
- **[You] Step 2/3 tuning (carry-over):** lighting/palette, `PLAYFIELD` numbers, aspect
  sign-off; interval/batch/apex/spin + `GRAVITY` by eye; arcs in frame, 60 FPS.
- **[You] deferred — `GRAVITY` name (2026-10-20).** It is literal acceleration in `Physics`,
  but the Spawner's closed-form aim (`vy=√(2g·Δy)`, `tFlight=2vy/g`) cancels it out of the
  apex — so it tunes arc **tempo**, not height (`apexRange` is the height knob). Options:
  keep + doc · `ARC_GRAVITY` · `ARC_TEMPO` · reshape for real-gravity feel. Config comment
  is stale. **No change made.**
- **Next step:** step 5 (cutting) — write `docs/PLAN-STEP-5-cutting.md` at session start
  (same pattern as steps 3/4). Consumes the drained segments: 3D sphere-vs-segment
  collision (Decision 3B) against live pooled objects + `radius`, sliced geometry, scoring.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (44 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:launch` → `pnpm verify:swipe` → `npx vite build`.

## Conventions / gotchas

- Keep replies ULTRA-TERSE. Ownership tags: **[I]** agent, **[You]** human, **[Pair]** scaffold-then-decide.
- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from
  `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on GPU at runtime, so `vite build` does NOT prove a node graph works;
  construct the graph in isolation to smoke-test it.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
