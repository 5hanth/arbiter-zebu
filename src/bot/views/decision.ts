/**
 * Decision view - Shows a single decision with options
 */

import type { DecisionFile, Decision } from '../../types.js';

/**
 * Build the decision view message
 */
export function buildDecisionView(
  plan: DecisionFile, 
  decision: Decision,
  decisionIndex: number
): string {
  const { frontmatter } = plan;
  const progress = `${decisionIndex + 1}/${frontmatter.total}`;
  
  // Build header: "15/22 · Title" or "15/22" if no title
  const title = decision.title || decision.id;
  const header = `*${progress}* · ${escapeMarkdown(title)}`;
  
  const lines: string[] = [header, ''];

  // Add context/description
  if (decision.context) {
    lines.push(escapeMarkdown(decision.context));
    lines.push('');
  }

  // Show options with letter labels (A, B, C, ...)
  if (decision.options.length > 0) {
    const optionList = decision.options
      .map((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, ...
        const isSelected = decision.answer === opt.key;
        const suffix = isSelected ? ' ✓' : '';
        return `${letter}\\. ${escapeMarkdown(opt.label)}${suffix}`;
      })
      .join('\n');
    lines.push(optionList);
  }

  if (decision.allowCustom) {
    lines.push('');
    lines.push('_✏️ Custom answers allowed_');
  }

  return lines.join('\n');
}

/**
 * Build the "answered" confirmation view
 */
export function buildAnsweredView(
  plan: DecisionFile,
  decision: Decision,
  answer: string,
  decisionIndex: number
): string {
  const title = decision.title || decision.id;
  const lines: string[] = [
    `✅ *${escapeMarkdown(title)}* → \`${answer}\``,
    '',
  ];

  // Check if there are more decisions
  const nextDecision = plan.decisions.find((d, i) => i > decisionIndex && d.status === 'pending');
  
  if (nextDecision) {
    const nextIndex = plan.decisions.indexOf(nextDecision);
    lines.push(`_Next: ${nextIndex + 1}/${plan.frontmatter.total}\\.\\.\\._`);
  } else {
    lines.push('_All decisions complete\\!_');
  }

  return lines.join('\n');
}

/**
 * Build completion view when all decisions are answered
 */
export function buildCompletionView(plan: DecisionFile): string {
  const { frontmatter, decisions } = plan;
  
  const lines: string[] = [
    `✅ *${escapeMarkdown(frontmatter.title)}*`,
    '',
    '*Summary:*',
  ];

  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i];
    const label = decision.title || decision.id;
    if (decision.answer && decision.answer !== '__skipped__') {
      lines.push(`${i + 1}\\. ${escapeMarkdown(label)} → \`${decision.answer}\``);
    } else {
      lines.push(`${i + 1}\\. ${escapeMarkdown(label)} → _skipped_`);
    }
  }

  if (frontmatter.notifySession) {
    lines.push('');
    lines.push(`_Notifying: ${escapeMarkdown(frontmatter.notifySession)}_`);
  }

  return lines.join('\n');
}

/**
 * Build custom input prompt view
 */
export function buildCustomInputView(_plan: DecisionFile, decision: Decision): string {
  const title = decision.title || decision.id;
  return [
    `✏️ *${escapeMarkdown(title)}*`,
    '',
    '_Type your custom answer and send it\\._',
  ].join('\n');
}

/**
 * Build decision not found message
 */
export function buildDecisionNotFoundView(decisionId: string): string {
  return [
    '❌ *Decision Not Found*',
    '',
    `Could not find decision: \`${decisionId}\``,
  ].join('\n');
}

/**
 * Build review summary view - shown before final submission
 */
export function buildReviewSummaryView(plan: DecisionFile): string {
  const { frontmatter, decisions } = plan;
  
  const answeredCount = decisions.filter(d => d.answer && d.answer !== '__skipped__').length;
  const skippedCount = decisions.filter(d => d.answer === '__skipped__').length;
  const pendingCount = decisions.filter(d => !d.answer).length;
  
  const lines: string[] = [
    `📋 *${escapeMarkdown(frontmatter.title)}*`,
    '',
    `✅ ${answeredCount} answered${skippedCount > 0 ? ` · ⏭️ ${skippedCount} skipped` : ''}${pendingCount > 0 ? ` · ⚠️ ${pendingCount} pending` : ''}`,
    '',
    '_Tap to edit, or submit\\._',
  ];

  return lines.join('\n');
}

/**
 * Escape markdown special characters, preserving inline code spans
 */
function escapeMarkdown(text: string): string {
  // Split by inline code spans (backtick pairs)
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part) => {
    // Odd indices are code spans (captured groups)
    if (part.startsWith('`') && part.endsWith('`')) {
      // Inside code spans, only escape backslash and backtick
      const inner = part.slice(1, -1).replace(/[\\`]/g, '\\$&');
      return '`' + inner + '`';
    }
    // Regular text - escape all special characters
    return part.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }).join('');
}
