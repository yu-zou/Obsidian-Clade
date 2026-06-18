import { AcpHunk, TrackedHunk, FileReview, EventHandler } from './types';
import { App } from 'obsidian';
import type { ACPClient } from './acp-client';
import * as fs from 'fs';
import * as path from 'path';

// --- Pure functions (testable in isolation) ---

export function parseHunks(rawHunks: AcpHunk[]): TrackedHunk[] {
  return rawHunks.map((hunk, index) => ({
    index,
    state: 'pending' as const,
    original: hunk,
  }));
}

export function applyHunk(content: string, hunk: AcpHunk, accepted: boolean): string {
  if (!accepted) return content;

  const lines = content.split('\n');
  const newLines: string[] = [];
  for (const line of hunk.lines) {
    if (line.startsWith('+') || line.startsWith(' ')) {
      newLines.push(line.slice(1));
    }
    // '-' lines are removed — skip
  }

  // For insertions (oldLines=0), insert after oldStart line
  // For replacements/deletions, replace starting at oldStart line
  const startIdx = hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart - 1;
  lines.splice(startIdx, hunk.oldLines, ...newLines);
  return lines.join('\n');
}

export function applyAcceptedHunks(content: string, hunks: TrackedHunk[]): string {
  const toApply = hunks
    .filter(h => h.state === 'accepted')
    .sort((a, b) => b.original.oldStart - a.original.oldStart);

  let result = content;
  for (const hunk of toApply) {
    result = applyHunk(result, hunk.original, true);
  }
  return result;
}

// --- DiffEngine class (orchestrates review workflow) ---

export class DiffEngine {
  private queue: FileReview[] = [];
  private currentReview: FileReview | null = null;
  private app: App;
  private acpClient: ACPClient;
  private vaultPath: string;
  private handlers = new Map<string, EventHandler<any>[]>();

  constructor(app: App, acpClient: ACPClient, vaultPath: string) {
    this.app = app;
    this.acpClient = acpClient;
    this.vaultPath = vaultPath;
  }

  on(event: string, handler: EventHandler<any>): void {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  private emit(event: string, data: any): void {
    for (const h of this.handlers.get(event) || []) h(data);
  }

  enqueue(filePath: string, hunks: AcpHunk[], toolCallId: string, originalContent: string): void {
    const review: FileReview = {
      path: filePath,
      hunks: parseHunks(hunks),
      toolCallId,
      originalContent,
    };

    if (this.currentReview) {
      this.queue.push(review);
    } else {
      this.currentReview = review;
    }

    this.emit('queue:updated', this.getQueueState());
  }

  acceptHunk(hunkIndex: number, currentContent: string): void {
    if (!this.currentReview) return;
    const hunk = this.currentReview.hunks[hunkIndex];
    if (!hunk) return;

    hunk.state = 'accepted';

    const merged = applyAcceptedHunks(currentContent, this.currentReview.hunks);
    this.writeToDisk(this.currentReview.path, merged);
    this.checkResolved();
  }

  rejectHunk(hunkIndex: number): void {
    if (!this.currentReview) return;
    const hunk = this.currentReview.hunks[hunkIndex];
    if (!hunk) return;

    hunk.state = 'rejected';
    this.checkResolved();
  }

  async reviseHunk(hunkIndex: number, feedback: string): Promise<void> {
    if (!this.currentReview) return;
    const hunk = this.currentReview.hunks[hunkIndex];
    if (!hunk) return;

    hunk.state = 'revised';

    // Flush accepted hunks to disk
    const filePath = path.join(this.vaultPath, this.currentReview.path);
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    const merged = applyAcceptedHunks(currentContent, this.currentReview.hunks);
    fs.writeFileSync(filePath, merged, 'utf-8');

    // Tell agent about updated file state
    await this.acpClient.attachResource({
      uri: `file://${this.currentReview.path}`,
      name: this.currentReview.path,
      mimeType: 'text/markdown',
      content: merged,
    });

    // Send revision request
    await this.acpClient.sendRevise(`${this.currentReview.toolCallId}:${hunkIndex}`, feedback);
  }

  private async checkResolved(): Promise<void> {
    if (!this.currentReview) return;

    const allResolved = this.currentReview.hunks.every(
      h => h.state === 'accepted' || h.state === 'rejected'
    );
    if (!allResolved) return;

    const filePath = path.join(this.vaultPath, this.currentReview.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    await this.acpClient.resolveToolCall(this.currentReview.toolCallId, { content });

    // Advance to next file
    this.currentReview = this.queue.shift() || null;
    this.emit('queue:updated', this.getQueueState());
  }

  private writeToDisk(relativePath: string, content: string): void {
    const fullPath = path.join(this.vaultPath, relativePath);
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  getCurrentFilePath(): string | null {
    return this.currentReview?.path || null;
  }

  getCurrentReview(): FileReview | null {
    return this.currentReview;
  }

  getQueueState(): { current: string | null; pending: string[] } {
    return {
      current: this.currentReview?.path || null,
      pending: this.queue.map(r => r.path),
    };
  }
}
