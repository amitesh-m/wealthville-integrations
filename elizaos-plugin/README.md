# Wealthville plugin for ElizaOS

Lets [ElizaOS](https://github.com/elizaOS/eliza) agents answer liquidity-pool questions with live **Wealthville scores** — Enter/Hold/Exit verdicts + a composite 0–100 score for Solana and EVM pools — and cite the public, miss-inclusive [track record](https://www.wealthville.net/track-record).

Users ask your agent things like:

> *"Is `Czfq3xZZ…` safe to LP?"* · *"Best Solana pools right now?"* · *"How accurate are these scores?"*

## Actions

| Action | Triggers on | Returns |
| :--- | :--- | :--- |
| `GET_POOL_SCORE` | a pool address in the message | verdict + 4 scores, formatted |
| `GET_TOP_POOLS` | "best/top pools", "where to LP" | top 10 by Wealthville Score |
| `GET_WEALTHVILLE_TRACK_RECORD` | "accuracy", "trust", "hit rate" | live hit rates + IL-adjusted PnL |

Read-only public `GET` endpoints — no wallet access, no signing. Responses always carry the not-financial-advice line and the track-record URL.

## Usage

```ts
import { wealthvillePlugin } from '@wealthville/plugin-wealthville';

// in your character/agent config:
plugins: [wealthvillePlugin]
```

## Config (optional)

- `WEALTHVILLE_API_KEY` — free partner key, higher rate limit ([wealthville.net/developers](https://wealthville.net/developers)); anonymous works at 60 req/min.
- `WEALTHVILLE_API_URL` — override base URL.

## Note for upstream/registry contribution

This package builds standalone using structural types shape-compatible with `@elizaos/core`'s `Plugin`/`Action`. The registry PR swaps them for the real imports — no logic changes.

Data product, not financial advice.
