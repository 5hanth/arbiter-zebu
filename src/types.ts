/**
 * Type definitions for Arbiter Zebu
 */

/**
 * Bot configuration loaded from ~/.arbiter/config.json
 */
export interface ArbiterConfig {
  telegram: {
    token: string;
    allowedUsers: number[];
  };
  queue: {
    dir: string;
    watchInterval?: number;
  };
  notifications?: {
    enabled: boolean;
  };
}

/**
 * Priority levels for decision plans
 */
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Status of a decision or plan
 */
export type Status = 'pending' | 'in_progress' | 'completed' | 'answered' | 'skipped';

/**
 * A single decision within a plan
 */
export interface Decision {
  id: string;
  status: Status;
  answer: string | null;
  answeredAt: string | null;
  context: string;
  options: string[];
  allowCustom?: boolean;
}

/**
 * Frontmatter metadata for a decision file
 */
export interface DecisionFileFrontmatter {
  id: string;
  version: number;
  agent: string;
  session: string;
  tag: string;
  title: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  total: number;
  answered: number;
  remaining: number;
  notifySession?: string;
}

/**
 * Complete decision file with frontmatter and decisions
 */
export interface DecisionFile {
  frontmatter: DecisionFileFrontmatter;
  context: string;
  decisions: Decision[];
  rawContent: string;
  filePath: string;
}

/**
 * Notification file written when a plan is completed
 */
export interface NotificationFile {
  planId: string;
  planTitle: string;
  agent: string;
  session: string;
  notifySession: string;
  completedAt: string;
  answers: Record<string, string>;
}

/**
 * Callback data format: action:planId:decisionId:value
 */
export interface CallbackData {
  action: 'open' | 'start' | 'answer' | 'custom' | 'skip' | 'refresh';
  planId?: string;
  decisionId?: string;
  value?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  urgent: number;
  high: number;
  normal: number;
  low: number;
  total: number;
}
