/**
 * AI Assistance System for aiFiverr Extension
 * Advanced AI assistant with streaming support and conversation history
 */

// Note: In browser extension context, we'll use global variables instead of ES6 imports
// The files are loaded in order via manifest.json

/**
 * AI Assistance Manager
 * Main class that integrates with the aiFiverr extension
 */
export default class AIAssistanceManager {
  constructor() {
    this.chatUI = null;
    this.chatInterface = null;
    this.isInitialized = false;
    this.container = null;
    this.triggerButton = null;
    this.settings = {
      service: 'google', // SERVICES.GOOGLE
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
      extended: true,
      think: false,
      theme: 'dark',
      position: 'bottom-right'
    };

    // DO NOT auto-initialize - wait for explicit call
    // this.init();
  }

  async init() {
    try {
      console.log('Universal Chat: Initializing...');

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
      } else {
        await this.initialize();
      }
    } catch (error) {
      console.error('Universal Chat: Initialization failed:', error);
    }
  }

  async initialize() {
    try {
      // Load settings from extension storage
      await this.loadSettings();

      // Wait for API key manager to initialize
      if (window.LLM_API_KEY_MANAGER && !window.LLM_API_KEY_MANAGER.initialized) {
        await new Promise(resolve => {
          const checkInit = () => {
            if (window.LLM_API_KEY_MANAGER.initialized) {
              resolve();
            } else {
              setTimeout(checkInit, 100);
            }
          };
          checkInit();
        });
      }

      // Check if we have an API key
      const hasApiKey = window.LLM_API_KEY_MANAGER ?
        await window.LLM_API_KEY_MANAGER.hasApiKey(this.settings.service) : false;
      if (!hasApiKey) {
        console.warn('Universal Chat: No API key found for', this.settings.service);
        // Still initialize but show a warning
      }

      // Create container
      this.createContainer();

      // Create chat UI
      this.chatUI = new window.ChatUI(this.container, {
        ...this.settings,
        sessionId: this.generateSessionId()
      });

      // Create trigger button
      this.createTriggerButton();

      // Set up event listeners
      this.setupEventListeners();

      // Hide initially
      this.chatUI.hide();

      this.isInitialized = true;
      console.log('AI Assistance: Initialized successfully');

      // Emit initialization event
      this.emit('initialized');

    } catch (error) {
      console.error('AI Assistance: Failed to initialize:', error);
      this.emit('error', error);
    }
  }

  createContainer() {
    // Remove any existing container
    const existing = document.getElementById('universal-chat-container');
    if (existing) {
      existing.remove();
    }

    // Create new container
    this.container = document.createElement('div');
    this.container.id = 'universal-chat-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: none;
    `;

    document.body.appendChild(this.container);
  }

  createTriggerButton() {
    // Remove any existing trigger button
    const existing = document.getElementById('universal-chat-trigger');
    if (existing) {
      existing.remove();
    }

    // Create trigger button
    this.triggerButton = document.createElement('button');
    this.triggerButton.id = 'universal-chat-trigger';
    this.triggerButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 13.54 2.36 14.99 3.01 16.28L2 22L7.72 20.99C9.01 21.64 10.46 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C10.74 20 9.54 19.75 8.46 19.3L6 20L6.7 17.54C6.25 16.46 6 15.26 6 14C6 8.48 8.48 6 12 6C15.52 6 18 8.48 18 12C18 15.52 15.52 18 12 18Z" fill="currentColor"/>
        <circle cx="9" cy="12" r="1" fill="currentColor"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
        <circle cx="15" cy="12" r="1" fill="currentColor"/>
      </svg>
    `;

    this.triggerButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      background: #4a9eff;
      border: none;
      border-radius: 50%;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(74, 158, 255, 0.3);
      transition: all 0.3s ease;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Add hover effects
    this.triggerButton.addEventListener('mouseenter', () => {
      this.triggerButton.style.transform = 'scale(1.1)';
      this.triggerButton.style.boxShadow = '0 6px 20px rgba(74, 158, 255, 0.4)';
    });

    this.triggerButton.addEventListener('mouseleave', () => {
      this.triggerButton.style.transform = 'scale(1)';
      this.triggerButton.style.boxShadow = '0 4px 16px rgba(74, 158, 255, 0.3)';
    });

    // Add click handler
    this.triggerButton.addEventListener('click', () => {
      this.toggle();
    });

    document.body.appendChild(this.triggerButton);
  }

  setupEventListeners() {
    // Listen for chat UI events
    if (this.chatUI && this.chatUI.chatInterface) {
      this.chatUI.chatInterface.on('error', (error) => {
        console.error('Universal Chat: Chat error:', error);
        this.handleChatError(error);
      });

      this.chatUI.chatInterface.on('messageCompleted', (response) => {
        this.emit('messageCompleted', response);
      });
    }

    // Listen for extension events
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleExtensionMessage(message, sender, sendResponse);
      });
    }

    // Listen for settings changes
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.universalChatSettings) {
          this.loadSettings();
        }
      });
    }

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + A to toggle chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for page navigation (for SPA support)
    let currentUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handlePageChange();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  handleExtensionMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'UNIVERSAL_CHAT_TOGGLE':
        this.toggle();
        sendResponse({ success: true });
        break;

      case 'UNIVERSAL_CHAT_SEND_MESSAGE':
        if (message.text) {
          this.sendMessage(message.text);
          sendResponse({ success: true });
        }
        break;

      case 'UNIVERSAL_CHAT_GET_STATUS':
        sendResponse({
          isInitialized: this.isInitialized,
          isVisible: this.chatUI ? this.chatUI.isVisible : false,
          hasApiKey: llmApiKeyManager.hasApiKey(this.settings.service)
        });
        break;

      case 'UNIVERSAL_CHAT_UPDATE_SETTINGS':
        if (message.settings) {
          this.updateSettings(message.settings);
          sendResponse({ success: true });
        }
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  handleChatError(error) {
    // Check if it's an API key error
    if (error.message.includes('API key') || error.message.includes('401')) {
      this.showApiKeyError();
    } else {
      // Show generic error
      console.error('Chat error:', error);
    }
  }

  showApiKeyError() {
    if (this.chatUI) {
      this.chatUI.showError(new Error('API key not found or invalid. Please check your settings.'));
    }
  }

  handlePageChange() {
    // Handle page navigation in SPAs
    console.log('Universal Chat: Page changed, updating context');
    this.emit('pageChanged', window.location.href);
  }

  async sendMessage(text, options = {}) {
    if (!this.isInitialized || !this.chatUI) {
      throw new Error('Chat not initialized');
    }

    // Show chat if hidden
    if (!this.chatUI.isVisible) {
      this.show();
    }

    // Send message
    return await this.chatUI.chatInterface.sendMessage(text, options);
  }

  show() {
    if (this.chatUI) {
      this.chatUI.show();
      this.triggerButton.style.display = 'none';
    }
  }

  hide() {
    if (this.chatUI) {
      this.chatUI.hide();
      this.triggerButton.style.display = 'flex';
    }
  }

  toggle() {
    if (this.chatUI) {
      if (this.chatUI.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // Save to storage
    await this.saveSettings();

    // Update chat UI if it exists
    if (this.chatUI && this.chatUI.chatInterface) {
      this.chatUI.chatInterface.updateOptions(this.settings);
    }

    this.emit('settingsUpdated', this.settings);
  }

  async loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get('universalChatSettings');
        if (result.universalChatSettings) {
          this.settings = { ...this.settings, ...result.universalChatSettings };
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ universalChatSettings: this.settings });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event system
  emit(event, ...args) {
    const customEvent = new CustomEvent(`universalChat:${event}`, {
      detail: args
    });
    document.dispatchEvent(customEvent);
  }

  on(event, callback) {
    document.addEventListener(`universalChat:${event}`, (e) => {
      callback(...e.detail);
    });
  }

  off(event, callback) {
    document.removeEventListener(`universalChat:${event}`, callback);
  }

  // Public API
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isVisible: this.chatUI ? this.chatUI.isVisible : false,
      settings: this.settings,
      hasApiKey: llmApiKeyManager.hasApiKey(this.settings.service)
    };
  }

  getConversations() {
    if (this.chatUI && this.chatUI.chatInterface) {
      return this.chatUI.chatInterface.getAllConversations();
    }
    return [];
  }

  exportConversations(format = 'json') {
    if (this.chatUI && this.chatUI.chatInterface) {
      return this.chatUI.chatInterface.exportConversations(format);
    }
    return null;
  }

  async importConversations(data, merge = false) {
    if (this.chatUI && this.chatUI.chatInterface) {
      return await this.chatUI.chatInterface.importConversations(data, merge);
    }
    return false;
  }

  destroy() {
    if (this.chatUI) {
      this.chatUI.destroy();
    }

    if (this.container) {
      this.container.remove();
    }

    if (this.triggerButton) {
      this.triggerButton.remove();
    }

    this.isInitialized = false;
    this.emit('destroyed');
  }
}

// Create global instance
let universalChatManager = null;

// Initialize when DOM is ready - ONLY if explicitly called
async function initializeUniversalChat() {
  if (!universalChatManager) {
    universalChatManager = new AIAssistanceManager();
    // Explicitly call init() after creating the instance
    await universalChatManager.init();
  }
  return universalChatManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeUniversalChat = initializeUniversalChat;

// REMOVED AUTO-INITIALIZATION - This was causing conflicts with the main chat system
// The universal chat should only be initialized when explicitly called

// Export for global access
if (typeof window !== 'undefined') {
  window.AIAssistanceManager = AIAssistanceManager;
  window.universalChatManager = universalChatManager;
}

export { AIAssistanceManager, initializeUniversalChat };
export default universalChatManager;
