#!/bin/bash
set -e

echo "🚀 Starting deployment to staging..."

# Generate build info
export BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
export BUILD_REF=$(git rev-parse --short HEAD)
export BUILD_VERSION="staging-$BUILD_REF"

# Validate environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is required"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo "❌ ERROR: REDIS_URL is required"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building application..."
npm run build

echo "🗄️ Running database migrations..."
npx prisma migrate deploy

echo "✨ Running database seed (if needed)..."
NODE_ENV=staging npm run db:seed

echo "🏗️ Starting application..."
npm run start

echo "✅ Deployment complete!"