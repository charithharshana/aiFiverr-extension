/**
 * Universal Chat Interface for LLM.js
 * Provides a complete chat experience with streaming, history, and all LLM features
 */

// Note: In browser extension context, we'll use global variables instead of ES6 imports
// The files are loaded in order via manifest.json

/**
 * AI Assistance Chat Interface Class
 */
export default class AIAssistanceChatInterface {
  constructor(options = {}) {
    this.options = {
      service: 'google', // SERVICES.GOOGLE
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
      extended: true,
      autoSave: true,
      maxHistory: 100,
      ...options
    };

    this.llm = null;
    this.conversations = new Map();
    this.currentConversationId = null;
    this.isStreaming = false;
    this.abortController = null;
    this.eventListeners = new Map();

    // DO NOT auto-initialize - wait for explicit call
    // this.init();
  }

  async init() {
    try {
      // Initialize LLM instance
      this.llm = new window.LLMInterface(this.options); // createLLM equivalent
      
      // Load saved conversations
      await this.loadConversations();
      
      // Create default conversation if none exist
      if (this.conversations.size === 0) {
        this.createConversation('Default Chat');
      }

      this.emit('initialized');
      console.log('Universal Chat Interface initialized');
    } catch (error) {
      console.error('Failed to initialize chat interface:', error);
      this.emit('error', error);
    }
  }

  // Event system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Conversation management
  createConversation(title = 'New Chat', systemPrompt = '') {
    const id = this.generateUuid(); // uuid() equivalent
    const conversation = {
      id,
      title,
      systemPrompt,
      messages: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      metadata: {
        totalTokens: 0,
        totalCost: 0,
        messageCount: 0
      }
    };

    if (systemPrompt) {
      conversation.messages.push({
        id: this.generateUuid(),
        role: 'system', // MESSAGE_ROLES.SYSTEM
        content: systemPrompt,
        timestamp: new Date().toISOString()
      });
    }

    this.conversations.set(id, conversation);
    this.currentConversationId = id;
    
    if (this.options.autoSave) {
      this.saveConversations();
    }

    this.emit('conversationCreated', conversation);
    return conversation;
  }

  switchConversation(conversationId) {
    if (this.conversations.has(conversationId)) {
      this.currentConversationId = conversationId;
      this.emit('conversationSwitched', this.getCurrentConversation());
      return true;
    }
    return false;
  }

  deleteConversation(conversationId) {
    if (this.conversations.has(conversationId)) {
      this.conversations.delete(conversationId);
      
      if (this.currentConversationId === conversationId) {
        // Switch to another conversation or create a new one
        const remaining = Array.from(this.conversations.keys());
        if (remaining.length > 0) {
          this.currentConversationId = remaining[0];
        } else {
          this.createConversation('Default Chat');
        }
      }

      if (this.options.autoSave) {
        this.saveConversations();
      }

      this.emit('conversationDeleted', conversationId);
      return true;
    }
    return false;
  }

  getCurrentConversation() {
    return this.conversations.get(this.currentConversationId);
  }

  getAllConversations() {
    return Array.from(this.conversations.values());
  }

  // Message management
  addMessage(role, content, metadata = {}) {
    const conversation = this.getCurrentConversation();
    if (!conversation) return null;

    const message = {
      id: this.generateUuid(),
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        tokens: 0,
        cost: 0,
        ...metadata
      }
    };

    conversation.messages.push(message);
    conversation.updated = new Date().toISOString();
    conversation.metadata.messageCount++;

    if (this.options.autoSave) {
      this.saveConversations();
    }

    this.emit('messageAdded', message, conversation);
    return message;
  }

  updateMessage(messageId, updates) {
    const conversation = this.getCurrentConversation();
    if (!conversation) return false;

    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;

    Object.assign(conversation.messages[messageIndex], updates);
    conversation.updated = new Date().toISOString();

    if (this.options.autoSave) {
      this.saveConversations();
    }

    this.emit('messageUpdated', conversation.messages[messageIndex], conversation);
    return true;
  }

  deleteMessage(messageId) {
    const conversation = this.getCurrentConversation();
    if (!conversation) return false;

    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;

    const deletedMessage = conversation.messages.splice(messageIndex, 1)[0];
    conversation.updated = new Date().toISOString();
    conversation.metadata.messageCount--;

    if (this.options.autoSave) {
      this.saveConversations();
    }

    this.emit('messageDeleted', deletedMessage, conversation);
    return true;
  }

  // Chat functionality
  async sendMessage(content, options = {}) {
    if (this.isStreaming) {
      throw new Error('Another message is currently being processed');
    }

    const conversation = this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No active conversation');
    }

    // Add user message
    const userMessage = this.addMessage('user', content); // MESSAGE_ROLES.USER
    
    try {
      this.isStreaming = true;
      this.emit('streamStarted', userMessage);

      // Prepare LLM with conversation history
      const llm = new window.LLMInterface({
        ...this.options,
        ...options
      });

      // Add conversation messages to LLM
      for (const msg of conversation.messages) {
        if (msg.role === MESSAGE_ROLES.SYSTEM) {
          llm.system(msg.content);
        } else if (msg.role === MESSAGE_ROLES.USER) {
          llm.user(msg.content, msg.metadata.attachments);
        } else if (msg.role === MESSAGE_ROLES.ASSISTANT) {
          llm.assistant(msg.content);
        }
      }

      // Send the message
      const response = await llm.send(options);

      if (options.stream !== false && this.options.stream) {
        return await this.handleStreamingResponse(response, options);
      } else {
        return await this.handleRegularResponse(response, options);
      }

    } catch (error) {
      this.isStreaming = false;
      this.emit('error', error);
      throw error;
    }
  }

  async handleStreamingResponse(response, options) {
    let assistantMessage = this.addMessage(MESSAGE_ROLES.ASSISTANT, '');
    let thinkingMessage = null;
    let fullContent = '';
    let fullThinking = '';
    let toolCalls = [];

    try {
      if (response.stream) {
        // Extended streaming response
        for await (const chunk of response.stream) {
          if (chunk.type === CHUNK_TYPES.CONTENT) {
            fullContent += chunk.content;
            this.updateMessage(assistantMessage.id, { content: fullContent });
            this.emit('streamChunk', chunk, assistantMessage);
          } else if (chunk.type === CHUNK_TYPES.THINKING) {
            if (!thinkingMessage) {
              thinkingMessage = this.addMessage(MESSAGE_ROLES.THINKING, '');
            }
            fullThinking += chunk.content;
            this.updateMessage(thinkingMessage.id, { content: fullThinking });
            this.emit('thinkingChunk', chunk, thinkingMessage);
          } else if (chunk.type === CHUNK_TYPES.TOOL_CALLS) {
            toolCalls.push(...chunk.content);
            this.emit('toolCallsChunk', chunk, toolCalls);
          } else if (chunk.type === CHUNK_TYPES.USAGE) {
            this.emit('usageChunk', chunk);
          }
        }

        // Get final response
        const finalResponse = await response.complete();
        this.updateConversationMetadata(finalResponse);
        
        this.emit('streamCompleted', finalResponse, assistantMessage);
        return finalResponse;
      } else {
        // Simple streaming response
        for await (const chunk of response) {
          fullContent += chunk;
          this.updateMessage(assistantMessage.id, { content: fullContent });
          this.emit('streamChunk', { content: chunk }, assistantMessage);
        }

        this.emit('streamCompleted', { content: fullContent }, assistantMessage);
        return { content: fullContent };
      }
    } finally {
      this.isStreaming = false;
    }
  }

  async handleRegularResponse(response, options) {
    try {
      let assistantMessage;
      
      if (typeof response === 'string') {
        assistantMessage = this.addMessage(MESSAGE_ROLES.ASSISTANT, response);
        this.emit('messageCompleted', { content: response }, assistantMessage);
        return { content: response };
      } else {
        // Extended response
        if (response.thinking) {
          this.addMessage(MESSAGE_ROLES.THINKING, response.thinking);
        }
        
        assistantMessage = this.addMessage(MESSAGE_ROLES.ASSISTANT, response.content || '');
        
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            this.addMessage(MESSAGE_ROLES.TOOL_CALL, toolCall);
          }
        }

        this.updateConversationMetadata(response);
        this.emit('messageCompleted', response, assistantMessage);
        return response;
      }
    } finally {
      this.isStreaming = false;
    }
  }

  updateConversationMetadata(response) {
    const conversation = this.getCurrentConversation();
    if (!conversation || !response.usage) return;

    conversation.metadata.totalTokens += response.usage.total_tokens || 0;
    conversation.metadata.totalCost += response.usage.total_cost || 0;
    conversation.updated = new Date().toISOString();

    if (this.options.autoSave) {
      this.saveConversations();
    }
  }

  // Abort current streaming
  abort() {
    if (this.isStreaming && this.llm) {
      this.llm.abort();
      this.isStreaming = false;
      this.emit('streamAborted');
    }
  }

  // Persistence
  async saveConversations() {
    try {
      const data = {
        conversations: Array.from(this.conversations.entries()),
        currentConversationId: this.currentConversationId,
        options: this.options,
        version: '1.0.0'
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ 'llm_conversations': data });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('llm_conversations', JSON.stringify(data));
      }

      this.emit('conversationsSaved');
    } catch (error) {
      console.error('Failed to save conversations:', error);
      this.emit('error', error);
    }
  }

  async loadConversations() {
    try {
      let data = null;

      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get('llm_conversations');
        data = result.llm_conversations;
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('llm_conversations');
        if (stored) {
          data = JSON.parse(stored);
        }
      }

      if (data && data.conversations) {
        this.conversations = new Map(data.conversations);
        this.currentConversationId = data.currentConversationId;
        
        // Merge options
        if (data.options) {
          this.options = { ...this.options, ...data.options };
        }

        this.emit('conversationsLoaded');
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.emit('error', error);
    }
  }

  // Export/Import functionality
  exportConversations(format = 'json') {
    const data = {
      conversations: Array.from(this.conversations.values()),
      exported: new Date().toISOString(),
      version: '1.0.0'
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'markdown') {
      return this.convertToMarkdown(data);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  convertToMarkdown(data) {
    let markdown = `# Chat Export\n\nExported: ${data.exported}\n\n`;
    
    for (const conversation of data.conversations) {
      markdown += `## ${conversation.title}\n\n`;
      markdown += `Created: ${conversation.created}\n`;
      markdown += `Updated: ${conversation.updated}\n`;
      markdown += `Messages: ${conversation.metadata.messageCount}\n\n`;
      
      for (const message of conversation.messages) {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        markdown += `### ${role}\n\n${message.content}\n\n`;
      }
      
      markdown += '---\n\n';
    }
    
    return markdown;
  }

  async importConversations(data, merge = false) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!merge) {
        this.conversations.clear();
      }

      if (parsed.conversations) {
        for (const conversation of parsed.conversations) {
          this.conversations.set(conversation.id, conversation);
        }
      }

      if (this.options.autoSave) {
        await this.saveConversations();
      }

      this.emit('conversationsImported');
      return true;
    } catch (error) {
      console.error('Failed to import conversations:', error);
      this.emit('error', error);
      return false;
    }
  }

  // Configuration
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Reinitialize LLM if service changed
    if (newOptions.service || newOptions.model) {
      this.llm = createLLM(this.options.service, this.options);
    }

    if (this.options.autoSave) {
      this.saveConversations();
    }

    this.emit('optionsUpdated', this.options);
  }

  getOptions() {
    return { ...this.options };
  }

  // Utility methods
  clearCurrentConversation() {
    const conversation = this.getCurrentConversation();
    if (conversation) {
      conversation.messages = conversation.messages.filter(m => m.role === MESSAGE_ROLES.SYSTEM);
      conversation.metadata = {
        totalTokens: 0,
        totalCost: 0,
        messageCount: conversation.messages.length
      };
      conversation.updated = new Date().toISOString();

      if (this.options.autoSave) {
        this.saveConversations();
      }

      this.emit('conversationCleared', conversation);
    }
  }

  getConversationStats() {
    const conversation = this.getCurrentConversation();
    if (!conversation) return null;

    return {
      messageCount: conversation.metadata.messageCount,
      totalTokens: conversation.metadata.totalTokens,
      totalCost: conversation.metadata.totalCost,
      created: conversation.created,
      updated: conversation.updated
    };
  }

  searchConversations(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const conversation of this.conversations.values()) {
      if (conversation.title.toLowerCase().includes(lowerQuery)) {
        results.push({ conversation, type: 'title' });
      }

      for (const message of conversation.messages) {
        if (typeof message.content === 'string' && 
            message.content.toLowerCase().includes(lowerQuery)) {
          results.push({ conversation, message, type: 'message' });
        }
      }
    }

    return results;
  }

  // Utility methods
  generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Cleanup
  destroy() {
    this.abort();
    this.eventListeners.clear();
    this.conversations.clear();
    this.llm = null;
    this.emit('destroyed');
  }
}

// Export to global window object for browser extension
if (typeof window !== 'undefined') {
  window.UniversalChatInterface = UniversalChatInterface;
}
