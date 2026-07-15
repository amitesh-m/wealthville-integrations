/**
 * Wealthville plugin for ElizaOS — lets Eliza agents answer LP-pool questions
 * with live Wealthville scores and cite the public track record.
 *
 * Actions:
 *   GET_POOL_SCORE          — verdict + 0-100 scores for a pool address found in the message
 *   GET_TOP_POOLS           — pools ranked by Wealthville Score
 *   GET_WEALTHVILLE_TRACK_RECORD — live hit rates, misses included
 *
 * Structural types are declared locally, matched to @elizaos/core v2
 * (>=2.0.0-alpha) signatures, so this package builds standalone with core as
 * an optional peer dependency: v2 ActionExample shape ({ name, content }),
 * handlers returning ActionResult, HandlerCallback returning Memory[].
 *
 * Optional env: WEALTHVILLE_API_KEY, WEALTHVILLE_API_URL.
 */

// ── Minimal structural types matching @elizaos/core v2 ──────────────────────
type Runtime = Record<string, unknown>;
interface Content { text?: string; actions?: string[]; [k: string]: unknown }
interface Memory { content: Content; [k: string]: unknown }
type HandlerCallback = (response: Content, actionName?: string) => Promise<unknown[]>;
export interface ActionResult {
    success: boolean;
    text?: string;
    userFacingText?: string;
    verifiedUserFacing?: boolean;
    error?: string;
    [k: string]: unknown;
}
export interface ActionExample { name: string; content: Content }
export interface Action {
    name: string;
    similes?: string[];
    description: string;
    examples?: ActionExample[][];
    validate: (runtime: Runtime, message: Memory, state?: unknown) => Promise<boolean>;
    handler: (
        runtime: Runtime,
        message: Memory,
        state?: unknown,
        options?: unknown,
        callback?: HandlerCallback,
    ) => Promise<ActionResult | undefined>;
}
export interface Plugin {
    name: string;
    description: string;
    actions?: Action[];
}

// ── API client ──────────────────────────────────────────────────────────────
const BASE_URL = (process.env.WEALTHVILLE_API_URL || 'https://wealthville.net').replace(/\/$/, '');
const DISCLAIMER = 'Data: Wealthville (not financial advice) — track record incl. misses: https://www.wealthville.net/track-record';

async function apiGet(path: string): Promise<any> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.WEALTHVILLE_API_KEY) headers['x-api-key'] = process.env.WEALTHVILLE_API_KEY;
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`Wealthville API ${res.status} for ${path}`);
    return res.json();
}

// Pool keys: Solana base58, EVM 0x, or DefiLlama UUID.
const POOL_KEY_RE = /\b(0x[0-9a-fA-F]{40}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/;

const fmtScore = (d: any) =>
    `${d.pool_name} (${d.protocol}): verdict ${d.verdict}, Wealthville Score ${d.wealthville_score}/100 `
    + `(enter ${d.enter_score} / hold ${d.hold_score} / exit ${d.exit_score}). ${DISCLAIMER}`;

const ok = (text: string): ActionResult => ({ success: true, text, userFacingText: text, verifiedUserFacing: true });
const fail = (text: string, error: string): ActionResult => ({ success: false, text, userFacingText: text, verifiedUserFacing: true, error });

// ── Actions ─────────────────────────────────────────────────────────────────
const getPoolScore: Action = {
    name: 'GET_POOL_SCORE',
    similes: ['CHECK_POOL', 'POOL_RATING', 'IS_POOL_SAFE', 'LP_SCORE', 'SHOULD_I_LP'],
    description:
        'Fetch the Wealthville verdict (ENTER/HOLD/EXIT/AVOID) and 0-100 scores for a liquidity pool '
        + 'address mentioned in the message. Use whenever a user asks about LPing into a specific pool.',
    examples: [[
        { name: '{{user}}', content: { text: 'Is Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE safe to LP?' } },
        { name: '{{agent}}', content: { text: 'SOL/USDC (orca-whirlpool): verdict ENTER, Wealthville Score 93/100.', actions: ['GET_POOL_SCORE'] } },
    ]],
    validate: async (_rt, message) => POOL_KEY_RE.test(message.content.text ?? ''),
    handler: async (_rt, message, _state, _opts, callback) => {
        const m = (message.content.text ?? '').match(POOL_KEY_RE);
        if (!m) return fail('No pool address found in the message.', 'no pool key matched');
        try {
            const d = await apiGet(`/api/v1/scores/${encodeURIComponent(m[1])}`);
            const text = fmtScore(d);
            await callback?.({ text });
            return ok(text);
        } catch (e: any) {
            const text = `Couldn't fetch a Wealthville score for that pool (${e.message}). It may not be scored yet.`;
            await callback?.({ text });
            return fail(text, e.message);
        }
    },
};

const getTopPools: Action = {
    name: 'GET_TOP_POOLS',
    similes: ['BEST_POOLS', 'TOP_LP_POOLS', 'WHERE_TO_LP', 'HIGHEST_SCORED_POOLS'],
    description: 'List the current top liquidity pools ranked by composite Wealthville Score (0-100).',
    examples: [[
        { name: '{{user}}', content: { text: 'What are the best Solana pools to LP right now?' } },
        { name: '{{agent}}', content: { text: 'Top pools by Wealthville Score: SOL/USDC (meteora-dlmm) 94, SOL/USDC (orca-whirlpool) 94, …', actions: ['GET_TOP_POOLS'] } },
    ]],
    validate: async (_rt, message) => /\b(best|top|highest|good)\b.*\b(pool|lp|yield|liquidity)/i.test(message.content.text ?? ''),
    handler: async (_rt, _message, _state, _opts, callback) => {
        try {
            const d = await apiGet('/api/v1/scores/top?limit=10');
            const lines = (d.scores ?? []).map((s: any) =>
                `${s.pool_name} (${s.protocol}) — ${s.verdict}, WV ${s.wealthville_score}/100`);
            const text = `Top pools by Wealthville Score:\n${lines.join('\n')}\n${DISCLAIMER}`;
            await callback?.({ text });
            return ok(text);
        } catch (e: any) {
            const text = `Couldn't fetch top pools right now (${e.message}).`;
            await callback?.({ text });
            return fail(text, e.message);
        }
    },
};

const getTrackRecord: Action = {
    name: 'GET_WEALTHVILLE_TRACK_RECORD',
    similes: ['SCORE_ACCURACY', 'SIGNAL_PERFORMANCE', 'CAN_I_TRUST_WEALTHVILLE', 'HIT_RATE'],
    description:
        'Fetch Wealthville\'s live signal track record (hit rates, IL-adjusted PnL — misses included). '
        + 'Use when a user asks how reliable the scores are.',
    examples: [[
        { name: '{{user}}', content: { text: 'How accurate are these Wealthville scores anyway?' } },
        { name: '{{agent}}', content: { text: 'Over the last 30 days: ENTER hit rate 59.9% across 3,817 resolved signals…', actions: ['GET_WEALTHVILLE_TRACK_RECORD'] } },
    ]],
    validate: async (_rt, message) => /\b(track record|accurate|accuracy|hit rate|trust|performance|reliab)/i.test(message.content.text ?? ''),
    handler: async (_rt, _message, _state, _opts, callback) => {
        try {
            const d = await apiGet('/api/v1/track-record?days=30');
            const lines = (d.by_action ?? []).map((a: any) =>
                `${a.final_action}: ${(Number(a.hit_rate) * 100).toFixed(1)}% hit rate over ${a.resolved} resolved`
                + (a.avg_pnl_7d != null ? `, avg 7d PnL ${(Number(a.avg_pnl_7d) * 100).toFixed(2)}% (IL-adjusted)` : ''));
            const text = `Wealthville live track record, last ${d.window_days} days (misses included, ledger immutable):\n${lines.join('\n')}\nFull ledger: https://www.wealthville.net/track-record`;
            await callback?.({ text });
            return ok(text);
        } catch (e: any) {
            const text = `Couldn't fetch the track record right now (${e.message}).`;
            await callback?.({ text });
            return fail(text, e.message);
        }
    },
};

export const wealthvillePlugin: Plugin = {
    name: 'wealthville',
    description:
        'Wealthville liquidity-pool intelligence: Enter/Hold/Exit verdicts and 0-100 scores for Solana + EVM '
        + 'pools, with a public miss-inclusive track record.',
    actions: [getPoolScore, getTopPools, getTrackRecord],
};

export default wealthvillePlugin;
