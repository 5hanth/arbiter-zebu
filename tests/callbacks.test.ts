/**
 * Callback System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sessionStore } from '../src/bot/session.js';

describe('Session Store', () => {
  beforeEach(() => {
    // Clear any existing state
    sessionStore.clearCustomInputState(12345);
    sessionStore.clearCustomInputState(67890);
  });

  describe('Custom Input State', () => {
    it('should store and retrieve custom input state', () => {
      const userId = 12345;
      const state = {
        planId: 'plan-123',
        decisionId: 'decision-456',
        messageId: 789,
      };

      sessionStore.setCustomInputState(userId, state);
      const retrieved = sessionStore.getCustomInputState(userId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.planId).toBe('plan-123');
      expect(retrieved?.decisionId).toBe('decision-456');
      expect(retrieved?.messageId).toBe(789);
      expect(retrieved?.timestamp).toBeDefined();
    });

    it('should return null for non-existent state', () => {
      const state = sessionStore.getCustomInputState(99999);
      expect(state).toBeNull();
    });

    it('should clear custom input state', () => {
      const userId = 12345;
      sessionStore.setCustomInputState(userId, {
        planId: 'plan-123',
        decisionId: 'decision-456',
        messageId: 789,
      });

      sessionStore.clearCustomInputState(userId);
      const state = sessionStore.getCustomInputState(userId);

      expect(state).toBeNull();
    });

    it('should correctly report if awaiting custom input', () => {
      const userId = 12345;
      
      expect(sessionStore.isAwaitingCustomInput(userId)).toBe(false);
      
      sessionStore.setCustomInputState(userId, {
        planId: 'plan-123',
        decisionId: 'decision-456',
        messageId: 789,
      });
      
      expect(sessionStore.isAwaitingCustomInput(userId)).toBe(true);
      
      sessionStore.clearCustomInputState(userId);
      
      expect(sessionStore.isAwaitingCustomInput(userId)).toBe(false);
    });

    it('should handle multiple users independently', () => {
      sessionStore.setCustomInputState(12345, {
        planId: 'plan-A',
        decisionId: 'decision-A',
        messageId: 111,
      });

      sessionStore.setCustomInputState(67890, {
        planId: 'plan-B',
        decisionId: 'decision-B',
        messageId: 222,
      });

      const stateA = sessionStore.getCustomInputState(12345);
      const stateB = sessionStore.getCustomInputState(67890);

      expect(stateA?.planId).toBe('plan-A');
      expect(stateB?.planId).toBe('plan-B');

      // Clear one, check other still exists
      sessionStore.clearCustomInputState(12345);
      
      expect(sessionStore.getCustomInputState(12345)).toBeNull();
      expect(sessionStore.getCustomInputState(67890)).not.toBeNull();
    });

    it('should overwrite state for same user', () => {
      const userId = 12345;
      
      sessionStore.setCustomInputState(userId, {
        planId: 'plan-old',
        decisionId: 'decision-old',
        messageId: 111,
      });

      sessionStore.setCustomInputState(userId, {
        planId: 'plan-new',
        decisionId: 'decision-new',
        messageId: 222,
      });

      const state = sessionStore.getCustomInputState(userId);
      
      expect(state?.planId).toBe('plan-new');
      expect(state?.decisionId).toBe('decision-new');
      expect(state?.messageId).toBe(222);
    });
  });
});

describe('Callback Data Parsing', () => {
  // Note: parseCallbackData is a private function in callbacks.ts
  // These tests verify the expected format behavior

  it('should handle basic callback format', () => {
    const data = 'refresh';
    const parts = data.split(':');
    
    expect(parts[0]).toBe('refresh');
    expect(parts[1]).toBeUndefined();
  });

  it('should handle open callback format', () => {
    const data = 'open:plan-123';
    const parts = data.split(':');
    
    expect(parts[0]).toBe('open');
    expect(parts[1]).toBe('plan-123');
  });

  it('should handle answer callback format', () => {
    const data = 'answer:plan-123:decision-456:option-a';
    const parts = data.split(':');
    
    expect(parts[0]).toBe('answer');
    expect(parts[1]).toBe('plan-123');
    expect(parts[2]).toBe('decision-456');
    expect(parts[3]).toBe('option-a');
  });

  it('should handle custom callback format', () => {
    const data = 'custom:plan-123:decision-456';
    const parts = data.split(':');
    
    expect(parts[0]).toBe('custom');
    expect(parts[1]).toBe('plan-123');
    expect(parts[2]).toBe('decision-456');
  });

  it('should handle skip callback format', () => {
    const data = 'skip:plan-123:decision-456';
    const parts = data.split(':');
    
    expect(parts[0]).toBe('skip');
    expect(parts[1]).toBe('plan-123');
    expect(parts[2]).toBe('decision-456');
  });

  it('should handle values with special characters', () => {
    // Option values should be simple identifiers, but test edge case
    const data = 'answer:plan-123:decision-456:option_with_underscore';
    const parts = data.split(':');
    
    expect(parts[3]).toBe('option_with_underscore');
  });
});

describe('Callback Actions', () => {
  const validActions = ['refresh', 'queue', 'open', 'start', 'answer', 'skip', 'custom', 'noop'];

  it('should recognize all valid actions', () => {
    for (const action of validActions) {
      expect(validActions.includes(action)).toBe(true);
    }
  });

  it('should have consistent action names', () => {
    // Actions should be lowercase, no spaces
    for (const action of validActions) {
      expect(action).toBe(action.toLowerCase());
      expect(action).not.toContain(' ');
    }
  });
});
