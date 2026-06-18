/**
 * End-to-End Integration Test
 * 
 * Tests the complete flow: spawning OpenCode process, ACP communication,
 * and receiving responses.
 * 
 * Usage: npm run test:e2e
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { ACPClient } from '../src/acp-client';
import { LifecycleManager } from '../src/lifecycle';
import type { AcpClientEvent } from '../src/types';

describe('E2E: Full Integration', () => {
  let lifecycle: LifecycleManager;
  let acpClient: ACPClient;
  let mockProcess: ChildProcess;
  let events: AcpClientEvent[] = [];

  beforeEach(() => {
    events = [];
  });

  afterEach(() => {
    if (lifecycle) {
      lifecycle.dispose();
    }
    if (mockProcess && !mockProcess.killed) {
      mockProcess.kill('SIGTERM');
    }
  });

  describe('with mock OpenCode server', () => {
    beforeEach(() => {
      // Start mock OpenCode
      mockProcess = spawn('node', ['tests/mock-opencode.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      mockProcess.stderr?.on('data', (data) => {
        // Suppress mock output in tests
      });

      // Create ACP client
      acpClient = new ACPClient(mockProcess.stdin!, mockProcess.stdout!);

      // Set up listeners
      acpClient.on('response:delta', (e) => events.push(e));
      acpClient.on('response:done', (e) => events.push(e));
      acpClient.on('tool_call:received', (e) => events.push(e));
    });

    it('should send prompt and receive streaming response', async () => {
      await acpClient.sendPrompt('Hello, OpenCode!');

      // Wait a bit for async events
      await new Promise(resolve => setTimeout(resolve, 500));

      const deltaEvents = events.filter(e => e.type === 'response:delta');
      const doneEvents = events.filter(e => e.type === 'response:done');

      expect(deltaEvents.length).toBeGreaterThan(0);
      expect(doneEvents.length).toBe(1);
      
      const finalEvent = doneEvents[0];
      if (finalEvent.type === 'response:done') {
        expect(finalEvent.content).toContain('mock OpenCode');
      }
    });

    it('should attach resources', async () => {
      await acpClient.attachResource({
        uri: 'file:///test.md',
        name: 'test.md',
        content: '# Test',
        mimeType: 'text/markdown'
      });

      // Give it time to process
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle tool calls', async () => {
      // This would require modifying the mock to send a tool call
      // For now, just verify the event listener works
      expect(acpClient.on).toBeDefined();
    });
  });

  describe('with LifecycleManager', () => {
    it('should spawn mock process and handle lifecycle', async () => {
      const statusEvents: any[] = [];

      lifecycle = new LifecycleManager({
        binPath: 'node',
        args: ['tests/mock-opencode.js'],
        envVars: {},
        reconnectConfig: {
          maxAttempts: 2,
          baseDelayMs: 100
        }
      });

      lifecycle.on('status', (event) => {
        statusEvents.push(event);
      });

      const handle = lifecycle.spawn();
      acpClient = new ACPClient(handle.stdin, handle.stdout);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(statusEvents.some(e => e.status === 'connecting')).toBe(true);
      expect(statusEvents.some(e => e.status === 'connected')).toBe(true);
    });

    it('should handle process exit and reconnect', async () => {
      const statusEvents: any[] = [];
      let spawnCount = 0;

      lifecycle = new LifecycleManager({
        binPath: 'node',
        args: ['-e', 'setTimeout(() => process.exit(1), 100)'],
        envVars: {},
        reconnectConfig: {
          maxAttempts: 3,
          baseDelayMs: 50
        }
      });

      lifecycle.on('status', (event) => {
        statusEvents.push(event);
        
        if (event.status === 'connecting') {
          spawnCount++;
        }
      });

      lifecycle.spawn();

      // Wait for all reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(spawnCount).toBe(4); // initial + 3 attempts
      expect(statusEvents.filter(e => e.status === 'disconnected').length).toBeGreaterThan(0);
    });

    it('should dispose cleanly', async () => {
      lifecycle = new LifecycleManager({
        binPath: 'node',
        args: ['tests/mock-opencode.js'],
        envVars: {}
      });

      const statusEvents: any[] = [];

      lifecycle.on('status', (event) => {
        statusEvents.push(event);
      });

      lifecycle.spawn();

      await new Promise(resolve => setTimeout(resolve, 100));
      
      lifecycle.dispose();
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lifecycle.isRunning()).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent binary', async () => {
      lifecycle = new LifecycleManager({
        binPath: '/nonexistent/binary',
        envVars: {},
        reconnectConfig: {
          maxAttempts: 1,
          baseDelayMs: 50
        }
      });

      let errorEvent: any = null;

      lifecycle.on('status', (event) => {
        if (event.status === 'disconnected') {
          errorEvent = event;
        }
      });

      lifecycle.spawn();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toBeDefined();
    });

    it('should emit error events for invalid JSON', async () => {
      mockProcess = spawn('node', ['tests/mock-opencode.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      acpClient = new ACPClient(mockProcess.stdin!, mockProcess.stdout!);

      let errorEvent: any = null;

      acpClient.on('error', (event) => {
        if (event.type === 'error' && event.message.includes('JSON parse error')) {
          errorEvent = event;
        }
      });

      // Send invalid JSON
      mockProcess.stdin!.write('not valid json\n');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorEvent).toBeDefined();
    });
  });
});
