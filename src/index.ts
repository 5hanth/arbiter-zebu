#!/usr/bin/env node
/**
 * Arbiter Zebu - Main entry point
 * 
 * Standalone Telegram bot for async human-in-the-loop decision making.
 */

import { loadConfig } from './config.js';
import { createBot, startBot } from './bot/index.js';
import { createQueueManager } from './queue/index.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setup() {
  const home = homedir();
  const arbiterDir = join(home, '.arbiter');
  const configPath = join(home, '.arbiter', 'config.json');
  const queueDir = join(arbiterDir, 'queue');

  console.log('🐂 Arbiter Zebu — Setup\n');

  // 1. Create directories
  for (const dir of [arbiterDir, queueDir, join(queueDir, 'pending'), join(queueDir, 'completed'), join(queueDir, 'notify')]) {
    mkdirSync(dir, { recursive: true });
  }

  // 2. Config
  if (existsSync(configPath)) {
    console.log(`✅ Config exists: ${configPath}`);
    const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
    console.log(`   Token: ${existing.telegram?.token ? '***' + existing.telegram.token.slice(-6) : 'not set'}`);
    console.log(`   Users: ${existing.telegram?.allowedUsers?.join(', ') || 'none'}\n`);
  } else {
    console.log('📝 Creating config...\n');
    const token = await prompt('Bot token (from @BotFather): ');
    const userId = await prompt('Your Telegram user ID (from @userinfobot): ');

    const config = {
      telegram: {
        token,
        allowedUsers: [parseInt(userId, 10)]
      },
      queue: {
        dir: join(home, '.arbiter', 'queue')
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n✅ Config written: ${configPath}\n`);
  }

  // 3. Find the executable
  let execPath: string;
  try {
    execPath = execSync('which arbiter-zebu', { encoding: 'utf-8' }).trim();
  } catch {
    execPath = process.argv[1] || 'arbiter-zebu';
  }

  // 4. Systemd service
  const systemdDir = join(home, '.config', 'systemd', 'user');
  const servicePath = join(systemdDir, 'arbiter.service');
  
  mkdirSync(systemdDir, { recursive: true });
  
  const serviceContent = `[Unit]
Description=Arbiter Zebu Bot
After=network.target

[Service]
Type=simple
ExecStart=${execPath}
StandardOutput=append:/tmp/arbiter.log
StandardError=append:/tmp/arbiter.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
`;

  writeFileSync(servicePath, serviceContent);
  console.log(`✅ Systemd service: ${servicePath}`);

  // 5. Enable and start
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    execSync('systemctl --user enable --now arbiter', { stdio: 'inherit' });
    console.log('\n✅ Bot is running! Check status: systemctl --user status arbiter');
    console.log('📋 Logs: tail -f /tmp/arbiter.log');
    console.log('🛑 Stop: systemctl --user stop arbiter');
  } catch {
    console.log('\n⚠️  Could not start systemd service (no systemd?).');
    console.log('Run manually: arbiter-zebu');
  }

  console.log('\n🎉 Setup complete! Send /queue to your bot in Telegram.');
}

async function main() {
  // Handle subcommands
  const command = process.argv[2];

  if (command === 'setup') {
    await setup();
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
🐂 Arbiter Zebu — Async decision bot for Telegram

Usage:
  arbiter-zebu          Start the bot
  arbiter-zebu setup    Interactive setup (config + systemd service)
  arbiter-zebu help     Show this help

Quick start:
  1. arbiter-zebu setup
  2. Send /queue to your bot in Telegram

Docs: https://github.com/5hanth/arbiter-zebu
`);
    return;
  }

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
