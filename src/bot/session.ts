/**
 * Session state management for custom input handling
 * 
 * Tracks when a user is in "custom input mode" waiting to type a custom answer.
 * Uses a simple in-memory store (survives within process, resets on restart).
 */

export interface CustomInputState {
  planId: string;
  decisionId: string;
  messageId: number;  // The message to edit when answer is received
  timestamp: number;
}

/**
 * Session store for tracking custom input state per user
 */
class SessionStore {
  private customInputStates: Map<number, CustomInputState> = new Map();
  
  // Timeout for custom input state (5 minutes)
  private readonly TIMEOUT_MS = 5 * 60 * 1000;

  /**
   * Set custom input state for a user
   */
  setCustomInputState(userId: number, state: Omit<CustomInputState, 'timestamp'>): void {
    this.customInputStates.set(userId, {
      ...state,
      timestamp: Date.now(),
    });
  }

  /**
   * Get custom input state for a user (returns null if expired or not set)
   */
  getCustomInputState(userId: number): CustomInputState | null {
    const state = this.customInputStates.get(userId);
    
    if (!state) {
      return null;
    }

    // Check if expired
    if (Date.now() - state.timestamp > this.TIMEOUT_MS) {
      this.customInputStates.delete(userId);
      return null;
    }

    return state;
  }

  /**
   * Clear custom input state for a user
   */
  clearCustomInputState(userId: number): void {
    this.customInputStates.delete(userId);
  }

  /**
   * Check if user is awaiting custom input
   */
  isAwaitingCustomInput(userId: number): boolean {
    return this.getCustomInputState(userId) !== null;
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();
