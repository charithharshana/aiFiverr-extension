/**
 * Export/Import Manager
 * Handles comprehensive data export/import for cross-browser compatibility
 */

class ExportImportManager {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'markdown'];
    this.exportVersion = '1.0.0';
  }

  /**
   * Export all data
   */
  async exportAllData(format = 'json') {
    try {
      const exportData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        format: format,
        data: {}
      };

      // Export sessions
      exportData.data.sessions = await this.exportSessions();
      
      // Export settings
      exportData.data.settings = await this.exportSettings();
      
      // Export knowledge base
      exportData.data.knowledgeBase = await this.exportKnowledgeBase();

      // Export custom prompts
      exportData.data.customPrompts = await this.exportCustomPrompts();

      // Export API keys (encrypted)
      exportData.data.apiKeys = await this.exportApiKeys();
      
      // Export statistics
      exportData.data.statistics = await this.exportStatistics();

      // Export Fiverr conversations
      exportData.data.fiverrConversations = await this.exportFiverrConversations();

      // Export Fiverr contacts
      exportData.data.fiverrContacts = await this.exportFiverrContacts();

      return this.formatExportData(exportData, format);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Export sessions only
   */
  async exportSessions(format = 'json') {
    try {
      const sessions = await sessionManager.getAllSessions();
      const exportData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        type: 'sessions',
        sessions: sessions.map(session => session.export())
      };

      return this.formatExportData(exportData, format);
    } catch (error) {
      console.error('Session export failed:', error);
      throw new Error('Failed to export sessions');
    }
  }

  /**
   * Export settings
   */
  async exportSettings() {
    try {
      const settings = await storageManager.getSettings();
      return {
        ...settings,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Settings export failed:', error);
      return {};
    }
  }

  /**
   * Export knowledge base
   */
  async exportKnowledgeBase() {
    try {
      const knowledgeBase = await storageManager.getKnowledgeBase();
      return {
        items: knowledgeBase,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Knowledge base export failed:', error);
      return { items: {} };
    }
  }

  /**
   * Export custom prompts
   */
  async exportCustomPrompts() {
    try {
      const customPrompts = await storageManager.get('customPrompts') || {};
      const favoritePrompts = await storageManager.get('favoritePrompts') || [];

      return {
        customPrompts: customPrompts.customPrompts || {},
        favoritePrompts: favoritePrompts.favoritePrompts || [],
        totalPrompts: Object.keys(customPrompts.customPrompts || {}).length,
        totalFavorites: (favoritePrompts.favoritePrompts || []).length,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Custom prompts export failed:', error);
      return {
        customPrompts: {},
        favoritePrompts: [],
        totalPrompts: 0,
        totalFavorites: 0
      };
    }
  }

  /**
   * Export API keys (with basic encryption)
   */
  async exportApiKeys() {
    try {
      const settings = await storageManager.getSettings();
      const apiKeys = settings.apiKeys || [];
      
      // Basic obfuscation for security
      const obfuscatedKeys = apiKeys.map(key => this.obfuscateApiKey(key));
      
      return {
        keys: obfuscatedKeys,
        count: apiKeys.length,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('API keys export failed:', error);
      return { keys: [], count: 0 };
    }
  }

  /**
   * Export usage statistics
   */
  async exportStatistics() {
    try {
      const keyStats = apiKeyManager.getKeyStats();
      const sessions = await sessionManager.getAllSessions();

      const sessionStats = {
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
        averageSessionLength: sessions.length > 0 ?
          sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0) / sessions.length : 0
      };

      return {
        apiKeys: keyStats,
        sessions: sessionStats,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Statistics export failed:', error);
      return {};
    }
  }

  /**
   * Export Fiverr conversations
   */
  async exportFiverrConversations() {
    try {
      if (!window.fiverrExtractor) {
        return { conversations: [], count: 0, exportedAt: Date.now() };
      }

      const conversations = window.fiverrExtractor.getAllStoredConversations();

      return {
        conversations: conversations.map(conv => ({
          username: conv.username,
          conversationId: conv.conversationId,
          messageCount: conv.messages?.length || 0,
          lastExtracted: conv.lastExtracted,
          lastUpdated: conv.lastUpdated,
          extractedAt: conv.extractedAt,
          // Include full conversation data
          messages: conv.messages || [],
          metadata: {
            totalAttachments: conv.messages?.reduce((sum, msg) => sum + (msg.attachments?.length || 0), 0) || 0,
            senders: conv.messages ? [...new Set(conv.messages.map(msg => msg.sender))] : [],
            firstMessageDate: conv.messages?.[0]?.createdAt,
            lastMessageDate: conv.messages?.[conv.messages.length - 1]?.createdAt
          }
        })),
        count: conversations.length,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Fiverr conversations export failed:', error);
      return { conversations: [], count: 0, exportedAt: Date.now() };
    }
  }

  /**
   * Export Fiverr contacts
   */
  async exportFiverrContacts() {
    try {
      if (!window.fiverrExtractor) {
        return { contacts: [], count: 0, exportedAt: Date.now() };
      }

      const contactsData = await window.fiverrExtractor.getStoredContacts();

      return {
        contacts: contactsData.contacts || [],
        count: contactsData.totalCount || 0,
        lastFetched: contactsData.lastFetched || 0,
        exportedAt: Date.now()
      };
    } catch (error) {
      console.error('Fiverr contacts export failed:', error);
      return { contacts: [], count: 0, exportedAt: Date.now() };
    }
  }

  /**
   * Format export data based on format
   */
  formatExportData(data, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return {
          content: JSON.stringify(data, null, 2),
          filename: `aifiverr-export-${Date.now()}.json`,
          mimeType: 'application/json'
        };
      
      case 'csv':
        return this.formatAsCSV(data);
      
      case 'markdown':
        return this.formatAsMarkdown(data);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Format data as CSV
   */
  formatAsCSV(data) {
    let csv = '';
    
    // Export sessions as CSV
    if (data.data?.sessions) {
      csv += 'Session Export\n';
      csv += 'Session ID,Title,Created,Last Updated,Message Count,Total Characters\n';

      data.data.sessions.forEach(session => {
        const stats = this.calculateSessionStats(session);
        csv += `"${session.sessionId}","${session.metadata.title}","${new Date(session.metadata.created).toISOString()}","${new Date(session.metadata.lastUpdated).toISOString()}",${session.metadata.messageCount},${stats.totalCharacters}\n`;
      });

      csv += '\n\nMessages Export\n';
      csv += 'Session ID,Role,Content,Timestamp\n';

      data.data.sessions.forEach(session => {
        session.messages.forEach(message => {
          csv += `"${session.sessionId}","${message.role}","${message.content.replace(/"/g, '""')}","${new Date(message.timestamp).toISOString()}"\n`;
        });
      });
    }

    // Export Fiverr conversations
    if (data.data?.fiverrConversations) {
      csv += '\n\nFiverr Conversations Export\n';
      csv += 'Username,Timestamp,Sender,Message,Attachments\n';

      Object.values(data.data.fiverrConversations).forEach(conversation => {
        if (conversation.messages) {
          conversation.messages.forEach(message => {
            const timestamp = new Date(message.createdAt).toISOString();
            const sender = (message.sender || 'Unknown').replace(/"/g, '""');
            const body = (message.body || '').replace(/"/g, '""').replace(/\n/g, ' ');
            const attachments = message.attachments && message.attachments.length > 0
              ? message.attachments.map(att => att.filename || 'Unknown file').join('; ')
              : '';

            csv += `"${conversation.username}","${timestamp}","${sender}","${body}","${attachments}"\n`;
          });
        }
      });
    }

    return {
      content: csv,
      filename: `aifiverr-export-${Date.now()}.csv`,
      mimeType: 'text/csv'
    };
  }

  /**
   * Format data as Markdown
   */
  formatAsMarkdown(data) {
    let markdown = `# aiFiverr Export\n\n`;
    markdown += `**Exported:** ${new Date(data.timestamp).toLocaleString()}\n`;
    markdown += `**Version:** ${data.version}\n\n`;

    // Export sessions
    if (data.data?.sessions) {
      markdown += `## Chat Sessions (${data.data.sessions.length})\n\n`;
      
      data.data.sessions.forEach(session => {
        markdown += `### ${session.metadata.title}\n\n`;
        markdown += `- **Created:** ${new Date(session.metadata.created).toLocaleString()}\n`;
        markdown += `- **Last Updated:** ${new Date(session.metadata.lastUpdated).toLocaleString()}\n`;
        markdown += `- **Messages:** ${session.metadata.messageCount}\n\n`;
        
        if (session.messages && session.messages.length > 0) {
          markdown += `#### Conversation\n\n`;
          session.messages.forEach(message => {
            const time = new Date(message.timestamp).toLocaleString();
            markdown += `**${message.role}** (${time}):\n${message.content}\n\n`;
          });
        }
        
        markdown += `---\n\n`;
      });
    }

    // Export knowledge base
    if (data.data?.knowledgeBase?.items) {
      markdown += `## Knowledge Base\n\n`;
      Object.entries(data.data.knowledgeBase.items).forEach(([key, value]) => {
        markdown += `- **${key}:** ${value}\n`;
      });
      markdown += `\n`;
    }

    // Export Fiverr conversations
    if (data.data?.fiverrConversations) {
      const conversations = Object.values(data.data.fiverrConversations);
      if (conversations.length > 0) {
        markdown += `## Fiverr Conversations (${conversations.length})\n\n`;

        conversations.forEach(conv => {
          markdown += `### Conversation with ${conv.username}\n\n`;
          markdown += `- **Messages:** ${conv.messages?.length || 0}\n`;
          markdown += `- **Last Extracted:** ${new Date(conv.lastExtracted || 0).toLocaleString()}\n`;

          if (conv.messages && conv.messages.length > 0) {
            const attachmentCount = conv.messages.reduce((total, msg) =>
              total + (msg.attachments?.length || 0), 0);
            markdown += `- **Attachments:** ${attachmentCount}\n`;

            const senders = [...new Set(conv.messages.map(msg => msg.sender))];
            markdown += `- **Participants:** ${senders.join(', ')}\n\n`;

            markdown += `#### Recent Messages (Last 5)\n\n`;
            const recentMessages = conv.messages.slice(-5);
            recentMessages.forEach(message => {
              const time = new Date(message.createdAt).toLocaleString();
              markdown += `**${message.sender}** (${time}):\n${message.body}\n\n`;

              if (message.attachments && message.attachments.length > 0) {
                markdown += `*Attachments: ${message.attachments.map(att => att.filename).join(', ')}*\n\n`;
              }
            });
          }

          markdown += `---\n\n`;
        });
      }
    }

    // Export Fiverr contacts
    if (data.data?.fiverrContacts?.contacts?.length > 0) {
      markdown += `## Fiverr Contacts (${data.data.fiverrContacts.count})\n\n`;
      markdown += `**Last Fetched:** ${new Date(data.data.fiverrContacts.lastFetched).toLocaleString()}\n\n`;

      const contacts = data.data.fiverrContacts.contacts.slice(0, 20); // Show first 20
      contacts.forEach(contact => {
        const lastMessage = new Date(contact.recentMessageDate).toLocaleString();
        markdown += `- **${contact.username}** - Last message: ${lastMessage}\n`;
      });

      if (data.data.fiverrContacts.contacts.length > 20) {
        markdown += `\n... and ${data.data.fiverrContacts.contacts.length - 20} more contacts\n`;
      }
      markdown += `\n`;
    }

    return {
      content: markdown,
      filename: `aifiverr-export-${Date.now()}.md`,
      mimeType: 'text/markdown'
    };
  }

  /**
   * Import data from file
   */
  async importData(fileContent, options = {}) {
    try {
      let importData;
      
      // Try to parse as JSON
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid import file format. Please provide a valid JSON export file.');
      }

      // Validate import data
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data structure');
      }

      // Check version compatibility
      if (!this.isVersionCompatible(importData.version)) {
        if (!options.forceImport) {
          throw new Error(`Incompatible export version: ${importData.version}. Current version: ${this.exportVersion}`);
        }
      }

      const results = {
        sessions: 0,
        settings: false,
        knowledgeBase: false,
        apiKeys: 0,
        fiverrConversations: 0,
        fiverrContacts: 0,
        errors: []
      };

      // Import sessions
      if (importData.data?.sessions) {
        try {
          results.sessions = await this.importSessions(importData.data.sessions);
        } catch (error) {
          results.errors.push(`Session import failed: ${error.message}`);
        }
      }

      // Import settings
      if (importData.data?.settings) {
        try {
          await this.importSettings(importData.data.settings);
          results.settings = true;
        } catch (error) {
          results.errors.push(`Settings import failed: ${error.message}`);
        }
      }

      // Import knowledge base
      if (importData.data?.knowledgeBase) {
        try {
          await this.importKnowledgeBase(importData.data.knowledgeBase);
          results.knowledgeBase = true;
        } catch (error) {
          results.errors.push(`Knowledge base import failed: ${error.message}`);
        }
      }

      // Import custom prompts
      if (importData.data?.customPrompts) {
        try {
          results.customPrompts = await this.importCustomPrompts(importData.data.customPrompts, options);
        } catch (error) {
          results.errors.push(`Custom prompts import failed: ${error.message}`);
        }
      }

      // Import API keys
      if (importData.data?.apiKeys && options.importApiKeys) {
        try {
          results.apiKeys = await this.importApiKeys(importData.data.apiKeys);
        } catch (error) {
          results.errors.push(`API keys import failed: ${error.message}`);
        }
      }

      // Import Fiverr conversations
      if (importData.data?.fiverrConversations) {
        try {
          results.fiverrConversations = await this.importFiverrConversations(importData.data.fiverrConversations);
        } catch (error) {
          results.errors.push(`Fiverr conversations import failed: ${error.message}`);
        }
      }

      // Import Fiverr contacts
      if (importData.data?.fiverrContacts) {
        try {
          results.fiverrContacts = await this.importFiverrContacts(importData.data.fiverrContacts);
        } catch (error) {
          results.errors.push(`Fiverr contacts import failed: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Import sessions
   */
  async importSessions(sessionsData) {
    let importedCount = 0;
    
    for (const sessionData of sessionsData) {
      try {
        const session = new ChatSession(sessionData.sessionId);
        session.messages = sessionData.messages || [];
        session.context = sessionData.context || '';
        session.metadata = sessionData.metadata || {};
        
        await session.save();
        importedCount++;
      } catch (error) {
        console.error(`Failed to import session ${sessionData.sessionId}:`, error);
      }
    }
    
    return importedCount;
  }

  /**
   * Import settings
   */
  async importSettings(settingsData) {
    // Merge with existing settings, preserving API keys unless explicitly importing
    const currentSettings = await storageManager.getSettings();
    const mergedSettings = {
      ...currentSettings,
      ...settingsData,
      apiKeys: currentSettings.apiKeys // Preserve existing API keys
    };
    
    await storageManager.saveSettings(mergedSettings);
  }

  /**
   * Import knowledge base
   */
  async importKnowledgeBase(knowledgeBaseData) {
    if (knowledgeBaseData.items) {
      await storageManager.saveKnowledgeBase(knowledgeBaseData.items);
    }
  }

  /**
   * Import custom prompts
   */
  async importCustomPrompts(customPromptsData, options = {}) {
    try {
      let importedCount = 0;
      let conflictCount = 0;

      if (!customPromptsData.customPrompts) {
        return { imported: 0, conflicts: 0 };
      }

      // Get existing data
      const existingCustomPrompts = await storageManager.get('customPrompts') || {};
      const existingFavoritePrompts = await storageManager.get('favoritePrompts') || [];

      const currentCustomPrompts = existingCustomPrompts.customPrompts || {};
      const currentFavoritePrompts = existingFavoritePrompts.favoritePrompts || [];

      // Handle custom prompts
      const mergedCustomPrompts = options.merge ? { ...currentCustomPrompts } : {};

      for (const [key, prompt] of Object.entries(customPromptsData.customPrompts)) {
        if (currentCustomPrompts[key] && options.merge) {
          // Handle conflict
          if (options.overwriteConflicts) {
            mergedCustomPrompts[key] = prompt;
            conflictCount++;
          } else {
            conflictCount++;
            continue; // Skip this prompt
          }
        } else {
          mergedCustomPrompts[key] = prompt;
          importedCount++;
        }
      }

      // Handle favorite prompts
      const mergedFavoritePrompts = options.merge
        ? [...new Set([...currentFavoritePrompts, ...(customPromptsData.favoritePrompts || [])])]
        : (customPromptsData.favoritePrompts || []);

      // Save merged data
      await storageManager.set({
        customPrompts: mergedCustomPrompts,
        favoritePrompts: mergedFavoritePrompts
      });

      return {
        imported: importedCount,
        conflicts: conflictCount,
        totalFavorites: mergedFavoritePrompts.length
      };
    } catch (error) {
      console.error('Import custom prompts failed:', error);
      throw new Error(`Failed to import custom prompts: ${error.message}`);
    }
  }

  /**
   * Import API keys
   */
  async importApiKeys(apiKeysData) {
    if (!apiKeysData.keys || !Array.isArray(apiKeysData.keys)) {
      return 0;
    }

    // Deobfuscate keys
    const deobfuscatedKeys = apiKeysData.keys.map(key => this.deobfuscateApiKey(key));

    // Update API keys
    await apiKeyManager.updateKeys(deobfuscatedKeys);

    return deobfuscatedKeys.length;
  }

  /**
   * Import Fiverr conversations
   */
  async importFiverrConversations(conversationsData) {
    if (!window.fiverrExtractor || !conversationsData.conversations) {
      return 0;
    }

    let importedCount = 0;

    for (const conv of conversationsData.conversations) {
      try {
        // Reconstruct conversation data
        const conversationData = {
          conversationId: conv.conversationId,
          username: conv.username,
          messages: conv.messages || [],
          extractedAt: conv.extractedAt || Date.now(),
          lastExtracted: conv.lastExtracted || Date.now(),
          lastUpdated: conv.lastUpdated || Date.now()
        };

        await window.fiverrExtractor.saveConversation(conv.username, conversationData);
        importedCount++;
      } catch (error) {
        console.error(`Failed to import conversation for ${conv.username}:`, error);
      }
    }

    return importedCount;
  }

  /**
   * Import Fiverr contacts
   */
  async importFiverrContacts(contactsData) {
    if (!window.fiverrExtractor || !contactsData.contacts) {
      return 0;
    }

    try {
      await storageManager.set('fiverrContacts', {
        contacts: contactsData.contacts,
        lastFetched: contactsData.lastFetched || Date.now(),
        totalCount: contactsData.count || contactsData.contacts.length
      });

      return contactsData.contacts.length;
    } catch (error) {
      console.error('Failed to import Fiverr contacts:', error);
      return 0;
    }
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    return data && 
           typeof data === 'object' && 
           data.version && 
           data.data && 
           typeof data.data === 'object';
  }

  /**
   * Check version compatibility
   */
  isVersionCompatible(version) {
    // For now, accept all versions starting with "1."
    return version && version.startsWith('1.');
  }

  /**
   * Basic API key obfuscation
   */
  obfuscateApiKey(key) {
    if (!key || typeof key !== 'string' || key.length < 8) return key;

    const start = key.substring(0, 4);
    const end = key.substring(key.length - 4);
    const middle = '*'.repeat(key.length - 8);

    return start + middle + end;
  }

  /**
   * Basic API key deobfuscation (placeholder - in real implementation, use proper encryption)
   */
  deobfuscateApiKey(obfuscatedKey) {
    // In a real implementation, this would decrypt properly encrypted keys
    // For now, return as-is since we're just doing basic obfuscation
    return obfuscatedKey;
  }

  /**
   * Calculate session statistics
   */
  calculateSessionStats(session) {
    const totalCharacters = session.messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const userMessages = session.messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = session.messages.filter(msg => msg.role === 'assistant').length;
    
    return {
      totalCharacters,
      userMessages,
      assistantMessages,
      averageMessageLength: session.messages.length > 0 ? totalCharacters / session.messages.length : 0
    };
  }

  /**
   * Download export data as file
   */
  downloadExport(exportData) {
    const blob = new Blob([exportData.content], { type: exportData.mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = exportData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Read file content
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Export only custom prompts to local file
   */
  async exportCustomPromptsOnly(format = 'json') {
    try {
      const customPromptsData = await this.exportCustomPrompts();

      const exportData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'custom_prompts',
        format: format,
        data: customPromptsData
      };

      return this.formatExportData(exportData, format, 'custom-prompts');
    } catch (error) {
      console.error('Custom prompts only export failed:', error);
      throw new Error('Failed to export custom prompts');
    }
  }

  /**
   * Export only knowledge base to local file
   */
  async exportKnowledgeBaseOnly(format = 'json') {
    try {
      const knowledgeBaseData = await this.exportKnowledgeBase();

      const exportData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'knowledge_base',
        format: format,
        data: knowledgeBaseData
      };

      return this.formatExportData(exportData, format, 'knowledge-base');
    } catch (error) {
      console.error('Knowledge base only export failed:', error);
      throw new Error('Failed to export knowledge base');
    }
  }

  /**
   * Export settings (custom prompts + knowledge base) to local file
   */
  async exportSettingsOnly(format = 'json') {
    try {
      const customPromptsData = await this.exportCustomPrompts();
      const knowledgeBaseData = await this.exportKnowledgeBase();

      const exportData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'settings',
        format: format,
        data: {
          customPrompts: customPromptsData,
          knowledgeBase: knowledgeBaseData
        }
      };

      return this.formatExportData(exportData, format, 'settings');
    } catch (error) {
      console.error('Settings only export failed:', error);
      throw new Error('Failed to export settings');
    }
  }

  /**
   * Format export data with appropriate filename prefix
   */
  formatExportData(exportData, format, filePrefix) {
    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'json':
        return {
          content: JSON.stringify(exportData, null, 2),
          filename: `aifiverr-${filePrefix}-${timestamp}.json`,
          mimeType: 'application/json'
        };

      case 'markdown':
        return {
          content: this.convertSettingsToMarkdown(exportData),
          filename: `aifiverr-${filePrefix}-${timestamp}.md`,
          mimeType: 'text/markdown'
        };

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert settings export data to markdown format
   */
  convertSettingsToMarkdown(exportData) {
    let markdown = `# aiFiverr ${exportData.type.replace('_', ' ').toUpperCase()} Export\n\n`;
    markdown += `**Export Date:** ${exportData.exportedAt}\n`;
    markdown += `**Export Type:** ${exportData.type}\n`;
    markdown += `**Version:** ${exportData.version}\n\n`;

    // Handle different export types
    if (exportData.type === 'custom_prompts') {
      return this.convertCustomPromptsToMarkdown(exportData, markdown);
    } else if (exportData.type === 'knowledge_base') {
      return this.convertKnowledgeBaseToMarkdown(exportData, markdown);
    } else if (exportData.type === 'settings') {
      return this.convertAllSettingsToMarkdown(exportData, markdown);
    }

    return markdown;
  }

  /**
   * Convert custom prompts to markdown
   */
  convertCustomPromptsToMarkdown(exportData, markdown) {
    const data = exportData.data;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Prompts:** ${data.totalPrompts}\n`;
    markdown += `- **Total Favorites:** ${data.totalFavorites}\n\n`;

    if (data.customPrompts && Object.keys(data.customPrompts).length > 0) {
      markdown += `## Custom Prompts\n\n`;
      Object.entries(data.customPrompts).forEach(([key, prompt]) => {
        markdown += `### ${prompt.name} (${key})\n\n`;
        markdown += `**Description:** ${prompt.description || 'No description'}\n\n`;
        markdown += `**Content:**\n\`\`\`\n${prompt.prompt}\n\`\`\`\n\n`;
        if (prompt.knowledgeBaseFiles && prompt.knowledgeBaseFiles.length > 0) {
          markdown += `**Knowledge Base Files:** ${prompt.knowledgeBaseFiles.join(', ')}\n\n`;
        }
        markdown += `**Created:** ${new Date(prompt.created).toLocaleString()}\n`;
        markdown += `**Modified:** ${new Date(prompt.modified).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    if (data.favoritePrompts && data.favoritePrompts.length > 0) {
      markdown += `## Favorite Prompts\n\n`;
      data.favoritePrompts.forEach(promptKey => {
        markdown += `- ${promptKey}\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Convert knowledge base to markdown
   */
  convertKnowledgeBaseToMarkdown(exportData, markdown) {
    const data = exportData.data;

    if (data.items && Object.keys(data.items).length > 0) {
      markdown += `## Knowledge Base Variables\n\n`;
      Object.entries(data.items).forEach(([key, value]) => {
        markdown += `### {{${key}}}\n\n`;
        markdown += `\`\`\`\n${value}\n\`\`\`\n\n`;
      });
    } else {
      markdown += `## Knowledge Base Variables\n\n`;
      markdown += `No variables found.\n\n`;
    }

    return markdown;
  }

  /**
   * Convert all settings to markdown
   */
  convertAllSettingsToMarkdown(exportData, markdown) {
    const customPrompts = exportData.data.customPrompts;
    const knowledgeBase = exportData.data.knowledgeBase;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Prompts:** ${customPrompts.totalPrompts}\n`;
    markdown += `- **Total Favorites:** ${customPrompts.totalFavorites}\n`;
    markdown += `- **Total Variables:** ${Object.keys(knowledgeBase.items || {}).length}\n\n`;

    // Add custom prompts section
    if (customPrompts.customPrompts && Object.keys(customPrompts.customPrompts).length > 0) {
      markdown += `## Custom Prompts\n\n`;
      Object.entries(customPrompts.customPrompts).forEach(([key, prompt]) => {
        markdown += `### ${prompt.name} (${key})\n\n`;
        markdown += `**Description:** ${prompt.description || 'No description'}\n\n`;
        markdown += `**Content:**\n\`\`\`\n${prompt.prompt}\n\`\`\`\n\n`;
        if (prompt.knowledgeBaseFiles && prompt.knowledgeBaseFiles.length > 0) {
          markdown += `**Knowledge Base Files:** ${prompt.knowledgeBaseFiles.join(', ')}\n\n`;
        }
        markdown += `**Created:** ${new Date(prompt.created).toLocaleString()}\n`;
        markdown += `**Modified:** ${new Date(prompt.modified).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Add knowledge base section
    if (knowledgeBase.items && Object.keys(knowledgeBase.items).length > 0) {
      markdown += `## Knowledge Base Variables\n\n`;
      Object.entries(knowledgeBase.items).forEach(([key, value]) => {
        markdown += `### {{${key}}}\n\n`;
        markdown += `\`\`\`\n${value}\n\`\`\`\n\n`;
      });
    }

    // Add favorites section
    if (customPrompts.favoritePrompts && customPrompts.favoritePrompts.length > 0) {
      markdown += `## Favorite Prompts\n\n`;
      customPrompts.favoritePrompts.forEach(promptKey => {
        markdown += `- ${promptKey}\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Import only custom prompts from file content
   */
  async importCustomPromptsOnly(fileContent, options = {}) {
    try {
      let importData;

      // Try to parse as JSON
      try {
        importData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid file format: must be JSON');
      }

      // Validate import data
      if (!importData.data || (!importData.data.customPrompts && !importData.data.customPrompts)) {
        throw new Error('Invalid import file: no custom prompts data found');
      }

      // Handle different export types
      let customPromptsData;
      if (importData.type === 'custom_prompts') {
        customPromptsData = importData.data;
      } else if (importData.type === 'settings' || importData.type === 'all_settings') {
        customPromptsData = importData.data.customPrompts;
      } else {
        throw new Error('Invalid import file: not a custom prompts export');
      }

      // Import the data
      const result = await this.importCustomPrompts(customPromptsData, options);

      return {
        success: true,
        imported: result.imported,
        conflicts: result.conflicts,
        totalFavorites: result.totalFavorites,
        message: `Imported ${result.imported} custom prompts${result.conflicts > 0 ? `, ${result.conflicts} conflicts ${options.overwriteConflicts ? 'resolved' : 'skipped'}` : ''}`
      };
    } catch (error) {
      console.error('Import custom prompts only failed:', error);
      throw new Error(`Failed to import custom prompts: ${error.message}`);
    }
  }

  /**
   * Import only knowledge base from file content
   */
  async importKnowledgeBaseOnly(fileContent, options = {}) {
    try {
      let importData;

      // Try to parse as JSON
      try {
        importData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid file format: must be JSON');
      }

      // Validate import data
      if (!importData.data || !importData.data.knowledgeBase && !importData.data.items) {
        throw new Error('Invalid import file: no knowledge base data found');
      }

      // Handle different export types
      let knowledgeBaseData;
      if (importData.type === 'knowledge_base') {
        knowledgeBaseData = importData.data;
      } else if (importData.type === 'settings' || importData.type === 'all_settings') {
        knowledgeBaseData = importData.data.knowledgeBase;
      } else {
        throw new Error('Invalid import file: not a knowledge base export');
      }

      // Import the data
      if (options.merge) {
        // Merge with existing knowledge base
        const existingKB = await storageManager.getKnowledgeBase() || {};
        const newItems = knowledgeBaseData.items || {};

        let imported = 0;
        let conflicts = 0;
        const mergedKB = { ...existingKB };

        for (const [key, value] of Object.entries(newItems)) {
          if (existingKB[key]) {
            conflicts++;
            if (options.overwriteConflicts) {
              mergedKB[key] = value;
            }
          } else {
            mergedKB[key] = value;
            imported++;
          }
        }

        await storageManager.saveKnowledgeBase(mergedKB);

        return {
          success: true,
          imported,
          conflicts,
          message: `Imported ${imported} variables${conflicts > 0 ? `, ${conflicts} conflicts ${options.overwriteConflicts ? 'resolved' : 'skipped'}` : ''}`
        };
      } else {
        // Replace existing knowledge base
        await this.importKnowledgeBase(knowledgeBaseData);
        const itemCount = Object.keys(knowledgeBaseData.items || {}).length;

        return {
          success: true,
          imported: itemCount,
          conflicts: 0,
          message: `Imported ${itemCount} variables`
        };
      }
    } catch (error) {
      console.error('Import knowledge base only failed:', error);
      throw new Error(`Failed to import knowledge base: ${error.message}`);
    }
  }

  /**
   * Import settings (custom prompts + knowledge base) from file content
   */
  async importSettingsOnly(fileContent, options = {}) {
    try {
      let importData;

      // Try to parse as JSON
      try {
        importData = JSON.parse(fileContent);
      } catch (jsonError) {
        throw new Error('Invalid file format: must be JSON');
      }

      // Validate import data
      if (!importData.data) {
        throw new Error('Invalid import file: no data found');
      }

      const results = {
        success: false,
        customPrompts: null,
        knowledgeBase: null,
        errors: []
      };

      // Import custom prompts if available
      if (importData.data.customPrompts || (importData.type === 'custom_prompts' && importData.data)) {
        try {
          const customPromptsData = importData.type === 'custom_prompts' ? importData.data : importData.data.customPrompts;
          results.customPrompts = await this.importCustomPrompts(customPromptsData, options);
        } catch (error) {
          results.errors.push(`Custom prompts import failed: ${error.message}`);
        }
      }

      // Import knowledge base if available
      if (importData.data.knowledgeBase || (importData.type === 'knowledge_base' && importData.data)) {
        try {
          const knowledgeBaseData = importData.type === 'knowledge_base' ? importData.data : importData.data.knowledgeBase;

          if (options.merge) {
            const existingKB = await storageManager.getKnowledgeBase() || {};
            const newItems = knowledgeBaseData.items || {};

            let imported = 0;
            let conflicts = 0;
            const mergedKB = { ...existingKB };

            for (const [key, value] of Object.entries(newItems)) {
              if (existingKB[key]) {
                conflicts++;
                if (options.overwriteConflicts) {
                  mergedKB[key] = value;
                }
              } else {
                mergedKB[key] = value;
                imported++;
              }
            }

            await storageManager.saveKnowledgeBase(mergedKB);
            results.knowledgeBase = { imported, conflicts };
          } else {
            await this.importKnowledgeBase(knowledgeBaseData);
            results.knowledgeBase = { imported: Object.keys(knowledgeBaseData.items || {}).length, conflicts: 0 };
          }
        } catch (error) {
          results.errors.push(`Knowledge base import failed: ${error.message}`);
        }
      }

      results.success = results.customPrompts || results.knowledgeBase;

      return results;
    } catch (error) {
      console.error('Import settings only failed:', error);
      throw new Error(`Failed to import settings: ${error.message}`);
    }
  }
}

// Create global export/import manager - but only when explicitly called
function initializeExportImportManager() {
  if (!window.exportImportManager) {
    window.exportImportManager = new ExportImportManager();
    console.log('aiFiverr: Export/Import Manager created');
  }
  return window.exportImportManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeExportImportManager = initializeExportImportManager;

// REMOVED AUTO-INITIALIZATION - This was causing the export/import manager to load on every website
// The export/import manager should only be initialized when explicitly called by the main extension
