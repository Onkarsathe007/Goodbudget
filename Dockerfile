# syntax=docker/dockerfile:1

# ================================
# Stage 1: Dependencies
# ================================
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile --prod=false

# ================================
# Stage 2: Builder
# ================================

FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and config files
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN pnpm exec tsc

# ================================
# Stage 3: Production Dependencies
# ================================
FROM node:20-alpine AS prod-deps

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ================================
# Stage 4: Runtime
# ================================
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy production dependencies
COPY --from=prod-deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist

# Copy Prisma schema and generated client
COPY --from=builder --chown=appuser:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma

# Copy package.json for runtime info
COPY --chown=appuser:nodejs package.json ./

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R appuser:nodejs logs

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
