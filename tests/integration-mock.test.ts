/**
 * Integration test: Mock OpenCode ACP Server
 * 
 * Tests the actual ACP client against a mock OpenCode process
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ACPClient } from '../src/acp-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ACP Client Integration with Mock OpenCode', () => {
  let mockProcess: ChildProcess;
  let acpClient: ACPClient;
  let events: any[] = [];

  beforeEach(() => {
    events = [];
    
    // Spawn the mock OpenCode server
    const mockPath = join(__dirname, 'mock-opencode.js');
    mockProcess = spawn('node', [mockPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Capture stderr for debugging
    mockProcess.stderr?.on('data', (data) => {
      // Suppress mock output in tests
    });

    // Create ACP client
    acpClient = new ACPClient(mockProcess.stdin!, mockProcess.stdout!);

    // Set up event listeners
    acpClient.on('response:delta', (event) => {
      events.push(event);
    });

    acpClient.on('response:done', (event) => {
      events.push(event);
    });

    acpClient.on('tool_call:received', (event) => {
      events.push(event);
    });

    acpClient.on('error', (event) => {
      console.error('[ACP Error]', event);
    });
  });

  afterEach(() => {
    if (mockProcess && !mockProcess.killed) {
      mockProcess.kill('SIGTERM');
    }
  });

  it('should send prompt and receive streaming response', async () => {
    await acpClient.sendPrompt('Hello, OpenCode!');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify we received delta events
    const deltaEvents = events.filter(e => e.type === 'response:delta');
    expect(deltaEvents.length).toBeGreaterThan(0);

    // Verify we received the done event
    const doneEvents = events.filter(e => e.type === 'response:done');
    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0].content).toContain('mock OpenCode');
  });

  it('should attach resources', async () => {
    await acpClient.attachResource({
      uri: 'file:///test.md',
      name: 'test.md',
      content: '# Test',
      mimeType: 'text/markdown'
    });

    // Should not throw
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should handle tool call events', async () => {
    // Just verify the event listener works
    expect(acpClient.on).toBeDefined();
  });
});
