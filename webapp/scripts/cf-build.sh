#!/usr/bin/env bash
#
# Build the OpenNext/Cloudflare bundle on an APFS scratch directory.
#
# Why: this project lives on /Volumes/ARCHIVE, a filesystem that spawns macOS
# AppleDouble sidecar files (._*) whenever a file gets an extended attribute.
# Next's standalone output triggers them, and OpenNext's file tracer misreads
# `._page` as an "edge runtime" route, aborting the build. APFS (/tmp, $HOME)
# stores xattrs natively, so no sidecars — the build succeeds there.
#
# Usage:
#   ./scripts/cf-build.sh              # build only
#   ./scripts/cf-build.sh dev          # build, then `wrangler dev` from the copy
#   ./scripts/cf-build.sh deploy       # build, then `wrangler deploy` from the copy
#
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${TMPDIR:-/tmp}/voicebot-webapp-build"
ACTION="${1:-build}"

echo "→ syncing source to $BUILD (APFS)"
mkdir -p "$BUILD"
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .open-next \
  --exclude .wrangler --exclude .git \
  "$SRC/" "$BUILD/"

cd "$BUILD"
if [ ! -d node_modules ]; then
  echo "→ installing dependencies in the build copy"
  npm install --no-audit --no-fund
fi

echo "→ opennextjs-cloudflare build"
npx opennextjs-cloudflare build

case "$ACTION" in
  dev)    echo "→ wrangler dev"; exec npx wrangler dev ;;
  deploy) echo "→ wrangler deploy"; exec npx wrangler deploy ;;
  *)      echo "✓ Built in $BUILD"
          echo "  Preview: (cd $BUILD && npx wrangler dev)"
          echo "  Deploy:  (cd $BUILD && npx wrangler deploy)" ;;
esac
