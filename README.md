# Arbiter Zebu

Standalone Telegram bot for async human-in-the-loop decision making. Zero LLM cost — button taps are handled directly.

## Quick Start

```bash
# Install
bun add -g arbiter-zebu

# Interactive setup (creates config + starts as service)
arbiter-zebu setup
```

That's it. The setup wizard will:
1. Ask for your **bot token** (from [@BotFather](https://t.me/BotFather))
2. Ask for your **Telegram user ID** (from [@userinfobot](https://t.me/userinfobot))
3. Create `~/.arbiter/config.json`
4. Install and start a **systemd service**

Send `/queue` to your bot in Telegram to verify.

## Commands

```bash
arbiter-zebu          # Start the bot
arbiter-zebu setup    # Interactive setup (config + systemd service)
arbiter-zebu help     # Show help
```

## Service Management

```bash
systemctl --user status arbiter     # Check status
systemctl --user stop arbiter       # Stop
systemctl --user restart arbiter    # Restart
tail -f /tmp/arbiter.log            # View logs
```

## Features

- 📋 **Queue-based decisions** — MD files in a watched directory
- 🔘 **Button-based UI** — Tap to answer, no typing needed
- 💰 **Zero LLM cost** — Callbacks handled directly by the bot
- 📁 **Persistent state** — File-based, survives restarts
- 🔔 **Agent notifications** — Notify sessions when decisions are complete
- ✏️ **Custom answers** — Not limited to predefined options
- 📝 **Audit trail** — All decisions logged in markdown

## How It Works

```
Agents push decisions → ~/.arbiter/queue/pending/
                              ↓
              Arbiter bot watches directory
                              ↓
              Shows decisions in Telegram with buttons
                              ↓
              Human answers by tapping
                              ↓
              Answers written back to markdown
                              ↓
              Completed plans → ~/.arbiter/queue/completed/
              Notifications  → ~/.arbiter/queue/notify/
```

## Agent Integration

Use the [arbiter-skill](https://github.com/5hanth/arbiter-skill) to push decisions from AI agents:

```bash
# Install the skill (for Clawdbot/OpenClaw)
clawhub install arbiter

# Or install standalone CLI
bun add -g arbiter-skill

# Push decisions
arbiter-push '{"title":"API Design","decisions":[{"id":"auth","title":"Auth Method","context":"How to authenticate","options":[{"key":"jwt","label":"JWT"},{"key":"session","label":"Sessions"}]}]}'
```

## Documentation

- [Architecture](./ARCHITECTURE.md) — System design and file formats
- [arbiter-skill](https://github.com/5hanth/arbiter-skill) — Agent-side CLI

## License

MIT
