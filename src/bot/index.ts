/**
 * Telegram bot setup and initialization
 * 
 * This module sets up the Telegraf bot with:
 * - Command handlers (/start, /queue)
 * - Callback query handlers (button presses)
 * - Authorization middleware
 * - Error handling
 */

import { Telegraf } from 'telegraf';
import type { ArbiterConfig } from '../types.js';

/**
 * Create and configure the Telegraf bot
 * @param config - Arbiter configuration
 * @returns Configured Telegraf bot instance
 */
export function createBot(config: ArbiterConfig): Telegraf {
  const bot = new Telegraf(config.telegram.token);

  // Authorization middleware - only allow configured users
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !config.telegram.allowedUsers.includes(userId)) {
      console.log(`Unauthorized access attempt from user: ${userId}`);
      await ctx.reply('⛔ Unauthorized. This bot is private.');
      return;
    }
    return next();
  });

  // Error handling middleware
  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ An error occurred. Please try again.').catch(console.error);
  });

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 **Welcome to Arbiter Zebu!**\n\n' +
      'I help you make decisions for your AI agents.\n\n' +
      'Commands:\n' +
      '/queue — View pending decisions\n' +
      '/help — Show this message',
      { parse_mode: 'Markdown' }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📚 **Arbiter Zebu Help**\n\n' +
      '**Commands:**\n' +
      '/queue — View pending decision queue\n' +
      '/help — Show this help message\n\n' +
      '**How it works:**\n' +
      '1. Agents push decisions to the queue\n' +
      '2. You review and answer via buttons\n' +
      '3. Agents receive your decisions\n\n' +
      'No AI processing — your button taps are instant! ⚡',
      { parse_mode: 'Markdown' }
    );
  });

  // /queue command - placeholder
  bot.command('queue', async (ctx) => {
    await ctx.reply(
      '📋 **Decision Queue**\n\n' +
      '_Queue viewer coming soon..._',
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

/**
 * Start the bot
 */
export async function startBot(bot: Telegraf): Promise<void> {
  // Enable graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  console.log('🚀 Starting Arbiter Zebu bot...');
  await bot.launch();
  console.log('✅ Bot is running!');
}
