#!/bin/bash

# Development Environment Setup Script for Ordex OMS (PostgreSQL)
set -e

echo "🚀 Setting up Ordex OMS Development Environment (PostgreSQL)..."

# Check if .env.development exists, if not copy from template
if [ ! -f ".env.development" ]; then
    echo "📝 Creating .env.development from template..."
    if [ -f ".env.development.template" ]; then
        cp .env.development.template .env.development
        echo "⚠️  Please review and update .env.development with your settings"
    else
        echo "❌ .env.development.template not found. Please create .env.development manually."
        exit 1
    fi
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Start development databases
echo "🐘 Starting PostgreSQL and Redis..."
npm run dev:db

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate dev

# Seed database with initial data
if [ -f "prisma/seed.ts" ]; then
    echo "🌱 Seeding database with initial data..."
    npm run seed
fi

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
npx husky install

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Open http://localhost:3000 in your browser"
echo "  3. Check the dashboard at http://localhost:3000/dashboard"
echo "  4. Access Prisma Studio at 'npm run prisma:studio'"
echo "  5. View emails at http://localhost:8025 (MailHog)"
echo ""
echo "📋 Available commands:"
echo "  npm run dev:full     - Start databases and dev server"
echo "  npm run dev:db       - Start only databases"
echo "  npm run quality      - Run all quality checks"
echo "  npm run format       - Format code with Prettier"
echo "  npm run test:ui      - Run tests with UI"
echo ""
echo "🗄️ Database info:"
echo "  Type: PostgreSQL"
echo "  Host: localhost:5432"
echo "  Database: ordex_dev"
echo "  Redis: localhost:6379"
echo "  MailHog: localhost:8025"
echo ""