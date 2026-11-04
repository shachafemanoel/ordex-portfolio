# syntax=docker/dockerfile:1
# Ordex OMS Production Dockerfile

# ============================================================================
# DEPENDENCIES STAGE (All dependencies for building)
# ============================================================================
FROM node:20-slim AS deps
LABEL maintainer="Ordex Development Team"
LABEL description="Ordex Order Management System"

WORKDIR /app

# Copy package files, Prisma schema & config (needed for postinstall hook)
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install ALL dependencies (needed for build)
RUN apt-get update -y \
  && apt-get install -y openssl \
  && npm install -g npm@11.7.0 \
  && npm ci --no-audit --no-fund --prefer-offline --progress=false \
  && npm cache clean --force

# ============================================================================
# PRODUCTION DEPENDENCIES STAGE (Only production deps)
# ============================================================================
FROM node:20-slim AS prod-deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install OpenSSL for Prisma in this stage and production dependencies
# Use --ignore-scripts to skip the prepare script (which tries to run husky)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g npm@11.7.0 \
  && npm ci --omit=dev --no-audit --no-fund --prefer-offline --progress=false --ignore-scripts

# Copy only what prisma generate needs
COPY prisma ./prisma
COPY prisma.config.ts ./

# Provide placeholder DATABASE_URL for Prisma schema validation during generate
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public

# Then explicitly run prisma generate which is needed at runtime
RUN npx prisma generate \
  && npm cache clean --force

# ============================================================================
# BUILDER STAGE
# ============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies (only openssl needed for Prisma)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Clean sensitive/dev-only paths
RUN rm -f .env* \
  && rm -f *.log \
  && rm -rf .git tests __tests__ coverage \
  && mkdir -p workers

# Set environment variables before Prisma generation
ENV NODE_ENV=production
ENV DOCKER_BUILD=true
ENV SKIP_ENV_VALIDATION=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV GENERATE_SOURCEMAP=false
ENV CI=true
# Provide a placeholder to satisfy Prisma env validation during build
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public

# Only allow passing PUBLIC keys as build args. Private keys must be runtime envs.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_GEMINI_ENABLED

ENV NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN}
ENV NEXT_PUBLIC_GEMINI_ENABLED=${NEXT_PUBLIC_GEMINI_ENABLED}

# Generate Prisma client and build
RUN npx prisma generate && npm run build

# ============================================================================
# RUNTIME STAGE
# ============================================================================
FROM node:20-slim AS runner

# Create non-root user
RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

# Install only essential runtime packages
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    dumb-init \
    curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

## Copy Next.js standalone server and static assets
# Standalone server (includes minimal node_modules)
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
# Public assets and Next static files
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# Use production-only node_modules (smaller, faster)
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Include Prisma schema, config, and migrations for runtime-safe migrations
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Optionally include workers if used at runtime
COPY --from=builder --chown=nodejs:nodejs /app/workers ./workers

# Include runtime scripts (startup, migrations, etc.)
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Ensure startup scripts are executable
RUN chmod +x /app/scripts/*.sh

# Logs dir permissions
RUN mkdir -p /app/logs \
  && chown -R nodejs:nodejs /app/logs \
  && chmod 755 /app/logs

# No need to prune here because standalone includes minimal runtime deps

# Harden permissions but preserve executables in /app/scripts
RUN find /app -type f ! -path "/app/scripts/*" -exec chmod 644 {} \; \
  && find /app -type d -exec chmod 755 {} \; \
  && chmod 755 /app \
  && chmod -R 755 /app/scripts

USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-3000}/api/health || exit 1

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
# Use startup script directly
CMD ["/app/scripts/docker-startup.sh"]
