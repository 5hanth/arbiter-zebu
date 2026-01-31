/**
 * Callback query handlers for Arbiter bot
 * 
 * Callback data format: action:planId:decisionId:value
 */

import type { Context, NarrowedContext } from 'telegraf';
import type { Update, CallbackQuery, Message } from 'telegraf/types';
import type { QueueManager } from '../queue/index.js';
import { sessionStore } from './session.js';
import {
  buildQueueView,
  buildEmptyQueueView,
  buildPlanView,
  buildPlanNotFoundView,
  buildDecisionView,
  buildCompletionView,
  buildCustomInputView,
  buildDecisionNotFoundView,
  buildReviewSummaryView,
} from './views/index.js';
import {
  buildQueueKeyboard,
  buildPlanKeyboard,
  buildDecisionKeyboard,
  buildCompletionKeyboard,
  buildCustomInputKeyboard,
  buildReviewSummaryKeyboard,
} from './keyboards.js';

type CallbackContext = NarrowedContext<Context<Update>, Update.CallbackQueryUpdate<CallbackQuery>>;

/**
 * Parse callback data string into components
 */
function parseCallbackData(data: string): {
  action: string;
  planId?: string;
  decisionId?: string;
  value?: string;
} {
  const parts = data.split(':');
  return {
    action: parts[0],
    planId: parts[1],
    decisionId: parts[2],
    value: parts[3],
  };
}

/**
 * Main callback router
 */
export function createCallbackRouter(queueManager: QueueManager) {
  return async (ctx: CallbackContext) => {
    // Check if this is a data callback (not a game callback)
    if (!('data' in ctx.callbackQuery)) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }
    
    const data = ctx.callbackQuery.data;
    if (!data) {
      await ctx.answerCbQuery('Invalid callback');
      return;
    }

    const { action, planId, decisionId, value } = parseCallbackData(data);

    try {
      switch (action) {
        case 'refresh':
        case 'queue':
          await handleQueueView(ctx, queueManager);
          break;

        case 'open':
          if (planId) {
            await handleOpenPlan(ctx, queueManager, planId);
          }
          break;

        case 'start':
          if (planId) {
            await handleStartReview(ctx, queueManager, planId);
          }
          break;

        case 'answer':
          if (planId && decisionId && value) {
            await handleAnswer(ctx, queueManager, planId, decisionId, value);
          }
          break;

        case 'skip':
          if (planId && decisionId) {
            await handleSkip(ctx, queueManager, planId, decisionId);
          }
          break;

        case 'custom':
          if (planId && decisionId) {
            await handleCustomPrompt(ctx, queueManager, planId, decisionId);
          }
          break;

        case 'prev':
          if (planId && decisionId) {
            const prevIndex = parseInt(decisionId, 10);
            await handleNavigate(ctx, queueManager, planId, prevIndex - 1);
          }
          break;

        case 'next':
          if (planId && decisionId) {
            const nextIdx = parseInt(decisionId, 10);
            await handleNavigate(ctx, queueManager, planId, nextIdx + 1);
          }
          break;

        case 'goto':
          if (planId && decisionId) {
            const gotoIndex = parseInt(decisionId, 10);
            await handleNavigate(ctx, queueManager, planId, gotoIndex);
          }
          break;

        case 'review':
          if (planId) {
            await handleReviewSummary(ctx, queueManager, planId);
          }
          break;

        case 'submit':
          if (planId) {
            await handleSubmit(ctx, queueManager, planId);
          }
          break;

        case 'noop':
          await ctx.answerCbQuery();
          break;

        default:
          await ctx.answerCbQuery('Unknown action');
      }
    } catch (err) {
      console.error('Callback error:', err);
      await ctx.answerCbQuery('Error processing request');
    }
  };
}

/**
 * Handle queue view (refresh or back to queue)
 */
async function handleQueueView(ctx: CallbackContext, queueManager: QueueManager) {
  await ctx.answerCbQuery();
  
  // Clear any pending custom input state
  const userId = ctx.from?.id;
  if (userId) {
    sessionStore.clearCustomInputState(userId);
  }
  
  const plans = queueManager.getPending();
  const stats = queueManager.getStats();

  if (plans.length === 0) {
    await ctx.editMessageText(buildEmptyQueueView(), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
  } else {
    await ctx.editMessageText(buildQueueView(plans, stats), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard(plans).reply_markup,
    });
  }
}

/**
 * Handle opening a plan
 */
async function handleOpenPlan(ctx: CallbackContext, queueManager: QueueManager, planId: string) {
  await ctx.answerCbQuery();
  
  const plan = queueManager.getPlan(planId);
  
  if (!plan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  await ctx.editMessageText(buildPlanView(plan), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildPlanKeyboard(plan).reply_markup,
  });
}

/**
 * Handle starting review (show first pending decision)
 */
async function handleStartReview(ctx: CallbackContext, queueManager: QueueManager, planId: string) {
  await ctx.answerCbQuery();
  
  // Clear any pending custom input state (e.g., if user pressed Cancel)
  const userId = ctx.from?.id;
  if (userId) {
    sessionStore.clearCustomInputState(userId);
  }
  
  const plan = queueManager.getPlan(planId);
  
  if (!plan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  // Find first pending decision
  const decisionIndex = plan.decisions.findIndex(d => d.status === 'pending');
  
  if (decisionIndex === -1) {
    // All decisions answered - show completion
    await ctx.editMessageText(buildCompletionView(plan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildCompletionKeyboard().reply_markup,
    });
    return;
  }

  const decision = plan.decisions[decisionIndex];
  
  await ctx.editMessageText(buildDecisionView(plan, decision, decisionIndex), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildDecisionKeyboard(plan, decision, decisionIndex).reply_markup,
  });
}

/**
 * Handle answering a decision
 */
async function handleAnswer(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string,
  decisionId: string,
  value: string
) {
  await ctx.answerCbQuery(`Answered: ${value}`);
  
  // Update the decision
  const updatedPlan = await queueManager.answerDecision(planId, decisionId, value);
  
  if (!updatedPlan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  // Find the decision that was just answered
  const answeredIndex = updatedPlan.decisions.findIndex(d => d.id === decisionId);

  // Check if all decisions are answered (status: ready) - show review summary
  if (updatedPlan.frontmatter.status === 'ready') {
    await ctx.editMessageText(buildReviewSummaryView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
    });
    return;
  }

  // Check if plan was already completed (edge case)
  if (updatedPlan.frontmatter.status === 'completed') {
    await ctx.editMessageText(buildCompletionView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildCompletionKeyboard().reply_markup,
    });
    return;
  }

  // Find next pending decision
  const nextIndex = updatedPlan.decisions.findIndex((d, i) => i > answeredIndex && d.status === 'pending');
  
  if (nextIndex === -1) {
    // No more pending decisions - show review summary
    await ctx.editMessageText(buildReviewSummaryView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
    });
    return;
  }

  const nextDecision = updatedPlan.decisions[nextIndex];
  
  // Show brief confirmation then next decision
  await ctx.editMessageText(buildDecisionView(updatedPlan, nextDecision, nextIndex), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildDecisionKeyboard(updatedPlan, nextDecision, nextIndex).reply_markup,
  });
}

/**
 * Handle skipping a decision
 */
async function handleSkip(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string,
  decisionId: string
) {
  await ctx.answerCbQuery('Skipped');
  
  const updatedPlan = await queueManager.skipDecision(planId, decisionId);
  
  if (!updatedPlan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  // Check if all decisions are answered (status: ready) - show review summary
  if (updatedPlan.frontmatter.status === 'ready') {
    await ctx.editMessageText(buildReviewSummaryView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
    });
    return;
  }

  // Check if plan was already completed (edge case)
  if (updatedPlan.frontmatter.status === 'completed') {
    await ctx.editMessageText(buildCompletionView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildCompletionKeyboard().reply_markup,
    });
    return;
  }

  // Find next pending decision
  const skippedIndex = updatedPlan.decisions.findIndex(d => d.id === decisionId);
  const nextIndex = updatedPlan.decisions.findIndex((d, i) => i > skippedIndex && d.status === 'pending');
  
  if (nextIndex === -1) {
    // No more pending - show review summary
    await ctx.editMessageText(buildReviewSummaryView(updatedPlan), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
    });
    return;
  }

  const nextDecision = updatedPlan.decisions[nextIndex];
  
  await ctx.editMessageText(buildDecisionView(updatedPlan, nextDecision, nextIndex), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildDecisionKeyboard(updatedPlan, nextDecision, nextIndex).reply_markup,
  });
}

/**
 * Handle navigation between decisions (prev/next)
 */
async function handleNavigate(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string,
  targetIndex: number
) {
  await ctx.answerCbQuery();
  
  const plan = queueManager.getPlan(planId);
  
  if (!plan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  // Validate index bounds
  if (targetIndex < 0 || targetIndex >= plan.decisions.length) {
    await ctx.answerCbQuery('Invalid navigation');
    return;
  }

  const decision = plan.decisions[targetIndex];
  
  await ctx.editMessageText(buildDecisionView(plan, decision, targetIndex), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildDecisionKeyboard(plan, decision, targetIndex).reply_markup,
  });
}

/**
 * Handle review summary view
 */
async function handleReviewSummary(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string
) {
  await ctx.answerCbQuery();
  
  const plan = queueManager.getPlan(planId);
  
  if (!plan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  await ctx.editMessageText(buildReviewSummaryView(plan), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildReviewSummaryKeyboard(plan).reply_markup,
  });
}

/**
 * Handle final submission
 */
async function handleSubmit(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string
) {
  await ctx.answerCbQuery('Submitting...');
  
  const result = await queueManager.submitPlan(planId);
  
  if (!result) {
    await ctx.editMessageText(
      '❌ *Submission Failed*\n\nPlan not found or not ready for submission\\.',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: buildQueueKeyboard([]).reply_markup,
      }
    );
    return;
  }

  await ctx.editMessageText(buildCompletionView(result), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildCompletionKeyboard().reply_markup,
  });
}

/**
 * Handle custom answer prompt
 */
async function handleCustomPrompt(
  ctx: CallbackContext,
  queueManager: QueueManager,
  planId: string,
  decisionId: string
) {
  await ctx.answerCbQuery();
  
  const plan = queueManager.getPlan(planId);
  
  if (!plan) {
    await ctx.editMessageText(buildPlanNotFoundView(planId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildQueueKeyboard([]).reply_markup,
    });
    return;
  }

  const decision = plan.decisions.find(d => d.id === decisionId);
  
  if (!decision) {
    await ctx.editMessageText(buildDecisionNotFoundView(decisionId), {
      parse_mode: 'MarkdownV2',
      reply_markup: buildPlanKeyboard(plan).reply_markup,
    });
    return;
  }

  // Store session state for custom input handling
  const userId = ctx.from?.id;
  const messageId = ctx.callbackQuery.message?.message_id;
  
  if (userId && messageId) {
    sessionStore.setCustomInputState(userId, {
      planId,
      decisionId,
      messageId,
    });
  }

  await ctx.editMessageText(buildCustomInputView(plan, decision), {
    parse_mode: 'MarkdownV2',
    reply_markup: buildCustomInputKeyboard(planId, decisionId).reply_markup,
  });
}

/**
 * Handle custom text input from user
 * Called when user sends a text message while in custom input mode
 */
export async function handleCustomTextInput(
  ctx: Context,
  queueManager: QueueManager
): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  // Check if user is awaiting custom input
  const state = sessionStore.getCustomInputState(userId);
  if (!state) return false;

  // Get the message text
  const message = ctx.message as Message.TextMessage | undefined;
  if (!message || !('text' in message)) return false;

  const customAnswer = message.text.trim();
  if (!customAnswer) {
    await ctx.reply('❌ Please provide a non-empty answer.');
    return true;
  }

  // Clear session state
  sessionStore.clearCustomInputState(userId);

  // Process the answer
  const updatedPlan = await queueManager.answerDecision(
    state.planId,
    state.decisionId,
    customAnswer
  );

  if (!updatedPlan) {
    await ctx.reply('❌ Failed to save answer. Plan may have been removed.');
    return true;
  }

  // Delete the user's message (keep chat clean)
  try {
    await ctx.deleteMessage();
  } catch {
    // Ignore if can't delete (old message, etc.)
  }

  // Edit the original prompt message to show result
  try {
    // Check if all decisions are answered (status: ready) - show review summary
    if (updatedPlan.frontmatter.status === 'ready') {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        state.messageId,
        undefined,
        buildReviewSummaryView(updatedPlan),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
        }
      );
    } else if (updatedPlan.frontmatter.status === 'completed') {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        state.messageId,
        undefined,
        buildCompletionView(updatedPlan),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: buildCompletionKeyboard().reply_markup,
        }
      );
    } else {
      // Find next pending decision
      const answeredIndex = updatedPlan.decisions.findIndex(d => d.id === state.decisionId);
      const nextIndex = updatedPlan.decisions.findIndex(
        (d, i) => i > answeredIndex && d.status === 'pending'
      );

      if (nextIndex !== -1) {
        const nextDecision = updatedPlan.decisions[nextIndex];
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          state.messageId,
          undefined,
          buildDecisionView(updatedPlan, nextDecision, nextIndex),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: buildDecisionKeyboard(updatedPlan, nextDecision, nextIndex).reply_markup,
          }
        );
      } else {
        // All answered but status not updated yet - show review
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          state.messageId,
          undefined,
          buildReviewSummaryView(updatedPlan),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: buildReviewSummaryKeyboard(updatedPlan).reply_markup,
          }
        );
      }
    }
  } catch (err) {
    console.error('[Callbacks] Failed to edit message after custom input:', err);
    // Send a new message as fallback
    await ctx.reply(`✅ Answer recorded: \`${customAnswer}\``, { parse_mode: 'MarkdownV2' });
  }

  return true;
}
