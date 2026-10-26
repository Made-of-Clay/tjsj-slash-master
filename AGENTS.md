# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 7 COMPLETE (`docs/PLAN-STEP-7-content.md`)

Workstreams **A → B → C → D** landed 2026-10-22/23. Steps 1–6 remain closed;
pending [You] eyeball tuning carries over, nothing blocks on it.

- **A — model seam + bake:** `f796649` + `fa878b4`. `ObjectModel` =
  `{ parts, size }` | `{ asset, size }` (asset = step-9 loader seam; bake
  throws). `rendering/Model.ts` `bakeModel`: clone parts, strip uv/uv1/tangent,
  normalise indexing, bake local transforms, write linear vertex colours,
  `mergeGeometries` → one geometry per def. One `MeshStandardMaterial` per
  category (`vertexColors`, theme accent = emissive; `OBJECT_MATERIAL`).
- **B — Halloween art:** `f045f02`. `content/models/halloween.ts` —
  pumpkin/candy/skull producers; ghost dropped (white read as skull); pumpkin
  is the one def with authored halves (`def.pieces`, flesh caps facing out).
  Sizes ≤ 1.15 (candy) → max radius 0.996 ≤ `sideMargin`.
- **C — Christmas + registry:** `content/models/christmas.ts` (ornament,
  candyCane, gift, snowGlobe), `content/themes/christmas.ts`, and
  `content/themes/index.ts` (`THEMES`, `ThemeId`, `DEFAULT_THEME_ID`,
  `getTheme`, `resolveThemeId`). `main.ts` resolves `?theme=<id>` once before
  `createScene`, logs `theme: <id>`, injects the resolved `Theme`. Zero gameplay
  diffs.
- **D — harness:** `scripts/verify-content.ts` + `pnpm verify:content` (111
  checks): registry/fallback resolution, per-theme data contract, bake contract
  (attrs, stripped uv, colour count, bbox fits + centred, authored pieces fit
  their own size, asset throw, template untouched), spawn fit (`radius ≤
sideMargin`, slugs, size band), import-graph isolation (gameplay never imports
  themes/models; only `main.ts` imports the registry; rendering imports no
  concrete theme/model; content stays data-only), material config. Negative-tested
  by injecting a game → theme import.
- **Not built (deliberate):** runtime `setTheme` hot-swap, theme picker UI,
  glTF/textures, authored halves for every def, theme-tinted HUD — steps 9/10.
  InstancedMesh / draw-call work is step 8 (plain meshes stay).

### Open items for next session

- **[You] Step 7 by eye/on device:** both themes at 60 FPS (WebGPU + WebGL2),
  portrait readability, restricted emissive, pumpkin cut halves; candy size /
  palette feel; `?theme=christmas` on the installed PWA.
- **[You] carry-over tuning:** `CUT`/`SWIPE` feel, lighting/palette,
  `PLAYFIELD` numbers, arcs, HUD sizes/copy, `ROUND.duration` + ramp feel.
- **Next step:** step 8 (perf/InstancedMesh) — write
  `docs/PLAN-STEP-8-*.md` at session start; one mesh per pool slot and one draw
  call per category are the step-7 baseline.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) _(band pinned to z=0 2026-10-21 — chopping bug; collision stays 3D)_ · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.
**Step 5:** A pieces = separate debris ring, never the object pool (re-slice/score impossible by construction) · B piece geometry = `def.pieces?` authored at final size, else scaled clone (`pieceScale`) · C score rides on `SpawnedObject.score` (launch-set, reset-zeroed) · D hit test = pure scalar 3D sphere-vs-segment + `CUT.pad` · E cut runs inside the drain (pre-move); score + pieces fire BEFORE release.
**Step 6:** A round clock = `game/Round.ts` (scalar state, `over` latch) · B `round.step` runs last in `fixedUpdate`; `over` → freeze mid-air · C `round.progress` feeds the spawn ramp (3E un-parked) · D HUD = `ui/hud.ts` on the step-1 root, DOM writes only on integer change · E restart re-arms every mutable system (score/round/spawner/pool/debris/swipes) · F missed fruit: no consequence (PLAN §6).
**Step 7:** A procedural parts models, no assets · B `ObjectModel` parts | asset (asset = step-9 seam) · C bake once at boot, one geometry per def · D one material per category, accent = emissive · E boot-time `?theme=` registry · F default `pieceScale` clone, pumpkin authored halves · G `size` = max extent, radius ≤ `sideMargin` · H gameplay never imports themes/models (harness) · I Christmas per PLAN §7 · J no deps; only `BufferGeometryUtils` addon · K HUD unchanged · L `getTheme` + boot resolution; `setTheme` is step 10.

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (47 checks)
pnpm verify:cut          # bun scripts/verify-cut.ts — hit test/slicer/score/debris (68 checks)
pnpm verify:rules        # bun scripts/verify-rules.ts — round/reset/ramp (32 checks)
pnpm verify:content      # bun scripts/verify-content.ts — theme/bake/isolation (111 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:playfield` → `pnpm verify:launch` → `pnpm verify:swipe` → `pnpm verify:cut` → `pnpm verify:rules` → `pnpm verify:content` → `npx vite build`.

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
