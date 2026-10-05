#!/usr/bin/env bash
#
# Serve the production build over HTTPS on the LAN so the PWA can be installed
# and tested on a phone.
#
#   pnpm preview:mobile
#
# Why a proxy: service workers and install prompts require a secure context, so
# the phone has to reach the build over TLS rather than plain http on the LAN.
# Caddy does the TLS with its own local CA, which the phone must trust once.

set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_BUILD=0
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=1 ;;
        -h | --help)
            # Print the leading comment block, so this can't drift out of sync.
            awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
            exit 0
            ;;
        *)
            echo "unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

command -v caddy >/dev/null 2>&1 || {
    echo 'caddy not found: https://caddyserver.com/docs/install' >&2
    exit 1
}

# Caddy only needs TLS for us, never ACME, so it stays entirely offline.
export HTTPS_PORT="${HTTPS_PORT:-8443}"
export UPSTREAM="${UPSTREAM:-127.0.0.1:4173}"

detect_lan_ip() {
    ip -4 route get 1.1.1.1 2>/dev/null |
        awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

if [ -z "${LAN_IP:-}" ]; then
    LAN_IP="$(detect_lan_ip)"
fi

if [ -z "$LAN_IP" ]; then
    echo 'could not detect a LAN address; set LAN_IP manually' >&2
    exit 1
fi
export LAN_IP

if [ "$SKIP_BUILD" -eq 0 ]; then
    echo '==> building'
    pnpm build
fi

PREVIEW_PID=''
CADDY_PID=''

kill_quietly() {
    if [ -n "$1" ] && kill -0 "$1" 2>/dev/null; then
        kill "$1" 2>/dev/null || true
        wait "$1" 2>/dev/null || true
    fi
}

cleanup() {
    kill_quietly "$CADDY_PID"
    kill_quietly "$PREVIEW_PID"
}
# Trapped separately so an interrupt still tears both servers down. This only
# works while they are backgrounded: bash defers traps until a foreground child
# exits, so `wait` below is what makes Ctrl-C prompt.
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

echo "==> starting vite preview on $UPSTREAM"
pnpm exec vite preview --host 127.0.0.1 --port "${UPSTREAM##*:}" --strictPort &
PREVIEW_PID=$!

for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "http://$UPSTREAM/"; then break; fi
    if ! kill -0 "$PREVIEW_PID" 2>/dev/null; then
        echo 'vite preview exited early' >&2
        exit 1
    fi
    sleep 0.25
done

echo '==> validating Caddyfile'
caddy validate --config Caddyfile --adapter caddyfile >/dev/null

CA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/caddy/pki/authorities/local"
CA_CRT="$CA_DIR/root.crt"

cat <<EOF

==> serving
    desktop   https://localhost:$HTTPS_PORT
    phone     https://$LAN_IP:$HTTPS_PORT

    Phone and computer must be on the same network.

==> one-time: trust the certificate
    Caddy signs with its own local CA. The phone must trust it before the
    service worker will register.

    cert: $CA_CRT

    Android   Settings > Security > Encryption & credentials > Install a
              certificate > CA certificate, then pick that file.
    iOS       AirDrop/email the .crt to the phone, install the profile, then
              Settings > General > About > Certificate Trust Settings and
              enable full trust for the Caddy root.

    Ignore the warnings on the desktop browser, or add the cert to your
    system trust store instead:

      sudo cp "$CA_CRT" /usr/local/share/ca-certificates/caddy-local.crt
      sudo update-ca-certificates

    Afterwards: reload twice so the second load is served by the worker.
    Un-install the app from the home screen when changing the build, since a
    pinned worker keeps serving the old precache.

EOF

# Backgrounded so the traps above can fire on Ctrl-C; `wait` then blocks with
# bash able to interrupt it, which a foreground `caddy run` would prevent.
caddy run --config Caddyfile --adapter caddyfile &
CADDY_PID=$!

wait "$CADDY_PID"
