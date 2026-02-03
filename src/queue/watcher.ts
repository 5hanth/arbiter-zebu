/**
 * Queue Watcher - Monitor queue directory for changes using native fs
 */

import { watch, readdirSync, statSync } from 'fs';
import { EventEmitter } from 'events';
import { join } from 'path';

export type WatcherEvent = 'plan:added' | 'plan:updated' | 'plan:removed';

export interface WatcherEventPayload {
  event: WatcherEvent;
  filePath: string;
  fileName: string;
}

/**
 * Queue directory watcher using fs.watch + polling fallback
 */
export class QueueWatcher extends EventEmitter {
  private watchDir: string;
  private knownFiles: Map<string, number> = new Map(); // filename -> mtime
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private fsWatcher: ReturnType<typeof watch> | null = null;
  private isReady = false;

  constructor(watchDir: string) {
    super();
    this.watchDir = watchDir;
  }

  /**
   * Start watching the queue directory
   */
  async start(): Promise<void> {
    // Initial scan
    this.scanDirectory();

    // Try native fs.watch for instant detection
    try {
      this.fsWatcher = watch(this.watchDir, (_eventType, filename) => {
        if (filename && filename.endsWith('.md')) {
          // Debounce: wait briefly for writes to finish
          setTimeout(() => this.scanDirectory(), 300);
        }
      });
    } catch {
      console.log('[Watcher] fs.watch unavailable, using polling only');
    }

    // Also poll every 2 seconds as a reliable fallback
    this.pollInterval = setInterval(() => this.scanDirectory(), 2000);

    this.isReady = true;
    this.emit('ready');
    console.log('[Watcher] Ready, watching:', this.watchDir);
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    this.isReady = false;
    console.log('[Watcher] Stopped');
  }

  /**
   * Check if watcher is ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Scan directory and emit events for changes
   */
  private scanDirectory(): void {
    let currentFiles: Map<string, number>;
    
    try {
      const entries = readdirSync(this.watchDir);
      currentFiles = new Map();
      
      for (const entry of entries) {
        if (!this.isValidMdFile(entry)) continue;
        
        const filePath = join(this.watchDir, entry);
        try {
          const stat = statSync(filePath);
          currentFiles.set(entry, stat.mtimeMs);
        } catch {
          // File might have been deleted between readdir and stat
          continue;
        }
      }
    } catch {
      return; // Directory might not exist yet
    }

    // Check for new or updated files
    for (const [fileName, mtime] of currentFiles) {
      const filePath = join(this.watchDir, fileName);
      const knownMtime = this.knownFiles.get(fileName);
      
      if (knownMtime === undefined) {
        // New file
        const payload: WatcherEventPayload = {
          event: 'plan:added',
          filePath,
          fileName,
        };
        console.log('[Watcher] Plan added:', fileName);
        this.emit('plan:added', payload);
        this.emit('change', payload);
      } else if (mtime !== knownMtime) {
        // Updated file
        const payload: WatcherEventPayload = {
          event: 'plan:updated',
          filePath,
          fileName,
        };
        this.emit('plan:updated', payload);
        this.emit('change', payload);
      }
    }

    // Check for removed files
    for (const [fileName] of this.knownFiles) {
      if (!currentFiles.has(fileName)) {
        const filePath = join(this.watchDir, fileName);
        const payload: WatcherEventPayload = {
          event: 'plan:removed',
          filePath,
          fileName,
        };
        this.emit('plan:removed', payload);
        this.emit('change', payload);
      }
    }

    // Update known files
    this.knownFiles = currentFiles;
  }

  private isValidMdFile(fileName: string): boolean {
    return (
      fileName.endsWith('.md') &&
      !fileName.startsWith('.') &&
      !fileName.includes('.tmp-')
    );
  }
}

/**
 * Create and start a watcher for the queue directory
 */
export function createWatcher(watchDir: string): QueueWatcher {
  return new QueueWatcher(watchDir);
}
