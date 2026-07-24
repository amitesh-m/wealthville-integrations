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
import { createRequire } from 'node:module';
import { z } from 'zod';

// Single source of truth for the version: read package.json at runtime so the
// serverInfo reported over MCP always matches the published npm version. dist/
// sits one level below package.json in the tarball, and npm always includes
// package.json, so '../package.json' resolves in the installed package.
const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json') as { version: string };

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

// All four tools are read-only GET wrappers over the public Wealthville API — no
// state changes and safe to retry. Surfaced as MCP annotation hints so Glama (and
// any client) can flag them non-destructive / read-only.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

const server = new McpServer({ name: 'wealthville', version: VERSION });

server.tool(
    'get_pool_score',
    'Get the Wealthville verdict (ENTER/HOLD/EXIT/AVOID) and scores (enter/hold/exit + composite '
    + 'Wealthville Score, 0-100) for one liquidity pool. Use before recommending or opening any LP position. '
    + 'Accepts a Solana pool address (base58) or an EVM 0x address / DefiLlama pool UUID.',
    { pool_address: z.string().min(8).describe('Pool address: Solana base58, EVM 0x, or DefiLlama UUID') },
    READ_ONLY,
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
    READ_ONLY,
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
    READ_ONLY,
    async ({ days }) => toResult(await apiGet(`/api/v1/track-record${days ? `?days=${days}` : ''}`)),
);

server.tool(
    'get_signals_feed',
    'Get the latest published Wealthville signals (ENTER/EXIT/RISK_OFF calls with narrative and confidence). '
    + 'Use for "any new LP signals?" questions.',
    { limit: z.number().int().min(1).max(50).optional().describe('How many signals (default 20)') },
    READ_ONLY,
    async ({ limit }) => toResult(await apiGet(`/api/v1/signals/feed${limit ? `?limit=${limit}` : ''}`)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
