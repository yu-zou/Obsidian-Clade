import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { LifecycleManager } from '../src/lifecycle';
import type { LifecycleEvent } from '../src/types';

// Mock child_process.spawn
const mockProcess = new EventEmitter() as any;
mockProcess.stdin = new EventEmitter();
mockProcess.stdout = new EventEmitter();
mockProcess.stderr = new EventEmitter();
mockProcess.pid = 12345;
mockProcess.killed = false;
mockProcess.kill = vi.fn(() => { mockProcess.killed = true; });

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProcess),
}));

import { spawn } from 'child_process';

describe('LifecycleManager', () => {
  let lm: LifecycleManager;
  let statusHandler: (event: LifecycleEvent) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.killed = false;
    mockProcess.removeAllListeners();
    lm = new LifecycleManager({
      binPath: 'opencode',
      envVars: { OPENCODE_API_KEY: 'test-key' },
    });
    statusHandler = vi.fn();
    lm.on('status', statusHandler);
  });

  afterEach(() => {
    lm.dispose();
  });

  describe('spawn', () => {
    it('spawns the binary with acp argument', () => {
      lm.spawn();
      expect(spawn).toHaveBeenCalledWith('opencode', ['acp'], expect.objectContaining({
        env: expect.objectContaining({ OPENCODE_API_KEY: 'test-key' }),
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
    });

    it('emits connecting then connected status', () => {
      lm.spawn();
      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({ status: 'connecting' }));
      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({ status: 'connected' }));
    });

    it('returns stdin and stdout handles', () => {
      const handle = lm.spawn();
      expect(handle.stdin).toBe(mockProcess.stdin);
      expect(handle.stdout).toBe(mockProcess.stdout);
    });
  });

  describe('process exit', () => {
    it('emits disconnected on clean exit (code 0)', () => {
      lm.spawn();
      statusHandler.mockClear();
      mockProcess.emit('exit', 0, null);
      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
        status: 'disconnected',
        error: undefined,
      }));
    });

    it('emits disconnected with error on non-zero exit', () => {
      lm.spawn();
      statusHandler.mockClear();
      mockProcess.emit('exit', 1, null);
      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
        status: 'disconnected',
        error: 'Process exited with code 1',
      }));
    });

    it('does not reconnect on clean exit', () => {
      lm = new LifecycleManager({
        binPath: 'opencode',
        envVars: {},
        reconnectConfig: { maxAttempts: 3, baseDelayMs: 100 },
      });
      lm.on('status', statusHandler);

      lm.spawn();
      statusHandler.mockClear();
      mockProcess.emit('exit', 0, null);

      // Should not have any connecting status (no reconnect)
      const connectingCalls = statusHandler.mock.calls.filter(
        (call: any) => call[0].status === 'connecting'
      );
      expect(connectingCalls).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('sends SIGTERM', () => {
      lm.spawn();
      lm.dispose();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('does not throw if process is already dead', () => {
      expect(() => lm.dispose()).not.toThrow();
    });

    it('does not reconnect after dispose', () => {
      lm = new LifecycleManager({
        binPath: 'opencode',
        envVars: {},
        reconnectConfig: { maxAttempts: 3, baseDelayMs: 100 },
      });
      lm.on('status', statusHandler);

      lm.spawn();
      lm.dispose();
      statusHandler.mockClear();
      mockProcess.emit('exit', 1, null);

      // Should not reconnect
      const connectingCalls = statusHandler.mock.calls.filter(
        (call: any) => call[0].status === 'connecting'
      );
      expect(connectingCalls).toHaveLength(0);
    });
  });

  describe('isRunning', () => {
    it('returns false before spawn', () => {
      expect(lm.isRunning()).toBe(false);
    });

    it('returns true after spawn', () => {
      lm.spawn();
      expect(lm.isRunning()).toBe(true);
    });

    it('returns false after process exits', () => {
      lm.spawn();
      mockProcess.emit('exit', 0, null);
      expect(lm.isRunning()).toBe(false);
    });
  });
});

describe('LifecycleManager reconnect', () => {
  let lm: LifecycleManager;
  let statusHandler: (event: LifecycleEvent) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockProcess.killed = false;
    mockProcess.removeAllListeners();
    lm = new LifecycleManager({
      binPath: 'opencode',
      envVars: {},
      reconnectConfig: { maxAttempts: 3, baseDelayMs: 100 },
    });
    statusHandler = vi.fn();
    lm.on('status', statusHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
    lm.dispose();
  });

  it('attempts reconnect on unexpected exit', () => {
    lm.spawn();
    statusHandler.mockClear();
    mockProcess.emit('exit', 1, null);

    vi.advanceTimersByTime(100);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
      status: 'connecting',
      attempt: 1,
    }));
  });

  it('backs off exponentially', () => {
    lm.spawn();
    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(100); // attempt 1 at 100ms
    expect(spawn).toHaveBeenCalledTimes(2);

    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(200); // attempt 2 at 200ms
    expect(spawn).toHaveBeenCalledTimes(3);

    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(400); // attempt 3 at 400ms
    expect(spawn).toHaveBeenCalledTimes(4);
  });

  it('emits failed after maxAttempts exhausted', () => {
    lm.spawn();
    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(100); // attempt 1
    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(200); // attempt 2
    mockProcess.emit('exit', 1, null);
    vi.advanceTimersByTime(400); // attempt 3
    mockProcess.emit('exit', 1, null);
    // attempt 4 would exceed maxAttempts (3)
    expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      attempt: 3,
    }));
    expect(spawn).toHaveBeenCalledTimes(4); // original + 3 attempts
  });
});
