# Arbiter Zebu

Standalone Telegram bot for async human-in-the-loop decision making. Zero LLM cost — button taps are handled directly.

## Quick Start

**Run instantly:**
```bash
bunx arbiter-zebu
```

**Or install globally:**
```bash
bun add -g arbiter-zebu
arbiter-zebu
```

**Or clone and build:**
```bash
git clone https://github.com/5hanth/arbiter-zebu.git
cd arbiter-zebu
npm install && npm run build
npm start
```

### Configuration

Create `~/.arbiter/config.json`:
```json
{
  "telegram": {
    "token": "YOUR_BOT_TOKEN",
    "allowedUsers": [YOUR_TELEGRAM_USER_ID]
  },
  "queue": {
    "dir": "~/.arbiter/queue"
  }
}
```

Get your bot token from [@BotFather](https://t.me/BotFather). Get your user ID from [@userinfobot](https://t.me/userinfobot).

### Run as a service (systemd)

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/arbiter.service << EOF
[Unit]
Description=Arbiter Zebu Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(which node) dist/index.js
StandardOutput=append:/tmp/arbiter.log
StandardError=append:/tmp/arbiter.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now arbiter
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
# Install the skill
clawhub install arbiter
# or
bun add -g arbiter-skill

# Push decisions
arbiter-push '{"title":"API Design","tag":"my-project","notify":"agent:swe1:main","decisions":[{"id":"auth","title":"Auth Method","context":"How to authenticate users","options":[{"key":"jwt","label":"JWT tokens"},{"key":"session","label":"Server sessions"}]}]}'
```

## Documentation

- [Architecture](./ARCHITECTURE.md) — System design and file formats
- [arbiter-skill](https://github.com/5hanth/arbiter-skill) — Agent-side CLI

## License

MIT
