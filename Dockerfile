# Wealthville MCP server — reproducible build for Glama introspection.
#
# This repo is a monorepo; the MCP server lives in ./mcp-server. Build context is
# the repository root, so all COPY paths are prefixed with `mcp-server/`.
#
# It is a stdio server: Glama (and any MCP client) launches the container and
# speaks newline-delimited JSON-RPC over stdin/stdout — no ports are exposed.
# The introspection handshake (initialize → tools/list) needs no network; the
# four read-only tools are registered at startup.

# ---- build stage: compile TypeScript → dist/ ----
FROM node:20-alpine AS build
WORKDIR /app/mcp-server
# Install all deps (incl. typescript) using the committed lockfile for reproducibility.
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci
COPY mcp-server/tsconfig.json ./
COPY mcp-server/src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/mcp-server
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/mcp-server/dist ./dist

# stdio MCP transport — Glama attaches to the container's stdin/stdout.
ENTRYPOINT ["node", "dist/index.js"]
