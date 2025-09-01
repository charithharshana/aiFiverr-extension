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

      // Wait for required dependencies
      await this.waitForDependencies();

      // Initialize managers in order (they will handle their own site restrictions)
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
   * This is kept for backward compatibility but is now mainly used for Fiverr-specific components
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
   * Check if Fiverr-specific components should initialize
   * These components are only useful on Fiverr.com regardless of settings
   */
  async shouldInitializeFiverrComponents() {
    try {
      // Check if extension context is valid first
      if (!chrome.runtime?.id) {
        console.warn('aiFiverr: Extension context invalidated, cannot check site restrictions');
        return false;
      }

      // Get settings from storage
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};

      // Default to restricting to Fiverr only (restrictToFiverr: true)
      const restrictToFiverr = settings.restrictToFiverr !== false;

      console.log('aiFiverr: Fiverr components restriction check:', {
        restrictToFiverr,
        currentHostname: window.location.hostname,
        isFiverrPage: this.isFiverrPage(),
        settingsRaw: settings
      });

      if (restrictToFiverr) {
        // Only initialize on Fiverr pages
        return this.isFiverrPage();
      } else {
        // When unrestricted, still only initialize Fiverr components on Fiverr
        // (they're not useful on other sites)
        return this.isFiverrPage();
      }
    } catch (error) {
      console.error('aiFiverr: Error checking Fiverr component restrictions:', error);
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

      // Initialize universal components (text selector handles its own site restrictions)
      console.log('aiFiverr: Initializing universal components...');
      await this.initializeTextSelector();

      // Initialize Fiverr-specific managers only if on Fiverr or unrestricted
      const shouldInitializeFiverrComponents = await this.shouldInitializeFiverrComponents();
      if (shouldInitializeFiverrComponents) {
        console.log('aiFiverr: Initializing Fiverr-specific managers...');
        await Promise.all([
          this.initializeFiverrDetector(),
          this.initializeFiverrExtractor(),
          this.initializeFiverrInjector()
        ]);
      } else {
        console.log('aiFiverr: Fiverr-specific managers disabled due to site restrictions');
      }

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
   * Initialize AI Chat if available (AI chat handles its own site restrictions)
   */
  async initializeAIChat() {
    try {
      // Initialize AI chat if the function is available
      if (typeof window.initializeAIAssistanceChat === 'function') {
        console.log('aiFiverr: Initializing AI Assistance Chat...');
        await window.initializeAIAssistanceChat();
      } else if (typeof window.initializeUniversalChat === 'function') {
        console.log('aiFiverr: Initializing Universal Chat...');
        await window.initializeUniversalChat();
      } else {
        console.log('aiFiverr: Creating AI assistance chat functions...');
        // Create the missing functions
        this.createAIAssistanceChatFunctions();

        // Now initialize
        if (typeof window.initializeAIAssistanceChat === 'function') {
          await window.initializeAIAssistanceChat();
        }
      }
    } catch (error) {
      console.error('aiFiverr: Failed to initialize AI chat:', error);
    }
  }

  /**
   * Create missing AI assistance chat functions
   */
  createAIAssistanceChatFunctions() {
    // Create initializeAIAssistanceChat function
    window.initializeAIAssistanceChat = async () => {
      try {
        console.log('aiFiverr: AI Assistance Chat initialization started');

        // Note: We no longer check site restrictions at initialization time
        // Site restrictions are now checked at runtime when the user tries to open the chat
        // This allows the setting to be changed dynamically without requiring reinitialization

        console.log('aiFiverr: AI Assistance Chat functions ready (chat will be created on demand)');
      } catch (error) {
        console.error('aiFiverr: Failed to initialize AI Assistance Chat:', error);
      }
    };

    // Create initializeUniversalChat function as an alias
    window.initializeUniversalChat = window.initializeAIAssistanceChat;

    console.log('aiFiverr: AI assistance chat functions created');
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
    document.addEventListener('keydown', async (e) => {
      await this.handleKeyboardShortcut(e);
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
        console.debug('aiFiverr: Extension context invalidated, cannot send message');
        if (callback) callback(null, new Error('Extension context invalidated'));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Only log connection errors at debug level to reduce console noise
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Receiving end does not exist') || errorMsg.includes('Extension context invalidated')) {
            console.debug('aiFiverr: Background message error:', errorMsg);
          } else {
            console.warn('aiFiverr: Background message error:', errorMsg);
          }
          if (callback) callback(null, chrome.runtime.lastError);
        } else {
          if (callback) callback(response, null);
        }
      });
    } catch (error) {
      console.debug('aiFiverr: Failed to send message to background:', error.message);
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
  async handleKeyboardShortcut(e) {
    // Get custom shortcuts from settings
    const settings = await this.getSettings();
    const shortcuts = settings.keyboardShortcuts || this.getDefaultShortcuts();

    // Check for AI assistant shortcut
    if (this.matchesShortcut(e, shortcuts.aiAssistant)) {
      e.preventDefault();
      await this.openAIAssistant();
    }

    // Check for floating text selection icon shortcut
    if (this.matchesShortcut(e, shortcuts.textSelection)) {
      e.preventDefault();
      this.toggleFloatingTextSelectionIcon();
    }

    // Legacy hardcoded shortcuts as fallback
    // Ctrl/Cmd + Shift + A: Open AI assistant (fallback)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      await this.openAIAssistant();
    }

    // Ctrl/Cmd + Shift + F: Toggle floating text selection icon (fallback)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      this.toggleFloatingTextSelectionIcon();
    }
  }




  /**
   * Get default keyboard shortcuts
   */
  getDefaultShortcuts() {
    return {
      aiAssistant: {
        ctrl: true,
        shift: true,
        alt: false,
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

  /**
   * Check if keyboard event matches a shortcut configuration
   */
  matchesShortcut(event, shortcut) {
    if (!shortcut) return false;

    return (
      (event.ctrlKey || event.metaKey) === shortcut.ctrl &&
      event.shiftKey === shortcut.shift &&
      event.altKey === shortcut.alt &&
      event.key.toLowerCase() === shortcut.key.toLowerCase()
    );
  }

  /**
   * Check site restrictions for AI assistance chat (same logic as ChatAssistantManager)
   */
  async shouldAllowAIAssistanceChat() {
    try {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.warn('aiFiverr: Extension context invalidated, cannot check site restrictions');
        return false;
      }

      // Get settings from storage
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};

      // Default to restricting to Fiverr only (restrictToFiverr: true)
      const restrictToFiverr = settings.restrictToFiverr !== false;

      console.log('aiFiverr: AI assistance chat site restriction check:', {
        restrictToFiverr,
        currentHostname: window.location.hostname,
        isFiverrPage: window.location.hostname.includes('fiverr.com'),
        settingsRaw: settings
      });

      if (restrictToFiverr) {
        // Only allow on Fiverr pages
        return window.location.hostname.includes('fiverr.com');
      } else {
        // Allow on all sites
        return true;
      }
    } catch (error) {
      console.error('aiFiverr: Error checking AI assistance chat site restrictions:', error);
      // Default to Fiverr only if there's an error
      return window.location.hostname.includes('fiverr.com');
    }
  }

  /**
   * Open AI assistance chat
   */
  async openAIAssistant() {
    try {
      // Check site restrictions first using the same logic as ChatAssistantManager
      const shouldAllow = await this.shouldAllowAIAssistanceChat();
      if (!shouldAllow) {
        console.log('aiFiverr: AI assistant disabled due to site restrictions');
        this.showNotification('AI assistant is restricted to Fiverr.com only', 'warning');
        return;
      }

      // Try multiple AI assistance methods in order of preference

      // 1. Try the new AI assistance chat (StreamingChatbox) - create if needed
      if (typeof StreamingChatbox !== 'undefined') {
        if (!window.aiAssistanceChat) {
          // Create the AI assistance chat instance on demand
          window.aiAssistanceChat = new StreamingChatbox({
            maxWidth: '700px',
            maxHeight: '600px',
            theme: 'light',
            showActions: true,
            enableDragging: true,
            enableResizing: true
          });
          console.log('aiFiverr: AI Assistance Chat (StreamingChatbox) created on demand');
        }

        // Toggle visibility
        if (window.aiAssistanceChat.isVisible) {
          window.aiAssistanceChat.hide();
        } else {
          window.aiAssistanceChat.show('Hello! How can I help you today?');
        }
        console.log('aiFiverr: AI assistance chat toggled via keyboard shortcut');
        return;
      }

      // 2. Try the ChatAssistantManager (popup window)
      if (window.chatAssistantManager && window.chatAssistantManager.initialized) {
        await window.chatAssistantManager.openChatAssistant({
          source: 'keyboard_shortcut',
          timestamp: Date.now()
        });
        console.log('aiFiverr: Chat assistant opened via keyboard shortcut');
        return;
      }

      // 3. Try the floating widget as fallback (only on Fiverr sites)
      if (window.fiverrInjector?.floatingChatbox && window.location.hostname.includes('fiverr.com')) {
        window.fiverrInjector.toggleFloatingChatbox();
        console.log('aiFiverr: Floating chatbox toggled via keyboard shortcut');
        return;
      }

      // No AI assistance available
      console.warn('aiFiverr: No AI assistance system available');
      this.showNotification('AI assistant not available', 'warning');

    } catch (error) {
      console.error('aiFiverr: Error opening AI assistant:', error);
      this.showNotification('Failed to open AI assistant', 'error');
    }
  }

  /**
   * Toggle floating text selection icon functionality
   */
  async toggleFloatingTextSelectionIcon() {
    try {
      // Get current setting from storage
      const settings = await this.getSettings();
      const currentState = settings.floatingIconEnabled !== false; // Default to true
      const newState = !currentState;

      // Update setting
      settings.floatingIconEnabled = newState;
      await this.saveSettings(settings);

      // Update text selector state
      if (window.textSelector) {
        window.textSelector.setEnabled(newState);
      }

      // Show notification
      const message = newState ? 'Floating text selection icon enabled' : 'Floating text selection icon disabled';
      this.showNotification(message, newState ? 'success' : 'info');

      console.log(`aiFiverr: Floating text selection icon ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('aiFiverr: Error toggling floating text selection icon:', error);
    }
  }

  /**
   * Get settings from storage
   */
  async getSettings() {
    try {
      if (window.storageManager) {
        return await window.storageManager.getSettings();
      }
      // Fallback to direct storage access
      const result = await chrome.storage.local.get('settings');
      return result.settings || {};
    } catch (error) {
      console.error('aiFiverr: Error getting settings:', error);
      return {};
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings) {
    try {
      if (window.storageManager) {
        await window.storageManager.saveSettings(settings);
      } else {
        // Fallback to direct storage access
        await chrome.storage.local.set({ settings });
      }
    } catch (error) {
      console.error('aiFiverr: Error saving settings:', error);
    }
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10003;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
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
