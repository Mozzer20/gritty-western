#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$ROOT/www"
rm -rf "$WWW"
mkdir -p "$WWW/css" "$WWW/js" "$WWW/assets/art" "$WWW/assets/characters" "$WWW/assets/props" "$WWW/assets/sfx" "$WWW/assets/icons" "$WWW/assets/ui"

cp "$ROOT/index.html" "$ROOT/privacy.html" "$ROOT/manifest.json" "$WWW/"
cp "$ROOT/css/game.css" "$WWW/css/"
cp "$ROOT/js/physics.js" "$ROOT/js/audio.js" "$ROOT/js/levels.js" "$ROOT/js/ads.js" "$ROOT/js/native.js" "$ROOT/js/game.js" "$WWW/js/"

cp "$ROOT"/assets/art/* "$WWW/assets/art/"
cp "$ROOT"/assets/characters/*.webp "$WWW/assets/characters/"
cp "$ROOT"/assets/props/*.webp "$WWW/assets/props/"
cp "$ROOT"/assets/sfx/* "$WWW/assets/sfx/"
cp "$ROOT"/assets/icons/*.png "$WWW/assets/icons/"
cp "$ROOT"/assets/ui/og-share.jpg "$ROOT"/assets/ui/screenshot-phone.jpg "$ROOT"/assets/ui/screenshot-wide.jpg "$WWW/assets/ui/" 2>/dev/null || true

# Native app does not register a service worker.
echo "www synced $(find "$WWW" -type f | wc -l) files"
