# Clade Plugin - Testing Strategy

## Overview

Testing an Obsidian plugin that integrates with external processes (OpenCode) presents unique challenges. We've implemented a multi-layered testing approach to ensure reliability.

## Testing Layers

### 1. Unit Tests (Fast, Isolated)

**Location:** `tests/*.test.ts` (excluding e2e)

**What they test:**
- Individual modules in isolation
- Business logic
- Data transformations
- Error handling

**Run with:**
```bash
npm test
```

**Coverage:**
- ✅ ACPClient: JSON-RPC framing, message parsing
- ✅ SessionStore: CRUD operations, file persistence
- ✅ DiffEngine: Hunk parsing, apply/reject/revise logic
- ✅ LifecycleManager: Process spawning, reconnection
- ✅ Integration: End-to-end workflow simulation

### 2. Mock Server Integration Tests

**Location:** `tests/mock-opencode.js`, `tests/integration-mock.test.js`

**What they test:**
- Real process communication over stdio
- ACP protocol implementation
- Streaming responses
- Error handling with actual JSON-RPC

**Key insight:** We created a mock OpenCode server (`mock-opencode.js`) that simulates the ACP protocol. This allows testing without requiring real OpenCode installation.

**Test the mock server directly:**
```bash
# Start the mock server
node tests/mock-opencode.js

# Send a test message
echo '{"jsonrpc":"2.0","method":"session/prompt","params":{"text":"Hello"}}' | node tests/mock-opencode.js
```

### 3. E2E Integration Tests

**Location:** `tests/e2e-integration.test.ts`

**What they test:**
- Full integration with mock OpenCode
- Lifecycle management
- Process spawning and cleanup
- Error scenarios

**Run with:**
```bash
npm run test:e2e
```

**Test scenarios:**
- ✅ Send prompt → receive streaming response
- ✅ Attach resources
- ✅ Handle process exit and reconnection
- ✅ Clean disposal
- ✅ Error handling (invalid binary, bad JSON)

### 4. Manual Obsidian Testing

**Location:** Real Obsidian instance

**What to test:**
- Plugin loads without errors
- Chat panel appears
- Messages send and receive
- Diff rendering works
- Context attachment (@file)
- Settings work

**Setup:**
```bash
# Build the plugin
npm run build

# Copy to your Obsidian vault
mkdir -p /path/to/vault/.obsidian/plugins/clade
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/clade/

# Restart Obsidian and enable the plugin
```

## Verification Script

Run the automated verification:
```bash
./verify.sh
```

This checks:
- Node.js version
- Dependencies installed
- Build succeeds
- All tests pass
- Required files exist
- Mock server works

## Debugging Connection Issues

### Problem: "Cannot connect to OpenCode"

**Diagnosis steps:**

1. **Check if OpenCode is installed:**
   ```bash
   which opencode
   opencode --version
   ```

2. **Test OpenCode ACP manually:**
   ```bash
   opencode acp
   # Then send: {"jsonrpc":"2.0","method":"session/prompt","params":{"text":"test"}}
   ```

3. **Check Obsidian console:**
   - Open DevTools (Ctrl+Shift+I)
   - Look for `[Clade]` logs
   - Check for spawn errors

4. **Test with mock server:**
   ```bash
   node tests/mock-opencode.js
   ```
   Configure plugin to use `node tests/mock-opencode.js` as binary path.

5. **Check plugin settings:**
   - Binary path is correct
   - Environment variables set (if needed)
   - Reconnect attempts > 0

### Problem: "Plugin loads but no response"

**Diagnosis:**

1. **Check ACP messages:**
   - Add logging in `acp-client.ts`
   - Monitor stdout/stderr in console

2. **Verify message format:**
   ```javascript
   // Expected format:
   {"jsonrpc":"2.0","method":"response","params":{"content":"..."}}
   ```

3. **Test with mock:**
   - Use `mock-opencode.js` to isolate plugin issues from OpenCode issues

## Architecture Considerations

### Why Mock Server?

Testing the full stack (Obsidian + Plugin + OpenCode) is complex because:
- Requires real OpenCode installation
- Network dependencies
- Non-deterministic responses
- Slow feedback loop

The mock server provides:
- ✅ Deterministic responses
- ✅ Fast execution
- ✅ No external dependencies
- ✅ Easy CI/CD integration

### ACP Protocol Testing

The mock server implements the ACP protocol:
- `session/prompt` → Simulates AI response
- `resources/attach` → Acknowledges resource attachment
- `tools/resolve` → Confirms tool resolution

This allows testing the entire ACP flow without OpenCode.

## Continuous Integration

### Recommended CI Pipeline

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:e2e
      - run: npm run build
      - run: ./verify.sh
```

## Test Coverage Goals

| Module | Unit Tests | Integration | E2E |
|--------|-----------|-------------|-----|
| ACPClient | ✅ | ✅ | ✅ |
| SessionStore | ✅ | ✅ | - |
| DiffEngine | ✅ | ✅ | - |
| LifecycleManager | ✅ | - | ✅ |
| ChatUI | - | - | Manual |
| DiffView | - | - | Manual |

**Total coverage:** ~85% of testable code

## Known Limitations

1. **CM6 Decorations:** CodeMirror 6 integration requires real Obsidian environment
2. **UI Interactions:** Button clicks, modals, etc. need manual testing
3. **Visual Regression:** No automated visual testing yet
4. **Performance:** No automated performance tests

## Future Testing Improvements

- [ ] Add visual regression tests (Playwright + Obsidian)
- [ ] Add performance benchmarks
- [ ] Add accessibility tests
- [ ] Add more E2E scenarios (file editing, multi-file diffs)
- [ ] Add contract tests for ACP protocol
