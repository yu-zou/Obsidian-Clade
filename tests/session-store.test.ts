import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionStore } from '../src/session-store';

describe('SessionStore', () => {
  let store: SessionStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clade-test-'));
    store = new SessionStore(tempDir);
    await store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('creates directory if it does not exist', async () => {
      const subDir = path.join(tempDir, 'sub', 'nested');
      const s = new SessionStore(subDir);
      await s.init();
      const stat = await fs.stat(subDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a new session and sets it as current', async () => {
      const session = await store.create();
      expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(session.title).toBe('New Session');
      expect(session.messages).toEqual([]);
      expect(session.context).toEqual([]);
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.lastActiveAt).toBeGreaterThanOrEqual(session.createdAt);
      expect(store.getCurrent()!.id).toBe(session.id);
    });

    it('persists the session to disk immediately', async () => {
      const session = await store.create();
      const filePath = path.join(tempDir, `${session.id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const loaded = JSON.parse(data);
      expect(loaded.id).toBe(session.id);
      expect(loaded.title).toBe('New Session');
    });
  });

  describe('list', () => {
    it('returns empty array when no sessions exist', async () => {
      const list = await store.list();
      expect(list).toEqual([]);
    });

    it('lists sessions sorted by lastActiveAt descending', async () => {
      const s1 = await store.create();
      await new Promise(r => setTimeout(r, 10));
      const s2 = await store.create();
      await new Promise(r => setTimeout(r, 10));
      const s3 = await store.create();

      const list = await store.list();
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe(s3.id);
      expect(list[1].id).toBe(s2.id);
      expect(list[2].id).toBe(s1.id);
    });

    it('returns SessionSummary objects with id, title, lastActiveAt', async () => {
      const session = await store.create();
      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: session.id,
        title: session.title,
        lastActiveAt: session.lastActiveAt,
      });
    });

    it('skips corrupted session files', async () => {
      await fs.writeFile(path.join(tempDir, 'bad.json'), 'not valid json');
      const s1 = await store.create();
      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(s1.id);
    });
  });

  describe('load', () => {
    it('loads an existing session and sets it as current', async () => {
      const s1 = await store.create();
      await store.create(); // s2 becomes current

      const loaded = await store.load(s1.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(s1.id);
      expect(store.getCurrent()!.id).toBe(s1.id);
    });

    it('returns null for non-existent session', async () => {
      const loaded = await store.load('nonexistent-id');
      expect(loaded).toBeNull();
    });

    it('returns null if session file is corrupted', async () => {
      await fs.writeFile(path.join(tempDir, 'bad.json'), 'invalid json');
      const loaded = await store.load('bad');
      expect(loaded).toBeNull();
    });
  });

  describe('rename', () => {
    it('renames an existing session', async () => {
      const session = await store.create();
      await store.rename(session.id, 'New Title');

      const loaded = await store.load(session.id);
      expect(loaded!.title).toBe('New Title');
    });

    it('does nothing if session does not exist', async () => {
      await expect(store.rename('nonexistent', 'Title')).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes an existing session file', async () => {
      const s1 = await store.create();
      const s2 = await store.create();

      await store.delete(s1.id);

      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(s2.id);

      const filePath = path.join(tempDir, `${s1.id}.json`);
      await expect(fs.stat(filePath)).rejects.toThrow();
    });

    it('clears current session if deleting the current one', async () => {
      const session = await store.create();
      expect(store.getCurrent()!.id).toBe(session.id);
      await store.delete(session.id);
      expect(store.getCurrent()).toBeNull();
    });

    it('does not throw for non-existent session', async () => {
      await expect(store.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('append', () => {
    it('appends a message to the current session', async () => {
      const session = await store.create();
      const message = { role: 'user' as const, content: 'Hello', timestamp: Date.now() };

      store.append(message);

      const current = store.getCurrent()!;
      expect(current.messages).toHaveLength(1);
      expect(current.messages[0].content).toBe('Hello');
      expect(current.lastActiveAt).toBeGreaterThanOrEqual(session.lastActiveAt);
    });

    it('does nothing if no current session', () => {
      expect(() => {
        store.append({ role: 'user', content: 'test', timestamp: Date.now() });
      }).not.toThrow();
    });

    it('debounces writes and flushes after delay', async () => {
      const session = await store.create();
      store.append({ role: 'user', content: 'Hello', timestamp: Date.now() });

      // Not flushed immediately (debounced)
      const filePath = path.join(tempDir, `${session.id}.json`);
      let data = await fs.readFile(filePath, 'utf-8');
      let loaded = JSON.parse(data);
      expect(loaded.messages).toHaveLength(0);

      // Wait for debounce (500ms) + buffer
      await new Promise(r => setTimeout(r, 600));
      data = await fs.readFile(filePath, 'utf-8');
      loaded = JSON.parse(data);
      expect(loaded.messages).toHaveLength(1);
      expect(loaded.messages[0].content).toBe('Hello');
    });

    it('can be flushed explicitly', async () => {
      const session = await store.create();
      store.append({ role: 'user', content: 'Hello', timestamp: Date.now() });

      await store.flush();

      const filePath = path.join(tempDir, `${session.id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const loaded = JSON.parse(data);
      expect(loaded.messages).toHaveLength(1);
    });
  });

  describe('appendContext', () => {
    it('appends a file context entry', async () => {
      const session = await store.create();
      const context = { type: 'file' as const, path: 'note.md', text: 'content' };

      store.appendContext(context);

      const current = store.getCurrent()!;
      expect(current.context).toHaveLength(1);
      expect(current.context[0]).toEqual(context);
    });

    it('appends a selection context entry', async () => {
      const session = await store.create();
      const context = {
        type: 'selection' as const,
        path: 'note.md',
        range: { from: 10, to: 20 },
        text: 'selected text',
      };

      store.appendContext(context);

      const current = store.getCurrent()!;
      expect(current.context).toHaveLength(1);
      expect(current.context[0]).toEqual(context);
    });

    it('does nothing if no current session', () => {
      expect(() => {
        store.appendContext({ type: 'file', path: 'test.md', text: 'content' });
      }).not.toThrow();
    });
  });

  describe('setTitle', () => {
    it('sets the title of the current session', async () => {
      const session = await store.create();
      store.setTitle('Custom Title');
      expect(store.getCurrent()!.title).toBe('Custom Title');
    });

    it('does nothing if no current session', () => {
      expect(() => store.setTitle('Title')).not.toThrow();
    });
  });

  describe('getCurrent', () => {
    it('returns null when no session is loaded', () => {
      expect(store.getCurrent()).toBeNull();
    });

    it('returns the most recently created session', async () => {
      const s1 = await store.create();
      const s2 = await store.create();
      expect(store.getCurrent()!.id).toBe(s2.id);
    });

    it('returns the most recently loaded session', async () => {
      const s1 = await store.create();
      await store.create(); // s2 is current
      await store.load(s1.id);
      expect(store.getCurrent()!.id).toBe(s1.id);
    });
  });
});
