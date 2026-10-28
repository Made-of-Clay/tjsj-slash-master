# AGENTS.md — Slash Master

Fruit-Ninja–style 2.5D slicing game (Three.js Journey challenge, Oct 2026). Three.js `0.185.1` (`WebGPURenderer` + TSL), TypeScript, Vite, pnpm, Oxlint + Oxfmt, PWA. Play plane is `z = 0`; camera is straight-on modest perspective; height is fixed and width derives from the aspect.

## Start here

1. [`STATE.md`](STATE.md) — what is done, next, blocked. Five lines.
2. [`PLAN.md`](PLAN.md) — the router. Pick the row that matches the task, read **one** step doc, then stop.
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — grep an ID (`9C`) before changing a contract; cite IDs instead of re-explaining.
4. [`docs/TUNABLES.md`](docs/TUNABLES.md) — every number. If the task is feel, read this and nothing else.

Do not re-derive the project from this file: it holds only what none of those docs do.

## Commands

```
pnpm dev                 # dev server; ?dev adds stats.js + playfield guide
pnpm build               # tsc + vite build (check dist/assets has no draco/basis)
pnpm verify              # every harness, foundation → polish
pnpm verify:docs         # doc budgets, links, step-doc headers
pnpm lint / pnpm fmt     # oxlint / oxfmt (fmt:check in CI)
```

Finish a task with: `npx tsc --noEmit` → `npx oxlint` → `pnpm verify` → `pnpm verify:docs` → `npx vite build`.

## Conventions

- Replies ULTRA-TERSE. Ownership tags: **[I]** agent · **[You]** human · **[Pair]** scaffold-then-decide.
- Comments: aim for 0. One or two lines when a why, invariant or non-obvious contract must be stated; 4+ only for real gotchas. Never narrate what the code visibly does. Update stale comments with the code.
- Never commit unless asked. Messages: `feat: …` / `chore: …`.
- Plans: a new step gets `docs/PLAN-STEP-N-<slug>.md` with the six-field header (`Scope`, `Contracts`, `Files`, `Acceptance`, `Not doing`, `Decisions`) and a router row in `PLAN.md`.
- Scratch work, agent previews and downloads go in `tmp/` (gitignored). Never use the system `/tmp`.
- Model sources are self-contained folders under `src/content/models/` (name = model, see its `README.md`); `pumpkin/*.glb` loads at boot, everything else bakes.

## Gotchas

- `scene.backgroundNode` exists at runtime (three 0.185) but is missing from `@types/three`'s `Scene` → cast to `Scene & { backgroundNode: Node | null }`.
- `Node` type: `import type { Node } from 'three/webgpu'`. TSL imports from `'three/tsl'`.
- TSL compiles on the GPU at runtime, so `vite build` does NOT prove a node graph works; build the graph in isolation to smoke-test it.
- Dev overlays are opt-in via `?dev`; production builds drop both.
- `oxfmt --check` fails on `docs/PLAN-STEP-2-playfield.md` (committed unformatted). Leave it.
- Docs are budgeted by `verify:docs` (lines + words). Compress prose, never paste a step doc into `PLAN.md`.
