# Arbiter Zebu — Architecture

## Overview

Arbiter Zebu is a standalone Telegram bot for async human-in-the-loop decision making. It enables AI agents to push batched decisions for human review, and humans to answer via buttons without triggering LLM processing.

## Problem Statement

In agentic workflows, agents frequently need human decisions:
- Plan approvals before implementation
- Architectural choices with tradeoffs
- Blocking questions that require human judgment

**Current pain points:**
1. Every Telegram button tap triggers a full LLM pass (~$0.02-0.10 each)
2. Decisions are scattered across chat history
3. No audit trail of what was decided and when
4. Agents can't efficiently batch related decisions

## Solution

A standalone bot that:
1. Reads decision requests from a queue directory (MD files)
2. Presents decisions to humans via Telegram inline buttons
3. Records answers by editing MD files directly (NO LLM)
4. Notifies agents when decisions are complete

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Agents    │────────▶│  Queue Directory │◀────────│ Arbiter Bot │
│ (Clawdbot)  │  write  │   ~/.arbiter/    │  r/w    │ (Telegram)  │
└─────────────┘         └──────────────────┘         └─────────────┘
      │                          │                          │
      │ arbiter_push()           │                          │ buttons
      │ arbiter_get()            │                          │ no LLM
      ▼                          ▼                          ▼
  Skill Tool              MD Files (queue)           Human answers
```

## Components

### 1. Arbiter Bot (this repo)

Standalone Node.js Telegram bot using Telegraf.

**Responsibilities:**
- Watch `~/.arbiter/queue/pending/` for new decision files
- Present pending decisions via Telegram UI
- Handle button callbacks WITHOUT LLM (direct file updates)
- Move completed files to `completed/`
- Write notification files for agents

**Key design:**
- Zero LLM dependency
- File-based state (survives restarts)
- Single bot token, single user (owner only)

### 2. Arbiter Skill (separate repo)

Clawdbot skill that agents use to interact with Arbiter.

**Tools provided:**
- `arbiter_push()` — Create decision file in queue
- `arbiter_status()` — Check completion status
- `arbiter_get()` — Retrieve answers
- `arbiter_await()` — Block until answered (with timeout)

### 3. Queue Directory

```
~/.arbiter/
├── config.json              # Bot settings
├── queue/
│   ├── pending/             # Awaiting human review
│   │   └── {agent}-{slug}-{id}.md
│   ├── completed/           # Answered, archived
│   │   └── {agent}-{slug}-{id}.md
│   └── notify/              # Pending agent notifications
│       └── {session-hash}.md
└── logs/
    └── arbiter.log
```

## Decision File Format

```markdown
---
id: abc123
version: 1
agent: ceo
session: agent:ceo:main
tag: nft-marketplace
title: "API Design Decisions"
priority: normal           # low | normal | high | urgent
status: pending            # pending | in_progress | completed
created_at: 2026-01-30T01:30:00Z
updated_at: 2026-01-30T01:30:00Z
completed_at: null
total: 3
answered: 0
remaining: 3
notify_session: agent:swe2:main   # Optional: who to notify
---

# API Design Decisions

Context for the human reviewer.

---

## Decision 1: Auth Strategy

id: auth-strategy
status: pending
answer: null
answered_at: null

**Context:** How should we authenticate admin panel users?

**Options:**
- `jwt` — JWT tokens (stateless, scalable)
- `session` — Server sessions (more control)
- `oauth` — External OAuth provider

---

## Decision 2: Database

id: database
status: pending
answer: null
answered_at: null

**Context:** Primary datastore for NFT metadata.

**Options:**
- `postgresql` — With JSONB for flexibility
- `mongodb` — Document store

---

## Decision 3: Caching

id: caching
status: pending
answer: null
answered_at: null
allow_custom: true

**Context:** API response caching strategy.

**Options:**
- `redis` — In-memory cache
- `none` — No caching initially
- `cdn` — Edge caching only
```

## Bot User Interface

### Queue View

```
📋 **Arbiter — Decision Queue**

🔴 1 urgent | 🟡 2 normal

1. [nft-marketplace] API Design — 0/3
2. [clean-it] i18n Approach — 2/5

[1] [2] [Refresh 🔄]
```

### Plan View

```
📄 **API Design Decisions**
Tag: nft-marketplace | From: @ceo_zebu_bot
Progress: ░░░░░░░░░░ 0/3

[Start Review ▶️]
```

### Decision View

```
🔸 **Decision 1/3: Auth Strategy**

How should we authenticate admin panel users?

[JWT] [Session] [OAuth] [Custom ✏️] [Skip ⏭️]
```

### After Answer

```
✅ **Auth Strategy → JWT**

🔸 **Decision 2/3: Database**
...
```

### Completion

```
✅ **API Design Decisions — Complete!**

Answers:
• Auth Strategy → JWT
• Database → PostgreSQL
• Caching → Redis

Notifying: @swe2_zebu_bot
```

## Callback Data Format

```
action:planId:decisionId:value

Examples:
- open:abc123              # Open plan
- start:abc123             # Start review
- answer:abc123:auth:jwt   # Answer decision
- custom:abc123:auth       # Custom answer mode
- skip:abc123:auth         # Skip decision
- refresh                  # Refresh queue
```

## Notification Flow

When all decisions in a plan are answered:

1. Bot updates file: `status: completed`
2. Bot moves file to `completed/`
3. Bot writes notification:

```markdown
# ~/.arbiter/queue/notify/{session-hash}.md
---
plan_id: abc123
plan_title: "API Design Decisions"
agent: ceo
session: agent:ceo:main
notify_session: agent:swe2:main
completed_at: 2026-01-30T01:45:00Z
---

## Answers

- auth-strategy: jwt
- database: postgresql
- caching: redis
```

4. Agent reads notification on next heartbeat/poll
5. Agent deletes notification after processing

## Security

- **Single user:** Bot only responds to owner (allowlist by Telegram user ID)
- **File permissions:** Queue directory readable/writable by bot and agents
- **No secrets in queue:** Decision files contain no credentials

## Tech Stack

- **Runtime:** Node.js 20+
- **Telegram:** Telegraf v4
- **File format:** Markdown with YAML frontmatter
- **Parser:** gray-matter (frontmatter), marked (markdown)
- **Watcher:** chokidar (file system events)

## Configuration

```json
// ~/.arbiter/config.json
{
  "telegram": {
    "token": "BOT_TOKEN_HERE",
    "allowedUsers": [93533553]
  },
  "queue": {
    "dir": "~/.arbiter/queue",
    "watchInterval": 1000
  },
  "notifications": {
    "enabled": true
  }
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Malformed MD file | Log error, skip file, don't crash |
| Missing decision in file | Show error in Telegram, allow retry |
| File deleted mid-review | Show "Plan not found", return to queue |
| Bot restart | Rescan pending/, resume state |

## Future Enhancements

1. **Deep links:** `t.me/arbiter_zebu_bot?start=plan_abc123`
2. **Deadlines:** Auto-escalate if not answered in X hours
3. **Delegation:** Forward specific decisions to other users
4. **Analytics:** Decision time tracking, bottleneck detection
5. **Web UI:** Optional web interface for bulk decisions
