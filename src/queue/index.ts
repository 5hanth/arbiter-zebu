/**
 * Queue Manager - Main API for interacting with the decision queue
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { DecisionFile, QueueStats, Priority } from '../types.js';
import { parseDecisionFile, isValidDecisionFile } from './parser.js';
import { 
  updateDecision, 
  skipDecision, 
  completePlan, 
  writeNotification 
} from './writer.js';
import { QueueWatcher, type WatcherEventPayload } from './watcher.js';

export { parseDecisionFile, isValidDecisionFile } from './parser.js';
export { updateDecision, skipDecision, completePlan, writeNotification } from './writer.js';
export { QueueWatcher, createWatcher, type WatcherEventPayload } from './watcher.js';

/**
 * Queue Manager - Provides clean API for managing decision queue
 */
export class QueueManager {
  private pendingDir: string;
  private completedDir: string;
  private notifyDir: string;
  private cache: Map<string, DecisionFile> = new Map();
  private watcher: QueueWatcher | null = null;
  private initialized = false;

  constructor(queueDir: string) {
    this.pendingDir = join(queueDir, 'pending');
    this.completedDir = join(queueDir, 'completed');
    this.notifyDir = join(queueDir, 'notify');
  }

  /**
   * Initialize the queue manager and start watching
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Initial scan
    await this.refresh();

    // Start watching
    this.watcher = new QueueWatcher(this.pendingDir);
    
    this.watcher.on('plan:added', (payload: WatcherEventPayload) => {
      this.handleFileChange(payload.filePath);
    });
    
    this.watcher.on('plan:updated', (payload: WatcherEventPayload) => {
      this.handleFileChange(payload.filePath);
    });
    
    this.watcher.on('plan:removed', (payload: WatcherEventPayload) => {
      this.handleFileRemoved(payload.filePath);
    });

    await this.watcher.start();
    this.initialized = true;
  }

  /**
   * Stop the queue manager
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }
    this.cache.clear();
    this.initialized = false;
  }

  /**
   * Refresh the cache by scanning pending directory
   */
  async refresh(): Promise<void> {
    try {
      const files = await readdir(this.pendingDir).catch(() => []);
      const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

      // Clear old cache
      this.cache.clear();

      // Parse all files
      for (const fileName of mdFiles) {
        const filePath = join(this.pendingDir, fileName);
        await this.handleFileChange(filePath);
      }

      console.log(`[Queue] Loaded ${this.cache.size} pending plans`);
    } catch (err) {
      console.error('[Queue] Failed to refresh:', err);
    }
  }

  /**
   * Get all pending plans sorted by priority
   */
  getPending(): DecisionFile[] {
    const plans = Array.from(this.cache.values());
    
    // Sort by priority (urgent > high > normal > low)
    const priorityOrder: Record<Priority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    return plans.sort((a, b) => {
      const aPriority = priorityOrder[a.frontmatter.priority] ?? 2;
      const bPriority = priorityOrder[b.frontmatter.priority] ?? 2;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // Secondary sort by creation date (oldest first)
      return new Date(a.frontmatter.createdAt).getTime() - 
             new Date(b.frontmatter.createdAt).getTime();
    });
  }

  /**
   * Get a specific plan by ID
   */
  getPlan(planId: string): DecisionFile | null {
    for (const plan of this.cache.values()) {
      if (plan.frontmatter.id === planId) {
        return plan;
      }
    }
    return null;
  }

  /**
   * Get plans by tag
   */
  getByTag(tag: string): DecisionFile[] {
    return this.getPending().filter(p => p.frontmatter.tag === tag);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const plans = this.getPending();
    
    return {
      urgent: plans.filter(p => p.frontmatter.priority === 'urgent').length,
      high: plans.filter(p => p.frontmatter.priority === 'high').length,
      normal: plans.filter(p => p.frontmatter.priority === 'normal').length,
      low: plans.filter(p => p.frontmatter.priority === 'low').length,
      total: plans.length,
    };
  }

  /**
   * Answer a decision
   */
  async answerDecision(
    planId: string, 
    decisionId: string, 
    answer: string
  ): Promise<DecisionFile | null> {
    const plan = this.getPlan(planId);
    if (!plan) {
      console.error(`[Queue] Plan not found: ${planId}`);
      return null;
    }

    const updated = await updateDecision(plan.filePath, decisionId, answer);
    
    if (updated) {
      // Update cache
      this.cache.set(plan.filePath, updated);
      
      // Check if plan is complete
      if (updated.frontmatter.status === 'completed') {
        await this.handlePlanCompleted(updated);
      }
    }

    return updated;
  }

  /**
   * Skip a decision
   */
  async skipDecision(planId: string, decisionId: string): Promise<DecisionFile | null> {
    const plan = this.getPlan(planId);
    if (!plan) {
      console.error(`[Queue] Plan not found: ${planId}`);
      return null;
    }

    const updated = await skipDecision(plan.filePath, decisionId);
    
    if (updated) {
      this.cache.set(plan.filePath, updated);
      
      if (updated.frontmatter.status === 'completed') {
        await this.handlePlanCompleted(updated);
      }
    }

    return updated;
  }

  /**
   * Handle file change (added or updated)
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseDecisionFile(content, filePath);
      
      if (parsed && isValidDecisionFile(parsed)) {
        this.cache.set(filePath, parsed);
      } else {
        console.warn(`[Queue] Invalid or empty file: ${filePath}`);
      }
    } catch (err) {
      // File might have been deleted or moved
      this.cache.delete(filePath);
    }
  }

  /**
   * Handle file removed
   */
  private handleFileRemoved(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Handle plan completion - move to completed and write notification
   */
  private async handlePlanCompleted(plan: DecisionFile): Promise<void> {
    console.log(`[Queue] Plan completed: ${plan.frontmatter.id}`);

    // Move to completed directory
    await completePlan(plan.filePath, this.completedDir);
    
    // Remove from cache
    this.cache.delete(plan.filePath);

    // Write notification if notify_session is set
    if (plan.frontmatter.notifySession) {
      const answers: Record<string, string> = {};
      for (const decision of plan.decisions) {
        if (decision.answer) {
          answers[decision.id] = decision.answer;
        }
      }

      await writeNotification(
        this.notifyDir,
        plan.frontmatter.id,
        plan.frontmatter.title,
        plan.frontmatter.agent,
        plan.frontmatter.session,
        plan.frontmatter.notifySession,
        answers
      );

      console.log(`[Queue] Notification written for: ${plan.frontmatter.notifySession}`);
    }
  }

  /**
   * Get the watcher instance for external event handling
   */
  getWatcher(): QueueWatcher | null {
    return this.watcher;
  }
}

/**
 * Create a new queue manager instance
 */
export function createQueueManager(queueDir: string): QueueManager {
  return new QueueManager(queueDir);
}
