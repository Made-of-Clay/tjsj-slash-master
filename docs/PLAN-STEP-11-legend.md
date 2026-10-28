# Step 11 — Card object legend

Index: [PLAN.md](../PLAN.md).

- **Scope** — start, pause and game-over cards list every slashable object in the active theme with its point value.
- **Contracts** — legend covers all `theme.objects`; HUD still takes primitives only (name, score, icon URL); thumbnails derive from theme models at boot; one shared row builder fills all three cards.
- **Files** — `content/types.ts`, `content/themes/*.ts`, `ui/objectIcons.ts`, `ui/hud.ts`, `style.css`, `main.ts`, `scripts/verify-content.ts`.
- **Acceptance** — `verify:content` checks non-empty unique names and visible icon pixels per def; `pnpm verify` green; cards read at 320 px wide.
- **Not doing** — pickers, animated thumbnails, authored icon art, per-theme CSS.
- **Decisions** — 11A–11D.

> **Why.** A first-time player cannot infer that a skull is −1 or a bomb −3 from
> the art alone, and the information must be available before the first swipe,
> mid-round, and after it ends. The cards already exist; this adds one row list.

## Decisions (locked 2026-10-27, [You])

| #   | Decision          | Choice                                                                                                                              | Rationale                                                                                 |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A   | Placement         | Same legend on all three cards, built by one `createLegend` function; each card owns its DOM copy.                                  | The values are needed when starting, when paused, and when reviewing a round.             |
| B   | Thumbnails        | Boot-time CPU projection of each def's baked geometry: orthographic view, z-buffer, flat shading. No GPU readback.                   | Matches the live objects, works on WebGPU and the WebGL fallback, needs no authored art.  |
| C   | Content contract  | `GameObjectDefinition.name` is authored data. `main.ts` passes `{ name, score, icon }` to `createHud`; HUD imports no theme.        | Keeps copy with the objects and the HUD's primitive-only rule intact.                     |
| D   | Cost              | Icons render once before the start card. PNG data URLs are reused by three `<img>` elements; steady frame unchanged.                | No per-frame DOM, no per-theme branching, no new dependency.                              |

## As built

- `ui/objectIcons.ts` rasterises at 96 px and lets the browser downscale, so
  edges antialias without a 2D path pass. Transparent pixels keep the card
  background and the circular backdrop visible behind dark models (bomb, coal).
- Failure is soft: an unbakeable model yields no icon, the row keeps its name
  and points.
- `verify:content` 143 → 154 checks: one name contract per theme and one
  visible-pixel render per object (9 objects), plus the existing bake checks.

## Files touched

```
src/content/types.ts          + name                                      [I]
src/content/themes/*.ts       + display names                             [I] copy, [You] tune
src/ui/objectIcons.ts         new: CPU thumbnails                         [I]
src/ui/hud.ts                 legend rows on every card                   [I]
src/style.css                 legend layout + point colours               [I]
src/main.ts                   build icons, feed the HUD                   [I]
scripts/verify-content.ts     names + icon render checks                  [I]
scripts/verify-docs.ts        step count 10 → 11                          [I]
```
