#!/usr/bin/env node

/**
 * Mock OpenCode ACP Server
 * 
 * This simulates an OpenCode process that speaks the ACP protocol over stdio.
 * Used for testing the Clade plugin without needing real OpenCode.
 * 
 * Protocol: JSON-RPC 2.0 over newline-delimited JSON
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function send(method, params = {}) {
  const msg = {
    jsonrpc: '2.0',
    method,
    params
  };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function sendResponse(id, result) {
  const msg = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

console.error('[Mock OpenCode] Started');

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    console.error('[Mock OpenCode] Received:', msg.method, msg.params);

    // Handle different ACP methods
    if (msg.method === 'session/prompt') {
      // Simulate streaming response
      const text = msg.params?.text || '';
      console.error('[Mock OpenCode] Processing prompt:', text);
      
      // Send some delta messages
      setTimeout(() => {
        send('content', { delta: 'Hello from mock OpenCode! ' });
      }, 100);
      
      setTimeout(() => {
        send('content', { delta: `You said: "${text}"` });
      }, 200);
      
      setTimeout(() => {
        send('response', { 
          done: true,
          content: `Hello from mock OpenCode! You said: "${text}"`,
          toolCalls: []
        });
      }, 300);

    } else if (msg.method === 'resources/attach') {
      console.error('[Mock OpenCode] Resource attached:', msg.params?.resource);
      sendResponse(msg.id, { success: true });

    } else if (msg.method === 'tools/resolve') {
      console.error('[Mock OpenCode] Tool resolved:', msg.params?.id);
      sendResponse(msg.id, { success: true });

    } else if (msg.method === 'session/replay') {
      console.error('[Mock OpenCode] Replaying messages:', msg.params?.messages?.length);
      sendResponse(msg.id, { success: true });

    } else {
      console.error('[Mock OpenCode] Unknown method:', msg.method);
      sendResponse(msg.id, { error: 'Unknown method' });
    }
  } catch (err) {
    console.error('[Mock OpenCode] Parse error:', err.message);
  }
});

rl.on('close', () => {
  console.error('[Mock OpenCode] Shutting down');
  process.exit(0);
});

// Handle signals
process.on('SIGTERM', () => {
  console.error('[Mock OpenCode] Received SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[Mock OpenCode] Received SIGINT');
  process.exit(0);
});
