# Wealthville Integrations

Official connectors for the [Wealthville](https://wealthville.net) public data API — liquidity-pool **Enter/Hold/Exit verdicts** and the composite **Wealthville Score (0–100)** for Solana + EVM pools, backed by a public, immutable, **miss-inclusive** [track record](https://www.wealthville.net/track-record).

| Package | For | Install |
| :--- | :--- | :--- |
| [`mcp-server`](mcp-server/) | Claude, Cursor, any [MCP](https://modelcontextprotocol.io) client | `npx -y @wealthville/mcp-server` (npm pending — build from source below) |
| [`solana-agent-kit-plugin`](solana-agent-kit-plugin/) | [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) v2 agents | see package README |
| [`elizaos-plugin`](elizaos-plugin/) | [ElizaOS](https://github.com/elizaOS/eliza) agents | see package README |

All three are thin, **read-only** wrappers over four public `GET` endpoints — no wallet access, nothing to sign, no key required (a free [partner key](https://wealthville.net/developers) raises the rate limit).

## Quick start (MCP + Claude)

```bash
git clone https://github.com/amitesh-m/wealthville-integrations.git
cd wealthville-integrations/mcp-server
npm install && npm run build
claude mcp add wealthville -- node "$PWD/dist/index.js"
```

Then ask Claude: *"Is `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE` a good pool to LP into?"*

## The API underneath

```bash
curl https://wealthville.net/api/v1/scores/top?limit=5
curl https://wealthville.net/api/v1/track-record?days=30
```

Docs: [wealthville.net/developers](https://wealthville.net/developers) · OpenAPI: [/api/v1/openapi.json](https://wealthville.net/api/v1/openapi.json) · Methodology: [/learn/wealthville-score](https://www.wealthville.net/learn/wealthville-score)

## Why gate LP decisions on this data

- Every published signal is **frozen at publish time** and outcome-labeled after the fact — the track record includes misses and cannot be retro-edited.
- Outcomes are measured **after impermanent loss**, not raw APR.
- The same engine allocates Wealthville's own on-chain vault capital.

MIT licensed. Wealthville data is a data product, **not financial advice**.
