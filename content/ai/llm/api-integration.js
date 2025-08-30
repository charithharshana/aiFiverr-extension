/**
 * API Key Integration for AI Assistance with aiFiverr Extension
 * Connects AI Assistance to the existing extension's API key management system
 */

import { SERVICES } from './types.js';

/**
 * API Key Manager for AI Assistance Integration
 */
export class AIAssistanceApiKeyManager {
  constructor() {
    this.initialized = false;
    this.keyCache = new Map();
    this.sessionKeys = new Map();
    this.rotationEnabled = false;
    this.currentKeyIndex = 0;
    // DO NOT auto-initialize - wait for explicit call
    // this.init();
  }

  async init() {
    try {
      // Connect to existing extension API key manager if available
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        console.log('LLM: Using existing API key manager');
        this.initialized = true;
        return;
      }

      // Initialize our own key management
      await this.loadApiKeys();
      this.initialized = true;
      console.log('LLM: API key manager initialized');
    } catch (error) {
      console.error('LLM: Failed to initialize API key manager:', error);
    }
  }

  /**
   * Get API key for a specific service and session
   */
  async getApiKey(service, sessionId = 'default') {
    try {
      // Try existing extension API key manager first
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        const keyData = window.apiKeyManager.getKeyForSession(sessionId);
        if (keyData && keyData.key) {
          return keyData.key;
        }
      }

      // Try our own key management
      const key = await this.getServiceApiKey(service);
      if (key) {
        return key;
      }

      // Try extension storage
      const storageKey = await this.getFromExtensionStorage(service);
      if (storageKey) {
        return storageKey;
      }

      // Try localStorage as fallback
      const localKey = this.getFromLocalStorage(service);
      if (localKey) {
        return localKey;
      }

      console.warn(`LLM: No API key found for service: ${service}`);
      return null;
    } catch (error) {
      console.error(`LLM: Error getting API key for ${service}:`, error);
      return null;
    }
  }

  /**
   * Set API key for a service
   */
  async setApiKey(service, apiKey, sessionId = 'default') {
    try {
      // Update existing extension API key manager if available
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        window.apiKeyManager.setKeyForSession(sessionId, apiKey);
      }

      // Store in our cache
      this.keyCache.set(service, apiKey);

      // Store in extension storage
      await this.saveToExtensionStorage(service, apiKey);

      // Store in localStorage as fallback
      this.saveToLocalStorage(service, apiKey);

      console.log(`AI Assistance: API key set for service: ${service}`);
      return true;
    } catch (error) {
      console.error(`AI Assistance: Error setting API key for ${service}:`, error);
      return false;
    }
  }

  /**
   * Remove API key for a service
   */
  async removeApiKey(service) {
    try {
      // Remove from cache
      this.keyCache.delete(service);

      // Remove from extension storage
      await this.removeFromExtensionStorage(service);

      // Remove from localStorage
      this.removeFromLocalStorage(service);

      console.log(`LLM: API key removed for service: ${service}`);
      return true;
    } catch (error) {
      console.error(`LLM: Error removing API key for ${service}:`, error);
      return false;
    }
  }

  /**
   * Get API key from service-specific storage
   */
  async getServiceApiKey(service) {
    // Check cache first
    if (this.keyCache.has(service)) {
      return this.keyCache.get(service);
    }

    // Load from storage
    const key = await this.getFromExtensionStorage(service);
    if (key) {
      this.keyCache.set(service, key);
      return key;
    }

    return null;
  }

  /**
   * Get API key from extension storage
   */
  async getFromExtensionStorage(service) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        const result = await chrome.storage.local.get(storageKey);
        return result[storageKey] || null;
      }
    } catch (error) {
      console.error('LLM: Error accessing extension storage:', error);
    }
    return null;
  }

  /**
   * Save API key to extension storage
   */
  async saveToExtensionStorage(service, apiKey) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        await chrome.storage.local.set({ [storageKey]: apiKey });
        return true;
      }
    } catch (error) {
      console.error('LLM: Error saving to extension storage:', error);
    }
    return false;
  }

  /**
   * Remove API key from extension storage
   */
  async removeFromExtensionStorage(service) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        await chrome.storage.local.remove(storageKey);
        return true;
      }
    } catch (error) {
      console.error('LLM: Error removing from extension storage:', error);
    }
    return false;
  }

  /**
   * Get API key from localStorage
   */
  getFromLocalStorage(service) {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        return localStorage.getItem(storageKey);
      }
    } catch (error) {
      console.error('LLM: Error accessing localStorage:', error);
    }
    return null;
  }

  /**
   * Save API key to localStorage
   */
  saveToLocalStorage(service, apiKey) {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        localStorage.setItem(storageKey, apiKey);
        return true;
      }
    } catch (error) {
      console.error('LLM: Error saving to localStorage:', error);
    }
    return false;
  }

  /**
   * Remove API key from localStorage
   */
  removeFromLocalStorage(service) {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${service.toUpperCase()}_API_KEY`;
        localStorage.removeItem(storageKey);
        return true;
      }
    } catch (error) {
      console.error('LLM: Error removing from localStorage:', error);
    }
    return false;
  }

  /**
   * Load all API keys from storage
   */
  async loadApiKeys() {
    try {
      const services = Object.values(SERVICES);
      
      for (const service of services) {
        const key = await this.getFromExtensionStorage(service);
        if (key) {
          this.keyCache.set(service, key);
        }
      }

      console.log(`LLM: Loaded ${this.keyCache.size} API keys from storage`);
    } catch (error) {
      console.error('LLM: Error loading API keys:', error);
    }
  }

  /**
   * Get all available API keys
   */
  getAllApiKeys() {
    const keys = {};
    for (const [service, key] of this.keyCache.entries()) {
      keys[service] = key ? '***' + key.slice(-4) : null;
    }
    return keys;
  }

  /**
   * Check if API key exists for service
   */
  async hasApiKey(service) {
    const key = await this.getApiKey(service);
    return !!key;
  }

  /**
   * Validate API key format
   */
  validateApiKey(service, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    switch (service) {
      case SERVICES.GOOGLE:
        return apiKey.startsWith('AIza') && apiKey.length >= 35;
      case SERVICES.OPENAI:
        return apiKey.startsWith('sk-') && apiKey.length >= 40;
      case SERVICES.ANTHROPIC:
        return apiKey.startsWith('sk-ant-') && apiKey.length >= 40;
      case SERVICES.GROQ:
        return apiKey.startsWith('gsk_') && apiKey.length >= 40;
      case SERVICES.DEEPSEEK:
        return apiKey.startsWith('sk-') && apiKey.length >= 40;
      case SERVICES.XAI:
        return apiKey.startsWith('xai-') && apiKey.length >= 40;
      default:
        return apiKey.length >= 20; // Generic validation
    }
  }

  /**
   * Test API key by making a simple request
   */
  async testApiKey(service, apiKey) {
    try {
      // This would need to be implemented with actual API calls
      // For now, just validate format
      return this.validateApiKey(service, apiKey);
    } catch (error) {
      console.error(`LLM: Error testing API key for ${service}:`, error);
      return false;
    }
  }

  /**
   * Enable API key rotation for sessions
   */
  enableRotation(keys = []) {
    this.rotationEnabled = true;
    this.rotationKeys = keys;
    this.currentKeyIndex = 0;
    console.log('LLM: API key rotation enabled');
  }

  /**
   * Disable API key rotation
   */
  disableRotation() {
    this.rotationEnabled = false;
    this.rotationKeys = [];
    this.currentKeyIndex = 0;
    console.log('LLM: API key rotation disabled');
  }

  /**
   * Get next API key in rotation
   */
  getNextRotationKey() {
    if (!this.rotationEnabled || !this.rotationKeys.length) {
      return null;
    }

    const key = this.rotationKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.rotationKeys.length;
    return key;
  }

  /**
   * Set API key for specific session (for rotation)
   */
  setSessionKey(sessionId, apiKey) {
    this.sessionKeys.set(sessionId, apiKey);
  }

  /**
   * Get API key for specific session
   */
  getSessionKey(sessionId) {
    return this.sessionKeys.get(sessionId);
  }

  /**
   * Clear session keys
   */
  clearSessionKeys() {
    this.sessionKeys.clear();
  }

  /**
   * Get statistics about API key usage
   */
  getStats() {
    return {
      totalKeys: this.keyCache.size,
      sessionKeys: this.sessionKeys.size,
      rotationEnabled: this.rotationEnabled,
      rotationKeysCount: this.rotationKeys ? this.rotationKeys.length : 0,
      services: Array.from(this.keyCache.keys())
    };
  }
}

// Create global instance - but do not auto-initialize
export const aiAssistanceApiKeyManager = new AIAssistanceApiKeyManager();

// Integration functions for AI Assistance
export function setupAIAssistanceApiIntegration() {
  // Override the apiKey getter in AI Assistance base class
  if (typeof window !== 'undefined') {
    window.AI_ASSISTANCE_API_KEY_MANAGER = aiAssistanceApiKeyManager;
  }

  console.log('AI Assistance: API key integration setup complete');
}

// Helper functions
export async function getAIAssistanceApiKey(service, sessionId) {
  return await aiAssistanceApiKeyManager.getApiKey(service, sessionId);
}

export async function setAIAssistanceApiKey(service, apiKey, sessionId) {
  return await aiAssistanceApiKeyManager.setApiKey(service, apiKey, sessionId);
}

export async function removeAIAssistanceApiKey(service) {
  return await aiAssistanceApiKeyManager.removeApiKey(service);
}

export async function hasAIAssistanceApiKey(service) {
  return await aiAssistanceApiKeyManager.hasApiKey(service);
}

export function validateAIAssistanceApiKey(service, apiKey) {
  return aiAssistanceApiKeyManager.validateApiKey(service, apiKey);
}

// Auto-setup when module loads
setupAIAssistanceApiIntegration();
