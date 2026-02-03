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

# Build TypeScript
npm run build

# Configure
cp config.example.json ~/.arbiter/config.json
# Edit config.json with your bot token and allowed user IDs

# Run
npm start
```

### Build

The project is written in TypeScript and must be compiled before running:

```bash
npm run build        # one-time compile (tsc)
npm run dev          # watch mode for development
```

Output goes to `dist/`.

### systemd User Service

To run as a persistent service:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/arbiter.service << 'EOF'
[Unit]
Description=Arbiter Zebu Telegram Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/repos/arbiter-zebu
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now arbiter.service
```

Check logs: `journalctl --user -u arbiter.service -f`

## Documentation

- [Architecture](./ARCHITECTURE.md) — System design
- [Execution Plan](./PLAN.md) — Development phases

## Usage with Clawdbot

Use the [arbiter-skill](https://github.com/5hanth/arbiter-skill) to push decisions from agents:

```bash
arbiter-push '{"title":"API Decisions","decisions":[...]}'
```

## License

Private — All rights reserved
