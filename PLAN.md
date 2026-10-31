# Plan — Fruit-Ninja-style slicer

Gameplay / rendering / content are separate: a theme is data plus one registry entry. This file is the **index**, not the spec. Read it, pick one router row, stop. Depth lives in the linked docs and is never repeated here.

## Invariants — gate every task

- `src/game/**` never imports `content/themes`, `content/models` or `rendering/`.
- Numbers live in `src/config.ts` or theme data; no magic numbers in code.
- Fixed-step sim, zero steady-frame allocation, pool never grows.
- Play plane `z = 0`; hit tests are 3D sphere-vs-segment.
- No dependencies beyond three + stats.js; three authored GLBs (`content/models/pumpkin/`, `skull/`, `candy/`), everything else procedural art and synthesised audio.
- Draw ceiling ≤ 17 while swiping.

## Router — read only what the task touches

| Task signal                                | Read                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| build, renderer, loop, input, pool, PWA    | [step 1](docs/PLAN-STEP-1-foundation.md) · 1A–1D                                |
| camera, aspect, background, lights, bounds | [step 2](docs/PLAN-STEP-2-playfield.md) · 2A–2E                                 |
| spawn, arc, gravity, despawn, ramp         | [step 3](docs/PLAN-STEP-3-launching.md) · 3A–3F                                 |
| pointer, stroke, gate, segment buffer      | [step 4](docs/PLAN-STEP-4-swipe.md) · 4A–4G                                     |
| hit test, cut, score, debris               | [step 5](docs/PLAN-STEP-5-cutting.md) · 5A–5E                                   |
| round, timer, HUD, restart                 | [step 6](docs/PLAN-STEP-6-rules.md) · 6A–6F                                     |
| theme, models, bake, import graph          | [step 7](docs/PLAN-STEP-7-content.md) · 7A–7L                                   |
| draws, instancing, allocation, fps         | [step 8](docs/PLAN-STEP-8-perf.md) · 8A–8J · [PERF-BUDGET](docs/PERF-BUDGET.md) |
| feel, sparks, shake, combo, audio, flow    | [step 9](docs/PLAN-STEP-9-polish.md) · 9A–9L                                    |
| default theme, `?theme=`, manifest         | [step 10](docs/PLAN-STEP-10-content.md) · 10A–10J                               |
| card legend, object thumbnails             | [step 11](docs/PLAN-STEP-11-legend.md) · 11A–11D                                |
| authored GLB, boot preload, asset bake     | [step 12](docs/PLAN-STEP-12-assets.md) · 12A–12D                                |
| blade, trail, slash visual, ribbon         | [step 13](docs/PLAN-STEP-13-blade.md) · 13A–13E                                 |
| **numbers / feel tuning**                  | [TUNABLES](docs/TUNABLES.md) — nothing else                                     |
| **why a choice was made**                  | [DECISIONS](docs/DECISIONS.md) — grep the ID, e.g. `9C`                         |
| **what is done / next / blocked**          | [STATE](STATE.md)                                                               |

## Reading by task class

| Class   | Reads                                                                     |
| ------- | ------------------------------------------------------------------------- |
| tuning  | `TUNABLES` only. No step doc, no history.                                 |
| bugfix  | router row → that doc's **Contracts** + **Acceptance** + tagged harness.  |
| feature | router row whole + cited decision IDs + the neighbouring doc's Contracts. |
| docs    | this file + the doc being edited.                                         |

Every step doc opens with the same six fields — `Scope`, `Contracts`, `Files`, `Acceptance`, `Not doing`, `Decisions` — so the first 15 lines answer most questions without the body.

## Steps

Order is history, not a reading list. Router decides what to open.

1 foundation · 2 playfield · 3 launching · 4 swipe · 5 cutting · 6 rules · 7 content · 8 perf · 9 polish · 10 content pipeline · 11 legend · 12 assets · 13 blade

## Verify

`pnpm verify` runs every harness, foundation → polish, then `verify:docs`. Ship-check adds `npx tsc --noEmit`, `npx oxlint`, `npx vite build`. `pnpm verify:docs` guards the doc budgets, links and headers.

## Archive

[PLAN-ORIGINAL](docs/PLAN-ORIGINAL.md) holds the first brief verbatim. Read it for intent only; it never describes current behaviour.
