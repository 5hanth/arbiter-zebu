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
  
  const lines: string[] = [
    `🔸 *Decision ${progress}: ${escapeMarkdown(decision.id)}*`,
    '',
  ];

  // Add context
  if (decision.context) {
    lines.push(escapeMarkdown(decision.context));
    lines.push('');
  }

  // Show options with letter labels (A, B, C, ...)
  if (decision.options.length > 0) {
    lines.push('*Options:*');
    const optionList = decision.options
      .map((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, ...
        const isSelected = decision.answer === opt;
        const prefix = isSelected ? `✓ ${letter}` : letter;
        return `${prefix}. ${opt}`;
      })
      .join('\n');
    lines.push(optionList);
  }

  if (decision.allowCustom) {
    lines.push('');
    lines.push('_Custom answers allowed_');
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
  const lines: string[] = [
    `✅ *${escapeMarkdown(decision.id)}* → \`${answer}\``,
    '',
  ];

  // Check if there are more decisions
  const nextDecision = plan.decisions.find((d, i) => i > decisionIndex && d.status === 'pending');
  
  if (nextDecision) {
    const nextIndex = plan.decisions.indexOf(nextDecision);
    lines.push(`_Moving to decision ${nextIndex + 1}..._`);
  } else {
    lines.push('_All decisions complete!_');
  }

  return lines.join('\n');
}

/**
 * Build completion view when all decisions are answered
 */
export function buildCompletionView(plan: DecisionFile): string {
  const { frontmatter, decisions } = plan;
  
  const lines: string[] = [
    `✅ *${escapeMarkdown(frontmatter.title)} — Complete!*`,
    '',
    '*Answers:*',
  ];

  for (const decision of decisions) {
    if (decision.answer) {
      lines.push(`• ${decision.id} → \`${decision.answer}\``);
    } else {
      lines.push(`• ${decision.id} → _(skipped)_`);
    }
  }

  if (frontmatter.notifySession) {
    lines.push('');
    lines.push(`_Notifying: ${frontmatter.notifySession}_`);
  }

  return lines.join('\n');
}

/**
 * Build custom input prompt view
 */
export function buildCustomInputView(_plan: DecisionFile, decision: Decision): string {
  return [
    `✏️ *Custom Answer for: ${escapeMarkdown(decision.id)}*`,
    '',
    'Reply with your custom answer.',
    '',
    '_Type your answer and send it as a message._',
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
    `📋 *Review: ${escapeMarkdown(frontmatter.title)}*`,
    '',
    `_${answeredCount} answered${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${pendingCount > 0 ? `, ${pendingCount} pending` : ''}_`,
    '',
  ];

  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i];
    const num = i + 1;
    
    if (decision.answer === '__skipped__') {
      lines.push(`${num}. ${decision.id} → _(skipped)_`);
    } else if (decision.answer) {
      lines.push(`${num}. ${decision.id} → \`${decision.answer}\``);
    } else {
      lines.push(`${num}. ${decision.id} → ⚠️ _unanswered_`);
    }
  }

  lines.push('');
  lines.push('_Tap a decision to change it, or submit when ready._');

  return lines.join('\n');
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
