#!/bin/bash
set -e

echo "Installing Clade plugin..."

# Clade plugin directory
CLADE_DIR="/workspace/vault/.obsidian/plugins/clade"
mkdir -p "$CLADE_DIR"

# Copy plugin assets
echo "Copying Clade plugin assets..."
if [ -f /workspace/assets/main.js ]; then
    cp /workspace/assets/main.js "$CLADE_DIR/"
    echo "  Copied main.js"
else
    echo "ERROR: main.js not found in /workspace/assets/"
    exit 1
fi

if [ -f /workspace/assets/manifest.json ]; then
    cp /workspace/assets/manifest.json "$CLADE_DIR/"
    echo "  Copied manifest.json"
else
    echo "ERROR: manifest.json not found in /workspace/assets/"
    exit 1
fi

if [ -f /workspace/assets/styles.css ]; then
    cp /workspace/assets/styles.css "$CLADE_DIR/"
    echo "  Copied styles.css"
else
    echo "  Warning: styles.css not found in /workspace/assets/ (optional)"
fi

# Enable Clade plugin
echo "Enabling Clade plugin..."
COMMUNITY_PLUGINS_FILE="/workspace/vault/.obsidian/community-plugins.json"
if [ -f "$COMMUNITY_PLUGINS_FILE" ]; then
    # Add Clade to the list if not already present
    if ! grep -q "clade" "$COMMUNITY_PLUGINS_FILE"; then
        jq '. + ["clade"]' "$COMMUNITY_PLUGINS_FILE" > temp.json && mv temp.json "$COMMUNITY_PLUGINS_FILE"
    fi
else
    echo '["clade"]' > "$COMMUNITY_PLUGINS_FILE"
fi

# Configure Clade plugin settings
echo "Configuring Clade plugin..."
CLADE_DATA_FILE="$CLADE_DIR/data.json"
cat > "$CLADE_DATA_FILE" << 'EOF'
{
  "opencodeBinaryPath": "opencode",
  "envVars": {},
  "maxReconnectAttempts": 5,
  "reconnectBaseDelayMs": 1000,
  "sessionsDir": ".clade/sessions"
}
EOF

echo "Clade plugin installed successfully"
