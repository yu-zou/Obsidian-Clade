#!/bin/bash
set -e

echo "=== Running Clade Plugin E2E Tests ==="
echo ""

# Check if container is running
if ! docker-compose ps obsidian | grep -q "Up"; then
    echo "ERROR: Obsidian container is not running"
    echo "Please run ./setup.sh first"
    exit 1
fi

echo "Running tests inside container..."
docker-compose exec -T obsidian /workspace/scripts/test.sh

echo ""
echo "=== Tests Complete ==="
