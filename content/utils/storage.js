/**
 * Storage utilities for aiFiverr extension
 * Handles persistent storage of chat sessions, settings, and user data
 */

class StorageManager {
  constructor() {
    this.cache = new Map();
    this.syncInProgress = false;
    this.contextInvalidated = false;
    this.lastContextCheck = 0;
  }

  /**
   * Check if extension context is valid with throttling
   */
  isExtensionContextValid() {
    const now = Date.now();
    // Only check context every 5 seconds to avoid spam
    if (now - this.lastContextCheck < 5000 && this.contextInvalidated) {
      return false;
    }

    this.lastContextCheck = now;
    const isValid = !!(chrome.runtime?.id);

    if (!isValid && !this.contextInvalidated) {
      this.contextInvalidated = true;
      console.warn('aiFiverr: Extension context invalidated - storage operations will be limited');

      // Notify other components about context invalidation
      try {
        window.dispatchEvent(new CustomEvent('extensionContextInvalidated', {
          detail: { timestamp: Date.now() }
        }));
      } catch (error) {
        console.warn('aiFiverr: Could not dispatch context invalidation event:', error);
      }
    }

    return isValid;
  }

  /**
   * Get data from storage with caching
   */
  async get(keys) {
    try {
      // Check cache first
      if (typeof keys === 'string') {
        if (this.cache.has(keys)) {
          return { [keys]: this.cache.get(keys) };
        }
      }

      // Check if extension context is valid
      if (!this.isExtensionContextValid()) {
        // Return cached data if available, otherwise empty object
        if (typeof keys === 'string') {
          const cached = this.cache.get(keys);
          return cached !== undefined ? { [keys]: cached } : {};
        }
        return {};
      }

      const result = await chrome.storage.local.get(keys);

      // Update cache
      if (typeof keys === 'string') {
        this.cache.set(keys, result[keys]);
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          this.cache.set(key, result[key]);
        });
      } else {
        Object.entries(result).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
      }

      return result;
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        this.contextInvalidated = true;
        // Return cached data if available
        if (typeof keys === 'string') {
          const cached = this.cache.get(keys);
          return cached !== undefined ? { [keys]: cached } : {};
        }
        return {};
      }
      console.error('Storage get error:', error);
      return {};
    }
  }

  /**
   * Set data in storage and update cache
   */
  async set(data) {
    try {
      // Validate input
      if (!data || typeof data !== 'object') {
        throw new Error('Storage.set requires an object parameter');
      }

      // Check if extension context is valid
      if (!this.isExtensionContextValid()) {
        // Update cache only if context is invalid
        Object.entries(data).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        return false;
      }

      await chrome.storage.local.set(data);

      // Update cache
      Object.entries(data).forEach(([key, value]) => {
        this.cache.set(key, value);
      });

      return true;
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        this.contextInvalidated = true;
        // Update cache only
        Object.entries(data).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        return false;
      }
      console.error('Storage set error:', error);
      return false;
    }
  }

  /**
   * Remove data from storage and cache
   */
  async remove(keys) {
    try {
      await chrome.storage.local.remove(keys);
      
      // Update cache
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => {
        this.cache.delete(key);
      });

      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  /**
   * Clear all storage and cache
   */
  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * Get all storage data
   */
  async getAll() {
    try {
      // Check if extension context is valid
      if (!this.isExtensionContextValid()) {
        // Return all cached data
        const result = {};
        for (const [key, value] of this.cache.entries()) {
          result[key] = value;
        }
        return result;
      }

      const result = await chrome.storage.local.get(null);

      // Update cache with all data
      Object.entries(result).forEach(([key, value]) => {
        this.cache.set(key, value);
      });

      return result;
    } catch (error) {
      if (error.message?.includes('Extension context invalidated')) {
        this.contextInvalidated = true;
        // Return all cached data
        const result = {};
        for (const [key, value] of this.cache.entries()) {
          result[key] = value;
        }
        return result;
      }
      console.error('Storage getAll error:', error);
      return {};
    }
  }

  /**
   * Get storage usage information
   */
  async getUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
      return {
        used: usage,
        quota: quota,
        percentage: (usage / quota) * 100
      };
    } catch (error) {
      console.error('Storage usage error:', error);
      return { used: 0, quota: 0, percentage: 0 };
    }
  }

  /**
   * Session-specific storage methods
   */
  async getSession(sessionId) {
    const result = await this.get(`session_${sessionId}`);
    return result[`session_${sessionId}`] || null;
  }

  async saveSession(sessionId, sessionData) {
    return await this.set({
      [`session_${sessionId}`]: {
        ...sessionData,
        lastUpdated: Date.now()
      }
    });
  }

  async getAllSessions() {
    try {
      const allData = await this.getAll();
      const sessions = {};

      // Safely iterate through data
      if (allData && typeof allData === 'object') {
        Object.keys(allData).forEach(key => {
          try {
            if (key.startsWith('session_') && allData[key]) {
              sessions[key] = allData[key];
            }
          } catch (error) {
            console.warn(`aiFiverr: Error processing session key ${key}:`, error);
          }
        });
      }

      return sessions;
    } catch (error) {
      console.error('aiFiverr: Error getting all sessions:', error);
      return {};
    }
  }

  async deleteSession(sessionId) {
    return await this.remove(`session_${sessionId}`);
  }

  /**
   * Settings storage methods
   */
  async getSettings() {
    try {
      const result = await this.get('settings');

      // Validate settings data
      if (result && result.settings && typeof result.settings === 'object') {
        // Merge with defaults to ensure all required properties exist
        return { ...this.getDefaultSettings(), ...result.settings };
      }

      return this.getDefaultSettings();
    } catch (error) {
      console.error('aiFiverr: Error getting settings:', error);
      return this.getDefaultSettings();
    }
  }

  async saveSettings(settings) {
    return await this.set({ settings });
  }

  getDefaultSettings() {
    return {
      apiKeys: [],
      defaultModel: 'gemini-2.5-flash',
      selectedModel: 'gemini-2.5-flash', // User's selected model
      autoSave: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxSessions: 50,
      exportFormat: 'json',
      theme: 'auto',
      notifications: true,
      keyRotation: true,
      conversationContext: true,
      maxContextLength: 1000000, // 1M tokens - Gemini 2.5 Flash default context window
      restrictToFiverr: true // New setting: true = Fiverr only, false = all sites
    };
  }

  /**
   * Knowledge base storage methods
   */
  async getKnowledgeBase() {
    const result = await this.get('knowledgeBase');
    return result.knowledgeBase || {};
  }

  async saveKnowledgeBase(knowledgeBase) {
    return await this.set({ knowledgeBase });
  }

  async addKnowledgeItem(key, value) {
    const kb = await this.getKnowledgeBase();
    kb[key] = value;
    return await this.saveKnowledgeBase(kb);
  }

  async removeKnowledgeItem(key) {
    const kb = await this.getKnowledgeBase();
    delete kb[key];
    return await this.saveKnowledgeBase(kb);
  }

  /**
   * Export/Import functionality
   */
  async exportData() {
    const allData = await this.getAll();
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      data: allData
    };
  }

  async importData(importData) {
    try {
      if (!importData.version || !importData.data) {
        throw new Error('Invalid import data format');
      }

      // Clear existing data
      await this.clear();
      
      // Import new data
      await chrome.storage.local.set(importData.data);
      
      // Clear cache to force reload
      this.cache.clear();
      
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }

  /**
   * Cleanup old sessions
   */
  async cleanupOldSessions() {
    try {
      // Check if extension context is valid before proceeding
      if (!this.isExtensionContextValid()) {
        console.warn('aiFiverr: Cannot cleanup sessions - extension context invalidated');
        return 0;
      }

      const settings = await this.getSettings();
      const sessions = await this.getAllSessions();

      // Validate data before proceeding
      if (!settings || !sessions || typeof sessions !== 'object') {
        console.warn('aiFiverr: Invalid data for session cleanup');
        return 0;
      }

      const now = Date.now();
      const timeout = settings.sessionTimeout || (30 * 60 * 1000); // Default 30 minutes
      const maxSessions = settings.maxSessions || 50; // Default 50 sessions

      const sessionsToDelete = [];

      // Safely iterate through sessions
      Object.entries(sessions).forEach(([key, session]) => {
        try {
          if (session && session.lastUpdated && (now - session.lastUpdated) > timeout) {
            sessionsToDelete.push(key);
          }
        } catch (error) {
          console.warn(`aiFiverr: Error processing session ${key}:`, error);
        }
      });

      // Keep only the most recent sessions if we exceed the limit
      const sessionEntries = Object.entries(sessions)
        .filter(([key, session]) => session && typeof session === 'object')
        .sort(([,a], [,b]) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

      if (sessionEntries.length > maxSessions) {
        const excessSessions = sessionEntries.slice(maxSessions);
        excessSessions.forEach(([key]) => {
          if (!sessionsToDelete.includes(key)) {
            sessionsToDelete.push(key);
          }
        });
      }

      if (sessionsToDelete.length > 0) {
        await this.remove(sessionsToDelete);
      }

      return sessionsToDelete.length;
    } catch (error) {
      console.error('aiFiverr: Session cleanup error:', error);
      return 0;
    }
  }

  /**
   * Sync data across tabs
   */
  async syncAcrossTabs() {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    
    try {
      // Clear cache to force fresh data
      this.cache.clear();
      
      // Broadcast sync event to other tabs
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.warn('aiFiverr: Extension context invalidated, cannot sync across tabs');
          return;
        }

        chrome.runtime.sendMessage({
          type: 'STORAGE_SYNC',
          timestamp: Date.now()
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('aiFiverr: Storage sync error:', chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        console.warn('aiFiverr: Could not send sync message:', error.message);
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

// Create global storage manager - but only when explicitly called
function initializeStorageManager() {
  if (!window.storageManager) {
    window.storageManager = new StorageManager();
    console.log('aiFiverr: Storage Manager created');
  }
  return window.storageManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeStorageManager = initializeStorageManager;

// REMOVED AUTO-INITIALIZATION - This was causing the storage manager to load on every website
// The storage manager should only be initialized when explicitly called by the main extension
