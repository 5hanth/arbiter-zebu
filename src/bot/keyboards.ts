/**
 * Inline keyboard builders for Arbiter bot
 */

import { Markup } from 'telegraf';
import type { DecisionFile, Decision } from '../types.js';

/**
 * Build queue keyboard with plan buttons and refresh
 */
export function buildQueueKeyboard(plans: DecisionFile[]) {
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [];

  // Plan buttons (up to 10 per row, max 5 rows)
  const planButtons = plans.slice(0, 20).map((plan, index) =>
    Markup.button.callback(`${index + 1}`, `open:${plan.frontmatter.id}`)
  );

  // Arrange in rows of 5
  for (let i = 0; i < planButtons.length; i += 5) {
    buttons.push(planButtons.slice(i, i + 5));
  }

  // Refresh button on its own row
  buttons.push([Markup.button.callback('🔄 Refresh', 'refresh')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build plan keyboard (Start Review / Back)
 */
export function buildPlanKeyboard(plan: DecisionFile) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  const planId = plan.frontmatter.id;
  
  // Decision number buttons (rows of 5)
  const decisionButtons: ReturnType<typeof Markup.button.callback>[] = [];
  for (let i = 0; i < plan.decisions.length; i++) {
    const d = plan.decisions[i];
    const num = i + 1;
    const hasAnswer = d.answer && d.answer !== '__skipped__';
    const label = hasAnswer ? `${num}✓` : `${num}`;
    decisionButtons.push(Markup.button.callback(label, `goto:${planId}:${i}`));
    
    // New row every 5 buttons
    if (decisionButtons.length === 5) {
      rows.push([...decisionButtons]);
      decisionButtons.length = 0;
    }
  }
  // Push remaining buttons
  if (decisionButtons.length > 0) {
    rows.push([...decisionButtons]);
  }
  
  // Action buttons row
  const actionButtons: ReturnType<typeof Markup.button.callback>[] = [];
  
  const nextPending = plan.decisions.find(d => d.status === 'pending');
  if (nextPending) {
    actionButtons.push(Markup.button.callback('▶️ Continue', `start:${planId}`));
  }
  
  if (plan.frontmatter.status === 'ready') {
    actionButtons.push(Markup.button.callback('📤 Submit', `submit:${planId}`));
  }
  
  actionButtons.push(Markup.button.callback('↩️ Back', 'queue'));
  rows.push(actionButtons);

  return Markup.inlineKeyboard(rows);
}

/**
 * Build decision keyboard with options and navigation
 */
export function buildDecisionKeyboard(
  plan: DecisionFile, 
  decision: Decision,
  decisionIndex: number
) {
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [];
  const planId = plan.frontmatter.id;
  const totalDecisions = plan.decisions.length;
  
  // Navigation row (prev/next)
  const navButtons: ReturnType<typeof Markup.button.callback>[] = [];
  if (decisionIndex > 0) {
    navButtons.push(
      Markup.button.callback('⬅️ Prev', `prev:${planId}:${decisionIndex}`)
    );
  }
  // Show current position
  navButtons.push(
    Markup.button.callback(`${decisionIndex + 1}/${totalDecisions}`, 'noop')
  );
  if (decisionIndex < totalDecisions - 1) {
    navButtons.push(
      Markup.button.callback('Next ➡️', `next:${planId}:${decisionIndex}`)
    );
  }
  buttons.push(navButtons);
  
  // Option buttons - show letter keys (A, B, C, ...)
  // Show checkmark on previously selected option
  const optionButtons = decision.options.map((option, i) => {
    const letter = String.fromCharCode(65 + i); // A, B, C, ...
    const isSelected = decision.answer === option.key;
    const buttonText = isSelected ? `✓ ${letter}` : letter;
    
    return Markup.button.callback(
      buttonText,
      `answer:${plan.frontmatter.id}:${decision.id}:${option.key}`
    );
  });

  // Arrange options in rows of 3
  for (let i = 0; i < optionButtons.length; i += 3) {
    buttons.push(optionButtons.slice(i, i + 3));
  }

  // Custom and Skip buttons
  const actionButtons = [];
  if (decision.allowCustom) {
    actionButtons.push(
      Markup.button.callback('✏️ Custom', `custom:${plan.frontmatter.id}:${decision.id}`)
    );
  }
  actionButtons.push(
    Markup.button.callback('⏭️ Skip', `skip:${plan.frontmatter.id}:${decision.id}`)
  );
  buttons.push(actionButtons);

  // Back button
  buttons.push([
    Markup.button.callback('↩️ Back to Plan', `open:${plan.frontmatter.id}`)
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build completion keyboard
 */
export function buildCompletionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Back to Queue', 'queue')]
  ]);
}

/**
 * Build "enter custom answer" keyboard
 */
export function buildCustomInputKeyboard(planId: string, _decisionId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', `start:${planId}`)]
  ]);
}

/**
 * Build review summary keyboard - decisions as buttons + submit
 */
export function buildReviewSummaryKeyboard(plan: DecisionFile) {
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [];
  const planId = plan.frontmatter.id;
  
  // Decision buttons - each navigates to that decision
  for (let i = 0; i < plan.decisions.length; i++) {
    const decision = plan.decisions[i];
    const num = i + 1;
    
    let label: string;
    if (decision.answer === '__skipped__') {
      label = `${num}. ${decision.id} (skipped)`;
    } else if (decision.answer) {
      label = `${num}. ${decision.id} → ${decision.answer}`;
    } else {
      label = `${num}. ${decision.id} ⚠️`;
    }
    
    // Truncate label if too long (Telegram button limit)
    if (label.length > 40) {
      label = label.slice(0, 37) + '...';
    }
    
    buttons.push([
      Markup.button.callback(label, `goto:${planId}:${i}`)
    ]);
  }
  
  // Submit button
  buttons.push([
    Markup.button.callback('✅ Submit Final', `submit:${planId}`)
  ]);
  
  // Back to plan
  buttons.push([
    Markup.button.callback('↩️ Back to Plan', `open:${planId}`)
  ]);

  return Markup.inlineKeyboard(buttons);
}
