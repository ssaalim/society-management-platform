# Base image
FROM node:20-alpine AS base

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=backend

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install only production dependencies
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
RUN npm ci --omit=dev --workspace=backend

COPY --from=builder --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist

USER nestjs

EXPOSE 4000
ENV PORT 4000

CMD ["node", "apps/backend/dist/src/main"]
