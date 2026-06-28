#!/usr/bin/env bash
# Builds a Chrome Web Store-ready zip of the extension.
#
# Usage:  ./package.sh
# Output: dist/pontoglass-extension-v<version>.zip
#
# Only ships runtime files — dev docs and the packaging script itself are excluded.
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(node -e "console.log(require('./manifest.json').version)" 2>/dev/null \
  || grep -m1 '"version"' manifest.json | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')

OUT_DIR="dist"
OUT="$OUT_DIR/pontoglass-extension-v${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

zip -r -q "$OUT" \
  manifest.json \
  config.js \
  popup.html popup.css popup.js \
  background.js \
  offscreen.html offscreen.js \
  lib \
  icons \
  -x '*.DS_Store'

echo "✓ Empacotado: $OUT"
echo "  Faça upload deste zip no Chrome Web Store Developer Dashboard."
