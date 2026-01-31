/**
 * Telegram bot setup and initialization
 * 
 * This module sets up the Telegraf bot with:
 * - Command handlers (/start, /queue, /help)
 * - Callback query handlers (button presses)
 * - Authorization middleware
 * - Error handling
 */

import { Telegraf } from 'telegraf';
import type { ArbiterConfig } from '../types.js';
import type { QueueManager } from '../queue/index.js';
import { buildQueueView, buildEmptyQueueView } from './views/index.js';
import { buildQueueKeyboard } from './keyboards.js';
import { createCallbackRouter, handleCustomTextInput } from './callbacks.js';

/**
 * Create and configure the Telegraf bot
 * @param config - Arbiter configuration
 * @param queueManager - Queue manager instance
 * @returns Configured Telegraf bot instance
 */
export function createBot(config: ArbiterConfig, queueManager: QueueManager): Telegraf {
  const bot = new Telegraf(config.telegram.token);

  // Authorization middleware - only allow configured users
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.telegram.allowedUsers.includes(userId)) {
      console.log(`[Bot] Unauthorized access attempt from user: ${userId}`);
      await ctx.reply('⛔ Unauthorized. This bot is private.');
      return;
    }
    return next();
  });

  // Error handling middleware
  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ An error occurred. Please try again.').catch(console.error);
  });

  // /start command
  bot.command('start', async (ctx) => {
    // Check for deep link parameter (e.g., /start plan_abc123)
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length > 0 && args[0].startsWith('plan_')) {
      const planId = args[0].slice(5);
      const plan = queueManager.getPlan(planId);
      
      if (plan) {
        const { buildPlanView } = await import('./views/index.js');
        const { buildPlanKeyboard } = await import('./keyboards.js');
        
        await ctx.reply(buildPlanView(plan), {
          parse_mode: 'MarkdownV2',
          reply_markup: buildPlanKeyboard(plan).reply_markup,
        });
        return;
      }
    }

    await ctx.reply(
      '👋 *Welcome to Arbiter Zebu\\!*\n\n' +
      'I help you make decisions for your AI agents\\.\n\n' +
      '*Commands:*\n' +
      '/queue — View pending decisions\n' +
      '/help — Show this message\n\n' +
      '_No AI processing — your button taps are instant\\! ⚡_',
      { parse_mode: 'MarkdownV2' }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📚 *Arbiter Zebu Help*\n\n' +
      '*Commands:*\n' +
      '/queue — View pending decision queue\n' +
      '/help — Show this help message\n\n' +
      '*How it works:*\n' +
      '1\\. Agents push decisions to the queue\n' +
      '2\\. You review and answer via buttons\n' +
      '3\\. Agents receive your decisions\n\n' +
      '_No AI processing — your button taps are instant\\! ⚡_',
      { parse_mode: 'MarkdownV2' }
    );
  });

  // /queue command - Show queue with inline keyboard
  bot.command('queue', async (ctx) => {
    const plans = queueManager.getPending();
    const stats = queueManager.getStats();

    if (plans.length === 0) {
      await ctx.reply(buildEmptyQueueView(), {
        parse_mode: 'MarkdownV2',
        reply_markup: buildQueueKeyboard([]).reply_markup,
      });
    } else {
      await ctx.reply(buildQueueView(plans, stats), {
        parse_mode: 'MarkdownV2',
        reply_markup: buildQueueKeyboard(plans).reply_markup,
      });
    }
  });

  // Text message handler (for custom input responses)
  bot.on('text', async (ctx, next) => {
    // Check if this is a custom input response
    const handled = await handleCustomTextInput(ctx, queueManager);
    if (!handled) {
      // Not a custom input - pass to next handler (if any)
      return next();
    }
  });

  // Callback query handler (button presses)
  bot.on('callback_query', createCallbackRouter(queueManager));

  return bot;
}

/**
 * Start the bot
 */
export async function startBot(bot: Telegraf): Promise<void> {
  // Enable graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  console.log('[Bot] Starting Arbiter Zebu...');
  await bot.launch({ dropPendingUpdates: true });
  console.log('[Bot] ✅ Bot is running!');
}
