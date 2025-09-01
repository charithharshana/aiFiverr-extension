/**
 * aiFiverr Popup Script
 * Handles popup interface interactions and communication with content scripts
 */

class PopupManager {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentTabId = null;
    this.isLoading = false;
    this.currentApiKeys = [];
    this.apiKeyStatuses = [];
    this.favoritePrompts = new Set();
    this.originalPromptData = null; // For tracking changes in prompt editing
    this.isLoadingDefaultPrompt = false; // For tracking default prompt loading
    this.init();
  }

  async init() {
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabId = tabs[0]?.id;

      // Set up event listeners
      this.setupEventListeners();

      // Initialize UI
      await this.initializeUI();

      // Load initial data
      await this.loadDashboardData();

      // Initialize Knowledge Base Files if on files tab
      const activeTab = document.querySelector('.kb-tab-btn.active');
      if (activeTab && activeTab.dataset.tab === 'files') {
        await this.loadKnowledgeBaseFiles();
      }

      // Also initialize files data in background for faster switching
      setTimeout(() => {
        this.loadKnowledgeBaseFiles();
      }, 1000);
    } catch (error) {
      console.error('Popup initialization failed:', error);
      // Remove popup error message - just log to console
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Dashboard actions
    document.getElementById('openFloatingWidget')?.addEventListener('click', () => {
      this.openFloatingWidget();
    });

    // Settings actions
    document.getElementById('testApiKeys')?.addEventListener('click', () => {
      this.testApiKeys();
    });

    document.getElementById('addKnowledgeItem')?.addEventListener('click', () => {
      this.showKnowledgeForm();
    });

    document.getElementById('populateFromPrompts')?.addEventListener('click', () => {
      this.populateKnowledgeBaseFromPrompts();
    });

    document.getElementById('saveKnowledgeItem')?.addEventListener('click', () => {
      this.saveKnowledgeItem();
    });

    document.getElementById('cancelKnowledgeItem')?.addEventListener('click', () => {
      this.hideKnowledgeForm();
    });

    document.getElementById('closeKnowledgeForm')?.addEventListener('click', () => {
      this.hideKnowledgeForm();
    });

    // Close modal when clicking overlay
    document.getElementById('knowledgeFormOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'knowledgeFormOverlay') {
        this.hideKnowledgeForm();
      }
    });

    // Event delegation for Knowledge Base buttons
    document.getElementById('knowledgeBaseList')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('kb-edit-btn')) {
        const key = e.target.getAttribute('data-key');
        this.editKnowledgeItem(key);
      } else if (e.target.classList.contains('kb-delete-btn')) {
        const key = e.target.getAttribute('data-key');
        this.removeKnowledgeItem(key);
      }
    });

    // Knowledge Base tabs
    document.querySelectorAll('.kb-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchKnowledgeBaseTab(e.target.dataset.tab);
      });
    });

    // Knowledge Base Files management
    document.getElementById('uploadKbFiles')?.addEventListener('click', () => {
      this.toggleFileUploadArea();
    });

    document.getElementById('refreshKbFiles')?.addEventListener('click', () => {
      this.loadKnowledgeBaseFiles();
    });

    document.getElementById('fileInput')?.addEventListener('change', (e) => {
      this.handleFileSelection(e.target.files);
    });

    document.getElementById('searchKbFiles')?.addEventListener('click', () => {
      this.searchKnowledgeBaseFiles();
    });

    document.getElementById('kbFileSearch')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchKnowledgeBaseFiles();
      }
    });

    document.getElementById('fileTypeFilter')?.addEventListener('change', () => {
      this.filterKnowledgeBaseFiles();
    });

    document.getElementById('fileSortOrder')?.addEventListener('change', () => {
      this.sortKnowledgeBaseFiles();
    });

    // File upload dropzone
    const dropzone = document.getElementById('uploadDropzone');
    if (dropzone) {
      dropzone.addEventListener('click', () => {
        document.getElementById('fileInput').click();
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        this.handleFileSelection(e.dataTransfer.files);
      });
    }

    // File detail modal
    document.getElementById('closeKbFileModal')?.addEventListener('click', () => {
      this.hideFileDetailModal();
    });

    document.getElementById('closeKbFileModalBtn')?.addEventListener('click', () => {
      this.hideFileDetailModal();
    });

    document.getElementById('deleteKbFile')?.addEventListener('click', () => {
      this.deleteSelectedFile();
    });

    document.getElementById('downloadKbFile')?.addEventListener('click', () => {
      this.downloadSelectedFile();
    });

    document.getElementById('copyKbFileLink')?.addEventListener('click', () => {
      this.copyFileLink();
    });

    document.getElementById('saveFileMetadata')?.addEventListener('click', () => {
      this.saveFileMetadata();
    });

    document.getElementById('attachToPrompt')?.addEventListener('click', () => {
      this.showFileSelectionModal();
    });

    document.getElementById('uploadToGemini')?.addEventListener('click', () => {
      this.uploadFileToGemini();
    });

    // File selection modal
    document.getElementById('closeFileSelectionModal')?.addEventListener('click', () => {
      this.hideFileSelectionModal();
    });

    document.getElementById('clearFileSelection')?.addEventListener('click', () => {
      this.clearFileSelection();
    });

    document.getElementById('confirmFileSelection')?.addEventListener('click', () => {
      this.confirmFileSelection();
    });

    document.getElementById('toggleApiKeysVisibility')?.addEventListener('click', () => {
      this.toggleApiKeysVisibility();
    });

    document.getElementById('clearApiKeys')?.addEventListener('click', () => {
      this.clearApiKeys();
    });

    // Auto-save API keys on paste and input
    const apiKeysInput = document.getElementById('apiKeysInput');
    if (apiKeysInput) {
      // Auto-save on paste
      apiKeysInput.addEventListener('paste', (e) => {
        setTimeout(() => {
          this.autoSaveApiKeys();
        }, 100); // Small delay to ensure paste content is processed
      });

      // Auto-save on input with debouncing
      let saveTimeout;
      apiKeysInput.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.autoSaveApiKeys();
        }, 1000); // 1 second delay to avoid excessive saves
      });
    }



    // Prompt management
    document.getElementById('addPromptBtn')?.addEventListener('click', () => {
      this.showPromptForm();
    });

    document.getElementById('savePromptBtn')?.addEventListener('click', () => {
      this.savePrompt();
    });

    document.getElementById('cancelPromptBtn')?.addEventListener('click', () => {
      this.hidePromptForm();
    });

    // Default prompt selector - auto-populate on selection
    const defaultPromptSelector = document.getElementById('defaultPromptSelector');

    defaultPromptSelector?.addEventListener('change', (e) => {
      if (e.target.value) {
        // Store the selected value before processing
        const selectedValue = e.target.value;
        const selectedText = e.target.options[e.target.selectedIndex].text;

        console.log('aiFiverr: Loading template:', selectedValue, selectedText);
        this.loadDefaultPromptTemplate(selectedValue);
      }
    });

    // Knowledge Base file selector for prompts
    document.getElementById('selectKbFiles')?.addEventListener('click', () => {
      console.log('aiFiverr: Select KB Files button clicked');
      this.showKnowledgeBaseFileSelector();
    });

    // Event delegation for conversation actions
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('update-conversation-btn')) {
        const username = e.target.getAttribute('data-username');
        this.updateConversation(username);
      } else if (e.target.classList.contains('delete-conversation-btn')) {
        const username = e.target.getAttribute('data-username');
        this.deleteConversation(username);
      } else if (e.target.classList.contains('extract-contact-btn')) {
        e.stopPropagation();
        const username = e.target.getAttribute('data-username');
        this.extractConversationByUsername(username);
      } else if (e.target.classList.contains('contact-item')) {
        const username = e.target.getAttribute('data-username');
        this.extractConversationByUsername(username);
      } else if (e.target.classList.contains('conversation-item')) {
        const username = e.target.getAttribute('data-username');
        this.showConversationModal(username);
      } else if (e.target.classList.contains('file-action-btn')) {
        const action = e.target.getAttribute('data-action');
        const fileId = e.target.getAttribute('data-file-id');
        if (action === 'details') {
          this.showFileDetails(fileId);
        } else if (action === 'download') {
          this.downloadFile(fileId);
        } else if (action === 'delete') {
          this.handleDeleteFile(fileId);
        } else if (action === 'refresh') {
          this.refreshGeminiFile(fileId);
        }
      }
    });



    // Event delegation for prompt buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('prompt-favorite-btn')) {
        const key = e.target.getAttribute('data-key');
        this.toggleFavoritePrompt(key);
      } else if (e.target.classList.contains('prompt-edit-btn')) {
        const key = e.target.getAttribute('data-key');
        this.editPrompt(key);
      } else if (e.target.classList.contains('prompt-delete-btn')) {
        const key = e.target.getAttribute('data-key');
        this.deletePrompt(key);
      } else if (e.target.classList.contains('prompt-floating-toggle-btn')) {
        const key = e.target.getAttribute('data-key');
        this.togglePromptFloatingIconVisibility(key);
      } else if (e.target.classList.contains('prompt-content-toggle') || e.target.closest('.prompt-content-toggle')) {
        const toggleBtn = e.target.classList.contains('prompt-content-toggle') ? e.target : e.target.closest('.prompt-content-toggle');
        const key = toggleBtn.getAttribute('data-key');
        this.togglePromptContentVisibility(key);
      }
    });



    // Drag and drop
    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
          this.handleFileSelect(file);
        }
      });
    }

    // Preferences
    document.querySelectorAll('#settings input[type="checkbox"], #settings input[type="number"]').forEach(input => {
      input.addEventListener('change', () => {
        this.savePreferences();
      });
    });

    // Global save button
    document.getElementById('globalSaveBtn')?.addEventListener('click', () => {
      this.saveAllSettings();
    });

    // API save button
    document.getElementById('apiSaveBtn')?.addEventListener('click', () => {
      this.saveApiConfiguration();
    });

    // Conversations tab event listeners
    document.getElementById('refreshConversations')?.addEventListener('click', () => {
      this.loadConversations();
    });

    document.getElementById('clearAllConversations')?.addEventListener('click', () => {
      this.clearAllConversations();
    });

    document.getElementById('exportConversation')?.addEventListener('click', () => {
      this.exportCurrentConversation();
    });

    document.getElementById('deleteConversation')?.addEventListener('click', () => {
      this.deleteCurrentConversation();
    });

    // Modal close buttons
    document.getElementById('closeConversationModal')?.addEventListener('click', () => {
      this.closeConversationModal();
    });

    document.getElementById('closeConversationModalBtn')?.addEventListener('click', () => {
      this.closeConversationModal();
    });

    document.getElementById('refreshSingleConversation')?.addEventListener('click', () => {
      this.refreshCurrentConversation();
    });

    // Close conversation modal when clicking overlay
    document.getElementById('conversationModalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'conversationModalOverlay') {
        this.closeConversationModal();
      }
    });

    // Event delegation for conversation items
    document.getElementById('conversationsList')?.addEventListener('click', (e) => {
      const conversationItem = e.target.closest('.conversation-item');
      if (conversationItem) {
        const username = conversationItem.getAttribute('data-username');
        this.showConversationModal(username);
      }
    });

    // Footer links
    document.getElementById('helpLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'mailto:contact@charithharshana.com' });
    });

    document.getElementById('privacyLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.charithharshana.com/aifiverr/privacy-policy' });
    });

    document.getElementById('aboutLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.charithharshana.com/aifiverr/user-guide' });
    });

    document.getElementById('downloadLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/aifiverr/chpbdcphkmeaccddjmdpjcchlgeaipkg' });
    });

    document.getElementById('sourceLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/charithharshana/aiFiverr-extension' });
    });

    // Keyboard shortcut editor
    this.setupShortcutEditor();
  }

  async initializeUI() {
    try {
      // Initialize authentication
      await this.initializeAuthentication();

      // Load settings (this includes knowledge base and prompts)
      await this.loadSettings();


    } catch (error) {
      console.error('aiFiverr: Failed to initialize UI:', error);
      this.showToast('Failed to initialize extension UI', 'error');
    }
  }

  async switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data
    switch (tabName) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'conversations':
        await this.loadConversations();
        break;
      case 'api':
        await this.loadApiConfig();
        break;
      case 'settings':
        await this.loadSettings();
        // Ensure knowledge base and prompts are always loaded when switching to settings
        await this.loadKnowledgeBase();
        await this.loadPrompts();
        break;
    }
  }

  async loadDashboardData() {
    try {
      // Get page info
      const pageInfo = await this.sendMessageToTab({ type: 'GET_PAGE_INFO' });

      // Update stats
      await this.updateStats();

      // Update activity
      this.updateActivity();

      // Load Fiverr data
      await this.loadStoredConversations();
      await this.loadStoredContacts();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  async updateStats() {
    try {
      // Get conversation count
      const conversations = await this.getStorageData('fiverrConversations');
      const conversationCount = conversations ? Object.keys(conversations).length : 0;
      document.getElementById('totalConversations').textContent = conversationCount;

      // Get API key count
      const settings = await this.getStorageData('settings');
      const apiKeyCount = settings?.apiKeys ? settings.apiKeys.length : 0;
      document.getElementById('healthyKeys').textContent = apiKeyCount;

      // Get custom prompts count
      const customPrompts = await this.getStorageData('customPrompts');
      const promptCount = customPrompts ? Object.keys(customPrompts).length : 0;
      document.getElementById('totalPrompts').textContent = promptCount;
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  async updateActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    try {
      // Get recent conversations
      const conversations = await this.getStorageData('fiverrConversations');

      if (conversations && Object.keys(conversations).length > 0) {
        // Show recent conversations
        const recentConversations = Object.entries(conversations)
          .sort(([,a], [,b]) => (b.lastExtracted || 0) - (a.lastExtracted || 0))
          .slice(0, 3);

        activityList.innerHTML = recentConversations.map(([username, conv]) => `
          <div class="activity-item">
            <div class="activity-icon">💬</div>
            <div class="activity-content">
              <div class="activity-title">Conversation with ${username}</div>
              <div class="activity-time">${new Date(conv.lastExtracted || 0).toLocaleDateString()}</div>
            </div>
          </div>
        `).join('');
      } else {
        // Show welcome message if no conversations
        activityList.innerHTML = `
          <div class="activity-item">
            <div class="activity-icon">🎯</div>
            <div class="activity-content">
              <div class="activity-title">Ready to assist with Fiverr conversations!</div>
              <div class="activity-time">Go to a Fiverr conversation page to get started</div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
      // Fallback to welcome message
      activityList.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon">⚠️</div>
          <div class="activity-content">
            <div class="activity-title">aiFiverr Extension Ready</div>
            <div class="activity-time">Visit Fiverr to start using AI assistance</div>
          </div>
        </div>
      `;
    }
  }





  async loadApiConfig() {
    try {
      // Load API keys from the same location the background script uses
      const result = await this.getStorageData(['apiKeys', 'settings']);

      // Try to get API keys from the background script location first
      this.currentApiKeys = result.apiKeys || [];

      // If no keys found in background location, try settings as fallback
      if (this.currentApiKeys.length === 0 && result.settings?.apiKeys) {
        this.currentApiKeys = result.settings.apiKeys;
      }

      // Display API keys in the list
      this.displayApiKeys();

      // Initialize API keys visibility (default to hidden)
      const apiKeysInput = document.getElementById('apiKeysInput');
      const eyeIcon = document.getElementById('eyeIcon');
      if (apiKeysInput && eyeIcon) {
        // Use CSS to hide content instead of type property (textarea doesn't have type)
        apiKeysInput.style.webkitTextSecurity = 'disc';
        apiKeysInput.style.textSecurity = 'disc';
        apiKeysInput.dataset.hidden = 'true';
        eyeIcon.textContent = '👁️';
        eyeIcon.parentElement.title = 'Show API keys';
      }

      // Load API configuration
      if (result.settings) {
        // Load model selection - prioritize selectedModel over defaultModel
        const defaultModelEl = document.getElementById('defaultModel');
        if (defaultModelEl) {
          const modelToUse = result.settings.selectedModel || result.settings.defaultModel || 'gemini-2.5-flash';
          defaultModelEl.value = modelToUse;
          console.log('aiFiverr Popup: Loading API config with model:', modelToUse);
        }

        document.getElementById('keyRotation').checked = result.settings.keyRotation !== false;
        document.getElementById('apiTimeout').value = result.settings.apiTimeout || 30;
        document.getElementById('maxRetries').value = result.settings.maxRetries || 3;
      }
    } catch (error) {
      console.error('Failed to load API config:', error);
    }
  }

  async loadSettings() {
    try {
      const settings = await this.getStorageData('settings');

      // Load knowledge base
      await this.loadKnowledgeBase();

      // Load prompt management
      await this.loadPrompts();

      // Load preferences and model selection
      if (settings) {
        // Load model selection
        const defaultModelEl = document.getElementById('defaultModel');
        if (defaultModelEl && (settings.selectedModel || settings.defaultModel)) {
          defaultModelEl.value = settings.selectedModel || settings.defaultModel;
        }

        document.getElementById('restrictToFiverr').checked = settings.restrictToFiverr === true;
        document.getElementById('autoSave').checked = settings.autoSave !== false;
        document.getElementById('notifications').checked = settings.notifications !== false;
        document.getElementById('maxContextLength').value = settings.maxContextLength || 1048576;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async loadKnowledgeBase() {
    try {
      // Force reload from storage to get the latest data
      let knowledgeBase = await this.forceReloadFromStorage('knowledgeBase') || {};

      // Auto-populate variables from default prompts if Knowledge Base is empty
      if (Object.keys(knowledgeBase).length === 0) {
        await this.autoPopulateKnowledgeBase();
        // Reload the knowledge base after auto-population
        knowledgeBase = await this.forceReloadFromStorage('knowledgeBase') || {};
      }

      const container = document.getElementById('knowledgeBaseList');

      if (!container) return;

      const count = Object.keys(knowledgeBase).length;

      if (count === 0) {
        container.innerHTML = '<div class="empty-state">No variables created yet. Click "Add" to get started.</div>';
        return;
      }

      container.innerHTML = Object.entries(knowledgeBase).map(([key, value]) => `
        <div class="kb-variable-card" data-key="${key}">
          <div class="kb-variable-header">
            <h5 class="kb-variable-name">{{${key}}}</h5>
            <div class="kb-variable-actions">
              <button class="kb-action-btn kb-edit-btn" data-key="${key}" title="Edit variable">
                ✎
              </button>
              <button class="kb-action-btn delete kb-delete-btn" data-key="${key}" title="Delete variable">
                ×
              </button>
            </div>
          </div>
          <div class="kb-variable-value">${this.escapeHtml(value)}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    }
  }

  async autoPopulateKnowledgeBase(autoSave = true) {
    try {
      // Extract variables from default prompts
      const defaultPrompts = this.getDefaultPrompts();
      console.log('Default prompts:', defaultPrompts);

      const variables = new Set();

      // Regular expressions to find both {variable} and {{variable}} patterns
      const singleBraceRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      const doubleBraceRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

      // Extract variables from all default prompts
      Object.values(defaultPrompts).forEach(prompt => {
        console.log('Processing prompt:', prompt.name, prompt.prompt);

        // Find single brace variables {variable}
        let match;
        while ((match = singleBraceRegex.exec(prompt.prompt)) !== null) {
          const varName = match[1];
          // Skip system variables that are provided by context
          if (!['conversation', 'conversation_summary', 'conversation_count', 'conversation_last_message', 'username', 'reply'].includes(varName)) {
            console.log('Found single brace variable:', varName);
            variables.add(varName);
          }
        }

        // Reset regex lastIndex for reuse
        singleBraceRegex.lastIndex = 0;

        // Find double brace variables {{variable}}
        while ((match = doubleBraceRegex.exec(prompt.prompt)) !== null) {
          console.log('Found double brace variable:', match[1]);
          variables.add(match[1]);
        }

        // Reset regex lastIndex for reuse
        doubleBraceRegex.lastIndex = 0;
      });

      console.log('All variables found:', Array.from(variables));

      // Create default values for detected variables
      const knowledgeBase = {};
      const defaultValues = {
        'bio': 'Your professional bio and background information - include your expertise, experience, and what makes you unique',
        'services': 'List of services you offer - be specific about what you can deliver for clients',
        'portfolio': 'Links to your portfolio or previous work - include your best examples and case studies',
        'custom1': 'Custom field 1 - Add any specific information like project goals, communication style, or special requirements',
        'custom2': 'Custom field 2 - Add availability, timeline preferences, or any other relevant details',
        'language': 'Target language for translation (e.g., Spanish, French, German, Italian, Portuguese, etc.)'
      };

      variables.forEach(variable => {
        knowledgeBase[variable] = defaultValues[variable] || `Please update this ${variable} variable with your information`;
      });

      console.log('Generated knowledge base:', knowledgeBase);

      // Save to storage if any variables were found and autoSave is true
      if (autoSave && Object.keys(knowledgeBase).length > 0) {
        const saveSuccess = await this.setStorageData({ knowledgeBase });
        if (saveSuccess) {
          // Verify the data was saved
          const verifyData = await this.getStorageData('knowledgeBase');
          if (verifyData && Object.keys(verifyData).length === Object.keys(knowledgeBase).length) {
            // Auto-population successful - no toast message needed
          } else {
            throw new Error('Data verification failed after auto-population save');
          }
        } else {
          throw new Error('Failed to save auto-populated knowledge base');
        }
      }

      return knowledgeBase;
    } catch (error) {
      console.error('Failed to auto-populate knowledge base:', error);
      if (autoSave) {
        this.showToast(`Failed to auto-populate knowledge base: ${error.message}`, 'error');
      }
      return {};
    }
  }

  async populateKnowledgeBaseFromPrompts() {
    try {
      this.showLoading(true);

      const existingKnowledgeBase = await this.getStorageData('knowledgeBase') || {};
      const newVariables = await this.autoPopulateKnowledgeBase(false);

      console.log('Existing KB:', existingKnowledgeBase);
      console.log('New variables from prompts:', newVariables);

      // Only add variables that don't already exist
      const variablesToAdd = {};
      Object.entries(newVariables).forEach(([key, value]) => {
        if (!existingKnowledgeBase.hasOwnProperty(key)) {
          variablesToAdd[key] = value;
        }
      });

      console.log('Variables to add:', variablesToAdd);

      if (Object.keys(variablesToAdd).length > 0) {
        // Merge with existing variables
        const mergedKnowledgeBase = { ...existingKnowledgeBase, ...variablesToAdd };

        // Save with explicit error handling
        const saveSuccess = await this.setStorageData({ knowledgeBase: mergedKnowledgeBase });

        if (saveSuccess) {
          // Wait a moment for storage to complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Force reload data from storage to verify
          const verifyData = await this.forceReloadFromStorage('knowledgeBase');
          console.log('Verified saved data:', verifyData);

          await this.loadKnowledgeBase();
          this.showToast(`Added ${Object.keys(variablesToAdd).length} new variables from default prompts`, 'success');
        } else {
          throw new Error('Failed to save knowledge base data');
        }
      } else if (Object.keys(newVariables).length > 0) {
        // Variables exist but user clicked the button - refresh the display
        await this.loadKnowledgeBase();
        this.showToast('All variables from default prompts are already in your Knowledge Base', 'info');
      } else {
        // No variables found in default prompts
        this.showToast('No variables found in default prompts to populate', 'warning');
      }
    } catch (error) {
      console.error('Failed to populate knowledge base from prompts:', error);
      this.showToast(`Failed to populate variables from prompts: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showKnowledgeForm(editKey = null) {
    const overlay = document.getElementById('knowledgeFormOverlay');
    const title = document.getElementById('kbFormTitle');
    const keyInput = document.getElementById('newKbKey');
    const valueInput = document.getElementById('newKbValue');

    if (editKey) {
      title.textContent = 'Edit Variable';
      keyInput.readOnly = true;
    } else {
      title.textContent = 'Add New Variable';
      keyInput.readOnly = false;
      // Clear any previous values
      keyInput.value = '';
      valueInput.value = '';
    }

    overlay.classList.add('active');
    setTimeout(() => keyInput.focus(), 100);
  }

  hideKnowledgeForm() {
    const overlay = document.getElementById('knowledgeFormOverlay');
    overlay.classList.remove('active');

    // Clear form
    document.getElementById('newKbKey').value = '';
    document.getElementById('newKbValue').value = '';
    document.getElementById('newKbKey').readOnly = false;
  }

  applySuggestion(key, value) {
    const keyInput = document.getElementById('newKbKey');
    const valueInput = document.getElementById('newKbValue');

    keyInput.value = key;
    valueInput.value = value;

    this.showKnowledgeForm();
    valueInput.focus();
  }

  async saveKnowledgeItem() {
    try {
      const keyInput = document.getElementById('newKbKey');
      const valueInput = document.getElementById('newKbValue');

      const key = keyInput.value.trim();
      const value = valueInput.value.trim();

      if (!key) {
        this.showToast('Please enter a variable name', 'error');
        keyInput.focus();
        return;
      }

      if (!value) {
        this.showToast('Please enter a variable value', 'error');
        valueInput.focus();
        return;
      }

      // Validate key format (alphanumeric and underscores only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        this.showToast('Variable name can only contain letters, numbers, and underscores, and must start with a letter or underscore', 'error');
        keyInput.focus();
        return;
      }

      this.showLoading(true);

      const knowledgeBase = await this.getStorageData('knowledgeBase') || {};
      knowledgeBase[key] = value;

      // Save with explicit error handling
      const saveSuccess = await this.setStorageData({ knowledgeBase });

      if (saveSuccess) {
        // Wait a moment for storage to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Force reload data from storage to verify
        const verifyData = await this.forceReloadFromStorage('knowledgeBase');
        console.log('Verified saved knowledge base:', verifyData);

        if (verifyData && verifyData[key] === value) {
          await this.loadKnowledgeBase();
          this.hideKnowledgeForm();
          this.showToast(`Variable "${key}" saved successfully`, 'success');
        } else {
          throw new Error('Data verification failed after save');
        }
      } else {
        throw new Error('Failed to save knowledge base data');
      }
    } catch (error) {
      console.error('Failed to save knowledge item:', error);
      this.showToast(`Failed to save variable: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async editKnowledgeItem(key) {
    try {
      const knowledgeBase = await this.getStorageData('knowledgeBase') || {};
      const value = knowledgeBase[key];

      if (!value) {
        this.showToast('Variable not found', 'error');
        return;
      }

      const keyInput = document.getElementById('newKbKey');
      const valueInput = document.getElementById('newKbValue');

      keyInput.value = key;
      valueInput.value = value;

      this.showKnowledgeForm(key);
      setTimeout(() => valueInput.focus(), 150);

      // Store the editing key
      this.editingKey = key;
    } catch (error) {
      console.error('Failed to edit knowledge item:', error);
      this.showToast('Failed to edit variable', 'error');
    }
  }

  async removeKnowledgeItem(key) {
    if (confirm(`Are you sure you want to remove the variable "${key}"?`)) {
      try {
        const knowledgeBase = await this.getStorageData('knowledgeBase') || {};
        delete knowledgeBase[key];

        await this.setStorageData({ knowledgeBase });
        await this.loadKnowledgeBase();

        this.showToast(`Variable "${key}" removed successfully`, 'success');
      } catch (error) {
        console.error('Failed to remove knowledge item:', error);
        this.showToast('Failed to remove variable', 'error');
      }
    }
  }

  // Prompt Management Methods
  async loadPrompts() {
    try {
      // Force reload custom prompts from storage
      const customPrompts = await this.forceReloadFromStorage('customPrompts') || {};

      // Force reload favorite prompts from storage
      const favorites = await this.forceReloadFromStorage('favoritePrompts') || [];
      this.favoritePrompts = new Set(favorites);

      // Display only custom prompts in the new simplified UI
      this.displayCustomPrompts(customPrompts);

      console.log('aiFiverr Popup: Loaded custom prompts:', Object.keys(customPrompts).length);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  }

  // Load default prompt template into the form (auto-populate)
  loadDefaultPromptTemplate(selectedKey = null) {
    const selector = document.getElementById('defaultPromptSelector');
    const key = selectedKey || selector.value;

    if (!key) return;

    // Add loading state
    selector.classList.add('loading');
    selector.disabled = true;

    const defaultPrompts = this.getDefaultPrompts();
    const template = defaultPrompts[key];

    if (!template) {
      this.showToast('Template not found', 'error');
      selector.classList.remove('loading');
      selector.disabled = false;
      return;
    }

    // Generate a unique key for the custom prompt
    const customKey = `custom_${key}_${Date.now()}`;

    // Show the form first (this will clear fields if isEdit=false)
    this.showPromptForm(false);

    // Then fill the form with template data AFTER showing it
    document.getElementById('newPromptKey').value = customKey;
    document.getElementById('newPromptName').value = `My ${template.name}`;
    document.getElementById('newPromptDescription').value = template.description;
    document.getElementById('newPromptContent').value = template.prompt;

    // Clear any selected knowledge base files
    const selectedKbFiles = document.getElementById('selectedKbFiles');
    if (selectedKbFiles) {
      selectedKbFiles.innerHTML = '';
    }

    // Remove loading state after form is shown (keep selected value visible)
    setTimeout(() => {
      selector.classList.remove('loading');
      selector.disabled = false;
      // Don't reset selector.value - keep the selected template visible

      this.showToast(`✨ Loaded "${template.name}" template - customize and save as your own!`, 'success');
    }, 100); // Reduced delay to just remove loading state
  }

  // Display custom prompts in the simplified UI
  displayCustomPrompts(customPrompts) {
    const container = document.getElementById('customPromptsList');
    const countElement = document.getElementById('customPromptsCount');

    if (!container) return;

    const promptCount = Object.keys(customPrompts).length;
    if (countElement) {
      countElement.textContent = `${promptCount} prompt${promptCount !== 1 ? 's' : ''}`;
    }

    if (promptCount === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
          <h4>No custom prompts yet</h4>
          <p>Select a default template above to get started, or create a new prompt from scratch.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = Object.entries(customPrompts).map(([key, prompt]) => {
      const isFavorite = this.favoritePrompts.has(key);
      return `
        <div class="prompt-item ${isFavorite ? 'favorite' : ''}" data-key="${key}" data-type="custom">
          <div class="prompt-item-header">
            <div class="prompt-item-title">
              <h4 class="prompt-item-name">${this.escapeHtml(prompt.name)}</h4>
              <span class="prompt-item-key">${key}</span>
            </div>
            <div class="prompt-item-actions">
              <button class="prompt-action-btn favorite ${isFavorite ? 'favorite' : ''} prompt-favorite-btn"
                      data-key="${key}"
                      title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                ${isFavorite ? '★' : '☆'}
              </button>
              <button class="prompt-action-btn edit prompt-edit-btn"
                      data-key="${key}"
                      title="Edit prompt">
                ✏️
              </button>
              <button class="prompt-action-btn delete prompt-delete-btn"
                      data-key="${key}"
                      title="Delete prompt">
                🗑️
              </button>
            </div>
          </div>
          <div class="prompt-item-description">${this.escapeHtml(prompt.description || 'No description')}</div>
          <div class="prompt-item-preview">${this.escapeHtml(prompt.prompt?.substring(0, 100) || '')}${prompt.prompt?.length > 100 ? '...' : ''}</div>
        </div>
      `;
    }).join('');
  }

  getDefaultPrompts() {
    // Since popup runs in different context, always use direct prompt definitions
    return {
      'summary': {
        name: 'Summary',
        description: 'Extract key details',
        prompt: 'Summarize the below conversation:\n\n{conversation}\n\nExtract key details about this project. Write a well-formatted summary. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'follow_up': {
        name: 'Follow-up',
        description: 'Write follow-up message',
        prompt: 'Write a short, friendly follow-up message based on this conversation:\n\n{conversation}\n\nMention a specific detail we discussed and include clear next steps. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'proposal': {
        name: 'Proposal',
        description: 'Create project proposal',
        prompt: 'Create a short and concise project proposal (under 3000 characters) based on this:\n\n{conversation}\n\nextract and Include more example urls from my previous work.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'translate': {
        name: 'Translate',
        description: 'Translate text',
        prompt: 'Translate this: {conversation}\n\nInto this language: {language}\n\nProvide only the translated text. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve_translate': {
        name: 'Improve & Translate',
        description: 'Improve and translate',
        prompt: 'Improve the grammar and tone of this message: {conversation}\n\nThen, translate the improved message to English. Use my bio ({bio}) to add relevant details about me. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve': {
        name: 'Improve',
        description: 'Improve message',
        prompt: 'Improve this message: {conversation}\n\nMake it grammatically correct, clear, and professional, but keep the original meaning. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      }
    };
  }





  /**
   * Check if prompt is visible in floating icon menu
   */
  isPromptVisibleInFloatingIcon(key) {
    // Default to visible if not explicitly set to false
    return this.floatingIconVisibility?.[key] !== false;
  }

  /**
   * Toggle prompt visibility in floating icon menu
   */
  async togglePromptFloatingIconVisibility(key) {
    try {
      if (!this.floatingIconVisibility) {
        this.floatingIconVisibility = {};
      }

      // Toggle visibility (default is true, so we store false to hide)
      this.floatingIconVisibility[key] = !this.isPromptVisibleInFloatingIcon(key);

      // Save to storage
      await this.setStorageData({ floatingIconVisibility: this.floatingIconVisibility });

      // Refresh display
      await this.loadPrompts();

      const isVisible = this.isPromptVisibleInFloatingIcon(key);
      this.showToast(`Prompt "${key}" ${isVisible ? 'shown' : 'hidden'} in floating menu`, 'success');
    } catch (error) {
      console.error('Failed to toggle floating icon visibility:', error);
      this.showToast('Failed to update floating menu visibility', 'error');
    }
  }

  /**
   * Toggle prompt content visibility
   */
  togglePromptContentVisibility(key) {
    const contentElement = document.querySelector(`.prompt-item-content[data-key="${key}"]`);
    const toggleBtn = document.querySelector(`.prompt-content-toggle[data-key="${key}"]`);
    const toggleIcon = toggleBtn?.querySelector('.toggle-icon');

    if (contentElement && toggleBtn && toggleIcon) {
      const isExpanded = contentElement.classList.contains('expanded');

      if (isExpanded) {
        contentElement.classList.remove('expanded');
        contentElement.classList.add('collapsed');
        toggleIcon.textContent = '▶';
        toggleBtn.title = 'Show prompt content';
      } else {
        contentElement.classList.remove('collapsed');
        contentElement.classList.add('expanded');
        toggleIcon.textContent = '▼';
        toggleBtn.title = 'Hide prompt content';
      }
    }
  }



  showPromptForm(isEdit = false) {
    const form = document.getElementById('promptAddForm');
    if (!form) {
      throw new Error('Prompt form not found (promptAddForm)');
    }
    form.classList.add('active');

    const keyField = document.getElementById('newPromptKey');
    const nameField = document.getElementById('newPromptName');
    const descField = document.getElementById('newPromptDescription');
    const contentField = document.getElementById('newPromptContent');

    if (!keyField || !nameField || !descField || !contentField) {
      throw new Error('Form fields not found in showPromptForm');
    }

    if (!isEdit) {
      // Clear form only for new prompts
      keyField.value = '';
      nameField.value = '';
      descField.value = '';
      contentField.value = '';

      // Make sure key field is enabled for new prompts
      keyField.readOnly = false;
      keyField.focus();
    } else {
      // For editing, focus on the name field since key is readonly
      nameField.focus();
    }
  }

  hidePromptForm() {
    const form = document.getElementById('promptAddForm');
    if (!form) return;

    form.classList.remove('active');

    // Clear form when hiding
    const keyField = document.getElementById('newPromptKey');
    const nameField = document.getElementById('newPromptName');
    const descField = document.getElementById('newPromptDescription');
    const contentField = document.getElementById('newPromptContent');

    if (keyField) {
      keyField.value = '';
      keyField.readOnly = false;
    }
    if (nameField) nameField.value = '';
    if (descField) descField.value = '';
    if (contentField) contentField.value = '';

    // Clear original prompt data
    this.originalPromptData = null;

    // Clear selected files
    this.clearSelectedKbFiles();
  }

  async savePrompt() {
    try {
      const key = document.getElementById('newPromptKey').value.trim();
      const name = document.getElementById('newPromptName').value.trim();
      const description = document.getElementById('newPromptDescription').value.trim();
      const content = document.getElementById('newPromptContent').value.trim();

      if (!key) {
        this.showToast('Please enter a prompt key', 'error');
        document.getElementById('newPromptKey').focus();
        return;
      }

      if (!name) {
        this.showToast('Please enter a prompt name', 'error');
        document.getElementById('newPromptName').focus();
        return;
      }

      if (!content) {
        this.showToast('Please enter prompt content', 'error');
        document.getElementById('newPromptContent').focus();
        return;
      }

      // Validate key format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        this.showToast('Prompt key can only contain letters, numbers, and underscores', 'error');
        document.getElementById('newPromptKey').focus();
        return;
      }

      // Get selected knowledge base files first for change detection
      const selectedFiles = this.getSelectedKbFiles();

      // Enhanced change detection logic
      const isConvertedDefault = this.originalPromptData && this.originalPromptData.wasConverted;

      // For converted default prompts, skip change detection since they're always new
      if (!isConvertedDefault && this.originalPromptData && this.originalPromptData.isDefaultPrompt) {
        const originalName = this.originalPromptData.name + ' (Custom)';
        const hasChanges =
          name !== originalName ||
          description !== this.originalPromptData.description ||
          content !== this.originalPromptData.content ||
          JSON.stringify(selectedFiles) !== JSON.stringify(this.originalPromptData.knowledgeBaseFiles || []);

        if (!hasChanges) {
          this.hidePromptForm();
          this.showToast('No changes made to the prompt', 'info');
          this.originalPromptData = null;
          return;
        }
      }

      // For converted default prompts or regular edits, proceed with saving
      this.showLoading(true);

      // Since popup runs in different context, always use direct storage access
      const customPrompts = await this.getStorageData('customPrompts') || {};
      const promptData = {
        name,
        description,
        prompt: content,
        knowledgeBaseFiles: selectedFiles,
        created: customPrompts[key]?.created || Date.now(),
        modified: Date.now()
      };

      customPrompts[key] = promptData;

      const saveSuccess = await this.setStorageData({ customPrompts });

      if (saveSuccess) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const verifyData = await this.forceReloadFromStorage('customPrompts');

        if (verifyData && verifyData[key] && verifyData[key].name === name) {
          // Reload prompts to show the new/updated prompt
          await this.loadPrompts();
          this.hidePromptForm();
          this.showToast(`Prompt "${name}" saved successfully`, 'success');
          this.originalPromptData = null;
        } else {
          throw new Error('Data verification failed after save');
        }
      } else {
        throw new Error('Failed to save custom prompts data');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      this.showToast(`Failed to save prompt: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async editPrompt(key) {
    try {
      console.log('aiFiverr: Starting editPrompt for key:', key);

      // Since popup runs in different context, always use direct storage access
      const defaultPrompts = this.getDefaultPrompts();
      console.log('aiFiverr: Default prompts loaded:', Object.keys(defaultPrompts));

      const customPrompts = await this.getStorageData('customPrompts') || {};
      console.log('aiFiverr: Custom prompts loaded:', Object.keys(customPrompts));

      let prompt = customPrompts[key];
      let isDefaultPrompt = false;

      if (!prompt && defaultPrompts[key]) {
        prompt = defaultPrompts[key];
        isDefaultPrompt = true;
        console.log('aiFiverr: Found default prompt:', key);
      }

      if (!prompt) {
        console.error('aiFiverr: Prompt not found for key:', key);
        this.showToast('Prompt not found', 'error');
        return;
      }

      console.log('aiFiverr: Prompt to edit:', { key, isDefaultPrompt, name: prompt.name });

      // Store original values for change detection
      this.originalPromptData = {
        key: key,
        name: prompt.name,
        description: prompt.description || '',
        content: prompt.prompt,
        knowledgeBaseFiles: prompt.knowledgeBaseFiles || [],
        isDefaultPrompt: isDefaultPrompt,
        wasConverted: isDefaultPrompt // Track if this will be converted from default
      };

      let editKey = key;
      if (isDefaultPrompt) {
        // Generate unique key for custom version
        editKey = `${key}_custom`;
        let counter = 1;
        while (customPrompts[editKey]) {
          editKey = `${key}_custom_${counter}`;
          counter++;
        }
      }

      // Populate form fields
      console.log('aiFiverr: Populating form with editKey:', editKey);

      const keyField = document.getElementById('newPromptKey');
      const nameField = document.getElementById('newPromptName');
      const descField = document.getElementById('newPromptDescription');
      const contentField = document.getElementById('newPromptContent');

      if (!keyField || !nameField || !descField || !contentField) {
        throw new Error('Form elements not found. Missing: ' +
          [!keyField && 'newPromptKey', !nameField && 'newPromptName',
           !descField && 'newPromptDescription', !contentField && 'newPromptContent']
          .filter(Boolean).join(', '));
      }

      keyField.value = editKey;
      nameField.value = prompt.name + (isDefaultPrompt ? ' (Custom)' : '');
      descField.value = prompt.description || '';
      contentField.value = prompt.prompt;

      console.log('aiFiverr: Form populated successfully');

      // Load knowledge base files if they exist
      if (prompt.knowledgeBaseFiles && Array.isArray(prompt.knowledgeBaseFiles) && prompt.knowledgeBaseFiles.length > 0) {
        this.displaySelectedFiles(prompt.knowledgeBaseFiles);
      } else {
        // Clear any existing selected files display
        const container = document.getElementById('selectedKbFiles');
        if (container) {
          container.style.display = 'none';
          container.classList.remove('has-files');
          container.innerHTML = '';
        }
      }

      // Make key field readonly when editing (both default and custom)
      keyField.readOnly = true;
      console.log('aiFiverr: Set key field to readonly');

      console.log('aiFiverr: Showing prompt form');
      this.showPromptForm(true);

      if (isDefaultPrompt) {
        console.log('aiFiverr: Showing success toast for default prompt');
        this.showToast('Default prompt copied for editing. You can modify it as needed.', 'info');
      }

      console.log('aiFiverr: editPrompt completed successfully');
    } catch (error) {
      console.error('aiFiverr: Failed to edit prompt:', error);
      console.error('aiFiverr: Error stack:', error.stack);
      this.showToast(`Failed to edit prompt: ${error.message}`, 'error');
    }
  }

  async deletePrompt(key) {
    if (confirm('Are you sure you want to delete this prompt?')) {
      try {
        const customPrompts = await this.getStorageData('customPrompts') || {};
        delete customPrompts[key];

        // Remove from favorites if it exists
        this.favoritePrompts.delete(key);
        await this.setStorageData({
          customPrompts,
          favoritePrompts: Array.from(this.favoritePrompts)
        });

        await this.loadPrompts();
        this.showToast('Prompt deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete prompt:', error);
        this.showToast('Failed to delete prompt', 'error');
      }
    }
  }

  async toggleFavoritePrompt(key) {
    try {
      console.log('Toggling favorite for key:', key);
      console.log('Current favorites:', Array.from(this.favoritePrompts));

      // Check if prompt exists in either default or custom prompts
      const defaultPrompts = this.getDefaultPrompts();
      const customPrompts = await this.getStorageData('customPrompts') || {};
      const allPrompts = { ...defaultPrompts, ...customPrompts };

      if (!allPrompts[key]) {
        this.showToast('Prompt not found', 'error');
        return;
      }

      const wasInFavorites = this.favoritePrompts.has(key);

      if (wasInFavorites) {
        this.favoritePrompts.delete(key);
        console.log('Removed from favorites');
      } else {
        this.favoritePrompts.add(key);
        console.log('Added to favorites');
      }

      console.log('New favorites:', Array.from(this.favoritePrompts));

      await this.setStorageData({
        favoritePrompts: Array.from(this.favoritePrompts)
      });

      await this.loadPrompts();
      this.showToast(`Prompt ${!wasInFavorites ? 'added to' : 'removed from'} favorites`, 'success');
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      this.showToast('Failed to update favorites', 'error');
    }
  }

  displayApiKeys() {
    this.updateApiKeysSummary();
  }

  updateApiKeysSummary() {
    const container = document.getElementById('apiKeysSummary');
    if (!container) return;

    if (!this.currentApiKeys || this.currentApiKeys.length === 0) {
      container.innerHTML = 'No API keys configured. Add your Gemini API keys above to get started.';
      container.className = 'api-keys-summary';
      return;
    }

    const validKeys = this.apiKeyStatuses ? this.apiKeyStatuses.filter(status => status === 'valid').length : 0;
    const invalidKeys = this.apiKeyStatuses ? this.apiKeyStatuses.filter(status => status === 'invalid').length : 0;
    const testingKeys = this.apiKeyStatuses ? this.apiKeyStatuses.filter(status => status === 'testing').length : 0;
    const totalKeys = this.currentApiKeys.length;

    let statusText = `${totalKeys} API key${totalKeys > 1 ? 's' : ''} configured`;
    let statusClass = 'api-keys-summary';

    if (testingKeys > 0) {
      statusText += ` (${testingKeys} testing...)`;
      statusClass += ' has-keys';
    } else if (validKeys > 0) {
      statusText += ` (${validKeys} valid`;
      if (invalidKeys > 0) {
        statusText += `, ${invalidKeys} invalid`;
        statusClass += ' has-errors';
      } else {
        statusClass += ' has-keys';
      }
      statusText += ')';
    } else if (invalidKeys > 0) {
      statusText += ` (${invalidKeys} invalid)`;
      statusClass += ' has-errors';
    }

    container.innerHTML = statusText;
    container.className = statusClass;
  }



  toggleApiKeysVisibility() {
    const apiKeysInput = document.getElementById('apiKeysInput');
    const eyeIcon = document.getElementById('eyeIcon');

    // Toggle between hidden and visible using CSS properties
    const isCurrentlyHidden = apiKeysInput.dataset.hidden === 'true';

    if (isCurrentlyHidden) {
      // Show actual keys
      apiKeysInput.style.webkitTextSecurity = 'none';
      apiKeysInput.style.textSecurity = 'none';
      apiKeysInput.dataset.hidden = 'false';
      eyeIcon.textContent = '🙈'; // Hide icon when keys are visible
      eyeIcon.parentElement.title = 'Hide API keys';
    } else {
      // Hide keys
      apiKeysInput.style.webkitTextSecurity = 'disc';
      apiKeysInput.style.textSecurity = 'disc';
      apiKeysInput.dataset.hidden = 'true';
      eyeIcon.textContent = '👁️'; // Show icon when keys are hidden
      eyeIcon.parentElement.title = 'Show API keys';
    }

    // Maintain font family
    apiKeysInput.style.fontFamily = "'Monaco', 'Menlo', 'Ubuntu Mono', monospace";

    // Also update the displayed list
    this.displayApiKeys();
  }



  async clearApiKeys() {
    try {
      // Clear the input field
      const apiKeysInput = document.getElementById('apiKeysInput');
      if (apiKeysInput) {
        apiKeysInput.value = '';
      }

      // Clear saved API keys
      this.currentApiKeys = [];
      this.apiKeyStatuses = [];

      // Update storage
      const result = await this.sendMessageToBackground({
        type: 'UPDATE_API_KEYS',
        keys: []
      });

      if (result.success) {
        // Also clear from direct storage
        await this.setStorageData({ apiKeys: [] });

        // Clear from settings as well
        const settings = await this.getStorageData('settings') || {};
        settings.apiKeys = [];
        await this.setStorageData({ settings });

        // Update display
        this.displayApiKeys();

        // Reset status indicators
        const statusElement = document.getElementById('apiKeysStatus');
        if (statusElement) {
          statusElement.textContent = '';
          statusElement.className = 'api-keys-status';
          statusElement.style.display = 'none';
        }


        this.showApiKeyStatus('All API keys cleared', 'success');
        await this.updateStats();
      } else {
        throw new Error(result.error || 'Failed to clear API keys');
      }
    } catch (error) {
      console.error('Failed to clear API keys:', error);
      this.showApiKeyStatus('Failed to clear API keys: ' + error.message, 'error');
    }
  }

  async autoSaveApiKeys() {
    try {
      const apiKeysInput = document.getElementById('apiKeysInput');
      const inputValue = apiKeysInput.value.trim();

      // Only save if there's actual content
      if (!inputValue) {
        return;
      }

      const newKeys = inputValue
        .split('\n')
        .map(key => key.trim())
        .filter(key => key.length > 0);

      // Only save if there are valid keys
      if (newKeys.length === 0) {
        return;
      }

      // Combine existing keys with new ones (avoid duplicates)
      const allKeys = [...new Set([...this.currentApiKeys, ...newKeys])];

      const result = await this.sendMessageToBackground({
        type: 'UPDATE_API_KEYS',
        keys: allKeys
      });

      if (result.success) {
        this.currentApiKeys = allKeys;
        this.displayApiKeys();
        apiKeysInput.value = ''; // Clear input after saving
        this.showApiKeyStatus('API keys saved automatically', 'success');

        // Also save directly to storage for consistency with background script
        await this.setStorageData({ apiKeys: allKeys });

        // Keep settings backup for compatibility
        const settings = await this.getStorageData('settings') || {};
        settings.apiKeys = allKeys;
        await this.setStorageData({ settings });
        await this.updateStats();
      } else {
        throw new Error(result.error || 'Failed to save API keys');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      this.showApiKeyStatus('Auto-save failed: ' + error.message, 'error');
    }
  }



  async testApiKeys() {
    try {
      this.showLoading(true);

      if (!this.currentApiKeys || this.currentApiKeys.length === 0) {
        this.showApiKeyStatus('No API keys to test', 'error');
        return;
      }

      // Initialize status tracking
      this.apiKeyStatuses = new Array(this.currentApiKeys.length).fill('testing');
      this.displayApiKeys();

      // Test each key individually
      let validKeys = 0;
      const testPromises = this.currentApiKeys.map(async (key, index) => {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            this.apiKeyStatuses[index] = 'valid';
            validKeys++;
          } else {
            this.apiKeyStatuses[index] = 'invalid';
            console.warn(`API key ${index + 1} test failed:`, response.status, response.statusText);
          }
        } catch (error) {
          this.apiKeyStatuses[index] = 'invalid';
          console.warn(`API key ${index + 1} test error:`, error);
        }

        // Update display after each test
        this.displayApiKeys();
      });

      await Promise.all(testPromises);

      // Show final status
      if (validKeys === this.currentApiKeys.length) {
        this.showApiKeyStatus(`All ${this.currentApiKeys.length} API keys are valid!`, 'success');
      } else if (validKeys > 0) {
        this.showApiKeyStatus(`${validKeys} out of ${this.currentApiKeys.length} API keys are valid`, 'error');
      } else {
        this.showApiKeyStatus('No valid API keys found', 'error');
      }
    } catch (error) {
      console.error('Failed to test API keys:', error);
      this.showApiKeyStatus('Failed to test API keys: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showApiKeyStatus(message, type) {
    const statusElement = document.getElementById('apiKeysStatus');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `api-keys-status ${type}`;
      
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  }

  async savePreferences() {
    try {
      const settings = await this.getStorageData('settings') || {};

      // Preserve API keys in settings
      settings.apiKeys = this.currentApiKeys || [];

      // Get elements safely with null checks
      const defaultModelEl = document.getElementById('defaultModel');
      const restrictToFiverrEl = document.getElementById('restrictToFiverr');
      const autoSaveEl = document.getElementById('autoSave');
      const notificationsEl = document.getElementById('notifications');
      const keyRotationEl = document.getElementById('keyRotation');
      const maxContextLengthEl = document.getElementById('maxContextLength');

      // Only update settings if elements exist
      if (defaultModelEl) {
        settings.defaultModel = defaultModelEl.value;
        settings.selectedModel = defaultModelEl.value; // Also save as selectedModel for enhanced client
      }
      if (restrictToFiverrEl) settings.restrictToFiverr = restrictToFiverrEl.checked;
      if (autoSaveEl) settings.autoSave = autoSaveEl.checked;
      if (notificationsEl) settings.notifications = notificationsEl.checked;
      if (keyRotationEl) settings.keyRotation = keyRotationEl.checked;
      if (maxContextLengthEl) settings.maxContextLength = parseInt(maxContextLengthEl.value) || 1048576;

      console.log('Saving preferences:', settings);

      const success = await this.setStorageData({ settings });
      if (success) {
        this.showToast('Preferences saved');
      } else {
        throw new Error('Storage operation failed');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      this.showToast('Failed to save preferences: ' + (error.message || 'Unknown error'), 'error');
    }
  }

  async saveApiConfiguration() {
    try {
      // Get current settings
      const settings = await this.getStorageData('settings') || {};

      // Save API configuration
      settings.apiKeys = this.currentApiKeys || [];
      const selectedModel = document.getElementById('defaultModel').value;
      settings.defaultModel = selectedModel;
      settings.selectedModel = selectedModel; // Also save as selectedModel for enhanced client
      settings.keyRotation = document.getElementById('keyRotation').checked;
      settings.apiTimeout = parseInt(document.getElementById('apiTimeout').value);
      settings.maxRetries = parseInt(document.getElementById('maxRetries').value);

      // Save to storage
      await this.setStorageData({ settings });

      // Show success message
      this.showToast('API configuration saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save API configuration:', error);
      this.showToast('Failed to save API configuration', 'error');
    }
  }

  async saveAllSettings() {
    try {
      this.showLoading(true);

      // Save preferences first
      await this.savePreferences();

      // Try to save API keys to background, but don't fail if it doesn't work
      if (this.currentApiKeys && this.currentApiKeys.length > 0) {
        try {
          const result = await this.sendMessageToBackground({
            type: 'UPDATE_API_KEYS',
            keys: this.currentApiKeys
          });

          if (!result.success) {
            console.warn('Background API key save failed:', result.error);
            // Continue anyway since we saved to settings
          }
        } catch (error) {
          console.warn('Failed to communicate with background script:', error);
          // Continue anyway since we saved to settings
        }
      }

      // Save knowledge base (ensure it's persisted)
      const knowledgeBase = await this.getStorageData('knowledgeBase') || {};
      const kbSaveSuccess = await this.setStorageData({ knowledgeBase });
      if (!kbSaveSuccess) {
        throw new Error('Failed to save knowledge base');
      }

      // Save custom prompts (ensure they're persisted)
      const customPrompts = await this.getStorageData('customPrompts') || {};
      const promptsSaveSuccess = await this.setStorageData({ customPrompts });
      if (!promptsSaveSuccess) {
        throw new Error('Failed to save custom prompts');
      }

      // Save favorites (ensure they're persisted)
      const favoritesSaveSuccess = await this.setStorageData({
        favoritePrompts: Array.from(this.favoritePrompts)
      });
      if (!favoritesSaveSuccess) {
        throw new Error('Failed to save favorite prompts');
      }

      // Verify all data was saved correctly
      const verifyKB = await this.getStorageData('knowledgeBase');
      const verifyPrompts = await this.getStorageData('customPrompts');
      const verifyFavorites = await this.getStorageData('favoritePrompts');

      console.log('Verification - KB:', Object.keys(verifyKB || {}).length, 'Prompts:', Object.keys(verifyPrompts || {}).length, 'Favorites:', (verifyFavorites || []).length);

      this.showToast('All settings saved successfully! 🎉', 'success');
    } catch (error) {
      console.error('Failed to save all settings:', error);
      this.showToast('Failed to save settings: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }



  async openFloatingWidget() {
    try {
      await this.sendMessageToTab({ type: 'OPEN_FLOATING_WIDGET' });
      window.close(); // Close popup after opening widget
    } catch (error) {
      console.error('Failed to open floating widget:', error);
      this.showToast('Failed to open AI assistant', 'error');
    }
  }









  downloadFile(exportDataOrFileId) {
    // Handle both export data objects and file IDs
    if (typeof exportDataOrFileId === 'string') {
      // It's a file ID - download from Knowledge Base
      this.downloadKnowledgeBaseFile(exportDataOrFileId);
      return;
    }

    // It's export data - handle as before
    const exportData = exportDataOrFileId;
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

  async downloadKnowledgeBaseFile(fileId) {
    try {
      const fileDetails = await this.getFileDetails(fileId);

      // Create download link using the webViewLink
      const link = document.createElement('a');
      link.href = fileDetails.webViewLink;
      link.download = fileDetails.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Download started', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      this.showToast('Failed to download file', 'error');
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
    this.isLoading = show;
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  async sendMessageToTab(message) {
    if (!this.currentTabId) {
      throw new Error('No active tab');
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(this.currentTabId, message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  async sendMessageToBackground(message) {
    return new Promise((resolve) => {
      try {
        // Check if extension context is valid before sending message
        if (!chrome.runtime?.id) {
          resolve({ success: false, error: 'Extension context invalidated' });
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || 'Unknown runtime error';
            console.warn('Runtime error:', errorMessage);
            resolve({ success: false, error: errorMessage });
            return;
          }
          resolve(response || { success: false, error: 'No response from background script' });
        });
      } catch (error) {
        console.error('Failed to send message to background:', error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  async getStorageData(keys) {
    return new Promise((resolve, reject) => {
      try {
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
          console.error('Extension context invalidated, cannot read from storage');
          reject(new Error('Extension context invalidated'));
          return;
        }

        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage get error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // If keys is a string, return the value directly
          if (typeof keys === 'string') {
            resolve(result[keys]);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        console.error('Storage get exception:', error);
        reject(error);
      }
    });
  }

  async setStorageData(data) {
    return new Promise((resolve, reject) => {
      try {
        // Validate data before saving
        if (!data || typeof data !== 'object') {
          console.error('Invalid data format for storage:', data);
          reject(new Error('Invalid data format for storage'));
          return;
        }

        // Check for circular references and clean data
        let cleanData = {};
        try {
          Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
              // Test if value can be serialized
              JSON.stringify(data[key]);
              cleanData[key] = data[key];
            }
          });
        } catch (circularError) {
          console.error('Data contains circular references:', circularError);
          reject(new Error('Data contains circular references'));
          return;
        }

        // Check if extension context is valid
        if (!chrome.runtime?.id) {
          console.error('Extension context invalidated, cannot save to storage');
          reject(new Error('Extension context invalidated'));
          return;
        }

        // Use clean data without timestamps to avoid storage issues
        chrome.storage.local.set(cleanData, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          console.log('Successfully saved to storage:', Object.keys(cleanData));
          resolve(true);
        });
      } catch (error) {
        console.error('Storage set exception:', error);
        reject(error);
      }
    });
  }

  // Clear any potential cache conflicts
  async clearStorageCache() {
    try {
      // Send message to content script to clear its cache
      await this.sendMessageToTab({ type: 'CLEAR_STORAGE_CACHE' });
    } catch (error) {
      console.warn('Could not clear content script cache:', error);
    }
  }

  // Force reload data from storage (bypassing any cache)
  async forceReloadFromStorage(key) {
    try {
      // Clear any potential cache first
      await this.clearStorageCache();

      // Get fresh data from storage
      const result = await chrome.storage.local.get([key, `${key}_timestamp`]);
      console.log(`Force reloaded ${key}:`, result[key], 'timestamp:', result[`${key}_timestamp`]);
      return result[key];
    } catch (error) {
      console.error(`Failed to force reload ${key}:`, error);
      return null;
    }
  }

  // Validation helper function
  validateStorageData(key, data) {
    switch (key) {
      case 'knowledgeBase':
        if (typeof data !== 'object' || data === null) {
          throw new Error('Knowledge base must be an object');
        }
        for (const [varKey, varValue] of Object.entries(data)) {
          if (typeof varKey !== 'string' || typeof varValue !== 'string') {
            throw new Error('Knowledge base variables must be strings');
          }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varKey)) {
            throw new Error(`Invalid variable name: ${varKey}`);
          }
        }
        break;

      case 'customPrompts':
        if (typeof data !== 'object' || data === null) {
          throw new Error('Custom prompts must be an object');
        }
        for (const [promptKey, promptData] of Object.entries(data)) {
          if (typeof promptKey !== 'string' || typeof promptData !== 'object') {
            throw new Error('Invalid prompt data structure');
          }
          if (!promptData.name || !promptData.prompt) {
            throw new Error(`Prompt ${promptKey} missing required fields`);
          }
        }
        break;

      case 'favoritePrompts':
        if (!Array.isArray(data)) {
          throw new Error('Favorite prompts must be an array');
        }
        break;
    }
    return true;
  }

  // Fiverr-specific methods
  async fetchFiverrContacts() {
    try {
      this.showLoading(true);
      this.updateFiverrStatus('🔄', 'Fetching contacts...');

      const result = await this.sendMessageToTab({
        type: 'FETCH_FIVERR_CONTACTS'
      });

      if (result.success) {
        this.showToast('Contacts fetched successfully!');
        await this.loadStoredContacts();
      } else {
        throw new Error(result.error || 'Failed to fetch contacts');
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      this.showToast('Failed to fetch contacts', 'error');
      this.updateFiverrStatus('❌', 'Failed to fetch contacts');
    } finally {
      this.showLoading(false);
    }
  }

  async extractCurrentConversation() {
    try {
      this.showLoading(true);
      this.updateFiverrStatus('🔄', 'Extracting conversation...');

      const result = await this.sendMessageToTab({
        type: 'EXTRACT_CURRENT_CONVERSATION'
      });

      if (result.success && result.data) {
        this.showToast('Conversation extracted successfully!');
        await this.loadStoredConversations();
        this.updateFiverrStatus('✅', 'Conversation extracted');
      } else {
        throw new Error(result.error || 'Failed to extract conversation');
      }
    } catch (error) {
      console.error('Failed to extract conversation:', error);
      this.showToast('Failed to extract conversation', 'error');
      this.updateFiverrStatus('❌', 'Failed to extract conversation');
    } finally {
      this.showLoading(false);
    }
  }

  async extractConversationByUsername(username) {
    try {
      this.showLoading(true);
      this.updateFiverrStatus('🔄', `Extracting conversation with ${username}...`);

      const result = await this.sendMessageToTab({
        type: 'EXTRACT_CONVERSATION_BY_USERNAME',
        username
      });

      if (result.success && result.data) {
        this.showToast(`Conversation with ${username} extracted successfully!`);
        await this.loadStoredConversations();
        this.updateFiverrStatus('✅', 'Conversation extracted');
      } else {
        throw new Error(result.error || 'Failed to extract conversation');
      }
    } catch (error) {
      console.error('Failed to extract conversation:', error);
      this.showToast(`Failed to extract conversation with ${username}`, 'error');
      this.updateFiverrStatus('❌', 'Failed to extract conversation');
    } finally {
      this.showLoading(false);
    }
  }

  async updateConversation(username) {
    try {
      this.showLoading(true);
      this.updateFiverrStatus('🔄', `Updating conversation with ${username}...`);

      const result = await this.sendMessageToTab({
        type: 'UPDATE_CONVERSATION',
        username
      });

      if (result.success && result.data) {
        const newMessages = result.data.newMessages || 0;
        this.showToast(`Updated conversation with ${username} (${newMessages} new messages)`);
        await this.loadStoredConversations();
        this.updateFiverrStatus('✅', 'Conversation updated');
      } else {
        throw new Error(result.error || 'Failed to update conversation');
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
      this.showToast(`Failed to update conversation with ${username}`, 'error');
      this.updateFiverrStatus('❌', 'Failed to update conversation');
    } finally {
      this.showLoading(false);
    }
  }

  async deleteConversation(username) {
    if (!confirm(`Are you sure you want to delete the conversation with ${username}?`)) {
      return;
    }

    try {
      this.showLoading(true);

      const result = await this.sendMessageToTab({
        type: 'DELETE_CONVERSATION',
        username
      });

      if (result.success) {
        this.showToast(`Conversation with ${username} deleted`);
        await this.loadStoredConversations();
      } else {
        throw new Error(result.error || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      this.showToast(`Failed to delete conversation with ${username}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }



  updateFiverrStatus(indicator, text) {
    const statusIndicator = document.getElementById('fiverrStatusIndicator');
    const statusText = document.getElementById('fiverrStatusText');

    if (statusIndicator) statusIndicator.textContent = indicator;
    if (statusText) statusText.textContent = text;
  }

  updateProgressInfo(text, counter = '') {
    const progressInfo = document.getElementById('progressInfo');
    const progressText = document.getElementById('progressText');
    const progressCounter = document.getElementById('progressCounter');

    if (progressInfo) {
      progressInfo.style.display = text ? 'block' : 'none';
    }
    if (progressText) progressText.textContent = text;
    if (progressCounter) progressCounter.textContent = counter;
  }

  async loadStoredConversations() {
    try {
      const result = await this.sendMessageToTab({
        type: 'GET_STORED_CONVERSATIONS'
      });

      if (result.success && result.data) {
        this.displayStoredConversations(result.data);
      }
    } catch (error) {
      console.error('Failed to load stored conversations:', error);
    }
  }

  displayStoredConversations(conversations) {
    const conversationsList = document.getElementById('conversationsList');
    if (!conversationsList) return;

    if (!conversations || conversations.length === 0) {
      conversationsList.innerHTML = '<div class="no-conversations">No conversations stored yet</div>';
      return;
    }

    conversationsList.innerHTML = conversations.map(conv => `
      <div class="conversation-item">
        <div class="conversation-info">
          <div class="conversation-name">${conv.username}</div>
          <div class="conversation-meta">
            ${conv.messageCount || 0} messages •
            Last extracted: ${new Date(conv.lastExtracted || 0).toLocaleDateString()}
          </div>
        </div>
        <div class="conversation-actions">
          <button class="btn-icon update-conversation-btn" data-username="${conv.username}" title="Update">🔄</button>
          <button class="btn-icon delete-conversation-btn" data-username="${conv.username}" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }



  async loadStoredContacts() {
    try {
      const result = await this.sendMessageToTab({
        type: 'GET_STORED_CONTACTS'
      });

      if (result.success && result.data) {
        this.displayStoredContacts(result.data);
      }
    } catch (error) {
      console.error('Failed to load stored contacts:', error);
    }
  }

  displayStoredContacts(contactsData) {
    const contactsList = document.getElementById('contactsList');
    const contactsSection = document.getElementById('contactsSection');

    if (!contactsList || !contactsSection) return;

    const contacts = contactsData.contacts || [];

    if (contacts.length === 0) {
      contactsSection.style.display = 'none';
      return;
    }

    contactsSection.style.display = 'block';

    // Show first 20 contacts
    const displayContacts = contacts.slice(0, 20);

    contactsList.innerHTML = displayContacts.map(contact => `
      <div class="contact-item" data-username="${contact.username}">
        <div class="contact-info">
          <div class="contact-name">${contact.username}</div>
          <div class="contact-meta">
            Last message: ${new Date(contact.recentMessageDate).toLocaleDateString()}
          </div>
        </div>
        <div class="contact-actions">
          <button class="btn-icon extract-contact-btn" data-username="${contact.username}" title="Extract">💬</button>
        </div>
      </div>
    `).join('');

    if (contacts.length > 20) {
      contactsList.innerHTML += `
        <div class="contact-item" style="text-align: center; opacity: 0.7;">
          ... and ${contacts.length - 20} more contacts
        </div>
      `;
    }
  }

  handleRuntimeMessage(request, sender, sendResponse) {
    switch (request.type) {
      case 'CONTACTS_PROGRESS':
        this.updateProgressInfo(request.message, request.totalContacts ? `Total: ${request.totalContacts}` : '');
        if (request.isError) {
          this.updateFiverrStatus('❌', request.message);
        } else {
          this.updateFiverrStatus('🔄', request.message);
        }
        break;

      case 'CONTACTS_FETCHED':
        this.updateProgressInfo('');
        this.updateFiverrStatus('✅', request.message);
        this.loadStoredContacts();
        break;

      case 'EXTRACTION_PROGRESS':
        this.updateProgressInfo(request.message);
        this.updateFiverrStatus('🔄', request.message);
        break;

      case 'CONVERSATION_EXTRACTED':
        this.updateProgressInfo('');
        this.updateFiverrStatus('✅', request.message);
        this.loadStoredConversations();
        break;

      case 'CONVERSATION_UPDATED':
        this.updateProgressInfo('');
        this.updateFiverrStatus('✅', request.message);
        this.loadStoredConversations();
        break;

      case 'EXTRACTION_ERROR':
        this.updateProgressInfo('');
        this.updateFiverrStatus('❌', request.message);
        this.showToast(request.message, 'error');
        break;

      case 'CONTACTS_ERROR':
        this.updateProgressInfo('');
        this.updateFiverrStatus('❌', request.message);
        this.showToast(request.message, 'error');
        break;
    }
  }

  // Conversations Management Methods
  async loadConversations() {
    try {
      this.showLoading(true);

      // Get stored conversations from extension storage
      const result = await chrome.storage.local.get('fiverrConversations');
      let conversations = result.fiverrConversations || {};

      // Clean up invalid conversations
      conversations = await this.cleanupInvalidConversations(conversations);

      // Update stats
      this.updateConversationStats(conversations);

      // Render conversations list
      this.renderConversationsList(conversations);

      // Also update the dashboard conversations count (using valid conversations only)
      const validConversations = Object.entries(conversations).filter(([username, conversation]) => {
        return this.isValidConversation(username, conversation);
      });
      const conversationCount = validConversations.length;
      const totalConversationsElement = document.getElementById('totalConversations');
      if (totalConversationsElement) {
        totalConversationsElement.textContent = conversationCount;
      }

    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.showToast('Failed to load conversations', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  updateConversationStats(conversations) {
    // Filter out invalid conversations for accurate count
    const validConversations = Object.entries(conversations).filter(([username, conversation]) => {
      return this.isValidConversation(username, conversation);
    });

    const conversationCount = validConversations.length;
    const storageSize = this.calculateStorageSize(conversations);

    document.getElementById('totalConversationsCount').textContent = conversationCount;
    document.getElementById('storageUsed').textContent = this.formatBytes(storageSize);
  }

  calculateStorageSize(conversations) {
    return new Blob([JSON.stringify(conversations)]).size;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  renderConversationsList(conversations) {
    const conversationsList = document.getElementById('conversationsList');

    // Filter out invalid conversations using the validation method
    const validConversations = Object.entries(conversations).filter(([username, conversation]) => {
      return this.isValidConversation(username, conversation);
    });

    if (validConversations.length === 0) {
      conversationsList.innerHTML = `
        <div class="conversations-empty">
          <div class="conversations-empty-icon">💬</div>
          <div class="conversations-empty-text">No conversations found</div>
          <div class="conversations-empty-subtext">Start chatting on Fiverr to see conversations here</div>
        </div>
      `;
      return;
    }

    const conversationItems = validConversations
      .sort(([,a], [,b]) => (b.lastExtracted || 0) - (a.lastExtracted || 0))
      .map(([username, conversation]) => this.createConversationItem(username, conversation))
      .join('');

    conversationsList.innerHTML = conversationItems;
  }

  createConversationItem(username, conversation) {
    const messageCount = conversation.messages?.length || 0;
    const lastMessage = conversation.messages?.length > 0
      ? conversation.messages[conversation.messages.length - 1]
      : null;

    // Format dates better
    const lastExtractedDate = new Date(conversation.lastExtracted || conversation.extractedAt);
    const formattedDate = this.formatRelativeDate(lastExtractedDate);
    const fullDate = lastExtractedDate.toLocaleString();

    // Create better preview
    const preview = lastMessage
      ? this.cleanMessagePreview(lastMessage.body)
      : 'No messages available';

    // Format username better
    const displayUsername = this.formatUsername(username);

    return `
      <div class="conversation-item" data-username="${username}">
        <div class="conversation-left-column">
          <div class="conversation-item-header">
            <div class="conversation-username">${displayUsername}</div>
            <div class="conversation-date" title="${fullDate}">${formattedDate}</div>
          </div>
          <div class="conversation-stats">
            <span class="conversation-stat">💬 ${messageCount} messages</span>
          </div>
          <div class="conversation-stats">
            <span class="conversation-stat">🕒 ${formattedDate}</span>
          </div>
        </div>
        <div class="conversation-right-column">
          <div class="conversation-preview">${preview}</div>
        </div>
      </div>
    `;
  }

  // Helper methods for better formatting
  formatUsername(username) {
    // Replace underscores with spaces and capitalize
    return username.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatRelativeDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  cleanMessagePreview(text) {
    if (!text) return 'No message content';

    // Remove extra whitespace and newlines
    const cleaned = text.replace(/\s+/g, ' ').trim();

    // Truncate to reasonable length
    if (cleaned.length > 120) {
      return cleaned.substring(0, 120) + '...';
    }

    return cleaned;
  }

  // Validation and cleanup methods
  isValidConversation(username, conversation) {
    // Filter out fake/invalid conversations
    if (username === 'FiverrConversations' || username === 'fiverrConversations') {
      return false;
    }

    // Must have valid username and conversation object
    if (!username || !conversation || typeof conversation !== 'object') {
      return false;
    }

    // Must have messages array
    if (!Array.isArray(conversation.messages)) {
      return false;
    }

    // Must have at least some basic data or messages
    if (conversation.messages.length === 0 && !conversation.lastExtracted) {
      return false;
    }

    return true;
  }

  async cleanupInvalidConversations(conversations) {
    const validConversations = {};
    let hasInvalidConversations = false;

    Object.entries(conversations).forEach(([username, conversation]) => {
      if (this.isValidConversation(username, conversation)) {
        validConversations[username] = conversation;
      } else {
        hasInvalidConversations = true;
        console.log(`Removing invalid conversation: ${username}`);
      }
    });

    // If we found invalid conversations, update storage
    if (hasInvalidConversations) {
      try {
        await chrome.storage.local.set({ fiverrConversations: validConversations });
        console.log('Cleaned up invalid conversations from storage');
      } catch (error) {
        console.error('Failed to cleanup invalid conversations:', error);
      }
    }

    return validConversations;
  }

  async showConversationModal(username) {
    try {
      this.currentConversationUsername = username;

      // Get conversation data
      const result = await chrome.storage.local.get('fiverrConversations');
      const conversations = result.fiverrConversations || {};
      const conversation = conversations[username];

      if (!conversation) {
        this.showToast('Conversation not found', 'error');
        return;
      }

      // Update modal title and meta
      document.getElementById('conversationModalTitle').textContent = `Conversation with ${username}`;
      document.getElementById('conversationModalMeta').textContent =
        `${conversation.messages?.length || 0} messages • Last updated: ${new Date(conversation.lastExtracted || conversation.extractedAt).toLocaleString()}`;

      // Render conversation content
      this.renderConversationContent(conversation);

      // Show modal
      document.getElementById('conversationModalOverlay').classList.add('active');

    } catch (error) {
      console.error('Failed to show conversation modal:', error);
      this.showToast('Failed to load conversation details', 'error');
    }
  }

  renderConversationContent(conversation) {
    const contentContainer = document.getElementById('conversationContent');

    if (!conversation.messages || conversation.messages.length === 0) {
      contentContainer.innerHTML = '<div class="conversations-empty">No messages in this conversation</div>';
      return;
    }

    const messagesHtml = conversation.messages.map(message => {
      const isUser = message.sender === conversation.username;
      const attachmentsHtml = message.attachments && message.attachments.length > 0
        ? `<div class="message-attachments">📎 Attachments: ${message.attachments.map(att => att.filename || 'Unknown file').join(', ')}</div>`
        : '';

      return `
        <div class="conversation-message ${isUser ? 'user' : 'client'}">
          <div class="message-header">
            <div class="message-sender">${message.sender || 'Unknown'}</div>
            <div class="message-time">${message.formattedTime || new Date(message.createdAt).toLocaleString()}</div>
          </div>
          <div class="message-body">${message.body || ''}</div>
          ${attachmentsHtml}
        </div>
      `;
    }).join('');

    contentContainer.innerHTML = messagesHtml;
  }

  closeConversationModal() {
    document.getElementById('conversationModalOverlay').classList.remove('active');
    this.currentConversationUsername = null;
  }

  async exportCurrentConversation() {
    if (!this.currentConversationUsername) {
      this.showToast('No conversation selected', 'error');
      return;
    }

    try {
      const format = document.getElementById('exportFormat').value;

      // Get conversation data
      const result = await chrome.storage.local.get('fiverrConversations');
      const conversations = result.fiverrConversations || {};
      const conversation = conversations[this.currentConversationUsername];

      if (!conversation) {
        this.showToast('Conversation not found', 'error');
        return;
      }

      // Generate export content based on format
      let content, filename, mimeType;

      switch (format) {
        case 'markdown':
          content = await this.convertToMarkdown(conversation);
          filename = `fiverr_conversation_${this.currentConversationUsername}_${new Date().toISOString().split('T')[0]}.md`;
          mimeType = 'text/markdown';
          break;

        case 'json':
          content = JSON.stringify(conversation, null, 2);
          filename = `fiverr_conversation_${this.currentConversationUsername}_${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;

        case 'txt':
          content = this.convertToText(conversation);
          filename = `fiverr_conversation_${this.currentConversationUsername}_${new Date().toISOString().split('T')[0]}.txt`;
          mimeType = 'text/plain';
          break;

        case 'csv':
          content = this.convertToCSV(conversation);
          filename = `fiverr_conversation_${this.currentConversationUsername}_${new Date().toISOString().split('T')[0]}.csv`;
          mimeType = 'text/csv';
          break;

        case 'html':
          content = this.convertToHTML(conversation);
          filename = `fiverr_conversation_${this.currentConversationUsername}_${new Date().toISOString().split('T')[0]}.html`;
          mimeType = 'text/html';
          break;

        default:
          this.showToast('Unsupported export format', 'error');
          return;
      }

      // Download the file
      this.downloadFile({ content, filename, mimeType });
      this.showToast(`Conversation exported as ${format.toUpperCase()}`, 'success');

    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Failed to export conversation', 'error');
    }
  }

  async convertToMarkdown(conversation) {
    let markdown = `# Conversation with ${conversation.username}\n\n`;
    markdown += `**Extracted:** ${new Date(conversation.extractedAt || conversation.lastExtracted).toLocaleString()}\n`;
    markdown += `**Total Messages:** ${conversation.messages?.length || 0}\n\n`;

    if (!conversation.messages || conversation.messages.length === 0) {
      markdown += 'No messages in this conversation.\n';
      return markdown;
    }

    for (const message of conversation.messages) {
      const timestamp = message.formattedTime || new Date(message.createdAt).toLocaleString();
      const sender = message.sender || 'Unknown';

      markdown += `### ${sender} (${timestamp})\n\n`;

      if (message.body) {
        markdown += `${message.body}\n\n`;
      }

      if (message.attachments && message.attachments.length > 0) {
        markdown += '**Attachments:**\n';
        for (const attachment of message.attachments) {
          const fileName = attachment.filename || 'Unnamed File';
          const fileSize = attachment.fileSize ? this.formatBytes(attachment.fileSize) : 'size unknown';
          markdown += `- ${fileName} (${fileSize})\n`;
        }
        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  convertToText(conversation) {
    let text = `Conversation with ${conversation.username}\n`;
    text += `Extracted: ${new Date(conversation.extractedAt || conversation.lastExtracted).toLocaleString()}\n`;
    text += `Total Messages: ${conversation.messages?.length || 0}\n\n`;

    if (!conversation.messages || conversation.messages.length === 0) {
      text += 'No messages in this conversation.\n';
      return text;
    }

    conversation.messages.forEach(message => {
      const timestamp = message.formattedTime || new Date(message.createdAt).toLocaleString();
      const sender = message.sender || 'Unknown';

      text += `${sender} (${timestamp}):\n${message.body || ''}\n\n`;

      if (message.attachments && message.attachments.length > 0) {
        text += 'Attachments:\n';
        message.attachments.forEach(attachment => {
          text += `- ${attachment.filename || 'Unknown file'}\n`;
        });
        text += '\n';
      }
    });

    return text;
  }

  convertToCSV(conversation) {
    let csv = 'Timestamp,Sender,Message,Attachments\n';

    if (!conversation.messages || conversation.messages.length === 0) {
      return csv;
    }

    conversation.messages.forEach(message => {
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

  convertToHTML(conversation) {
    let html = `<!DOCTYPE html>
<html>
<head>
    <title>Conversation with ${conversation.username}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .message.user { background-color: #e3f2fd; }
        .message.client { background-color: #f3e5f5; }
        .message-header { font-weight: bold; margin-bottom: 5px; }
        .message-time { font-size: 12px; color: #666; }
        .message-body { margin-top: 10px; white-space: pre-wrap; }
        .attachments { margin-top: 10px; font-style: italic; color: #666; }
    </style>
</head>
<body>
    <h1>Conversation with ${conversation.username}</h1>
    <p><strong>Extracted:</strong> ${new Date(conversation.extractedAt || conversation.lastExtracted).toLocaleString()}</p>
    <p><strong>Total Messages:</strong> ${conversation.messages?.length || 0}</p>
`;

    if (!conversation.messages || conversation.messages.length === 0) {
      html += '<p>No messages in this conversation.</p>';
    } else {
      conversation.messages.forEach(message => {
        const timestamp = new Date(message.createdAt).toLocaleString();
        const sender = message.sender || 'Unknown';
        const isUser = sender === conversation.username;

        html += `    <div class="message ${isUser ? 'user' : 'client'}">
        <div class="message-header">${sender}</div>
        <div class="message-time">${timestamp}</div>
        <div class="message-body">${(message.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;

        if (message.attachments && message.attachments.length > 0) {
          html += `        <div class="attachments">Attachments: ${message.attachments.map(att => att.filename || 'Unknown file').join(', ')}</div>`;
        }

        html += `    </div>\n`;
      });
    }

    html += `</body>
</html>`;

    return html;
  }



  async deleteCurrentConversation() {
    if (!this.currentConversationUsername) {
      this.showToast('No conversation selected', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete the conversation with ${this.currentConversationUsername}?`)) {
      return;
    }

    try {
      // Get current conversations
      const result = await chrome.storage.local.get('fiverrConversations');
      const conversations = result.fiverrConversations || {};

      // Delete the conversation
      delete conversations[this.currentConversationUsername];

      // Save back to storage
      await chrome.storage.local.set({ fiverrConversations: conversations });

      // Close modal and refresh list
      this.closeConversationModal();
      await this.loadConversations();

      this.showToast('Conversation deleted successfully', 'success');

    } catch (error) {
      console.error('Failed to delete conversation:', error);
      this.showToast('Failed to delete conversation', 'error');
    }
  }

  async refreshCurrentConversation() {
    if (!this.currentConversationUsername) {
      this.showToast('No conversation selected', 'error');
      return;
    }

    try {
      this.showLoading(true);

      // Send message to content script to refresh this specific conversation
      const response = await this.sendMessageToTab({
        type: 'EXTRACT_CONVERSATION',
        username: this.currentConversationUsername,
        forceRefresh: true
      });

      if (response && response.success) {
        // Reload the modal with fresh data
        await this.showConversationModal(this.currentConversationUsername);
        await this.loadConversations();
        this.showToast('Conversation refreshed successfully', 'success');
      } else {
        this.showToast('Failed to refresh conversation', 'error');
      }

    } catch (error) {
      console.error('Failed to refresh conversation:', error);
      this.showToast('Failed to refresh conversation', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async clearAllConversations() {
    if (!confirm('Are you sure you want to delete ALL stored conversations? This action cannot be undone.')) {
      return;
    }

    try {
      this.showLoading(true);

      // Clear all conversations from storage
      await chrome.storage.local.set({ fiverrConversations: {} });

      // Refresh the conversations list
      await this.loadConversations();

      // Close modal if open
      if (this.currentConversationUsername) {
        this.closeConversationModal();
      }

      this.showToast('All conversations cleared successfully', 'success');

    } catch (error) {
      console.error('Failed to clear conversations:', error);
      this.showToast('Failed to clear conversations', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  // Authentication Methods
  async initializeAuthentication() {
    try {
      // Check browser compatibility first
      this.checkBrowserCompatibility();

      // Set up authentication event listeners
      this.setupAuthEventListeners();

      // Check authentication status
      await this.checkAuthStatus();

    } catch (error) {
      console.error('aiFiverr: Failed to initialize authentication:', error);
      this.showAuthError('Failed to initialize authentication');
    }
  }

  checkBrowserCompatibility() {
    const userAgent = navigator.userAgent;
    const isEdge = userAgent.includes('Edg/') || userAgent.includes('Edge/');

    if (isEdge) {
      // Add a subtle warning banner for Edge users
      const authSection = document.querySelector('.auth-section');
      if (authSection) {
        const warningBanner = document.createElement('div');
        warningBanner.className = 'browser-warning';
        warningBanner.innerHTML = `
          <div class="warning-content">
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">Limited features in Edge. <a href="#" class="edge-info-link">Learn more</a></span>
          </div>
        `;

        // Add click handler for the learn more link
        warningBanner.querySelector('.edge-info-link').addEventListener('click', (e) => {
          e.preventDefault();
          this.showEdgeCompatibilityDialog('Edge compatibility information');
        });

        // Add warning styles
        const style = document.createElement('style');
        style.textContent = `
          .browser-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 12px;
          }

          .warning-content {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .warning-icon {
            font-size: 14px;
          }

          .warning-text {
            color: #856404;
            flex: 1;
          }

          .warning-text a {
            color: #856404;
            text-decoration: underline;
            cursor: pointer;
          }

          .warning-text a:hover {
            color: #533f03;
          }
        `;

        document.head.appendChild(style);
        authSection.insertBefore(warningBanner, authSection.firstChild);
      }
    }
  }

  setupAuthEventListeners() {
    // Sign in button
    const signInBtn = document.getElementById('signInBtn');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => this.handleSignIn());
    }

    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this.handleSignOut());
    }

    // Test connection button
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => this.handleTestConnection());
    }
  }

  async checkAuthStatus() {
    try {
      // Send message to background script to check auth status
      const response = await chrome.runtime.sendMessage({
        type: 'GOOGLE_AUTH_STATUS'
      });

      if (response && response.success) {
        this.updateAuthUI({
          isAuthenticated: response.isAuthenticated,
          user: response.user
        });
      } else {
        this.updateAuthUI({ isAuthenticated: false });
      }

    } catch (error) {
      console.error('aiFiverr: Failed to check auth status:', error);
      this.updateAuthUI({ isAuthenticated: false });
    }
  }

  updateAuthUI(authStatus) {
    const authStatusEl = document.getElementById('authStatus');
    const notAuthenticatedEl = document.getElementById('authNotAuthenticated');
    const authenticatedEl = document.getElementById('authAuthenticated');

    // Hide loading
    if (authStatusEl) {
      authStatusEl.style.display = 'none';
    }

    if (authStatus.isAuthenticated && authStatus.user) {
      // Show authenticated state
      if (notAuthenticatedEl) notAuthenticatedEl.style.display = 'none';
      if (authenticatedEl) authenticatedEl.style.display = 'block';

      // Update user info
      this.updateUserInfo(authStatus.user);

      // Load and display stats
      this.loadAuthStats();

    } else {
      // Show not authenticated state
      if (authenticatedEl) authenticatedEl.style.display = 'none';
      if (notAuthenticatedEl) notAuthenticatedEl.style.display = 'block';
    }
  }

  updateUserInfo(user) {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');

    // Handle both Firebase (photoURL) and legacy (picture) formats
    const profilePicture = user.photoURL || user.picture;
    if (userAvatar && profilePicture) {
      userAvatar.src = profilePicture;
      userAvatar.alt = user.displayName || user.name || user.email;
      userAvatar.style.display = 'block';
    } else if (userAvatar) {
      // Hide avatar if no picture available
      userAvatar.style.display = 'none';
    }

    // Handle both Firebase (displayName) and legacy (name) formats
    const displayName = user.displayName || user.name;
    if (userName && displayName) {
      userName.textContent = displayName;
    }

    if (userEmail && user.email) {
      userEmail.textContent = user.email;
    }
  }

  async loadAuthStats() {
    try {
      // For now, show basic stats - we can enhance this later
      const stats = {
        sheetsConnected: true,
        driveConnected: true,
        knowledgeBaseFiles: 0,
        lastSync: Date.now()
      };

      this.displayAuthStats(stats);

    } catch (error) {
      console.error('aiFiverr: Failed to load auth stats:', error);
    }
  }

  displayAuthStats(stats) {
    const authStatsEl = document.getElementById('authStats');
    if (!authStatsEl) return;

    authStatsEl.innerHTML = `
      <h4>Account Statistics</h4>
      <div class="auth-stat-item">
        <span>Google Sheets:</span>
        <span class="auth-stat-value">${stats.sheetsConnected ? 'Connected' : 'Not Connected'}</span>
      </div>
      <div class="auth-stat-item">
        <span>Google Drive:</span>
        <span class="auth-stat-value">${stats.driveConnected ? 'Connected' : 'Not Connected'}</span>
      </div>
      <div class="auth-stat-item">
        <span>Knowledge Base Files:</span>
        <span class="auth-stat-value">${stats.knowledgeBaseFiles || 0}</span>
      </div>
      <div class="auth-stat-item">
        <span>Last Sync:</span>
        <span class="auth-stat-value">${stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : 'Never'}</span>
      </div>
    `;
  }

  async handleSignIn() {
    try {
      this.showLoading(true);

      // Use Firebase authentication to match the background service
      const response = await chrome.runtime.sendMessage({
        type: 'FIREBASE_AUTH_START'
      });

      if (response && response.success) {
        this.showToast('Successfully signed in!', 'success');
        await this.checkAuthStatus();
      } else {
        // Check if this is an Edge compatibility issue
        if (response?.isEdgeCompatibilityIssue) {
          this.showEdgeCompatibilityDialog(response.error);
        } else {
          throw new Error(response?.error || 'Sign in failed');
        }
      }

    } catch (error) {
      console.error('aiFiverr: Sign in failed:', error);
      this.showToast(`Sign in failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async handleSignOut() {
    try {
      this.showLoading(true);

      // Use Firebase authentication to match the background service
      const response = await chrome.runtime.sendMessage({
        type: 'FIREBASE_AUTH_SIGNOUT'
      });

      if (response && response.success) {
        this.showToast('Successfully signed out', 'success');
        await this.checkAuthStatus();
      } else {
        throw new Error(response?.error || 'Sign out failed');
      }

    } catch (error) {
      console.error('aiFiverr: Sign out failed:', error);
      this.showToast(`Sign out failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async handleTestConnection() {
    try {
      this.showLoading(true);

      // Test by getting a valid token from background script
      const response = await chrome.runtime.sendMessage({
        type: 'FIREBASE_AUTH_VALIDATE_TOKEN'
      });

      if (response && response.success && response.token) {
        this.showToast('Connection test successful!', 'success');
        await this.loadAuthStats();
      } else {
        throw new Error('No valid authentication token available');
      }

    } catch (error) {
      console.error('aiFiverr: Connection test failed:', error);
      this.showToast(`Connection test failed: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showEdgeCompatibilityDialog(message) {
    // Create a modal dialog for Edge compatibility
    const modal = document.createElement('div');
    modal.className = 'edge-compatibility-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Browser Compatibility Notice</h3>
            <button class="modal-close" onclick="this.closest('.edge-compatibility-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="browser-icons">
              <div class="browser-item">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTM2IDI0QzM2IDMwLjYyNzQgMzAuNjI3NCAzNiAyNCAzNkMxNy4zNzI2IDM2IDEyIDMwLjYyNzQgMTIgMjRDMTIgMTcuMzcyNiAxNy4zNzI2IDEyIDI0IDEyQzMwLjYyNzQgMTIgMzYgMTcuMzcyNiAzNiAyNCIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4K" alt="Chrome">
                <span>Chrome</span>
                <span class="recommended">Recommended</span>
              </div>
              <div class="browser-item disabled">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiMwMDc4RDQiLz4KPHBhdGggZD0iTTM2IDI0QzM2IDMwLjYyNzQgMzAuNjI3NCAzNiAyNCAzNkMxNy4zNzI2IDM2IDEyIDMwLjYyNzQgMTIgMjRDMTIgMTcuMzcyNiAxNy4zNzI2IDEyIDI0IDEyQzMwLjYyNzQgMTIgMzYgMTcuMzcyNiAzNiAyNCIgZmlsbD0iI0ZGRkZGRiIvPgo8L3N2Zz4K" alt="Edge">
                <span>Edge</span>
                <span class="limited">Limited Support</span>
              </div>
            </div>
            <div class="message">
              <p><strong>Microsoft Edge has limited support for Google authentication in extensions.</strong></p>
              <p>For the best experience with aiFiverr, please use Google Chrome which supports all features including:</p>
              <ul>
                <li>✅ Google authentication & data sync</li>
                <li>✅ Google Drive integration</li>
                <li>✅ Knowledge base file uploads</li>
                <li>✅ Cross-device settings sync</li>
              </ul>
              <p><strong>In Edge, you can still use:</strong></p>
              <ul>
                <li>✅ Basic AI chat functionality</li>
                <li>✅ Text processing features</li>
                <li>✅ Local settings (not synced)</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="this.closest('.edge-compatibility-modal').remove()">
              Continue without authentication
            </button>
            <button class="btn-primary" onclick="window.open('https://www.google.com/chrome/', '_blank')">
              Download Chrome
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles for the modal
    const style = document.createElement('style');
    style.textContent = `
      .edge-compatibility-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .modal-content {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      }

      .modal-header {
        padding: 20px 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .modal-header h3 {
        margin: 0;
        color: #333;
        font-size: 18px;
        font-weight: 600;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }

      .modal-close:hover {
        background: #f0f0f0;
      }

      .modal-body {
        padding: 20px;
      }

      .browser-icons {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        justify-content: center;
      }

      .browser-item {
        text-align: center;
        padding: 15px;
        border-radius: 8px;
        border: 2px solid #e0e0e0;
        min-width: 100px;
      }

      .browser-item img {
        width: 32px;
        height: 32px;
        margin-bottom: 8px;
      }

      .browser-item span {
        display: block;
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }

      .browser-item .recommended {
        background: #4CAF50;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        margin-top: 4px;
      }

      .browser-item .limited {
        background: #FF9800;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        margin-top: 4px;
      }

      .browser-item.disabled {
        opacity: 0.6;
        border-color: #ccc;
      }

      .message p {
        margin: 0 0 12px;
        color: #333;
        line-height: 1.5;
      }

      .message ul {
        margin: 8px 0;
        padding-left: 20px;
      }

      .message li {
        margin: 4px 0;
        color: #555;
      }

      .modal-footer {
        padding: 0 20px 20px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .btn-primary, .btn-secondary {
        padding: 10px 20px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #4285F4;
        color: white;
      }

      .btn-primary:hover {
        background: #3367D6;
      }

      .btn-secondary {
        background: #f8f9fa;
        color: #333;
        border: 1px solid #dadce0;
      }

      .btn-secondary:hover {
        background: #e8eaed;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);
  }

  showAuthError(message) {
    const authStatusEl = document.getElementById('authStatus');
    if (authStatusEl) {
      authStatusEl.innerHTML = `
        <div class="auth-error">
          <span style="color: #dc3545;">⚠️ ${message}</span>
        </div>
      `;
    }
  }

  // Knowledge Base Files Methods
  async checkGoogleAuth() {
    try {
      // Use Firebase authentication to match the background service
      const response = await chrome.runtime.sendMessage({ type: 'FIREBASE_AUTH_STATUS' });
      return response || { success: false, error: 'No auth response' };
    } catch (error) {
      console.error('Failed to check Google auth:', error);
      return { success: false, error: error.message };
    }
  }

  switchKnowledgeBaseTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.kb-tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.kb-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Load data for the active tab
    if (tabName === 'files') {
      this.loadKnowledgeBaseFiles();
    }
  }

  toggleFileUploadArea() {
    const uploadArea = document.getElementById('kbFileUploadArea');
    const isVisible = uploadArea.style.display !== 'none';
    uploadArea.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // Reset upload area
      document.getElementById('uploadProgress').style.display = 'none';
      document.getElementById('progressFill').style.width = '0%';
    }
  }

  async handleFileSelection(files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const uploadArea = document.getElementById('kbFileUploadArea');
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // Show upload area and progress
    uploadArea.style.display = 'block';
    progressContainer.style.display = 'block';

    try {
      // Check authentication
      const authResult = await this.checkGoogleAuth();
      if (!authResult.success) {
        this.showToast('Please sign in with Google to upload files', 'error');
        return;
      }

      let uploadedCount = 0;
      const totalFiles = fileArray.length;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        try {
          progressText.textContent = `Uploading ${file.name}... (${i + 1}/${totalFiles})`;
          progressFill.style.width = `${(i / totalFiles) * 100}%`;

          // Upload to Google Drive
          const result = await this.uploadFileToGoogleDrive(file);
          uploadedCount++;

          // Also upload to Gemini Files API for immediate use
          try {
            await this.uploadFileToGeminiAPI(file);
          } catch (geminiError) {
            console.warn('Failed to upload to Gemini API:', geminiError);
            // Continue even if Gemini upload fails
          }

        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
        }
      }

      // Complete
      progressFill.style.width = '100%';
      progressText.textContent = `Upload complete! ${uploadedCount}/${totalFiles} files uploaded.`;

      if (uploadedCount > 0) {
        this.showToast(`Successfully uploaded ${uploadedCount} file(s)`, 'success');
        await this.loadKnowledgeBaseFiles();
      }

      // Hide upload area after a delay
      setTimeout(() => {
        this.toggleFileUploadArea();
      }, 2000);

    } catch (error) {
      console.error('File upload error:', error);
      this.showToast(`Upload failed: ${error.message}`, 'error');
      progressContainer.style.display = 'none';
    }
  }

  async uploadFileToGoogleDrive(file) {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert file to base64 for message passing
        const fileData = await this.fileToBase64(file);

        chrome.runtime.sendMessage({
          type: 'UPLOAD_FILE_TO_DRIVE',
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: fileData
          },
          fileName: file.name,
          description: `Knowledge base file uploaded on ${new Date().toISOString()}`
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            // Check if refresh is required and trigger it
            if (response.refreshRequired) {
              console.log('aiFiverr Popup: Upload successful, triggering files refresh...');
              // Trigger refresh after a short delay to allow Drive API to propagate
              setTimeout(() => {
                this.loadKnowledgeBaseFiles().catch(error => {
                  console.warn('aiFiverr Popup: Auto-refresh after upload failed:', error);
                });
              }, 1000);
            }
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Upload failed'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async uploadFileToGeminiAPI(file) {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert file to base64 for message passing
        const fileData = await this.fileToBase64(file);

        chrome.runtime.sendMessage({
          type: 'UPLOAD_FILE_TO_GEMINI',
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: fileData
          },
          displayName: file.name,
          enhanced: true  // Use enhanced upload method
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Enhanced Gemini upload failed'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Enhanced file upload with progress tracking
   */
  async uploadFileToGeminiAPIEnhanced(file, onProgress = null) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('aiFiverr Popup: Starting enhanced file upload:', file.name);

        if (onProgress) onProgress(10, 'Converting file...');

        // Convert file to base64 for message passing
        const fileData = await this.fileToBase64(file);

        if (onProgress) onProgress(30, 'Uploading to Gemini...');

        chrome.runtime.sendMessage({
          type: 'UPLOAD_FILE_TO_GEMINI',
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: fileData
          },
          displayName: file.name,
          enhanced: true
        }, async (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response && response.success) {
            if (onProgress) onProgress(70, 'Processing file...');

            // Wait for file processing if needed
            if (response.data.state !== 'ACTIVE') {
              try {
                await this.waitForFileProcessing(response.data.name, onProgress);
              } catch (processingError) {
                console.warn('aiFiverr Popup: File processing timeout, continuing anyway:', processingError);
              }
            }

            if (onProgress) onProgress(100, 'Upload complete!');
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Enhanced Gemini upload failed'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Wait for file processing with progress updates
   */
  async waitForFileProcessing(fileName, onProgress = null, maxWaitTime = 60000) {
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;

      if (onProgress) {
        const progress = Math.min(70 + (attempts * 5), 95);
        onProgress(progress, `Processing file (${attempts}/30)...`);
      }

      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'CHECK_GEMINI_FILE_STATUS',
            fileName: fileName
          }, resolve);
        });

        if (response && response.success && response.data.state === 'ACTIVE') {
          console.log('aiFiverr Popup: File processing completed');
          return response.data;
        }

        console.log(`aiFiverr Popup: File state: ${response?.data?.state || 'unknown'}, waiting...`);
      } catch (error) {
        console.log('aiFiverr Popup: Checking file status...');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('File processing timeout');
  }

  async loadKnowledgeBaseFiles() {
    try {
      // Only log if debugging is enabled
      if (window.aiFiverrDebug) {
        console.log('aiFiverr Popup: Loading knowledge base files...');
      }

      const authResult = await this.checkGoogleAuth();

      if (!authResult.success) {
        this.displayKnowledgeBaseFilesError('Please sign in with Google to view files');
        return;
      }

      // Get files from Google Drive
      console.log('aiFiverr Popup: Getting Drive files...');
      const driveFiles = await this.getGoogleDriveFiles();
      console.log('aiFiverr Popup: Drive files:', driveFiles);

      // Get files from Gemini API
      console.log('aiFiverr Popup: Getting Gemini files...');
      const geminiFiles = await this.getGeminiFiles();
      console.log('aiFiverr Popup: Gemini files:', geminiFiles);

      // Merge and display files
      const allFiles = this.mergeFileData(driveFiles, geminiFiles);
      console.log('aiFiverr Popup: Merged files:', allFiles);

      this.displayKnowledgeBaseFiles(allFiles);
      this.updateKnowledgeBaseStats(allFiles);

    } catch (error) {
      console.error('aiFiverr Popup: Failed to load knowledge base files:', error);
      this.displayKnowledgeBaseFilesError(error.message);
    }
  }

  async getGoogleDriveFiles() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: 'GET_DRIVE_FILES'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('aiFiverr Popup: Runtime error getting Drive files:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data || []);
          } else {
            reject(new Error(response?.error || 'Failed to get Drive files'));
          }
        });
      } catch (error) {
        console.error('aiFiverr Popup: Error sending message for Drive files:', error);
        reject(error);
      }
    });
  }

  async getGeminiFiles() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          type: 'GET_GEMINI_FILES'
        }, (response) => {
          if (chrome.runtime.lastError) {
            if (window.aiFiverrDebug) {
              console.warn('aiFiverr Popup: Runtime error getting Gemini files:', chrome.runtime.lastError.message);
            }
            resolve([]); // Gemini files are optional
          } else if (response && response.success) {
            resolve(response.data || []);
          } else {
            resolve([]); // Gemini files are optional
          }
        });
      } catch (error) {
        if (window.aiFiverrDebug) {
          console.error('aiFiverr Popup: Error sending message for Gemini files:', error);
        }
        resolve([]); // Gemini files are optional
      }
    });
  }

  mergeFileData(driveFiles, geminiFiles) {
    const merged = [];
    const geminiFileMap = new Map();

    // Create map of Gemini files by display name
    geminiFiles.forEach(file => {
      geminiFileMap.set(file.displayName, file);
    });

    // Merge Drive files with Gemini data
    driveFiles.forEach(driveFile => {
      const geminiFile = geminiFileMap.get(driveFile.name);
      merged.push({
        ...driveFile,
        geminiFile: geminiFile,
        geminiStatus: geminiFile ? geminiFile.state : 'not_uploaded',
        geminiUri: geminiFile ? geminiFile.uri : null,
        geminiName: geminiFile ? geminiFile.name : null
      });
    });

    return merged;
  }

  displayKnowledgeBaseFiles(files) {
    const container = document.getElementById('kbFilesList');

    if (!files || files.length === 0) {
      container.innerHTML = `
        <div class="kb-files-empty">
          <div class="kb-files-empty-icon">📁</div>
          <h4>No files uploaded yet</h4>
          <p>Upload files to your knowledge base to get started.<br>Files will be stored in Google Drive and can be used with AI prompts.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = files.map(file => {
      const fileType = this.getFileTypeCategory(file.mimeType);
      const fileIcon = this.getFileIcon(fileType);
      const fileSize = this.formatFileSize(file.size);
      const connectionStatus = this.getFileConnectionStatus(file);
      const statusIcon = this.getStatusIcon(connectionStatus);

      return `
        <div class="kb-file-item" data-file-id="${file.id}">
          <div class="file-icon ${fileType}">${fileIcon}</div>
          <div class="file-info">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-meta">
              <span>${fileSize}</span>
              <span>${new Date(file.modifiedTime).toLocaleDateString()}</span>
              <span>${file.mimeType.split('/')[0]}</span>
            </div>
          </div>
          <div class="file-status">
            <div class="status-indicator ${connectionStatus}" title="Gemini Status: ${connectionStatus}">${statusIcon}</div>
          </div>
          <div class="file-actions">
            ${connectionStatus === 'EXPIRED' ?
              `<button class="file-action-btn refresh-btn" data-action="refresh" data-file-id="${file.id}" title="Refresh Gemini Link">🔄</button>` :
              ''
            }
            <button class="file-action-btn" data-action="details" data-file-id="${file.id}" title="View Details">👁️</button>
            <button class="file-action-btn" data-action="download" data-file-id="${file.id}" title="Download">📥</button>
            <button class="file-action-btn" data-action="delete" data-file-id="${file.id}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  displayKnowledgeBaseFilesError(message) {
    const container = document.getElementById('kbFilesList');
    container.innerHTML = `
      <div class="kb-files-empty">
        <div class="kb-files-empty-icon">⚠️</div>
        <h4>Unable to load files</h4>
        <p>${message}</p>
      </div>
    `;
  }

  updateKnowledgeBaseStats(files) {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const connectedFiles = files.filter(f => this.isFileConnectedToGemini(f)).length;

    document.getElementById('totalKbFiles').textContent = totalFiles;
    document.getElementById('kbStorageUsed').textContent = this.formatFileSize(totalSize);

    // Update drive status to show connection info
    const driveStatusText = totalFiles > 0
      ? `${connectedFiles}/${totalFiles} files connected`
      : 'No Files';
    document.getElementById('driveStatus').textContent = driveStatusText;
  }

  getFileTypeCategory(mimeType) {
    if (!mimeType) return 'unknown';

    const type = mimeType.split('/')[0];
    const subtype = mimeType.split('/')[1];

    if (type === 'text' || mimeType.includes('document') || mimeType.includes('pdf')) {
      return 'document';
    } else if (type === 'image') {
      return 'image';
    } else if (type === 'audio') {
      return 'audio';
    } else if (type === 'video') {
      return 'video';
    } else if (mimeType.includes('javascript') || mimeType.includes('json') ||
               mimeType.includes('xml') || mimeType.includes('css') ||
               subtype === 'x-python' || subtype === 'x-java-source') {
      return 'code';
    }

    return 'document';
  }

  getFileIcon(fileType) {
    const icons = {
      document: '📄',
      image: '🖼️',
      audio: '🎵',
      video: '🎬',
      code: '💻',
      unknown: '📎'
    };
    return icons[fileType] || icons.unknown;
  }

  /**
   * Get unified file connection status
   */
  getFileConnectionStatus(file) {
    // Check if file has geminiUri (most reliable indicator)
    if (file.geminiUri) {
      // Check if file is expired (48 hours)
      if (this.isGeminiFileExpired(file)) {
        return 'EXPIRED';
      }
      return file.geminiStatus || 'ACTIVE';
    }

    // Check if file has geminiFile object
    if (file.geminiFile) {
      // Check if file is expired (48 hours)
      if (this.isGeminiFileExpired(file.geminiFile)) {
        return 'EXPIRED';
      }
      return file.geminiFile.state || 'PROCESSING';
    }

    // Check geminiStatus
    if (file.geminiStatus === 'ACTIVE') {
      return 'ACTIVE';
    } else if (file.geminiStatus === 'PROCESSING') {
      return 'PROCESSING';
    } else if (file.geminiStatus === 'FAILED') {
      return 'FAILED';
    }

    // Default to not uploaded
    return 'not_uploaded';
  }

  /**
   * Check if Gemini file is expired (48 hours)
   */
  isGeminiFileExpired(file) {
    if (!file || !file.createTime) {
      return false;
    }

    try {
      const createTime = new Date(file.createTime);
      const now = new Date();
      const hoursDiff = (now - createTime) / (1000 * 60 * 60);

      return hoursDiff >= 48;
    } catch (error) {
      console.warn('Error checking file expiration:', error);
      return false;
    }
  }

  /**
   * Check if file is connected to Gemini
   */
  isFileConnectedToGemini(file) {
    const status = this.getFileConnectionStatus(file);
    return status === 'ACTIVE';
  }

  getStatusIcon(status) {
    const icons = {
      'ACTIVE': '✅',
      'PROCESSING': '⏳',
      'FAILED': '❌',
      'EXPIRED': '🔴',
      'not_uploaded': '⚪'
    };
    return icons[status] || icons.not_uploaded;
  }

  formatFileSize(bytes) {
    // Handle undefined, null, or non-numeric values
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    // Ensure i is within bounds
    const sizeIndex = Math.min(i, sizes.length - 1);
    const size = Math.round(bytes / Math.pow(1024, sizeIndex) * 100) / 100;

    return size + ' ' + sizes[sizeIndex];
  }

  async searchKnowledgeBaseFiles() {
    const query = document.getElementById('kbFileSearch').value.trim();

    try {
      const files = await this.searchFiles(query);
      this.displayKnowledgeBaseFiles(files);
    } catch (error) {
      console.error('Search failed:', error);
      this.showToast('Search failed', 'error');
    }
  }

  async searchFiles(query) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'SEARCH_DRIVE_FILES',
        query: query
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data || []);
        } else {
          reject(new Error(response?.error || 'Search failed'));
        }
      });
    });
  }

  async filterKnowledgeBaseFiles() {
    const typeFilter = document.getElementById('fileTypeFilter').value;

    try {
      const allFiles = await this.getGoogleDriveFiles();
      let filteredFiles = allFiles;

      if (typeFilter) {
        filteredFiles = allFiles.filter(file => {
          const category = this.getFileTypeCategory(file.mimeType);
          return category === typeFilter || file.mimeType.startsWith(typeFilter);
        });
      }

      this.displayKnowledgeBaseFiles(filteredFiles);
    } catch (error) {
      console.error('Filter failed:', error);
    }
  }

  async sortKnowledgeBaseFiles() {
    const sortOrder = document.getElementById('fileSortOrder').value;

    try {
      const files = await this.getGoogleDriveFiles();

      files.sort((a, b) => {
        switch (sortOrder) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'size':
            return (b.size || 0) - (a.size || 0);
          case 'created':
            return new Date(b.createdTime) - new Date(a.createdTime);
          case 'modified':
          default:
            return new Date(b.modifiedTime) - new Date(a.modifiedTime);
        }
      });

      this.displayKnowledgeBaseFiles(files);
    } catch (error) {
      console.error('Sort failed:', error);
    }
  }

  // File detail modal methods
  selectedFileId = null;

  async showFileDetails(fileId) {
    this.selectedFileId = fileId;

    try {
      const fileDetails = await this.getFileDetails(fileId);
      this.populateFileDetailModal(fileDetails);
      document.getElementById('kbFileModalOverlay').style.display = 'flex';
    } catch (error) {
      console.error('Failed to get file details:', error);
      this.showToast('Failed to load file details', 'error');
    }
  }

  hideFileDetailModal() {
    document.getElementById('kbFileModalOverlay').style.display = 'none';
    this.selectedFileId = null;
  }

  async getFileDetails(fileId, retryCount = 0) {
    const maxRetries = 3;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_FILE_DETAILS',
        fileId: fileId
      }, (response) => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`);
          if (retryCount < maxRetries) {
            console.warn(`Retrying getFileDetails (${retryCount + 1}/${maxRetries}):`, error.message);
            setTimeout(() => {
              this.getFileDetails(fileId, retryCount + 1).then(resolve).catch(reject);
            }, 1000 * (retryCount + 1)); // Exponential backoff
          } else {
            reject(error);
          }
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          const error = new Error(response?.error || `Failed to get file details for ${fileId}`);
          if (retryCount < maxRetries && (!response || response.error?.includes('timeout'))) {
            console.warn(`Retrying getFileDetails (${retryCount + 1}/${maxRetries}):`, error.message);
            setTimeout(() => {
              this.getFileDetails(fileId, retryCount + 1).then(resolve).catch(reject);
            }, 1000 * (retryCount + 1));
          } else {
            reject(error);
          }
        }
      });
    });
  }

  populateFileDetailModal(fileDetails) {
    document.getElementById('kbFileModalTitle').textContent = fileDetails.name;
    document.getElementById('kbFileModalMeta').textContent = `${this.formatFileSize(fileDetails.size)} • ${new Date(fileDetails.modifiedTime).toLocaleDateString()}`;

    document.getElementById('fileInfoName').textContent = fileDetails.name;
    document.getElementById('fileInfoType').textContent = fileDetails.mimeType;
    document.getElementById('fileInfoSize').textContent = this.formatFileSize(fileDetails.size);
    document.getElementById('fileInfoCreated').textContent = new Date(fileDetails.createdTime).toLocaleString();
    document.getElementById('fileInfoModified').textContent = new Date(fileDetails.modifiedTime).toLocaleString();
    document.getElementById('fileInfoGeminiStatus').textContent = fileDetails.geminiStatus || 'Not uploaded';

    document.getElementById('fileDescriptionEdit').value = fileDetails.description || '';
    document.getElementById('fileTagsEdit').value = fileDetails.tags ? fileDetails.tags.join(', ') : '';

    // Show preview if applicable
    this.showFilePreview(fileDetails);
  }

  showFilePreview(fileDetails) {
    const previewContainer = document.getElementById('filePreview');
    const previewSection = document.getElementById('filePreviewSection');

    if (fileDetails.mimeType.startsWith('image/')) {
      previewSection.style.display = 'block';
      previewContainer.innerHTML = `<img src="${fileDetails.webViewLink}" alt="${fileDetails.name}" style="max-width: 100%; max-height: 200px;">`;
    } else if (fileDetails.mimeType.startsWith('text/')) {
      previewSection.style.display = 'block';
      previewContainer.innerHTML = '<p>Text file preview not available</p>';
    } else {
      previewSection.style.display = 'none';
    }
  }

  async deleteSelectedFile() {
    if (!this.selectedFileId) return;

    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      await this.deleteFile(this.selectedFileId);
      this.showToast('File deleted successfully', 'success');
      this.hideFileDetailModal();
      await this.loadKnowledgeBaseFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      this.showToast('Failed to delete file', 'error');
    }
  }

  async handleDeleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      this.showLoading(true);
      await this.deleteFile(fileId);
      this.showToast('File deleted successfully', 'success');
      await this.loadKnowledgeBaseFiles(); // Refresh the file list
    } catch (error) {
      console.error('Failed to delete file:', error);
      this.showToast(`Failed to delete file: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async deleteFile(fileId) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'DELETE_DRIVE_FILE',
        fileId: fileId
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          // Check if refresh is required and trigger it
          if (response.refreshRequired) {
            console.log('aiFiverr Popup: Delete successful, triggering files refresh...');
            // Trigger refresh after a short delay
            setTimeout(() => {
              this.loadKnowledgeBaseFiles().catch(error => {
                console.warn('aiFiverr Popup: Auto-refresh after delete failed:', error);
              });
            }, 500);
          }
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Delete failed'));
        }
      });
    });
  }

  async refreshGeminiFile(fileId) {
    try {
      this.showLoading(true);
      this.showToast('Refreshing Gemini file...', 'info');

      // Get file details from Google Drive
      const fileDetails = await this.getFileDetails(fileId);

      // Download file content from Google Drive
      const response = await fetch(fileDetails.webViewLink);
      if (!response.ok) {
        throw new Error('Failed to download file from Google Drive');
      }

      const blob = await response.blob();

      // Fix MIME type - never use application/octet-stream from Google Drive
      let safeMimeType = fileDetails.mimeType;
      if (safeMimeType === 'application/octet-stream') {
        // Try to detect proper MIME type from file extension
        const extension = fileDetails.name.split('.').pop().toLowerCase();
        const mimeTypes = {
          'txt': 'text/plain', 'md': 'text/markdown', 'pdf': 'application/pdf',
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'js': 'text/javascript', 'json': 'application/json'
        };
        safeMimeType = mimeTypes[extension] || 'text/plain';
        console.log(`aiFiverr Popup: Fixed MIME type for ${fileDetails.name}: ${fileDetails.mimeType} -> ${safeMimeType}`);
      }

      const file = new File([blob], fileDetails.name, { type: safeMimeType });

      // Re-upload to Gemini API
      const result = await this.uploadFileToGeminiAPI(file);

      this.showToast('File refreshed successfully! New Gemini link created.', 'success');
      await this.loadKnowledgeBaseFiles(); // Refresh the file list

    } catch (error) {
      console.error('Failed to refresh Gemini file:', error);
      this.showToast(`Failed to refresh file: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async downloadSelectedFile() {
    if (!this.selectedFileId) return;

    try {
      const fileDetails = await this.getFileDetails(this.selectedFileId);

      // Create download link
      const link = document.createElement('a');
      link.href = fileDetails.webViewLink;
      link.download = fileDetails.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Download started', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      this.showToast('Failed to download file', 'error');
    }
  }

  async copyFileLink() {
    if (!this.selectedFileId) return;

    try {
      const fileDetails = await this.getFileDetails(this.selectedFileId);
      await navigator.clipboard.writeText(fileDetails.webViewLink);
      this.showToast('Link copied to clipboard', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showToast('Failed to copy link', 'error');
    }
  }

  async saveFileMetadata() {
    if (!this.selectedFileId) return;

    const description = document.getElementById('fileDescriptionEdit').value;
    const tagsText = document.getElementById('fileTagsEdit').value;
    const tags = tagsText.split(',').map(tag => tag.trim()).filter(tag => tag);

    try {
      await this.updateFileMetadata(this.selectedFileId, { description, tags });
      this.showToast('Metadata saved successfully', 'success');
    } catch (error) {
      console.error('Save metadata failed:', error);
      this.showToast('Failed to save metadata', 'error');
    }
  }

  async updateFileMetadata(fileId, metadata) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'UPDATE_FILE_METADATA',
        fileId: fileId,
        metadata: metadata
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          // Check if refresh is required and trigger it
          if (response.refreshRequired) {
            console.log('aiFiverr Popup: Metadata update successful, triggering files refresh...');
            // Trigger refresh after a short delay
            setTimeout(() => {
              this.loadKnowledgeBaseFiles().catch(error => {
                console.warn('aiFiverr Popup: Auto-refresh after metadata update failed:', error);
              });
            }, 500);
          }
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Update failed'));
        }
      });
    });
  }

  async uploadFileToGemini() {
    if (!this.selectedFileId) return;

    try {
      const fileDetails = await this.getFileDetails(this.selectedFileId);

      // Download file content and upload to Gemini
      const response = await fetch(fileDetails.webViewLink);
      const blob = await response.blob();
      const file = new File([blob], fileDetails.name, { type: fileDetails.mimeType });

      await this.uploadFileToGeminiAPI(file);
      this.showToast('File uploaded to Gemini successfully', 'success');
      await this.loadKnowledgeBaseFiles();

    } catch (error) {
      console.error('Gemini upload failed:', error);
      this.showToast('Failed to upload to Gemini', 'error');
    }
  }

  // File selection modal methods
  selectedFiles = new Set();

  showFileSelectionModal() {
    this.selectedFiles.clear();
    this.loadFileSelectionList();
    document.getElementById('fileSelectionModalOverlay').style.display = 'flex';
  }

  hideFileSelectionModal() {
    document.getElementById('fileSelectionModalOverlay').style.display = 'none';
    this.selectedFiles.clear();
  }

  async loadFileSelectionList() {
    try {
      const files = await this.getGoogleDriveFiles();
      const container = document.getElementById('fileSelectionList');

      container.innerHTML = files.map(file => `
        <div class="file-selection-item" data-file-id="${file.id}">
          <input type="checkbox" class="file-selection-checkbox" value="${file.id}">
          <div class="file-selection-info">
            <div class="file-selection-name">${file.name}</div>
            <div class="file-selection-meta">${this.formatFileSize(file.size)} • ${file.mimeType}</div>
          </div>
        </div>
      `).join('');

      // Add event listeners for checkboxes
      container.querySelectorAll('.file-selection-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const fileId = e.target.value;
          const item = e.target.closest('.file-selection-item');

          if (e.target.checked) {
            this.selectedFiles.add(fileId);
            item.classList.add('selected');
          } else {
            this.selectedFiles.delete(fileId);
            item.classList.remove('selected');
          }

          this.updateSelectedFilesCount();
        });
      });

    } catch (error) {
      console.error('Failed to load file selection list:', error);
    }
  }

  updateSelectedFilesCount() {
    const count = this.selectedFiles.size;
    document.getElementById('selectedFilesCount').textContent = `${count} file${count !== 1 ? 's' : ''} selected`;
  }

  clearFileSelection() {
    this.selectedFiles.clear();
    document.querySelectorAll('.file-selection-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    document.querySelectorAll('.file-selection-item').forEach(item => {
      item.classList.remove('selected');
    });
    this.updateSelectedFilesCount();
  }

  confirmFileSelection() {
    if (this.selectedFiles.size === 0) {
      this.showToast('Please select at least one file', 'warning');
      return;
    }

    // Store selected files for use in prompts
    const selectedFileIds = Array.from(this.selectedFiles);
    this.storeSelectedFilesForPrompts(selectedFileIds);

    this.showToast(`${selectedFileIds.length} file(s) attached for prompts`, 'success');
    this.hideFileSelectionModal();
  }

  storeSelectedFilesForPrompts(fileIds) {
    // Store in chrome storage for use by content scripts
    chrome.storage.local.set({
      'selectedKnowledgeBaseFiles': fileIds,
      'selectedFilesTimestamp': Date.now()
    });
  }

  // Helper method to convert file to base64
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix (data:mime/type;base64,)
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async showKnowledgeBaseFileSelector() {
    try {
      console.log('aiFiverr: Opening knowledge base file selector...');

      // Get knowledge base files
      const files = await this.getKnowledgeBaseFiles();
      console.log('aiFiverr: Retrieved files:', files);

      // Always show the modal, even if no files
      this.displayKbFileSelector(files || []);

    } catch (error) {
      console.error('Failed to load knowledge base files:', error);
      this.showToast('Failed to load knowledge base files: ' + error.message, 'error');

      // Show modal with empty files list
      this.displayKbFileSelector([]);
    }
  }

  async getKnowledgeBaseFiles(retryCount = 0) {
    const maxRetries = 2;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_DRIVE_FILES'
      }, (response) => {
        if (chrome.runtime.lastError) {
          const error = new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`);
          if (retryCount < maxRetries) {
            console.warn(`Retrying getKnowledgeBaseFiles (${retryCount + 1}/${maxRetries}):`, error.message);
            setTimeout(() => {
              this.getKnowledgeBaseFiles(retryCount + 1).then(resolve).catch(reject);
            }, 1000 * (retryCount + 1));
          } else {
            reject(error);
          }
        } else if (response && response.success) {
          resolve(response.data || []);
        } else {
          const error = new Error(response?.error || 'Failed to get knowledge base files');
          if (retryCount < maxRetries && (!response || response.error?.includes('timeout') || response.error?.includes('network'))) {
            console.warn(`Retrying getKnowledgeBaseFiles (${retryCount + 1}/${maxRetries}):`, error.message);
            setTimeout(() => {
              this.getKnowledgeBaseFiles(retryCount + 1).then(resolve).catch(reject);
            }, 1000 * (retryCount + 1));
          } else {
            reject(error);
          }
        }
      });
    });
  }

  displayKbFileSelector(files) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'kb-file-selector-overlay';
    overlay.innerHTML = `
      <div class="kb-file-selector-modal">
        <div class="kb-file-selector-header">
          <h3>Select Knowledge Base Files</h3>
          <div class="kb-file-selector-header-actions">
            <button class="btn-secondary kb-refresh-btn" title="Refresh files">🔄</button>
            <button class="close-btn kb-close-btn">×</button>
          </div>
        </div>
        <div class="kb-file-selector-content">
          <div class="kb-file-selector-search">
            <input type="text" placeholder="Search files..." class="kb-file-search-input">
          </div>
          <div class="kb-file-selector-list">
            ${files.length > 0 ? files.map(file => `
              <div class="kb-file-selector-item" data-file-id="${file.id}">
                <label class="kb-file-checkbox-label">
                  <input type="checkbox" class="kb-file-checkbox" value="${file.id}">
                  <div class="kb-file-item-content">
                    <div class="kb-file-icon">${this.getFileIcon(file.mimeType)}</div>
                    <div class="kb-file-info">
                      <div class="kb-file-name">${file.name}</div>
                      <div class="kb-file-meta">${this.formatFileSize(file.size)} • ${file.mimeType}</div>
                      ${file.geminiUri ? `<div class="kb-file-gemini-uri" title="Gemini URI: ${file.geminiUri}">🔗 ${file.geminiUri.split('/').pop()}</div>` : '<div class="kb-file-no-uri">⚠️ No Gemini URI - click refresh to upload</div>'}
                    </div>
                    <div class="kb-file-status">
                      <span class="status-indicator ${this.getFileConnectionStatus(file)}" title="Gemini Status: ${this.getFileConnectionStatus(file)}"></span>
                    </div>
                  </div>
                </label>
              </div>
            `).join('') : `
              <div class="kb-files-empty">
                <div class="kb-files-empty-icon">📁</div>
                <h4>No files available</h4>
                <p>Upload files to your knowledge base first.<br>Go to Settings → Knowledge Base → Files tab to upload files.</p>
              </div>
            `}
          </div>
        </div>
        <div class="kb-file-selector-footer">
          <div class="selected-count">0 files selected</div>
          <div class="selector-actions">
            <button class="btn-secondary kb-cancel-btn">Cancel</button>
            <button class="btn-primary kb-attach-btn">Attach Selected</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    const checkboxes = overlay.querySelectorAll('.kb-file-checkbox');
    const selectedCount = overlay.querySelector('.selected-count');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const selected = overlay.querySelectorAll('.kb-file-checkbox:checked').length;
        selectedCount.textContent = `${selected} file${selected !== 1 ? 's' : ''} selected`;
      });
    });

    // Search functionality
    const searchInput = overlay.querySelector('.kb-file-search-input');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const items = overlay.querySelectorAll('.kb-file-selector-item');

      items.forEach(item => {
        const fileName = item.querySelector('.kb-file-name').textContent.toLowerCase();
        item.style.display = fileName.includes(query) ? 'block' : 'none';
      });
    });

    // Button event listeners
    const closeBtn = overlay.querySelector('.kb-close-btn');
    const cancelBtn = overlay.querySelector('.kb-cancel-btn');
    const attachBtn = overlay.querySelector('.kb-attach-btn');
    const refreshBtn = overlay.querySelector('.kb-refresh-btn');

    const closeModal = () => {
      overlay.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    attachBtn.addEventListener('click', () => {
      console.log('aiFiverr: Attach Selected button clicked');
      this.attachSelectedFiles();
    });

    // Refresh button functionality
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳';

        try {
          // First get current files
          const currentFiles = await this.getKnowledgeBaseFiles();

          // Check for files without Gemini URIs and re-upload them
          const filesToReupload = currentFiles.filter(file => !file.geminiUri);

          if (filesToReupload.length > 0) {
            // Reduce notification frequency - only show for significant re-uploads
            if (filesToReupload.length > 3) {
              this.showToast(`Re-uploading ${filesToReupload.length} files to Gemini...`, 'info');
            }

            for (const file of filesToReupload) {
              try {
                await this.refreshGeminiFile(file.id);
              } catch (error) {
                console.warn(`Failed to re-upload ${file.name}:`, error);
              }
            }
          }

          // Get refreshed files after re-upload
          const refreshedFiles = await this.getKnowledgeBaseFiles();
          // Update the file list in the modal
          const fileList = overlay.querySelector('.kb-file-selector-list');
          fileList.innerHTML = refreshedFiles.length > 0 ? refreshedFiles.map(file => `
            <div class="kb-file-selector-item" data-file-id="${file.id}">
              <label class="kb-file-checkbox-label">
                <input type="checkbox" class="kb-file-checkbox" value="${file.id}">
                <div class="kb-file-item-content">
                  <div class="kb-file-icon">${this.getFileIcon(file.mimeType)}</div>
                  <div class="kb-file-info">
                    <div class="kb-file-name">${file.name}</div>
                    <div class="kb-file-meta">${this.formatFileSize(file.size)} • ${file.mimeType}</div>
                    ${file.geminiUri ? `<div class="kb-file-gemini-uri" title="Gemini URI: ${file.geminiUri}">🔗 ${file.geminiUri.split('/').pop()}</div>` : '<div class="kb-file-no-uri">⚠️ No Gemini URI - click refresh to upload</div>'}
                  </div>
                  <div class="kb-file-status">
                    <span class="status-indicator ${this.getFileConnectionStatus(file)}" title="Gemini Status: ${this.getFileConnectionStatus(file)}"></span>
                  </div>
                </div>
              </label>
            </div>
          `).join('') : `
            <div class="kb-files-empty">
              <div class="kb-files-empty-icon">📁</div>
              <h4>No files available</h4>
              <p>Upload files to your knowledge base first.<br>Go to Settings → Knowledge Base → Files tab to upload files.</p>
            </div>
          `;

          // Re-attach event listeners for new checkboxes
          const selectedCount = overlay.querySelector('.selected-count');
          overlay.querySelectorAll('.kb-file-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
              const selected = overlay.querySelectorAll('.kb-file-checkbox:checked').length;
              selectedCount.textContent = `${selected} file${selected !== 1 ? 's' : ''} selected`;
            });
          });

          this.showToast('Files refreshed successfully', 'success');
        } catch (error) {
          console.error('Failed to refresh files:', error);
          this.showToast('Failed to refresh files', 'error');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '🔄';
        }
      });
    }

    // Close modal when clicking outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  attachSelectedFiles() {
    console.log('aiFiverr: attachSelectedFiles called');
    const overlay = document.querySelector('.kb-file-selector-overlay');
    if (!overlay) {
      console.error('aiFiverr: File selector overlay not found');
      return;
    }

    const selectedCheckboxes = overlay.querySelectorAll('.kb-file-checkbox:checked');
    console.log('aiFiverr: Selected checkboxes:', selectedCheckboxes.length);
    const selectedFiles = [];

    selectedCheckboxes.forEach(checkbox => {
      const fileItem = checkbox.closest('.kb-file-selector-item');
      const fileName = fileItem.querySelector('.kb-file-name').textContent;
      const fileMeta = fileItem.querySelector('.kb-file-meta').textContent;
      const fileIcon = fileItem.querySelector('.kb-file-icon').textContent;

      selectedFiles.push({
        id: checkbox.value,
        name: fileName,
        meta: fileMeta,
        icon: fileIcon
      });
    });

    console.log('aiFiverr: Selected files:', selectedFiles);
    this.displaySelectedFiles(selectedFiles);
    overlay.remove();
    console.log('aiFiverr: File selector modal closed');
  }

  displaySelectedFiles(files) {
    const container = document.getElementById('selectedKbFiles');

    if (files.length === 0) {
      container.style.display = 'none';
      container.classList.remove('has-files');
      return;
    }

    container.innerHTML = files.map(file => `
      <div class="selected-file-item" data-file-id="${file.id}">
        <div class="selected-file-info">
          <span class="selected-file-icon">${file.icon}</span>
          <span class="selected-file-name">${file.name}</span>
          <span class="selected-file-size">${file.meta}</span>
        </div>
        <button class="remove-selected-file" data-file-id="${file.id}">×</button>
      </div>
    `).join('');

    container.style.display = 'block';
    container.classList.add('has-files');

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-selected-file').forEach(button => {
      button.addEventListener('click', (e) => {
        const fileId = e.target.getAttribute('data-file-id');
        this.removeSelectedFile(fileId);
      });
    });
  }

  removeSelectedFile(fileId) {
    const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
    if (fileItem) {
      fileItem.remove();
    }

    // Check if any files remain
    const container = document.getElementById('selectedKbFiles');
    const remainingFiles = container.querySelectorAll('.selected-file-item');

    if (remainingFiles.length === 0) {
      container.style.display = 'none';
      container.classList.remove('has-files');
    }
  }

  clearSelectedKbFiles() {
    const container = document.getElementById('selectedKbFiles');
    if (container) {
      container.innerHTML = '';
      container.style.display = 'none';
      container.classList.remove('has-files');
    }
  }

  getSelectedKbFiles() {
    const container = document.getElementById('selectedKbFiles');
    if (!container) return [];

    const selectedItems = container.querySelectorAll('.selected-file-item');
    return Array.from(selectedItems).map(item => {
      // Get the file ID and try to find the full file data
      const fileId = item.dataset.fileId;
      const fileName = item.querySelector('.selected-file-name').textContent;
      const fileMeta = item.querySelector('.selected-file-size').textContent;
      const fileIcon = item.querySelector('.selected-file-icon').textContent;

      // Return basic file info - the actual file data with geminiUri will be resolved later
      return {
        id: fileId,
        name: fileName,
        meta: fileMeta,
        icon: fileIcon
      };
    });
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('text/')) return '📄';
    return '📁';
  }

  /**
   * Setup keyboard shortcut editor
   */
  setupShortcutEditor() {
    // Setup shortcut input fields
    const aiShortcutInput = document.getElementById('aiAssistantShortcut');
    const textShortcutInput = document.getElementById('textSelectionShortcut');

    if (aiShortcutInput) {
      this.setupShortcutInput(aiShortcutInput, 'aiAssistant');
    }

    if (textShortcutInput) {
      this.setupShortcutInput(textShortcutInput, 'textSelection');
    }

    // Setup reset buttons
    document.querySelectorAll('.shortcut-reset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shortcutType = e.target.getAttribute('data-shortcut');
        this.resetShortcut(shortcutType);
      });
    });

    // Load current shortcuts
    this.loadCurrentShortcuts();
  }

  /**
   * Setup individual shortcut input field
   */
  setupShortcutInput(input, shortcutType) {
    input.addEventListener('focus', () => {
      input.classList.add('recording');
      input.placeholder = 'Press key combination...';
    });

    input.addEventListener('blur', () => {
      input.classList.remove('recording');
      input.placeholder = 'Click and press keys...';
    });

    input.addEventListener('keydown', (e) => {
      e.preventDefault();

      // Build shortcut string
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? 'Cmd' : 'Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');

      // Add the key (ignore modifier keys themselves)
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        let key = e.key;
        if (key === ' ') key = 'Space';
        if (key.length === 1) key = key.toUpperCase();
        parts.push(key);
      }

      if (parts.length > 0) {
        const shortcutString = parts.join('+');
        input.value = shortcutString;

        // Save the shortcut
        this.saveShortcut(shortcutType, {
          ctrl: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
          key: e.key === ' ' ? 'Space' : e.key,
          display: shortcutString
        });

        input.blur();
      }
    });
  }

  /**
   * Save shortcut
   */
  async saveShortcut(shortcutType, shortcutData) {
    try {
      // Get current settings
      const result = await this.getStorageData(['settings']);
      const settings = result.settings || {};

      if (!settings.keyboardShortcuts) {
        settings.keyboardShortcuts = this.getDefaultShortcuts();
      }

      // Update shortcut
      settings.keyboardShortcuts[shortcutType] = {
        ...settings.keyboardShortcuts[shortcutType],
        ctrl: shortcutData.ctrl,
        shift: shortcutData.shift,
        alt: shortcutData.alt,
        key: shortcutData.key
      };

      // Save settings
      await this.setStorageData({ settings });

      this.showToast('Keyboard shortcut saved', 'success');

    } catch (error) {
      console.error('Failed to save shortcut:', error);
      this.showToast('Failed to save shortcut', 'error');
    }
  }

  /**
   * Reset shortcut to default
   */
  async resetShortcut(shortcutType) {
    try {
      const defaultShortcuts = this.getDefaultShortcuts();
      const defaultShortcut = defaultShortcuts[shortcutType];

      if (!defaultShortcut) {
        console.error('Unknown shortcut type:', shortcutType);
        return;
      }

      // Get current settings
      const result = await this.getStorageData(['settings']);
      const settings = result.settings || {};

      if (!settings.keyboardShortcuts) {
        settings.keyboardShortcuts = this.getDefaultShortcuts();
      }

      // Reset to default
      settings.keyboardShortcuts[shortcutType] = { ...defaultShortcut };

      // Save settings
      await this.setStorageData({ settings });

      // Update display
      this.loadCurrentShortcuts();

      this.showToast('Shortcut reset to default', 'success');

    } catch (error) {
      console.error('Failed to reset shortcut:', error);
      this.showToast('Failed to reset shortcut', 'error');
    }
  }

  /**
   * Load current shortcuts and update display
   */
  async loadCurrentShortcuts() {
    try {
      const result = await this.getStorageData(['settings']);
      const settings = result.settings || {};
      const shortcuts = settings.keyboardShortcuts || this.getDefaultShortcuts();

      // Update AI assistant shortcut display
      const aiShortcut = shortcuts.aiAssistant;
      if (aiShortcut) {
        const aiDisplay = this.formatShortcutDisplay(aiShortcut);
        const aiElement = document.getElementById('aiAssistantShortcut');
        if (aiElement) aiElement.value = aiDisplay;
      }

      // Update text selection shortcut display
      const textShortcut = shortcuts.textSelection;
      if (textShortcut) {
        const textDisplay = this.formatShortcutDisplay(textShortcut);
        const textElement = document.getElementById('textSelectionShortcut');
        if (textElement) textElement.value = textDisplay;
      }

    } catch (error) {
      console.error('Failed to load shortcuts:', error);
    }
  }

  /**
   * Format shortcut for display
   */
  formatShortcutDisplay(shortcut) {
    let parts = [];
    if (shortcut.ctrl) parts.push(navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.key) {
      let key = shortcut.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      parts.push(key);
    }
    return parts.join('+');
  }

  /**
   * Get default shortcuts
   */
  getDefaultShortcuts() {
    return {
      aiAssistant: {
        ctrl: true,
        shift: false,
        alt: true,
        key: 'A',
        description: 'Open AI assistance chat'
      },
      textSelection: {
        ctrl: true,
        shift: true,
        alt: false,
        key: 'F',
        description: 'Toggle floating text selection icon'
      }
    };
  }
}

// Listen for messages from content script (only if chrome.runtime is available)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (window.popupManager) {
      window.popupManager.handleRuntimeMessage(request, sender, sendResponse);
    }
  });
}

// Fallback tab switching for when PopupManager fails to initialize
function initializeFallbackTabSwitching() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;

      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      // Update tab panels
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      const targetPanel = document.getElementById(tabName);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're in a proper extension context
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      window.popupManager = new PopupManager();
      console.log('aiFiverr: PopupManager initialized successfully');
    } catch (error) {
      console.error('aiFiverr: PopupManager failed to initialize:', error);
      // Show error message to user
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 10px;';
      errorDiv.innerHTML = `
        <h4>Extension Error</h4>
        <p>Failed to initialize aiFiverr extension. Please try:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>Refreshing this popup</li>
          <li>Reloading the extension</li>
          <li>Restarting your browser</li>
        </ul>
        <p><small>Error: ${error.message}</small></p>
      `;
      document.body.insertBefore(errorDiv, document.body.firstChild);

      // Try fallback initialization
      initializeFallbackTabSwitching();
    }
  } else {
    console.warn('aiFiverr: Extension context not available, using fallback tab switching');
    initializeFallbackTabSwitching();
  }
});
