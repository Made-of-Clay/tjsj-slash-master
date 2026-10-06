## Change Log

Record **ultra-terse** changes below. Sentence fragments okay if clear. Only log relevant details. Agents aren't blogging.

## 2026-10-05

### Step 1 — project foundation

- Renderer: `WebGLRenderer` → `WebGPURenderer` (`three/webgpu`), TSL from `three/tsl`. Auto-falls back to WebGL2. `await renderer.init()` gates rendering; backend logged at startup.
- Structure: `src/game|rendering|content|ui` per plan. `main.ts` is a composition root only. Deleted `addHelpers`, `addLights`, `getGui`, `getScene`, `ProjectCamera`, `helpers/*`; `getLoadingManager` → `rendering/loading.ts`.
- `game/GameLoop.ts` — fixed 1/60 timestep, accumulator + `MAX_SUB_STEPS` clamp, pauses on `visibilitychange`, smoothed FPS, zero per-frame allocation. Driven by `renderer.setAnimationLoop`; no second rAF loop.
- `game/Input.ts` — pointer events only, so mouse/touch/pen share one path. `setPointerCapture`, first-pointer-wins, `getCoalescedEvents()`, NDC → world segment via an injected projector. `game/` imports nothing from `rendering/`.
- `game/Pool.ts` — fixed capacity, O(1) acquire/release, never grows, resets on release.
- `config.ts` — every tunable in one place, incl. the perf budget constants.
- `content/types.ts` — `GameObjectDefinition` / `Theme` / `SpawnRules` contracts only. Gameplay never reads `model`, so art can be swapped without touching rules.
- `rendering/Materials.ts` — TSL smoke test (`time`-driven `mix`), proves the node pipeline compiles.
- `rendering/Camera.ts` — fixed camera, no orbit controls. Viewport sync on resize/orientation events rather than a per-frame layout read.
- Removed `lil-gui`; `stats.js` now dynamic-imported under `import.meta.env.DEV`, so it is stripped from the production build.
- Package renamed `threejs-starter-vite` → `slash-master`.

Payload, after dropping the `three/examples/jsm/Addons.js` barrel (it was pulling every loader/exporter in for one `OrbitControls` import):

|                      | before                  | after                   |
| -------------------- | ----------------------- | ----------------------- |
| precache entries     | 25                      | 20                      |
| precache total       | 1631.60 kB              | 1020.47 kB              |
| three.js chunk       | 584.58 kB (gzip 146.71) | 831.49 kB (gzip 233.64) |
| draco/basis decoders | 1899.63 kB              | 0                       |

Net −611 kB precached. The three.js chunk grew ~247 kB because `three/webgpu`
is a much larger build than the WebGL-only one — the cost of adopting WebGPU up
front, already paid.

Budgets and how to measure them: `docs/PERF-BUDGET.md`.

Fixes found by the logic harness, both in `GameLoop`:

- Missing `this.#primed = true` meant every frame re-primed and returned: zero fixed steps ever ran and alpha stayed 0. Rendered a static scene at a healthy FPS while simulating nothing.
- `visibilitychange` was registered in `start()` and removed in `stop()`, so the first auto-pause unregistered the listener that had to resume the loop — one background left the tab frozen permanently. Now registered once in the constructor, with `#paused` separate from `#running`.

- Harness: `scripts/verify-foundation.ts`, 52 checks, run with `pnpm verify:foundation` (needs Bun — `src/` uses extensionless imports, which Node's ESM loader rejects). Added to `tsconfig`'s `include` so it type-checks on every `pnpm build` and cannot rot silently. No framework: plain assertions, no new dependency.

Caveat: WebGL2 fallback and on-device touch are still unverified — no Chrome locally, and `navigator.gpu` is unavailable in node. Fallback must be checked on a phone via `pnpm preview:mobile`.

### Earlier

- PWA: installable via `vite-plugin-pwa` — precache service worker + manifest, generated in `pnpm build`, registered from `src/main.ts`. Silent auto-update.
- Icons: 5 sizes generated from `public/icons/*.svg`; `pnpm icons` regenerates.
- Phone testing: `pnpm preview:mobile` builds, runs `vite preview` on loopback, proxies over TLS via Caddy. Device must trust Caddy's root CA once — SWs need a secure context, so plain `http://<lan-ip>` won't register the worker.
- Mobile shell: `touch-action: none` on canvas, `100dvh`, safe-area vars, notch/landscape/iOS meta.
- `firebase.json`: `no-cache` on `sw.js` + manifest, immutable on hashed assets.
- Fix: `pnpm build` was already broken at HEAD — unused `#cameraFolder` private field tripped `noUnusedLocals`. CI deploy was failing too.
- Caveat: keep `workbox-window` an explicit devDep. pnpm's auto-installed peer isn't resolvable by Rolldown, so the build fails without it.
