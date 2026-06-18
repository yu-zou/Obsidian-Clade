# Clade

An AI-native research notetaking plugin for Obsidian, powered by OpenCode.

## Overview

Clade brings AI-assisted writing and editing directly into Obsidian. It uses a side panel chat interface where you can interact with OpenCode to help with research, writing, and note-taking tasks.

**Key features:**
- Persistent side panel chat with streaming responses
- Context attachment via `@file` mentions and text selection
- Inline diff rendering with per-hunk Accept/Reject/Revise actions
- Conversation history persisted across Obsidian restarts

## Installation

### Using BRAT (Recommended)

1. Install the [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) plugin from Obsidian's community plugins
2. Open BRAT settings → Beta Plugins → Add Beta Plugin
3. Enter the GitHub repository URL: `https://github.com/yu-zou/Obsidian-Clade`
4. Click "Add Plugin"
5. Enable Clade in Obsidian's settings → Community plugins

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the repository
2. Create a `clade` folder in your vault's `.obsidian/plugins/` directory
3. Copy the three files into the `clade` folder
4. Enable Clade in Obsidian's settings → Community plugins

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

Changes are written directly to disk, ensuring consistency between the editor, plugin, and agent.

### Managing Sessions

Click the session title in the chat header to open the session switcher. From there you can:
- Switch between conversations
- Create a new session
- Right-click to rename a session

## Requirements

- Obsidian 1.7.0+
- [OpenCode](https://github.com/opencode-ai/opencode) installed and accessible in PATH
