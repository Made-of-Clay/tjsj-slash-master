# Step 13 — Blade trail

Index: [PLAN.md](../PLAN.md).

- **Scope** — the slash visual: `LineBasicMaterial` hairline → one additive three-band ribbon with taper, age-based tail, release fade, theme tint and a cut flash. Closes the fade/width polish deferred by step 4.
- **Contracts** — still one draw (ceiling 17 unchanged); trail stays on stroke handlers (4E); no per-frame allocation; geometry is 2D on `z = 0` and draws with `depthTest: false`, so it never occludes and needs no z lift; tint is derived from `theme.background.top` in `main.ts`, so `rendering/` never imports content.
- **Files** — `rendering/BladeTrail.ts`, `config.ts`, `content/types.ts`, both themes, `main.ts`, `scripts/verify-perf.ts`, `scripts/verify-content.ts`, `scripts/verify-docs.ts`, `TUNABLES.md`, `DECISIONS.md`, `PERF-BUDGET.md`, `STATE.md`, `CHANGELOG.md`.
- **Acceptance** — `draws: 17` while swiping; tail dissolves instead of ending in a stub; a released stroke fades out over `BLADE.fadeSeconds`; core stays white under ACES; reduced-motion users get the old snap-off; `verify:perf` guards the geometry writer and `update`.
- **Not doing** — velocity shaping, joint resampling, head glint, resting pointer cursor, bloom/post-processing, authored textures.
- **Decisions** — 13A–13E.

> **Why.** A 1 px line cannot be tuned: `LineBasicMaterial.linewidth` is ignored on
> every WebGPU backend, so width was never a number. A ribbon makes width, taper,
> fade and tint into config values, and additive vertex colour gives a hot core and
> a coloured fringe in the same single draw the line already cost.

## Geometry

- `BLADE.maxPoints` samples × 3 vertices (outer left, core, outer right) into
  preallocated `position`/`color` `Float32Array`s; `index` `Uint16Array` filled
  once, 12 indices per segment (two quads). `setDrawRange` is the only per-frame
  topology change.
- Perp is 2D (`(−dy, dx)` from the averaged neighbouring direction), exact while
  every sample sits on `z = 0`. `SpawnRules.depthRange` is pinned to `[0, 0]` and
  verified; a drifting z would need a camera-facing perpendicular.
- No miter extension: a sharp reversal pinches the joint instead of spiking a
  long triangle. `side: DoubleSide` so stroke direction never matters.
- `frustumCulled = false` — positions change without a bounding-sphere update.

## Colour + time

- Additive blending ignores alpha, so fade is written into RGB: per-vertex
  intensity = `tailCurve(t) × strokeFade × (1 + flash)`. `toneMapped: false`,
  because ACES would dull the white core.
- Tail curve: 0 at the tail → 1 by `BLADE.tailFade`, so the streak dissolves.
- Age trim: `Float64Array` timestamps (float32 loses ms precision); `update` advances `first` while the oldest
  sample is older than `BLADE.tailSeconds`. Without it a slow drag holds 32
  samples forever and the trail becomes a permanent snake.
- Release: `end()` freezes the samples and lets `strokeFade` decay over
  `BLADE.fadeSeconds`, then hides.
- Tint: `theme.palette.blade` (13E) normalised to full brightness, then mixed
  toward white by `BLADE.tintWhiteMix`; the core vertex stays white.
- `flash()` on a cut widens the strip and brightens it for `BLADE.flashSeconds`.
- `update(nowMs)` takes an injected clock, like `Effects`' `rand`; `main.ts`
  passes `performance.now()` from the render hook.

## Gotchas

- `setDrawRange` counts **indices** on an indexed geometry, not vertices.
- The clock is one frame stale on the first sample of a stroke (it comes from
  `update`); irrelevant at 60 FPS, and it keeps the stroke handlers unchanged.
- Tint is normalised to full brightness before the white mix: the theme tops
  (`#0e2730`, `#13294b`) are near-black in linear space, so a straight lerp left
  chroma 0.009 and the mix knob had nothing visible to move (fixed 2026-10-30).
- The hue is `ThemePalette.blade` (13E), not `background.top`: both backgrounds
  are teal/navy, so deriving from them made the two themes' blades identical.
