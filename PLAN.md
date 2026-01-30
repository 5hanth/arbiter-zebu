# Arbiter Zebu — Execution Plan

## Project Overview

| Item | Value |
|------|-------|
| **Project** | Arbiter Zebu |
| **Repos** | `5hanth/arbiter-zebu`, `5hanth/arbiter-skill` |
| **Visibility** | Private |
| **Est. Effort** | 8-10 hours |
| **Target** | Fully functional bot + skill |

## Deliverables

1. **arbiter-zebu** — Standalone Telegram bot
   - Queue management (read/write MD files)
   - Telegram UI (inline buttons)
   - Callback handling (no LLM)
   - Notification system

2. **arbiter-skill** — Clawdbot skill
   - `arbiter_push` tool
   - `arbiter_status` tool
   - `arbiter_get` tool
   - SKILL.md documentation

## Phase Breakdown

### Phase 1: Project Scaffolding (1h)
**Assignee:** SWE1

- [ ] Initialize arbiter-zebu with TypeScript + Telegraf
- [ ] Set up package.json, tsconfig, eslint
- [ ] Create directory structure
- [ ] Initialize arbiter-skill with SKILL.md template
- [ ] Push initial scaffolding to both repos

**Files:**
```
arbiter-zebu/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── src/
│   ├── index.ts
│   ├── config.ts
│   └── types.ts
└── README.md

arbiter-skill/
├── SKILL.md
├── scripts/
│   └── push.sh (placeholder)
└── README.md
```

### Phase 2: Queue System (2h)
**Assignee:** SWE2

- [ ] Implement MD file parser (frontmatter + decisions)
- [ ] Implement file watcher for pending/
- [ ] Implement decision file writer (update answers)
- [ ] Implement file mover (pending → completed)
- [ ] Write unit tests for parser

**Files:**
```
src/
├── queue/
│   ├── parser.ts      # Parse MD files
│   ├── watcher.ts     # Watch pending/
│   ├── writer.ts      # Update decision files
│   └── index.ts
└── types.ts           # DecisionFile, Decision types
```

### Phase 3: Telegram Bot Core (2h)
**Assignee:** SWE3

- [ ] Set up Telegraf bot with token from config
- [ ] Implement /start command
- [ ] Implement /queue command (list pending)
- [ ] Implement authorization check (allowedUsers)
- [ ] Add error handling middleware

**Files:**
```
src/
├── bot/
│   ├── index.ts       # Bot setup
│   ├── commands.ts    # /start, /queue
│   ├── auth.ts        # User authorization
│   └── middleware.ts  # Error handling
└── config.ts          # Load config.json
```

### Phase 4: Decision UI (2h)
**Assignee:** SWE3

- [ ] Implement plan list view (inline keyboard)
- [ ] Implement plan detail view
- [ ] Implement decision view with option buttons
- [ ] Implement custom answer flow (wait for text)
- [ ] Implement progress display

**Files:**
```
src/
├── bot/
│   ├── views/
│   │   ├── queue.ts       # Queue list view
│   │   ├── plan.ts        # Plan detail view
│   │   └── decision.ts    # Decision buttons
│   └── keyboards.ts       # Inline keyboard builders
```

### Phase 5: Callback Handling (1.5h)
**Assignee:** SWE4

- [ ] Implement callback router (parse callback data)
- [ ] Implement answer recording (update file)
- [ ] Implement message editing (show result)
- [ ] Implement auto-advance to next decision
- [ ] Implement plan completion flow

**Files:**
```
src/
├── bot/
│   ├── callbacks/
│   │   ├── router.ts      # Parse and route callbacks
│   │   ├── answer.ts      # Record answer
│   │   └── navigation.ts  # Open, start, skip
```

### Phase 6: Notification System (1h)
**Assignee:** SWE4

- [ ] Implement notification file writer
- [ ] Write notification on plan completion
- [ ] Clean up old notifications (optional)
- [ ] Log all decisions for audit

**Files:**
```
src/
├── notifications/
│   ├── writer.ts      # Write notify/*.md
│   └── cleanup.ts     # Remove old notifications
└── logs/
    └── logger.ts      # Audit logging
```

### Phase 7: Arbiter Skill (1.5h)
**Assignee:** SWE1

- [ ] Write SKILL.md with full documentation
- [ ] Implement arbiter_push script/tool
- [ ] Implement arbiter_status script/tool
- [ ] Implement arbiter_get script/tool
- [ ] Test skill with local arbiter-zebu

**Files:**
```
arbiter-skill/
├── SKILL.md
├── scripts/
│   ├── push.ts
│   ├── status.ts
│   └── get.ts
└── templates/
    └── decision.md    # Template for new plans
```

### Phase 8: Integration & Testing (1h)
**Assignee:** CEO (coordination) + All SWEs

- [ ] End-to-end test: push → review → answer → notify
- [ ] Test error cases (malformed files, missing plans)
- [ ] Test bot restart recovery
- [ ] Document setup instructions in README
- [ ] Create example decision files

## Agent Assignments

| Phase | Agent | Est. Time | Dependencies |
|-------|-------|-----------|--------------|
| 1 | SWE1 | 1h | None |
| 2 | SWE2 | 2h | Phase 1 |
| 3 | SWE3 | 2h | Phase 1 |
| 4 | SWE3 | 2h | Phase 3 |
| 5 | SWE4 | 1.5h | Phase 2, 4 |
| 6 | SWE4 | 1h | Phase 5 |
| 7 | SWE1 | 1.5h | Phase 2 |
| 8 | All | 1h | All phases |

**Parallel tracks:**
- Track A: SWE1 (scaffold) → SWE1 (skill)
- Track B: SWE2 (queue system)
- Track C: SWE3 (bot core → UI)
- Track D: SWE4 (callbacks → notifications) — starts after SWE2/SWE3

## Branch Strategy

```
main                    # Protected, PR only
├── feature/scaffold    # SWE1 - Phase 1
├── feature/queue       # SWE2 - Phase 2
├── feature/bot-core    # SWE3 - Phase 3
├── feature/bot-ui      # SWE3 - Phase 4
├── feature/callbacks   # SWE4 - Phase 5, 6
└── feature/skill       # SWE1 - Phase 7 (arbiter-skill repo)
```

## Definition of Done

### Bot (arbiter-zebu)
- [ ] Bot starts and connects to Telegram
- [ ] /queue shows pending decision files
- [ ] Can open a plan and see decisions
- [ ] Can answer decisions via buttons
- [ ] Answers are saved to MD file
- [ ] Completed plans move to completed/
- [ ] Notifications written for agents
- [ ] Bot recovers state on restart
- [ ] README has setup instructions

### Skill (arbiter-skill)
- [ ] SKILL.md documents all tools
- [ ] arbiter_push creates valid MD files
- [ ] arbiter_status returns correct counts
- [ ] arbiter_get returns answers
- [ ] Works with Clawdbot agents

## Success Metrics

1. **Zero LLM cost** for button interactions
2. **< 500ms** response time for button taps
3. **100% state recovery** on restart
4. **Clear audit trail** in completed/ directory

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| File conflicts (agent + bot write) | Use atomic writes, file locking |
| Telegram rate limits | Implement backoff, batch edits |
| Large queue (100+ plans) | Pagination in queue view |
| Bot token exposure | Keep in config.json, gitignore |

## Timeline

Assuming parallel execution:

| Day | Milestone |
|-----|-----------|
| Day 1 | Phases 1-3 complete (scaffold, queue, bot core) |
| Day 2 | Phases 4-6 complete (UI, callbacks, notifications) |
| Day 3 | Phase 7-8 complete (skill, integration) |

**Target: Fully functional in 2-3 days**
