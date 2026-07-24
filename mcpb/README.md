# Wealthville — Claude Desktop one-click install (MCPB)

This folder builds an [MCPB bundle](https://github.com/anthropics/mcpb) (`.mcpb`) so
Wealthville installs into **Claude Desktop** with a double-click — no npm, no JSON editing.

## Install (for users)

1. Download `wealthville-<version>.mcpb` from the repo's
   [Releases](https://github.com/amitesh-m/wealthville-integrations/releases).
2. Double-click it (or drag it into Claude Desktop → Settings → Extensions).
3. Optionally paste a Wealthville partner key for a higher rate limit — it works
   anonymously otherwise. Done.

The four read-only tools (`get_pool_score`, `get_top_pools`, `get_track_record`,
`get_signals_feed`) appear immediately.

## Rebuild (for maintainers)

```bash
mcpb/build.sh          # → mcpb/wealthville-<version>.mcpb
```

The bundle version is synced from `mcp-server/package.json` automatically. Attach the
resulting `.mcpb` to the matching GitHub release; the binary itself is git-ignored.

`manifest.json` is the source of truth for the bundle metadata; `icon.png` is the
512×512 tile shown in Claude Desktop.
