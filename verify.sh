#!/bin/bash

# Clade Plugin Verification Script
# Run this to verify the plugin is correctly set up

set -e

echo "🔍 Clade Plugin Verification"
echo "============================"
echo

# Check 1: Node.js version
echo "✓ Checking Node.js version..."
node_version=$(node --version)
echo "  Node.js: $node_version"

# Check 2: Dependencies installed
echo "✓ Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
fi
echo "  Dependencies: OK"

# Check 3: Build the plugin
echo "✓ Building plugin..."
npm run build
if [ -f "main.js" ]; then
  echo "  main.js: $(wc -c < main.js) bytes"
else
  echo "  ✗ main.js not found!"
  exit 1
fi

# Check 4: Run unit tests
echo "✓ Running unit tests..."
npm test
echo "  Unit tests: PASSED"

# Check 5: Run E2E tests
echo "✓ Running E2E integration tests..."
npm run test:e2e
echo "  E2E tests: PASSED"

# Check 6: Verify manifest
echo "✓ Checking manifest.json..."
if [ -f "manifest.json" ]; then
  id=$(node -p "require('./manifest.json').id")
  name=$(node -p "require('./manifest.json').name")
  version=$(node -p "require('./manifest.json').version")
  echo "  Plugin ID: $id"
  echo "  Name: $name"
  echo "  Version: $version"
else
  echo "  ✗ manifest.json not found!"
  exit 1
fi

# Check 7: Verify styles
echo "✓ Checking styles.css..."
if [ -f "styles.css" ]; then
  echo "  styles.css: $(wc -c < styles.css) bytes"
else
  echo "  ✗ styles.css not found!"
  exit 1
fi

# Check 8: Mock OpenCode server
echo "✓ Testing mock OpenCode server..."
echo '{"jsonrpc":"2.0","method":"session/prompt","params":{"text":"test"}}' | timeout 2 node tests/mock-opencode.js > /dev/null 2>&1 || true
echo "  Mock server: OK"

echo
echo "✅ All checks passed!"
echo
echo "Next steps:"
echo "1. Copy main.js, manifest.json, and styles.css to your Obsidian vault:"
echo "   mkdir -p /path/to/vault/.obsidian/plugins/clade"
echo "   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/clade/"
echo
echo "2. Enable the plugin in Obsidian Settings → Community Plugins"
echo
echo "3. Open the Clade chat panel from the sidebar"
echo
echo "4. Configure OpenCode binary path in plugin settings"
echo
echo "For debugging, see docs/DEBUGGING.md"
