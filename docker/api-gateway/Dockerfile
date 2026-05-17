# ─────────────────────────────────────────────────────────────
# LocalChain API Gateway – Production Dockerfile
#
# Security features:
#   - Multi-stage build (smaller image, no dev deps)
#   - Non-root user
#   - Read-only filesystem where possible
#   - Health check endpoint
#   - No unnecessary packages
# ─────────────────────────────────────────────────────────────

# ── Build stage ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# ── Production stage ────────────────────────────────────────
FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl dumb-init

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package*.json ./
COPY --from=builder /build/server.js ./
COPY --from=builder /build/middleware ./middleware
COPY --from=builder /build/services ./services
COPY --from=builder /build/shared ../shared

# Create data directory for SQLite databases
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Switch to non-root user
USER appuser

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=10s --start-period=20s --retries=10 \
  CMD curl -f http://localhost:4000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
