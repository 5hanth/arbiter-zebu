#!/usr/bin/env node
/**
 * Arbiter Zebu - Main entry point
 * 
 * Standalone Telegram bot for async human-in-the-loop decision making.
 */

import { loadConfig } from './config.js';
import { createBot, startBot } from './bot/index.js';
import { createQueueManager } from './queue/index.js';

async function main() {
  console.log('🐂 Arbiter Zebu starting...');

  // Load configuration
  const config = loadConfig();
  console.log(`[Config] Loaded from ~/.arbiter/config.json`);
  console.log(`[Config] Queue directory: ${config.queue.dir}`);
  console.log(`[Config] Allowed users: ${config.telegram.allowedUsers.join(', ')}`);

  // Initialize queue manager
  const queueManager = createQueueManager(config.queue.dir);
  await queueManager.init();
  console.log(`[Queue] Initialized and watching for changes`);

  // Create and start bot
  const bot = createBot(config, queueManager);
  await startBot(bot);

  // Handle shutdown
  const shutdown = async () => {
    console.log('\n[Shutdown] Stopping...');
    await queueManager.stop();
    console.log('[Shutdown] Queue manager stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
