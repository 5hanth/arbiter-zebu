/**
 * Queue Parser - Parses decision MD files
 */

import matter from 'gray-matter';
import type { DecisionFile, Decision, DecisionFileFrontmatter, Status } from '../types.js';

/**
 * Parse a single decision section from markdown
 */
function parseDecisionSection(section: string): Decision | null {
  const lines = section.trim().split('\n');
  
  // Extract title from ## Decision N: Title
  const titleMatch = lines[0]?.match(/^##\s+Decision\s+\d+:\s*(.+)$/i);
  if (!titleMatch) {
    return null;
  }

  const decision: Decision = {
    id: '',
    status: 'pending',
    answer: null,
    answeredAt: null,
    context: '',
    options: [],
    allowCustom: false,
  };

  let inOptions = false;
  let contextLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Parse metadata fields
    if (line.startsWith('id:')) {
      decision.id = line.slice(3).trim();
    } else if (line.startsWith('status:')) {
      decision.status = line.slice(7).trim() as Status;
    } else if (line.startsWith('answer:')) {
      const val = line.slice(7).trim();
      decision.answer = val === 'null' || val === '' ? null : val;
    } else if (line.startsWith('answered_at:')) {
      const val = line.slice(12).trim();
      decision.answeredAt = val === 'null' || val === '' ? null : val;
    } else if (line.startsWith('allow_custom:')) {
      decision.allowCustom = line.slice(13).trim() === 'true';
    }
    // Parse context
    else if (line.startsWith('**Context:**')) {
      contextLines.push(line.slice(12).trim());
      inOptions = false;
    }
    // Parse options section
    else if (line.startsWith('**Options:**')) {
      inOptions = true;
    }
    // Parse individual options: - `key` — Label
    else if (inOptions && line.startsWith('-')) {
      const optionMatch = line.match(/^-\s+`([^`]+)`(?:\s*[—–-]\s*(.+))?$/);
      if (optionMatch) {
        decision.options.push(optionMatch[1]);
      }
    }
    // Continue context
    else if (!inOptions && line && !line.startsWith('**') && !line.startsWith('-')) {
      contextLines.push(line);
    }
  }

  decision.context = contextLines.join(' ').trim();

  // Validate required fields
  if (!decision.id) {
    return null;
  }

  return decision;
}

/**
 * Parse a decision MD file and return structured data
 * @param content - Raw markdown content
 * @param filePath - Path to the file (for reference)
 * @returns DecisionFile or null if parsing fails
 */
export function parseDecisionFile(content: string, filePath: string): DecisionFile | null {
  try {
    // Parse frontmatter
    const { data, content: body } = matter(content);

    // Validate required frontmatter fields
    const requiredFields = ['id', 'agent', 'session', 'title', 'status'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.error(`[Parser] Missing required frontmatter field: ${field} in ${filePath}`);
        return null;
      }
    }

    const frontmatter: DecisionFileFrontmatter = {
      id: data.id,
      version: data.version ?? 1,
      agent: data.agent,
      session: data.session,
      tag: data.tag ?? '',
      title: data.title,
      priority: data.priority ?? 'normal',
      status: data.status ?? 'pending',
      createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updated_at ?? data.updatedAt ?? new Date().toISOString(),
      completedAt: data.completed_at ?? data.completedAt ?? null,
      total: data.total ?? 0,
      answered: data.answered ?? 0,
      remaining: data.remaining ?? 0,
      notifySession: data.notify_session ?? data.notifySession,
    };

    // Extract context (text before first decision section)
    const decisionSections = body.split(/(?=^## Decision \d+:)/gm);
    const contextSection = decisionSections[0] ?? '';
    
    // Extract main context:
    // 1. Remove the title heading (# Title)
    // 2. Remove any --- separators
    // 3. Trim whitespace
    let contextText = contextSection
      .replace(/^#\s+.+\n*/m, '')  // Remove # Title line
      .split('---')[0]              // Take content before first ---
      ?.trim() ?? '';

    // Parse each decision section
    const decisions: Decision[] = [];
    for (let i = 1; i < decisionSections.length; i++) {
      const decision = parseDecisionSection(decisionSections[i]);
      if (decision) {
        decisions.push(decision);
      }
    }

    // Update counts if not in frontmatter
    if (frontmatter.total === 0) {
      frontmatter.total = decisions.length;
    }
    if (frontmatter.answered === 0) {
      frontmatter.answered = decisions.filter(d => d.answer !== null).length;
    }
    frontmatter.remaining = frontmatter.total - frontmatter.answered;

    return {
      frontmatter,
      context: contextText,
      decisions,
      rawContent: content,
      filePath,
    };
  } catch (err) {
    console.error(`[Parser] Failed to parse ${filePath}:`, err);
    return null;
  }
}

/**
 * Validate that a parsed file has at least one decision
 */
export function isValidDecisionFile(file: DecisionFile): boolean {
  return file.decisions.length > 0 && file.frontmatter.id !== '';
}
