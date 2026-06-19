#!/bin/bash
set -e

echo "Installing BRAT plugin..."

# BRAT plugin repository
BRAT_REPO="TfTHacker/obsidian42-brat"

# Get latest release
echo "Fetching latest BRAT release..."
RELEASE_INFO=$(curl -s "https://api.github.com/repos/${BRAT_REPO}/releases/latest")
TAG_NAME=$(echo "$RELEASE_INFO" | jq -r .tag_name)
echo "Latest BRAT version: $TAG_NAME"

# Download release assets
BRAT_DIR="/workspace/vault/.obsidian/plugins/obsidian42-brat"
mkdir -p "$BRAT_DIR"

# Download main.js, manifest.json, and styles.css
echo "Downloading BRAT assets..."
cd "$BRAT_DIR"

for asset in main.js manifest.json styles.css; do
    DOWNLOAD_URL=$(echo "$RELEASE_INFO" | jq -r ".assets[] | select(.name==\"$asset\") | .browser_download_url")
    if [ -n "$DOWNLOAD_URL" ] && [ "$DOWNLOAD_URL" != "null" ]; then
        echo "  Downloading $asset..."
        curl -sL "$DOWNLOAD_URL" -o "$asset"
    else
        echo "  Warning: $asset not found in release"
    fi
done

# Enable BRAT plugin
echo "Enabling BRAT plugin..."
COMMUNITY_PLUGINS_FILE="/workspace/vault/.obsidian/community-plugins.json"
if [ -f "$COMMUNITY_PLUGINS_FILE" ]; then
    # Add BRAT to the list if not already present
    if ! grep -q "obsidian42-brat" "$COMMUNITY_PLUGINS_FILE"; then
        jq '. + ["obsidian42-brat"]' "$COMMUNITY_PLUGINS_FILE" > temp.json && mv temp.json "$COMMUNITY_PLUGINS_FILE"
    fi
else
    echo '["obsidian42-brat"]' > "$COMMUNITY_PLUGINS_FILE"
fi

echo "BRAT plugin installed successfully"
