import { Writable, Readable } from 'stream';
import { AcpClientEvent, AcpResource, AcpToolCall, AcpMessage, EventHandler } from './types';

export class ACPClient {
  private stdin: Writable;
  private stdout: Readable;
  private handlers = new Map<string, EventHandler<any>[]>();
  private buffer = '';
  private stdinLock = Promise.resolve();

  constructor(stdin: Writable, stdout: Readable) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      this.processBuffer();
    });
  }

  on(event: string, handler: EventHandler<any>): void {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  private emit(event: string, data: any): void {
    for (const h of this.handlers.get(event) || []) h(data);
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed);
        this.handleMessage(msg);
      } catch (err: any) {
        this.emit('error', {
          type: 'error',
          message: `JSON parse error: ${err.message}`,
        });
      }
    }
  }

  private handleMessage(msg: any): void {
    if (msg.method === 'tool_call') {
      const toolCall: AcpToolCall = {
        id: msg.params?.id,
        name: msg.params?.name,
        arguments: msg.params?.arguments,
      };
      this.emit('tool_call:received', { type: 'tool_call:received', toolCall });
    } else if (msg.method === 'content') {
      if (msg.params?.delta) {
        this.emit('response:delta', { type: 'response:delta', delta: msg.params.delta });
      }
    } else if (msg.method === 'response') {
      if (msg.params?.done) {
        this.emit('response:done', {
          type: 'response:done',
          content: msg.params?.content || '',
          toolCalls: msg.params?.toolCalls || [],
        });
      } else if (msg.params?.delta) {
        this.emit('response:delta', { type: 'response:delta', delta: msg.params.delta });
      }
    }
  }

  private sendNotification(method: string, params: any): Promise<void> {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
    return this.writeStdin(msg + '\n');
  }

  private async writeStdin(data: string): Promise<void> {
    // Serialize writes to prevent interleaving
    this.stdinLock = this.stdinLock.then(
      () => new Promise<void>((resolve, reject) => {
        this.stdin.write(data, 'utf-8', (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
    );
    return this.stdinLock;
  }

  async sendPrompt(text: string): Promise<void> {
    return this.sendNotification('session/prompt', { text });
  }

  async attachResource(resource: AcpResource): Promise<void> {
    return this.sendNotification('resources/attach', { resource });
  }

  async resolveToolCall(callId: string, result: any): Promise<void> {
    return this.sendNotification('tools/resolve', { id: callId, result });
  }

  async sendRevise(hunkId: string, feedback: string): Promise<void> {
    return this.sendNotification('session/prompt', {
      text: `Revise: ${feedback}`,
      hunkId,
    });
  }

  async replay(messages: AcpMessage[]): Promise<void> {
    return this.sendNotification('session/replay', { messages });
  }
}
