#!/bin/bash

set -e

echo "🚀 Running post-deployment setup..."

# Check if we're in a production environment
if [ "$NODE_ENV" = "production" ]; then
    echo "🔧 Production post-deployment setup"
    
    # Apply database migrations if DATABASE_URL is configured
    if [ -n "$DATABASE_URL" ]; then
        echo "📦 Applying Prisma migrations"
        npx prisma migrate deploy || echo "⚠️ Warning: prisma migrate deploy failed (continuing)"
    else
        echo "ℹ️ DATABASE_URL not set, skipping migrations"
    fi
    
    # Optional: Sync WooCommerce data (only if configured)
    if [ -n "$WOOCOMMERCE_STORE_URL" ] && [ -n "$WOOCOMMERCE_KEY" ] && [ -n "$WOOCOMMERCE_PASSWORD" ]; then
        echo "🛒 WooCommerce credentials found, attempting sync..."
        # Run sync in background and don't fail deployment if it fails
        (npm run woocommerce:sync || echo "⚠️ Warning: WooCommerce sync failed") &
    else
        echo "ℹ️ WooCommerce not configured, skipping sync"
    fi
    
    echo "✅ Post-deployment setup completed successfully"
else
    echo "🔧 Development/staging post-deployment setup"
    
    echo "✅ Development setup completed"
fi
