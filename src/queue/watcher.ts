/**
 * Queue Watcher - Monitor queue directory for changes
 */

import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { basename } from 'path';

export type WatcherEvent = 'plan:added' | 'plan:updated' | 'plan:removed';

export interface WatcherEventPayload {
  event: WatcherEvent;
  filePath: string;
  fileName: string;
}

/**
 * Queue directory watcher using chokidar
 */
export class QueueWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private watchDir: string;
  private isReady = false;

  constructor(watchDir: string) {
    super();
    this.watchDir = watchDir;
  }

  /**
   * Start watching the queue directory
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    // Watch the directory itself, not a glob pattern
    // Glob patterns like `dir/**/*.md` can miss files in the root directory
    
    this.watcher = watch(this.watchDir, {
      persistent: true,
      ignoreInitial: false, // Emit 'add' events for existing files on startup
      usePolling: true, // Polling is more reliable across install methods
      interval: 1000, // Check every second
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles (including .tmp-* files)
        /\.tmp-/, // Explicitly ignore temp files
      ],
      depth: 1, // Only watch immediate children (plans are not nested)
    });

    this.watcher
      .on('add', (filePath) => this.handleAdd(filePath))
      .on('change', (filePath) => this.handleChange(filePath))
      .on('unlink', (filePath) => this.handleRemove(filePath))
      .on('ready', () => {
        this.isReady = true;
        this.emit('ready');
        console.log('[Watcher] Ready, watching:', this.watchDir);
      })
      .on('error', (err) => {
        console.error('[Watcher] Error:', err);
        this.emit('error', err);
      });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.isReady = false;
      console.log('[Watcher] Stopped');
    }
  }

  /**
   * Check if watcher is ready
   */
  ready(): boolean {
    return this.isReady;
  }

  private handleAdd(filePath: string): void {
    if (!this.isValidMdFile(filePath)) return;
    
    const payload: WatcherEventPayload = {
      event: 'plan:added',
      filePath,
      fileName: basename(filePath),
    };
    
    console.log('[Watcher] Plan added:', basename(filePath));
    this.emit('plan:added', payload);
    this.emit('change', payload);
  }

  private handleChange(filePath: string): void {
    if (!this.isValidMdFile(filePath)) return;
    
    const payload: WatcherEventPayload = {
      event: 'plan:updated',
      filePath,
      fileName: basename(filePath),
    };
    
    this.emit('plan:updated', payload);
    this.emit('change', payload);
  }

  private handleRemove(filePath: string): void {
    if (!this.isValidMdFile(filePath)) return;
    
    const payload: WatcherEventPayload = {
      event: 'plan:removed',
      filePath,
      fileName: basename(filePath),
    };
    
    this.emit('plan:removed', payload);
    this.emit('change', payload);
  }

  private isValidMdFile(filePath: string): boolean {
    const fileName = basename(filePath);
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
