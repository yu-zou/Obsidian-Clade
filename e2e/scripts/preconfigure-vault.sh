#!/bin/bash
set -e

echo "Pre-configuring vault for CLI..."

# Create .obsidian directory structure
mkdir -p /workspace/vault/.obsidian/plugins

# Configure app.json to enable CLI
# Note: The exact key for CLI may vary by Obsidian version
# This is based on Obsidian 1.12+ structure
APP_JSON="/workspace/vault/.obsidian/app.json"
if [ -f "$APP_JSON" ]; then
    # Update existing app.json
    jq '.cli = true' "$APP_JSON" > temp.json && mv temp.json "$APP_JSON"
else
    # Create new app.json
    cat > "$APP_JSON" << 'EOF'
{
  "cli": true,
  "strictLineBreaks": false,
  "showLineNumber": true,
  "spellcheck": false,
  "defaultViewMode": "source",
  "livePreview": true,
  "readableLineLength": true
}
EOF
fi

echo "Vault configured with CLI enabled"

# Create a test note
TEST_NOTE="/workspace/vault/test-note.md"
if [ ! -f "$TEST_NOTE" ]; then
    cat > "$TEST_NOTE" << 'EOF'
# Test Note

This is a test note for Clade plugin E2E testing.

## Test Content

- Item 1
- Item 2
- Item 3
EOF
    echo "Created test note"
fi

echo "Vault pre-configuration complete"
