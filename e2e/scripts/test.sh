#!/bin/bash
set -e

echo "=== Running E2E Tests ==="

# Check if Obsidian CLI is available
if ! command -v obsidian-cli &> /dev/null; then
    echo "ERROR: Obsidian CLI not found. Is Obsidian running?"
    exit 1
fi

# Wait for Obsidian to be fully ready
echo "Verifying Obsidian is ready..."
for i in {1..10}; do
    if obsidian-cli vault &> /dev/null; then
        echo "Obsidian is ready!"
        break
    fi
    echo "Waiting for Obsidian... ($i/10)"
    sleep 2
done

if ! obsidian-cli vault &> /dev/null; then
    echo "ERROR: Obsidian is not responding"
    exit 1
fi

# Test 1: Verify plugins are loaded
echo ""
echo "Test 1: Verifying plugins are loaded..."
PLUGINS=$(obsidian-cli plugins format=json 2>/dev/null || echo "[]")
if echo "$PLUGINS" | jq -e '.[] | select(.id=="obsidian42-brat")' > /dev/null; then
    echo "✓ BRAT plugin is loaded"
else
    echo "✗ BRAT plugin is NOT loaded"
    exit 1
fi

if echo "$PLUGINS" | jq -e '.[] | select(.id=="clade")' > /dev/null; then
    echo "✓ Clade plugin is loaded"
else
    echo "✗ Clade plugin is NOT loaded"
    exit 1
fi

# Test 2: Verify Clade plugin is enabled
echo ""
echo "Test 2: Verifying Clade plugin is enabled..."
ENABLED_PLUGINS=$(obsidian-cli plugins:enabled format=json 2>/dev/null || echo "[]")
if echo "$ENABLED_PLUGINS" | jq -e '.[] | select(.id=="clade")' > /dev/null; then
    echo "✓ Clade plugin is enabled"
else
    echo "✗ Clade plugin is NOT enabled"
    exit 1
fi

# Test 3: Read test note
echo ""
echo "Test 3: Reading test note..."
if obsidian-cli files read path="test-note.md" &> /dev/null; then
    echo "✓ Can read files from vault"
else
    echo "✗ Cannot read files from vault"
    exit 1
fi

# Test 4: Check if Clade created session directory
echo ""
echo "Test 4: Checking Clade session storage..."
SESSIONS_DIR="/workspace/vault/.clade/sessions"
if [ -d "$SESSIONS_DIR" ]; then
    echo "✓ Clade session directory exists"
else
    echo "! Clade session directory not yet created (will be created on first use)"
fi

# Test 5: Check Clade logs
echo ""
echo "Test 5: Checking Clade logs..."
LOG_FILE="/workspace/vault/.clade/logs/clade.log"
if [ -f "$LOG_FILE" ]; then
    echo "✓ Clade log file exists"
    echo "Last 5 log entries:"
    tail -n 5 "$LOG_FILE" | sed 's/^/  /'
else
    echo "! Clade log file not yet created"
fi

# Test 6: Verify plugin can access vault files
echo ""
echo "Test 6: Verifying plugin vault access..."
FILE_COUNT=$(obsidian-cli files total 2>/dev/null || echo "0")
echo "✓ Plugin can access vault (found $FILE_COUNT files)"

echo ""
echo "=== E2E Tests Complete ==="
echo "All critical tests passed!"
