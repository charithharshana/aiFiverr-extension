/**
 * Centralized Prompt Management System for aiFiverr Extension
 * Single source of truth for all prompt operations
 */

class PromptManager {
  constructor() {
    this.defaultPrompts = new Map();
    this.customPrompts = new Map();
    this.favoritePrompts = new Set();
    this.initialized = false;
    this.storageManager = null;
    this.knowledgeBaseManager = null;
  }

  /**
   * Initialize the prompt manager
   */
  async init() {
    if (this.initialized) return;

    // Wait for dependencies
    await this.waitForDependencies();

    // Load hardcoded default prompts
    this.loadDefaultPrompts();

    // Load custom prompts and favorites from storage
    await this.loadCustomPrompts();
    await this.loadFavoritePrompts();

    this.initialized = true;
    console.log('aiFiverr: Prompt Manager initialized');
  }

  /**
   * Wait for required dependencies
   */
  async waitForDependencies() {
    let attempts = 0;
    while ((!window.storageManager || !window.knowledgeBaseManager) && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    this.storageManager = window.storageManager;
    this.knowledgeBaseManager = window.knowledgeBaseManager;
    
    if (!this.storageManager) {
      console.warn('aiFiverr: Storage Manager not available');
    }
  }

  /**
   * Load hardcoded default prompts
   */
  loadDefaultPrompts() {
    const defaultPrompts = {
      'summary': {
        name: 'Summary',
        description: 'Summarize conversation',
        prompt: `Summarize the below conversation:

{conversation}

Extract key details about this project. Write a well-formatted summary. No explanations.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'follow_up': {
        name: 'Follow-up',
        description: 'Write follow-up message',
        prompt: `Write a short, friendly follow-up message based on this conversation:

{conversation}

Mention a specific detail we discussed and include clear next steps. No explanations.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'proposal': {
        name: 'Proposal',
        description: 'Create project proposal',
        prompt: `Create a short and concise project proposal (under 3000 characters) based on this:

{conversation}

extract and Include more example urls from my previous work.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'project_proposal': {
        name: 'Project Proposal',
        description: 'Create Fiverr proposal',
        prompt: `Create a short and concise project proposal (under 3000 characters) based on this:

{conversation}

extract and Include more example urls from my previous work.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'translate': {
        name: 'Translate',
        description: 'Translate text',
        prompt: `Translate this: {conversation}

Into this language: {language}

Provide only the translated text. No explanations.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve_translate': {
        name: 'Improve & Translate',
        description: 'Improve and translate',
        prompt: `Improve the grammar and tone of this message: {conversation}

Then, translate the improved message to English. Use my bio ({bio}) to add relevant details about me. No explanations.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve': {
        name: 'Improve',
        description: 'Improve message',
        prompt: `Improve this message: {conversation}

Make it grammatically correct, clear, and professional, but keep the original meaning. No explanations.`,
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      }
    };

    this.defaultPrompts.clear();
    Object.entries(defaultPrompts).forEach(([key, prompt]) => {
      this.defaultPrompts.set(key, {
        ...prompt,
        isDefault: true,
        created: Date.now(),
        modified: Date.now()
      });
    });

    console.log('aiFiverr: Loaded', this.defaultPrompts.size, 'hardcoded default prompts');
  }



  /**
   * Load custom prompts from storage (local and Google Drive)
   */
  async loadCustomPrompts() {
    try {
      if (!this.storageManager) return;

      // Load from local storage first
      const result = await this.storageManager.get('customPrompts');
      let prompts = result.customPrompts || {};

      // Try to load from Google Drive backup if local storage is empty
      // Delegate to knowledge base manager for consistency
      if (Object.keys(prompts).length === 0) {
        if (window.knowledgeBaseManager && typeof window.knowledgeBaseManager.syncCustomPromptsFromGoogleDrive === 'function') {
          // Let knowledge base manager handle the sync and reload from storage
          await window.knowledgeBaseManager.syncCustomPromptsFromGoogleDrive();
          const updatedResult = await this.storageManager.get('customPrompts');
          prompts = updatedResult.customPrompts || {};
        } else {
          // Fallback to old method if knowledge base manager not available
          const drivePrompts = await this.loadPromptsFromGoogleDrive();
          if (drivePrompts) {
            prompts = drivePrompts;
            // Save to local storage for faster access
            await this.storageManager.set({ customPrompts: prompts });
            console.log('aiFiverr: Restored prompts from Google Drive backup');
          }
        }
      }

      this.customPrompts.clear();
      Object.entries(prompts).forEach(([key, prompt]) => {
        this.customPrompts.set(key, {
          ...prompt,
          isDefault: false
        });
      });

      console.log('aiFiverr: Loaded', this.customPrompts.size, 'custom prompts');
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
      
      console.log('aiFiverr: Loaded', this.favoritePrompts.size, 'favorite prompts');
    } catch (error) {
      console.error('aiFiverr: Failed to load favorite prompts:', error);
    }
  }

  /**
   * Get a prompt by key (checks custom first, then default)
   */
  getPrompt(key) {
    return this.customPrompts.get(key) || this.defaultPrompts.get(key);
  }

  /**
   * Get all prompts (default + custom)
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
   * Get only default prompts
   */
  getDefaultPrompts() {
    return Object.fromEntries(this.defaultPrompts);
  }

  /**
   * Get only custom prompts
   */
  getCustomPrompts() {
    return Object.fromEntries(this.customPrompts);
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
   * Save a custom prompt (converts default to custom if needed)
   */
  async savePrompt(key, promptData) {
    try {
      const prompt = {
        ...promptData,
        isDefault: false,
        created: this.customPrompts.get(key)?.created || Date.now(),
        modified: Date.now()
      };
      
      this.customPrompts.set(key, prompt);
      
      // Save to storage
      await this.saveCustomPromptsToStorage();
      
      console.log('aiFiverr: Saved custom prompt:', key);
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to save prompt:', error);
      return false;
    }
  }

  /**
   * Delete a custom prompt
   */
  async deletePrompt(key) {
    try {
      if (!this.customPrompts.has(key)) {
        throw new Error('Cannot delete default prompt');
      }
      
      this.customPrompts.delete(key);
      this.favoritePrompts.delete(key);
      
      // Save to storage
      await this.saveCustomPromptsToStorage();
      await this.saveFavoritePromptsToStorage();
      
      console.log('aiFiverr: Deleted custom prompt:', key);
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to delete prompt:', error);
      return false;
    }
  }

  /**
   * Toggle favorite status of a prompt
   */
  async toggleFavorite(key) {
    try {
      if (this.favoritePrompts.has(key)) {
        this.favoritePrompts.delete(key);
      } else {
        this.favoritePrompts.add(key);
      }
      
      await this.saveFavoritePromptsToStorage();
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to toggle favorite:', error);
      return false;
    }
  }

  /**
   * Convert default prompt to custom for editing
   */
  async convertDefaultToCustom(key) {
    const defaultPrompt = this.defaultPrompts.get(key);
    if (!defaultPrompt) {
      throw new Error('Default prompt not found');
    }
    
    // Create custom version with modified name
    const customPrompt = {
      ...defaultPrompt,
      name: `${defaultPrompt.name} (Custom)`,
      isDefault: false,
      created: Date.now(),
      modified: Date.now()
    };
    
    // Generate unique key for custom version
    let customKey = `${key}_custom`;
    let counter = 1;
    while (this.customPrompts.has(customKey)) {
      customKey = `${key}_custom_${counter}`;
      counter++;
    }
    
    await this.savePrompt(customKey, customPrompt);
    return customKey;
  }

  /**
   * Save custom prompts to storage (both local and Google Drive)
   */
  async saveCustomPromptsToStorage() {
    if (!this.storageManager) return;

    const data = Object.fromEntries(this.customPrompts);

    // Save to local storage first
    await this.storageManager.set({ customPrompts: data });

    // Delegate Google Drive sync to knowledge base manager for consistency
    if (window.knowledgeBaseManager && typeof window.knowledgeBaseManager.syncToGoogleDrive === 'function') {
      await window.knowledgeBaseManager.syncToGoogleDrive('custom-prompts', data);
    } else {
      // Fallback to old method if knowledge base manager not available
      await this.savePromptsToGoogleDrive(data);
    }
  }

  /**
   * Save favorite prompts to storage
   */
  async saveFavoritePromptsToStorage() {
    if (!this.storageManager) return;

    const data = Array.from(this.favoritePrompts);
    await this.storageManager.set({ favoritePrompts: data });
  }

  /**
   * Save prompts to Google Drive for persistence
   */
  async savePromptsToGoogleDrive(promptsData) {
    try {
      if (!window.googleDriveClient || !window.googleAuthService) {
        console.log('aiFiverr: Google Drive not available for prompt backup');
        return;
      }

      // Check if user is authenticated
      if (!window.googleAuthService.isUserAuthenticated()) {
        console.log('aiFiverr: User not authenticated for Google Drive backup');
        return;
      }

      // Create JSON file with prompts data
      const promptsJson = JSON.stringify(promptsData, null, 2);
      const blob = new Blob([promptsJson], { type: 'application/json' });
      const file = new File([blob], 'aifiverr-custom-prompts.json', { type: 'application/json' });

      // Upload to Google Drive
      await window.googleDriveClient.uploadFile(
        file,
        'aifiverr-custom-prompts.json',
        'aiFiverr custom prompts backup',
        ['aifiverr', 'prompts', 'backup']
      );

      console.log('aiFiverr: Custom prompts backed up to Google Drive');
    } catch (error) {
      console.error('aiFiverr: Failed to backup prompts to Google Drive:', error);
    }
  }

  /**
   * Load prompts from Google Drive
   */
  async loadPromptsFromGoogleDrive() {
    try {
      if (!window.googleDriveClient || !window.googleAuthService) {
        return null;
      }

      if (!window.googleAuthService.isUserAuthenticated()) {
        return null;
      }

      // Search for prompts backup file
      const files = await window.googleDriveClient.searchFiles('aifiverr-custom-prompts.json');

      if (files.length === 0) {
        console.log('aiFiverr: No prompts backup found in Google Drive');
        return null;
      }

      // Get the most recent backup
      const latestFile = files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

      // Download and parse the file
      const blob = await window.googleDriveClient.downloadFile(latestFile.id);
      const text = await blob.text();
      const promptsData = JSON.parse(text);

      console.log('aiFiverr: Loaded prompts backup from Google Drive');
      return promptsData;
    } catch (error) {
      console.error('aiFiverr: Failed to load prompts from Google Drive:', error);
      return null;
    }
  }

  /**
   * Process prompt with variables and knowledge base files
   */
  async processPrompt(key, context = {}) {
    const prompt = this.getPrompt(key);
    if (!prompt) {
      throw new Error(`Prompt '${key}' not found`);
    }

    // Use knowledge base manager for processing if available
    if (this.knowledgeBaseManager) {
      return await this.knowledgeBaseManager.processPrompt(key, context);
    }

    // Fallback processing
    let processedPrompt = prompt.prompt;

    // Replace context variables
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      processedPrompt = processedPrompt.replace(regex, value);
    });

    // Ensure knowledgeBaseFiles is always an array
    let knowledgeBaseFiles = prompt.knowledgeBaseFiles || [];
    if (typeof knowledgeBaseFiles === 'string') {
      // Handle special string values like 'AUTO_LOAD_ALL'
      console.log('aiFiverr Prompt Manager: String knowledgeBaseFiles detected:', knowledgeBaseFiles);
      knowledgeBaseFiles = []; // Fallback to empty array since we don't have file resolution here
    } else if (!Array.isArray(knowledgeBaseFiles)) {
      console.warn('aiFiverr Prompt Manager: knowledgeBaseFiles is not an array, converting:', typeof knowledgeBaseFiles);
      knowledgeBaseFiles = [];
    }

    return {
      prompt: processedPrompt,
      knowledgeBaseFiles: knowledgeBaseFiles
    };
  }

  /**
   * Sync prompts with Google Drive (manual sync)
   */
  async syncWithGoogleDrive() {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isAuthenticated) {
        throw new Error('Google authentication required');
      }

      // Delegate to knowledge base manager for consistency
      if (window.knowledgeBaseManager && typeof window.knowledgeBaseManager.syncCustomPromptsFromGoogleDrive === 'function') {
        await window.knowledgeBaseManager.syncCustomPromptsFromGoogleDrive();

        // Reload prompts from storage after sync
        await this.loadCustomPrompts();

        console.log('aiFiverr: Prompts synced with Google Drive via knowledge base manager');
        return true;
      } else {
        // Fallback to old method if knowledge base manager not available
        const drivePrompts = await this.loadPromptsFromGoogleDrive();

        if (drivePrompts) {
          // Merge with local prompts (local takes precedence for conflicts)
          const localPrompts = Object.fromEntries(this.customPrompts);
          const mergedPrompts = { ...drivePrompts, ...localPrompts };

          // Update local storage
          this.customPrompts.clear();
          Object.entries(mergedPrompts).forEach(([key, prompt]) => {
            this.customPrompts.set(key, {
              ...prompt,
              isDefault: false
            });
          });

          // Save merged data back to both storages
          await this.saveCustomPromptsToStorage();

          console.log('aiFiverr: Prompts synced with Google Drive');
          return true;
        }

        return false;
      }
    } catch (error) {
      console.error('aiFiverr: Failed to sync with Google Drive:', error);
      throw error;
    }
  }

  /**
   * Export prompts for backup
   */
  exportPrompts() {
    const data = {
      customPrompts: Object.fromEntries(this.customPrompts),
      favoritePrompts: Array.from(this.favoritePrompts),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import prompts from backup
   */
  async importPrompts(jsonData) {
    try {
      const data = JSON.parse(jsonData);

      if (data.customPrompts) {
        // Merge with existing prompts
        Object.entries(data.customPrompts).forEach(([key, prompt]) => {
          this.customPrompts.set(key, {
            ...prompt,
            isDefault: false,
            imported: true,
            importDate: new Date().toISOString()
          });
        });

        await this.saveCustomPromptsToStorage();
      }

      if (data.favoritePrompts) {
        data.favoritePrompts.forEach(key => this.favoritePrompts.add(key));
        await this.saveFavoritePromptsToStorage();
      }

      console.log('aiFiverr: Prompts imported successfully');
      return true;
    } catch (error) {
      console.error('aiFiverr: Failed to import prompts:', error);
      throw error;
    }
  }
}

// Create global instance
window.promptManager = new PromptManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptManager;
}
