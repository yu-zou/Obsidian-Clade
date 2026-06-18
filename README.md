# Clade

An AI-native research notetaking plugin for Obsidian, powered by OpenCode.

## Overview

Clade brings AI-assisted writing and editing directly into Obsidian using a **thin client / fat agent** architecture. The plugin handles context management and UI, while delegating all LLM orchestration to OpenCode via the Agent Client Protocol (ACP).

**Key features:**
- Persistent side panel chat with streaming responses
- Context attachment via `@file` mentions and text selection
- Inline diff rendering with per-hunk Accept/Reject/Revise actions
- Conversation history persisted across Obsidian restarts
- Automatic reconnection with exponential backoff

## Architecture

```
┌─────────────────────────────────────┐
│          Obsidian Plugin            │
│  ┌──────────┐     ┌─────────────┐  │
│  │ Chat UI  │────▶│ Diff Engine │  │
│  └────┬─────┘     └─────────────┘  │
│       │                             │
│  ┌────▼──────────────────────────┐  │
│  │       Session Store           │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ JSON-RPC (stdio)
        ┌──────▼──────┐
        │  OpenCode   │
        │  (ACP)      │
        └─────────────┘
```

- **LifecycleManager**: Spawns and monitors the OpenCode process
- **ACPClient**: Handles JSON-RPC communication over stdio
- **SessionStore**: Persists conversations to disk (JSON)
- **DiffEngine**: Parses and applies code diffs
- **DiffView**: Renders diffs in the editor using CodeMirror 6
- **ChatView**: Sidebar UI with streaming messages and tool call display

## Installation

### From Source

```bash
git clone https://github.com/yourusername/clade.git
cd clade
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/clade/` directory.

### Requirements

- Obsidian 1.7.0+
- Node.js 18+ (for development)
- OpenCode installed and accessible in PATH

## Configuration

After installing, configure Clade in Obsidian Settings → Clade:

| Setting | Description | Default |
|---------|-------------|---------|
| Binary Path | Path to OpenCode executable | `opencode` |
| API Key | API key passed to OpenCode | — |
| Max Reconnect Attempts | Reconnection retry limit | 5 |
| Reconnect Base Delay | Initial delay between retries (ms) | 1000 |
| Sessions Directory | Where to store conversation history | `.clade/sessions` |

## Usage

### Opening the Chat

Use the command palette (Ctrl/Cmd+P) and search for "Open Clade" or click the Clade icon in the sidebar.

### Attaching Context

**Via `@` mentions:**
Type `@` in the chat input to open a file picker. The currently active file appears at the top for quick access.

**Via text selection:**
Select text in the editor, then use the command palette: "Clade: Add Selection to Context".

### Reviewing Changes

When OpenCode proposes edits, Clade renders them as inline diffs in the editor:

- **✓ Accept**: Apply the change and write to disk
- **✗ Reject**: Discard the change
- **✎ Revise**: Open a popover to provide feedback (e.g., "make it more concise")

Changes are written directly to disk, bypassing Obsidian's virtual file system to ensure consistency between the editor, plugin, and agent.

### Managing Sessions

Click the session title in the chat header to open the session switcher. From there you can:
- Switch between conversations
- Create a new session
- Right-click to rename a session

## Development

### Setup

```bash
npm install
```

### Build

```bash
# Development build (watches for changes)
npm run dev

# Production build
npm run build
```

### Test

```bash
npm test
```

### Project Structure

```
src/
  main.ts           # Plugin entry point
  types.ts          # Shared type definitions
  lifecycle.ts      # Process management
  acp-client.ts     # ACP protocol client
  session-store.ts  # Conversation persistence
  diff-engine.ts    # Diff parsing and application
  diff-view.ts      # CM6 integration
  chat-view.ts      # Chat UI
  settings.ts       # Settings tab
tests/
  *.test.ts         # Unit tests
```

## Backlog

- Multi-session support (concurrent chat threads)
- Progress reporting for long-running tool calls
- Cancellation tokens (user aborts generation mid-stream)
- Settings changes mid-session handling

## License

MIT
