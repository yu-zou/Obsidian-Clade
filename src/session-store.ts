import { Session, SessionSummary, AcpMessage, SessionContextEntry } from './types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export class SessionStore {
  private basePath: string;
  private currentSession: Session | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async create(): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      title: 'New Session',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messages: [],
      context: [],
    };
    await this.save(session);
    this.currentSession = session;
    return session;
  }

  async list(): Promise<SessionSummary[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.basePath);
    } catch {
      return [];
    }

    const sessions: SessionSummary[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.basePath, file), 'utf-8');
        const data = JSON.parse(raw) as Session;
        sessions.push({ id: data.id, title: data.title, lastActiveAt: data.lastActiveAt });
      } catch {
        // Skip corrupted files
      }
    }
    return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  async load(id: string): Promise<Session | null> {
    try {
      const raw = await fs.readFile(this.pathFor(id), 'utf-8');
      const session = JSON.parse(raw) as Session;
      this.currentSession = session;
      return session;
    } catch {
      return null;
    }
  }

  async rename(id: string, title: string): Promise<void> {
    const session = await this.load(id);
    if (!session) return;
    session.title = title;
    await this.save(session);
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(id));
    } catch {
      // File may not exist
    }
    if (this.currentSession?.id === id) {
      this.currentSession = null;
    }
  }

  getCurrent(): Session | null {
    return this.currentSession;
  }

  append(message: AcpMessage): void {
    if (!this.currentSession) return;
    this.currentSession.messages.push(message);
    this.currentSession.lastActiveAt = Date.now();
    this.markDirty();
  }

  appendContext(ctx: SessionContextEntry): void {
    if (!this.currentSession) return;
    this.currentSession.context.push(ctx);
    this.markDirty();
  }

  setTitle(title: string): void {
    if (!this.currentSession) return;
    this.currentSession.title = title;
    this.markDirty();
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.currentSession) return;
    await this.save(this.currentSession);
    this.dirty = false;
  }

  private markDirty(): void {
    this.dirty = true;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush().catch(() => {}); // Ignore errors in background flush
      }, 500);
    }
  }

  private async save(session: Session): Promise<void> {
    await fs.writeFile(this.pathFor(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  private pathFor(id: string): string {
    return path.join(this.basePath, `${id}.json`);
  }
}
