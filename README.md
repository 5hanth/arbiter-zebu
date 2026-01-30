# Arbiter Zebu

Standalone Telegram bot for async human-in-the-loop decision making.

## What is this?

Arbiter Zebu enables AI agents to push batched decisions for human review. Humans answer via Telegram buttons **without triggering LLM processing** — saving costs and enabling efficient batch reviews.

## Features

- 📋 **Queue-based decisions** — MD files in a directory
- 🔘 **Button-based UI** — No typing, just tap
- 💰 **Zero LLM cost** — Callbacks handled directly
- 📁 **Persistent state** — Survives restarts
- 🔔 **Agent notifications** — File-based notification system
- 📝 **Audit trail** — All decisions logged

## Quick Start

```bash
# Install dependencies
npm install

# Configure
cp config.example.json ~/.arbiter/config.json
# Edit config.json with your bot token

# Run
npm start
```

## Documentation

- [Architecture](./ARCHITECTURE.md) — System design
- [Execution Plan](./PLAN.md) — Development phases

## Usage with Clawdbot

Use the [arbiter-skill](https://github.com/5hanth/arbiter-skill) to push decisions from agents:

```bash
arbiter_push --title "API Decisions" --decisions '[...]'
```

## License

Private — All rights reserved
