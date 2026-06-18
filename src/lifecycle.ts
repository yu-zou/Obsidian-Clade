import { spawn as cpSpawn, ChildProcess } from 'child_process';
import { LifecycleEvent, EventHandler } from './types';

export interface LifecycleConfig {
  binPath: string;
  envVars: Record<string, string>;
  args?: string[];
  reconnectConfig?: {
    maxAttempts: number;
    baseDelayMs: number;
  };
}

export interface LifecycleHandle {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
}

export class LifecycleManager {
  private config: LifecycleConfig;
  private process: ChildProcess | null = null;
  private handle: LifecycleHandle | null = null;
  private handlers = new Map<string, EventHandler<any>[]>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(config: LifecycleConfig) {
    this.config = config;
  }

  on(event: string, handler: EventHandler<any>): void {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  spawn(): LifecycleHandle {
    this.emit('status', { status: 'connecting', attempt: this.reconnectAttempt });

    this.process = cpSpawn(this.config.binPath, this.config.args || ['acp'], {
      env: { ...process.env, ...this.config.envVars },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.handle = {
      stdin: this.process.stdin!,
      stdout: this.process.stdout!,
    };

    if (this.process.stderr) {
      this.process.stderr.on('data', (chunk: Buffer) => {
        this.emit('log', { level: 'stderr', data: chunk.toString() });
      });
    }

    this.process.on('exit', (code, signal) => {
      this.process = null;
      if (this.disposed) return;

      const wasClean = code === 0 && !signal;
      this.emit('status', {
        status: 'disconnected',
        error: code ? `Process exited with code ${code}` :
               signal ? `Process killed with signal ${signal}` : undefined,
      });

      if (!wasClean) {
        this.scheduleReconnect();
      }
    });

    this.process.on('error', (err) => {
      if (this.disposed) return;
      this.emit('status', {
        status: 'disconnected',
        error: `Process error: ${err.message}`,
      });
      this.scheduleReconnect();
    });

    if (this.reconnectAttempt === 0) {
      this.emit('status', { status: 'connected' });
    }
    return this.handle;
  }

  dispose(): void {
    this.disposed = true;
    this.cancelReconnect();
    if (!this.process) return;

    this.process.kill('SIGTERM');
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 2000);
    this.process = null;
    this.handle = null;
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private scheduleReconnect(): void {
    const rc = this.config.reconnectConfig;
    if (!rc) return;

    if (this.reconnectAttempt >= rc.maxAttempts) {
      this.emit('status', { status: 'failed', attempt: this.reconnectAttempt });
      return;
    }

    this.reconnectAttempt++;
    const delay = rc.baseDelayMs * Math.pow(2, this.reconnectAttempt - 1);

    this.reconnectTimer = setTimeout(() => {
      this.spawn();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit(event: string, data: any): void {
    const list = this.handlers.get(event) || [];
    for (const handler of list) {
      handler(data);
    }
  }
}
