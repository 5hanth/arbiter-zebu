/**
 * Queue System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseDecisionFile, isValidDecisionFile } from '../src/queue/parser.js';
import { updateDecision, skipDecision, completePlan, writeNotification } from '../src/queue/writer.js';
import { QueueManager } from '../src/queue/index.js';

// Sample valid decision file content
const VALID_DECISION_FILE = `---
id: test-plan-123
version: 1
agent: test-agent
session: agent:test:main
tag: test-tag
title: Test Plan
priority: normal
status: pending
created_at: 2026-01-30T00:00:00Z
updated_at: 2026-01-30T00:00:00Z
completed_at: null
total: 2
answered: 0
remaining: 2
notify_session: agent:notify:main
---

# Test Plan

This is the context for the test plan.

---

## Decision 1: First Choice

id: first-choice
status: pending
answer: null
answered_at: null

**Context:** What should we choose first?

**Options:**
- \`option-a\` — Option A description
- \`option-b\` — Option B description

---

## Decision 2: Second Choice

id: second-choice
status: pending
answer: null
answered_at: null
allow_custom: true

**Context:** What should we choose second?

**Options:**
- \`yes\` — Yes option
- \`no\` — No option
`;

// Missing frontmatter
const MISSING_FRONTMATTER = `# Test Plan

No frontmatter here.

## Decision 1: First Choice

id: first-choice
status: pending
`;

// Missing decisions
const MISSING_DECISIONS = `---
id: empty-plan
agent: test
session: agent:test:main
title: Empty Plan
status: pending
---

# Empty Plan

No decisions in this file.
`;

describe('Parser', () => {
  it('parses valid MD file correctly', () => {
    const result = parseDecisionFile(VALID_DECISION_FILE, '/test/plan.md');
    
    expect(result).not.toBeNull();
    expect(result!.frontmatter.id).toBe('test-plan-123');
    expect(result!.frontmatter.agent).toBe('test-agent');
    expect(result!.frontmatter.title).toBe('Test Plan');
    expect(result!.frontmatter.priority).toBe('normal');
    expect(result!.frontmatter.notifySession).toBe('agent:notify:main');
    expect(result!.decisions).toHaveLength(2);
    
    // Check first decision
    expect(result!.decisions[0].id).toBe('first-choice');
    expect(result!.decisions[0].status).toBe('pending');
    expect(result!.decisions[0].options).toContain('option-a');
    expect(result!.decisions[0].options).toContain('option-b');
    
    // Check second decision
    expect(result!.decisions[1].id).toBe('second-choice');
    expect(result!.decisions[1].allowCustom).toBe(true);
  });

  it('returns null for missing frontmatter', () => {
    const result = parseDecisionFile(MISSING_FRONTMATTER, '/test/bad.md');
    expect(result).toBeNull();
  });

  it('handles files with no decisions', () => {
    const result = parseDecisionFile(MISSING_DECISIONS, '/test/empty.md');
    
    expect(result).not.toBeNull();
    expect(result!.decisions).toHaveLength(0);
    expect(isValidDecisionFile(result!)).toBe(false);
  });

  it('extracts context correctly', () => {
    const result = parseDecisionFile(VALID_DECISION_FILE, '/test/plan.md');
    
    expect(result).not.toBeNull();
    expect(result!.context).toContain('context for the test plan');
  });
});

describe('Writer', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arbiter-test-'));
    testFilePath = join(tempDir, 'test-plan.md');
    await writeFile(testFilePath, VALID_DECISION_FILE, 'utf-8');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('updates decision correctly', async () => {
    const result = await updateDecision(testFilePath, 'first-choice', 'option-a');
    
    expect(result).not.toBeNull();
    
    // Find the updated decision
    const decision = result!.decisions.find(d => d.id === 'first-choice');
    expect(decision?.answer).toBe('option-a');
    expect(decision?.status).toBe('answered');
    
    // Check frontmatter was updated
    expect(result!.frontmatter.answered).toBe(1);
    expect(result!.frontmatter.remaining).toBe(1);
    expect(result!.frontmatter.status).toBe('in_progress');
  });

  it('marks plan as ready when all decisions answered', async () => {
    // Answer first decision
    await updateDecision(testFilePath, 'first-choice', 'option-a');
    
    // Answer second decision
    const result = await updateDecision(testFilePath, 'second-choice', 'yes');
    
    expect(result).not.toBeNull();
    // Status is 'ready' (not 'completed') - requires explicit submission
    expect(result!.frontmatter.status).toBe('ready');
    expect(result!.frontmatter.remaining).toBe(0);
  });

  it('skips decision with special marker', async () => {
    const result = await skipDecision(testFilePath, 'first-choice');
    
    expect(result).not.toBeNull();
    const decision = result!.decisions.find(d => d.id === 'first-choice');
    expect(decision?.answer).toBe('__skipped__');
  });

  it('performs atomic write (file not corrupted)', async () => {
    // Update multiple times rapidly
    const promises = [
      updateDecision(testFilePath, 'first-choice', 'option-a'),
      updateDecision(testFilePath, 'first-choice', 'option-b'),
    ];
    
    await Promise.all(promises);
    
    // File should be valid after concurrent writes
    const content = await readFile(testFilePath, 'utf-8');
    const parsed = parseDecisionFile(content, testFilePath);
    
    expect(parsed).not.toBeNull();
    expect(parsed!.frontmatter.id).toBe('test-plan-123');
  });

  it('moves completed plan to completed directory', async () => {
    const completedDir = join(tempDir, 'completed');
    await mkdir(completedDir, { recursive: true });
    
    // Mark as completed first by answering all
    await updateDecision(testFilePath, 'first-choice', 'option-a');
    await updateDecision(testFilePath, 'second-choice', 'yes');
    
    const { file, newPath } = await completePlan(testFilePath, completedDir);
    
    expect(file).not.toBeNull();
    expect(newPath).toContain('completed');
    expect(file!.frontmatter.status).toBe('completed');
  });

  it('writes notification file correctly', async () => {
    const notifyDir = join(tempDir, 'notify');
    
    const notifyPath = await writeNotification(
      notifyDir,
      'test-plan-123',
      'Test Plan',
      'test-agent',
      'agent:test:main',
      'agent:notify:main',
      { 'first-choice': 'option-a', 'second-choice': 'yes' }
    );
    
    expect(notifyPath).not.toBeNull();
    
    const content = await readFile(notifyPath!, 'utf-8');
    expect(content).toContain('plan_id: test-plan-123');
    expect(content).toContain('first-choice: option-a');
    expect(content).toContain('second-choice: yes');
  });
});

describe('QueueManager', () => {
  let tempDir: string;
  let queueDir: string;
  let manager: QueueManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arbiter-queue-'));
    queueDir = tempDir;
    
    // Create queue structure
    await mkdir(join(queueDir, 'pending'), { recursive: true });
    await mkdir(join(queueDir, 'completed'), { recursive: true });
    await mkdir(join(queueDir, 'notify'), { recursive: true });
    
    // Add a test file
    await writeFile(
      join(queueDir, 'pending', 'test-plan.md'),
      VALID_DECISION_FILE,
      'utf-8'
    );
    
    manager = new QueueManager(queueDir);
  });

  afterEach(async () => {
    await manager.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('loads pending plans on init', async () => {
    await manager.init();
    
    const pending = manager.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].frontmatter.id).toBe('test-plan-123');
  });

  it('gets plan by ID', async () => {
    await manager.init();
    
    const plan = manager.getPlan('test-plan-123');
    expect(plan).not.toBeNull();
    expect(plan!.frontmatter.title).toBe('Test Plan');
  });

  it('gets plans by tag', async () => {
    await manager.init();
    
    const plans = manager.getByTag('test-tag');
    expect(plans).toHaveLength(1);
  });

  it('returns correct stats', async () => {
    await manager.init();
    
    const stats = manager.getStats();
    expect(stats.total).toBe(1);
    expect(stats.normal).toBe(1);
    expect(stats.urgent).toBe(0);
  });

  it('answers decision through manager', async () => {
    await manager.init();
    
    const updated = await manager.answerDecision('test-plan-123', 'first-choice', 'option-a');
    
    expect(updated).not.toBeNull();
    expect(updated!.decisions.find(d => d.id === 'first-choice')?.answer).toBe('option-a');
  });

  it('sorts plans by priority', async () => {
    // Add an urgent plan
    const urgentPlan = VALID_DECISION_FILE
      .replace('id: test-plan-123', 'id: urgent-plan')
      .replace('priority: normal', 'priority: urgent');
    
    await writeFile(
      join(queueDir, 'pending', 'urgent-plan.md'),
      urgentPlan,
      'utf-8'
    );
    
    await manager.refresh();
    
    const pending = manager.getPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].frontmatter.priority).toBe('urgent');
  });
});
