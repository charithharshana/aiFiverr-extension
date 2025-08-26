/**
 * Prompt Selector UI Component
 * Provides a dropdown/modal interface for selecting prompts
 */

class PromptSelector {
  constructor() {
    this.isVisible = false;
    this.currentElement = null;
    this.favoritePrompts = [];
    this.allPrompts = {};
    this.onPromptSelected = null;
    this.storageReady = false;
    // DO NOT auto-initialize - wait for explicit call
    // this.init();
  }

  async init() {
    console.log('aiFiverr: Initializing prompt selector...');
    // Wait for storage manager to be ready
    await this.waitForStorage();
    await this.loadPrompts();
    this.createSelectorUI();
    console.log('aiFiverr: Prompt selector initialized with', Object.keys(this.allPrompts).length, 'prompts');
  }

  /**
   * Wait for storage manager to be available
   */
  async waitForStorage() {
    let attempts = 0;
    while (!window.storageManager && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    this.storageReady = !!window.storageManager;
    console.log('aiFiverr: Storage ready:', this.storageReady);
  }

  /**
   * Simple localStorage fallback
   */
  async getFromStorage(key, defaultValue = null) {
    try {
      if (this.storageReady && window.storageManager) {
        return await window.storageManager.get(key) || defaultValue;
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem(`aifiverr_${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
      }
    } catch (e) {
      console.warn(`Failed to get ${key} from storage:`, e);
      return defaultValue;
    }
  }

  /**
   * Load favorite prompts and all available prompts
   */
  async loadPrompts() {
    try {
      // Load favorite prompts using fallback storage
      const favorites = await this.getFromStorage('favoritePrompts', []);
      this.favoritePrompts = Array.isArray(favorites) ? favorites : [];

      // If no favorites, set some defaults
      if (this.favoritePrompts.length === 0) {
        this.favoritePrompts = ['summary', 'follow_up', 'proposal'];
      }

      // Load custom prompts using enhanced storage access
      let customPrompts = {};
      try {
        const customPromptsResult = await this.getFromStorage('customPrompts', {});
        // Handle both direct object and nested object patterns
        if (customPromptsResult && typeof customPromptsResult === 'object') {
          customPrompts = customPromptsResult.customPrompts || customPromptsResult;
        }
        console.log('aiFiverr Prompt Selector: Loaded custom prompts:', Object.keys(customPrompts));
      } catch (error) {
        console.warn('aiFiverr Prompt Selector: Failed to load custom prompts:', error);
        customPrompts = {};
      }

      // Load floating icon visibility settings
      let floatingIconVisibility = {};
      try {
        const visibilityResult = await this.getFromStorage('floatingIconVisibility', {});
        if (visibilityResult && typeof visibilityResult === 'object') {
          floatingIconVisibility = visibilityResult.floatingIconVisibility || visibilityResult;
        }
      } catch (error) {
        console.warn('aiFiverr Prompt Selector: Failed to load floating icon visibility settings:', error);
        floatingIconVisibility = {};
      }

      // Get default prompts from knowledge base
      const defaultPrompts = this.getDefaultPrompts();

      // Filter default prompts based on floating icon visibility settings
      const visibleDefaultPrompts = {};
      Object.entries(defaultPrompts).forEach(([key, prompt]) => {
        // Default to visible if not explicitly set to false
        if (floatingIconVisibility[key] !== false) {
          visibleDefaultPrompts[key] = prompt;
        }
      });

      // Filter custom prompts based on floating icon visibility settings
      const visibleCustomPrompts = {};
      Object.entries(customPrompts || {}).forEach(([key, prompt]) => {
        // Default to visible if not explicitly set to false
        if (floatingIconVisibility[key] !== false) {
          visibleCustomPrompts[key] = prompt;
        }
      });

      // Combine visible prompts (custom overrides default)
      this.allPrompts = { ...visibleDefaultPrompts, ...visibleCustomPrompts };

      // Enhanced debugging for prompt loading
      console.log('aiFiverr Prompt Selector: Loaded prompts:', {
        defaultTotal: Object.keys(defaultPrompts).length,
        defaultVisible: Object.keys(visibleDefaultPrompts).length,
        customTotal: Object.keys(customPrompts || {}).length,
        customVisible: Object.keys(visibleCustomPrompts).length,
        finalTotal: Object.keys(this.allPrompts).length,
        visiblePromptKeys: Object.keys(this.allPrompts)
      });

      console.log('aiFiverr: Loaded prompts:', {
        favorites: this.favoritePrompts.length,
        total: Object.keys(this.allPrompts).length
      });
    } catch (error) {
      console.error('Failed to load prompts:', error);
      // Set fallbacks
      this.favoritePrompts = ['summary', 'follow_up', 'proposal'];
      this.allPrompts = this.getDefaultPrompts();
    }
  }

  /**
   * Get default prompts (delegates to prompt manager)
   */
  getDefaultPrompts() {
    // Use centralized prompt manager if available
    if (window.promptManager && window.promptManager.initialized) {
      return window.promptManager.getDefaultPrompts();
    }

    // Fallback prompts if prompt manager not available
    return {
      'summary': {
        name: 'Summary',
        description: 'Summarize the conversation and extract key details like budget, timeline, and next steps'
      },
      'follow_up': {
        name: 'Follow-up',
        description: 'Write a friendly and professional follow-up message based on conversation'
      },
      'proposal': {
        name: 'Proposal',
        description: 'Create a Fiverr project proposal based on the conversation'
      },
      'translate': {
        name: 'Translate',
        description: 'Translate conversation into specified language'
      },
      'improve_translate': {
        name: 'Improve & Translate',
        description: 'Improve grammar and tone, then translate to English'
      },
      'improve': {
        name: 'Improve',
        description: 'Improve message grammar, clarity and professionalism'
      }
    };
  }

  /**
   * Create the selector UI
   */
  createSelectorUI() {
    const selector = document.createElement('div');
    selector.className = 'aifiverr-prompt-selector';
    selector.innerHTML = `
      <div class="prompt-selector-backdrop"></div>
      <div class="prompt-selector-panel">
        <div class="prompt-selector-header">
          <h3>Select Prompt</h3>
          <button class="prompt-selector-close">×</button>
        </div>
        <div class="prompt-selector-content">
          <div class="prompt-selector-tabs">
            <button class="prompt-tab-btn active" data-tab="favorites">⭐ Favorites</button>
            <button class="prompt-tab-btn" data-tab="all">📝 All</button>
          </div>
          <div class="prompt-selector-search">
            <input type="text" placeholder="Search..." class="prompt-search-input">
          </div>
          <div class="prompt-selector-list" id="promptSelectorList">
            <!-- Prompts will be populated here -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(selector);
    this.selectorElement = selector;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for the selector
   */
  setupEventListeners() {
    const selector = this.selectorElement;

    // Close button
    selector.querySelector('.prompt-selector-close').addEventListener('click', () => {
      this.hide();
    });

    // Backdrop click
    selector.querySelector('.prompt-selector-backdrop').addEventListener('click', () => {
      this.hide();
    });

    // Tab switching
    selector.querySelectorAll('.prompt-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Search functionality
    const searchInput = selector.querySelector('.prompt-search-input');
    searchInput.addEventListener('input', (e) => {
      this.filterPrompts(e.target.value);
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Show the prompt selector
   */
  async show(element, onPromptSelected) {
    this.currentElement = element;
    this.onPromptSelected = onPromptSelected;
    
    // Reload prompts to ensure they're up to date
    await this.loadPrompts();
    
    // Show favorites by default
    this.switchTab('favorites');
    
    this.selectorElement.style.display = 'block';
    this.isVisible = true;

    // Focus search input
    setTimeout(() => {
      this.selectorElement.querySelector('.prompt-search-input').focus();
    }, 100);
  }

  /**
   * Hide the prompt selector
   */
  hide() {
    this.selectorElement.style.display = 'none';
    this.isVisible = false;
    this.currentElement = null;
    this.onPromptSelected = null;
  }

  /**
   * Switch between tabs
   */
  switchTab(tab) {
    // Update tab buttons
    this.selectorElement.querySelectorAll('.prompt-tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.selectorElement.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Display prompts for the selected tab
    this.displayPrompts(tab);
  }

  /**
   * Display prompts based on the selected tab
   */
  displayPrompts(tab) {
    const listContainer = this.selectorElement.querySelector('#promptSelectorList');
    let promptsToShow = {};

    if (tab === 'favorites') {
      // Show only favorite prompts - ensure favoritePrompts is an array
      const favorites = Array.isArray(this.favoritePrompts) ? this.favoritePrompts : [];
      favorites.forEach(key => {
        if (this.allPrompts[key]) {
          promptsToShow[key] = this.allPrompts[key];
        }
      });
    } else {
      // Show all prompts
      promptsToShow = this.allPrompts || {};
    }

    if (Object.keys(promptsToShow).length === 0) {
      const emptyMessage = tab === 'favorites'
        ? 'No favorite prompts yet. Go to Settings to add prompts to favorites.'
        : 'No prompts available.';
      listContainer.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
      return;
    }

    listContainer.innerHTML = Object.entries(promptsToShow).map(([key, prompt]) => {
      const favorites = Array.isArray(this.favoritePrompts) ? this.favoritePrompts : [];
      const isFavorite = favorites.includes(key);
      return `
        <div class="prompt-selector-item" data-key="${key}">
          <div class="prompt-item-header">
            <div class="prompt-item-title">
              <h4>${this.escapeHtml(prompt.name || key)}</h4>
              ${isFavorite ? '<span class="favorite-indicator">★</span>' : ''}
            </div>
          </div>
          <div class="prompt-item-description">${this.escapeHtml(prompt.description || 'No description available')}</div>
        </div>
      `;
    }).join('');

    // Add click listeners to prompt items
    listContainer.querySelectorAll('.prompt-selector-item').forEach(item => {
      item.addEventListener('click', () => {
        const promptKey = item.dataset.key;
        this.selectPrompt(promptKey);
      });
    });
  }

  /**
   * Filter prompts based on search query
   */
  filterPrompts(query) {
    const items = this.selectorElement.querySelectorAll('.prompt-selector-item');
    const searchTerm = query.toLowerCase();

    items.forEach(item => {
      const title = item.querySelector('h4').textContent.toLowerCase();
      const description = item.querySelector('.prompt-item-description').textContent.toLowerCase();
      
      if (title.includes(searchTerm) || description.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Handle prompt selection
   */
  selectPrompt(promptKey) {
    if (this.onPromptSelected) {
      this.onPromptSelected(promptKey, this.currentElement);
    }
    this.hide();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global prompt selector - but only when explicitly called
async function initializePromptSelector() {
  if (!window.promptSelector) {
    window.promptSelector = new PromptSelector();
    // Explicitly call init() after creating the instance
    await window.promptSelector.init();
    console.log('aiFiverr: Prompt Selector created and initialized');
  }
  return window.promptSelector;
}

// Export the initialization function but DO NOT auto-initialize
window.initializePromptSelector = initializePromptSelector;

// REMOVED AUTO-INITIALIZATION - This was causing the prompt selector to load on every website
// The prompt selector should only be initialized when explicitly called by the main extension
