#!/bin/bash
set -e

echo "=== Starting E2E Test Environment ==="

# Start Xvfb (virtual display)
echo "Starting Xvfb on display $DISPLAY..."
Xvfb $DISPLAY -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} &
XVFB_PID=$!
sleep 2

# Verify Xvfb is running
if ! ps -p $XVFB_PID > /dev/null; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi
echo "Xvfb started successfully (PID: $XVFB_PID)"

# Install Obsidian (if not already installed)
if [ ! -f /opt/Obsidian/Obsidian ]; then
    echo "Installing Obsidian..."
    cd /tmp
    # Download latest Obsidian AppImage
    OBSIDIAN_VERSION=$(curl -s https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest | jq -r .tag_name)
    echo "Latest Obsidian version: $OBSIDIAN_VERSION"
    
    wget -q "https://github.com/obsidianmd/obsidian-releases/releases/download/${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage" -O Obsidian.AppImage
    chmod +x Obsidian.AppImage
    
    # Extract AppImage
    ./Obsidian.AppImage --appimage-extract
    mkdir -p /opt/Obsidian
    mv squashfs-root/* /opt/Obsidian/
    cd /workspace
fi

# Create test vault if it doesn't exist
if [ ! -d /workspace/vault/.obsidian ]; then
    echo "Creating test vault..."
    mkdir -p /workspace/vault/.obsidian
    echo '{}' > /workspace/vault/.obsidian/app.json
    echo '{}' > /workspace/vault/.obsidian/appearance.json
    echo '{}' > /workspace/vault/.obsidian/core-plugins-migration.json
fi

# Install BRAT plugin
echo "Installing BRAT plugin..."
/workspace/scripts/install-brat.sh

# Install Clade plugin
echo "Installing Clade plugin..."
/workspace/scripts/install-clade.sh

# Start Obsidian
echo "Starting Obsidian..."
cd /opt/Obsidian
./obsidian --no-sandbox --disable-gpu /workspace/vault &
OBSIDIAN_PID=$!
sleep 5

# Wait for Obsidian to be ready
echo "Waiting for Obsidian to initialize..."
for i in {1..30}; do
    if obsidian-cli help > /dev/null 2>&1; then
        echo "Obsidian is ready!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Verify Obsidian CLI is working
if ! obsidian-cli help > /dev/null 2>&1; then
    echo "ERROR: Obsidian CLI is not responding"
    exit 1
fi

echo "=== E2E Environment Ready ==="
echo "Obsidian PID: $OBSIDIAN_PID"
echo "Xvfb PID: $XVFB_PID"

# Keep container running
wait $OBSIDIAN_PID
