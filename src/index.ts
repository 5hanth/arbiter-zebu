/**
 * Arbiter Zebu - Entry Point
 * 
 * Standalone Telegram bot for async human-in-the-loop decision making.
 * See ARCHITECTURE.md for full documentation.
 */

import { loadConfig } from './config.js';
import { createBot, startBot } from './bot/index.js';

async function main(): Promise<void> {
  console.log('🦓 Arbiter Zebu v0.1.0');
  console.log('━'.repeat(40));

  // Load configuration
  console.log('📁 Loading configuration...');
  const config = loadConfig();
  console.log(`   Queue dir: ${config.queue.dir}`);
  console.log(`   Allowed users: ${config.telegram.allowedUsers.length}`);

  // Create and start bot
  const bot = createBot(config);
  await startBot(bot);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
