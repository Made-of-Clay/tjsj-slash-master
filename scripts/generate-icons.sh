#!/usr/bin/env bash
#
# Regenerate the PWA icon set from the two vector sources.
#
#   public/icons/icon.svg      -> icon-192.png, icon-512.png         (rounded, "any" purpose)
#   public/icons/maskable.svg  -> maskable-192.png, maskable-512.png  (full bleed, safe-zone art)
#                               -> apple-touch-icon.png (180, iOS applies its own mask)
#
# Requires ImageMagick with librsvg (`magick`). Icons are committed, so this
# only needs running when the sources change.

set -euo pipefail

cd "$(dirname "$0")/.."

command -v magick >/dev/null 2>&1 || {
    echo "magick not found: install ImageMagick to regenerate icons" >&2
    exit 1
}

dir=public/icons

render() {
    # -depth 8 keeps these ~80KB instead of ~550KB with no visible quality loss;
    # quantizing further saves bytes but bands the background gradient.
    magick -background none -density 384 "$1" -resize "${2}x${2}" -depth 8 -strip "$3"
    echo "  $3"
}

echo 'rendering icons'
render "$dir/icon.svg" 512 "$dir/icon-512.png"
render "$dir/icon.svg" 192 "$dir/icon-192.png"
render "$dir/maskable.svg" 512 "$dir/maskable-512.png"
render "$dir/maskable.svg" 192 "$dir/maskable-192.png"
render "$dir/maskable.svg" 180 "$dir/apple-touch-icon.png"
echo 'done'
