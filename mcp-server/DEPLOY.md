# Self-hosting the Wealthville MCP server (HTTP)

Gives you a public **`https://…/mcp`** endpoint — what Smithery's "MCP Server URL"
field needs, and what any remote MCP client can connect to. The server is
**stateless and read-only**, so it scales trivially and needs no database.

Target layout (your infra): frontend on Vercel, backend + this server on your own
box. Run the MCP server as its own process on `:8090` and reverse-proxy a public
HTTPS host to it. A dedicated subdomain (`mcp.wealthville.net`) is cleanest.

---

## 1. Build

```bash
cd integrations/mcp-server
npm ci
npm run build          # produces dist/http.js
```

## 2. Run it (PM2)

A `mcp-http` app is already defined in `ecosystem.config.cjs` (data-pipeline root),
running `integrations/mcp-server/dist/http.js` on `PORT=8090`:

```bash
# from the data-pipeline root
pm2 start ecosystem.config.cjs --only mcp-http
pm2 save
# verify locally:
curl -s localhost:8090/health         # → {"ok":true,"name":"wealthville","version":"0.1.x"}
```

*(No PM2? `PORT=8090 npm run start:http`, or use `Dockerfile.http`:
`docker build -f Dockerfile.http -t wealthville-mcp-http . && docker run -p 8090:8090 wealthville-mcp-http`.)*

## 3. Expose it over HTTPS

Point a public host at `:8090`. **Turn buffering off** so MCP streaming responses
aren't held back.

**nginx** (e.g. server block for `mcp.wealthville.net`, TLS via certbot):

```nginx
server {
    server_name mcp.wealthville.net;

    location / {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   Connection '';
        proxy_buffering    off;      # required for MCP/SSE streaming
        proxy_cache        off;
        proxy_read_timeout 3600s;
    }
    # listen 443 ssl;  managed by certbot
}
```

**Caddy** (auto-TLS):

```
mcp.wealthville.net {
    reverse_proxy 127.0.0.1:8090 {
        flush_interval -1        # stream, don't buffer
    }
}
```

**Alternative — no subdomain, route a path on an existing host:** proxy
`location /mcp { proxy_pass http://127.0.0.1:8090/mcp; … }` under your API domain.
(Avoid routing it through the Vercel frontend — serverless proxies buffer/timeout
streaming responses.)

## 4. Verify the public URL

```bash
curl -s https://mcp.wealthville.net/health
curl -sX POST https://mcp.wealthville.net/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'
# expect serverInfo {"name":"wealthville",...}
```

## 5. Publish on Smithery

At `smithery.ai/servers/new`:

| Field | Value |
| :--- | :--- |
| Namespace / Server ID | `amitesh-m` / `wealthville` |
| MCP Server URL | `https://mcp.wealthville.net/mcp` |

---

### Config (optional)

The server works anonymously. To attach a partner key or point at a specific API,
set env on the process (`WEALTHVILLE_API_KEY`, `WEALTHVILLE_API_URL`), or let callers
pass per-request config via `?config=<base64 JSON>`, `?wealthvilleApiKey=…`, or an
`x-api-key` header.
