/**
 * Queue Writer - Atomic updates to decision MD files
 */

import { writeFile, rename, mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import matter from 'gray-matter';
import type { DecisionFile, Status } from '../types.js';
import { parseDecisionFile } from './parser.js';

/**
 * Generate a temp file path for atomic writes
 */
function getTempPath(filePath: string): string {
  const dir = dirname(filePath);
  const tempName = `.tmp-${randomBytes(8).toString('hex')}`;
  return join(dir, tempName);
}

/**
 * Atomic write: write to temp file then rename
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = getTempPath(filePath);
  
  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });
  
  // Write to temp file
  await writeFile(tempPath, content, 'utf-8');
  
  // Atomic rename
  await rename(tempPath, filePath);
}

/**
 * Update the frontmatter in a decision file
 */
function updateFrontmatter(
  content: string,
  updates: Record<string, unknown>
): string {
  const { data, content: body } = matter(content);
  
  // Merge updates
  const newData = { ...data, ...updates };
  
  // Rebuild file with gray-matter
  return matter.stringify(body, newData);
}

/**
 * Update a decision section in the markdown body
 */
function updateDecisionInBody(
  content: string,
  decisionId: string,
  answer: string,
  status: Status = 'answered'
): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  let inTargetDecision = false;
  let foundAnswer = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for decision section start
    if (line.match(/^## Decision \d+:/)) {
      inTargetDecision = false;
      foundAnswer = false;
    }
    
    // Check if this is our target decision
    if (line.trim().startsWith('id:') && line.includes(decisionId)) {
      inTargetDecision = true;
    }
    
    // Update status line - also insert answer/answered_at after status if missing
    if (inTargetDecision && line.trim().startsWith('status:')) {
      result.push(`status: ${status}`);
      // Insert answer and answered_at right after status if they don't exist
      // We'll check later if they were found
      continue;
    }
    
    // Update answer line
    if (inTargetDecision && line.trim().startsWith('answer:')) {
      result.push(`answer: ${answer}`);
      foundAnswer = true;
      continue;
    }
    
    // Update answered_at line
    if (inTargetDecision && line.trim().startsWith('answered_at:')) {
      result.push(`answered_at: ${new Date().toISOString()}`);
      continue;
    }
    
    // When we hit an empty line or next section after status, insert missing fields
    if (inTargetDecision && !foundAnswer && (line.trim() === '' || line.startsWith('**') || line.startsWith('-'))) {
      // Insert answer and answered_at before this line
      result.push(`answer: ${answer}`);
      result.push(`answered_at: ${new Date().toISOString()}`);
      foundAnswer = true;
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Update a single decision in a plan file
 */
export async function updateDecision(
  filePath: string,
  decisionId: string,
  answer: string
): Promise<DecisionFile | null> {
  try {
    // Read current content
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseDecisionFile(content, filePath);
    
    if (!parsed) {
      console.error(`[Writer] Failed to parse file: ${filePath}`);
      return null;
    }
    
    // Update the decision in body
    let newContent = updateDecisionInBody(content, decisionId, answer, 'answered');
    
    // Count answered decisions
    const decision = parsed.decisions.find(d => d.id === decisionId);
    if (decision) {
      decision.answer = answer;
      decision.status = 'answered';
      decision.answeredAt = new Date().toISOString();
    }
    
    const answeredCount = parsed.decisions.filter(d => 
      d.answer !== null || d.id === decisionId
    ).length;
    const remaining = parsed.decisions.length - answeredCount;
    
    // Determine new status
    // 'ready' means all decisions answered but not yet submitted
    // 'completed' is only set when user explicitly submits
    const isReady = remaining === 0;
    const newStatus: Status = isReady ? 'ready' : 'in_progress';
    
    // Update frontmatter
    newContent = updateFrontmatter(newContent, {
      status: newStatus,
      answered: answeredCount,
      remaining: remaining,
      updated_at: new Date().toISOString(),
    });
    
    // Atomic write
    await atomicWrite(filePath, newContent);
    
    // Return updated parsed file
    return parseDecisionFile(newContent, filePath);
  } catch (err) {
    console.error(`[Writer] Failed to update decision ${decisionId}:`, err);
    return null;
  }
}

/**
 * Skip a decision (mark as answered with special value)
 */
export async function skipDecision(
  filePath: string,
  decisionId: string
): Promise<DecisionFile | null> {
  return updateDecision(filePath, decisionId, '__skipped__');
}

/**
 * Mark a plan as completed and optionally move to completed directory
 */
export async function completePlan(
  filePath: string,
  completedDir?: string
): Promise<{ file: DecisionFile | null; newPath: string | null }> {
  try {
    // Read and update content
    const content = await readFile(filePath, 'utf-8');
    
    let newContent = updateFrontmatter(content, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    // Write updated content
    await atomicWrite(filePath, newContent);
    
    // Move to completed directory if specified
    let newPath: string | null = null;
    if (completedDir) {
      const fileName = filePath.split('/').pop();
      newPath = join(completedDir, fileName!);
      await mkdir(completedDir, { recursive: true });
      await rename(filePath, newPath);
    }
    
    const finalPath = newPath ?? filePath;
    const finalContent = await readFile(finalPath, 'utf-8');
    
    return {
      file: parseDecisionFile(finalContent, finalPath),
      newPath,
    };
  } catch (err) {
    console.error(`[Writer] Failed to complete plan:`, err);
    return { file: null, newPath: null };
  }
}

/**
 * Write a notification file for agent notification
 */
export async function writeNotification(
  notifyDir: string,
  planId: string,
  planTitle: string,
  agent: string,
  session: string,
  notifySession: string,
  answers: Record<string, string>
): Promise<string | null> {
  try {
    // Create hash from notify session for filename
    const sessionHash = Buffer.from(notifySession).toString('base64url').slice(0, 12);
    const fileName = `${sessionHash}-${planId}.md`;
    const filePath = join(notifyDir, fileName);
    
    // Build notification content
    const frontmatter = {
      plan_id: planId,
      plan_title: planTitle,
      agent,
      session,
      notify_session: notifySession,
      completed_at: new Date().toISOString(),
    };
    
    const answerLines = Object.entries(answers)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    
    const body = `\n## Answers\n\n${answerLines}\n`;
    
    const content = matter.stringify(body, frontmatter);
    
    await mkdir(notifyDir, { recursive: true });
    await atomicWrite(filePath, content);
    
    return filePath;
  } catch (err) {
    console.error(`[Writer] Failed to write notification:`, err);
    return null;
  }
}
