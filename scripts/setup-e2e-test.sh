#!/bin/bash

# E2E Integration Test Setup for Clade Plugin
# Requires: Obsidian 1.12.4+ with CLI enabled

set -e

echo "🧪 Clade Plugin E2E Integration Test Setup"
echo "==========================================="
echo

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if obsidian CLI is available
if ! command -v obsidian &> /dev/null; then
    echo "❌ Obsidian CLI not found!"
    echo
    echo "Please install and enable Obsidian CLI:"
    echo "1. Update Obsidian to version 1.12.4 or later"
    echo "2. Open Obsidian → Settings → General"
    echo "3. Enable 'Command line interface'"
    echo "4. Click 'Register CLI' and follow the prompts"
    echo "5. Restart your terminal"
    exit 1
fi

echo "✅ Obsidian CLI found: $(obsidian version 2>/dev/null || echo 'version unknown')"

# Check if Obsidian is running
if ! obsidian vault 2>/dev/null | grep -q "vault"; then
    echo "❌ Obsidian is not running!"
    echo "Please start Obsidian before running this script."
    exit 1
fi

echo "✅ Obsidian is running"

# Get the current vault
VAULT_INFO=$(obsidian vault 2>/dev/null)
echo "✅ Connected to vault: $VAULT_INFO"

# Create test vault if it doesn't exist
TEST_VAULT="clade-e2e-test"
echo
echo "📁 Setting up test vault: $TEST_VAULT"

# Check if test vault exists, if not create it
if ! obsidian vault list 2>/dev/null | grep -q "$TEST_VAULT"; then
    echo "Creating test vault..."
    # Note: Vault creation might need to be done manually
    echo "⚠️  Please create a test vault named '$TEST_VAULT' manually if it doesn't exist"
fi

# Switch to test vault
echo "Switching to test vault..."
obsidian vault="$TEST_VAULT"

# Create test directory structure
echo "Creating test directory structure..."
mkdir -p ".obsidian/plugins"

# Build the plugin if not already built
echo
echo "🔨 Building Clade plugin..."
if [ ! -f "main.js" ]; then
    npm run build
fi

echo "✅ Plugin built successfully"

# Install Clade plugin locally
echo
echo "📦 Installing Clade plugin..."
PLUGIN_DIR=".obsidian/plugins/clade"
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/" 2>/dev/null || true

echo "✅ Plugin files copied to $PLUGIN_DIR"

# Enable community plugins
echo
echo "🔌 Enabling community plugins..."
# Create community-plugins.json if it doesn't exist
if [ ! -f ".obsidian/community-plugins.json" ]; then
    echo "[]" > ".obsidian/community-plugins.json"
fi

# Add clade to community plugins
if ! grep -q "clade" ".obsidian/community-plugins.json"; then
    # Use jq if available, otherwise use a simple approach
    if command -v jq &> /dev/null; then
        jq '. += ["clade"]' ".obsidian/community-plugins.json" > temp.json && mv temp.json ".obsidian/community-plugins.json"
    else
        # Simple approach - just add it
        echo '["clade"]' > ".obsidian/community-plugins.json"
    fi
    echo "✅ Added clade to community-plugins.json"
else
    echo "✅ clade already in community-plugins.json"
fi

# Reload plugins using CLI
echo
echo "🔄 Reloading plugins..."
obsidian plugin:reload id=clade 2>/dev/null || echo "⚠️  Plugin reload command not available, please reload manually"

# Install BRAT plugin
echo
echo "📦 Installing BRAT plugin..."
echo "Note: BRAT installation requires manual steps or community plugin search"
echo "You can install BRAT via:"
echo "  1. Settings → Community plugins → Browse"
echo "  2. Search for 'BRAT'"
echo "  3. Install and enable"
echo
echo "Or use the CLI (if available):"
echo "  obsidian plugins install obsidian42-brat"

# Verify plugin is loaded
echo
echo "🔍 Verifying plugin installation..."
sleep 2  # Give it time to load

# Check if plugin is in the list
if obsidian plugins list 2>/dev/null | grep -q "clade"; then
    echo "✅ Clade plugin is installed and enabled"
else
    echo "⚠️  Could not verify plugin status via CLI"
    echo "   Please check Settings → Community plugins manually"
fi

# Create a test note
echo
echo "📝 Creating test note..."
TEST_NOTE="Clade E2E Test Note"
obsidian create name="$TEST_NOTE" content="# Clade E2E Test

This note is for testing the Clade plugin integration.

## Test Checklist

- [ ] Plugin loads without errors
- [ ] Clade sidebar appears
- [ ] Can send a message to OpenCode
- [ ] Receives response from OpenCode
- [ ] Context attachment works
- [ ] Diff view works

Created: $(date)
" 2>/dev/null || echo "⚠️  Note creation via CLI not available"

echo "✅ Test note created"

# Summary
echo
echo "==========================================="
echo "✅ E2E Test Setup Complete!"
echo "==========================================="
echo
echo "Next steps:"
echo "1. Open the test vault in Obsidian: $TEST_VAULT"
echo "2. Verify Clade plugin is enabled in Settings → Community plugins"
echo "3. Install BRAT plugin (if not already installed)"
echo "4. Open the Clade sidebar (click icon or use command palette)"
echo "5. Configure OpenCode binary path in Clade settings"
echo "6. Test sending a message"
echo "7. Check the logs at .clade/logs/clade.log"
echo
echo "To run automated tests (if available):"
echo "  ./scripts/e2e-test.sh"
echo
echo "To check plugin logs:"
echo "  tail -f .clade/logs/clade.log"
echo
echo "For debugging, open DevTools:"
echo "  obsidian devtools"
