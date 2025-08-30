/**
 * AI Chat Session Manager
 * Handles persistent chat sessions with conversation context like ChatGPT
 */

class ChatSession {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.messages = [];
    this.context = '';
    this.metadata = {
      created: Date.now(),
      lastUpdated: Date.now(),
      messageCount: 0,
      title: options.title || 'New Conversation',
      fiverrContext: options.fiverrContext || null
    };
    this.apiKeyIndex = null;
    this.isActive = false;
  }

  /**
   * Load session from storage
   */
  static async load(sessionId) {
    try {
      const sessionData = await storageManager.getSession(sessionId);
      if (!sessionData) return null;

      const session = new ChatSession(sessionId);
      session.messages = sessionData.messages || [];
      session.context = sessionData.context || '';
      session.metadata = { ...session.metadata, ...sessionData.metadata };
      session.apiKeyIndex = sessionData.apiKeyIndex;
      
      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Save session to storage
   */
  async save() {
    try {
      const sessionData = {
        messages: this.messages,
        context: this.context,
        metadata: this.metadata,
        apiKeyIndex: this.apiKeyIndex
      };

      await storageManager.saveSession(this.sessionId, sessionData);
      return true;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  }

  /**
   * Add message to session
   */
  addMessage(role, content, metadata = {}) {
    const message = {
      id: generateSessionId(),
      role, // 'user' or 'assistant'
      content,
      timestamp: Date.now(),
      metadata
    };

    this.messages.push(message);
    this.metadata.messageCount = this.messages.length;
    this.metadata.lastUpdated = Date.now();

    // Update session title based on first user message
    if (role === 'user' && this.messages.length === 1 && content) {
      this.metadata.title = (content.length > 50) ? content.substring(0, 50) + '...' : content;
    }

    return message;
  }

  /**
   * Get conversation context for API with intelligent optimization
   */
  getConversationContext(maxLength = 10000) {
    let context = '';
    let totalLength = 0;

    // Start from the most recent messages and work backwards
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      const messageText = `${message.role}: ${message.content}\n\n`;

      if (totalLength + messageText.length > maxLength) {
        break;
      }

      context = messageText + context;
      totalLength += messageText.length;
    }

    // Add Fiverr context if available and space permits
    if (this.metadata.fiverrContext) {
      const fiverrContextText = `Fiverr Context: ${this.metadata.fiverrContext}\n\n`;
      if (totalLength + fiverrContextText.length <= maxLength) {
        context = fiverrContextText + context;
      } else {
        // Try to add a truncated version
        const availableSpace = maxLength - totalLength - 50; // Leave some buffer
        if (availableSpace > 100) {
          const truncatedContext = this.metadata.fiverrContext.substring(0, availableSpace) + '...';
          context = `Fiverr Context (truncated): ${truncatedContext}\n\n` + context;
        }
      }
    }

    return context.trim();
  }

  /**
   * Get optimized context based on conversation analysis
   */
  getOptimizedContext(maxLength = 10000) {
    // If we have Fiverr context, try to optimize it
    if (this.metadata.fiverrContext && window.fiverrExtractor) {
      try {
        // Extract current conversation data
        const username = window.fiverrExtractor.extractUsernameFromUrl();
        if (username) {
          const conversationData = window.fiverrExtractor.getStoredConversation(username);
          if (conversationData) {
            // Analyze conversation and get optimal context
            const analysis = window.fiverrExtractor.analyzeConversation(conversationData);
            const optimizedFiverrContext = window.fiverrExtractor.getIntelligentContext(
              conversationData,
              analysis.strategy,
              Math.floor(maxLength * 0.7) // Reserve 30% for chat history
            );

            // Update metadata with optimized context
            this.metadata.fiverrContext = optimizedFiverrContext;
            this.metadata.contextStrategy = analysis.strategy;
            this.metadata.contextAnalysis = analysis;
          }
        }
      } catch (error) {
        console.warn('Failed to optimize Fiverr context:', error);
      }
    }

    return this.getConversationContext(maxLength);
  }

  /**
   * Get messages in Gemini API format
   */
  getMessagesForAPI(maxMessages = 20) {
    const recentMessages = this.messages.slice(-maxMessages);
    
    return recentMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  /**
   * Clear session messages
   */
  clear() {
    this.messages = [];
    this.context = '';
    this.metadata.messageCount = 0;
    this.metadata.lastUpdated = Date.now();
  }

  /**
   * Export session data
   */
  export() {
    return {
      sessionId: this.sessionId,
      messages: this.messages,
      context: this.context,
      metadata: this.metadata,
      exportedAt: Date.now()
    };
  }

  /**
   * Get session statistics
   */
  getStats() {
    const userMessages = this.messages.filter(m => m.role === 'user').length;
    const assistantMessages = this.messages.filter(m => m.role === 'assistant').length;
    const totalCharacters = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    
    return {
      totalMessages: this.messages.length,
      userMessages,
      assistantMessages,
      totalCharacters,
      averageMessageLength: this.messages.length > 0 ? totalCharacters / this.messages.length : 0,
      duration: this.metadata.lastUpdated - this.metadata.created,
      title: this.metadata.title
    };
  }
}

/**
 * Session Manager - handles multiple chat sessions
 */
class SessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.currentSessionId = null;
    this.init();
  }

  async init() {
    // Load settings
    this.settings = await storageManager.getSettings();
    
    // Cleanup old sessions periodically
    setInterval(() => {
      this.cleanupOldSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Create new session
   */
  async createSession(options = {}) {
    const sessionId = generateSessionId();
    const session = new ChatSession(sessionId, options);
    
    this.activeSessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    await session.save();
    return session;
  }

  /**
   * Get or create session for current context
   */
  async getOrCreateSession(contextId = 'default') {
    // Try to find existing session for this context
    let sessionId = await this.getSessionIdForContext(contextId);
    
    if (sessionId) {
      return await this.getSession(sessionId);
    }

    // Create new session
    const options = {
      title: `Fiverr Chat - ${new Date().toLocaleDateString()}`,
      fiverrContext: await this.extractFiverrContext()
    };
    
    return await this.createSession(options);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    // Check active sessions first
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId);
    }

    // Load from storage
    const session = await ChatSession.load(sessionId);
    if (session) {
      this.activeSessions.set(sessionId, session);
    }
    
    return session;
  }

  /**
   * Get current active session
   */
  getCurrentSession() {
    if (this.currentSessionId) {
      return this.activeSessions.get(this.currentSessionId);
    }
    return null;
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId) {
    this.currentSessionId = sessionId;
  }

  /**
   * Get all sessions
   */
  async getAllSessions() {
    const storedSessions = await storageManager.getAllSessions();
    const sessions = [];
    
    for (const [key, data] of Object.entries(storedSessions)) {
      const sessionId = key.replace('session_', '');
      let session = this.activeSessions.get(sessionId);
      
      if (!session) {
        session = await ChatSession.load(sessionId);
      }
      
      if (session) {
        sessions.push(session);
      }
    }
    
    // Sort by last updated
    return sessions.sort((a, b) => b.metadata.lastUpdated - a.metadata.lastUpdated);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    this.activeSessions.delete(sessionId);
    await storageManager.deleteSession(sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Export all sessions
   */
  async exportSessions() {
    const sessions = await this.getAllSessions();
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      sessions: sessions.map(s => s.export())
    };
  }

  /**
   * Import sessions
   */
  async importSessions(importData) {
    try {
      if (!importData.sessions) {
        throw new Error('Invalid import data');
      }

      for (const sessionData of importData.sessions) {
        const session = new ChatSession(sessionData.sessionId);
        session.messages = sessionData.messages || [];
        session.context = sessionData.context || '';
        session.metadata = sessionData.metadata || {};
        
        await session.save();
      }

      return true;
    } catch (error) {
      console.error('Import sessions error:', error);
      return false;
    }
  }

  /**
   * Get session ID for specific context (e.g., Fiverr conversation)
   */
  async getSessionIdForContext(contextId) {
    const sessions = await this.getAllSessions();
    
    for (const session of sessions) {
      if (session.metadata.fiverrContext === contextId) {
        return session.sessionId;
      }
    }
    
    return null;
  }

  /**
   * Extract Fiverr context from current page
   */
  async extractFiverrContext() {
    if (!isFiverrConversationPage()) return null;
    
    try {
      // Extract conversation partner name from URL or page
      const urlMatch = window.location.href.match(/\/inbox\/([^\/\?]+)/);
      const partnerName = urlMatch ? urlMatch[1] : 'Unknown';
      
      return `Conversation with ${partnerName}`;
    } catch (error) {
      console.error('Failed to extract Fiverr context:', error);
      return null;
    }
  }

  /**
   * Cleanup old sessions
   */
  async cleanupOldSessions() {
    try {
      // Check if storage manager is available and extension context is valid
      if (!window.storageManager || !window.storageManager.isExtensionContextValid()) {
        console.warn('aiFiverr: Cannot cleanup sessions - storage unavailable or context invalidated');
        return;
      }

      const deletedCount = await storageManager.cleanupOldSessions();
      if (deletedCount > 0) {
        console.log(`aiFiverr: Cleaned up ${deletedCount} old sessions`);
      }
    } catch (error) {
      console.error('aiFiverr: Session cleanup error:', error);
    }
  }
}

// Create global session manager - but only when explicitly called
function initializeSessionManager() {
  if (!window.sessionManager) {
    window.sessionManager = new SessionManager();
    console.log('aiFiverr: Session Manager created');
  }
  return window.sessionManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeSessionManager = initializeSessionManager;

// REMOVED AUTO-INITIALIZATION - This was causing the session manager to load on every website
// The session manager should only be initialized when explicitly called by the main extension
