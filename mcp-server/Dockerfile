# Wealthville MCP server — Dockerfile for Glama when it builds with THIS subfolder
# (mcp-server/) as the build context. A mirror of the repo-root Dockerfile exists
# for root-context builds; whichever context Glama uses, a valid build is found.
#
# stdio server: Glama launches the container and speaks newline-delimited JSON-RPC
# over stdin/stdout — no ports. The introspection handshake (initialize -> tools/list)
# needs no network; the four read-only tools are registered at startup.

# ---- build stage: compile TypeScript -> dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# stdio MCP transport — Glama attaches to the container's stdin/stdout.
ENTRYPOINT ["node", "dist/index.js"]
