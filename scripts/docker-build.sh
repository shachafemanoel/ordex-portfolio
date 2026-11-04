#!/bin/bash

# Docker Build Script with Enhanced Next.js Support
# Handles permission issues and trace file creation for Ordex OMS

set -euo pipefail

echo "🐋 Starting Docker build for Ordex OMS..."

# Ensure .next directory exists with proper permissions before build
echo "📁 Creating .next directory structure..."
mkdir -p .next/cache
mkdir -p .next/server  
mkdir -p .next/static
mkdir -p .next/standalone

# Create the trace file that Next.js needs
echo "📝 Creating Next.js trace file..."
touch .next/trace
touch .next/build-manifest.json
touch .next/export-marker.json

# Set permissions for Next.js build
echo "🔒 Setting proper permissions..."
chmod -R 755 .next/
chown -R $(id -u):$(id -g) .next/ 2>/dev/null || true

# Verify permissions
echo "✅ Verifying .next directory permissions..."
ls -la .next/ || echo "⚠️  .next directory not yet created"

# Run the Next.js build
echo "🏗️  Running Next.js build..."
export NODE_ENV=production
export SKIP_ENV_VALIDATION=true
export NEXT_TELEMETRY_DISABLED=1
export GENERATE_SOURCEMAP=false
export DOCKER_BUILD=true

# Create empty trace file content if needed
echo '{"version":1,"steps":[]}' > .next/trace

# Try build with tracing, fallback to build without on permission error
if ! npm run build 2>&1; then
    echo "⚠️  Build failed, likely due to trace file permission. Retrying with output tracing disabled..."
    # Temporarily disable output file tracing
    export NEXT_OUTPUT_TRACING=false
    rm -f .next/trace 2>/dev/null || true
    npm run build || {
        echo "❌ Build failed even without tracing. Check build logs above."
        exit 1
    }
fi

echo "✅ Docker build completed successfully!"