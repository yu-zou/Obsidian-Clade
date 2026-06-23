import { spawn as cpSpawn, spawnSync, ChildProcess } from 'child_process';
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
  private lastError: string | undefined;

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

    const resolvedPath = this.resolveBinaryPath(this.config.binPath);
    
    this.process = cpSpawn(resolvedPath, this.config.args || ['acp'], {
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
      const errorMsg = code ? `Process exited with code ${code}` :
               signal ? `Process killed with signal ${signal}` : undefined;
      if (errorMsg) this.lastError = errorMsg;
      
      this.emit('status', {
        status: 'disconnected',
        error: errorMsg,
      });

      if (!wasClean) {
        this.scheduleReconnect();
      }
    });

    this.process.on('error', (err) => {
      if (this.disposed) return;
      const errorMsg = `Process error: ${err.message}`;
      this.lastError = errorMsg;
      this.emit('status', {
        status: 'disconnected',
        error: errorMsg,
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
      this.emit('status', { 
        status: 'failed', 
        attempt: this.reconnectAttempt,
        error: this.lastError,
      });
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

  private resolveBinaryPath(binPath: string): string {
    // If it's already an absolute path, return as-is
    if (binPath.startsWith('/') || binPath.includes(':\\')) {
      return binPath;
    }

    // Try to resolve from PATH using which (Unix) or where (Windows)
    // Use shell: true to ensure we get the user's full PATH from their shell config
    try {
      const command = process.platform === 'win32' ? 'where' : 'which';
      const result = spawnSync(command, [binPath], { 
        encoding: 'utf-8',
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      if (result.status === 0 && result.stdout) {
        const resolved = result.stdout.trim();
        if (resolved) {
          const fullPath = resolved.split('\n')[0]; // Take first result if multiple
          this.emit('log', { level: 'info', data: `Resolved ${binPath} to ${fullPath}` });
          return fullPath;
        }
      } else {
        this.emit('log', { level: 'warn', data: `which/where failed with status ${result.status}` });
      }
    } catch (error) {
      this.emit('log', { level: 'warn', data: `which/where threw error: ${error}` });
    }

    // Fallback: check common installation paths
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const commonPaths = [
      `${homeDir}/.opencode/bin`,
      `${homeDir}/.local/bin`,
      '/usr/local/bin',
      '/usr/bin',
    ];

    for (const dir of commonPaths) {
      const fullPath = `${dir}/${binPath}`;
      try {
        const result = spawnSync('test', ['-f', fullPath], { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        if (result.status === 0) {
          this.emit('log', { level: 'info', data: `Found ${binPath} at ${fullPath}` });
          return fullPath;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    this.emit('log', { level: 'warn', data: `Could not resolve ${binPath}, using as-is` });
    return binPath;
  }

  private emit(event: string, data: any): void {
    const list = this.handlers.get(event) || [];
    for (const handler of list) {
      handler(data);
    }
  }
}
