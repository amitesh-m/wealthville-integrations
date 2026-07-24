#!/usr/bin/env bash
# Build the Wealthville MCPB bundle for one-click Claude Desktop install.
#
# The bundle IS the mcp-server npm package (package.json + dist + prod deps),
# so the runtime version-read (`../package.json` from dist/index.js) resolves
# inside the bundle exactly as it does when installed from npm. The manifest
# version is synced from mcp-server/package.json at build time — no drift.
#
# Usage:  mcpb/build.sh        → produces mcpb/wealthville-<version>.mcpb
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
VERSION="$(node -p "require('$ROOT/mcp-server/package.json').version")"

# Compile the server fresh.
( cd "$ROOT/mcp-server" && npm ci && npm run build )

# Stage the package (package.json is required for the runtime version-read).
cp "$ROOT/mcp-server/package.json" "$ROOT/mcp-server/README.md" "$STAGE/"
cp -r "$ROOT/mcp-server/dist" "$STAGE/dist"
cp "$HERE/icon.png" "$STAGE/icon.png"

# Sync the manifest version from package.json, then install prod deps only.
node -e "const fs=require('fs'),m=require('$HERE/manifest.json');m.version='$VERSION';fs.writeFileSync('$STAGE/manifest.json',JSON.stringify(m,null,2)+'\n')"
( cd "$STAGE" && npm install --omit=dev --no-audit --no-fund )

npx -y @anthropic-ai/mcpb pack "$STAGE" "$HERE/wealthville-$VERSION.mcpb"
echo "Built $HERE/wealthville-$VERSION.mcpb  (attach to a GitHub release; do not commit the binary)"
