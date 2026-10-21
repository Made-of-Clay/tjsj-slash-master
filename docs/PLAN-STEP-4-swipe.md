# Step 4 — Swipe system

Plan for [PLAN.md](../PLAN.md) §4. Extends it, doesn't replace it.

- Scope: swipes become world-space segments the fixed-step sim can consume deterministically, with tap/drift gating. **No collision test, no slicing** — that's step 5 (`Collision` consumes pooled objects + `radius`, Decision 3B sphere-vs-segment).
- Target: step 5 can start its session by reading `swipes.drain()` inside `fixedUpdate` and testing segments against pool slots.

Owner tags: **[I]** assistant, **[You]** user, **[Pair]** scaffold-then-decide.
Workstreams run **sequentially A → B → C → D → E**, one per session.

> **Status note.** The DOM adapter and trail visual landed early (step 3): `Input`
> already emits world-space `SwipeSegment`s and `BladeTrail` draws them. Step 4 is
> the _system_ around them — sim-loop integration + gating. The `Collision` stub's
> "Step 4" header comment is stale; the hit test is step 5 (per AGENTS.md).

## Session start (before workstream A)

- [I] ~~Land the two pending step-3 commits~~ **Already landed** at session start:
  `b206114` (D) + `6986c7e` (E). Prerequisite satisfied; tree held only this plan doc.
- [You] (non-blocking) step-3 eyeball tuning may ride along: interval/batch/apex/spin, `GRAVITY` naming (keep + doc · `ARC_GRAVITY` · `ARC_TEMPO`), on-device portrait check.

## What step 4 is really about

1. **Input is currently outside the sim.** `Input.onSwipe` fires synchronously from `pointermove` — decoupled from `GameLoop.fixedUpdate`. Step 5 collision must test segments against sim state inside the fixed step (deterministic, testable). Step 4 closes that gap: capture in the event handler, consume per fixed step.
2. **A swipe is a stroke, not a gesture.** Fruit-Ninja style: any deliberate drag cuts continuously; a tap or a resting finger must not. Gating lives here.
3. **Copy semantics debt.** `Input`'s `SwipeSegment.from/to` are reused instances — handlers "must copy them if they keep the values past the call". Step 5 will keep them, so the buffer step 4 builds owns its vectors.

## Decisions (proposed — lock at session 1)

| #   | Decision         | Proposal                                                                                                                                                                                                         | Rationale                                                                                                       |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A   | Buffer home      | New `src/game/Swipes.ts` (gameplay). `Input` stays a dumb DOM adapter; `main.ts` wires `input.onSwipe` → `swipes.push(segment)`                                                                                  | Layering: step 5 collision imports only `game/`, never DOM. Mirrors step 3's Decision D (data/code split).      |
| B   | Gate metric      | A stroke goes **live** after the pointer travels ≥ `SWIPE.gateDistance` world units (on the play plane); segments before that are discarded. Tap = no slash, drift = no slash                                    | One knob kills both. World units because bounds/sizes are world-space. Start ~0.5, [You] tunes.                 |
| C   | Segment lifetime | `swipes.drain()` in `fixedUpdate` returns segments captured since last step; unconsumed segments do NOT carry across steps (short-lived, PLAN §4). Max ~32 segments per step, ring buffer, overflow drops oldest | Coalesced events can stack several segments in one 1/60 s step; oldest misses matter least.                     |
| D   | Copy discipline  | Buffer preallocates its own `Vector3` slots, copies from `Input`'s reused instances. Zero per-segment allocation                                                                                                 | PERF-BUDGET; `Input` docs mandate the copy.                                                                     |
| E   | Blade trail      | Unchanged. It stays wired to stroke handlers (visual needn't be sim-deterministic). Fade/width polish is step 9                                                                                                  | Scope discipline.                                                                                               |
| F   | Collision.ts     | Untouched except the stale header comment (`Step 4` → `Step 5`). The test itself is step 5                                                                                                                       | AGENTS.md: "step 5 collision consumes the live pooled objects + radius". Pure math could land early, but scope. |
| G   | Stale comments   | Fix `main.ts` dev-probe comment ("Step 4 replaces it with collision tests" → step 5) when the probe is removed                                                                                                   | Comment honesty.                                                                                                |

## Files touched

```
src/config.ts                  SWIPE block (gateDistance)                      [I] scaffold, [You] numbers
src/game/Swipes.ts             new: segment ring buffer + stroke gating        [I]
src/game/Input.ts              likely unchanged; expose stroke state only if gating needs it [I]
src/main.ts                    wire input → swipes; drain in fixedUpdate; remove dev probe [I]
src/game/Collision.ts          header comment fix only                         [I]
scripts/verify-swipe.ts        new: buffer + gating checks (pure, no DOM)      [I]
package.json                   verify:swipe script                             [I]
docs/PLAN-STEP-4-swipe.md      this file                                       [I]
AGENTS.md / CHANGELOG.md       state update at close-out                       [I]
```

---

## Workstream A — Swipes buffer in the sim loop (session 1)

**Skill:** allocation-free ring buffer, event→sim decoupling.

**Prerequisite:** step-3 commits landed (see Session start).

### Session start

- Read: `src/game/Input.ts` (esp. the "handlers must copy" note), `src/game/GameLoop.ts`, `src/config.ts` (GAMEPLAY), `docs/PERF-BUDGET.md` (Allocations).
- Run `pnpm dev`; confirm blade trail draws and the dev probe logs segments.

### Work

- [I] `src/game/Swipes.ts`: class owning a fixed ring of `{ from: Vector3, to: Vector3 }` slots. API:
  - `push(segment)` — copy `from`/`to` into the next slot (Decision D); overflow drops oldest.
  - `drain(out)` / iteration — hand segments to the fixed update; marks them consumed.
  - `clear()` — backlog discard only; **never on stroke end** (the stroke's final segments must still reach the next fixed step).
- [I] `main.ts`: `input.onSwipe(seg => swipes.push(seg))`; in `fixedUpdate`, drain (consumed by nothing yet — log in dev behind a `DEBUG_SWIPE` flag so the flow is observable).
- [Pair] Confirm drain timing: drain at the top of `fixedUpdate`, before spawner/physics — step 5 will test against pre-move positions.

### Success signal

Swipes flow event → buffer → fixed update; zero steady-state allocation; ring overflow drops oldest silently; `pnpm verify:launch` untouched and green.

### Notes

- Drain is per fixed step, not per render frame: a fast frame can run 0 sub-steps, so segments must survive until the next step consumes them.
- `GameLoop.#discardBacklog()` after tab-switch: `swipes.clear()` there so stale strokes never hit a resumed sim (wire via the existing resume path).

## Workstream B — Stroke gating (session 2)

**Skill:** tuning thresholds against real device feel.

**Prerequisite:** A merged.

### Session start

- Read: `src/game/Swipes.ts`, `src/config.ts`.
- Run `pnpm dev`; try tap-only, slow drag, fast flick.

### Work

- [I] Add stroke state to the buffer: live/captured distance; segments before `SWIPE.gateDistance` total travel are dropped (Decision B). Gate resets at each new stroke (`onStrokeStart`).
- [I] Config: `SWIPE = { gateDistance: 0.5 }` in `src/config.ts` (world units on the play plane). Document units.
- [You] Tune the gate by eye: tap must not slash, slow deliberate drag must slash, resting-finger jitter must not.

### Success signal

Tap → nothing; drag past threshold → segments flow; jitter below threshold → nothing. All verifiable in `verify-swipe` without DOM.

### Notes

- Gating is per stroke, not per segment (a stroke that went live stays live) — Fruit Ninja behavior.
- `Input.MIN_SEGMENT_NDC` (0.004) already kills sub-pixel jitter upstream; the gate is a coarser second line. Don't tune both to fight each other.

## Workstream C — main.ts wiring + probe cleanup (session 2, same session as B)

**Skill:** wiring hygiene.

### Work

- [I] Remove the dev `onSwipe` console probe; fix the stale comments (Decisions F/G).
- [I] Confirm blade trail hooks untouched; trail still instant (visual path, not sim path).

### Success signal

`fixedUpdate` drains swipes every step; probe gone; `npx tsc --noEmit` + `npx oxlint` clean.

## Workstream D — Verification harness (session 3)

**Skill:** pure-function regression harness (matches step 3's `verify-launch` style).

### Work

- [I] `scripts/verify-swipe.ts` + `pnpm verify:swipe`: buffer copy semantics, ring overflow (oldest dropped), drain-per-step semantics, gate threshold behavior (tap/slow/fast), no-allocation assertion where feasible.
- [Pair] Decide whether to also drive `Input` with synthetic PointerEvents — bun's DOM event support is uncertain; if awkward, leave `Input` untested (thin adapter) and note it.

### Success signal

Harness green; check count reported in the step-3 style (e.g. "38 checks").

## Workstream E — Close-out (session 3)

- [I] `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` → `pnpm verify:launch` → `pnpm verify:swipe` → `npx vite build`.
- [I] Update `AGENTS.md` (state, open items, next-step pointer to step 5 cutting), `CHANGELOG.md` entry.
- [You] On-device portrait check: trail latency acceptable on both backends, gate feels right with a thumb (fast flicks + slow drags).

## Locked decisions carried in

- Decision 3B: depth band ±1 → step 5 collision is 3D sphere-vs-segment.
- Decision 3D: gameplay never imports the theme file (irrelevant this step but keep the seam clean).
- No interpolation (3A): step 5 tests segments against latest sim state, not interpolated.

## Explicitly NOT in step 4

- Sphere-vs-segment hit test, sliced geometry, score changes (step 5).
- `progress`/round timer (step 6).
- Trail visual polish — fade-out, width, texture (step 9).
