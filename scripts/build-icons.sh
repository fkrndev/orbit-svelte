#!/usr/bin/env bash
# Regenerate icon.iconset/ from assets/icon-macos.svg.
#
# The iconset is a build artifact, but it is committed: `electrobun build` reads
# it directly and the alternative is every build depending on a macOS-only
# rasteriser. This script is how it gets refreshed when the mark changes — so the
# PNGs never drift from the SVG they came from.
#
# macOS only (qlmanage + sips). Run from the repository root.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/assets/icon-macos.svg"
out="$root/icon.iconset"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

[ -f "$src" ] || { echo "missing $src" >&2; exit 1; }

cp "$src" "$tmp/icon.svg"
qlmanage -t -s 1024 -o "$tmp" "$tmp/icon.svg" >/dev/null 2>&1
master="$tmp/icon.svg.png"
[ -f "$master" ] || { echo "qlmanage produced no PNG" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out"
gen() { sips -s format png -z "$1" "$1" "$master" --out "$out/$2.png" >/dev/null; }

gen 16   icon_16x16
gen 32   icon_16x16@2x
gen 32   icon_32x32
gen 64   icon_32x32@2x
gen 128  icon_128x128
gen 256  icon_128x128@2x
gen 256  icon_256x256
gen 512  icon_256x256@2x
gen 512  icon_512x512
gen 1024 icon_512x512@2x

# Fails loudly if a slot is missing or malformed, which a bare `sips` loop will not.
iconutil -c icns "$out" -o "$tmp/verify.icns"
echo "icon.iconset regenerated and verified"
