#!/bin/bash

echo "=== Tearing Down E2E Test Environment ==="
echo ""

# Stop and remove containers
echo "Stopping containers..."
docker-compose down

# Clean up vault (optional)
read -p "Remove vault data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing vault data..."
    rm -rf ./vault
    echo "✓ Vault data removed"
else
    echo "Vault data preserved"
fi

echo ""
echo "=== Teardown Complete ==="
