/**
 * Queue view - Shows list of pending decision plans
 */

import type { DecisionFile, QueueStats, Priority } from '../../types.js';

/**
 * Priority emoji mapping
 */
const PRIORITY_EMOJI: Record<Priority, string> = {
  urgent: '🔴',
  high: '🟠',
  normal: '🟡',
  low: '🟢',
};

/**
 * Format queue statistics line
 */
function formatStats(stats: QueueStats): string {
  const parts: string[] = [];
  
  if (stats.urgent > 0) parts.push(`🔴 ${stats.urgent} urgent`);
  if (stats.high > 0) parts.push(`🟠 ${stats.high} high`);
  if (stats.normal > 0) parts.push(`🟡 ${stats.normal} normal`);
  if (stats.low > 0) parts.push(`🟢 ${stats.low} low`);
  
  return parts.length > 0 ? parts.join(' │ ') : 'No pending decisions';
}

/**
 * Escape markdown special characters for MarkdownV2
 */
function escapeMarkdown(text: string): string {
  // Split by inline code spans (backtick pairs)
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part) => {
    // Code spans start and end with backtick
    if (part.startsWith('`') && part.endsWith('`')) {
      // Inside code spans, only escape backslash and backtick
      const inner = part.slice(1, -1).replace(/[\\`]/g, '\\$&');
      return '`' + inner + '`';
    }
    // Regular text - escape all special characters
    return part.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }).join('');
}

/**
 * Format a single plan line
 */
function formatPlanLine(plan: DecisionFile, index: number): string {
  const emoji = PRIORITY_EMOJI[plan.frontmatter.priority] || '⚪';
  const tag = plan.frontmatter.tag ? `\\[${escapeMarkdown(plan.frontmatter.tag)}\\]` : '';
  const progress = `${plan.frontmatter.answered}/${plan.frontmatter.total}`;
  
  return `${index + 1}\\. ${emoji} ${tag} ${escapeMarkdown(plan.frontmatter.title)} — ${progress}`;
}

/**
 * Build the queue view message
 */
export function buildQueueView(plans: DecisionFile[], stats: QueueStats): string {
  const lines: string[] = [
    '📋 *Arbiter — Decision Queue*',
    '',
    formatStats(stats),
    '',
  ];

  if (plans.length === 0) {
    lines.push('_No pending decisions\\! 🎉_');
  } else {
    // Show up to 10 plans
    const displayPlans = plans.slice(0, 10);
    for (let i = 0; i < displayPlans.length; i++) {
      lines.push(formatPlanLine(displayPlans[i], i));
    }
    
    if (plans.length > 10) {
      lines.push(`_...and ${plans.length - 10} more_`);
    }
  }

  return lines.join('\n');
}

/**
 * Build empty queue message
 */
export function buildEmptyQueueView(): string {
  return [
    '📋 *Arbiter — Decision Queue*',
    '',
    '_No pending decisions\\!_ 🎉',
    '',
    'Agents can push decisions using the arbiter skill\\.',
  ].join('\n');
}
