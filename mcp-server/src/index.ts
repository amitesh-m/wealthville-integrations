#!/usr/bin/env node
/**
 * Wealthville MCP server — stdio transport (local / npx).
 *
 * Exposes the public Wealthville data API (https://wealthville.net/developers)
 * as MCP tools so AI assistants can answer "should I LP into this pool?" with a
 * scored, track-recorded answer. Read-only; wraps four public GET endpoints.
 *
 * Optional env:
 *   WEALTHVILLE_API_KEY  — partner key (higher rate limit), sent as x-api-key
 *   WEALTHVILLE_API_URL  — override base URL (default https://wealthville.net)
 *
 * For hosted/remote deployments (HTTP), see ./http.ts.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';

const server = buildServer();
await server.connect(new StdioServerTransport());
