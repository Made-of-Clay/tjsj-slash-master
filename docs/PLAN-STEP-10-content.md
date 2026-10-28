# Step 10 — Content pipeline: built default + query-param switcher

Index: [PLAN.md](../PLAN.md).

- **Scope** — the built default theme plus a boot-time `?theme=` override; exactly two selection paths.
- **Contracts** — default from `import.meta.env.VITE_DEFAULT_THEME`; invalid or absent → `halloween`; the override is read once in `main.ts` before any view exists; both themes stay in the bundle; no runtime API.
- **Files** — `content/themes/index.ts`, `src/main.ts`, `index.html`, `vite.config.ts`, `scripts/verify-content.ts`.
- **Acceptance** — `verify:content` selection checks; boot logs `theme: <id> (url|fallback|default)`; `theme-color` and the manifest match the resolved and built themes.
- **Not doing** — picker, persistence, hot swap, per-theme HUD, tree-shaking a theme out.
- **Decisions** — 10A–10J.

> **Status.** A + B landed in `53ba445` (2026-10-27): built default + boot
> override + selection checks, all review findings below resolved. Step 7
> already shipped `getTheme` / `resolveThemeId` / `?theme=` and the registry.

## What step 10 is really about

1. **The default is an artifact of the build, not a runtime setting.** Step 7
   hardcoded `DEFAULT_THEME_ID = 'halloween'`. "Default (built)" means a build
   can ship either theme without touching source — one build value in, one
   compiled default out.
2. **The query param is the only override, and it is boot-only.** `?theme=`
   resolves once, before any view/spawner exists. Reload to change. No listeners,
   no teardown, no disposal logic — which is why this step is small.
3. **Both themes must stay reachable from every build.** If the override must
   accept either id, the registry stays whole in the bundle; no tree-shaking of
   the "other" theme. Payload unchanged by design.
4. **The data-only claim is already enforced; keep it that way.** `verify-content`
   owns the import graph (`game/**` never imports themes/models; only `main.ts`
   imports the registry). This step adds no second importer.
5. **One env read, two consumers.** Dev and `build` must resolve the same
   default. `define` does not satisfy that (see findings F2); `import.meta.env`
   does.

## Decisions (locked 2026-10-26, [You])

> Detail + rationale only. Canonical one-line rows: [DECISIONS.md](DECISIONS.md).

| #   | Decision              | Choice                                                                                                                                                                                                   | Rationale                                                                             |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A   | Selection paths       | Exactly two: build default, `?theme=` at boot. Nothing else reads/writes theme selection.                                                                                                                | Agreed product call; smallest surface.                                                |
| B   | Default plumbing      | Read `import.meta.env.VITE_DEFAULT_THEME` **in source** (`content/themes/index.ts`), optional-chained for non-Vite runtimes; fall back to `'halloween'` through the registry. **`define` was rejected.** | `define` is build-only in Vite 8 dev (F2) — it silently kept Halloween in `pnpm dev`. |
| C   | Env absence           | Missing/invalid value → registry fallback `'halloween'`; Bun's `import.meta.env` is tolerated (optional chain) so `verify-content` still runs.                                                           | Harness and `tsc` must not depend on a build step.                                    |
| D   | Query param           | Read once in `main.ts`; exact match via the registry, else the built default. Empty/unknown/absent never throws; boot logs `theme: <id> (<source>)`.                                                     | Step-7 behavior, now logged and covered.                                              |
| E   | Boot-only             | Resolution before `createScene`/views/spawner; change = reload. No runtime API.                                                                                                                          | Avoids the dispose/rebuild/reset problem class.                                       |
| F   | Both themes in bundle | Registry keeps both themes; no conditional imports/tree-shaking.                                                                                                                                         | `?theme=` must reach either id from every build.                                      |
| G   | Gameplay isolation    | Unchanged: `src/game/**` imports no theme/model; `main.ts` remains the only registry importer.                                                                                                           | Existing harness rule; no new exceptions.                                             |
| H   | Page chrome           | Set the `theme-color` meta from `theme.background.top` after resolution; HUD stays neutral.                                                                                                              | Correct PWA chrome; no CSS-variable re-skin.                                          |
| I   | Verification          | Extend `verify-content` (~10 checks) **above the failure gate**; update counts in docs. No new script.                                                                                                   | Same harness, right home; the step's logic is small and pure.                         |
| J   | Dependencies          | None. Payload delta code-only, ≈ 0 (env read + resolution + log).                                                                                                                                        | Guard rails unchanged since step 7.                                                   |

### As built vs as planned

- A first landed with `define: { __DEFAULT_THEME__ }`; review F2 proved the
  Vite 8 dev server ignores `define`, so dev always booted the `halloween`
  fallback while `build` honoured the value. Reworked to B: read
  `import.meta.env.VITE_DEFAULT_THEME` in source and delete `define`.
- `resolveBootThemeId` shipped as a one-line alias (F7); dropped. The env
  validation now lives in `resolveDefaultThemeId`, which the harness exercises
  directly.
- F8: manifest `theme_color` now reads the built theme's `background.top` via
  the registry imported by `vite.config.ts`.

## Files touched

```
src/content/themes/index.ts    env-aware DEFAULT_THEME_ID + resolver          [I]
src/main.ts                    resolve + log source; theme-color meta         [I]
src/vite-env.d.ts              typed ImportMetaEnv entry                       [I]
vite.config.ts                 no define; manifest theme_color = built theme   [I]
scripts/verify-content.ts      selection checks above the gate                 [I]
docs/PLAN-STEP-10-content.md   this file                                       [I]
AGENTS.md / README.md / CHANGELOG.md / docs/PERF-BUDGET.md                     [I]
```

Untouched: `src/game/**` (theme-blind), `src/rendering/**`, `src/ui/**`,
`index.html` (meta already present), all step 1–9 verifiers.

---

## Workstream A — Built default + resolution contract

**Status: implemented (uncommitted) 2026-10-26.**

### Work

- [x] `src/content/themes/index.ts`: optional-chained
      `import.meta.env.VITE_DEFAULT_THEME` read, `isThemeId` type guard,
      `resolveDefaultThemeId` (env validation), `DEFAULT_THEME_ID` through the
      registry; `resolveBootThemeId` alias dropped.
- [x] Manifest `theme_color` reads the built theme's `background.top` via the
      registry imported by `vite.config.ts` — no duplicated colour data.
- [x] `src/vite-env.d.ts`: typed `ImportMetaEnv` entry; injected global
      declaration removed.
- [x] `src/main.ts`: resolve → `getTheme` → log `<id> (url|fallback|default)`;
      set `theme-color` from `theme.background.top`.
- [x] `vite.config.ts`: `define` + injected global dropped; manifest
      `theme_color` follows the built default; `loadEnv(mode, '.', '')` avoids
      the untyped `process.cwd()`.
- [x] `README.md`: document both means.
- [x] Keep `typeof`-safe access so Bun/`tsc` (no Vite transform) still resolve.

### Success signal

`VITE_DEFAULT_THEME=christmas pnpm dev` **and**
`VITE_DEFAULT_THEME=christmas pnpm build` both boot Christmas; default runs boot
Halloween; `?theme=` overrides either; unknown → built default.

### Notes

- Do not read `window.location` inside `content/themes/**` — the URL is
  `main.ts`'s job (step 7 boot ordering).
- Both themes stay statically imported by the registry.
- Verified build evidence: Christmas build minifies to
  ``function ke(e){…}var Ae=ke(`christmas`)``; default build to
  `var Ae=ke(void 0)`.

---

## Workstream B — Verification + close-out

### Work

- [x] **Fix the gate (blocking, F1).** `Selection` now sits above
      `if (failures > 0) throw …`, so its failures gate; printed total 143.
- [x] Harness checks: `DEFAULT_THEME_ID` is a registry key; `resolveThemeId`
      exact-match vs fallback for `null`/`undefined`/`''`/`'nope'`/
      `'Christmas'`; both ids reachable; isolation still green.
- [x] Tautological alias check replaced (F7) with
      `resolveDefaultThemeId honours the injected build value`.
- [x] `npx oxfmt` on the changed files (F5).
- [x] Update `AGENTS.md`: state heading, counts `content 133` → `143` (state +
      Commands), step-10 decisions, `setTheme`/`pnpm fmt` notes.
- [x] Non-browser verification: `VITE_DEFAULT_THEME=christmas pnpm dev` serves
      `import.meta.env = {… "VITE_DEFAULT_THEME": "christmas"}`; default build
      bakes `ke(void 0)`, Christmas build bakes `ke("christmas")`; both
      manifests emit the matching `theme_color`.
- [ ] **[You] In browser:** dev with and without `VITE_DEFAULT_THEME`; `?theme=`
      both ways; `?theme=nope`; built Christmas bundle + `?theme=halloween`.
- [x] Full chain (both builds): `npx tsc --noEmit` → `npx oxlint` → foundation →
      playfield → launch → swipe (51) → cut (68) → rules (53) → content (143) →
      perf (79) → polish (51) → `npx vite build`; no draco/basis/ktx2.

### Success signal

Harness green **and** actually able to fail; dev and build agree on the default;
docs state the two-path model and nothing advertises `setTheme`.

---

## Review findings (2026-10-26) — resolved

Ordered by severity. All verified against the working tree, not assumed. All
fixed 2026-10-26: F1 gate moved above the summary; F2 source env read and
`define` dropped; F3 AGENTS state/counts/rewrap; F4 reverted per [You]; F5
oxfmt; F6 `loadEnv(mode, '.', '')`; F7 alias dropped with a real resolver
check; F8 manifest colour reads the built theme's `background.top`; F9
`(fallback)` log source.

| #   | Severity   | Finding                                                                                                                                                                                                                                                                                                                                   | Fix                                                                 |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F1  | **High**   | `verify-content` selection checks sit after `if (failures > 0) throw` (line 407) and `ALL PASS — 133 checks` (line 410). Proven in situ: a failing check appended there still **exits 0**, so the new checks cannot gate. Reported total is 133; actual 143.                                                                              | Move the block above the gate; fix the printed count.               |
| F2  | **Medium** | `define` is not applied by the Vite 8 dev server. `GET /src/content/themes/index.ts` under `VITE_DEFAULT_THEME=christmas pnpm dev` still serves `typeof __DEFAULT_THEME__ …`, so the browser falls back to `'halloween'`. Minimal out-of-project repro with a plain `define` confirms Vite behavior, not config misuse. Build is correct. | Read `import.meta.env.VITE_DEFAULT_THEME` in source; drop `define`. |
| F3  | Medium     | `AGENTS.md` still heads "Current state — Step 9 COMPLETE"; counts say `content 133` (actual 143) in the state list and `Commands`; added bullet is a single ~330-char line.                                                                                                                                                               | Update state, counts, and rewrap.                                   |
| F4  | Medium     | `docs/PLAN-STEP-2-playfield.md` was reformatted (formatting-only: `*x*`→`_x_`, table padding). Unrelated to step 10, and it makes `oxfmt --check` pass there — falsifying `AGENTS.md:103` ("committed unformatted … Leave it").                                                                                                           | Keep + update that line, or revert. Decide with [You].              |
| F5  | Low        | Repo `oxfmt --check` exits 1 on `docs/PLAN-STEP-10-content.md`, `scripts/verify-content.ts`, `src/content/themes/index.ts`.                                                                                                                                                                                                               | `npx oxfmt` those files.                                            |
| F6  | Low        | `process.cwd()` in `vite.config.ts` has no types: `scripts/node-shim.d.ts` declares only `node:fs`, and `@types/node` is absent. `tsconfig.include` is `["src","scripts"]`, so CI stays green — editor-only `TS2591`.                                                                                                                     | Use `loadEnv(mode, '.', '')`, or add the type shim.                 |
| F7  | Low        | `resolveBootThemeId` is a pure alias; its harness check compares the wrapper to the function it calls (tautology), and no check exercises the injected default (Bun only sees the fallback).                                                                                                                                              | Drop the alias or give it a default argument + a real check.        |
| F8  | Low        | Manifest `theme_color` (`#0d2b31`) matches neither theme's `background.top` (`#0e2730`, `#13294b`); a Christmas-default build declares the wrong chrome/splash colour until boot.                                                                                                                                                         | Derive the manifest colour from the same env value, or document.    |
| F9  | Low        | Dev-mode log label prints `(default)` for an invalid id, so a typo'd `?theme=` looks like no param was passed.                                                                                                                                                                                                                            | Log `(fallback)` when a value was present but unresolved.           |

### Verified correct (no action)

- `typeof`-guarded global read: registry imports cleanly under Bun, no `ReferenceError`.
- Precedence: `?theme=christmas` wins; `null`/`undefined`/`''`/`'nope'`/`'Christmas'` → default.
- `JSON.stringify` in `define` and `Object.hasOwn` registry checks: no injection, no prototype-key ids.
- `main.ts` log ternary binds as `(urlTheme && (theme.id === urlTheme)) ? … : …`; `''`/`null` take the default branch.
- `index.html` clean (head meta pre-existing); `vite.config.ts` diff is wrapper + `define` only.

## Locked decisions carried in

- 7E: boot-time selection, single resolution before views are built.
- 7H: `src/game/**` never imports `content/themes/**` or `content/models/**`.
- 7L: `setTheme` was the step-10 ambition — **superseded** by the two-path model.
- 8/9: zero steady-frame allocation, draw ceiling ≤ 17, no payload/assets.

## Explicitly NOT in step 10

- `setTheme(id)` runtime hot-swap, ThemeManager, view disposal/rebuild.
- Theme picker UI, dev switcher, persisted/last-used theme (see follow-up).
- Theme-tinted HUD/CSS variables (neutral HUD stays).
- glTF/texture/asset loading, draco/basis, network theme data.
- Tree-shaking non-default themes out of the bundle.

## Follow-up (future themes — do not implement now)

- **Start-screen theme switcher.** When the registry grows past the two launch
  themes (or a user-facing theme choice becomes a product ask), add a picker to
  the **start card**: one control per registered theme, the active one marked.
  Keep it inside step 10's boot-only contract — the tap rewrites `?theme=` and
  reloads, so there is still no `setTheme`, no disposal, no mid-round swap.
  Deferred: `?theme=` already covers preview/sharing for two themes, and a picker
  implies persistence plus a third selection path this step rules out.

## Risks / gotchas

- **Vite 8 dev ignores `define`** (F2): any future "compile-time constant" must
  be read through `import.meta.env` if dev must agree with the build.
- **Gate ordering** (F1): a harness block appended after the summary silently
  cannot fail. Append above the gate, always.
- **Bun vs Vite env**: Bun provides `import.meta.env`, but a bare `import.meta.env`
  read must tolerate absence in other runners — optional-chain it.
- **Precedence drift**: the URL must win over the built default; the
  `?theme=` checks are the guard.
- **PWA shortcuts carry no query string**: home-screen launches always get the
  built default. Document; do not "fix" with persistence (out of scope).
- **Two builds to verify**: a default-only build check misses a broken env read.
