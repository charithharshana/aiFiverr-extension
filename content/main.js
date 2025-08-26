/**
 * aiFiverr Main Content Script
 * Initializes and coordinates all extension functionality
 */

class AiFiverrMain {
  constructor() {
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize());
      } else {
        await this.initialize();
      }
    } catch (error) {
      console.error('aiFiverr initialization failed:', error);
      this.handleInitializationError(error);
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('aiFiverr: Initializing extension...');

      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.warn('aiFiverr: Extension context invalidated, cannot initialize');
        return;
      }

      // Check site restriction settings
      const shouldInitialize = await this.shouldInitializeOnCurrentSite();
      if (!shouldInitialize) {
        console.log('aiFiverr: Site restriction prevents initialization on this domain');
        return;
      }

      // Wait for required dependencies
      await this.waitForDependencies();

      // Initialize managers in order
      await this.initializeManagers();

      // Set up event listeners
      this.setupEventListeners();

      // Start monitoring
      this.startMonitoring();

      this.isInitialized = true;
      console.log('aiFiverr: Extension initialized successfully');

      // Add debugging info
      console.log('aiFiverr: Available global objects:', {
        promptSelector: !!window.promptSelector,
        fiverrDetector: !!window.fiverrDetector,
        fiverrInjector: !!window.fiverrInjector,
        storageManager: !!window.storageManager,
        textSelector: !!window.textSelector,
        chatAssistantManager: !!window.chatAssistantManager
      });

      // Initialize chat assistant manager if needed
      await this.initializeChatAssistantManager();

      // Initialize AI chat if available and needed
      await this.initializeAIChat();

      // Let normal detection work - don't force it automatically
      console.log('aiFiverr: Extension ready. Use Ctrl+Shift+D to manually trigger detection if needed.');

      // Extension initialized - no background communication needed
      console.log('aiFiverr: Extension initialized for:', {
        url: window.location.href,
        pageType: window.fiverrDetector?.pageType
      });

    } catch (error) {
      console.error('aiFiverr: Initialization error:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Check if current page is a Fiverr page
   */
  isFiverrPage() {
    return window.location.hostname.includes('fiverr.com');
  }

  /**
   * Check if extension should initialize on current site based on settings
   */
  async shouldInitializeOnCurrentSite() {
    try {
      // Check if extension context is valid first
      if (!chrome.runtime?.id) {
        console.warn('aiFiverr: Extension context invalidated, cannot check site restrictions');
        return false;
      }

      // Get settings from storage using the same method as popup
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};

      // Default to restricting to Fiverr only (restrictToFiverr: true)
      const restrictToFiverr = settings.restrictToFiverr !== false;

      console.log('aiFiverr: Site restriction check:', {
        restrictToFiverr,
        currentHostname: window.location.hostname,
        isFiverrPage: this.isFiverrPage(),
        settingsRaw: settings
      });

      if (restrictToFiverr) {
        // Only initialize on Fiverr pages
        return this.isFiverrPage();
      } else {
        // Initialize on all sites
        return true;
      }
    } catch (error) {
      console.error('aiFiverr: Error checking site restriction settings:', error);
      // Default to Fiverr only if there's an error
      return this.isFiverrPage();
    }
  }

  /**
   * Wait for required dependencies to be available
   * Note: Dependencies are now initialized by the main extension, so this is mainly for verification
   */
  async waitForDependencies() {
    console.log('aiFiverr: Dependencies will be initialized by the main extension');
    // No need to wait since we control the initialization order
    return;
  }

  /**
   * Initialize all managers in the correct order
   */
  async initializeManagers() {
    try {
      console.log('aiFiverr: Initializing managers...');

      // Check if we should initialize based on site restrictions
      const shouldInitialize = await this.shouldInitializeOnCurrentSite();
      if (!shouldInitialize) {
        console.log('aiFiverr: All managers disabled due to site restrictions');
        return;
      }

      // Initialize core managers first (these are needed for basic functionality)
      console.log('aiFiverr: Initializing core managers...');
      await this.initializeStorageManager();

      // Initialize other core managers in parallel for better performance
      await Promise.all([
        this.initializeSessionManager(),
        this.initializeAPIKeyManager(),
        this.initializeGeminiClient(),
        this.initializePromptManager(),
        this.initializeKnowledgeBaseManager()
      ]);

      // Initialize Fiverr-specific managers in parallel
      console.log('aiFiverr: Initializing Fiverr managers...');
      await Promise.all([
        this.initializeFiverrDetector(),
        this.initializeFiverrExtractor(),
        this.initializeFiverrInjector(),
        this.initializeTextSelector()
      ]);

      // Initialize utility managers in parallel
      console.log('aiFiverr: Initializing utility managers...');
      await Promise.all([
        this.initializeExportImportManager(),
        this.initializePromptSelector()
      ]);

      // Initialize chat managers last (these depend on other managers)
      console.log('aiFiverr: Initializing chat managers...');
      await this.initializeChatAssistantManager();
      await this.initializeAIChat();

      console.log('aiFiverr: All managers initialized');
    } catch (error) {
      console.error('aiFiverr: Failed to initialize managers:', error);
    }
  }

  /**
   * Initialize Storage Manager
   */
  async initializeStorageManager() {
    try {
      if (typeof window.initializeStorageManager === 'function') {
        console.log('aiFiverr: Initializing Storage Manager...');
        await window.initializeStorageManager();
      } else {
        console.log('aiFiverr: Storage Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Storage Manager:', error);
    }
  }

  /**
   * Initialize Session Manager
   */
  async initializeSessionManager() {
    try {
      if (typeof window.initializeSessionManager === 'function') {
        console.log('aiFiverr: Initializing Session Manager...');
        await window.initializeSessionManager();
      } else {
        console.log('aiFiverr: Session Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Session Manager:', error);
    }
  }

  /**
   * Initialize API Key Manager
   */
  async initializeAPIKeyManager() {
    try {
      if (typeof window.initializeAPIKeyManager === 'function') {
        console.log('aiFiverr: Initializing API Key Manager...');
        await window.initializeAPIKeyManager();
      } else {
        console.log('aiFiverr: API Key Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize API Key Manager:', error);
    }
  }

  /**
   * Initialize Gemini Client
   */
  async initializeGeminiClient() {
    try {
      if (typeof window.initializeGeminiClient === 'function') {
        console.log('aiFiverr: Initializing Gemini Client...');
        await window.initializeGeminiClient();
      } else {
        console.log('aiFiverr: Gemini Client initialization function not available');
      }

      // Also initialize Enhanced Gemini Client
      if (typeof window.initializeEnhancedGeminiClient === 'function') {
        console.log('aiFiverr: Initializing Enhanced Gemini Client...');
        await window.initializeEnhancedGeminiClient();
      } else {
        console.log('aiFiverr: Enhanced Gemini Client initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Gemini Client:', error);
    }
  }

  /**
   * Initialize Prompt Manager
   */
  async initializePromptManager() {
    try {
      if (window.promptManager) {
        console.log('aiFiverr: Initializing Prompt Manager...');
        await window.promptManager.init();
      } else {
        console.log('aiFiverr: Prompt Manager not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Prompt Manager:', error);
    }
  }

  /**
   * Initialize Knowledge Base Manager
   */
  async initializeKnowledgeBaseManager() {
    try {
      if (typeof window.initializeKnowledgeBaseManager === 'function') {
        console.log('aiFiverr: Initializing Knowledge Base Manager...');
        await window.initializeKnowledgeBaseManager();
      } else {
        console.log('aiFiverr: Knowledge Base Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Knowledge Base Manager:', error);
    }
  }

  /**
   * Initialize Fiverr Detector
   */
  async initializeFiverrDetector() {
    try {
      if (typeof window.initializeFiverrDetector === 'function') {
        console.log('aiFiverr: Initializing Fiverr Detector...');
        await window.initializeFiverrDetector();
      } else {
        console.log('aiFiverr: Fiverr Detector initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Fiverr Detector:', error);
    }
  }

  /**
   * Initialize Fiverr Extractor
   */
  async initializeFiverrExtractor() {
    try {
      if (typeof window.initializeFiverrExtractor === 'function') {
        console.log('aiFiverr: Initializing Fiverr Extractor...');
        await window.initializeFiverrExtractor();
      } else {
        console.log('aiFiverr: Fiverr Extractor initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Fiverr Extractor:', error);
    }
  }

  /**
   * Initialize Fiverr Injector
   */
  async initializeFiverrInjector() {
    try {
      if (typeof window.initializeFiverrInjector === 'function') {
        console.log('aiFiverr: Initializing Fiverr Injector...');
        await window.initializeFiverrInjector();
      } else {
        console.log('aiFiverr: Fiverr Injector initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Fiverr Injector:', error);
    }
  }

  /**
   * Initialize Text Selector
   */
  async initializeTextSelector() {
    try {
      if (typeof window.initializeTextSelector === 'function') {
        console.log('aiFiverr: Initializing Text Selector...');
        await window.initializeTextSelector();
      } else {
        console.log('aiFiverr: Text Selector initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Text Selector:', error);
    }
  }

  /**
   * Initialize Export Import Manager
   */
  async initializeExportImportManager() {
    try {
      if (typeof window.initializeExportImportManager === 'function') {
        console.log('aiFiverr: Initializing Export Import Manager...');
        await window.initializeExportImportManager();
      } else {
        console.log('aiFiverr: Export Import Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Export Import Manager:', error);
    }
  }

  /**
   * Initialize Prompt Selector
   */
  async initializePromptSelector() {
    try {
      if (typeof window.initializePromptSelector === 'function') {
        console.log('aiFiverr: Initializing Prompt Selector...');
        await window.initializePromptSelector();
      } else {
        console.log('aiFiverr: Prompt Selector initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Prompt Selector:', error);
    }
  }

  /**
   * Initialize Chat Assistant Manager if site restrictions allow
   */
  async initializeChatAssistantManager() {
    try {
      // Initialize chat assistant manager if the function is available
      if (typeof window.initializeChatAssistantManager === 'function') {
        console.log('aiFiverr: Initializing Chat Assistant Manager...');
        await window.initializeChatAssistantManager();
      } else {
        console.log('aiFiverr: Chat Assistant Manager initialization function not available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize Chat Assistant Manager:', error);
    }
  }

  /**
   * Initialize AI Chat if available and site restrictions allow
   */
  async initializeAIChat() {
    try {
      // Check if we should initialize AI chat based on site restrictions
      const shouldInitialize = await this.shouldInitializeOnCurrentSite();
      if (!shouldInitialize) {
        console.log('aiFiverr: AI Chat disabled due to site restrictions');
        return;
      }

      // Initialize AI chat if the function is available
      if (typeof window.initializeAIAssistanceChat === 'function') {
        console.log('aiFiverr: Initializing AI Assistance Chat...');
        await window.initializeAIAssistanceChat();
      } else if (typeof window.initializeUniversalChat === 'function') {
        console.log('aiFiverr: Initializing Universal Chat...');
        await window.initializeUniversalChat();
      } else {
        console.log('aiFiverr: No AI chat system available');
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize AI chat:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for page navigation
    window.addEventListener('popstate', () => {
      this.handleNavigation();
    });

    // Listen for URL changes (for SPA navigation)
    let currentUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigation();
      }
    }, 1000);

    // Listen for extension messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcut(e);
    });



    // Listen for custom events
    window.addEventListener('aifiverr:sessionCreated', (e) => {
      this.handleSessionCreated(e.detail);
    });

    window.addEventListener('aifiverr:elementsDetected', (e) => {
      this.handleElementsDetected(e.detail);
    });

    console.log('aiFiverr: Event listeners set up');
  }

  /**
   * Start monitoring for changes
   */
  startMonitoring() {
    // Monitor for new elements every 5 seconds
    setInterval(() => {
      if (window.fiverrDetector) {
        window.fiverrDetector.detectAllElements();
      }
    }, 5000);

    // Clean up old sessions every 10 minutes
    setInterval(() => {
      if (window.sessionManager) {
        window.sessionManager.cleanupOldSessions();
      }
    }, 10 * 60 * 1000);

    console.log('aiFiverr: Monitoring started');
  }

  /**
   * Handle page navigation
   */
  handleNavigation() {
    console.log('aiFiverr: Page navigation detected');
    
    // Update page type
    if (window.fiverrDetector) {
      window.fiverrDetector.pageType = window.fiverrDetector.detectPageType();
    }

    // Re-detect elements after navigation
    setTimeout(() => {
      if (window.fiverrDetector) {
        window.fiverrDetector.detectAllElements();
      }
    }, 1000);
  }

  /**
   * Safe message sending to background script with context validation
   */
  safeMessageToBackground(message, callback = null) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('aiFiverr: Extension context invalidated, cannot send message');
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('aiFiverr: Background message error:', chrome.runtime.lastError.message);
          if (callback) callback(null, chrome.runtime.lastError);
        } else {
          if (callback) callback(response, null);
        }
      });
    } catch (error) {
      console.warn('aiFiverr: Failed to send message to background:', error.message);
      if (callback) callback(null, error);
    }
  }

  /**
   * Handle extension messages
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case 'GET_PAGE_INFO':
          sendResponse({
            success: true,
            data: {
              url: window.location.href,
              pageType: window.fiverrDetector?.pageType,
              isInitialized: this.isInitialized
            }
          });
          break;

        case 'EXTRACT_CONVERSATION':
          const conversation = await window.fiverrExtractor?.extractConversation();
          sendResponse({ success: true, data: conversation });
          break;

        case 'EXTRACT_BRIEF':
          const brief = window.fiverrExtractor?.extractBriefDetails();
          sendResponse({ success: true, data: brief });
          break;

        case 'FETCH_ALL_CONTACTS':
          try {
            const contacts = await window.fiverrExtractor?.fetchAllContacts();
            sendResponse({ success: true, data: contacts });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_STORED_CONTACTS':
          try {
            const storedContacts = await window.fiverrExtractor?.getStoredContacts();
            sendResponse({ success: true, data: storedContacts });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;





        case 'PROCESS_PROMPT':
          const processedPrompt = await this.handleProcessPrompt(request.data);
          sendResponse({ success: true, data: processedPrompt });
          break;



        case 'FETCH_FIVERR_CONTACTS':
          const contactsResult = await this.handleFetchFiverrContacts();
          sendResponse({ success: true, data: contactsResult });
          break;

        case 'EXTRACT_CURRENT_CONVERSATION':
          const currentConversation = await this.handleExtractCurrentConversation();
          sendResponse({ success: true, data: currentConversation });
          break;

        case 'EXTRACT_CONVERSATION_BY_USERNAME':
          const conversationByUsername = await this.handleExtractConversationByUsername(request.username);
          sendResponse({ success: true, data: conversationByUsername });
          break;

        case 'UPDATE_CONVERSATION':
          const updatedConversation = await this.handleUpdateConversation(request.username);
          sendResponse({ success: true, data: updatedConversation });
          break;

        case 'DELETE_CONVERSATION':
          const deleteResult = await this.handleDeleteConversation(request.username);
          sendResponse({ success: true, data: deleteResult });
          break;

        case 'GET_STORED_CONVERSATIONS':
          const storedConversations = await this.handleGetStoredConversations();
          sendResponse({ success: true, data: storedConversations });
          break;

        case 'GET_STORED_CONTACTS':
          const storedContacts = await this.handleGetStoredContacts();
          sendResponse({ success: true, data: storedContacts });
          break;

        case 'CLEAR_STORAGE_CACHE':
          // Clear storage manager cache to prevent conflicts
          if (window.storageManager && window.storageManager.cache) {
            window.storageManager.cache.clear();
            console.log('Storage cache cleared');
          }
          sendResponse({ success: true });
          break;

        // Authentication handlers
        case 'CHECK_AUTH_STATUS':
          const authStatus = await this.handleCheckAuthStatus();
          sendResponse({ success: true, authStatus });
          break;

        case 'GOOGLE_SIGN_IN':
          const signInResult = await this.handleGoogleSignIn();
          sendResponse(signInResult);
          break;

        case 'GOOGLE_SIGN_OUT':
          const signOutResult = await this.handleGoogleSignOut();
          sendResponse(signOutResult);
          break;

        case 'TEST_GOOGLE_CONNECTION':
          const connectionResult = await this.handleTestGoogleConnection();
          sendResponse(connectionResult);
          break;

        case 'GET_AUTH_STATS':
          const authStats = await this.handleGetAuthStats();
          sendResponse({ success: true, stats: authStats });
          break;

        // Knowledge Base Files handlers
        // File operations are handled by background script
        case 'GET_DRIVE_FILES':
        case 'GET_GEMINI_FILES':
        case 'UPLOAD_FILE_TO_DRIVE':
        case 'UPLOAD_FILE_TO_GEMINI':
        case 'GET_FILE_DETAILS':
        case 'DELETE_DRIVE_FILE':
        case 'SEARCH_DRIVE_FILES':
        case 'UPDATE_FILE_METADATA':
          // These are handled by the background script, not content script
          sendResponse({ success: false, error: 'This message should be sent to background script' });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcut(e) {
    // Ctrl/Cmd + Shift + A: Open AI assistant
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      this.toggleFloatingWidget();
    }

    // Ctrl+Shift+G shortcut removed - use message icon instead
  }




  /**
   * Toggle floating widget
   */
  toggleFloatingWidget() {
    try {
      if (window.fiverrInjector?.floatingWidget) {
        const panel = window.fiverrInjector.floatingWidget.querySelector('.widget-panel');
        if (panel) {
          const isVisible = panel.style.display !== 'none';
          panel.style.display = isVisible ? 'none' : 'block';
        }
      }
    } catch (error) {
      console.error('aiFiverr: Error toggling floating widget:', error);
    }
  }

  // showPromptSelectorForInput removed - use message icon instead

  // generateReplyForInput removed - use message icon instead

  /**
   * Handle session creation
   */
  handleSessionCreated(sessionData) {
    console.log('aiFiverr: New session created:', sessionData.sessionId);
  }

  /**
   * Handle elements detection
   */
  handleElementsDetected(detail) {
    console.log('aiFiverr: Elements detected:', detail);
  }



  /**
   * Handle process prompt request
   */
  async handleProcessPrompt(data) {
    const { promptKey, additionalContext = {}, language } = data;

    try {
      // Add language to additional context if provided
      if (language) {
        additionalContext.language = language;
      }

      // Process prompt with Fiverr context
      const result = await window.knowledgeBaseManager?.processPromptWithFiverrContext(promptKey, additionalContext);

      // Handle both old and new format
      if (typeof result === 'object' && result.prompt) {
        return {
          processedPrompt: result.prompt,
          knowledgeBaseFiles: result.knowledgeBaseFiles || []
        };
      } else {
        // Backward compatibility
        return { processedPrompt: result };
      }
    } catch (error) {
      console.error('Failed to process prompt:', error);
      throw error;
    }
  }

  /**
   * Handle initialization errors
   */
  handleInitializationError(error) {
    this.retryCount++;
    
    if (this.retryCount < this.maxRetries) {
      console.log(`aiFiverr: Retrying initialization (${this.retryCount}/${this.maxRetries})...`);
      setTimeout(() => this.initialize(), 2000 * this.retryCount);
    } else {
      console.error('aiFiverr: Failed to initialize after maximum retries');
      
      // Show error notification to user
      this.showErrorNotification('aiFiverr extension failed to initialize. Please refresh the page.');
    }
  }

  /**
   * Show error notification
   */
  showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'aifiverr-error-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  // Fiverr-specific handlers


  async handleFetchFiverrContacts() {
    try {
      if (!window.fiverrExtractor) {
        throw new Error('Fiverr extractor not available');
      }

      return await window.fiverrExtractor.fetchAllContacts();
    } catch (error) {
      console.error('Failed to fetch Fiverr contacts:', error);
      throw error;
    }
  }

  async handleExtractCurrentConversation() {
    try {
      if (!window.fiverrExtractor) {
        throw new Error('Fiverr extractor not available');
      }

      return await window.fiverrExtractor.extractConversation(true); // Force refresh
    } catch (error) {
      console.error('Failed to extract current conversation:', error);
      throw error;
    }
  }

  async handleExtractConversationByUsername(username) {
    try {
      if (!window.fiverrExtractor) {
        throw new Error('Fiverr extractor not available');
      }

      return await window.fiverrExtractor.extractConversationByUsername(username, true);
    } catch (error) {
      console.error('Failed to extract conversation by username:', error);
      throw error;
    }
  }

  async handleUpdateConversation(username) {
    try {
      if (!window.fiverrExtractor) {
        throw new Error('Fiverr extractor not available');
      }

      return await window.fiverrExtractor.updateConversation(username);
    } catch (error) {
      console.error('Failed to update conversation:', error);
      throw error;
    }
  }

  async handleDeleteConversation(username) {
    try {
      if (!window.fiverrExtractor) {
        throw new Error('Fiverr extractor not available');
      }

      return await window.fiverrExtractor.deleteStoredConversation(username);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }



  async handleGetStoredConversations() {
    try {
      if (!window.fiverrExtractor) {
        return [];
      }

      return window.fiverrExtractor.getAllStoredConversations();
    } catch (error) {
      console.error('Failed to get stored conversations:', error);
      return [];
    }
  }

  async handleGetStoredContacts() {
    try {
      if (!window.fiverrExtractor) {
        return { contacts: [], totalCount: 0, lastFetched: 0 };
      }

      return await window.fiverrExtractor.getStoredContacts();
    } catch (error) {
      console.error('Failed to get stored contacts:', error);
      return { contacts: [], totalCount: 0, lastFetched: 0 };
    }
  }

  // Authentication Handler Methods
  async handleCheckAuthStatus() {
    try {
      if (!window.googleAuthService) {
        return { isAuthenticated: false };
      }

      const isAuthenticated = window.googleAuthService.isUserAuthenticated();
      const user = window.googleAuthService.getCurrentUser();

      return {
        isAuthenticated,
        user: isAuthenticated ? user : null
      };

    } catch (error) {
      console.error('aiFiverr: Failed to check auth status:', error);
      return { isAuthenticated: false };
    }
  }

  async handleGoogleSignIn() {
    try {
      if (!window.googleAuthService) {
        throw new Error('Google Auth Service not available');
      }

      const result = await window.googleAuthService.authenticate();
      return result;

    } catch (error) {
      console.error('aiFiverr: Google sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGoogleSignOut() {
    try {
      if (!window.googleAuthService) {
        throw new Error('Google Auth Service not available');
      }

      const result = await window.googleAuthService.signOut();
      return result;

    } catch (error) {
      console.error('aiFiverr: Google sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleTestGoogleConnection() {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        throw new Error('Not authenticated');
      }

      // Test Google Sheets connection
      let sheetsConnected = false;
      try {
        if (window.googleClient) {
          const sheetsTest = await window.googleClient.testConnection();
          sheetsConnected = sheetsTest.success;
        }
      } catch (error) {
        console.warn('Sheets connection test failed:', error);
      }

      // Test Google Drive connection
      let driveConnected = false;
      try {
        if (window.googleDriveClient) {
          const driveTest = await window.googleDriveClient.testConnection();
          driveConnected = driveTest.success;
        }
      } catch (error) {
        console.warn('Drive connection test failed:', error);
      }

      return {
        success: true,
        sheetsConnected,
        driveConnected
      };

    } catch (error) {
      console.error('aiFiverr: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGetAuthStats() {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        return {
          sheetsConnected: false,
          driveConnected: false,
          knowledgeBaseFiles: 0,
          lastSync: null
        };
      }

      // Get Google Sheets stats
      let sheetsConnected = false;
      try {
        if (window.googleClient) {
          const sheetsStats = await window.googleClient.getStats();
          sheetsConnected = !sheetsStats.error;
        }
      } catch (error) {
        console.warn('Failed to get sheets stats:', error);
      }

      // Get Google Drive stats
      let driveConnected = false;
      let knowledgeBaseFiles = 0;
      try {
        if (window.googleDriveClient) {
          const driveTest = await window.googleDriveClient.testConnection();
          driveConnected = driveTest.success;

          if (driveConnected) {
            const files = await window.googleDriveClient.listKnowledgeBaseFiles();
            knowledgeBaseFiles = files.length;
          }
        }
      } catch (error) {
        console.warn('Failed to get drive stats:', error);
      }

      return {
        sheetsConnected,
        driveConnected,
        knowledgeBaseFiles,
        lastSync: new Date().toISOString()
      };

    } catch (error) {
      console.error('aiFiverr: Failed to get auth stats:', error);
      return {
        sheetsConnected: false,
        driveConnected: false,
        knowledgeBaseFiles: 0,
        lastSync: null,
        error: error.message
      };
    }
  }

  /**
   * Cleanup on page unload
   */
  cleanup() {
    if (window.fiverrDetector) {
      window.fiverrDetector.cleanup();
    }

    if (window.fiverrInjector) {
      window.fiverrInjector.cleanup();
    }
  }

  // Knowledge Base Files Handler Methods
  // File operations are now handled by background script only
}

// Initialize extension when script loads
const aiFiverrMain = new AiFiverrMain();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  aiFiverrMain.cleanup();
});
