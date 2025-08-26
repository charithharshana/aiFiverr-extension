/**
 * Enhanced Prompt Management System v2.0 for aiFiverr Extension
 * Clean, robust architecture with comprehensive error handling
 */

class PromptManagerV2 {
  constructor() {
    this.defaultPrompts = new Map();
    this.customPrompts = new Map();
    this.favoritePrompts = new Set();
    this.initialized = false;
    this.storageManager = null;
    this.knowledgeBaseManager = null;
    this.eventListeners = new Map();
  }

  /**
   * Initialize the prompt manager with dependency injection
   */
  async init(storageManager = null, knowledgeBaseManager = null) {
    if (this.initialized) return true;

    try {
      // Use provided dependencies or wait for global ones
      this.storageManager = storageManager || await this.waitForStorageManager();
      this.knowledgeBaseManager = knowledgeBaseManager || window.knowledgeBaseManager;

      // Load all data
      await this.loadDefaultPrompts();
      await this.loadCustomPrompts();
      await this.loadFavoritePrompts();

      this.initialized = true;
      this.emit('initialized');
      console.log('aiFiverr: Prompt Manager v2 initialized successfully');
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Prompt Manager v2:', error);
      return false;
    }
  }

  /**
   * Wait for storage manager to be available
   */
  async waitForStorageManager(timeout = 10000) {
    const startTime = Date.now();
    
    while (!window.storageManager && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!window.storageManager) {
      throw new Error('Storage manager not available after timeout');
    }
    
    return window.storageManager;
  }

  /**
   * Load hardcoded default prompts
   */
  async loadDefaultPrompts() {
    const defaultPrompts = {
      'summary': {
        name: 'Summary',
        description: 'Summarize the below conversation and extract key details about the project',
        prompt: `Summarize the below conversation:

{conversation}

Extract and organize the following information:
1. **Project Overview**: What is the client asking for?
2. **Key Requirements**: Specific features, functionalities, or deliverables mentioned
3. **Timeline**: Any deadlines or time-sensitive information
4. **Budget**: Budget range or payment terms discussed
5. **Client Background**: Relevant information about the client or their business
6. **Next Steps**: What actions need to be taken
7. **Questions/Clarifications**: Any unclear points that need follow-up

Format the summary in a clear, professional manner that can be easily referenced later.`,
        knowledgeBaseFiles: []
      },
      'follow_up': {
        name: 'Follow-up',
        description: 'Generate a professional follow-up message for Fiverr conversations',
        prompt: `Based on this conversation: {conversation}

Generate a professional follow-up message that:
1. Acknowledges the client's requirements
2. Shows understanding of their needs
3. Provides next steps or asks relevant questions
4. Maintains a professional and friendly tone
5. Encourages continued communication

Use my bio information: {bio}

Keep the message concise but comprehensive.`,
        knowledgeBaseFiles: []
      },
      'proposal': {
        name: 'Proposal',
        description: 'Create a compelling project proposal based on client requirements',
        prompt: `Create a professional project proposal based on this conversation: {conversation}

Structure the proposal with:
1. **Project Understanding**: Restate what the client needs
2. **Proposed Solution**: How you'll address their requirements
3. **Deliverables**: What exactly they'll receive
4. **Timeline**: Realistic project timeline
5. **Investment**: Pricing structure (if discussed)
6. **Why Choose Me**: Your relevant experience and value proposition
7. **Next Steps**: Clear call-to-action

Use my bio: {bio}

Make it persuasive yet professional, focusing on value and results.`,
        knowledgeBaseFiles: []
      },
      'improve': {
        name: 'Improve',
        description: 'Improve message grammar, clarity and professionalism',
        prompt: `Improve this message: {conversation}

Make it:
- Grammatically correct
- Clear and concise
- Professional yet friendly
- Well-structured
- Engaging

Maintain the original meaning and intent. No explanations needed, just return the improved message.`,
        knowledgeBaseFiles: []
      }
    };

    this.defaultPrompts.clear();
    Object.entries(defaultPrompts).forEach(([key, prompt]) => {
      this.defaultPrompts.set(key, {
        ...prompt,
        id: key,
        isDefault: true,
        created: Date.now(),
        modified: Date.now()
      });
    });

    console.log(`aiFiverr: Loaded ${this.defaultPrompts.size} default prompts`);
  }

  /**
   * Load custom prompts from storage
   */
  async loadCustomPrompts() {
    try {
      if (!this.storageManager) {
        console.warn('aiFiverr: Storage manager not available for loading custom prompts');
        return;
      }

      const result = await this.storageManager.get('customPrompts');
      const prompts = result.customPrompts || {};

      this.customPrompts.clear();
      Object.entries(prompts).forEach(([key, prompt]) => {
        this.customPrompts.set(key, {
          ...prompt,
          id: key,
          isDefault: false
        });
      });

      console.log(`aiFiverr: Loaded ${this.customPrompts.size} custom prompts`);
    } catch (error) {
      console.error('aiFiverr: Failed to load custom prompts:', error);
    }
  }

  /**
   * Load favorite prompts from storage
   */
  async loadFavoritePrompts() {
    try {
      if (!this.storageManager) return;

      const result = await this.storageManager.get('favoritePrompts');
      const favorites = result.favoritePrompts || [];

      this.favoritePrompts.clear();
      favorites.forEach(key => this.favoritePrompts.add(key));

      console.log(`aiFiverr: Loaded ${this.favoritePrompts.size} favorite prompts`);
    } catch (error) {
      console.error('aiFiverr: Failed to load favorite prompts:', error);
    }
  }

  /**
   * Get a prompt by key (checks custom first, then default)
   */
  getPrompt(key) {
    if (!key) return null;
    return this.customPrompts.get(key) || this.defaultPrompts.get(key);
  }

  /**
   * Get all prompts (custom overrides default)
   */
  getAllPrompts() {
    const allPrompts = {};
    
    // Add default prompts first
    this.defaultPrompts.forEach((prompt, key) => {
      allPrompts[key] = prompt;
    });
    
    // Override with custom prompts
    this.customPrompts.forEach((prompt, key) => {
      allPrompts[key] = prompt;
    });
    
    return allPrompts;
  }

  /**
   * Get only custom prompts
   */
  getCustomPrompts() {
    return Object.fromEntries(this.customPrompts);
  }

  /**
   * Get only default prompts
   */
  getDefaultPrompts() {
    return Object.fromEntries(this.defaultPrompts);
  }

  /**
   * Get favorite prompts
   */
  getFavoritePrompts() {
    const allPrompts = this.getAllPrompts();
    const favorites = {};
    
    this.favoritePrompts.forEach(key => {
      if (allPrompts[key]) {
        favorites[key] = allPrompts[key];
      }
    });
    
    return favorites;
  }

  /**
   * Save a custom prompt with validation
   */
  async savePrompt(key, promptData) {
    try {
      // Validate input
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid prompt key');
      }
      
      if (!promptData || typeof promptData !== 'object') {
        throw new Error('Invalid prompt data');
      }
      
      if (!promptData.name || !promptData.prompt) {
        throw new Error('Prompt name and content are required');
      }

      // Create prompt object
      const prompt = {
        name: promptData.name.trim(),
        description: (promptData.description || '').trim(),
        prompt: promptData.prompt.trim(),
        knowledgeBaseFiles: promptData.knowledgeBaseFiles || [],
        isDefault: false,
        created: this.customPrompts.get(key)?.created || Date.now(),
        modified: Date.now()
      };

      // Save to memory
      this.customPrompts.set(key, { ...prompt, id: key });

      // Save to storage
      await this.saveCustomPromptsToStorage();

      this.emit('promptSaved', { key, prompt });
      console.log(`aiFiverr: Saved custom prompt: ${key}`);
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to save prompt:', error);
      throw error;
    }
  }

  /**
   * Convert default prompt to custom for editing
   */
  async convertDefaultToCustom(defaultKey) {
    try {
      const defaultPrompt = this.defaultPrompts.get(defaultKey);
      if (!defaultPrompt) {
        throw new Error(`Default prompt '${defaultKey}' not found`);
      }

      // Generate unique key for custom version
      let customKey = `${defaultKey}_custom`;
      let counter = 1;
      while (this.customPrompts.has(customKey)) {
        customKey = `${defaultKey}_custom_${counter}`;
        counter++;
      }

      // Create custom version
      const customPrompt = {
        name: `${defaultPrompt.name} (Custom)`,
        description: defaultPrompt.description,
        prompt: defaultPrompt.prompt,
        knowledgeBaseFiles: defaultPrompt.knowledgeBaseFiles || []
      };

      await this.savePrompt(customKey, customPrompt);
      
      this.emit('defaultConverted', { defaultKey, customKey });
      return customKey;
    } catch (error) {
      console.error('aiFiverr: Failed to convert default prompt:', error);
      throw error;
    }
  }

  /**
   * Save custom prompts to storage
   */
  async saveCustomPromptsToStorage() {
    if (!this.storageManager) {
      throw new Error('Storage manager not available');
    }

    const data = Object.fromEntries(this.customPrompts);
    await this.storageManager.set({ customPrompts: data });
  }

  /**
   * Event system for notifications
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`aiFiverr: Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      defaultPrompts: this.defaultPrompts.size,
      customPrompts: this.customPrompts.size,
      favoritePrompts: this.favoritePrompts.size,
      storageAvailable: !!this.storageManager,
      knowledgeBaseAvailable: !!this.knowledgeBaseManager
    };
  }
}

// Export for use
window.PromptManagerV2 = PromptManagerV2;
