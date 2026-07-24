/**
 * Wealthville MCP server core — builds the McpServer with all four read-only
 * tools. Shared by both transports: `index.ts` (stdio, local/npx) and
 * `http.ts` (Streamable HTTP, hosted deployments like Smithery).
 *
 * Config resolution order for each request/process: explicit `config` arg →
 * environment variables → defaults. This lets the HTTP transport pass per-request
 * config while the stdio transport relies on env.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'node:module';
import { z } from 'zod';

// Single source of truth for the version: read package.json at runtime so the
// serverInfo reported over MCP always matches the published npm version. dist/
// sits one level below package.json in the tarball, and npm always includes
// package.json, so '../package.json' resolves in the installed package.
const require = createRequire(import.meta.url);
export const VERSION = (require('../package.json') as { version: string }).version;

const DEFAULT_BASE_URL = 'https://wealthville.net';

const DISCLAIMER =
    'Wealthville scores are a data product, not financial advice. '
    + 'Methodology: https://www.wealthville.net/learn/wealthville-score — '
    + 'live track record (misses included): https://www.wealthville.net/track-record';

// All four tools are read-only GET wrappers over the public Wealthville API — no
// state changes and safe to retry. Surfaced as MCP annotation hints so Glama (and
// any client) can flag them non-destructive / read-only.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export interface WealthvilleConfig {
    /** Partner key for a higher rate limit; sent as x-api-key. Optional. */
    apiKey?: string;
    /** Override the API base URL. Optional; defaults to https://wealthville.net. */
    apiUrl?: string;
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

/** Build a fully-configured McpServer instance. Safe to call once per stdio process or once per HTTP request. */
export function buildServer(config: WealthvilleConfig = {}): McpServer {
    const baseUrl = (config.apiUrl || process.env.WEALTHVILLE_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const apiKey = config.apiKey || process.env.WEALTHVILLE_API_KEY;

    async function apiGet(path: string): Promise<unknown> {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(`${baseUrl}${path}`, { headers });
        if (!res.ok) {
            throw new Error(`Wealthville API ${res.status} for ${path}${res.status === 429 ? ' (rate limited — retry shortly or set WEALTHVILLE_API_KEY)' : ''}`);
        }
        return res.json();
    }

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

    return server;
}
