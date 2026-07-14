# Wealthville plugin for Solana Agent Kit

Adds Wealthville pool intelligence to any [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) v2 agent — so agents check pool quality **before** opening or recommending LP positions.

## Actions

| Action | What it does |
| :--- | :--- |
| `WEALTHVILLE_GET_POOL_SCORE` | ENTER/HOLD/EXIT verdict + 0–100 scores for one pool |
| `WEALTHVILLE_GET_TOP_POOLS` | Pools ranked by composite Wealthville Score |
| `WEALTHVILLE_GET_TRACK_RECORD` | Live hit rates + IL-adjusted PnL — misses included |

All read-only (public `GET` endpoints — no wallet access, nothing to sign). Every result carries a `disclaimer` field; agents should relay it.

## Usage

```bash
npm install @wealthville/solana-agent-kit-plugin
```

```ts
import { SolanaAgentKit } from 'solana-agent-kit';
import WealthvillePlugin from '@wealthville/solana-agent-kit-plugin';

const agent = new SolanaAgentKit(wallet, rpcUrl, config).use(WealthvillePlugin);

// direct method call
const score = await agent.methods.getPoolScore('Czfq3xZZ…');
// → { pool_name: 'SOL/USDC', verdict: 'ENTER', wealthville_score: 93, … }
```

Or let the LLM drive: the actions register with the agent's action registry, so prompts like *"check whether this pool is safe to LP"* resolve to `WEALTHVILLE_GET_POOL_SCORE` automatically.

## Config (optional)

- `WEALTHVILLE_API_KEY` — partner key for a higher rate limit (free: [wealthville.net/developers](https://wealthville.net/developers)); anonymous works at 60 req/min.
- `WEALTHVILLE_API_URL` — override base URL.

## Why gate LP actions on this

Wealthville publishes a live, immutable track record **including misses** ([wealthville.net/track-record](https://www.wealthville.net/track-record)) and allocates its own on-chain vault capital with the same engine. The obvious agent pattern:

```
if ((await agent.methods.getPoolScore(pool)).verdict !== 'ENTER') skip(pool);
```

## Note for upstream contribution

This package builds standalone using structural types shape-compatible with Agent Kit v2's `Action`/`Plugin`. The PR into `sendaifun/solana-agent-kit` (as `@solana-agent-kit/plugin-wealthville`) swaps them for the real imports — no logic changes.

Data product, not financial advice.
