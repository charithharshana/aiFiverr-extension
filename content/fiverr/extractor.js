/**
 * Fiverr Content Extractor
 * Extracts conversation data and context from Fiverr pages
 * Based on fiverr-conversation-extractor patterns
 */

class FiverrExtractor {
  constructor() {
    this.conversationCache = new Map();
    this.extractionInProgress = false;
    this.storedConversations = new Map();
    this.loadStoredConversations();
  }

  /**
   * Load stored conversations from storage
   */
  async loadStoredConversations() {
    try {
      const stored = await storageManager.get('fiverrConversations');
      if (stored) {
        this.storedConversations = new Map(Object.entries(stored));
      }
    } catch (error) {
      console.error('Failed to load stored conversations:', error);
    }
  }

  /**
   * Save conversation to storage
   */
  async saveConversation(username, conversationData) {
    try {
      const conversationWithMeta = {
        ...conversationData,
        lastExtracted: Date.now(),
        lastUpdated: Date.now()
      };

      this.storedConversations.set(username, conversationWithMeta);

      const storageData = Object.fromEntries(this.storedConversations);
      await storageManager.set({ 'fiverrConversations': storageData });

      // Also save to cache
      this.conversationCache.set(username, {
        data: conversationData,
        timestamp: Date.now()
      });

      // Sync individual conversation to Google Drive
      await this.syncConversationToGoogleDrive(username, conversationWithMeta);

      return true;
    } catch (error) {
      console.error('Failed to save conversation:', error);
      return false;
    }
  }

  /**
   * Get stored conversation
   */
  getStoredConversation(username) {
    return this.storedConversations.get(username);
  }

  /**
   * Get all stored conversations
   */
  getAllStoredConversations() {
    return Array.from(this.storedConversations.entries()).map(([username, data]) => ({
      username,
      ...data
    }));
  }

  /**
   * Extract conversation data from current page
   */
  async extractConversation(forceRefresh = false) {
    if (this.extractionInProgress) {
      return null;
    }

    this.extractionInProgress = true;

    try {
      const username = this.extractUsernameFromUrl();
      if (!username) {
        throw new Error('Could not extract username from URL');
      }

      // Check if we should use cached/stored data
      if (!forceRefresh) {
        // Check cache first
        if (this.conversationCache.has(username)) {
          const cached = this.conversationCache.get(username);
          if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes cache
            return cached.data;
          }
        }

        // Check stored conversation
        const stored = this.getStoredConversation(username);
        if (stored && Date.now() - stored.lastExtracted < 30 * 60 * 1000) { // 30 minutes
          return stored;
        }
      }

      const conversationData = await this.fetchConversationData(username);

      // Save to storage and cache
      await this.saveConversation(username, conversationData);

      return conversationData;
    } catch (error) {
      console.error('Conversation extraction failed:', error);
      return null;
    } finally {
      this.extractionInProgress = false;
    }
  }

  /**
   * Extract username from current URL
   */
  extractUsernameFromUrl() {
    const url = window.location.href;
    const match = url.match(/\/inbox\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch conversation data from Fiverr API
   */
  async fetchConversationData(username) {
    try {
      let allMessages = [];
      let lastPage = false;
      let timestamp = null;
      let batchNumber = 1;
      let conversationId = null;

      while (!lastPage && batchNumber <= 10) { // Limit to 10 batches for safety
        const url = timestamp 
          ? `https://www.fiverr.com/inbox/contacts/${username}/conversation?timestamp=${timestamp}`
          : `https://www.fiverr.com/inbox/contacts/${username}/conversation`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch conversation: ${response.status}`);
        }

        const data = await response.json();
        
        if (!conversationId) {
          conversationId = data.conversationId;
        }

        // Process messages
        const processedMessages = await Promise.all(data.messages.map(async message => ({
          ...message,
          formattedTime: this.formatDate(message.createdAt),
          attachments: await Promise.all((message.attachments || []).map(async attachment => ({
            filename: attachment.file_name,
            downloadUrl: attachment.download_url,
            fileSize: attachment.file_size,
            contentType: attachment.content_type,
            created_at: attachment.created_at || message.createdAt,
            formattedTime: this.formatDate(attachment.created_at || message.createdAt)
          }))),
          repliedToMessage: message.repliedToMessage ? {
            ...message.repliedToMessage,
            formattedTime: this.formatDate(message.repliedToMessage.createdAt)
          } : null
        })));

        allMessages = [...allMessages, ...processedMessages];
        lastPage = data.lastPage;

        if (!lastPage && processedMessages.length > 0) {
          timestamp = Math.min(...processedMessages.map(m => m.createdAt));
        }

        batchNumber++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return {
        conversationId,
        username,
        messages: allMessages.sort((a, b) => a.createdAt - b.createdAt),
        extractedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to fetch conversation data:', error);
      throw error;
    }
  }

  /**
   * Extract visible messages from DOM
   */
  extractVisibleMessages() {
    const messages = [];
    
    const messageSelectors = [
      '[data-testid*="message"]',
      '.message-bubble',
      '.chat-message',
      '.conversation-message'
    ];

    messageSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const messageData = this.parseMessageElement(element);
        if (messageData) {
          messages.push(messageData);
        }
      });
    });

    return messages;
  }

  /**
   * Parse individual message element
   */
  parseMessageElement(element) {
    try {
      const textContent = element.textContent?.trim();
      if (!textContent) return null;

      // Try to determine sender
      const isOutgoing = element.closest('[data-testid*="outgoing"]') || 
                        element.classList.contains('outgoing') ||
                        element.classList.contains('sent');

      // Extract timestamp if available
      const timeElement = element.querySelector('[data-testid*="time"], .timestamp, .message-time');
      const timestamp = timeElement ? timeElement.textContent.trim() : null;

      return {
        content: textContent,
        isOutgoing,
        timestamp,
        element,
        extractedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to parse message element:', error);
      return null;
    }
  }

  /**
   * Extract brief/project details
   */
  extractBriefDetails() {
    if (!isFiverrBriefPage()) return null;

    try {
      const briefData = {
        title: this.extractBriefTitle(),
        description: this.extractBriefDescription(),
        overview: this.extractBriefOverview(),
        requirements: this.extractBriefRequirements(),
        budget: this.extractBriefBudget(),
        deadline: this.extractBriefDeadline(),
        skills: this.extractBriefSkills(),
        extractedAt: Date.now()
      };

      return briefData;
    } catch (error) {
      console.error('Failed to extract brief details:', error);
      return null;
    }
  }

  /**
   * Extract brief title
   */
  extractBriefTitle() {
    const selectors = [
      '[data-testid*="title"]',
      '.brief-title',
      '.project-title',
      'h1',
      'h2'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extract brief description
   */
  extractBriefDescription() {
    const selectors = [
      '[data-testid*="description"]',
      '.brief-description',
      '.project-description',
      '.brief-content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extract brief requirements
   */
  extractBriefRequirements() {
    const selectors = [
      '[data-testid*="requirements"]',
      '.brief-requirements',
      '.project-requirements'
    ];

    const requirements = [];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent.trim();
        if (text && !requirements.includes(text)) {
          requirements.push(text);
        }
      });
    });

    return requirements;
  }

  /**
   * Extract brief budget
   */
  extractBriefBudget() {
    const selectors = [
      '[data-testid*="budget"]',
      '.brief-budget',
      '.project-budget'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        const budgetMatch = text.match(/\$[\d,]+/);
        if (budgetMatch) {
          return budgetMatch[0];
        }
      }
    }

    return null;
  }

  /**
   * Extract brief deadline
   */
  extractBriefDeadline() {
    const selectors = [
      '[data-testid*="deadline"]',
      '.brief-deadline',
      '.project-deadline'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Extract brief skills
   */
  extractBriefSkills() {
    const selectors = [
      '[data-testid*="skills"]',
      '.brief-skills',
      '.project-skills',
      '.skill-tag'
    ];

    const skills = [];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent.trim();
        if (text && !skills.includes(text)) {
          skills.push(text);
        }
      });
    });

    return skills;
  }

  /**
   * Extract brief overview from "Create an offer" section
   */
  extractBriefOverview() {
    const overviewSelectors = [
      '[data-testid*="overview"]',
      '.brief-overview',
      '.project-overview',
      '.offer-overview',
      '.brief-summary'
    ];

    // First try direct selectors
    for (const selector of overviewSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // If it's a heading, look for the next content element
        if (element.tagName.match(/^H[1-6]$/)) {
          const nextElement = element.nextElementSibling;
          if (nextElement && nextElement.textContent.trim()) {
            return nextElement.textContent.trim();
          }
        } else if (element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
    }

    // Try to find overview by looking for headings containing "overview"
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const heading of headings) {
      if (heading.textContent.toLowerCase().includes('overview')) {
        const nextElement = heading.nextElementSibling;
        if (nextElement && nextElement.textContent.trim()) {
          return nextElement.textContent.trim();
        }
      }
    }

    // Fallback: look for any element with "overview" class or data attribute
    const fallbackElements = document.querySelectorAll('[class*="overview"], [data-*="overview"]');
    for (const element of fallbackElements) {
      if (element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * Format date for display
   */
  formatDate(timestamp) {
    try {
      const date = new Date(parseInt(timestamp));
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const time = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      });
      
      return `${day}/${month}/${year}, ${time}`;
    } catch (error) {
      return 'Unknown time';
    }
  }

  /**
   * Convert conversation to context string
   */
  conversationToContext(conversationData) {
    if (!conversationData || !conversationData.messages) {
      return '';
    }

    let context = `Conversation with ${conversationData.username}:\n\n`;
    
    conversationData.messages.forEach(message => {
      const sender = message.sender || 'Unknown';
      const time = message.formattedTime || 'Unknown time';
      
      context += `${sender} (${time}):\n${message.body}\n\n`;
      
      if (message.attachments && message.attachments.length > 0) {
        context += 'Attachments:\n';
        message.attachments.forEach(attachment => {
          context += `- ${attachment.filename}\n`;
        });
        context += '\n';
      }
    });

    return context;
  }

  /**
   * Get conversation summary for AI context with intelligent context management
   */
  getConversationSummary(conversationData, maxLength = 2000) {
    const fullContext = this.conversationToContext(conversationData);

    if (fullContext.length <= maxLength) {
      return fullContext;
    }

    // Take the most recent messages that fit within the limit
    let summary = `Conversation with ${conversationData.username} (recent messages):\n\n`;
    let currentLength = summary.length;

    for (let i = conversationData.messages.length - 1; i >= 0; i--) {
      const message = conversationData.messages[i];
      const messageText = `${message.sender}: ${message.body}\n\n`;

      if (currentLength + messageText.length > maxLength) {
        break;
      }

      summary = summary + messageText;
      currentLength += messageText.length;
    }

    return summary;
  }

  /**
   * Get intelligent conversation context based on use case
   */
  getIntelligentContext(conversationData, contextType = 'recent', maxLength = 4000) {
    if (!conversationData || !conversationData.messages) {
      return '';
    }

    switch (contextType) {
      case 'recent':
        return this.getRecentContext(conversationData, maxLength);
      case 'summary':
        return this.getConversationSummary(conversationData, maxLength);
      case 'key_points':
        return this.getKeyPointsContext(conversationData, maxLength);
      case 'project_focused':
        return this.getProjectFocusedContext(conversationData, maxLength);
      default:
        return this.getRecentContext(conversationData, maxLength);
    }
  }

  /**
   * Get recent messages with smart truncation
   */
  getRecentContext(conversationData, maxLength = 4000) {
    const messages = conversationData.messages;
    if (!messages || messages.length === 0) return '';

    let context = `Recent conversation with ${conversationData.username}:\n\n`;
    let currentLength = context.length;
    let includedMessages = 0;

    // Start from most recent and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageText = `${message.sender} (${message.formattedTime}):\n${message.body}\n\n`;

      if (currentLength + messageText.length > maxLength) {
        break;
      }

      context = context + messageText;
      currentLength += messageText.length;
      includedMessages++;
    }

    // Add summary info if we truncated
    if (includedMessages < messages.length) {
      const truncatedCount = messages.length - includedMessages;
      context = `[Showing ${includedMessages} most recent messages. ${truncatedCount} earlier messages truncated]\n\n` + context;
    }

    return context;
  }

  /**
   * Extract key points and important messages
   */
  getKeyPointsContext(conversationData, maxLength = 4000) {
    const messages = conversationData.messages;
    if (!messages || messages.length === 0) return '';

    // Keywords that indicate important content
    const importantKeywords = [
      'requirement', 'deadline', 'budget', 'price', 'cost', 'timeline',
      'deliverable', 'milestone', 'revision', 'feedback', 'approval',
      'project', 'brief', 'specification', 'scope', 'feature'
    ];

    let context = `Key points from conversation with ${conversationData.username}:\n\n`;
    let currentLength = context.length;
    let keyMessages = [];

    // Find messages with important keywords
    messages.forEach((message, index) => {
      const messageBody = message.body.toLowerCase();
      const hasImportantContent = importantKeywords.some(keyword =>
        messageBody.includes(keyword)
      );

      if (hasImportantContent || message.attachments?.length > 0) {
        keyMessages.push({ ...message, index });
      }
    });

    // If no key messages found, fall back to recent messages
    if (keyMessages.length === 0) {
      return this.getRecentContext(conversationData, maxLength);
    }

    // Add key messages
    for (const message of keyMessages) {
      const messageText = `${message.sender} (${message.formattedTime}):\n${message.body}\n\n`;

      if (currentLength + messageText.length > maxLength) {
        break;
      }

      context += messageText;
      currentLength += messageText.length;
    }

    return context;
  }

  /**
   * Get project-focused context (requirements, brief, etc.)
   */
  getProjectFocusedContext(conversationData, maxLength = 4000) {
    const messages = conversationData.messages;
    if (!messages || messages.length === 0) return '';

    // Project-related keywords
    const projectKeywords = [
      'brief', 'requirement', 'specification', 'scope', 'feature',
      'design', 'development', 'deliverable', 'milestone', 'timeline'
    ];

    let context = `Project details from conversation with ${conversationData.username}:\n\n`;
    let currentLength = context.length;

    // Find first few messages (usually contain project brief)
    const initialMessages = messages.slice(0, Math.min(5, messages.length));

    for (const message of initialMessages) {
      const messageText = `${message.sender} (${message.formattedTime}):\n${message.body}\n\n`;

      if (currentLength + messageText.length > maxLength) {
        break;
      }

      context += messageText;
      currentLength += messageText.length;
    }

    // Add recent messages if space allows
    if (currentLength < maxLength * 0.7) {
      const recentMessages = messages.slice(-3);
      context += '\n--- Recent Messages ---\n\n';

      for (const message of recentMessages) {
        const messageText = `${message.sender}: ${message.body}\n\n`;

        if (currentLength + messageText.length > maxLength) {
          break;
        }

        context += messageText;
        currentLength += messageText.length;
      }
    }

    return context;
  }

  /**
   * Fetch all contacts from Fiverr
   */
  async fetchAllContacts() {
    try {
      let allContacts = [];
      let oldestTimestamp = null;
      let batchNumber = 1;

      // Notify about progress
      this.notifyProgress('CONTACTS_PROGRESS', `Starting to fetch contacts...`);

      while (batchNumber <= 20) { // Limit to 20 batches for safety
        const url = oldestTimestamp
          ? `https://www.fiverr.com/inbox/contacts?older_than=${oldestTimestamp}`
          : 'https://www.fiverr.com/inbox/contacts';

        this.notifyProgress('CONTACTS_PROGRESS', `Fetching batch ${batchNumber}...`);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
        }

        const contacts = await response.json();

        if (!contacts || contacts.length === 0) {
          this.notifyProgress('CONTACTS_PROGRESS', 'No more contacts found.');
          break;
        }

        // Add contacts to our collection
        allContacts = [...allContacts, ...contacts];

        // Find the oldest timestamp
        const timestamps = contacts.map(c => c.recentMessageDate);
        oldestTimestamp = Math.min(...timestamps);

        this.notifyProgress('CONTACTS_PROGRESS',
          `Batch ${batchNumber}: Found ${contacts.length} contacts (Total: ${allContacts.length})`,
          { totalContacts: allContacts.length }
        );

        batchNumber++;

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Save contacts to storage
      await storageManager.set('fiverrContacts', {
        contacts: allContacts,
        lastFetched: Date.now(),
        totalCount: allContacts.length
      });

      this.notifyProgress('CONTACTS_FETCHED',
        `Completed! Total contacts found: ${allContacts.length}`,
        { contacts: allContacts }
      );

      return allContacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      this.notifyProgress('CONTACTS_ERROR', error.message, { isError: true });
      throw error;
    }
  }

  /**
   * Get stored contacts
   */
  async getStoredContacts() {
    try {
      const stored = await storageManager.get('fiverrContacts');
      return stored || { contacts: [], lastFetched: 0, totalCount: 0 };
    } catch (error) {
      console.error('Failed to get stored contacts:', error);
      return { contacts: [], lastFetched: 0, totalCount: 0 };
    }
  }

  /**
   * Extract conversation for specific username
   */
  async extractConversationByUsername(username, forceRefresh = false) {
    try {
      // Check if we should use stored data
      if (!forceRefresh) {
        const stored = this.getStoredConversation(username);
        if (stored && Date.now() - stored.lastExtracted < 30 * 60 * 1000) { // 30 minutes
          return stored;
        }
      }

      this.notifyProgress('EXTRACTION_PROGRESS', `Extracting conversation with ${username}...`);

      const conversationData = await this.fetchConversationData(username);

      // Save to storage
      await this.saveConversation(username, conversationData);

      this.notifyProgress('CONVERSATION_EXTRACTED',
        `Conversation with ${username} extracted successfully!`,
        { conversation: conversationData, username }
      );

      return conversationData;
    } catch (error) {
      console.error(`Failed to extract conversation for ${username}:`, error);
      this.notifyProgress('EXTRACTION_ERROR', error.message, { isError: true });
      throw error;
    }
  }

  /**
   * Update conversation with new messages only
   */
  async updateConversation(username) {
    try {
      const stored = this.getStoredConversation(username);
      if (!stored) {
        // No stored conversation, extract full conversation
        return await this.extractConversationByUsername(username, true);
      }

      this.notifyProgress('EXTRACTION_PROGRESS', `Updating conversation with ${username}...`);

      // Get the latest message timestamp from stored conversation
      const latestTimestamp = stored.messages && stored.messages.length > 0
        ? Math.max(...stored.messages.map(m => m.createdAt))
        : 0;

      // Fetch only newer messages
      const newMessages = await this.fetchNewMessages(username, latestTimestamp);

      if (newMessages.length > 0) {
        // Merge with existing messages
        const updatedConversation = {
          ...stored,
          messages: [...stored.messages, ...newMessages].sort((a, b) => a.createdAt - b.createdAt),
          lastUpdated: Date.now()
        };

        await this.saveConversation(username, updatedConversation);

        this.notifyProgress('CONVERSATION_UPDATED',
          `Added ${newMessages.length} new messages to conversation with ${username}`,
          { conversation: updatedConversation, newMessages: newMessages.length }
        );

        return updatedConversation;
      } else {
        this.notifyProgress('CONVERSATION_UPDATED',
          `No new messages found for ${username}`,
          { conversation: stored, newMessages: 0 }
        );
        return stored;
      }
    } catch (error) {
      console.error(`Failed to update conversation for ${username}:`, error);
      this.notifyProgress('EXTRACTION_ERROR', error.message, { isError: true });
      throw error;
    }
  }

  /**
   * Fetch only new messages since a timestamp
   */
  async fetchNewMessages(username, sinceTimestamp) {
    try {
      const url = `https://www.fiverr.com/inbox/contacts/${username}/conversation`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch new messages: ${response.status}`);
      }

      const data = await response.json();

      // Filter messages newer than the timestamp
      const newMessages = data.messages.filter(message => message.createdAt > sinceTimestamp);

      // Process new messages
      const processedMessages = await Promise.all(newMessages.map(async message => ({
        ...message,
        formattedTime: this.formatDate(message.createdAt),
        attachments: await Promise.all((message.attachments || []).map(async attachment => ({
          filename: attachment.file_name,
          downloadUrl: attachment.download_url,
          fileSize: attachment.file_size,
          contentType: attachment.content_type,
          created_at: attachment.created_at || message.createdAt,
          formattedTime: this.formatDate(attachment.created_at || message.createdAt)
        }))),
        repliedToMessage: message.repliedToMessage ? {
          ...message.repliedToMessage,
          formattedTime: this.formatDate(message.repliedToMessage.createdAt)
        } : null
      })));

      return processedMessages;
    } catch (error) {
      console.error('Failed to fetch new messages:', error);
      return [];
    }
  }

  /**
   * Delete stored conversation
   */
  async deleteStoredConversation(username) {
    try {
      this.storedConversations.delete(username);
      this.conversationCache.delete(username);

      const storageData = Object.fromEntries(this.storedConversations);
      await storageManager.set('fiverrConversations', storageData);

      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  /**
   * Export conversation to different formats
   */
  async exportConversation(username, format = 'markdown') {
    const conversation = this.getStoredConversation(username);
    if (!conversation) {
      throw new Error(`No conversation found for ${username}`);
    }

    switch (format.toLowerCase()) {
      case 'markdown':
        return this.convertToMarkdown(conversation);
      case 'json':
        return JSON.stringify(conversation, null, 2);
      case 'txt':
        return this.conversationToContext(conversation);
      case 'csv':
        return this.convertToCSV(conversation);
      case 'html':
        return this.convertToHTML(conversation);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert conversation to CSV format
   */
  convertToCSV(conversationData) {
    if (!conversationData || !conversationData.messages) {
      return '';
    }

    let csv = 'Timestamp,Sender,Message,Attachments\n';

    conversationData.messages.forEach(message => {
      const timestamp = new Date(message.createdAt).toISOString();
      const sender = (message.sender || 'Unknown').replace(/"/g, '""');
      const body = (message.body || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const attachments = message.attachments && message.attachments.length > 0
        ? message.attachments.map(att => att.filename || 'Unknown file').join('; ')
        : '';

      csv += `"${timestamp}","${sender}","${body}","${attachments}"\n`;
    });

    return csv;
  }

  /**
   * Convert conversation to HTML format
   */
  convertToHTML(conversationData) {
    if (!conversationData || !conversationData.messages) {
      return '';
    }

    let html = `<!DOCTYPE html>
<html>
<head>
    <title>Conversation with ${conversationData.username}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .message.sender { background-color: #e3f2fd; }
        .message.recipient { background-color: #f3e5f5; }
        .message-header { font-weight: bold; margin-bottom: 5px; }
        .message-time { font-size: 12px; color: #666; }
        .message-body { margin-top: 10px; white-space: pre-wrap; }
        .attachments { margin-top: 10px; font-style: italic; color: #666; }
    </style>
</head>
<body>
    <h1>Conversation with ${conversationData.username}</h1>
`;

    conversationData.messages.forEach(message => {
      const timestamp = new Date(message.createdAt).toLocaleString();
      const sender = message.sender || 'Unknown';
      const isCurrentUser = sender === conversationData.username;

      html += `    <div class="message ${isCurrentUser ? 'sender' : 'recipient'}">
        <div class="message-header">${sender}</div>
        <div class="message-time">${timestamp}</div>
        <div class="message-body">${(message.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;

      if (message.attachments && message.attachments.length > 0) {
        html += `        <div class="attachments">Attachments: ${message.attachments.map(att => att.filename || 'Unknown file').join(', ')}</div>`;
      }

      html += `    </div>\n`;
    });

    html += `</body>
</html>`;

    return html;
  }

  /**
   * Convert conversation to markdown format
   */
  async convertToMarkdown(conversationData) {
    if (!conversationData || !conversationData.messages) {
      return '';
    }

    let markdown = `# Conversation with ${conversationData.username}\n\n`;
    markdown += `**Extracted:** ${new Date(conversationData.extractedAt).toLocaleString()}\n`;
    markdown += `**Total Messages:** ${conversationData.messages.length}\n\n`;

    for (const message of conversationData.messages) {
      const timestamp = await this.formatDate(message.createdAt);
      const sender = message.sender || 'Unknown';

      markdown += `### ${sender} (${timestamp})\n\n`;

      // Show replied-to message if exists
      if (message.repliedToMessage) {
        const repliedMsg = message.repliedToMessage;
        const repliedTime = await this.formatDate(repliedMsg.createdAt);
        markdown += `> Replying to ${repliedMsg.sender} (${repliedTime}):\n`;
        markdown += `> ${repliedMsg.body.replace(/\n/g, '\n> ')}\n\n`;
      }

      // Add message text
      if (message.body) {
        markdown += `${message.body}\n\n`;
      }

      // Add attachments if any
      if (message.attachments && message.attachments.length > 0) {
        markdown += '**Attachments:**\n';
        for (const attachment of message.attachments) {
          const fileName = attachment.filename || 'Unnamed File';
          const fileSize = this.formatFileSize(attachment.fileSize || 0);
          markdown += `- ${fileName} (${fileSize})\n`;
        }
        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'size unknown';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /**
   * Send progress notifications (local logging only)
   */
  notifyProgress(type, message, data = {}) {
    // Just log locally - no background script communication needed
    console.log(`aiFiverr: ${type} - ${message}`, data);
  }

  /**
   * Format date for display
   */
  formatDate(timestamp) {
    const date = new Date(parseInt(timestamp));
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Use fixed DD/MM/YYYY format
    const dateStr = `${day}/${month}/${year}`;
    return `${dateStr}, ${time}`;
  }

  /**
   * Fetch all contacts with pagination
   */
  async fetchAllContacts() {
    let allContacts = [];
    let oldestTimestamp = null;
    let batchNumber = 1;

    this.notifyProgress('CONTACTS_PROGRESS', 'Starting contact fetch...');

    try {
      while (true) {
        this.notifyProgress('CONTACTS_PROGRESS', `Fetching batch ${batchNumber}...`);

        const url = oldestTimestamp
          ? `https://www.fiverr.com/inbox/contacts?older_than=${oldestTimestamp}`
          : 'https://www.fiverr.com/inbox/contacts';

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
        }

        const contacts = await response.json();

        if (!contacts || contacts.length === 0) {
          this.notifyProgress('CONTACTS_PROGRESS', 'No more contacts found.');
          break;
        }

        // Add contacts to our collection
        allContacts = [...allContacts, ...contacts];

        // Find the oldest timestamp
        const timestamps = contacts.map(c => c.recentMessageDate);
        oldestTimestamp = Math.min(...timestamps);

        this.notifyProgress('CONTACTS_PROGRESS',
          `Batch ${batchNumber}: Found ${contacts.length} contacts (Total: ${allContacts.length})`,
          { totalContacts: allContacts.length }
        );

        batchNumber++;

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Save contacts to storage
      await storageManager.set('fiverrContacts', {
        contacts: allContacts,
        lastFetched: Date.now(),
        totalCount: allContacts.length
      });

      this.notifyProgress('CONTACTS_FETCHED',
        `Completed! Total contacts found: ${allContacts.length}`,
        { contacts: allContacts }
      );

      return allContacts;
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      this.notifyProgress('CONTACTS_ERROR', `Error fetching contacts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get stored contacts
   */
  async getStoredContacts() {
    const result = await storageManager.get('fiverrContacts');
    return result.fiverrContacts?.contacts || [];
  }

  /**
   * Clear conversation cache
   */
  clearCache() {
    this.conversationCache.clear();
  }

  /**
   * Analyze conversation to determine optimal context strategy
   */
  analyzeConversation(conversationData) {
    if (!conversationData || !conversationData.messages) {
      return { strategy: 'recent', reason: 'No conversation data' };
    }

    const messages = conversationData.messages;
    const messageCount = messages.length;
    const totalLength = this.conversationToContext(conversationData).length;

    // Analyze conversation characteristics
    const analysis = {
      messageCount,
      totalLength,
      averageMessageLength: totalLength / messageCount,
      hasAttachments: messages.some(m => m.attachments?.length > 0),
      hasLongMessages: messages.some(m => m.body.length > 500),
      timeSpan: this.getConversationTimeSpan(messages),
      keywordDensity: this.calculateKeywordDensity(messages)
    };

    // Determine optimal strategy
    let strategy = 'recent';
    let reason = 'Default strategy';

    if (totalLength > 10000) {
      if (analysis.keywordDensity.project > 0.3) {
        strategy = 'project_focused';
        reason = 'Large conversation with high project keyword density';
      } else if (analysis.keywordDensity.important > 0.2) {
        strategy = 'key_points';
        reason = 'Large conversation with important keywords';
      } else {
        strategy = 'summary';
        reason = 'Large conversation, using summary';
      }
    } else if (totalLength > 5000) {
      strategy = 'key_points';
      reason = 'Medium conversation, focusing on key points';
    } else {
      strategy = 'recent';
      reason = 'Small conversation, using recent messages';
    }

    return {
      strategy,
      reason,
      analysis,
      recommendation: this.getContextRecommendation(analysis)
    };
  }

  /**
   * Calculate keyword density in conversation
   */
  calculateKeywordDensity(messages) {
    const projectKeywords = ['brief', 'requirement', 'specification', 'scope', 'feature', 'design', 'development'];
    const importantKeywords = ['deadline', 'budget', 'price', 'cost', 'timeline', 'deliverable', 'milestone'];

    const totalWords = messages.reduce((sum, m) => sum + m.body.split(' ').length, 0);

    let projectMatches = 0;
    let importantMatches = 0;

    messages.forEach(message => {
      const words = message.body.toLowerCase().split(' ');
      projectMatches += words.filter(word => projectKeywords.includes(word)).length;
      importantMatches += words.filter(word => importantKeywords.includes(word)).length;
    });

    return {
      project: projectMatches / totalWords,
      important: importantMatches / totalWords,
      total: (projectMatches + importantMatches) / totalWords
    };
  }

  /**
   * Get conversation time span in hours
   */
  getConversationTimeSpan(messages) {
    if (messages.length < 2) return 0;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return (lastMessage.createdAt - firstMessage.createdAt) / (1000 * 60 * 60);
  }

  /**
   * Get context recommendation based on analysis
   */
  getContextRecommendation(analysis) {
    const recommendations = [];

    if (analysis.totalLength > 8000) {
      recommendations.push('Consider using conversation summary for better performance');
    }

    if (analysis.keywordDensity.project > 0.3) {
      recommendations.push('High project content detected - use project_focused context');
    }

    if (analysis.hasAttachments) {
      recommendations.push('Conversation contains attachments - ensure they are referenced in context');
    }

    if (analysis.timeSpan > 168) { // More than a week
      recommendations.push('Long conversation span - consider focusing on recent messages');
    }

    return recommendations;
  }

  /**
   * Sync conversation to Google Drive
   */
  async syncConversationToGoogleDrive(username, conversationData) {
    try {
      // Check if Google Drive client is available and user is authenticated
      if (!window.googleDriveClient) {
        return;
      }

      // Check authentication status
      const authResult = await window.googleDriveClient.testConnection();
      if (!authResult.success) {
        return;
      }

      const fileName = `fiverr-conversation-${username}-${new Date().toISOString().split('T')[0]}.json`;
      const description = `Fiverr conversation with ${username} - automatically synced`;

      await window.googleDriveClient.saveDataFile(fileName, {
        type: 'fiverr-conversation',
        username: username,
        timestamp: new Date().toISOString(),
        data: conversationData
      }, description);

      console.log(`aiFiverr Extractor: Synced conversation with ${username} to Google Drive`);
    } catch (error) {
      console.warn(`aiFiverr Extractor: Failed to sync conversation with ${username} to Google Drive:`, error);
      // Don't throw error - sync is optional
    }
  }
}

// Create global extractor instance - but only when explicitly called
function initializeFiverrExtractor() {
  if (!window.fiverrExtractor) {
    window.fiverrExtractor = new FiverrExtractor();
    console.log('aiFiverr: Fiverr Extractor created');
  }
  return window.fiverrExtractor;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeFiverrExtractor = initializeFiverrExtractor;

// REMOVED AUTO-INITIALIZATION - This was causing the Fiverr extractor to load on every website
// The Fiverr extractor should only be initialized when explicitly called by the main extension
