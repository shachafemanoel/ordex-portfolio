#!/bin/bash
set -e
echo "Checking lockfile consistency..."
# Using dry-run to check if npm ci would succeed
npm ci --omit=dev --ignore-scripts --dry-run
echo "Lockfile is consistent with package.json."
