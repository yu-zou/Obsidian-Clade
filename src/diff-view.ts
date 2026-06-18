import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { App, MarkdownView } from 'obsidian';
import type { DiffEngine } from './diff-engine';
import type { TrackedHunk } from './types';

// --- State effects for updating decorations ---

const setHunksEffect = StateEffect.define<{
  hunks: TrackedHunk[];
  popoverFor?: number;  // hunk index to show popover for
}>();

// --- Action button widget ---

class HunkActionsWidget extends WidgetType {
  constructor(
    private hunkIndex: number,
    private handlers: {
      accept: () => void;
      reject: () => void;
      revise: () => void;
    },
  ) {
    super();
  }

  toDOM() {
    const container = document.createElement('span');
    container.className = 'clade-hunk-actions';
    container.contentEditable = 'false';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'clade-accept-btn';
    acceptBtn.textContent = '✓ Accept';
    acceptBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    acceptBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.handlers.accept(); });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'clade-reject-btn';
    rejectBtn.textContent = '✗ Reject';
    rejectBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    rejectBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.handlers.reject(); });

    const reviseBtn = document.createElement('button');
    reviseBtn.className = 'clade-revise-btn';
    reviseBtn.textContent = '✎ Revise';
    reviseBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    reviseBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.handlers.revise(); });

    container.appendChild(acceptBtn);
    container.appendChild(rejectBtn);
    container.appendChild(reviseBtn);
    return container;
  }

  eq(other: HunkActionsWidget) {
    return this.hunkIndex === other.hunkIndex;
  }
}

// --- Revise popover widget ---

class RevisePopoverWidget extends WidgetType {
  private inputEl: HTMLInputElement | null = null;

  constructor(
    private hunkIndex: number,
    private onSubmit: (feedback: string) => void,
    private onDismiss: () => void,
  ) {
    super();
  }

  toDOM() {
    const popover = document.createElement('div');
    popover.className = 'clade-revise-popover';
    popover.contentEditable = 'false';

    const label = document.createElement('div');
    label.textContent = 'Revise hunk:';
    label.style.fontSize = '12px';
    label.style.marginBottom = '4px';
    label.style.color = 'var(--text-muted)';

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Enter revision feedback...';
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const feedback = this.inputEl?.value.trim() || '';
        if (feedback) {
          this.onSubmit(feedback);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onDismiss();
      }
    });

    const hint = document.createElement('div');
    hint.textContent = 'Enter to submit, Esc to cancel';
    hint.style.fontSize = '10px';
    hint.style.marginTop = '4px';
    hint.style.color = 'var(--text-faint)';

    popover.appendChild(label);
    popover.appendChild(this.inputEl);
    popover.appendChild(hint);

    setTimeout(() => this.inputEl?.focus(), 0);
    return popover;
  }

  eq(other: RevisePopoverWidget) {
    return this.hunkIndex === other.hunkIndex;
  }
}

// --- Hunk decoration field ---

function createHunkDecorationField(handlers: {
  accept: (hunkIndex: number) => void;
  reject: (hunkIndex: number) => void;
  showRevise: (hunkIndex: number) => void;
  submitRevise: (hunkIndex: number, feedback: string) => void;
  dismissRevise: () => void;
}): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setHunksEffect)) {
          const { hunks, popoverFor } = effect.value;
          const decorations: any[] = [];
          const doc = tr.state.doc;

          for (const hunk of hunks) {
            // Calculate line positions (1-indexed in hunks, 0-indexed in CM)
            const fromLine = hunk.original.oldStart - 1;
            const toLine = fromLine + hunk.original.oldLines;

            // Add line decorations for the hunk range
            if (hunk.original.oldLines === 0) {
              const lineNum = Math.min(toLine + 1, doc.lines);
              if (lineNum >= 1 && lineNum <= doc.lines) {
                const pos = doc.line(lineNum).from;
                decorations.push(
                  Decoration.line({ class: `cm-clade-hunk-${hunk.state}` }).range(pos)
                );
              }
            } else {
              for (let i = fromLine; i < toLine; i++) {
                const lineNum = i + 1;
                if (lineNum > doc.lines) break;
                const pos = doc.line(lineNum).from;
                decorations.push(
                  Decoration.line({ class: `cm-clade-hunk-${hunk.state}` }).range(pos)
                );
              }
            }

            // Add action buttons for pending hunks
            if (hunk.state === 'pending') {
              const lineNum = Math.min(toLine, doc.lines);
              if (lineNum >= 1 && lineNum <= doc.lines) {
                const pos = doc.line(lineNum).to;
                const widget = new HunkActionsWidget(hunk.index, {
                  accept: () => handlers.accept(hunk.index),
                  reject: () => handlers.reject(hunk.index),
                  revise: () => handlers.showRevise(hunk.index),
                });
                decorations.push(Decoration.widget({ widget, side: 1 }).range(pos));
              }
            }
          }

          // Add popover if requested
          if (popoverFor !== undefined) {
            const hunk = hunks[popoverFor];
            if (hunk) {
              const fromLine = hunk.original.oldStart - 1;
              const toLine = fromLine + hunk.original.oldLines;
              const lineNum = Math.min(toLine, doc.lines);
              if (lineNum >= 1 && lineNum <= doc.lines) {
                const pos = doc.line(lineNum).to;
                const popoverWidget = new RevisePopoverWidget(
                  hunk.index,
                  (feedback) => handlers.submitRevise(hunk.index, feedback),
                  () => handlers.dismissRevise(),
                );
                decorations.push(Decoration.widget({ widget: popoverWidget, side: 1 }).range(pos));
              }
            }
          }

          return Decoration.set(decorations, true);
        }
      }
      return decorations;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

// --- DiffView: orchestrates CM6 integration ---

export class DiffView {
  private app: App;
  private diffEngine: DiffEngine;
  private hunkField: StateField<DecorationSet> | null = null;
  private currentEditorView: EditorView | null = null;
  private popoverForHunk: number | null = null;

  constructor(app: App, diffEngine: DiffEngine) {
    this.app = app;
    this.diffEngine = diffEngine;

    // Listen to diff engine queue updates
    this.diffEngine.on('queue:updated', () => this.refreshDecorations());

    // Listen to active editor changes
    this.app.workspace.on('active-leaf-change', () => {
      this.setupEditorView();
      this.refreshDecorations();
    });

    // Setup initial editor
    this.setupEditorView();
  }

  private setupEditorView(): void {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) {
      this.currentEditorView = null;
      return;
    }

    const view = leaf.view;
    if (!(view instanceof MarkdownView)) {
      this.currentEditorView = null;
      return;
    }

    const editor = (view as any).editor;
    if (!(editor?.cm instanceof EditorView)) {
      this.currentEditorView = null;
      return;
    }

    const editorView = editor.cm;

    if (this.currentEditorView === editorView) return;

    // Create the hunk decoration field with handlers
    this.hunkField = createHunkDecorationField({
      accept: (index) => this.handleAccept(index),
      reject: (index) => this.handleReject(index),
      showRevise: (index) => this.showRevisePopover(index),
      submitRevise: (index, feedback) => this.handleSubmitRevise(index, feedback),
      dismissRevise: () => this.handleDismissRevise(),
    });

    // Register the extension with the editor by appending config
    const extension: Extension = this.hunkField;
    const newState = editorView.state.update({
      effects: StateEffect.appendConfig.of(extension),
    }).state;
    editorView.setState(newState);

    this.currentEditorView = editorView;
  }

  private refreshDecorations(): void {
    if (!this.currentEditorView) {
      this.setupEditorView();
      if (!this.currentEditorView) return;
    }

    const currentReview = this.diffEngine.getCurrentReview();
    if (!currentReview) {
      this.currentEditorView.dispatch({
        effects: setHunksEffect.of({ hunks: [] }),
      });
      return;
    }

    // Check if the current file matches the editor's file
    const activeFile = this.app.workspace.activeLeaf?.view?.file;
    if (!activeFile || activeFile.path !== currentReview.path) {
      this.currentEditorView.dispatch({
        effects: setHunksEffect.of({ hunks: [] }),
      });
      return;
    }

    // Update decorations
    this.currentEditorView.dispatch({
      effects: setHunksEffect.of({
        hunks: currentReview.hunks,
        popoverFor: this.popoverForHunk ?? undefined,
      }),
    });
  }

  private handleAccept(hunkIndex: number): void {
    if (!this.currentEditorView) return;
    const currentContent = this.currentEditorView.state.doc.toString();
    this.diffEngine.acceptHunk(hunkIndex, currentContent);
    this.refreshDecorations();
  }

  private handleReject(hunkIndex: number): void {
    this.diffEngine.rejectHunk(hunkIndex);
    this.refreshDecorations();
  }

  private showRevisePopover(hunkIndex: number): void {
    this.popoverForHunk = hunkIndex;
    this.refreshDecorations();
  }

  private handleSubmitRevise(hunkIndex: number, feedback: string): void {
    this.popoverForHunk = null;
    this.diffEngine.reviseHunk(hunkIndex, feedback);
    this.refreshDecorations();
  }

  private handleDismissRevise(): void {
    this.popoverForHunk = null;
    this.refreshDecorations();
  }
}
