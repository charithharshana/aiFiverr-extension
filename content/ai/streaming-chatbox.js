/**
 * Streaming Chatbox Component for aiFiverr Extension
 * Provides continuous chat functionality with streaming responses
 */

class StreamingChatbox {
  constructor(options = {}) {
    this.options = {
      maxWidth: '600px',
      maxHeight: '500px',
      position: 'fixed',
      theme: 'light',
      showActions: true,
      enableDragging: true,
      enableResizing: true,
      ...options
    };

    this.isVisible = false;
    this.isStreaming = false;
    this.currentStreamingMessage = null;
    this.conversationHistory = [];
    this.chatboxElement = null;
    this.messagesContainer = null;
    this.inputElement = null;
    this.sendButton = null;
    this.dragState = { isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };

    // NEW: Context preservation for variable processor consistency
    this.originalPromptContext = null; // Stores the original prompt processing context
    this.originalVariableUsage = null; // Stores which variables were used in original prompt
    this.manuallyAttachedFiles = []; // Stores manually attached files

    // NEW: File access validation and error handling
    this.suspiciousFileIds = new Set([
      'wrpdb7uq3ddk',  // Original problematic file
      '46vm361k1btt'   // portfolio.md file causing 403 permission errors
    ]);
    this.validatedFiles = new Map(); // Cache for file validation results
    this.fileValidationPromises = new Map(); // Prevent duplicate validation requests

    // NEW: Transition state management
    this.isTransitioning = false;
    this.transitionStartTime = null;
    this.maxTransitionTime = 10000; // 10 seconds timeout

    this.init();
  }

  /**
   * Initialize the chatbox
   */
  init() {
    try {
      this.createChatboxElement();
      this.setupEventListeners();
      this.initializeMarkdownRenderer();
      this.hide(); // Start hidden
    } catch (error) {
      console.error('aiFiverr StreamingChatbox: Error during initialization:', error);
      throw error;
    }
  }

  /**
   * Initialize enhanced markdown renderer if available
   */
  initializeMarkdownRenderer() {
    // Ensure enhanced markdown renderer is available
    if (!window.enhancedMarkdownRenderer && window.EnhancedMarkdownRenderer) {
      try {
        window.enhancedMarkdownRenderer = new window.EnhancedMarkdownRenderer();
        console.log('aiFiverr StreamingChatbox: Enhanced markdown renderer initialized');
      } catch (error) {
        console.error('aiFiverr StreamingChatbox: Failed to initialize enhanced markdown renderer:', error);
      }
    }
  }

  /**
   * Create the main chatbox element and structure
   */
  createChatboxElement() {
    this.chatboxElement = document.createElement('div');
    this.chatboxElement.className = 'aifiverr-streaming-chatbox';
    this.chatboxElement.innerHTML = this.getChatboxHTML();

    // Apply styles
    this.applyChatboxStyles();

    // Get references to key elements
    this.messagesContainer = this.chatboxElement.querySelector('.chatbox-messages');
    this.inputElement = this.chatboxElement.querySelector('.chatbox-input');
    this.sendButton = this.chatboxElement.querySelector('.chatbox-send-btn');

    // Append to body
    document.body.appendChild(this.chatboxElement);
  }

  /**
   * Get the HTML structure for the chatbox
   */
  getChatboxHTML() {
    return `
      <div class="chatbox-header draggable-handle">
        <div class="chatbox-title">
          <span class="chatbox-icon">✨</span>
          <h3>AI Chat</h3>
          <span class="drag-indicator">⋮⋮</span>
        </div>
        <div class="chatbox-controls">
          <button class="chatbox-minimize-btn" title="Minimize">−</button>
          <button class="chatbox-close-btn" title="Close">×</button>
        </div>
      </div>
      <div class="chatbox-content">
        <div class="chatbox-messages"></div>
        <div class="chatbox-input-area">
          <div class="chatbox-input-wrapper">
            <textarea 
              class="chatbox-input" 
              placeholder="Continue the conversation..."
              rows="1"
            ></textarea>
            <button class="chatbox-send-btn" title="Send message">➤</button>
          </div>
        </div>
      </div>
      <div class="chatbox-status">Ready to chat</div>
    `;
  }

  /**
   * Apply CSS styles to the chatbox
   */
  applyChatboxStyles() {
    const styles = `
      .aifiverr-streaming-chatbox {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-width: ${this.options.maxWidth};
        height: 550px;
        max-height: ${this.options.maxHeight};
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        border: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        resize: both;
        overflow: hidden;
        min-width: 400px;
        min-height: 300px;
        animation: popupSlideIn 0.2s ease-out;
        transition: height 0.3s ease;
      }

      .aifiverr-streaming-chatbox.minimized {
        min-height: 60px;
        resize: none;
        bottom: 20px;
        top: auto;
        transform: translateX(-50%);
      }

      @keyframes popupSlideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1) translateY(0);
        }
      }

      .chatbox-header {
        background: #f9fafb;
        color: #6b7280;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        border-radius: 12px 12px 0 0;
        border-bottom: 1px solid #e5e7eb;
        min-height: 32px;
      }

      .chatbox-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 400;
        color: #6b7280;
      }

      .chatbox-title h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 400;
        color: #6b7280;
      }

      .chatbox-icon {
        font-size: 12px;
        opacity: 0.7;
      }

      .chatbox-controls {
        display: flex;
        gap: 8px;
      }

      .chatbox-minimize-btn, .chatbox-close-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: #e5e7eb;
        color: #6b7280;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s;
      }

      .chatbox-minimize-btn:hover, .chatbox-close-btn:hover {
        background: #d1d5db;
        color: #374151;
      }

      .chatbox-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .chatbox-messages {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        background: #fafafa;
      }

      .chatbox-message {
        margin-bottom: 8px;
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }

      .chatbox-message.user {
        flex-direction: row-reverse;
      }

      .chatbox-message-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        flex-shrink: 0;
      }

      .chatbox-message.user .chatbox-message-avatar {
        background: #3b82f6;
        color: white;
      }

      .chatbox-message.assistant .chatbox-message-avatar {
        background: #f3f4f6;
        color: #374151;
      }

      .chatbox-message-content {
        max-width: 75%;
        padding: 6px 10px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.4;
        position: relative;
        width: fit-content;
        flex-grow: 0;
        flex-shrink: 1;
      }

      .chatbox-message.user .chatbox-message-content {
        background: #ffffff;
        color: #333;
        border: 1px solid #e1e5e9;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-bottom-right-radius: 4px;
        margin-left: auto;
      }

      .chatbox-message.assistant .chatbox-message-content {
        background: white;
        color: #374151;
        border: 1px solid #e5e7eb;
        border-bottom-left-radius: 4px;
        margin-right: auto;
      }

      .chatbox-message.streaming .chatbox-message-content {
        position: relative;
        min-height: 20px;
      }

      .chatbox-message.streaming .chatbox-message-content::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) translateX(-12px);
        width: 8px;
        height: 8px;
        background: #3b82f6;
        border-radius: 50%;
        animation: floatingDots 1.5s infinite ease-in-out;
      }

      .chatbox-message.streaming .chatbox-message-content::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 6px;
        height: 6px;
        background: #3b82f6;
        border-radius: 50%;
        opacity: 0.7;
        animation: floatingDots 1.5s infinite ease-in-out 0.2s;
      }

      .chatbox-message.streaming .chatbox-message-content {
        position: relative;
        min-height: 24px;
        height: 24px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      @keyframes floatingDots {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.4;
        }
        30% {
          transform: translateY(-8px);
          opacity: 1;
        }
      }

      /* Additional floating dot */
      .chatbox-message.streaming .chatbox-message-content .floating-dot-3 {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) translateX(12px);
        width: 4px;
        height: 4px;
        background: #3b82f6;
        border-radius: 50%;
        opacity: 0.5;
        animation: floatingDots 1.5s infinite ease-in-out 0.4s;
      }

      .chatbox-message-actions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .chatbox-message:hover .chatbox-message-actions {
        opacity: 1;
      }

      .chatbox-action-btn {
        padding: 2px 6px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 3px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .chatbox-action-btn:hover {
        background: #f0f0f0;
        border-color: #667eea;
      }

      /* Edit mode specific styles */
      .chatbox-message-content.editing {
        width: 100%;
        flex-grow: 1;
      }

      .chatbox-input-area {
        padding: 8px 12px;
        border-top: 1px solid #e0e0e0;
        background: white;
      }

      .chatbox-input-wrapper {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      .chatbox-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 20px;
        font-size: 13px;
        resize: none;
        min-height: 36px;
        max-height: 100px;
        font-family: inherit;
      }

      .chatbox-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .chatbox-send-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: #3b82f6;
        color: white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;
      }

      .chatbox-send-btn:hover {
        background: #2563eb;
        transform: scale(1.05);
      }

      .chatbox-send-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
      }

      .chatbox-status {
        padding: 8px 16px;
        font-size: 11px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        border-radius: 0 0 12px 12px;
        min-height: 32px;
        display: flex;
        align-items: center;
      }

      .chatbox-status.error {
        background: #fef2f2;
        color: #dc2626;
      }

      .chatbox-status.success {
        background: #f0fdf4;
        color: #16a34a;
      }

      /* Enhanced formatting styles */
      .chat-link {
        color: #3b82f6;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
      }

      .chat-link:hover {
        border-bottom-color: #3b82f6;
        background-color: rgba(59, 130, 246, 0.1);
      }

      .chat-bold {
        font-weight: 600;
        color: #1f2937;
      }

      .chat-italic {
        font-style: italic;
        color: #4b5563;
      }

      .chat-strikethrough {
        text-decoration: line-through;
        color: #6b7280;
      }

      .chat-inline-code {
        background: #f3f4f6;
        color: #e11d48;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
      }

      .chat-code-block {
        background: #1f2937;
        color: #f9fafb;
        padding: 12px;
        border-radius: 6px;
        margin: 8px 0;
        overflow-x: auto;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
        line-height: 1.4;
      }

      .chat-header-1, .chat-header-2, .chat-header-3 {
        margin: 12px 0 8px 0;
        font-weight: 600;
        color: #1f2937;
      }

      .chat-header-1 { font-size: 1.25em; }
      .chat-header-2 { font-size: 1.1em; }
      .chat-header-3 { font-size: 1em; }

      .chat-bullet-list, .chat-numbered-list {
        margin: 8px 0;
        padding-left: 20px;
      }

      .chat-list-item {
        margin: 4px 0;
        line-height: 1.4;
      }
    `;

    // Add styles to document if not already added
    if (!document.getElementById('aifiverr-streaming-chatbox-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'aifiverr-streaming-chatbox-styles';
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    this.chatboxElement.querySelector('.chatbox-close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Minimize button
    this.chatboxElement.querySelector('.chatbox-minimize-btn').addEventListener('click', () => {
      this.minimize();
    });

    // Send button
    this.sendButton.addEventListener('click', () => {
      this.sendMessage();
    });

    // Input field
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize input
    this.inputElement.addEventListener('input', () => {
      this.autoResizeInput();
    });

    // Dragging functionality
    if (this.options.enableDragging) {
      this.setupDragging();
    }

    // Message actions (event delegation)
    this.messagesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('chatbox-copy-btn')) {
        this.copyMessage(e.target, 'text');
      } else if (e.target.classList.contains('chatbox-edit-btn')) {
        this.editMessage(e.target);
      } else if (e.target.classList.contains('chatbox-insert-btn')) {
        this.insertMessage(e.target);
      }
    });

    // Right-click for markdown copy
    this.messagesContainer.addEventListener('contextmenu', (e) => {
      if (e.target.classList.contains('chatbox-copy-btn')) {
        e.preventDefault();
        this.copyMessage(e.target, 'markdown');
      }
    });
  }

  /**
   * Setup dragging functionality
   */
  setupDragging() {
    const header = this.chatboxElement.querySelector('.chatbox-header');
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.chatbox-controls')) return;
      
      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;
      
      const rect = this.chatboxElement.getBoundingClientRect();
      this.dragState.startLeft = rect.left;
      this.dragState.startTop = rect.top;
      
      document.addEventListener('mousemove', this.handleDrag.bind(this));
      document.addEventListener('mouseup', this.handleDragEnd.bind(this));
      
      e.preventDefault();
    });
  }

  /**
   * Handle drag movement
   */
  handleDrag(e) {
    if (!this.dragState.isDragging) return;
    
    const deltaX = e.clientX - this.dragState.startX;
    const deltaY = e.clientY - this.dragState.startY;
    
    const newLeft = this.dragState.startLeft + deltaX;
    const newTop = this.dragState.startTop + deltaY;
    
    this.chatboxElement.style.left = newLeft + 'px';
    this.chatboxElement.style.top = newTop + 'px';
    this.chatboxElement.style.transform = 'none';
  }

  /**
   * Handle drag end
   */
  handleDragEnd() {
    this.dragState.isDragging = false;
    document.removeEventListener('mousemove', this.handleDrag.bind(this));
    document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
  }

  /**
   * Auto-resize input field
   */
  autoResizeInput() {
    this.inputElement.style.height = 'auto';
    this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 100) + 'px';
  }

  /**
   * Show the chatbox
   */
  show(initialMessage = null) {
    this.isVisible = true;
    this.chatboxElement.style.display = 'flex';

    if (initialMessage) {
      this.addMessage('assistant', initialMessage);
    }

    // Focus input
    setTimeout(() => {
      this.inputElement.focus();
    }, 100);
  }

  /**
   * Set original prompt context for consistent variable usage
   * @param {Object} context - Original prompt processing context
   */
  setOriginalContext(context) {
    this.originalPromptContext = context;
    console.log('aiFiverr StreamingChatbox: Original context set:', context);
  }

  /**
   * Validate file accessibility before including in API requests
   * @param {Array} files - Array of file objects to validate
   * @returns {Promise<Array>} - Array of accessible files
   */
  async validateFileAccessibility(files) {
    if (!files || files.length === 0) {
      return [];
    }

    const validFiles = [];
    const inaccessibleFiles = [];

    for (const file of files) {
      try {
        // Check if file is in suspicious list
        if (this.suspiciousFileIds.has(file.geminiUri?.split('/').pop() || file.id)) {
          console.warn('aiFiverr StreamingChatbox: Skipping suspicious file:', file.name, file.geminiUri);
          inaccessibleFiles.push({
            ...file,
            error: 'File is known to be inaccessible (expired or API key mismatch)'
          });
          continue;
        }

        // Check cache first
        const cacheKey = file.geminiUri || file.id;
        if (this.validatedFiles.has(cacheKey)) {
          const cachedResult = this.validatedFiles.get(cacheKey);
          if (cachedResult.isValid) {
            validFiles.push(file);
          } else {
            inaccessibleFiles.push({
              ...file,
              error: cachedResult.error
            });
          }
          continue;
        }

        // Prevent duplicate validation requests
        if (this.fileValidationPromises.has(cacheKey)) {
          const result = await this.fileValidationPromises.get(cacheKey);
          if (result.isValid) {
            validFiles.push(file);
          } else {
            inaccessibleFiles.push({
              ...file,
              error: result.error
            });
          }
          continue;
        }

        // Perform actual validation
        const validationPromise = this.validateSingleFile(file);
        this.fileValidationPromises.set(cacheKey, validationPromise);

        const result = await validationPromise;
        this.validatedFiles.set(cacheKey, result);
        this.fileValidationPromises.delete(cacheKey);

        if (result.isValid) {
          validFiles.push(file);
        } else {
          inaccessibleFiles.push({
            ...file,
            error: result.error
          });
        }

      } catch (error) {
        console.error('aiFiverr StreamingChatbox: File validation error:', error);
        inaccessibleFiles.push({
          ...file,
          error: `Validation failed: ${error.message}`
        });
      }
    }

    // Log results
    if (inaccessibleFiles.length > 0) {
      console.warn('aiFiverr StreamingChatbox: Inaccessible files found:',
        inaccessibleFiles.map(f => ({ name: f.name, error: f.error })));

      // Show user-friendly notification about inaccessible files
      this.showFileAccessWarning(inaccessibleFiles);
    }

    console.log('aiFiverr StreamingChatbox: File validation complete:', {
      total: files.length,
      valid: validFiles.length,
      invalid: inaccessibleFiles.length
    });

    return validFiles;
  }

  /**
   * Validate a single file's accessibility
   * @param {Object} file - File object to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateSingleFile(file) {
    try {
      if (!file.geminiUri) {
        return {
          isValid: false,
          error: 'No Gemini URI provided'
        };
      }

      // CRITICAL FIX: Get API key using same session as initial request to maintain file access consistency
      let apiKey;
      try {
        if (window.apiKeyManager && window.apiKeyManager.initialized) {
          // FIXED: Try 'gemini' session first (same as initial request) for file access consistency
          let keyData = window.apiKeyManager.getKeyForSession('gemini');
          if (keyData) {
            apiKey = keyData.key;
            console.log('aiFiverr StreamingChatbox: Using gemini session API key for file validation (consistency with initial request)');
          } else {
            // Fallback to streaming_chat session
            keyData = window.apiKeyManager.getKeyForSession('streaming_chat');
            apiKey = keyData ? keyData.key : null;
            console.log('aiFiverr StreamingChatbox: Using streaming_chat session API key for file validation (fallback)');
          }
        }

        if (!apiKey && window.enhancedGeminiClient) {
          apiKey = await window.enhancedGeminiClient.getApiKey();
          console.log('aiFiverr StreamingChatbox: Using enhancedGeminiClient API key for file validation (fallback)');
        }

        if (!apiKey) {
          return {
            isValid: false,
            error: 'No API key available for validation'
          };
        }
      } catch (error) {
        return {
          isValid: false,
          error: `API key retrieval failed: ${error.message}`
        };
      }

      // Make a lightweight request to check file accessibility
      const fileId = file.geminiUri.split('/').pop();
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return {
          isValid: true,
          error: null
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `HTTP ${response.status}`;

        if (response.status === 403) {
          errorMessage = 'File access forbidden (expired or API key mismatch)';
        } else if (response.status === 404) {
          errorMessage = 'File not found or deleted';
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }

        // Add to suspicious files if it's a permission error
        if (response.status === 403) {
          this.suspiciousFileIds.add(fileId);
        }

        return {
          isValid: false,
          error: errorMessage
        };
      }

    } catch (error) {
      return {
        isValid: false,
        error: `Network error: ${error.message}`
      };
    }
  }

  /**
   * Show user-friendly warning about inaccessible files
   * @param {Array} inaccessibleFiles - Array of inaccessible file objects
   */
  showFileAccessWarning(inaccessibleFiles) {
    const fileNames = inaccessibleFiles.map(f => f.name).join(', ');
    const warningMessage = `⚠️ Some files are no longer accessible: ${fileNames}. This usually means they have expired (48-hour limit) or were uploaded with a different API key. The conversation will continue with available files only.`;

    // Show warning in the chat
    if (this.messagesContainer) {
      const warningDiv = document.createElement('div');
      warningDiv.className = 'chatbox-warning-message';
      warningDiv.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; margin: 8px 0; color: #856404;">
          <strong>File Access Warning:</strong><br>
          ${warningMessage}
          <br><br>
          <small>💡 <strong>To fix this:</strong> Please refresh or re-upload the files in your Knowledge Base and try again.</small>
        </div>
      `;
      this.messagesContainer.appendChild(warningDiv);
      this.scrollToBottom();
    }
  }

  /**
   * Set original variable usage pattern
   * @param {Array} usedVariables - Variables that were used in the original prompt
   */
  setOriginalVariableUsage(usedVariables) {
    this.originalVariableUsage = usedVariables;
    console.log('aiFiverr StreamingChatbox: Original variable usage set:', usedVariables);
  }

  /**
   * Set manually attached files
   * @param {Array} files - Manually attached files
   */
  setManuallyAttachedFiles(files) {
    this.manuallyAttachedFiles = files || [];
    console.log('aiFiverr StreamingChatbox: Manually attached files set:', this.manuallyAttachedFiles.length);

    // DEBUG: Log detailed file information for context transfer debugging
    if (this.manuallyAttachedFiles.length > 0) {
      console.log('🚨 STREAMING CHATBOX: Files received for context transfer:',
        this.manuallyAttachedFiles.map(f => ({
          name: f.name,
          geminiUri: f.geminiUri,
          mimeType: f.mimeType,
          hasValidUri: !!f.geminiUri
        }))
      );
    }
  }

  /**
   * Start a new session - clear all context and conversation history
   */
  startNewSession() {
    console.log('aiFiverr StreamingChatbox: Starting new session');

    // Clear conversation history
    this.conversationHistory = [];

    // Clear context
    this.originalPromptContext = null;
    this.originalVariableUsage = null;
    this.manuallyAttachedFiles = [];
    this.currentMessageFiles = [];

    // Clear messages from UI
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }

    // Reset API key session if available
    if (window.apiKeyManager && window.apiKeyManager.initialized) {
      window.apiKeyManager.clearSessionKey('streaming_chat');
      console.log('aiFiverr StreamingChatbox: Cleared API key session');
    }

    // Clear file validation cache and reset suspicious files to defaults
    this.validatedFiles.clear();
    this.fileValidationPromises.clear();
    this.suspiciousFileIds = new Set([
      'wrpdb7uq3ddk',  // Original problematic file
      '46vm361k1btt'   // portfolio.md file causing 403 permission errors
    ]);

    // Reset transition state
    this.isTransitioning = false;
    this.transitionStartTime = null;

    this.updateStatus('New session started', 'success');
    console.log('aiFiverr StreamingChatbox: New session started - all context cleared');
  }

  /**
   * Refresh file access and clear suspicious files list
   * This can be called when user wants to retry with files that were previously inaccessible
   */
  refreshFileAccess() {
    console.log('aiFiverr StreamingChatbox: Refreshing file access validation');

    // Clear all validation caches
    this.validatedFiles.clear();
    this.fileValidationPromises.clear();

    // Reset suspicious files to minimal set (keep known problematic ones)
    this.suspiciousFileIds = new Set([
      'wrpdb7uq3ddk',  // Original problematic file
      '46vm361k1btt'   // portfolio.md file causing 403 permission errors
    ]);

    // Show success message
    this.updateStatus('File access refreshed - you can now retry with previously inaccessible files', 'success');

    console.log('aiFiverr StreamingChatbox: File access validation refreshed');
  }

  /**
   * Check if a file ID is in the suspicious files list
   * @param {string} fileId - The file ID to check
   * @returns {boolean} - True if the file is suspicious
   */
  isFileSuspicious(fileId) {
    return this.suspiciousFileIds.has(fileId);
  }

  /**
   * Add a file ID to the suspicious files list
   * @param {string} fileId - The file ID to add
   */
  markFileAsSuspicious(fileId) {
    this.suspiciousFileIds.add(fileId);
    console.log('aiFiverr StreamingChatbox: Marked file as suspicious:', fileId);
  }

  /**
   * Remove a file ID from the suspicious files list (for retry scenarios)
   * @param {string} fileId - The file ID to remove
   */
  clearFileSuspicion(fileId) {
    this.suspiciousFileIds.delete(fileId);
    this.validatedFiles.delete(fileId);
    console.log('aiFiverr StreamingChatbox: Cleared suspicion for file:', fileId);
  }

  /**
   * Check if a message is a simple conversational message that doesn't need complex context
   * @param {string} message - The message to check
   * @returns {boolean} - True if it's a simple message
   */
  isSimpleMessage(message) {
    if (!message || typeof message !== 'string') return false;

    const trimmed = message.trim().toLowerCase();

    // Simple greetings and responses
    const simplePatterns = [
      /^(hi|hello|hey|yo)$/,
      /^(thanks|thank you|thx)$/,
      /^(ok|okay|yes|no|sure)$/,
      /^(bye|goodbye|see you)$/,
      /^(good morning|good afternoon|good evening)$/,
      /^(how are you|what's up|sup)$/,
      /^(nice|great|awesome|cool)$/
    ];

    // Check if message matches simple patterns
    const isSimple = simplePatterns.some(pattern => pattern.test(trimmed));

    // Also consider very short messages (under 10 characters) as potentially simple
    const isVeryShort = trimmed.length < 10 && !trimmed.includes('{') && !trimmed.includes('?');

    return isSimple || isVeryShort;
  }

  /**
   * Build context for follow-up messages based on original variable usage
   * @param {string} followUpMessage - The follow-up message
   * @returns {Object} - Context object for variable processor
   */
  async buildFollowUpContext(followUpMessage) {
    const context = {};

    // FIXED: Always build context based on original variable usage, not follow-up message content
    // This ensures contextual conversations work properly for messages like "thanks", "explain more", etc.
    if (!this.originalVariableUsage || this.originalVariableUsage.length === 0) {
      console.log('aiFiverr StreamingChatbox: No original variable usage, returning empty context');
      return context;
    }

    console.log('aiFiverr StreamingChatbox: Building follow-up context for variables:', this.originalVariableUsage);

    // FIXED: Only populate variables that were used in the original prompt
    // Don't require follow-up message to contain explicit variable references
    const relevantVars = this.originalVariableUsage;

    for (const varName of relevantVars) {
      try {
        switch (varName) {
          case 'conversation':
            // FIXED: Prioritize original context to prevent duplication
            if (this.originalPromptContext && this.originalPromptContext.conversation) {
              context.conversation = this.originalPromptContext.conversation;
              console.log('aiFiverr StreamingChatbox: Using original conversation context to prevent duplication');
            } else if (window.fiverrExtractor) {
              const conversationData = await window.fiverrExtractor.extractConversation();
              context.conversation = conversationData ? window.fiverrExtractor.conversationToContext(conversationData) : '';
              console.log('aiFiverr StreamingChatbox: Extracted fresh conversation context');
            }
            break;

          case 'reply':
            // Include reply context only if it was originally used
            if (this.originalPromptContext && this.originalPromptContext.reply) {
              context.reply = this.originalPromptContext.reply;
            }
            break;

          case 'username':
            // Include username only if it was originally used
            if (this.originalPromptContext && this.originalPromptContext.username) {
              context.username = this.originalPromptContext.username;
            } else if (window.fiverrExtractor) {
              context.username = window.fiverrExtractor.extractUsernameFromUrl() || 'Client';
            }
            break;

          case 'selected_text':
            // Include selected text only if it was originally used
            if (this.originalPromptContext && this.originalPromptContext.selected_text) {
              context.selected_text = this.originalPromptContext.selected_text;
            }
            break;

          default:
            // For other variables, try to get from original context
            if (this.originalPromptContext && this.originalPromptContext[varName]) {
              context[varName] = this.originalPromptContext[varName];
            }
            break;
        }
      } catch (error) {
        console.error(`aiFiverr StreamingChatbox: Error building context for variable ${varName}:`, error);
      }
    }

    // FIXED: Always add previous AI response as context for follow-up understanding
    // This ensures contextual responses for all follow-up messages, including simple ones like "thanks"
    if (this.conversationHistory.length > 0) {
      const lastAssistantMessage = this.conversationHistory
        .slice()
        .reverse()
        .find(msg => msg.role === 'model');

      if (lastAssistantMessage) {
        context.previous_response = lastAssistantMessage.parts[0]?.text || '';
        console.log('aiFiverr StreamingChatbox: Added previous response context for follow-up');
      }
    }

    console.log('aiFiverr StreamingChatbox: Built follow-up context:', Object.keys(context));
    return context;
  }

  /**
   * Clear all messages from the UI
   */
  clearMessages() {
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
  }

  /**
   * Initialize with conversation history (prevents duplication)
   */
  initializeWithHistory(conversationHistory) {
    // Clear existing state
    this.conversationHistory = [];
    this.clearMessages();

    // Set conversation history
    this.conversationHistory = [...conversationHistory];

    // Add messages to UI
    conversationHistory.forEach(message => {
      const role = message.role === 'model' ? 'assistant' : message.role;
      const content = message.parts[0]?.text || '';
      if (content) {
        this.addMessage(role, content);
      }
    });
  }

  /**
   * Hide the chatbox
   */
  hide() {
    this.isVisible = false;
    this.chatboxElement.style.display = 'none';
  }

  /**
   * Show action buttons for a message (used after streaming completes)
   */
  showActionButtons(messageElement) {
    const actionsDiv = messageElement.querySelector('.chatbox-message-actions');
    if (actionsDiv) {
      actionsDiv.style.display = 'flex';
    }
  }

  /**
   * Minimize the chatbox
   */
  minimize() {
    const chatWindow = this.chatboxElement;
    const minimizeBtn = chatWindow.querySelector('.chatbox-minimize-btn');

    if (chatWindow.classList.contains('minimized')) {
      // Restore
      chatWindow.classList.remove('minimized');
      chatWindow.style.height = '';
      chatWindow.querySelector('.chatbox-content').style.display = '';
      chatWindow.querySelector('.chatbox-status').style.display = '';
      minimizeBtn.textContent = '−';
      minimizeBtn.title = 'Minimize';
    } else {
      // Minimize
      chatWindow.classList.add('minimized');
      chatWindow.style.height = '60px';
      chatWindow.querySelector('.chatbox-content').style.display = 'none';
      chatWindow.querySelector('.chatbox-status').style.display = 'none';
      minimizeBtn.textContent = '+';
      minimizeBtn.title = 'Restore';
    }
  }

  /**
   * Add a message to the chat
   */
  addMessage(role, content, isStreaming = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbox-message ${role}${isStreaming ? ' streaming' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chatbox-message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'chatbox-message-content';
    contentDiv.innerHTML = this.formatMessage(content, { editMode: false });

    // Store original markdown for editing
    if (role === 'assistant' && content) {
      contentDiv.dataset.originalMarkdown = content;
    }

    // Add third floating dot for streaming animation
    if (isStreaming) {
      const floatingDot3 = document.createElement('div');
      floatingDot3.className = 'floating-dot-3';
      contentDiv.appendChild(floatingDot3);
    }
    
    // Add action buttons for assistant messages (hide during streaming)
    if (role === 'assistant' && this.options.showActions) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'chatbox-message-actions';
      actionsDiv.style.display = isStreaming ? 'none' : 'flex';
      actionsDiv.innerHTML = `
        <button class="chatbox-action-btn chatbox-copy-btn">📋 <small>T|M</small></button>
        <button class="chatbox-action-btn chatbox-edit-btn">✏️ Edit</button>
        <button class="chatbox-action-btn chatbox-insert-btn">📝 Insert</button>
      `;
      contentDiv.appendChild(actionsDiv);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
    
    return messageDiv;
  }

  /**
   * Send a message
   */
  async sendMessage() {
    const message = this.inputElement.value.trim();
    console.log('aiFiverr StreamingChatbox: sendMessage called with message:', message);

    if (!message) {
      console.log('aiFiverr StreamingChatbox: Empty message, not sending');
      return;
    }

    if (this.isStreaming) {
      console.log('aiFiverr StreamingChatbox: Already streaming, ignoring new message');
      return;
    }

    console.log('aiFiverr StreamingChatbox: Adding user message to conversation');

    // FIXED: Always build context for follow-up messages to maintain conversation continuity
    // This ensures contextual responses even for simple messages like "thanks", "explain more", etc.
    let processedMessage = message;
    let additionalFiles = [];

    if (window.variableProcessor) {
      try {
        // Always build follow-up context based on original variable usage
        const followUpContext = await this.buildFollowUpContext(message);

        const processedResult = await window.variableProcessor.processPrompt(
          message,
          followUpContext,
          this.manuallyAttachedFiles
        );

        processedMessage = processedResult.prompt;
        additionalFiles = processedResult.knowledgeBaseFiles || [];

        console.log('aiFiverr StreamingChatbox: Processed follow-up message with variable processor');
        console.log('aiFiverr StreamingChatbox: Variables used in follow-up:', processedResult.usedVariables);
        console.log('aiFiverr StreamingChatbox: Files used in follow-up:', processedResult.usedFiles);
      } catch (error) {
        console.warn('aiFiverr StreamingChatbox: Variable processor failed for follow-up, using original message:', error);
        // Still check for manually attached files
        additionalFiles = this.manuallyAttachedFiles || [];
      }
    }

    // Add user message (use original message for display, processed for API)
    this.addMessage('user', message);
    this.inputElement.value = '';
    this.autoResizeInput();

    // Add to conversation history (use processed message for API consistency)
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: processedMessage }]
    });

    // Store additional files for this message
    this.currentMessageFiles = additionalFiles;

    console.log('aiFiverr StreamingChatbox: Conversation history length:', this.conversationHistory.length);

    // Start streaming response
    console.log('aiFiverr StreamingChatbox: Starting AI response stream');
    await this.streamResponse();
  }

  /**
   * Stream a response from the AI
   */
  async streamResponse() {
    this.isStreaming = true;
    this.sendButton.disabled = true;
    this.updateStatus('AI is thinking...', '');

    // Create streaming message
    const streamingMessage = this.addMessage('assistant', '', true);
    this.currentStreamingMessage = streamingMessage;

    try {
      // Use direct API call with full conversation context
      await this.streamWithFullContext();

    } catch (error) {
      console.error('aiFiverr StreamingChatbox: Streaming error:', error);
      this.handleStreamingError(error);
    } finally {
      this.isStreaming = false;
      this.sendButton.disabled = false;

      // Show action buttons for the completed streaming message
      if (this.currentStreamingMessage) {
        this.showActionButtons(this.currentStreamingMessage);
      }

      this.currentStreamingMessage = null;
      this.updateStatus('Ready to chat', 'success');
    }
  }

  /**
   * Stream response with full conversation context
   */
  async streamWithFullContext() {
    // NEW: Enhanced API key handling with rotation support
    let apiKey;
    let sessionId = 'streaming_chat'; // Consistent session ID for this chat

    try {
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        // Try to get the same key used for this session to maintain consistency
        const keyData = window.apiKeyManager.getKeyForSession(sessionId);
        apiKey = keyData ? keyData.key : null;
        console.log('aiFiverr StreamingChatbox: API key from apiKeyManager for session:', apiKey ? 'Found' : 'Not found');

        // If no key for this session, get any available key but mark the session
        if (!apiKey) {
          const newKeyData = window.apiKeyManager.getNextKey();
          if (newKeyData) {
            apiKey = newKeyData.key;
            // Associate this key with our session to maintain consistency
            window.apiKeyManager.setSessionKey(sessionId, newKeyData.key);
            console.log('aiFiverr StreamingChatbox: Assigned new API key to session');
          }
        }
      }

      if (!apiKey && window.enhancedGeminiClient) {
        apiKey = await window.enhancedGeminiClient.getApiKey();
        console.log('aiFiverr StreamingChatbox: API key from enhancedGeminiClient:', apiKey ? 'Found' : 'Not found');
      }

      if (!apiKey) {
        console.error('aiFiverr StreamingChatbox: No API key available from any source');
        throw new Error('No API key available. Please configure your Gemini API key in the extension settings.');
      }
    } catch (error) {
      console.error('aiFiverr StreamingChatbox: Error retrieving API key:', error);
      throw new Error('Failed to retrieve API key: ' + error.message);
    }

    // Build complete conversation context
    const contents = [];

    // Add conversation history
    for (const message of this.conversationHistory) {
      contents.push({
        role: message.role === 'model' ? 'model' : 'user',
        parts: message.parts
      });
    }

    // NEW: Get files based on variable processor logic (manually attached + referenced files)
    let knowledgeBaseFiles = [];

    // Priority 1: Manually attached files (always include)
    if (this.manuallyAttachedFiles && this.manuallyAttachedFiles.length > 0) {
      knowledgeBaseFiles.push(...this.manuallyAttachedFiles);
      console.log('🚨 STREAMING CHATBOX: Including manually attached files:', this.manuallyAttachedFiles.length);
      console.log('🚨 STREAMING CHATBOX: Files being included:',
        this.manuallyAttachedFiles.map(f => ({ name: f.name, geminiUri: f.geminiUri }))
      );
    } else {
      console.log('🚨 STREAMING CHATBOX: No manually attached files to include');
    }

    // Priority 2: Files from current message processing (variable processor determined)
    if (this.currentMessageFiles && this.currentMessageFiles.length > 0) {
      // Avoid duplicates
      for (const file of this.currentMessageFiles) {
        const alreadyIncluded = knowledgeBaseFiles.some(existing =>
          existing.geminiUri === file.geminiUri || existing.name === file.name
        );
        if (!alreadyIncluded) {
          knowledgeBaseFiles.push(file);
        }
      }
      console.log('aiFiverr StreamingChatbox: Including message-specific files:', this.currentMessageFiles.length);
    }

    console.log('aiFiverr StreamingChatbox: Total files before validation:', knowledgeBaseFiles.length);

    // NEW: Validate file accessibility before including in API request
    if (knowledgeBaseFiles.length > 0) {
      try {
        knowledgeBaseFiles = await this.validateFileAccessibility(knowledgeBaseFiles);
        console.log('aiFiverr StreamingChatbox: Files after validation:', knowledgeBaseFiles.length);
      } catch (error) {
        console.error('aiFiverr StreamingChatbox: File validation failed:', error);
        // Continue with original files if validation fails
        console.log('aiFiverr StreamingChatbox: Continuing with unvalidated files due to validation error');
      }
    }

    // Add files to the last user message if available
    if (knowledgeBaseFiles.length > 0 && contents.length > 0) {
      const lastUserMessage = contents[contents.length - 1];
      if (lastUserMessage.role === 'user') {
        for (const file of knowledgeBaseFiles) {
          if (file.geminiUri) {
            lastUserMessage.parts.unshift({
              fileData: {
                fileUri: file.geminiUri,
                mimeType: file.mimeType || 'text/plain'
              }
            });
            console.log('aiFiverr StreamingChatbox: Added file to message:', file.name);
          }
        }
      }
    }

    const payload = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        candidateCount: 1
      }
    };

    // Get model name
    let model = 'gemini-2.5-flash';
    if (window.enhancedGeminiClient) {
      try {
        model = await window.enhancedGeminiClient.getSelectedModel();
      } catch (error) {
        console.warn('Failed to get selected model, using default:', error);
      }
    }

    // Making streaming request with conversation history

    // Use SSE format like the working example
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMessage = `Gemini streaming API error: ${response.status} - ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = `Gemini API error: ${errorData.error.message}`;
        }
      } catch (e) {
        // If we can't parse the error response, use the status text
      }
      console.error('aiFiverr StreamingChatbox: API request failed:', errorMessage);
      throw new Error(errorMessage);
    }

    console.log('aiFiverr StreamingChatbox: API request successful, starting stream processing');
    await this.processStreamResponse(response);
  }

  /**
   * Parse multiple JSON objects from a single string
   * Handles cases where streaming chunks contain multiple JSON objects
   */
  parseMultipleJSONObjects(jsonStr) {
    const results = [];

    if (!jsonStr || jsonStr.trim() === '') {
      return results;
    }

    // Sanitize the input first
    const sanitizedStr = this.sanitizeJSONChunk(jsonStr);

    // First, try parsing as a single JSON object
    try {
      const singleObject = JSON.parse(sanitizedStr);
      results.push(singleObject);
      return results;
    } catch (error) {
      // If single parse fails, try to handle multiple objects or malformed JSON
      console.log('aiFiverr StreamingChatbox: Single JSON parse failed, attempting advanced parsing');
      console.log('aiFiverr StreamingChatbox: Raw content:', jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''));
      console.log('aiFiverr StreamingChatbox: Sanitized content:', sanitizedStr.substring(0, 200) + (sanitizedStr.length > 200 ? '...' : ''));
    }

    // Try to extract valid JSON from the beginning of the string
    const extractedJSON = this.extractValidJSON(sanitizedStr);
    if (extractedJSON) {
      try {
        const parsed = JSON.parse(extractedJSON);
        results.push(parsed);
        return results;
      } catch (e) {
        console.log('aiFiverr StreamingChatbox: Extracted JSON still invalid:', e.message);
      }
    }

    // Try common patterns - multiple objects separated by newlines or whitespace
    const commonPatterns = [
      // Pattern 1: Objects separated by newlines
      sanitizedStr.split('\n').filter(line => line.trim()),
      // Pattern 2: Objects separated by whitespace (but not within strings)
      this.splitJSONObjects(sanitizedStr)
    ];

    for (const pattern of commonPatterns) {
      if (pattern.length > 1) {
        let allParsed = true;
        const patternResults = [];

        for (const part of pattern) {
          try {
            const cleanPart = this.sanitizeJSONChunk(part.trim());
            const parsed = JSON.parse(cleanPart);
            patternResults.push(parsed);
          } catch (e) {
            allParsed = false;
            break;
          }
        }

        if (allParsed && patternResults.length > 0) {
          return patternResults;
        }
      }
    }

    // Fallback: Advanced brace-counting parser
    return this.parseWithBraceCounting(sanitizedStr);
  }

  /**
   * Sanitize JSON chunk by removing common streaming artifacts
   */
  sanitizeJSONChunk(jsonStr) {
    if (!jsonStr) return '';

    let sanitized = jsonStr.trim();

    // Remove common streaming prefixes
    if (sanitized.startsWith('data: ')) {
      sanitized = sanitized.slice(6).trim();
    }

    // Handle streaming termination markers
    if (sanitized === '[DONE]' || sanitized === 'data: [DONE]') {
      return '';
    }

    // Remove null bytes and other control characters that can break JSON parsing
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Remove trailing commas that might be left from incomplete streaming
    sanitized = sanitized.replace(/,\s*$/, '');

    return sanitized;
  }

  /**
   * Extract valid JSON from the beginning of a string, handling cases where
   * valid JSON is followed by additional non-JSON content
   */
  extractValidJSON(jsonStr) {
    if (!jsonStr || jsonStr.trim() === '') return null;

    const trimmed = jsonStr.trim();

    // Must start with { or [ to be valid JSON
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEnd = -1;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        } else if (char === '[') {
          bracketCount++;
        } else if (char === ']') {
          bracketCount--;
        }

        // Check if we've completed a valid JSON object/array
        if (braceCount === 0 && bracketCount === 0 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          jsonEnd = i;
          break;
        }
      }
    }

    if (jsonEnd >= 0) {
      return trimmed.substring(0, jsonEnd + 1);
    }

    return null;
  }

  /**
   * Split JSON objects by finding complete object boundaries
   * Enhanced version that prevents isolated braces and validates objects
   */
  splitJSONObjects(jsonStr) {
    const objects = [];
    let braceCount = 0;
    let currentObject = '';
    let inString = false;
    let escapeNext = false;
    let hasOpenedBrace = false; // Track if we've seen an opening brace

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        escapeNext = false;
        currentObject += char;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        currentObject += char;
        continue;
      }

      if (char === '"') {
        inString = !inString;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
          hasOpenedBrace = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      currentObject += char;

      // Complete object found - only if we've seen an opening brace
      if (braceCount === 0 && hasOpenedBrace && currentObject.trim()) {
        const trimmedObject = currentObject.trim();
        // Validate that this looks like valid JSON before adding
        if (this.isLikelyValidJSON(trimmedObject)) {
          objects.push(trimmedObject);
        } else {
          console.warn('aiFiverr StreamingChatbox: Skipping invalid JSON object:', trimmedObject.substring(0, 100));
        }
        currentObject = '';
        hasOpenedBrace = false; // Reset for next object
      }
    }

    // Only add remaining content if it contains an opening brace (valid JSON structure)
    if (currentObject.trim() && currentObject.includes('{')) {
      const trimmedRemaining = currentObject.trim();
      if (this.isLikelyValidJSON(trimmedRemaining)) {
        objects.push(trimmedRemaining);
      } else {
        console.warn('aiFiverr StreamingChatbox: Skipping invalid JSON object:', trimmedRemaining.substring(0, 100));
      }
    } else if (currentObject.trim()) {
      // This is where isolated braces would be caught and ignored
      console.log('aiFiverr StreamingChatbox: Ignoring invalid remaining content (likely isolated brace):', currentObject.trim());
    }

    return objects;
  }

  /**
   * Quick validation to check if a string looks like valid JSON
   * This prevents obviously invalid content from being passed to JSON.parse()
   */
  isLikelyValidJSON(str) {
    if (!str || str.trim() === '') return false;

    let trimmed = str.trim();

    // Handle streaming prefixes - remove them for validation
    if (trimmed.startsWith('data: ')) {
      trimmed = trimmed.slice(6).trim();
    }

    // Handle streaming termination markers
    if (trimmed === '[DONE]') {
      return false; // Not JSON, but valid streaming marker
    }

    // Must start and end with proper JSON delimiters
    const startsCorrectly = trimmed.startsWith('{') || trimmed.startsWith('[');
    const endsCorrectly = trimmed.endsWith('}') || trimmed.endsWith(']');

    if (!startsCorrectly || !endsCorrectly) {
      return false;
    }

    // Check for balanced braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }

    // Must have balanced braces and brackets
    return braceCount === 0 && bracketCount === 0;
  }

  /**
   * Advanced parsing with brace counting (fallback method)
   * Enhanced with multiple recovery strategies and better error handling
   */
  parseWithBraceCounting(jsonStr) {
    const results = [];
    const objects = this.splitJSONObjects(jsonStr);

    for (const obj of objects) {
      // Skip empty or whitespace-only objects
      if (!obj || obj.trim() === '') continue;

      try {
        // Try to sanitize the object first
        const sanitizedObj = this.sanitizeJSONChunk(obj);
        if (!sanitizedObj) continue;

        // Additional validation before parsing
        if (!this.isLikelyValidJSON(sanitizedObj)) {
          console.warn('aiFiverr StreamingChatbox: Skipping object that doesn\'t look like valid JSON:', sanitizedObj.substring(0, 100));
          continue;
        }

        const parsed = JSON.parse(sanitizedObj);
        results.push(parsed);
      } catch (parseError) {
        console.warn('aiFiverr StreamingChatbox: Failed to parse JSON object:', parseError);
        console.warn('aiFiverr StreamingChatbox: Object content:', obj.substring(0, 200) + (obj.length > 200 ? '...' : ''));

        // Enhanced debugging for position-specific errors
        if (parseError.message.includes('position')) {
          const match = parseError.message.match(/position (\d+)/);
          if (match) {
            const position = parseInt(match[1]);
            const sanitizedObj = this.sanitizeJSONChunk(obj);
            const contentToAnalyze = sanitizedObj || obj;

            console.warn('aiFiverr StreamingChatbox: Error at position', position);
            if (position < contentToAnalyze.length) {
              console.warn('aiFiverr StreamingChatbox: Character at position:', contentToAnalyze.charAt(position), '(code:', contentToAnalyze.charCodeAt(position), ')');
              console.warn('aiFiverr StreamingChatbox: Context around position:', contentToAnalyze.substring(Math.max(0, position - 10), position + 10));
            }
            console.warn('aiFiverr StreamingChatbox: Full problematic content for debugging:', JSON.stringify(contentToAnalyze));
          }
        }

        // Try multiple recovery strategies
        const recoveryStrategies = [
          () => this.extractValidJSON(obj),
          () => this.extractValidJSON(this.sanitizeJSONChunk(obj)),
          () => this.attemptJSONFix(obj),
          () => this.attemptJSONFix(this.sanitizeJSONChunk(obj)),
          () => this.aggressiveJSONExtraction(obj)
        ];

        let recovered = false;
        for (const strategy of recoveryStrategies) {
          try {
            const recoveredJSON = strategy();
            if (recoveredJSON && this.isLikelyValidJSON(recoveredJSON)) {
              const parsed = JSON.parse(recoveredJSON);
              results.push(parsed);
              console.log('aiFiverr StreamingChatbox: Successfully recovered JSON using recovery strategy');
              recovered = true;
              break;
            }
          } catch (recoveryError) {
            // Continue to next strategy
          }
        }

        if (!recovered) {
          console.warn('aiFiverr StreamingChatbox: All JSON recovery attempts failed for object:', obj.substring(0, 100));
        }
      }
    }

    return results;
  }

  /**
   * Attempt to fix common JSON formatting issues
   */
  attemptJSONFix(jsonStr) {
    if (!jsonStr || jsonStr.trim() === '') return null;

    let fixed = jsonStr.trim();

    // Fix common issues:
    // 1. Remove trailing commas before closing braces/brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // 2. Fix unescaped quotes in strings (basic attempt)
    // This is risky but might help with some cases
    fixed = fixed.replace(/([^\\])"([^"]*)"([^,}\]:])/g, '$1\\"$2\\"$3');

    // 3. Remove any trailing non-JSON content after a complete JSON object
    const extractedJSON = this.extractValidJSON(fixed);
    if (extractedJSON) {
      return extractedJSON;
    }

    // 4. Try to close incomplete objects/arrays
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }

    // Add missing closing braces/brackets
    while (braceCount > 0) {
      fixed += '}';
      braceCount--;
    }
    while (bracketCount > 0) {
      fixed += ']';
      bracketCount--;
    }

    return fixed;
  }

  /**
   * Aggressive JSON extraction for difficult cases
   * This method tries to find any valid JSON within the string, even if it's embedded
   */
  aggressiveJSONExtraction(str) {
    if (!str || str.trim() === '') return null;

    const trimmed = str.trim();

    // Try to find the first occurrence of { or [ and extract from there
    let startIndex = -1;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '{' || trimmed[i] === '[') {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) return null;

    // Extract from the start index and try to find a complete JSON object
    const candidate = trimmed.substring(startIndex);

    // Use the existing extractValidJSON method on this candidate
    const extracted = this.extractValidJSON(candidate);
    if (extracted) {
      return extracted;
    }

    // If that fails, try a more aggressive approach - look for the longest valid JSON
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    let bestEnd = -1;

    for (let i = 0; i < candidate.length; i++) {
      const char = candidate[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;

        // Check if we have a complete, balanced structure
        if (braceCount === 0 && bracketCount === 0 && i > 0) {
          bestEnd = i;
          // Don't break immediately - continue to find the longest valid JSON
        }
      }
    }

    if (bestEnd >= 0) {
      return candidate.substring(0, bestEnd + 1);
    }

    return null;
  }

  /**
   * Process streaming response (Enhanced with SSE support)
   */
  async processStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let chunkCount = 0;

    const contentDiv = this.currentStreamingMessage.querySelector('.chatbox-message-content');

    if (!contentDiv) {
      console.error('aiFiverr StreamingChatbox: Content div not found for streaming message');
      throw new Error('Streaming message content div not found');
    }

    console.log('aiFiverr StreamingChatbox: Starting stream processing');

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('aiFiverr StreamingChatbox: Stream completed, processed', chunkCount, 'chunks');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          chunkCount++;

          try {
            // Handle Server-Sent Events format (like working example)
            if (line.startsWith('data: ')) {
              const jsonData = line.substring(6); // Remove 'data: ' prefix

              // Handle SSE termination marker
              if (jsonData.trim() === '[DONE]') {
                console.log('aiFiverr StreamingChatbox: SSE streaming completed with [DONE] marker');
                return; // Exit the function
              }

              // Debug logging for chunks
              console.log('aiFiverr StreamingChatbox: Processing SSE chunk', chunkCount + ':', jsonData.substring(0, 100) + (jsonData.length > 100 ? '...' : ''));

              // Parse JSON response chunk
              const chunk = JSON.parse(jsonData);

              if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                const textPart = chunk.candidates[0].content.parts.find(part => part.text);
                if (textPart && textPart.text) {
                  const text = textPart.text;
                  fullResponse += text;
                  contentDiv.innerHTML = this.formatMessage(fullResponse, { editMode: false });
                  // Store original markdown for editing
                  contentDiv.dataset.originalMarkdown = fullResponse;
                  this.scrollToBottom();
                  console.log('aiFiverr StreamingChatbox: Added text chunk:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
                }
              }
            } else {
              // Fallback: try to parse as direct JSON (for compatibility)
              console.log('aiFiverr StreamingChatbox: Processing non-SSE chunk:', line.substring(0, 100) + (line.length > 100 ? '...' : ''));

              const jsonObjects = this.parseMultipleJSONObjects(line);
              for (const data of jsonObjects) {
                if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
                  const text = data.candidates[0].content.parts[0]?.text || '';
                  if (text) {
                    fullResponse += text;
                    contentDiv.innerHTML = this.formatMessage(fullResponse, { editMode: false });
                    // Store original markdown for editing
                    contentDiv.dataset.originalMarkdown = fullResponse;
                    this.scrollToBottom();
                  }
                }
              }
            }
          } catch (parseError) {
            console.warn('aiFiverr StreamingChatbox: Failed to parse streaming chunk:', parseError.message);
            console.warn('aiFiverr StreamingChatbox: Problematic line:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));
            // Continue processing other lines even if one fails
          }
        }
      }

      // Add to conversation history
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }]
      });

      // Remove streaming class and add action buttons
      this.currentStreamingMessage.classList.remove('streaming');
      if (this.options.showActions) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'chatbox-message-actions';
        actionsDiv.innerHTML = `
          <button class="chatbox-action-btn chatbox-copy-btn">📋 <small>T|M</small></button>
          <button class="chatbox-action-btn chatbox-edit-btn">✏️ Edit</button>
          <button class="chatbox-action-btn chatbox-insert-btn">📝 Insert</button>
        `;
        contentDiv.appendChild(actionsDiv);
      }

    } catch (error) {
      console.error('Stream processing error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming errors with better user feedback
   */
  handleStreamingError(error) {
    console.error('aiFiverr StreamingChatbox: Handling streaming error:', error);

    if (this.currentStreamingMessage && this.currentStreamingMessage.classList) {
      const contentDiv = this.currentStreamingMessage.querySelector('.chatbox-message-content');
      if (contentDiv) {
        let errorMessage = '❌ Error: ';

        // FIXED: Check for file access errors FIRST to prevent API key confusion
        if (error.message.includes('File access error:') || error.message.includes('no longer accessible')) {
          // File permission errors should display as-is with proper context
          errorMessage += error.message.replace('File access error: ', '');
        } else if (error.message.includes('You do not have permission to access the File') ||
                   (error.message.includes('403') && error.message.includes('File'))) {
          // Handle specific file permission errors from API
          const fileIdMatch = error.message.match(/File (\w+)/);
          const fileId = fileIdMatch ? fileIdMatch[1] : 'unknown';

          // Add to suspicious files list
          this.suspiciousFileIds.add(fileId);

          errorMessage += `File access denied (ID: ${fileId}). This usually means the file has expired (48-hour limit) or was uploaded with a different API key. Please refresh or re-upload the file in your Knowledge Base and try again.`;
        } else if (error.message.includes('No API key available') || error.message.includes('Failed to retrieve API key')) {
          // Only show API key configuration error for actual API key issues
          errorMessage += 'API key not configured. Please set up your Gemini API key in the extension settings.';
        } else if (error.message.includes('401')) {
          errorMessage += 'Invalid API key. Please check your Gemini API key in the extension settings.';
        } else if (error.message.includes('403') && !error.message.includes('File access error')) {
          // Only show generic 403 message if it's NOT a file permission error
          errorMessage += 'API access forbidden. Please check your API key permissions.';
        } else if (error.message.includes('429')) {
          errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your internet connection and try again.';
        } else {
          errorMessage += error.message;
        }

        contentDiv.innerHTML = errorMessage;
        console.log('aiFiverr StreamingChatbox: Error message displayed to user:', errorMessage);
      }
      this.currentStreamingMessage.classList.remove('streaming');
    }

    if (this.updateStatus && typeof this.updateStatus === 'function') {
      this.updateStatus('Error occurred', 'error');
    }
  }

  /**
   * Format message content with enhanced formatting using Showdown renderer
   */
  formatMessage(text, options = {}) {
    if (!text) return '';

    const { editMode = false } = options;

    // Use enhanced markdown renderer if available and not in edit mode
    if (window.enhancedMarkdownRenderer && !editMode) {
      try {
        return window.enhancedMarkdownRenderer.render(text);
      } catch (error) {
        console.error('aiFiverr StreamingChatbox: Enhanced markdown rendering failed, falling back:', error);
        // Fall through to legacy formatting
      }
    }

    // Legacy formatting for edit mode or fallback
    let formatted = text;

    // Process code blocks first to protect content
    formatted = this.processCodeBlocks(formatted);

    // Process links before other formatting to protect URLs
    formatted = this.processLinks(formatted, editMode);

    // Process headers
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="chat-header-3">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="chat-header-2">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="chat-header-1">$1</h1>');

    // Process bold and italic (order matters)
    formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="chat-bold">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="chat-italic">$1</em>');

    // Process strikethrough
    formatted = formatted.replace(/~~(.*?)~~/g, '<del class="chat-strikethrough">$1</del>');

    // Process inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

    // Process bullet points and numbered lists
    const lines = formatted.split('\n');
    const processedLines = [];
    let inList = false;
    let listType = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^[\s]*[-•*]\s+(.+)$/);
      const numberMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);

      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ul class="chat-bullet-list">');
          inList = true;
          listType = 'ul';
        }
        processedLines.push(`<li class="chat-list-item">${bulletMatch[1]}</li>`);
      } else if (numberMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ol class="chat-numbered-list">');
          inList = true;
          listType = 'ol';
        }
        processedLines.push(`<li class="chat-list-item">${numberMatch[2]}</li>`);
      } else {
        if (inList) {
          processedLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        if (line.trim()) {
          processedLines.push(line);
        } else {
          processedLines.push('<br>');
        }
      }
    }

    if (inList) {
      processedLines.push(`</${listType}>`);
    }

    formatted = processedLines.join('\n');

    // Convert remaining line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');

    // Clean up multiple <br> tags
    formatted = formatted.replace(/(<br>\s*){3,}/g, '<br><br>');

    return formatted;
  }

  /**
   * Process code blocks
   */
  processCodeBlocks(text) {
    // Multi-line code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'text';
      return `<pre class="chat-code-block"><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
    });

    return text;
  }

  /**
   * Process links with dual display modes
   */
  processLinks(text, editMode = false) {
    // Store original URLs for copy/insert operations
    const urlMap = new Map();
    let urlCounter = 0;

    // Process markdown links first: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      const urlId = `__URL_${urlCounter++}__`;
      urlMap.set(urlId, { text: linkText, url: url, type: 'markdown' });

      if (editMode) {
        return `[${linkText}](${url})`;
      } else {
        return `<a href="${this.escapeHtml(url)}" class="chat-link" target="_blank" rel="noopener noreferrer" data-url-id="${urlId}" data-original-url="${this.escapeHtml(url)}">${this.escapeHtml(linkText)}</a>`;
      }
    });

    // Process auto-detected URLs: http://example.com or https://example.com
    text = text.replace(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g, (match, url) => {
      const urlId = `__URL_${urlCounter++}__`;
      const displayText = this.getUrlDisplayText(url);
      urlMap.set(urlId, { text: displayText, url: url, type: 'auto' });

      if (editMode) {
        return url;
      } else {
        return `<a href="${this.escapeHtml(url)}" class="chat-link chat-auto-link" target="_blank" rel="noopener noreferrer" data-url-id="${urlId}" data-original-url="${this.escapeHtml(url)}">${this.escapeHtml(displayText)}</a>`;
      }
    });

    // Store URL map for later use in copy/insert operations
    if (!editMode) {
      this.currentUrlMap = urlMap;
    }

    return text;
  }

  /**
   * Get user-friendly display text for URLs
   */
  getUrlDisplayText(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');

      // For common domains, show friendly names
      const friendlyNames = {
        'github.com': 'GitHub',
        'stackoverflow.com': 'Stack Overflow',
        'google.com': 'Google',
        'youtube.com': 'YouTube',
        'linkedin.com': 'LinkedIn',
        'twitter.com': 'Twitter',
        'facebook.com': 'Facebook',
        'fiverr.com': 'Fiverr'
      };

      if (friendlyNames[hostname]) {
        return friendlyNames[hostname];
      }

      // For other domains, show hostname
      return hostname;
    } catch (e) {
      // If URL parsing fails, return the original URL
      return url;
    }
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Copy message content with support for different formats
   */
  copyMessage(button, copyType = 'text') {
    const messageContent = button.closest('.chatbox-message-content');
    const messageDiv = button.closest('.chatbox-message');

    // Get the original message text from conversation history
    const messageIndex = Array.from(this.messagesContainer.children).indexOf(messageDiv);
    let originalText = '';

    // Try to get original text from conversation history
    if (this.conversationHistory && this.conversationHistory.length > 0) {
      // Find corresponding message in history (accounting for user/assistant alternation)
      const assistantMessages = this.conversationHistory.filter(msg => msg.role === 'model');
      const assistantIndex = Math.floor(messageIndex / 2); // Rough estimate
      if (assistantMessages[assistantIndex]) {
        originalText = assistantMessages[assistantIndex].parts[0]?.text || '';
      }
    }

    // Check if in edit mode
    const textarea = messageContent.querySelector('.chat-edit-textarea');
    if (textarea) {
      // In edit mode, copy the raw text
      const textToCopy = textarea.value;
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showCopyFeedback(button, 'text');
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    } else {
      // In view mode, get content based on copy type
      let textToCopy = '';

      if (copyType === 'markdown' && originalText) {
        // Copy original markdown text
        textToCopy = originalText;
      } else {
        // Copy as plain text
        if (window.enhancedMarkdownRenderer && originalText) {
          try {
            const htmlContent = window.enhancedMarkdownRenderer.render(originalText);
            textToCopy = window.enhancedMarkdownRenderer.htmlToPlainText(htmlContent);
          } catch (error) {
            console.error('aiFiverr: Error extracting plain text:', error);
            // Fallback to legacy extraction
            const actionsDiv = messageContent.querySelector('.chatbox-message-actions');
            const actionsHtml = actionsDiv ? actionsDiv.outerHTML : '';
            const contentHtml = messageContent.innerHTML.replace(actionsHtml, '');
            textToCopy = this.extractPlainTextFromHtml(contentHtml);
          }
        } else {
          // Fallback to legacy extraction
          const actionsDiv = messageContent.querySelector('.chatbox-message-actions');
          const actionsHtml = actionsDiv ? actionsDiv.outerHTML : '';
          const contentHtml = messageContent.innerHTML.replace(actionsHtml, '');
          textToCopy = this.extractPlainTextFromHtml(contentHtml);
        }
      }

      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showCopyFeedback(button, copyType);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    }
  }

  /**
   * Edit message inline (similar to AI result popup behavior)
   */
  editMessage(button) {
    const messageContent = button.closest('.chatbox-message-content');
    const messageDiv = button.closest('.chatbox-message');

    // Check if already in edit mode
    const existingTextarea = messageContent.querySelector('.chat-edit-textarea');
    if (existingTextarea) {
      // Switch back to view mode
      this.exitEditMode(messageContent, button);
      return;
    }

    // Add editing class for proper width
    messageContent.classList.add('editing');

    // Get the current content for editing (extract plain text with full URLs)
    const currentHtml = messageContent.innerHTML;
    const actionsDiv = messageContent.querySelector('.chatbox-message-actions');
    const actionsHtml = actionsDiv ? actionsDiv.outerHTML : '';
    const contentHtml = currentHtml.replace(actionsHtml, '');

    // Use original markdown text for editing (this is the key fix!)
    let markdownText;
    if (messageContent.dataset.originalMarkdown) {
      markdownText = messageContent.dataset.originalMarkdown;
    } else {
      // Fallback: try to extract markdown, but this won't be perfect
      markdownText = this.extractPlainTextFromHtml(contentHtml);
      console.warn('aiFiverr: No original markdown found, using extracted text');
    }

    // Create textarea for editing with original markdown
    const textarea = document.createElement('textarea');
    textarea.className = 'chat-edit-textarea';
    textarea.value = markdownText;
    textarea.style.cssText = `
      width: 100%;
      height: auto;
      min-height: 60px;
      max-height: 200px;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.4;
      resize: vertical;
      background: #f9fafb;
      box-sizing: border-box;
      display: block;
      flex: none;
    `;

    // Store original content
    messageContent.dataset.originalContent = contentHtml;

    // Replace content with textarea
    messageContent.innerHTML = '';
    messageContent.appendChild(textarea);
    messageContent.appendChild(actionsDiv);

    // Update button text
    button.innerHTML = '👁️ View';
    button.title = 'View formatted text';

    // Auto-resize and focus
    this.autoResizeTextarea(textarea);
    setTimeout(() => textarea.focus(), 10);

    // Add input listener for auto-resize
    textarea.addEventListener('input', () => {
      this.autoResizeTextarea(textarea);
    });
  }

  /**
   * Exit edit mode and return to view mode
   */
  exitEditMode(messageContent, button) {
    const textarea = messageContent.querySelector('.chat-edit-textarea');
    const actionsDiv = messageContent.querySelector('.chatbox-message-actions');

    if (!textarea) return;

    // Remove editing class
    messageContent.classList.remove('editing');

    // Get edited content
    const editedText = textarea.value;

    // Store the original markdown for future edits
    messageContent.dataset.originalMarkdown = editedText;

    // Format the edited content
    const formattedContent = this.formatMessage(editedText, { editMode: false });

    // Restore content
    messageContent.innerHTML = formattedContent;
    if (actionsDiv) {
      messageContent.appendChild(actionsDiv);
    }

    // Update button text
    button.innerHTML = '✏️ Edit';
    button.title = 'Edit text';
  }

  /**
   * Show copy feedback with appropriate message
   */
  showCopyFeedback(button, copyType) {
    const originalContent = button.innerHTML;
    const message = copyType === 'markdown' ? '✅ MD' : '✅ TXT';

    button.innerHTML = message;
    setTimeout(() => {
      button.innerHTML = originalContent;
    }, 2000);
  }

  /**
   * Extract plain text from HTML content for editing
   */
  extractPlainTextFromHtml(htmlContent) {
    if (!htmlContent) return '';

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Replace links with their original URLs
    const links = tempDiv.querySelectorAll('a[data-original-url]');
    links.forEach(link => {
      const originalUrl = link.getAttribute('data-original-url');
      const linkText = link.textContent;

      // Check if this was a markdown link or auto-detected URL
      if (link.classList.contains('chat-auto-link')) {
        // For auto-detected URLs, just use the URL
        link.replaceWith(document.createTextNode(originalUrl));
      } else {
        // For markdown links, restore the markdown format
        link.replaceWith(document.createTextNode(`[${linkText}](${originalUrl})`));
      }
    });

    // Get plain text and clean up formatting
    let plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Convert <br> tags to newlines
    plainText = plainText.replace(/<br\s*\/?>/gi, '\n');

    // Remove extra whitespace but preserve line breaks
    plainText = plainText.replace(/[ \t]+/g, ' ').trim();

    return plainText;
  }

  /**
   * Auto-resize textarea
   */
  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
  }

  /**
   * Insert message into active text field with original URLs
   */
  insertMessage(button) {
    const messageContent = button.closest('.chatbox-message-content');

    // Get text to insert (with original URLs)
    let textToInsert;
    const textarea = messageContent.querySelector('.chat-edit-textarea');
    if (textarea) {
      // In edit mode, use the raw text
      textToInsert = textarea.value;
    } else {
      // In view mode, extract plain text with original URLs
      const actionsDiv = messageContent.querySelector('.chatbox-message-actions');
      const actionsHtml = actionsDiv ? actionsDiv.outerHTML : '';
      const contentHtml = messageContent.innerHTML.replace(actionsHtml, '');
      textToInsert = this.extractPlainTextFromHtml(contentHtml);
    }

    // Try to insert into the currently focused text field
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const currentValue = activeElement.value;

      activeElement.value = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + textToInsert.length;
      activeElement.focus();

      button.textContent = '✅ Inserted';
      setTimeout(() => {
        button.innerHTML = '📝 Insert';
      }, 2000);
    } else {
      // Fallback: copy to clipboard
      this.copyMessage(button);
    }
  }

  /**
   * Update status message
   */
  updateStatus(message, type = '') {
    const statusElement = this.chatboxElement.querySelector('.chatbox-status');
    statusElement.textContent = message;
    statusElement.className = `chatbox-status ${type}`;
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Clear conversation
   */
  clearConversation() {
    this.conversationHistory = [];
    this.messagesContainer.innerHTML = '';
    this.updateStatus('Conversation cleared', 'success');
  }

  /**
   * Destroy the chatbox
   */
  destroy() {
    if (this.chatboxElement) {
      this.chatboxElement.remove();
    }
    
    // Remove styles if no other chatboxes exist
    const existingChatboxes = document.querySelectorAll('.aifiverr-streaming-chatbox');
    if (existingChatboxes.length === 0) {
      const styleElement = document.getElementById('aifiverr-streaming-chatbox-styles');
      if (styleElement) {
        styleElement.remove();
      }
    }
  }
}

// Export for use in other modules
window.StreamingChatbox = StreamingChatbox;
