#!/usr/bin/env node
/**
 * Wealthville MCP server — Streamable HTTP transport for hosted/remote
 * deployments (e.g. Smithery, or self-hosted at https://<host>/mcp).
 *
 * Stateless: a fresh McpServer + transport is created per request, so there is
 * no session state to leak between callers and the process scales horizontally.
 * All four tools are read-only, so statelessness costs nothing.
 *
 * Per-request config (optional) is read from, in order:
 *   - ?config=<base64 JSON>  (Smithery convention: { wealthvilleApiKey, wealthvilleApiUrl })
 *   - ?wealthvilleApiKey= / ?wealthvilleApiUrl=  (flat query params)
 *   - x-api-key header
 *   - falling back to WEALTHVILLE_API_KEY / WEALTHVILLE_API_URL env
 *
 * Env:
 *   PORT  — listen port (default 8080)
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import { buildServer, VERSION, type WealthvilleConfig } from './server.js';

const PORT = Number(process.env.PORT || 8080);

function parseConfig(req: Request): WealthvilleConfig {
    const q = req.query as Record<string, string | undefined>;
    let cfg: Record<string, unknown> = {};
    if (typeof q.config === 'string') {
        try { cfg = JSON.parse(Buffer.from(q.config, 'base64').toString('utf8')); } catch { /* ignore malformed config */ }
    }
    const apiKey = (cfg.wealthvilleApiKey as string | undefined) ?? q.wealthvilleApiKey ?? (req.headers['x-api-key'] as string | undefined);
    const apiUrl = (cfg.wealthvilleApiUrl as string | undefined) ?? q.wealthvilleApiUrl;
    return { apiKey, apiUrl };
}

const app = express();
app.use(express.json());

// Liveness probe for hosting platforms.
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, name: 'wealthville', version: VERSION });
});

// Streamable HTTP endpoint — stateless request/response.
app.post('/mcp', async (req: Request, res: Response) => {
    const server = buildServer(parseConfig(req));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch {
        if (!res.headersSent) {
            res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
        }
    }
});

// Stateless server: no server-initiated streams or session teardown.
const methodNotAllowed = (_req: Request, res: Response) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.listen(PORT, () => {
    // Log to stderr so it never pollutes any stdout JSON.
    console.error(`Wealthville MCP (Streamable HTTP) v${VERSION} listening on :${PORT} at POST /mcp`);
});
