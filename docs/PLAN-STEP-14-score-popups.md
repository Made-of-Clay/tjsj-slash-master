# Step 14 — Score popups

Index: [PLAN.md](../PLAN.md).

- **Scope** — cut feedback: one label per cut showing that object's adjustment at the blade crossing, rising and fading.
- **Contracts** — DOM only (no scene objects, no draws); the `Slicer` `cutPoint` sink fires before `pool.release`; popups never mutate score; restart clears them; the steady frame does no popup work.
- **Files** — `game/Slicer.ts`, `ui/scorePopups.ts`, `ui/format.ts`, `ui/hud.ts`, `main.ts`, `style.css`, `config.ts`.
- **Acceptance** — `verify:cut` covers the anchor (centre, graze clamp, endpoint, zero-length); by eye: +1 green, −3 red, rise + fade over `SCORE_POPUP.duration`, no lingering labels after restart.
- **Not doing** — combo-bonus popups, world-space sprites, authored fonts/atlases, per-popup audio.
- **Decisions** — 14A–14D.

> **Status.** COMPLETE 2026-11-12.

## What this step is about

1. **The number belongs to the slash, not the HUD.** The bar shows the running
   total; the popup answers "what did that object just do to me?" at the exact
   point the blade crossed it.
2. **Feedback must not cost a draw.** The draw ceiling is 17 and every scene
   mesh is spoken for. A DOM layer animates transform + opacity on the
   compositor, so the frame graph is untouched.
3. **One event, one animation.** Cuts already arrive through the Slicer's sinks;
   no new sim loop, no per-frame JS, no idle DOM writes.

## Decisions (locked 2026-11-12)

| #   | Decision      | Choice                                                                                                                  | Rationale                                                                   |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A   | Layer         | DOM ring on `.ui-root`, prepended so the HUD and cards paint above; Web Animations API, one animation per cut.          | Zero draws and crisp text; a 3D sprite would add a draw, an atlas and blur. |
| B   | Anchor        | Closest point on the swipe segment to the object centre, computed as scalars in the Slicer; the sink fires pre-release. | Literal "where it slashed"; allocation-free and harness-testable.           |
| C   | Motion        | Rise + fade together over `SCORE_POPUP.duration`, ease-out; reduced motion drops the rise but keeps the fade.           | One duration knob answers the brief; nothing extra to tune.                 |
| D   | Colour + copy | Green `+1` / red `−3` from `SCORE_POPUP`; typographic minus shared with the legend; no combo number.                    | Colour must mean sign on both themes; the HUD already owns the total.       |

## Files touched

```
src/game/Slicer.ts           + cutPoint sink (closest point, pre-release)   [I]
src/ui/scorePopups.ts        new: DOM ring + WAAPI rise/fade                [I]
src/ui/format.ts             formatPoints shared with the legend            [I]
src/ui/hud.ts                import the shared formatter                    [I]
src/main.ts                  project crossing → px, wire sink, clear        [I]
src/style.css                popup layer + green/red label styles           [I]
src/config.ts                SCORE_POPUP block                              [I]
scripts/verify-cut.ts        anchor checks (5)                              [I]
```

## Acceptance run

`npx tsc --noEmit` → `npx oxlint` → `pnpm verify` → `pnpm verify:docs` →
`npx vite build`; then `pnpm dev` and slash both themes.
