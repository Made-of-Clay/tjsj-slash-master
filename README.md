# Slash Master

Three.js Journey Challenge: Halloween (Oct 2026)

Game mimicking fruit ninja for learning purposes and experimenting with basic 2.5D game.

Also exploring balance between agentic coding and my own learning in the process. (I'm aiming to use agents for lots of ceremony and boring configs [heavy vibe-coding], then more mixture of me and agent coding for my learning and hands-on, human-in-the-loop process.)

ATTENTION: KEEP INFO ULTRA-TERSE (sentence fragments okay if clear)

## Tech Details

Stack:

- Three.js
- TypeScript
- Vite

CLI Commands:

Installation

```bash
pnpm i
```

Run dev mode

```bash
pnpm dev
```

Build

```bash
pnpm build
```

Run build

```bash
pnpm preview
```

Run build, then serve it over HTTPS on the LAN for phone testing

```bash
pnpm preview:mobile
```

Regenerate the PWA icons (needs ImageMagick)

```bash
pnpm icons
```

## PWA

Installable: a precaching service worker plus manifest, generated during
`pnpm build` and registered from `src/main.ts`. Updates apply silently on the
next load. Config is in `vite.config.ts`, icons in `public/icons` (regenerate
with `pnpm icons`).

`pnpm preview:mobile` builds, serves `vite preview` on loopback, and proxies it
over HTTPS on the LAN so you can install it on a phone. The device has to trust
Caddy's root CA once — service workers need a secure context, so plain
`http://<lan-ip>` won't register the worker. The script prints the `root.crt`
path plus the Android/iOS steps.

To silence desktop browser warnings, trust the CA system-wide:

```bash
sudo cp "${XDG_DATA_HOME:-$HOME/.local/share}/caddy/pki/authorities/local/root.crt" \
  /usr/local/share/ca-certificates/caddy-local.crt && sudo update-ca-certificates
```

Re-testing a changed build: reload twice, since the first load is still the old
worker, and uninstall from the home screen if it sticks. Override the address
via `LAN_IP`, `HTTPS_PORT`, or `UPSTREAM`.

## CICD Setup

Ensure your GitHub repo exists before starting.

### Firebase

Firebase is my current static hosting provider.

- Create a site under the playground project.
- run `firebase-tools init hosting:github` and follow the prompts
  - might run `npm config get prefix` to find the bin if PATH isn't configured correctly
- Ensure firebase.json `hosting.site` is entered correctly

### GitHub Actions

- Ensure project builds without error/lint (this breaks/stops builds).
- Push files to remote and what actions for a successful build/deployment.
