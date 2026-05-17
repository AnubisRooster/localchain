# ─────────────────────────────────────────────────────────────
# LocalChain Dashboard – Production Dockerfile
#
# Security features:
#   - Multi-stage build
#   - Non-root user
#   - Minimal production image
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Production stage ────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache curl dumb-init

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /build/package*.json ./
RUN npm ci --production --ignore-scripts

COPY --from=builder /build/.next ./.next
COPY --from=builder /build/public ./public
COPY --from=builder /build/next.config.js ./

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3000 || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
