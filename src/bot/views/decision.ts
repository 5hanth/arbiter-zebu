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

  // Show options preview
  if (decision.options.length > 0) {
    const optionList = decision.options
      .map(opt => `• \`${opt}\``)
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
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}
