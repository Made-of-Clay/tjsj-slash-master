# Step 6 — Game rules

Index: [PLAN.md](../PLAN.md).

- **Scope** — a 30 s round wraps the sim: clock, score + timer HUD, game-over card, full restart.
- **Contracts** — `Round` is scalar state with an `over` latch; `round.step` runs last in `fixedUpdate`; HUD writes only on an integer change; restart re-arms every mutable system; missed fruit has no penalty.
- **Files** — `game/Round.ts`, `ui/hud.ts`, `style.css`, `main.ts`.
- **Acceptance** — `verify:rules` (round, reset, ramp, combo); no cut lands after the buzzer; round 2 behaves exactly like round 1.
- **Not doing** — start/pause, best score, combos, sound, miss penalty.
- **Decisions** — 6A–6F.

> **Status note.** The seams already exist: `Score` (`total/add/reset`), the
> `spawner.step(..., progress)` argument stubbed at 0 in `main.ts`, and an
> empty `.ui-root` overlay (pointer-events: none, safe-area padded). This step
> fills them — no new architecture.

## Session start (before workstream A)

- [I] Read: `src/game/Score.ts`, `src/game/GameLoop.ts` (visibility pause),
  `src/ui/root.ts` + `.ui-root` in `style.css`, the `progress` stub in
  `main.ts`, `Spawner` ramp sampling.
- [You] (non-blocking) carried-over tuning: `CUT` knobs by eye, on-device
  portrait, step 2/3/4 look + feel items.

## What step 6 is really about

1. **Time becomes a rule.** The spawn ramp (Decision 3E: interval/batch grow
   with round progress) has been parked at 0 since step 3 — the round clock is
   what finally un-stubs it. Early round easy, late round dense.
2. **A round must end cleanly.** The sim is a fixed-step pool machine; a
   countdown that flips to "over" mid-step must not half-consume a swipe
   drain, award a cut after the buzzer, or leave the spawner mid-event.
   Ordering inside `fixedUpdate` is the correctness work.
3. **Restart = full state reset.** Score, clock, spawner timer, live pool
   objects, debris, buffered swipes — every mutable system returns to boot
   state, or round 2 is silently different from round 1.

## Decisions (locked 2026-10-21)

> Detail + rationale only. Canonical one-line rows: [DECISIONS.md](DECISIONS.md).

| #   | Decision           | Choice                                                                                                                                                                                            | Rationale                                                                            |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A   | Round clock        | `game/Round.ts` — DOM-free: `duration` (config `ROUND.duration = 30`), `step(dt)`, `progress` 0..1, `over` latch, `secondsLeft` (ceil), `reset()`                                                 | Bun-testable like every sim module; time belongs to gameplay, the HUD only reads it  |
| B   | End-of-round order | `fixedUpdate`: early-return while `round.over`; drain → spawn → physics → debris run first; `round.step(dt)` runs **last** — the step that crosses the buzzer completes fully, the next is frozen | No half-consumed drain, no buzzer-beater ambiguity                                   |
| C   | At game over       | Freeze the sim (skip all of `fixedUpdate`), keep rendering; swipes stop draining; overlay card shows                                                                                              | Cheapest + deterministic; the board reads as "time stopped"; [You] locked 2026-10-21 |
| D   | Progress wiring    | `main.ts` passes `round.progress` into `spawner.step` — ramp finally live                                                                                                                         | Decision 3E un-parked                                                                |
| E   | HUD home           | `ui/hud.ts` widgets on the existing root (score top-left, timer top-center); DOM writes only when the displayed integer changes                                                                   | The step-1 ui-root seam; no per-frame DOM churn                                      |
| F   | Game-over UI       | Card: "Time's up" + final score + Restart; whole card is the restart target, real `<button>` inside for a11y                                                                                      | Mobile-friendly, one obvious action                                                  |
| G   | Restart            | `restart()` in main.ts: `score.reset`, `round.reset`, new `spawner.reset`, new `pool.releaseAll`, `debris.clear`, `swipes.clear`, HUD back to playing                                             | Every mutable system to boot state — "what this is about" #3                         |
| H   | Missed fruit       | Nothing. Explicitly no consequence (PLAN §6)                                                                                                                                                      | —                                                                                    |
| I   | Config             | `ROUND = { duration: 30 }` in `config.ts`                                                                                                                                                         | Config convention; [You] tunes                                                       |
| J   | Round start        | Immediate at boot — no start screen (step 9 owns those)                                                                                                                                           | MVP milestone line                                                                   |

## Files touched

```
src/game/Round.ts              new: countdown + over latch           [I]
src/game/Spawner.ts            + reset()                             [I]
src/game/Pool.ts               + releaseAll()                        [I]
src/config.ts                  ROUND block                           [I] scaffold, [You] numbers
src/ui/hud.ts                  new: score/timer + game-over card     [I] scaffold, [You] look
src/style.css                  HUD + card styles                     [I] scaffold, [You] look
src/main.ts                    wire round/freeze/progress/restart    [I]
scripts/verify-rules.ts        new harness (C)                       [I]
package.json                   verify:rules script                   [I]
docs/PLAN-STEP-6-rules.md      this file                             [I]
AGENTS.md / CHANGELOG.md       state update at close-out             [I]
```

---

## Workstream A — Round clock + freeze (session 1)

**Skill:** a state machine that ends things cleanly in a fixed-step loop.

### Work

- [I] `game/Round.ts`: `step(dt)` accumulates and clamps at `duration`;
  `over` latches true once elapsed ≥ duration and stays; `progress` = elapsed /
  duration clamped to 1; `secondsLeft` = `ceil(duration − elapsed)` floored at
  0; `reset()` zeroes elapsed and clears the latch.
- [I] `config.ts`: `ROUND = { duration: 30 }` (Decision I).
- [I] `Spawner.reset()`: timer, skipped, exhausted-warning back to boot state —
  otherwise round 2 starts mid-cadence.
- [I] `Pool.releaseAll()`: release every in-use slot (iterate `each`, release —
  release-during-iteration is already safe). Items end reset.
- [I] `main.ts`: construct the round; `fixedUpdate` = early-return while
  `round.over`, drain → spawner (progress = `round.progress`) → physics →
  debris → `round.step(dt)` **last** (Decision B).

### Success signal

Dev: the ramp visibly densifies across 30 s; at 0 the sim freezes mid-air;
`progress` log (temp DEBUG) walks 0 → 1. Full chain green.

### Notes

- `GameLoop` untouched — it keeps rendering while `fixedUpdate` no-ops, and its
  visibility auto-pause composes with `over` for free.
- `secondsLeft` ceil semantics: 30 shown at t=0 (remaining 30.00 → ceil 30),
  0 shown only once remaining ≤ 0.

## Workstream B — HUD + game-over + restart (session 2)

**Prerequisite:** A merged.

**Skill:** allocation-disciplined DOM widgets + one wiring function.

### Work

- [I] `ui/hud.ts`: `createHud(root)` → `{ sync(score, secondsLeft), showGameOver(finalScore), hideGameOver(), onRestart(handler) }`.
  Caches last score / last seconds / over-state; writes `textContent` only on
  change — zero DOM churn in the steady frame. No gameplay imports (ui reads
  primitives, not `Score`/`Round`).
- [I] `style.css`: score + timer widget classes on the existing safe-area
  root; game-over card centered, `pointer-events: auto` on the card only
  (root stays `none` so swipes reach the canvas).
- [I] `main.ts`: `hud.sync` from the render callback (reads latest state, no
  stepping); game-over transition = `hud.showGameOver(score.total)` when
  `round.over` flips; `restart()` (Decision G) wired to `onRestart`.
- [You] Look by eye: widget sizes/placement, card copy ("Time's up" /
  final score / Restart), colours — neutral white MVP, theme tint later.

### Success signal

Score ticks per cut, timer counts down and hits 0, card appears with the final
score, tap → fresh round (ramp back at easy end, score 0, timer 30). Swipes
still reach the canvas outside the card while playing.

### Notes

- HUD writes happen in render (not fixedUpdate) — the displayed value always
  comes from the latest sim state; at most one integer change per frame.
- Blade trail keeps drawing during game over — harmless, the card sits above
  the canvas. Input stays wired; the drain is already frozen by Decision C.

## Workstream C — Verification harness (session 3)

**Skill:** state-machine regression harness (step 3/4/5 style).

### Work

- [I] `scripts/verify-rules.ts` + `pnpm verify:rules` (~35 checks):
  - Round (~12): counts down, progress 0 → 1, over latches at duration and
    persists, step-after-over freezes elapsed, `secondsLeft` ceil semantics
    (30 at start, 1 at remaining 0.5, 0 at 0), reset restarts;
  - Spawner.reset (~5): timer zeroed → first cadence matches a fresh spawner,
    skipped/exhausted cleared;
  - Pool.releaseAll (~5): inUse → 0, available → full, items reset, no-op on
    an empty pool, safe mid-`each`;
  - Round integration (~8): driving Spawner with `round.progress` — ramp value
    at 0 vs 1 differs per rules; a full 30 s of fixed steps ends `over` exactly
    once; restart round 2 first-interval equals round 1's;
  - config sanity (~3): `ROUND.duration` finite > 0.
- [Pair] Drive everything by direct API calls; `ui/hud.ts` stays out (DOM) —
  eyeballed in B.

### Success signal

Harness green in the step-3 style ("~35 checks"); RampRange actually exercised
end to end for the first time.

## Workstream D — Close-out (session 3)

- [I] Full chain: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify:foundation` →
  `pnpm verify:playfield` → `pnpm verify:launch` → `pnpm verify:swipe` →
  `pnpm verify:cut` → `pnpm verify:rules` → `npx vite build`.
- [I] Update `AGENTS.md` (state, locked decisions, next-step pointer to step 7
  content), `CHANGELOG.md`, README plan link.
- [You] On-device: 30 s round at 60 FPS both backends, card + restart under a
  thumb, timer readable in portrait.

## Locked decisions carried in

- 3A no interpolation · 3C plain meshes (step 8 owns InstancedMesh) · 3D
  gameplay never imports the theme (HUD reads primitives from main.ts wiring) ·
  3E ramp with round progress (this step un-parks it) · 3F injectable rand.
- 4C drain at top of fixedUpdate — preserved; round.step runs after it.
- 5E score+pieces before release; `Score.reset()` was built for this step.
- PERF-BUDGET: no allocation in the steady-state frame — HUD caches strings,
  round is scalar state.

## Explicitly NOT in step 6

- Start / pause screens, high score, combos (step 9).
- Missed-fruit penalty — PLAN §6 explicitly none in MVP.
- Theme-tinted HUD, animated counters, sound (step 9).
- Pause-on-blur beyond GameLoop's existing visibility auto-pause.
