# AGENTS.md — Slash Master

Handoff + orientation for new agent sessions. Read this first, then `PLAN.md`
and the active step plan in `docs/`.

## Project

Fruit-Ninja–style 2.5D slicing game (Three.js Journey Challenge: Halloween, Oct 2026).
Built in numbered steps 1–10 (`PLAN.md`); each step has a detailed plan in `docs/`.

**Stack:** Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA.
Play plane is `z = 0`; camera is straight-on modest perspective; full-width play area (height fixed, width derived from aspect).

## Current state — Step 9 COMPLETE (`docs/PLAN-STEP-9-polish.md`)

Workstreams **A → B → C → D** landed 2026-10-25. Steps 1–8 remain closed;
pending [You] eyeball/on-device tuning carries over, nothing blocks on it.

- **A — cut juice:** `e326074`. `game/Effects.ts` spark ring (`EFFECTS`),
  `rendering/SparkViews.ts` one `InstancedMesh` per category over one unit
  shard (instance scale = world size), `rendering/Shake.ts` scalar trauma
  (quadratic falloff, sine phases, base camera pose captured, applied after
  `syncViewport`). The cut sink bursts sparks + shake from the parent before
  `pool.release`.
- **B — scoring:** `bba7c4d`. `game/Combo.ts` per-stroke additive bonus
  (`COMBO.step × (k − 1)`), stroke identity from `Swipes.stroke`; HUD combo
  line with 700 ms hold + 300 ms fade. Third category `hazard` +
  `GameObjectDefinition.weight` (prefix-sum weighted `Spawner` pick); `bomb`
  (−3) / `coal` (−2), weight 0.15 → ~3.6 % of spawns. `ui/records.ts` best
  score (`slash-master.best`) on the game-over card.
- **C — audio/haptics:** `0bf9428`. `audio/Audio.ts` procedural synth, context
  unlocked inside the first gesture (iOS rule) with a failure latch; voices
  `swoosh/pop/boom/combo/over/ui`, pop stacking capped at 40 ms.
  `ui/haptics.ts` vibrate patterns (silent where absent). HUD mute
  (`slash-master.muted`) silences audio + haptics.
- **D — flow + close-out:** `game/Flow.ts` (`ready | playing | paused`), start
  card at boot, pause button + resume card, `fixedUpdate` gated on
  `flow.active && !round.over`, pause cancels the stroke and clears the swipe
  buffer; restart skips the start card. The pause button hides while a card is
  up, so overlays never have a live control behind them.
- **Tests:** foundation 58, playfield, launch (+2 weighted), swipe 47, cut 68,
  rules 40 (+8 combo), content 133 (+22 hazard/weight/bake), perf 79 (+25
  spark views + allocation guard), polish 51 (audio/haptics/records/flow).
- **Not built (deliberate):** runtime theme swap (step 10), texture atlases /
  glTF, audio/image assets, LOD/occlusion, analytics.

### Open items for next session

- **[You] Step 9 by eye/on device:** spark size/life, shake strength,
  combo copy + linger, bomb/coal read, audio mix, Android buzz, start/pause
  flow — and `draws ≤ 17` while swiping (12 instanced + 3 spark meshes +
  background + blade trail) at 60 FPS, both themes.
- **[You] carry-over tuning:** `CUT`/`SWIPE`/`EFFECTS`/`SHAKE` feel,
  lighting/palette, `PLAYFIELD` numbers, arcs, HUD sizes/copy,
  `ROUND.duration` + ramp feel, `COMBO.step`, hazard weights.
- **Next step:** step 10 (per PLAN §10) — write `docs/PLAN-STEP-10-*.md` at
  session start; step 9's baseline is a paced round: start card, felt cuts,
  combo scoring, rare hazards, synth sound, persisted best.

## Locked decisions

**Step 2:** A straight-on perspective · B **full-width** aspect policy · C background = `scene.backgroundNode` (TSL, not a plane) · D height fixed, width derived from aspect · E no shadow maps.
**Step 3:** A no interpolation (latest-state copy) · B depth band ±1 (step 5 collision = 3D sphere-vs-segment) _(band pinned to z=0 2026-10-21 — chopping bug; collision stays 3D)_ · C plain meshes, not `InstancedMesh` (step 8) · D `main.ts` injects theme data; gameplay never imports the theme file · E ramps with round progress _(overridden 2026-10-18)_ · F injectable `rand`.
**Step 4:** A buffer home = `game/Swipes.ts` (gameplay, DOM-free; `Input` stays a dumb adapter) · B gate = per-stroke world travel ≥ `SWIPE.gateDistance`, opens once, holds to stroke end · C drain at top of `fixedUpdate` (step 5 tests pre-move positions) · D `visibilitychange` clear lives in `main.ts`.
**Step 5:** A pieces = separate debris ring, never the object pool (re-slice/score impossible by construction) · B piece geometry = `def.pieces?` authored at final size, else scaled clone (`pieceScale`) · C score rides on `SpawnedObject.score` (launch-set, reset-zeroed) · D hit test = pure scalar 3D sphere-vs-segment + `CUT.pad` · E cut runs inside the drain (pre-move); score + pieces fire BEFORE release.
**Step 6:** A round clock = `game/Round.ts` (scalar state, `over` latch) · B `round.step` runs last in `fixedUpdate`; `over` → freeze mid-air · C `round.progress` feeds the spawn ramp (3E un-parked) · D HUD = `ui/hud.ts` on the step-1 root, DOM writes only on integer change · E restart re-arms every mutable system (score/round/spawner/pool/debris/swipes) · F missed fruit: no consequence (PLAN §6).
**Step 7:** A procedural parts models, no assets · B `ObjectModel` parts | asset (asset = step-9 seam) · C bake once at boot, one geometry per def · D one material per category, accent = emissive · E boot-time `?theme=` registry · F default `pieceScale` clone, pumpkin authored halves · G `size` = max extent, radius ≤ `sideMargin` · H gameplay never imports themes/models (harness) · I Christmas per PLAN §7 · J no deps; only `BufferGeometryUtils` addon · K HUD unchanged · L `getTheme` + boot resolution; `setTheme` is step 10.
**Step 8:** A one `InstancedMesh` per def (per-category would need merged shapes) · B capacity = `POOL_SIZE` / `CUT.capacity` · C `count` is the draw count; one reused `Object3D`; no instance ids · D `frustumCulled = false` · E scene graph = defs × 3, pool-size independent · F zero steady-frame allocation, harness-guarded · G `verify:perf` headless; draw calls + frame time measured on device · H `DEBUG_PERF` 1 Hz readout · I pools/pixel cap/hidden pause/low-poly/TSL already done · J no deps.
**Step 9:** A sparks = one `InstancedMesh` per category over one unit shard (per-instance colour unproven on `WebGPURenderer`) · B shake = scalar trauma, quadratic falloff, applied after `syncViewport` · C combo = per-stroke additive from `Swipes.stroke` (no stroke-end resolution) · D hazard = third category, negative score, no round end · E spawn rarity = per-def `weight`, prefix sums at construction · F records = guarded `localStorage`, in-memory fallback, write-on-beat only · G audio = procedural synth, unlock inside the gesture, one context per page · H haptics = `navigator.vibrate`, silent no-op, follows mute · I flow = start card + pause card, restart skips the start card, `GameLoop` hidden-tab pause stays authoritative · J verification = `verify:polish` + content/perf updates, feel stays by eye · K draw budget ≤ 17 (12 instanced + 3 spark meshes + background + blade trail) · L no deps, no assets; app chunk delta measured +3.2 kB gzip (target revised from ~2.5).

## Commands

```
pnpm dev                 # dev server
pnpm build               # production build (also check no draco/basis in dist/assets)
pnpm verify:foundation   # bun scripts/verify-foundation.ts — 58 foundation checks
pnpm verify:playfield    # bun scripts/verify-playfield.ts — fit/bounds/projector regression
pnpm verify:launch       # bun scripts/verify-launch.ts — aim/integration/despawn/spawner
pnpm verify:swipe        # bun scripts/verify-swipe.ts — buffer/gate/Input (47 checks)
pnpm verify:cut          # bun scripts/verify-cut.ts — hit test/slicer/score/debris (68 checks)
pnpm verify:rules        # bun scripts/verify-rules.ts — round/reset/ramp/combo (40 checks)
pnpm verify:content      # bun scripts/verify-content.ts — theme/bake/isolation/hazard (133 checks)
pnpm verify:perf         # bun scripts/verify-perf.ts — instances/draw ceiling/no-allocation (79 checks)
pnpm verify:polish       # bun scripts/verify-polish.ts — audio/haptics/records/flow (51 checks)
pnpm lint                # oxlint
pnpm fmt                 # oxfmt (write); use --check to verify
```

Always finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:playfield` → `pnpm verify:launch` → `pnpm verify:swipe` → `pnpm verify:cut` → `pnpm verify:rules` → `pnpm verify:content` → `pnpm verify:perf` → `pnpm verify:polish` → `npx vite build`.

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
- Dev overlays are opt-in: `?dev` on the dev server (stats.js meter bottom-left + playfield guide rect). Production builds drop both.
- Pre-existing: `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Never commit unless explicitly asked. Commit messages: `feat: …` / `chore: …`.
