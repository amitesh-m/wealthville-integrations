/**
 * Wealthville plugin for Solana Agent Kit (v2 plugin interface).
 *
 * Adds read-only data actions so agents can check pool quality BEFORE
 * opening/recommending LP positions:
 *   - WEALTHVILLE_GET_POOL_SCORE   — verdict + 0-100 scores for one pool
 *   - WEALTHVILLE_GET_TOP_POOLS    — pools ranked by Wealthville Score
 *   - WEALTHVILLE_GET_TRACK_RECORD — live hit rates, misses included
 *
 * Structural types are declared locally so this package builds standalone;
 * the upstream PR swaps them for `import type { Action, Plugin } from
 * 'solana-agent-kit'` (they are shape-compatible with v2).
 *
 * Optional env: WEALTHVILLE_API_KEY (partner key), WEALTHVILLE_API_URL.
 */
import { z } from 'zod';

// ── Minimal structural types matching solana-agent-kit v2 ──────────────────
type AgentLike = Record<string, unknown>;
export interface Action {
    name: string;
    similes: string[];
    description: string;
    examples: Array<Array<{ input: Record<string, unknown>; output: Record<string, unknown>; explanation: string }>>;
    schema: z.ZodTypeAny;
    handler: (agent: AgentLike, input: Record<string, any>) => Promise<Record<string, any>>;
}
export interface Plugin {
    name: string;
    methods: Record<string, (...args: any[]) => any>;
    actions: Action[];
    initialize: (agent: AgentLike) => void;
}

// ── API client ──────────────────────────────────────────────────────────────
const BASE_URL = (process.env.WEALTHVILLE_API_URL || 'https://wealthville.net').replace(/\/$/, '');
const DISCLAIMER =
    'Wealthville data product, not financial advice. Methodology: https://www.wealthville.net/learn/wealthville-score';

async function apiGet(path: string): Promise<any> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.WEALTHVILLE_API_KEY) headers['x-api-key'] = process.env.WEALTHVILLE_API_KEY;
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`Wealthville API ${res.status} for ${path}`);
    return res.json();
}

// ── Methods (also exposed as agent.methods.*) ───────────────────────────────
export async function getPoolScore(poolAddress: string): Promise<any> {
    return apiGet(`/api/v1/scores/${encodeURIComponent(poolAddress)}`);
}
export async function getTopPools(limit = 25, chain = 'solana'): Promise<any> {
    return apiGet(`/api/v1/scores/top?limit=${limit}&chain=${encodeURIComponent(chain)}`);
}
export async function getTrackRecord(days = 30): Promise<any> {
    return apiGet(`/api/v1/track-record?days=${days}`);
}

// ── Actions ─────────────────────────────────────────────────────────────────
const getPoolScoreAction: Action = {
    name: 'WEALTHVILLE_GET_POOL_SCORE',
    similes: ['check pool score', 'is this pool safe to LP', 'pool quality', 'should I provide liquidity', 'lp pool rating'],
    description:
        'Get the Wealthville verdict (ENTER/HOLD/EXIT/AVOID) and 0-100 scores for a liquidity pool. '
        + 'Call this before opening or recommending any LP position.',
    examples: [[{
        input: { poolAddress: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE' },
        output: { status: 'success', pool_name: 'SOL/USDC', verdict: 'ENTER', wealthville_score: 93 },
        explanation: 'SOL/USDC on Orca is rated ENTER with a Wealthville Score of 93/100.',
    }]],
    schema: z.object({
        poolAddress: z.string().min(8).describe('Pool address (Solana base58, EVM 0x, or DefiLlama UUID)'),
    }),
    handler: async (_agent, input) => {
        const data = await getPoolScore(String(input.poolAddress));
        return { status: 'success', ...data, disclaimer: DISCLAIMER };
    },
};

const getTopPoolsAction: Action = {
    name: 'WEALTHVILLE_GET_TOP_POOLS',
    similes: ['best pools right now', 'top rated liquidity pools', 'where to LP', 'highest scored pools'],
    description: 'List liquidity pools ranked by composite Wealthville Score (0-100), freshly scored within 6 hours.',
    examples: [[{
        input: { limit: 5 },
        output: { status: 'success', scores: [{ pool_name: 'SOL/USDC', wealthville_score: 94 }] },
        explanation: 'The top-scored pools right now.',
    }]],
    schema: z.object({
        limit: z.number().int().min(1).max(100).optional().describe('How many pools (default 25)'),
        chain: z.string().optional().describe('"solana" (default), "evm", or one EVM chain name'),
    }),
    handler: async (_agent, input) => {
        const data = await getTopPools(input.limit ?? 25, input.chain ?? 'solana');
        return { status: 'success', ...data, disclaimer: DISCLAIMER };
    },
};

const getTrackRecordAction: Action = {
    name: 'WEALTHVILLE_GET_TRACK_RECORD',
    similes: ['wealthville performance', 'can I trust these scores', 'signal hit rate', 'score accuracy'],
    description:
        'Get Wealthville\'s live signal track record: hit rates and IL-adjusted 7-day PnL per action, '
        + 'misses included (the ledger is immutable at publish time).',
    examples: [[{
        input: { days: 30 },
        output: { status: 'success', by_action: [{ final_action: 'ENTER', hit_rate: '0.6' }] },
        explanation: 'Aggregated outcomes of every published signal in the window.',
    }]],
    schema: z.object({
        days: z.number().int().min(7).max(90).optional().describe('Window in days (default 30)'),
    }),
    handler: async (_agent, input) => {
        const data = await getTrackRecord(input.days ?? 30);
        return { status: 'success', ...data, disclaimer: DISCLAIMER };
    },
};

const WealthvillePlugin: Plugin = {
    name: 'wealthville',
    methods: { getPoolScore, getTopPools, getTrackRecord },
    actions: [getPoolScoreAction, getTopPoolsAction, getTrackRecordAction],
    initialize: () => { /* read-only data plugin — nothing to set up */ },
};

export default WealthvillePlugin;
