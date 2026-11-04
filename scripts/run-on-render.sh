#!/bin/bash
# Script to run migrations and seeding on Render
# This should be executed on the Render service via shell or startup script

set -e

echo "🚀 Starting Render deployment setup..."

# Run Prisma migrations
echo "📋 Running database migrations..."
npx prisma migrate deploy

# Run main seed
echo "🌱 Seeding database..."
npm run seed

# Seed Redis
echo "🔴 Seeding Redis..."
npm run seed:redis || echo "Redis seed failed, continuing..."

# Warm cache
echo "🔥 Warming cache..."
npm run warm || echo "Cache warming failed, continuing..."

echo "✅ Setup complete!"
