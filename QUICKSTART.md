# Clade Plugin - Quick Start Guide

## Installation

### Via BRAT (Recommended)

1. Install BRAT plugin from Obsidian community plugins
2. Add this repository: `yu-zou/clade`
3. Enable the plugin in Settings → Community Plugins

### Manual Installation

```bash
# Clone and build
git clone https://github.com/yu-zou/clade.git
cd clade
npm install
npm run build

# Copy to your vault
mkdir -p /path/to/vault/.obsidian/plugins/clade
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/clade/
```

## Configuration

1. Install OpenCode: `npm install -g @opencode/cli`
2. Enable Clade plugin in Obsidian
3. Configure settings:
   - OpenCode binary path: `opencode` (or full path)
   - API keys (if required by your OpenCode setup)

## Usage

### Basic Chat

1. Open the Clade panel from the right sidebar
2. Type your question or request
3. Wait for the AI response

### Attach Context

**Method 1: @ mentions**
```
@filename.md Please summarize this file
```

**Method 2: Selection**
1. Select text in the editor
2. Right-click → "Add to Clade Context"
3. Send your request

### Review Changes

When the AI suggests code changes:
1. Review the diff in the editor
2. Click **Accept** to apply
3. Click **Reject** to discard
4. Click **Revise** to request modifications

## Troubleshooting

### "Cannot connect to OpenCode"

```bash
# Verify OpenCode is installed
which opencode
opencode --version

# Test ACP manually
opencode acp
```

### "Plugin not loading"

1. Check Settings → Community Plugins → Clade is enabled
2. Check console (Ctrl+Shift+I) for errors
3. Verify `main.js` exists in plugin folder

### "No response from AI"

1. Check OpenCode is running: `ps aux | grep opencode`
2. Check plugin settings → correct binary path
3. Check console for connection errors
4. Try restarting Obsidian

## Testing

### Run All Tests

```bash
./verify.sh
```

### Run Specific Tests

```bash
# Unit tests only
npm test

# E2E integration tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Manual Testing

1. Build: `npm run build`
2. Copy files to vault
3. Restart Obsidian
4. Test features manually

## Development

### Project Structure

```
clade/
├── src/
│   ├── main.ts           # Plugin entry
│   ├── lifecycle.ts      # Process management
│   ├── acp-client.ts     # ACP protocol
│   ├── session-store.ts  # Conversation history
│   ├── diff-engine.ts    # Diff logic
│   ├── diff-view.ts      # UI rendering
│   ├── chat-view.ts      # Chat interface
│   └── settings.ts       # Settings UI
├── tests/
│   ├── mock-opencode.js  # Mock server
│   ├── *.test.ts         # Unit tests
│   └── e2e-*.test.ts     # Integration tests
└── docs/
    ├── TESTING.md        # Testing strategy
    └── DEBUGGING.md      # Debugging guide
```

### Build

```bash
npm run build      # Production build
npm run dev        # Watch mode
```

### Code Style

- TypeScript with strict mode
- Prettier for formatting
- ESLint for linting

## Resources

- [Testing Guide](docs/TESTING.md)
- [Debugging Guide](docs/DEBUGGING.md)
- [ACP Protocol Spec](docs/ACP.md) - Coming soon
- [Contributing](CONTRIBUTING.md) - Coming soon

## Support

- GitHub Issues: Report bugs and feature requests
- GitHub Discussions: Ask questions and share ideas

## License

MIT
