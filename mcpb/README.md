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

## Privacy Policy

Full policy: **https://wealthville.net/privacy**

What this extension does with your data, in short:

- **It sends no personal data anywhere.** Every tool is a read-only `GET` against the public
  Wealthville API. The only thing transmitted is the argument you supply — a pool address, a
  result limit, or a day count.
- **No wallet, no keys, no signing.** The extension never requests a seed phrase, a private
  key, or a wallet connection, and it cannot construct or send a transaction.
- **No authentication is required.** The API is public and keyless. If you optionally set
  `WEALTHVILLE_API_KEY` to raise your rate limit, that key is sent only to
  `wealthville.net` as an `x-api-key` header and is stored only in your own local config.
- **No telemetry, no analytics, no third parties.** The extension makes requests to
  `wealthville.net` and nowhere else, and adds no tracking of its own.
- **Server-side logging** is limited to ordinary web-server request logs (IP, timestamp,
  path) for rate limiting and abuse prevention, as described in the policy above.

Conversation contents are never sent to Wealthville — only the specific tool arguments the
model passes.

## Rebuild (for maintainers)

```bash
mcpb/build.sh          # → mcpb/wealthville-<version>.mcpb
```

The bundle version is synced from `mcp-server/package.json` automatically. Attach the
resulting `.mcpb` to the matching GitHub release; the binary itself is git-ignored.

`manifest.json` is the source of truth for the bundle metadata; `icon.png` is the
512×512 tile shown in Claude Desktop.
