import { describe, it, expect } from 'vitest';
import { parseHunks, applyAcceptedHunks } from '../src/diff-engine';
import { SessionStore } from '../src/session-store';
import type { AcpHunk } from '../src/types';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const h = (os: number, ol: number, ns: number, nl: number, lines: string[]): AcpHunk =>
  ({ oldStart: os, oldLines: ol, newStart: ns, newLines: nl, lines });

describe('Integration: Full Diff Workflow', () => {
  it('handles partial accept/reject/revise on multi-hunk edit', () => {
    const original = '# Title\n\nParagraph one.\n\nParagraph two.\n\nParagraph three.\n';
    const hunks = [
      h(1, 1, 1, 1, ['-# Title', '+# Introduction']),
      h(3, 1, 3, 1, ['-Paragraph one.', '+First paragraph revised.']),
      h(5, 1, 5, 1, ['-Paragraph two.', '+Second paragraph revised.']),
    ];

    const tracked = parseHunks(hunks);
    tracked[0].state = 'accepted';   // apply
    tracked[1].state = 'rejected';   // keep original
    tracked[2].state = 'revised';    // skip (wait for new hunk)

    const merged = applyAcceptedHunks(original, tracked);
    expect(merged).toContain('# Introduction');       // accepted hunk applied
    expect(merged).toContain('Paragraph one.');        // rejected hunk unchanged
    expect(merged).toContain('Paragraph two.');        // revised hunk unchanged (pending)
  });
});

describe('Integration: Session Persistence Cycle', () => {
  it('creates, persists, loads, and deletes sessions', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clade-integration-'));
    const store = new SessionStore(tempDir);
    await store.init();

    // Create session with messages
    const session = await store.create();
    store.append({ role: 'user', content: 'Summarize my notes', timestamp: Date.now() });
    store.append({ role: 'assistant', content: 'Here is a summary...', timestamp: Date.now(), toolCalls: [] });
    await store.flush();

    // List should include it
    expect(await store.list()).toHaveLength(1);

    // Load it back
    const loaded = await store.load(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0].content).toBe('Summarize my notes');

    // Delete it
    await store.delete(session.id);
    expect(await store.list()).toHaveLength(0);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
