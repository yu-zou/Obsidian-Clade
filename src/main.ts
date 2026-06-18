import { App, Plugin, PluginManifest, WorkspaceLeaf, Notice } from 'obsidian';
import {
  CladeSettings, DEFAULT_SETTINGS,
  LifecycleEvent, AcpClientEvent, AcpToolCall,
} from './types';
import { CladeSettingTab } from './settings';
import { CladeChatView, CLADE_VIEW_TYPE } from './chat-view';
import { LifecycleManager } from './lifecycle';
import { ACPClient } from './acp-client';
import { SessionStore } from './session-store';
import { DiffEngine } from './diff-engine';
import { DiffView } from './diff-view';
import { Logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

export default class CladePlugin extends Plugin {
  settings!: CladeSettings;
  private view!: CladeChatView;
  private lifecycle!: LifecycleManager;
  private acpClient!: ACPClient;
  private sessionStore!: SessionStore;
  private diffEngine!: DiffEngine;
  private diffView!: DiffView;
  private logger!: Logger;
  private vaultPath: string;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.vaultPath = (app.vault.adapter as any).basePath || '';
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CladeSettingTab(this.app, this));

    // Initialize logger
    this.logger = new Logger(this.vaultPath);
    this.logger.info('Clade plugin loading...');

    // Initialize session store
    this.sessionStore = new SessionStore(path.join(this.vaultPath, this.settings.sessionsDir));
    await this.sessionStore.init();

    // Register the chat view
    this.registerView(CLADE_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      this.view = new CladeChatView(leaf, this);
      return this.view;
    });

    // Activate view and start agent when layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
      this.startAgent();
    });

    // Command: add selection to context
    this.addCommand({
      id: 'add-selection-to-clade',
      name: 'Add selection to Clade context',
      editorCallback: (editor, view) => {
        const selection = editor.getSelection();
        if (selection && view.file) {
          const from = editor.getCursor('from');
          const to = editor.getCursor('to');
          this.addSelectionToContext(view.file.path, { from: from.line, to: to.line }, selection);
        }
      },
    });

    // Command: open chat
    this.addCommand({
      id: 'open-clade-chat',
      name: 'Open Clade chat',
      callback: () => this.activateView(),
    });
  }

  async onunload(): Promise<void> {
    this.logger.info('Clade plugin unloading...');
    if (this.lifecycle) this.lifecycle.dispose();
    this.app.workspace.detachLeavesOfType(CLADE_VIEW_TYPE);
  }

  // --- Settings ---

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // --- View management ---

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CLADE_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: CLADE_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  // --- Agent lifecycle ---

  private startAgent(): void {
    this.logger.info('Starting OpenCode agent...');
    
    this.lifecycle = new LifecycleManager({
      binPath: this.settings.opencodeBinaryPath,
      envVars: this.settings.envVars,
      reconnectConfig: {
        maxAttempts: this.settings.maxReconnectAttempts,
        baseDelayMs: this.settings.reconnectBaseDelayMs,
      },
    });

    // Handle lifecycle events
    this.lifecycle.on('status', (event: LifecycleEvent) => {
      this.logger.info(`Agent status: ${event.status}`, event);
      
      if (!this.view) return;
      this.view.setStatus(event.status);

      if (event.status === 'failed') {
        this.logger.error('Agent connection failed', event.error);
        this.view.showBanner('Clade could not connect to OpenCode.', [
          { label: 'Restart', callback: () => this.restartAgent() },
          { label: 'View Logs', callback: () => this.showLogs() },
        ]);
      }
    });

    this.lifecycle.on('log', (data: { level: string; data: string }) => {
      this.logger.info(`[OpenCode stderr] ${data.data}`);
    });

    // Spawn the process
    this.logger.info(`Spawning process: ${this.settings.opencodeBinaryPath} acp`);
    const handle = this.lifecycle.spawn();

    // Create ACP client
    this.acpClient = new ACPClient(handle.stdin, handle.stdout);
    this.wireACPClient();

    // Create diff engine
    this.diffEngine = new DiffEngine(this.app, this.acpClient, this.vaultPath);

    // Create diff view (CM6 integration)
    this.diffView = new DiffView(this.app, this.diffEngine);

    this.diffEngine.on('queue:updated', (state: { current: string | null; pending: string[] }) => {
      if (state.current && this.view) {
        const suffix = state.pending.length > 0 ? ` — ${state.pending.length} more files` : '';
        this.view.addToolCallRow('edit_file', `Reviewing ${state.current}${suffix}`);
      }
    });
  }

  private wireACPClient(): void {
    let currentStreamingEl: HTMLElement | null = null;

    this.acpClient.on('response:delta', (event: AcpClientEvent) => {
      if (event.type === 'response:delta' && this.view) {
        if (!currentStreamingEl) {
          currentStreamingEl = this.view.renderMessage('assistant', '');
        }
        this.view.appendStreamingDelta(currentStreamingEl!, event.delta);
      }
    });

    this.acpClient.on('response:done', (event: AcpClientEvent) => {
      if (event.type === 'response:done') {
        currentStreamingEl = null;

        this.sessionStore.append({
          role: 'assistant',
          content: event.content,
          toolCalls: event.toolCalls,
          timestamp: Date.now(),
        });

        for (const tc of event.toolCalls) {
          this.handleToolCall(tc);
        }
      }
    });

    this.acpClient.on('tool_call:received', (event: AcpClientEvent) => {
      if (event.type === 'tool_call:received') {
        this.handleToolCall(event.toolCall);
      }
    });

    this.acpClient.on('error', (event: AcpClientEvent) => {
      if (event.type === 'error' && this.view) {
        this.view.addToolCallRow('error', event.message);
      }
    });
  }

  private handleToolCall(toolCall: AcpToolCall): void {
    const summary = this.toolCallSummary(toolCall);
    const details = JSON.stringify(toolCall.arguments, null, 2);

    if (this.view) {
      this.view.addToolCallRow(toolCall.name, summary, details);
    }

    // Intercept edit_file tool calls
    if (toolCall.name === 'edit_file') {
      const filePath = toolCall.arguments?.path;
      const fullPath = path.join(this.vaultPath, filePath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf-8');
      } catch {
        content = '';
      }

      this.diffEngine.enqueue(filePath, toolCall.arguments?.hunks || [], toolCall.id, content);
    }
  }

  private toolCallSummary(tc: AcpToolCall): string {
    switch (tc.name) {
      case 'edit_file':
        return `Proposed ${(tc.arguments?.hunks || []).length} changes to ${tc.arguments?.path || 'unknown'}`;
      case 'read_file':
        return `Read ${tc.arguments?.path || 'file'}`;
      case 'search':
        return `Searched for "${tc.arguments?.query || ''}"`;
      default:
        return tc.name;
    }
  }

  // --- Public API for ChatView ---

  async sendMessage(text: string): Promise<void> {
    if (!this.acpClient) return;

    this.logger.info('Sending message to agent', { textLength: text.length });

    let session = this.sessionStore.getCurrent();
    if (!session) {
      session = await this.sessionStore.create();
      this.logger.info('Created new session', { sessionId: session.id });
    }

    // Auto-title from first user message
    if (session!.messages.length === 0) {
      const title = text.length > 80 ? text.slice(0, 80) + '…' : text;
      this.sessionStore.setTitle(title);
      if (this.view) this.view.setSessionTitle(title);
    }

    // Attach context files
    if (this.view) {
      const context = this.view.getAttachedContext();
      if (context.length > 0) {
        this.logger.info('Attaching context', { contextCount: context.length });
      }
      
      for (const ctx of context) {
        if (ctx.type === 'file') {
          const fullPath = path.join(this.vaultPath, ctx.path);
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            await this.acpClient.attachResource({
              uri: `file://${ctx.path}`,
              name: ctx.path,
              mimeType: 'text/markdown',
              content,
            });
          } catch {
            this.logger.warn('Failed to attach file context', { path: ctx.path });
          }
        } else if (ctx.type === 'selection') {
          await this.acpClient.attachResource({
            uri: `selection://${ctx.path}:${ctx.range.from}-${ctx.range.to}`,
            name: `Selection in ${ctx.path}`,
            content: ctx.text,
          });
        }
      }
    }

    // Save user message
    this.sessionStore.append({
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    // Send to agent
    await this.acpClient.sendPrompt(text);
  }

  addSelectionToContext(filePath: string, range: { from: number; to: number }, text: string): void {
    if (this.view) {
      this.view.attachSelectionContext(filePath, range, text);
    }
  }

  async createNewSession(): Promise<void> {
    const session = await this.sessionStore.create();
    if (this.view) {
      this.view.setSessionTitle(session.title);
      this.view.renderMessage('system', 'New session started.');
    }
  }

  async switchSession(id: string): Promise<void> {
    const session = await this.sessionStore.load(id);
    if (!session || !this.view) return;

    this.view.setSessionTitle(session.title);

    // Re-hydrate chat from saved messages
    for (const msg of session.messages) {
      this.view.renderMessage(msg.role, msg.content);
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          this.view.addToolCallRow(tc.name, this.toolCallSummary(tc));
        }
      }
    }
  }

  async renameSession(id: string, title: string): Promise<void> {
    await this.sessionStore.rename(id, title);
    const current = this.sessionStore.getCurrent();
    if (current?.id === id && this.view) {
      this.view.setSessionTitle(title);
    }
  }

  async loadSessionList(): Promise<void> {
    const sessions = await this.sessionStore.list();
    if (this.view) {
      this.view.renderSessionList(sessions);
    }
  }

  restartAgent(): void {
    this.logger.info('Restarting agent...');
    if (this.lifecycle) this.lifecycle.dispose();
    this.startAgent();
  }

  showLogs(): void {
    const logs = this.logger.getRecentLogs(200);
    new Notice(`Log file: ${this.logger.getLogPath()}\n\n${logs}`, 10000);
  }
}
