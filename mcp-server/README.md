# Wealthville MCP Server

Gives AI assistants (Claude, Cursor, or anything that speaks [MCP](https://modelcontextprotocol.io)) live access to **Wealthville pool scores** — Enter/Hold/Exit verdicts and the composite Wealthville Score (0–100) for Solana + EVM liquidity pools, plus the public, miss-inclusive [track record](https://www.wealthville.net/track-record).

Ask your assistant things like:

> *"Is this Meteora pool safe to LP into?"* · *"What are the top 10 Solana pools right now?"* · *"How has Wealthville's ENTER signal performed lately?"*

## Tools

| Tool | What it does |
| :--- | :--- |
| `get_pool_score` | Verdict + 4 scores for one pool (Solana base58, EVM 0x, or DefiLlama UUID) |
| `get_top_pools` | Pools ranked by Wealthville Score (`limit`, `chain`) |
| `get_track_record` | Live hit rates + IL-adjusted PnL, misses included (`days`) |
| `get_signals_feed` | Latest published ENTER/EXIT signals (`limit`) |

Every response includes the methodology link and the "not financial advice" note, so assistants relay them.

## Install

**Claude Code:**

```bash
claude mcp add wealthville -- npx -y @wealthville/mcp-server
```

**Claude Desktop / other MCP clients** — add to the MCP config:

```json
{
  "mcpServers": {
    "wealthville": {
      "command": "npx",
      "args": ["-y", "@wealthville/mcp-server"]
    }
  }
}
```

**From source:** `npm install && npm run build`, then point your MCP config at `node dist/index.js`.

## Configuration (optional)

| Env var | Purpose |
| :--- | :--- |
| `WEALTHVILLE_API_KEY` | Partner key → higher rate limit (get one at [wealthville.net/developers](https://wealthville.net/developers)) |
| `WEALTHVILLE_API_URL` | Override the API base URL (default `https://wealthville.net`) |

No key is required — anonymous access is 60 req/min per IP.

## Notes

- Read-only: this server only calls public `GET` endpoints; it never touches wallets or signs anything.
- Data is a product of [Wealthville](https://wealthville.net); it is **not financial advice**.
