#!/usr/bin/env node
/**
 * Wealthville MCP server — exposes the public Wealthville data API
 * (https://wealthville.net/developers) as MCP tools so AI assistants can
 * answer "should I LP into this pool?" with a scored, track-recorded answer.
 *
 * Read-only; wraps four public HTTP endpoints. Optional env:
 *   WEALTHVILLE_API_KEY  — partner key (higher rate limit), sent as x-api-key
 *   WEALTHVILLE_API_URL  — override base URL (default https://wealthville.net)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.WEALTHVILLE_API_URL || 'https://wealthville.net').replace(/\/$/, '');
const API_KEY = process.env.WEALTHVILLE_API_KEY;

const DISCLAIMER =
    'Wealthville scores are a data product, not financial advice. '
    + 'Methodology: https://www.wealthville.net/learn/wealthville-score — '
    + 'live track record (misses included): https://www.wealthville.net/track-record';

async function apiGet(path: string): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (API_KEY) headers['x-api-key'] = API_KEY;
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) {
        throw new Error(`Wealthville API ${res.status} for ${path}${res.status === 429 ? ' (rate limited — retry shortly or set WEALTHVILLE_API_KEY)' : ''}`);
    }
    return res.json();
}

/** Every tool returns JSON plus the methodology/disclaimer line so agents repeat it. */
function toResult(data: unknown) {
    return {
        content: [
            { type: 'text' as const, text: JSON.stringify(data, null, 2) },
            { type: 'text' as const, text: DISCLAIMER },
        ],
    };
}

const server = new McpServer({ name: 'wealthville', version: '0.1.0' });

server.tool(
    'get_pool_score',
    'Get the Wealthville verdict (ENTER/HOLD/EXIT/AVOID) and scores (enter/hold/exit + composite '
    + 'Wealthville Score, 0-100) for one liquidity pool. Use before recommending or opening any LP position. '
    + 'Accepts a Solana pool address (base58) or an EVM 0x address / DefiLlama pool UUID.',
    { pool_address: z.string().min(8).describe('Pool address: Solana base58, EVM 0x, or DefiLlama UUID') },
    async ({ pool_address }) => toResult(await apiGet(`/api/v1/scores/${encodeURIComponent(pool_address)}`)),
);

server.tool(
    'get_top_pools',
    'List liquidity pools ranked by composite Wealthville Score (0-100), freshly scored within the last '
    + '6 hours. Good for "what are the best pools right now?" questions.',
    {
        limit: z.number().int().min(1).max(100).optional().describe('How many pools (default 25)'),
        chain: z.string().optional().describe('"solana" (default), "evm" (all EVM chains), or one EVM chain e.g. "ethereum", "base"'),
    },
    async ({ limit, chain }) => {
        const params = new URLSearchParams();
        if (limit) params.set('limit', String(limit));
        if (chain) params.set('chain', chain);
        const qs = params.toString();
        return toResult(await apiGet(`/api/v1/scores/top${qs ? `?${qs}` : ''}`));
    },
);

server.tool(
    'get_track_record',
    'Get Wealthville\'s live signal track record: per-action hit rates, IL-adjusted 7-day PnL, and recent '
    + 'resolved signals — misses included (the ledger is immutable at publish time). Use when asked whether '
    + 'Wealthville scores can be trusted, or for the system\'s recent performance.',
    { days: z.number().int().min(7).max(90).optional().describe('Window in days (default 30)') },
    async ({ days }) => toResult(await apiGet(`/api/v1/track-record${days ? `?days=${days}` : ''}`)),
);

server.tool(
    'get_signals_feed',
    'Get the latest published Wealthville signals (ENTER/EXIT/RISK_OFF calls with narrative and confidence). '
    + 'Use for "any new LP signals?" questions.',
    { limit: z.number().int().min(1).max(50).optional().describe('How many signals (default 20)') },
    async ({ limit }) => toResult(await apiGet(`/api/v1/signals/feed${limit ? `?limit=${limit}` : ''}`)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
