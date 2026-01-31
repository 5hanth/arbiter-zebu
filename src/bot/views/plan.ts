/**
 * Plan view - Shows a single plan with its decisions
 */

import type { DecisionFile, Priority } from '../../types.js';

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
 * Build progress bar
 */
function buildProgressBar(answered: number, total: number): string {
  const filled = Math.round((answered / total) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format decision status in plan view
 */
function formatDecisionStatus(decision: { id: string; status: string; answer: string | null }, index: number, escape: (s: string) => string): string {
  if (decision.answer) {
    return `✅ Decision ${index + 1}: ${escape(decision.id)} → _${escape(decision.answer)}_`;
  } else if (decision.status === 'pending') {
    return `⬜ Decision ${index + 1}: ${escape(decision.id)}`;
  } else {
    return `⏭️ Decision ${index + 1}: ${escape(decision.id)} _\\(skipped\\)_`;
  }
}

/**
 * Build the plan view message
 */
export function buildPlanView(plan: DecisionFile): string {
  const { frontmatter, decisions, context } = plan;
  const priorityEmoji = PRIORITY_EMOJI[frontmatter.priority] || '⚪';
  const progressBar = buildProgressBar(frontmatter.answered, frontmatter.total);
  
  const lines: string[] = [
    `📄 *${escapeMarkdown(frontmatter.title)}*`,
    '',
    `Tag: \`${frontmatter.tag || 'none'}\` │ From: ${escapeMarkdown(frontmatter.agent)}`,
    `Priority: ${priorityEmoji} ${frontmatter.priority}`,
    `Progress: ${progressBar} ${frontmatter.answered}/${frontmatter.total}`,
    '',
  ];

  // Add context if present
  if (context && context.trim()) {
    lines.push(`_${escapeMarkdown(context.slice(0, 200))}${context.length > 200 ? '\\.\\.\\.' : ''}_`);
    lines.push('');
  }

  // List decisions with status
  lines.push('*Decisions:*');
  for (let i = 0; i < decisions.length; i++) {
    lines.push(formatDecisionStatus(decisions[i], i, escapeMarkdown));
  }

  return lines.join('\n');
}

/**
 * Build plan not found message
 */
export function buildPlanNotFoundView(planId: string): string {
  return [
    '❌ *Plan Not Found*',
    '',
    `Could not find plan: \`${planId}\``,
    '',
    'It may have been completed or removed\\.',
  ].join('\n');
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
