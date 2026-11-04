#!/bin/bash

# Simple fix for Next.js trace permission issue
# This script ensures proper permissions before and after build

echo "🔧 Fixing Next.js build permissions..."

# Create .next directory with correct permissions
mkdir -p .next
chmod 777 .next

# Create trace file with write permissions
touch .next/trace
chmod 666 .next/trace

echo "✅ Permissions set. Running build..."

# Run the build
npm run build

echo "✅ Build completed!"