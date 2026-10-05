## Change Log

Record **ultra-terse** changes below. Sentence fragments okay if clear. Only log relevant details. Agents aren't blogging.

## 2026-10-05

- PWA: installable via `vite-plugin-pwa` — precache service worker + manifest, generated in `pnpm build`, registered from `src/main.ts`. Silent auto-update.
- Icons: 5 sizes generated from `public/icons/*.svg`; `pnpm icons` regenerates.
- Phone testing: `pnpm preview:mobile` builds, runs `vite preview` on loopback, proxies over TLS via Caddy. Device must trust Caddy's root CA once — SWs need a secure context, so plain `http://<lan-ip>` won't register the worker.
- Mobile shell: `touch-action: none` on canvas, `100dvh`, safe-area vars, notch/landscape/iOS meta.
- `firebase.json`: `no-cache` on `sw.js` + manifest, immutable on hashed assets.
- Fix: `pnpm build` was already broken at HEAD — unused `#cameraFolder` private field tripped `noUnusedLocals`. CI deploy was failing too.
- Caveat: keep `workbox-window` an explicit devDep. pnpm's auto-installed peer isn't resolvable by Rolldown, so the build fails without it.
