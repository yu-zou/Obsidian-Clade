import { describe, it, expect, beforeEach } from 'vitest';
import { Readable, Writable } from 'stream';
import { ACPClient } from '../src/acp-client';

// Helper to flush microtask queue so stream 'data' events fire
const tick = () => new Promise(r => setTimeout(r, 0));

describe('ACPClient - JSON-RPC Framing', () => {
  let stdin: Writable;
  let stdout: Readable;
  let client: ACPClient;

  beforeEach(() => {
    stdin = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    stdout = new Readable({ read() {} });
    client = new ACPClient(stdin, stdout);
  });

  it('parses a complete JSON-RPC notification', async () => {
    const events: any[] = [];
    client.on('tool_call:received', (e) => events.push(e));

    stdout.push(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool_call',
      params: { id: 'tc-1', name: 'read_file', arguments: { path: 'test.md' } },
    }) + '\n');

    await tick();
    expect(events).toHaveLength(1);
    expect(events[0].toolCall.name).toBe('read_file');
  });

  it('handles partial chunks and reassembles', async () => {
    const events: any[] = [];
    client.on('tool_call:received', (e) => events.push(e));

    const fullMsg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool_call',
      params: { id: 'tc-2', name: 'edit_file', arguments: {} },
    });

    stdout.push(fullMsg.slice(0, 20));
    await tick();
    expect(events).toHaveLength(0);

    stdout.push(fullMsg.slice(20) + '\n');
    await tick();
    expect(events).toHaveLength(1);
    expect(events[0].toolCall.name).toBe('edit_file');
  });

  it('handles multiple messages in one chunk', async () => {
    const events: any[] = [];
    client.on('tool_call:received', (e) => events.push(e));

    const msg1 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool_call',
      params: { id: 'tc-a', name: 'read_file', arguments: {} },
    });
    const msg2 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool_call',
      params: { id: 'tc-b', name: 'write_file', arguments: {} },
    });

    stdout.push(msg1 + '\n' + msg2 + '\n');
    await tick();
    expect(events).toHaveLength(2);
    expect(events[0].toolCall.name).toBe('read_file');
    expect(events[1].toolCall.name).toBe('write_file');
  });

  it('ignores empty lines', async () => {
    const events: any[] = [];
    client.on('tool_call:received', (e) => events.push(e));

    stdout.push('\n\n' + JSON.stringify({
      jsonrpc: '2.0',
      method: 'tool_call',
      params: { id: 'tc-3', name: 'read_file', arguments: {} },
    }) + '\n\n');

    await tick();
    expect(events).toHaveLength(1);
  });

  it('emits error for malformed JSON', async () => {
    const errors: any[] = [];
    client.on('error', (e) => errors.push(e));

    stdout.push('not-json\n');
    await tick();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('JSON parse error');
  });

  it('emits response:delta for streaming content', async () => {
    const deltas: string[] = [];
    client.on('response:delta', (e) => deltas.push(e.delta));

    stdout.push(JSON.stringify({
      jsonrpc: '2.0',
      method: 'content',
      params: { delta: 'Hello ' },
    }) + '\n');

    await tick();
    expect(deltas).toEqual(['Hello ']);
  });

  it('emits response:done when agent finishes', async () => {
    const events: any[] = [];
    client.on('response:done', (e) => events.push(e));

    stdout.push(JSON.stringify({
      jsonrpc: '2.0',
      method: 'response',
      params: {
        done: true,
        content: 'Full response text',
        toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: {} }],
      },
    }) + '\n');

    await tick();
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('Full response text');
    expect(events[0].toolCalls).toHaveLength(1);
  });
});

describe('ACPClient - Send Methods', () => {
  let stdin: Writable;
  let stdout: Readable;
  let client: ACPClient;
  let written: string[];

  beforeEach(() => {
    written = [];
    stdin = new Writable({
      write(chunk, _enc, cb) {
        written.push(chunk.toString());
        cb();
      },
    });
    stdout = new Readable({ read() {} });
    client = new ACPClient(stdin, stdout);
  });

  it('sendPrompt writes JSON-RPC notification to stdin', async () => {
    await client.sendPrompt('Summarize my notes');
    expect(written).toHaveLength(1);
    const msg = JSON.parse(written[0]);
    expect(msg.jsonrpc).toBe('2.0');
    expect(msg.method).toBe('session/prompt');
    expect(msg.params.text).toBe('Summarize my notes');
  });

  it('attachResource writes resource notification', async () => {
    await client.attachResource({
      uri: 'file://note.md',
      name: 'note.md',
      mimeType: 'text/markdown',
      content: '# Note content',
    });

    const msg = JSON.parse(written[0]);
    expect(msg.method).toBe('resources/attach');
    expect(msg.params.resource.uri).toBe('file://note.md');
    expect(msg.params.resource.content).toBe('# Note content');
  });

  it('resolveToolCall writes resolution notification', async () => {
    await client.resolveToolCall('tc-1', { content: 'applied' });

    const msg = JSON.parse(written[0]);
    expect(msg.method).toBe('tools/resolve');
    expect(msg.params.id).toBe('tc-1');
    expect(msg.params.result.content).toBe('applied');
  });

  it('sendRevise writes revision prompt', async () => {
    await client.sendRevise('hunk-1', 'Make it more concise');

    const msg = JSON.parse(written[0]);
    expect(msg.method).toBe('session/prompt');
    expect(msg.params.text).toContain('Make it more concise');
    expect(msg.params.hunkId).toBe('hunk-1');
  });

  it('replay writes session history', async () => {
    const messages = [
      { role: 'user' as const, content: 'Hello', timestamp: 1000 },
      { role: 'assistant' as const, content: 'Hi', timestamp: 2000 },
    ];

    await client.replay(messages);

    const msg = JSON.parse(written[0]);
    expect(msg.method).toBe('session/replay');
    expect(msg.params.messages).toHaveLength(2);
  });

  it('serializes writes to prevent interleaving', async () => {
    await Promise.all([
      client.sendPrompt('msg1'),
      client.sendPrompt('msg2'),
      client.sendPrompt('msg3'),
    ]);

    expect(written).toHaveLength(3);
    for (const chunk of written) {
      expect(() => JSON.parse(chunk)).not.toThrow();
    }
  });
});
