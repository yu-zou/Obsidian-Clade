#!/bin/bash
set -e

echo "=== Clade Plugin E2E Test Setup ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed"
    exit 1
fi

echo "✓ Docker is installed"
echo "✓ Docker Compose is installed"

# Check if plugin assets exist
echo ""
echo "Checking plugin assets..."
ASSETS_DIR="./assets"
if [ ! -f "$ASSETS_DIR/main.js" ]; then
    echo "ERROR: main.js not found in $ASSETS_DIR"
    echo "Please build the plugin first: npm run build"
    exit 1
fi

if [ ! -f "$ASSETS_DIR/manifest.json" ]; then
    echo "ERROR: manifest.json not found in $ASSETS_DIR"
    exit 1
fi

echo "✓ Plugin assets found"

# Create vault directory
echo ""
echo "Creating vault directory..."
mkdir -p ./vault
echo "✓ Vault directory created"

# Pre-configure vault
echo ""
echo "Pre-configuring vault..."
./scripts/preconfigure-vault.sh
echo "✓ Vault pre-configured"

# Build Docker image
echo ""
echo "Building Docker image..."
docker-compose build
echo "✓ Docker image built"

# Start services
echo ""
echo "Starting Obsidian container..."
docker-compose up -d obsidian
echo "✓ Obsidian container started"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Wait 30 seconds for Obsidian to initialize"
echo "2. Run tests: ./test.sh"
echo "3. View logs: docker-compose logs -f obsidian"
echo ""
echo "To stop: ./teardown.sh"
