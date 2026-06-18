# Clade Plugin - Debugging Guide

## Testing the OpenCode Connection

### 1. Verify OpenCode Installation

First, ensure OpenCode is installed and accessible:

```bash
# Check if opencode is in PATH
which opencode

# Test running it manually
opencode --version

# Test the ACP mode directly
opencode acp
```

If `opencode` is not found, you need to:
- Install OpenCode: `npm install -g @opencode/cli`
- Or set the full path in Clade settings

### 2. Check Clade Plugin Logs

Open Obsidian's Developer Console (Ctrl/Cmd + Shift + I) and look for:

```
[Clade] Spawning process: opencode acp
[Clade] Process spawned with PID: XXXX
[Clade] Process exited with code: X
[Clade] Reconnect attempt X
```

Common error messages:
- `ENOENT` - OpenCode binary not found
- `EACCES` - Permission denied
- `Process exited with code 127` - Command not found

### 3. Manual ACP Test

Test the ACP protocol manually without Obsidian:

```bash
# Start OpenCode in ACP mode
opencode acp

# In another terminal, send a test message
echo '{"jsonrpc":"2.0","method":"session/prompt","params":{"text":"Hello"},"id":1}' | opencode acp
```

### 4. Use Mock OpenCode for Testing

We provide a mock OpenCode server for testing the plugin without real OpenCode:

```bash
# Start the mock server
node tests/mock-opencode.js

# In another terminal, test communication
echo '{"jsonrpc":"2.0","method":"session/prompt","params":{"text":"test"}}' | node tests/mock-opencode.js
```

### 5. Check Plugin Settings

In Obsidian Settings → Clade:

- **OpenCode Binary Path**: Should be `opencode` or full path like `/usr/local/bin/opencode`
- **Environment Variables**: May need `PATH` or other vars
- **Max Reconnect Attempts**: Default 5
- **Reconnect Base Delay**: Default 1000ms

### 6. Verify Plugin Loading

Check if the plugin is actually loaded:

1. Open Developer Console (Ctrl/Cmd + Shift + I)
2. Run: `app.plugins.manifests['clade']`
3. Should show plugin manifest

### 7. Test the View

The chat view should appear in the right sidebar:

1. Check View → Right Sidebar → Clade
2. Or use command palette: "Clade: Open Chat"

### 8. Common Issues

**"Cannot find module 'opencode'"**
- Install: `npm install -g @opencode/cli`
- Or use full path in settings

**"Connection refused" or "Process exited immediately"**
- Check OpenCode version: `opencode --version`
- Try running `opencode acp` manually
- Check firewall/antivirus

**"No response from agent"**
- Check Developer Console for errors
- Verify OpenCode supports ACP protocol
- Try with mock server first

**"UI not appearing"**
- Enable plugin in Settings → Community Plugins
- Check console for JavaScript errors
- Try disabling other plugins

### 9. Debug Mode

Enable verbose logging by adding to Clade settings:

```json
{
  "debug": true
}
```

This will show:
- All ACP messages sent/received
- Process spawn/exit events
- Error details

### 10. File a Bug Report

If you find a bug, please include:

1. Obsidian version
2. Clade plugin version
3. OpenCode version (`opencode --version`)
4. Operating system
5. Developer Console logs
6. Plugin settings (redact API keys!)

## Testing Checklist

- [ ] OpenCode installed and in PATH
- [ ] `opencode acp` runs without errors
- [ ] Clade plugin enabled in Obsidian
- [ ] Chat view appears in sidebar
- [ ] Can send a message
- [ ] Receive response from OpenCode
- [ ] Context attachment works (@file)
- [ ] Diff view appears for file edits
- [ ] Accept/Reject/Revise buttons work
