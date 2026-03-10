FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies layer
FROM base AS deps
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/
RUN npm ci --workspace=@smartattend/api --workspace=@smartattend/shared

# Build layer
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY services/api ./services/api
RUN npm run build --workspace=@smartattend/shared
RUN npm run build --workspace=@smartattend/api

# Production layer
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S smartattend && adduser -S smartattend -G smartattend

COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

RUN mkdir -p logs && chown -R smartattend:smartattend /app

USER smartattend

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]