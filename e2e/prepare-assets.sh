#!/bin/bash
set -e

echo "=== Preparing Plugin Assets for E2E Testing ==="
echo ""

# Check if plugin is built
if [ ! -f "../main.js" ]; then
    echo "Plugin not built. Building now..."
    cd ..
    npm run build
    cd e2e
fi

# Create assets directory
mkdir -p assets

# Copy plugin files
echo "Copying plugin files..."
cp ../main.js assets/
cp ../manifest.json assets/

if [ -f "../styles.css" ]; then
    cp ../styles.css assets/
    echo "✓ Copied styles.css"
else
    echo "! styles.css not found (optional)"
fi

echo "✓ Copied main.js"
echo "✓ Copied manifest.json"

echo ""
echo "=== Assets Ready ==="
echo "Plugin assets are ready for E2E testing"
echo "Run ./setup.sh to start the test environment"
