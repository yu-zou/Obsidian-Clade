# E2E Test Environment for Clade Plugin

This directory contains Docker-based end-to-end testing infrastructure for the Clade Obsidian plugin.

## Overview

The E2E test environment:
1. Runs Obsidian desktop in a Docker container with virtual display (Xvfb)
2. Enables Obsidian CLI for programmatic control
3. Automatically installs BRAT plugin
4. Installs the Clade plugin from the latest build
5. Runs integration tests to verify the plugin works correctly

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for building the plugin)
- Clade plugin built (`npm run build` in the parent directory)

## Quick Start

```bash
# 1. Build the plugin (if not already built)
cd ..
npm run build
cd e2e

# 2. Prepare plugin assets
./prepare-assets.sh

# 3. Setup and start the test environment
./setup.sh

# 4. Wait 30 seconds for Obsidian to initialize, then run tests
./test.sh

# 5. Clean up when done
./teardown.sh
```

## Architecture

```
┌─────────────────────────────────────────┐
│   Docker Container                      │
│   ┌───────────────────────────────────┐ │
│   │ Xvfb (Virtual Display)            │ │
│   │  ┌─────────────────────────────┐  │ │
│   │  │ Obsidian Desktop App        │  │ │
│   │  │  - CLI enabled              │  │ │
│   │  │  - BRAT installed           │  │ │
│   │  │  - Clade installed          │  │ │
│   │  └─────────────────────────────┘  │ │
│   └───────────────────────────────────┘ │
│                  ↕ IPC                  │
│   ┌───────────────────────────────────┐ │
│   │ Test Runner (via Obsidian CLI)    │ │
│   │  - Validates plugin loading       │ │
│   │  - Checks plugin status           │ │
│   │  - Verifies vault access          │ │
│   └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Directory Structure

```
e2e/
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Service orchestration
├── setup.sh               # Initialize and start environment
├── test.sh                # Run E2E tests
├── teardown.sh            # Clean up environment
├── prepare-assets.sh      # Copy plugin build to assets
├── README.md              # This file
├── scripts/
│   ├── start.sh           # Container startup script
│   ├── test.sh            # Test execution script
│   ├── install-brat.sh    # BRAT installation
│   ├── install-clade.sh   # Clade installation
│   └── preconfigure-vault.sh  # Vault configuration
├── assets/                # Plugin files (created by prepare-assets.sh)
│   ├── main.js
│   ├── manifest.json
│   └── styles.css
└── vault/                 # Test vault (created by setup.sh)
```

## Test Coverage

The E2E tests verify:
- [x] Obsidian starts successfully
- [x] Obsidian CLI is enabled and responding
- [x] BRAT plugin is installed and enabled
- [x] Clade plugin is installed and enabled
- [x] Plugin can access vault files
- [x] Clade session directory is created
- [x] Clade logs are being written

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs obsidian

# Restart container
docker-compose restart obsidian
```

### Obsidian CLI not responding
```bash
# Wait longer for Obsidian to initialize
sleep 30

# Check if Obsidian process is running
docker-compose exec obsidian ps aux | grep obsidian
```

### Tests fail
```bash
# Run tests with verbose output
docker-compose exec obsidian /workspace/scripts/test.sh

# Check Clade logs
docker-compose exec obsidian cat /workspace/vault/.clade/logs/clade.log
```

### Clean slate
```bash
# Remove everything and start fresh
./teardown.sh
rm -rf vault assets
./prepare-assets.sh
./setup.sh
```

## Advanced Usage

### Access the vault from host
The vault is mounted at `./vault` and persists between runs.

### Debug with VNC (optional)
The container exposes port 5900 for VNC access. To use:
1. Install a VNC server in the container (add to Dockerfile)
2. Connect to localhost:5900 with a VNC client

### Run custom tests
```bash
# Execute commands in the container
docker-compose exec obsidian obsidian-cli <command>

# Examples
docker-compose exec obsidian obsidian-cli vault
docker-compose exec obsidian obsidian-cli plugins
docker-compose exec obsidian obsidian-cli files total
```

## CI/CD Integration

This E2E setup can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Setup E2E Environment
  run: |
    cd e2e
    ./prepare-assets.sh
    ./setup.sh
    sleep 30
    ./test.sh
    ./teardown.sh
```

## Limitations

1. **No OpenCode Integration**: The current setup tests plugin loading and basic functionality, but doesn't test actual AI interactions (requires OpenCode installation)
2. **Virtual Display**: Uses Xvfb which may not perfectly replicate real display behavior
3. **Performance**: Docker adds overhead; tests may be slower than native execution

## Future Enhancements

- [ ] Add OpenCode mock server for testing AI interactions
- [ ] Add screenshot comparison tests
- [ ] Add performance benchmarks
- [ ] Add visual regression tests
- [ ] Support for testing on multiple Obsidian versions
