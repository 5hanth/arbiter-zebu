/**
 * Configuration loader for Arbiter Zebu
 * Loads config from ~/.arbiter/config.json
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ArbiterConfig } from './types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.arbiter', 'config.json');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ArbiterConfig> = {
  queue: {
    dir: join(homedir(), '.arbiter', 'queue'),
    watchInterval: 1000,
  },
  notifications: {
    enabled: true,
  },
};

/**
 * Load and validate Arbiter configuration
 * @param configPath - Path to config.json (defaults to ~/.arbiter/config.json)
 * @returns Validated configuration object
 * @throws Error if config file is missing or invalid
 */
export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): ArbiterConfig {
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\n` +
      `Create ~/.arbiter/config.json with your bot token and allowed users.\n` +
      `See config.example.json for reference.`
    );
  }

  let rawConfig: unknown;
  try {
    const content = readFileSync(configPath, 'utf-8');
    rawConfig = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse config file: ${configPath}\n${err}`);
  }

  const config = rawConfig as Partial<ArbiterConfig>;

  // Validate required fields
  if (!config.telegram?.token) {
    throw new Error('Config missing required field: telegram.token');
  }

  if (!Array.isArray(config.telegram.allowedUsers)) {
    throw new Error('Config missing required field: telegram.allowedUsers (array of user IDs)');
  }

  // Merge with defaults
  const merged: ArbiterConfig = {
    telegram: {
      token: config.telegram.token,
      allowedUsers: config.telegram.allowedUsers,
    },
    queue: {
      dir: config.queue?.dir ?? DEFAULT_CONFIG.queue!.dir,
      watchInterval: config.queue?.watchInterval ?? DEFAULT_CONFIG.queue!.watchInterval,
    },
    notifications: {
      enabled: config.notifications?.enabled ?? DEFAULT_CONFIG.notifications!.enabled,
    },
  };

  // Expand ~ in queue dir path
  if (merged.queue.dir.startsWith('~')) {
    merged.queue.dir = merged.queue.dir.replace('~', homedir());
  }

  return merged;
}

/**
 * Get the path to a queue subdirectory
 */
export function getQueuePath(config: ArbiterConfig, subdir: 'pending' | 'completed' | 'notify'): string {
  return join(config.queue.dir, subdir);
}
