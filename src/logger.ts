import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private logFile: string;
  private maxLogSize = 5 * 1024 * 1024; // 5MB
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(vaultPath: string, logDir: string = '.clade/logs') {
    const logDirPath = path.join(vaultPath, logDir);
    
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDirPath)) {
      fs.mkdirSync(logDirPath, { recursive: true });
    }

    this.logFile = path.join(logDirPath, 'clade.log');
    
    // Rotate log if needed
    this.rotateIfNeeded();
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(a => 
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ') : '';
    
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}\n`;
    
    this.buffer.push(logLine);
    this.scheduleFlush();
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(logLine.trim());
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, 1000);
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    
    try {
      const content = this.buffer.join('');
      fs.appendFileSync(this.logFile, content, 'utf-8');
      this.buffer = [];
      
      // Rotate if file got too large
      this.rotateIfNeeded();
    } catch (err) {
      console.error('Failed to write log file:', err);
    } finally {
      this.flushTimer = null;
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFile)) return;
      
      const stats = fs.statSync(this.logFile);
      if (stats.size > this.maxLogSize) {
        const backupFile = this.logFile + '.old';
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        fs.renameSync(this.logFile, backupFile);
      }
    } catch (err) {
      console.error('Failed to rotate log file:', err);
    }
  }

  getLogPath(): string {
    return this.logFile;
  }

  getRecentLogs(lines: number = 100): string {
    try {
      if (!fs.existsSync(this.logFile)) {
        return 'No log file found.';
      }
      
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const allLines = content.split('\n').filter(l => l.trim());
      return allLines.slice(-lines).join('\n');
    } catch (err) {
      return `Failed to read log file: ${err}`;
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
    } catch (err) {
      console.error('Failed to clear log file:', err);
    }
  }
}
