import { ItemView, WorkspaceLeaf } from 'obsidian';
import type CladePlugin from './main';

export const CLADE_VIEW_TYPE = 'clade-chat-view';

export type ContextEntry =
  | { type: 'file'; path: string }
  | { type: 'selection'; path: string; range: { from: number; to: number }; text: string };

export class CladeChatView extends ItemView {
  private plugin: CladePlugin;
  private messageContainer!: HTMLElement;
  private inputContainer!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private statusEl!: HTMLElement;
  private sessionTitleEl!: HTMLElement;
  private filePickerEl!: HTMLElement;
  private contextChipsEl!: HTMLElement;
  private attachedContext: ContextEntry[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: CladePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return CLADE_VIEW_TYPE; }
  getDisplayText(): string { return 'Clade'; }
  getIcon(): string { return 'message-square'; }

  async onOpen(): Promise<void> {
    this.buildUI();
  }

  async onClose(): Promise<void> {}

  private buildUI(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('clade-chat-container');

    // Header
    const header = container.createDiv({ cls: 'clade-chat-header' });
    this.statusEl = header.createDiv({ cls: 'clade-status-dot disconnected' });
    this.sessionTitleEl = header.createDiv({ cls: 'clade-session-title' });
    this.sessionTitleEl.setText('New Session');
    this.sessionTitleEl.addEventListener('click', () => this.plugin.loadSessionList());

    // Messages
    this.messageContainer = container.createDiv({ cls: 'clade-messages' });

    // Context chips
    this.contextChipsEl = container.createDiv({ cls: 'clade-context-chips' });

    // File picker (hidden by default)
    this.filePickerEl = container.createDiv({ cls: 'clade-file-picker hidden' });

    // Input
    this.inputContainer = container.createDiv({ cls: 'clade-input-container' });
    this.textarea = this.inputContainer.createEl('textarea', {
      cls: 'clade-chat-input',
      attr: { placeholder: 'Ask Clade... (@ to attach files)', rows: '2' },
    });

    const sendBtn = this.inputContainer.createEl('button', { cls: 'clade-send-btn', text: 'Send' });
    sendBtn.addEventListener('click', () => this.handleSend());

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.textarea.addEventListener('input', () => this.onInputChange());
  }

  private handleSend(): void {
    const text = this.textarea.value.trim();
    if (!text) return;
    this.textarea.value = '';
    this.renderMessage('user', text);
    this.plugin.sendMessage(text);
  }

  // --- Message rendering ---

  renderMessage(role: 'user' | 'assistant' | 'system', content: string): HTMLElement {
    const msgEl = this.messageContainer.createDiv({ cls: `clade-message clade-message-${role}` });
    const contentEl = msgEl.createDiv({ cls: 'clade-message-content' });
    contentEl.setText(content);
    this.scrollToBottom();
    return msgEl;
  }

  appendStreamingDelta(element: HTMLElement, delta: string): void {
    const contentEl = element.querySelector('.clade-message-content');
    if (contentEl) {
      contentEl.appendText(delta);
      this.scrollToBottom();
    }
  }

  addToolCallRow(name: string, summary: string, details?: string): HTMLElement {
    const row = this.messageContainer.createDiv({ cls: 'clade-tool-call-row' });
    const header = row.createDiv({ cls: 'clade-tool-call-header' });

    const icons: Record<string, string> = {
      edit_file: '✏️', read_file: '📖', search: '🔍',
      write_file: '💾', list_files: '📁',
    };
    header.createSpan({ cls: 'clade-tool-call-icon', text: icons[name] || '🔧' });
    header.createSpan({ cls: 'clade-tool-call-summary', text: summary });

    if (details) {
      const toggleBtn = header.createEl('button', { cls: 'clade-tool-call-toggle', text: '▸' });
      const detailsEl = row.createDiv({ cls: 'clade-tool-call-details hidden' });
      detailsEl.setText(details);
      toggleBtn.addEventListener('click', () => {
        detailsEl.classList.toggle('hidden');
        toggleBtn.setText(detailsEl.classList.contains('hidden') ? '▸' : '▾');
      });
    }

    this.scrollToBottom();
    return row;
  }

  setStatus(status: 'connected' | 'connecting' | 'disconnected' | 'failed'): void {
    this.statusEl.className = `clade-status-dot ${status}`;
  }

  setSessionTitle(title: string): void {
    this.sessionTitleEl.setText(title);
  }

  showBanner(message: string, actions?: { label: string; callback: () => void }[]): void {
    const banner = this.messageContainer.createDiv({ cls: 'clade-banner' });
    banner.createSpan({ text: message });
    if (actions) {
      const btnContainer = banner.createDiv({ cls: 'clade-banner-actions' });
      for (const action of actions) {
        const btn = btnContainer.createEl('button', { text: action.label });
        btn.addEventListener('click', () => { action.callback(); banner.remove(); });
      }
    }
  }

  private scrollToBottom(): void {
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  // --- @-mention file picker ---

  private onInputChange(): void {
    const value = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;
    const beforeCursor = value.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf('@');

    if (atIdx !== -1 && (atIdx === 0 || beforeCursor[atIdx - 1] === ' ')) {
      this.showFilePicker(beforeCursor.slice(atIdx + 1).toLowerCase());
    } else {
      this.hideFilePicker();
    }
  }

  private showFilePicker(query: string): void {
    this.filePickerEl.empty();
    this.filePickerEl.classList.remove('hidden');

    const files = this.plugin.app.vault.getFiles();
    let activePath: string | null = null;
    const activeFile = this.plugin.app.workspace.getActiveFile?.();
    if (activeFile) {
      activePath = activeFile.path;
      const item = this.filePickerEl.createDiv({ cls: 'clade-file-picker-item active-file' });
      item.createSpan({ cls: 'clade-file-picker-badge', text: 'Active' });
      item.createSpan({ cls: 'clade-file-picker-name', text: activeFile.path });
      item.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        this.selectFile(activeFile.path);
      });
    }

    for (const file of files
      .filter(f => f.path !== activePath && f.path.toLowerCase().includes(query))
      .slice(0, 10)) {
      const item = this.filePickerEl.createDiv({ cls: 'clade-file-picker-item' });
      item.createSpan({ cls: 'clade-file-picker-name', text: file.path });
      item.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        this.selectFile(file.path);
      });
    }

    if (!activePath && files.filter(f => f.path.toLowerCase().includes(query)).length === 0) {
      this.filePickerEl.createDiv({ cls: 'clade-file-picker-empty', text: 'No files found' });
    }

    // Position below input
    const inputRect = this.textarea.getBoundingClientRect();
    const containerRect = this.containerEl.getBoundingClientRect();
    Object.assign(this.filePickerEl.style, {
      position: 'absolute',
      bottom: `${containerRect.bottom - inputRect.top + 4}px`,
      left: `${inputRect.left - containerRect.left}px`,
      width: `${inputRect.width}px`,
    });
  }

  private hideFilePicker(): void {
    this.filePickerEl.classList.add('hidden');
  }

  private selectFile(filePath: string): void {
    const value = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;
    const beforeCursor = value.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf('@');

    if (atIdx !== -1) {
      const afterCursor = value.slice(cursorPos);
      this.textarea.value = beforeCursor.slice(0, atIdx) + filePath + ' ' + afterCursor;
      const newPos = atIdx + filePath.length + 1;
      this.textarea.setSelectionRange(newPos, newPos);
    }

    this.attachFileContext(filePath);
    this.hideFilePicker();
    this.textarea.focus();
  }

  // --- Context chips ---

  attachFileContext(filePath: string): void {
    if (this.attachedContext.some(c => c.type === 'file' && c.path === filePath)) return;
    this.attachedContext.push({ type: 'file', path: filePath });
    this.renderContextChips();
  }

  attachSelectionContext(filePath: string, range: { from: number; to: number }, text: string): void {
    this.attachedContext.push({ type: 'selection', path: filePath, range, text });
    this.renderContextChips();
  }

  private removeContext(index: number): void {
    this.attachedContext.splice(index, 1);
    this.renderContextChips();
  }

  private renderContextChips(): void {
    this.contextChipsEl.empty();
    for (let i = 0; i < this.attachedContext.length; i++) {
      const ctx = this.attachedContext[i];
      const chip = this.contextChipsEl.createDiv({ cls: 'clade-context-chip' });
      const label = ctx.type === 'file'
        ? `📄 ${ctx.path.split('/').pop()}`
        : `📝 ${ctx.path.split('/').pop()} (selection)`;
      chip.createSpan({ text: label });
      const closeBtn = chip.createEl('button', { cls: 'clade-context-chip-close', text: '✕' });
      closeBtn.addEventListener('click', () => this.removeContext(i));
    }
  }

  getAttachedContext(): ContextEntry[] {
    return [...this.attachedContext];
  }

  // --- Session list ---

  renderSessionList(sessions: Array<{ id: string; title: string; lastActiveAt: number }>): void {
    const existing = this.containerEl.querySelector('.clade-session-list');
    if (existing) existing.remove();

    const list = this.containerEl.createDiv({ cls: 'clade-session-list' });
    const header = list.createDiv({ cls: 'clade-session-list-header' });
    header.createSpan({ text: 'Sessions' });

    const newBtn = header.createEl('button', { cls: 'clade-session-new-btn', text: '+ New' });
    newBtn.addEventListener('click', () => {
      this.plugin.createNewSession();
      list.remove();
    });

    for (const session of sessions) {
      const item = list.createDiv({ cls: 'clade-session-list-item' });
      const nameEl = item.createDiv({ cls: 'clade-session-list-name' });
      nameEl.setText(session.title);
      item.createDiv({
        cls: 'clade-session-list-date',
        text: new Date(session.lastActiveAt).toLocaleString(),
      });
      item.addEventListener('click', () => {
        this.plugin.switchSession(session.id);
        list.remove();
      });

      // Right-click to rename
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const input = nameEl.createEl('input', { attr: { value: session.title } });
        input.select();
        nameEl.setText('');
        nameEl.appendChild(input);
        input.addEventListener('blur', () => {
          const newTitle = input.value.trim() || session.title;
          this.plugin.renameSession(session.id, newTitle);
          nameEl.setText(newTitle);
        });
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') input.blur();
        });
        input.focus();
      });
    }
  }
}
