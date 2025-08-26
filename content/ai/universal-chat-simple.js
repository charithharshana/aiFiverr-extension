/**
 * AI Assistance Chat Implementation
 * Advanced AI assistant with streaming support and conversation history
 * Replaces the old AI assistant with improved features and better integration
 */

class AIAssistanceChat {
  constructor() {
    this.isVisible = false;
    this.container = null;
    this.triggerButton = null;
    this.messages = [];
    this.isStreaming = false;
    this.apiKey = null;

    // DO NOT auto-initialize - wait for explicit call
    // this.init();
  }

  async init() {
    console.log('AI Assistance: Initializing...');

    // Check site restrictions first
    const shouldInitialize = await this.shouldInitializeOnCurrentSite();
    if (!shouldInitialize) {
      console.log('AI Assistance: Site restriction prevents initialization on this domain');
      return;
    }

    // Get API key
    await this.loadApiKey();

    // Initialize settings
    await this.initializeSettings();

    // Create UI
    this.createUI();

    // Set up events
    this.setupEvents();

    console.log('AI Assistance: Initialized successfully');
  }

  /**
   * Check if chat assistance should initialize on current site based on settings
   */
  async shouldInitializeOnCurrentSite() {
    try {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.warn('AI Assistance: Extension context invalidated, cannot check site restrictions');
        return false;
      }

      // Get settings from storage
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};

      // Default to restricting to Fiverr only (restrictToFiverr: true)
      const restrictToFiverr = settings.restrictToFiverr !== false;

      console.log('AI Assistance: Site restriction check:', {
        restrictToFiverr,
        currentHostname: window.location.hostname,
        isFiverrPage: window.location.hostname.includes('fiverr.com'),
        settingsRaw: settings
      });

      if (restrictToFiverr) {
        // Only initialize on Fiverr pages
        return window.location.hostname.includes('fiverr.com');
      } else {
        // Initialize on all sites
        return true;
      }
    } catch (error) {
      console.error('AI Assistance: Error checking site restriction settings:', error);
      // Default to Fiverr only if there's an error
      return window.location.hostname.includes('fiverr.com');
    }
  }

  async loadApiKey() {
    try {
      // Wait for extension initialization
      await this.waitForExtensionInit();

      // Try to get from existing API key manager
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        const keyData = window.apiKeyManager.getKeyForSession('default');
        if (keyData && keyData.key) {
          this.apiKey = keyData.key;
          console.log('AI Assistance: API key loaded from key manager');
          return;
        }
      }

      // Try to get from storage manager
      if (window.storageManager) {
        const settings = await window.storageManager.getSettings();
        if (settings && settings.apiKeys && settings.apiKeys.length > 0) {
          this.apiKey = settings.apiKeys[0]; // Use first available key
          console.log('AI Assistance: API key loaded from settings');
          return;
        }
      }

      // Try Chrome storage for direct API key
      if (chrome.storage) {
        const result = await chrome.storage.local.get(['GOOGLE_API_KEY', 'apiKeys']);

        // Check for direct Google API key
        if (result.GOOGLE_API_KEY) {
          this.apiKey = result.GOOGLE_API_KEY;
          console.log('AI Assistance: API key loaded from direct storage');
          return;
        }

        // Check for API keys array
        if (result.apiKeys && result.apiKeys.length > 0) {
          this.apiKey = result.apiKeys[0];
          console.log('AI Assistance: API key loaded from apiKeys array');
          return;
        }
      }

      // Try localStorage as fallback
      const localKey = localStorage.getItem('GOOGLE_API_KEY');
      if (localKey) {
        this.apiKey = localKey;
        console.log('AI Assistance: API key loaded from localStorage');
        return;
      }

      console.warn('AI Assistance: No API key found in any storage location');
    } catch (error) {
      console.error('AI Assistance: Failed to load API key:', error);
    }
  }

  async waitForExtensionInit() {
    // Wait for extension components to initialize
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    while (attempts < maxAttempts) {
      if (window.storageManager || window.apiKeyManager) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  createUI() {
    // Remove old UI if exists
    const existing = document.getElementById('ai-assistance-container');
    if (existing) existing.remove();

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'ai-assistance-container';
    this.container.innerHTML = `
      <div class="ai-assistance-window" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 500px;
        height: 700px;
        background: #ffffff;
        border: 1px solid #e1e5e9;
        border-radius: 16px;
        display: none;
        flex-direction: column;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
      ">
        <div class="chat-header" style="
          background: #ffffff;
          padding: 16px 20px;
          border-bottom: 1px solid #e1e5e9;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; color: #1dbf73; font-size: 18px; font-weight: 600;">AI Assistant</h3>
          <div style="display: flex; gap: 8px;">
            <button class="clear-btn" style="
              background: none;
              border: none;
              color: #6c757d;
              cursor: pointer;
              font-size: 16px;
              padding: 6px;
              border-radius: 6px;
              transition: background-color 0.2s;
            " title="Clear chat">🗑️</button>
            <button class="close-btn" style="
              background: none;
              border: none;
              color: #6c757d;
              cursor: pointer;
              font-size: 20px;
              padding: 6px;
              border-radius: 6px;
              transition: background-color 0.2s;
            ">×</button>
          </div>
        </div>
        
        <div class="messages-container" style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #ffffff;
          max-height: 530px;
        ">
          <div class="welcome-message" style="
            background: #f8f9fa;
            padding: 16px;
            border-radius: 12px;
            color: #495057;
            margin-bottom: 20px;
            border: 1px solid #e9ecef;
          ">
            Welcome to AI Assistance!
          </div>
        </div>

        <!-- Prompt Management Panel -->
        <div class="prompt-panel" style="
          display: none;
          background: #f8f9fa;
          border-top: 1px solid #e1e5e9;
          padding: 16px 20px;
          max-height: 200px;
          overflow-y: auto;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: #495057; font-size: 14px; font-weight: 600;">Quick Prompts</h4>
            <button class="add-prompt-btn" style="
              background: #1dbf73;
              border: none;
              border-radius: 6px;
              color: white;
              cursor: pointer;
              padding: 4px 8px;
              font-size: 12px;
            ">+ Add</button>
          </div>
          <div class="prompt-list"></div>
        </div>

        <div class="input-container" style="
          padding: 20px;
          background: #ffffff;
          border-top: 1px solid #e1e5e9;
          border-radius: 0 0 16px 16px;
        ">
          <div style="display: flex; gap: 12px; align-items: flex-end;">
            <div style="flex: 1;">
              <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="prompts-btn" style="
                  background: #f8f9fa;
                  border: 1px solid #e1e5e9;
                  border-radius: 6px;
                  color: #495057;
                  cursor: pointer;
                  padding: 6px 10px;
                  font-size: 12px;
                  transition: all 0.2s;
                " title="Quick Prompts">📝</button>
                <button class="attach-btn" style="
                  background: #f8f9fa;
                  border: 1px solid #e1e5e9;
                  border-radius: 6px;
                  color: #495057;
                  cursor: pointer;
                  padding: 6px 10px;
                  font-size: 12px;
                  transition: all 0.2s;
                " title="Attach File">📎</button>
                <button class="settings-btn" style="
                  background: #f8f9fa;
                  border: 1px solid #e1e5e9;
                  border-radius: 6px;
                  color: #495057;
                  cursor: pointer;
                  padding: 6px 10px;
                  font-size: 12px;
                  transition: all 0.2s;
                " title="Settings">⚙️</button>
                <button class="abort-btn" style="
                  background: #dc3545;
                  border: 1px solid #dc3545;
                  border-radius: 6px;
                  color: white;
                  cursor: pointer;
                  padding: 6px 10px;
                  font-size: 12px;
                  transition: all 0.2s;
                  display: none;
                " title="Stop Generation">⏹️</button>
              </div>
              <textarea class="message-input" placeholder="Type your message..." style="
                width: 100%;
                background: #ffffff;
                border: 2px solid #e1e5e9;
                border-radius: 12px;
                padding: 12px 16px;
                color: #495057;
                font-size: 14px;
                resize: none;
                min-height: 20px;
                max-height: 120px;
                font-family: inherit;
                transition: border-color 0.2s;
                box-sizing: border-box;
              "></textarea>
            </div>
            <button class="send-btn" style="
              background: #1dbf73;
              border: none;
              border-radius: 12px;
              color: white;
              cursor: pointer;
              padding: 12px 16px;
              font-size: 16px;
              transition: background-color 0.2s;
              min-width: 48px;
              height: 48px;
            ">➤</button>
          </div>
        </div>
      </div>
    `;

    // Create trigger button - styled like message box icon
    this.triggerButton = document.createElement('button');
    this.triggerButton.innerHTML = '💬';
    this.triggerButton.title = 'AI Assistance';
    this.triggerButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      opacity: 0.7;
      z-index: 9999;
    `;

    // Add hover effects for trigger button
    this.triggerButton.addEventListener('mouseenter', () => {
      this.triggerButton.style.opacity = '1';
      this.triggerButton.style.transform = 'scale(1.1)';
    });

    this.triggerButton.addEventListener('mouseleave', () => {
      this.triggerButton.style.opacity = '0.7';
      this.triggerButton.style.transform = 'scale(1)';
    });

    document.body.appendChild(this.container);
    document.body.appendChild(this.triggerButton);
  }

  setupEvents() {
    // Trigger button
    this.triggerButton.addEventListener('click', () => this.toggle());

    // Close button
    const closeBtn = this.container.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => this.hide());

    // Clear button
    const clearBtn = this.container.querySelector('.clear-btn');
    clearBtn.addEventListener('click', () => this.clearChat());

    // Send button
    const sendBtn = this.container.querySelector('.send-btn');
    sendBtn.addEventListener('click', () => this.sendMessage());

    // Trigger button
    this.triggerButton.addEventListener('click', () => this.show());

    // Prompts button
    const promptsBtn = this.container.querySelector('.prompts-btn');
    promptsBtn.addEventListener('click', () => this.togglePromptPanel());

    // Attach button
    const attachBtn = this.container.querySelector('.attach-btn');
    attachBtn.addEventListener('click', () => this.handleFileAttachment());

    // Settings button
    const settingsBtn = this.container.querySelector('.settings-btn');
    settingsBtn.addEventListener('click', () => this.showModelSettings());

    // Add prompt button
    const addPromptBtn = this.container.querySelector('.add-prompt-btn');
    addPromptBtn.addEventListener('click', () => this.addNewPrompt());

    // Abort button
    const abortBtn = this.container.querySelector('.abort-btn');
    abortBtn.addEventListener('click', () => this.abortRequest());

    // Enter key
    const input = this.container.querySelector('.message-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Focus styling
    input.addEventListener('focus', () => {
      input.style.borderColor = '#007bff';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = '#e1e5e9';
    });
  }

  async sendMessage() {
    const input = this.container.querySelector('.message-input');
    const message = input.value.trim();

    if (!message || this.isStreaming) return;

    // Try to reload API key if not available
    if (!this.apiKey) {
      await this.loadApiKey();
    }

    if (!this.apiKey) {
      this.addMessage('system', 'No API key found. Please set your Google API key in the extension settings and refresh the page.');
      return;
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message
    this.addMessage('user', message);

    // Add loading message
    const loadingId = this.addMessage('assistant', 'Thinking...');

    // Try enhanced streaming first
    try {
      if (!window.enhancedGeminiClient) {
        initializeEnhancedGeminiClient();
      }

      await this.sendMessageWithEnhancedStreaming(message, loadingId);
      return;
    } catch (error) {
      console.log('aiFiverr: Enhanced streaming failed, falling back to regular:', error);
    }

    try {
      this.isStreaming = true;

      // Show abort button
      const abortBtn = this.container.querySelector('.abort-btn');
      abortBtn.style.display = 'block';

      // Add abort controller for request cancellation
      this.currentAbortController = new AbortController();

      // Prepare message with attached files
      const messageWithFiles = await this.prepareMessageWithFiles(message);

      // Call Gemini API with streaming
      await this.callGeminiAPIStreaming(messageWithFiles, loadingId);

      // Clear attached files after sending
      if (this.attachedFiles && this.attachedFiles.length > 0) {
        this.attachedFiles = [];
        this.displayAttachedFiles([]);
      }

    } catch (error) {
      console.error('AI Assistance: Chat error:', error);
      let errorMessage = 'Sorry, I encountered an error. Please try again.';

      if (error.name === 'AbortError') {
        errorMessage = 'Request was cancelled.';
      } else if (error.message.includes('API key')) {
        errorMessage = 'API key issue. Please check your settings and try again.';
      } else if (error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please try again later or check your API key.';
      }

      this.updateMessage(loadingId, errorMessage);
    } finally {
      this.isStreaming = false;
      this.currentAbortController = null;

      // Hide abort button
      const abortBtn = this.container.querySelector('.abort-btn');
      abortBtn.style.display = 'none';
    }
  }

  async callGeminiAPI(message) {
    // Build conversation history for context
    const contents = [];

    // Add conversation history (last 10 messages for context)
    const recentMessages = this.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Prepare parts for current message
    const currentMessageParts = [{ text: message }];

    // Add knowledge base files if available - prioritize attached files
    let knowledgeBaseFiles = [];

    // PRIORITY 1: Use specifically attached files if any
    if (this.attachedFiles && this.attachedFiles.length > 0) {
      console.log('aiFiverr Fallback Non-Streaming: Using attached files:', this.attachedFiles);
      try {
        const attachedFileDetails = await this.getAttachedFileDetails(this.attachedFiles);
        knowledgeBaseFiles = attachedFileDetails
          .filter(file => file.geminiUri)
          .map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            geminiUri: file.geminiUri,
            size: file.size
          }));
        console.log('aiFiverr Fallback Non-Streaming: Using', knowledgeBaseFiles.length, 'attached files with geminiUri');
      } catch (error) {
        console.error('aiFiverr Fallback Non-Streaming: Failed to get attached files:', error);
      }
    }

    // PRIORITY 2: If no attached files, use all knowledge base files
    if (knowledgeBaseFiles.length === 0 && window.knowledgeBaseManager) {
      try {
        const allFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
        knowledgeBaseFiles = allFiles.filter(file => file.geminiUri);
        console.log('aiFiverr Fallback Non-Streaming: Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');

        // Add file parts to current message
        knowledgeBaseFiles.forEach(file => {
          let safeMimeType = file.mimeType || 'text/plain';

          // FORCE OVERRIDE - NEVER ALLOW application/octet-stream
          if (safeMimeType === 'application/octet-stream') {
            console.error('🚨🚨🚨 EMERGENCY OVERRIDE: Found application/octet-stream, forcing to text/plain');
            console.error('🚨 File object:', JSON.stringify(file, null, 2));
            safeMimeType = 'text/plain';
          }

          console.log('🚨 aiFiverr Fallback Non-Streaming: Adding file to request:', file.name, file.geminiUri, 'FINAL MIME:', safeMimeType);

          const fileDataPart = {
            fileData: {
              mimeType: safeMimeType,
              fileUri: file.geminiUri
            }
          };

          console.log('🚨 FILE DATA PART:', JSON.stringify(fileDataPart, null, 2));
          currentMessageParts.push(fileDataPart);
        });
      } catch (error) {
        console.warn('aiFiverr Fallback Non-Streaming: Failed to get knowledge base files:', error);
      }
    }

    // Add current message with files
    contents.push({
      role: 'user',
      parts: currentMessageParts
    });

    // Get model from settings or use fallback
    const modelName = await this.getCurrentModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: contents,
      generationConfig: {
        temperature: this.modelSettings?.temperature || 0.7,
        maxOutputTokens: this.modelSettings?.maxTokens || 4096,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('aiFiverr Fallback Non-Streaming: API request with', knowledgeBaseFiles.length, 'knowledge base files');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(`API Error: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No valid response generated. Please try again.');
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // Store message in history
    this.messages.push({ role: 'user', content: message });
    this.messages.push({ role: 'assistant', content: responseText });

    return responseText;
  }

  async callGeminiAPIStreaming(message, messageId) {
    // Build conversation history for context
    const contents = [];

    // Add system prompt if available
    if (this.modelSettings?.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${this.modelSettings.systemPrompt}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I will follow these instructions.' }]
      });
    }

    // Add conversation history (last 10 messages for context)
    const recentMessages = this.messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Prepare parts for current message
    const currentMessageParts = [{ text: message }];

    // Add knowledge base files if available - prioritize attached files
    let knowledgeBaseFiles = [];

    // PRIORITY 1: Use specifically attached files if any
    if (this.attachedFiles && this.attachedFiles.length > 0) {
      console.log('aiFiverr Fallback: Using attached files:', this.attachedFiles);
      try {
        const attachedFileDetails = await this.getAttachedFileDetails(this.attachedFiles);
        knowledgeBaseFiles = attachedFileDetails
          .filter(file => file.geminiUri)
          .map(file => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            geminiUri: file.geminiUri,
            size: file.size
          }));
        console.log('aiFiverr Fallback: Using', knowledgeBaseFiles.length, 'attached files with geminiUri');
      } catch (error) {
        console.error('aiFiverr Fallback: Failed to get attached files:', error);
      }
    }

    // PRIORITY 2: If no attached files, use all knowledge base files
    if (knowledgeBaseFiles.length === 0 && window.knowledgeBaseManager) {
      try {
        const allFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
        knowledgeBaseFiles = allFiles.filter(file => file.geminiUri);
        console.log('aiFiverr Fallback: Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');

        // Add file parts to current message
        knowledgeBaseFiles.forEach(file => {
          let safeMimeType = file.mimeType || 'text/plain';

          // FORCE OVERRIDE - NEVER ALLOW application/octet-stream
          if (safeMimeType === 'application/octet-stream') {
            console.error('🚨🚨🚨 EMERGENCY OVERRIDE: Found application/octet-stream, forcing to text/plain');
            console.error('🚨 File object:', JSON.stringify(file, null, 2));
            safeMimeType = 'text/plain';
          }

          console.log('🚨 aiFiverr Fallback: Adding file to request:', file.name, file.geminiUri, 'FINAL MIME:', safeMimeType);

          const fileDataPart = {
            fileData: {
              mimeType: safeMimeType,
              fileUri: file.geminiUri
            }
          };

          console.log('🚨 FILE DATA PART:', JSON.stringify(fileDataPart, null, 2));
          currentMessageParts.push(fileDataPart);
        });
      } catch (error) {
        console.warn('aiFiverr Fallback: Failed to get knowledge base files:', error);
      }
    }

    // Add current message with files
    contents.push({
      role: 'user',
      parts: currentMessageParts
    });

    // Get model from settings or use fallback
    const modelName = await this.getCurrentModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}`;

    const body = {
      contents: contents,
      generationConfig: {
        temperature: this.modelSettings?.temperature || 0.7,
        maxOutputTokens: this.modelSettings?.maxTokens || 4096,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('aiFiverr Fallback: API request with', knowledgeBaseFiles.length, 'knowledge base files');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: this.currentAbortController?.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(`API Error: ${errorMessage}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const newText = data.candidates[0].content.parts[0].text;
                fullResponse += newText;
                this.updateMessage(messageId, fullResponse);
              }

              // Track token usage
              if (data.usageMetadata) {
                inputTokens = data.usageMetadata.promptTokenCount || 0;
                outputTokens = data.usageMetadata.candidatesTokenCount || 0;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Store message in history
    this.messages.push({ role: 'user', content: message });
    this.messages.push({ role: 'assistant', content: fullResponse });

    // Add token usage info
    if (inputTokens > 0 || outputTokens > 0) {
      this.addTokenUsageInfo(inputTokens, outputTokens);
    }

    return fullResponse;
  }

  addTokenUsageInfo(inputTokens, outputTokens) {
    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(inputTokens, outputTokens);

    const usageDiv = document.createElement('div');
    usageDiv.style.cssText = `
      margin: 8px 20px;
      padding: 8px 12px;
      background: #e3f2fd;
      border: 1px solid #bbdefb;
      border-radius: 8px;
      font-size: 11px;
      color: #1565c0;
      text-align: center;
    `;

    usageDiv.innerHTML = `
      📊 Tokens: ${inputTokens} in + ${outputTokens} out = ${totalTokens} total |
      💰 Cost: ~$${cost.toFixed(6)}
    `;

    const messagesContainer = this.container.querySelector('.messages-container');
    messagesContainer.appendChild(usageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  calculateCost(inputTokens, outputTokens) {
    // Gemini pricing (approximate)
    const inputCostPer1K = 0.00015; // $0.00015 per 1K input tokens
    const outputCostPer1K = 0.0006; // $0.0006 per 1K output tokens

    const inputCost = (inputTokens / 1000) * inputCostPer1K;
    const outputCost = (outputTokens / 1000) * outputCostPer1K;

    return inputCost + outputCost;
  }

  // Abort current request
  abortRequest() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.addMessage('system', 'Request cancelled.');
    }
  }

  addMessage(role, content) {
    const messagesContainer = this.container.querySelector('.messages-container');
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.style.cssText = `
      margin-bottom: 16px;
      padding: 16px;
      border-radius: 12px;
      ${role === 'user' ?
        'background: #1dbf73; color: #fff; margin-left: 20%; border: 1px solid #19a463;' :
        role === 'system' ?
        'background: #f8f9fa; color: #6c757d; border: 1px solid #e9ecef;' :
        'background: #ffffff; color: #333; border: 1px solid #e1e5e9; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'
      }
    `;

    const copyMessageHandler = (e) => {
      e.preventDefault();
      const messageWrapper = e.currentTarget.closest('.message-wrapper');
      const messageContent = messageWrapper.querySelector('.message-content');
      const textContent = messageContent.textContent || messageContent.innerText;

      navigator.clipboard.writeText(textContent).then(() => {
        // Show copy status
        this.showCopyStatus(messageWrapper);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    };

    messageDiv.innerHTML = `
      <div class="message-wrapper">
        <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">${role === 'user' ? 'You' : role === 'system' ? 'System' : 'AI Assistant'}</span>
          ${role !== 'system' ? `
            <div class="copy-status" style="font-size: 11px; color: #28a745; opacity: 0; transition: opacity 0.3s;">
              Copied!
            </div>
          ` : ''}
        </div>
        <div class="message-content" style="line-height: 1.5; cursor: pointer;" title="Click to copy message">${this.formatMessage(content)}</div>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);

    // Add click to copy functionality for message content
    const messageContent = messageDiv.querySelector('.message-content');
    if (messageContent && role !== 'system') {
      messageContent.addEventListener('click', copyMessageHandler);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
  }

  showCopyStatus(messageWrapper) {
    const copyStatus = messageWrapper.querySelector('.copy-status');
    if (copyStatus) {
      copyStatus.style.opacity = '1';
      setTimeout(() => {
        copyStatus.style.opacity = '0';
      }, 2000);
    }
  }

  updateMessage(messageId, content) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
      const contentDiv = messageDiv.querySelector('.message-content');
      contentDiv.innerHTML = this.formatMessage(content);
    }
  }

  formatMessage(content) {
    // First, handle JSON and XML parsing
    content = this.parseStructuredData(content);

    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: #f8f9fa; color: #e83e8c; padding: 2px 6px; border-radius: 4px; border: 1px solid #e9ecef;">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre style="background: #f8f9fa; padding: 12px; border-radius: 8px; overflow-x: auto; border: 1px solid #e9ecef; margin: 8px 0;"><code style="color: #495057;">$1</code></pre>');
  }

  parseStructuredData(content) {
    // JSON Parser
    content = content.replace(/```json\n([\s\S]*?)\n```/g, (match, jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr);
        const formatted = JSON.stringify(parsed, null, 2);
        return `<div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 8px 0; overflow: hidden;">
          <div style="background: #e9ecef; padding: 8px 12px; font-weight: 600; color: #495057; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            📄 JSON Data
            <button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)" style="background: #007bff; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 6px; font-size: 10px;">Copy</button>
          </div>
          <pre style="margin: 0; padding: 12px; overflow-x: auto; background: #ffffff;"><code style="color: #495057;">${formatted}</code></pre>
        </div>`;
      } catch (e) {
        return match; // Return original if parsing fails
      }
    });

    // XML Parser
    content = content.replace(/```xml\n([\s\S]*?)\n```/g, (match, xmlStr) => {
      try {
        // Basic XML formatting
        const formatted = xmlStr
          .replace(/></g, '>\n<')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map((line, index, arr) => {
            const depth = line.split('<').length - line.split('</').length;
            const indent = '  '.repeat(Math.max(0, index - depth));
            return indent + line;
          })
          .join('\n');

        return `<div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 8px 0; overflow: hidden;">
          <div style="background: #e9ecef; padding: 8px 12px; font-weight: 600; color: #495057; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            🏷️ XML Data
            <button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)" style="background: #007bff; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 6px; font-size: 10px;">Copy</button>
          </div>
          <pre style="margin: 0; padding: 12px; overflow-x: auto; background: #ffffff;"><code style="color: #495057;">${formatted}</code></pre>
        </div>`;
      } catch (e) {
        return match; // Return original if parsing fails
      }
    });

    return content;
  }



  clearChat() {
    const messagesContainer = this.container.querySelector('.messages-container');
    messagesContainer.innerHTML = '';
    this.messages = [];
  }

  show() {
    this.isVisible = true;
    this.container.querySelector('.ai-assistance-window').style.display = 'flex';
    this.triggerButton.style.display = 'none';

    // Focus input
    setTimeout(() => {
      this.container.querySelector('.message-input').focus();
    }, 100);
  }

  hide() {
    this.isVisible = false;
    this.container.querySelector('.ai-assistance-window').style.display = 'none';
    this.triggerButton.style.display = 'block';
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // Prompt Management System
  togglePromptPanel() {
    const promptPanel = this.container.querySelector('.prompt-panel');
    const isVisible = promptPanel.style.display !== 'none';
    promptPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      this.loadPrompts();
    }
  }

  async loadPrompts() {
    try {
      const result = await chrome.storage.local.get('aiAssistancePrompts');
      this.prompts = result.aiAssistancePrompts || [];
      this.renderPrompts();
    } catch (error) {
      console.error('Failed to load prompts:', error);
      this.prompts = [];
    }
  }

  renderPrompts() {
    const promptList = this.container.querySelector('.prompt-list');
    promptList.innerHTML = '';

    this.prompts.forEach((prompt, index) => {
      const promptDiv = document.createElement('div');
      promptDiv.style.cssText = `
        background: #ffffff;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      promptDiv.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 12px; color: #495057; margin-bottom: 2px;">${prompt.title}</div>
          <div style="font-size: 11px; color: #6c757d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${prompt.content}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="use-prompt-btn" style="background: #007bff; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 6px; font-size: 10px;">Use</button>
          <button class="edit-prompt-btn" style="background: #6c757d; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 6px; font-size: 10px;">Edit</button>
          <button class="delete-prompt-btn" style="background: #dc3545; border: none; border-radius: 4px; color: white; cursor: pointer; padding: 2px 6px; font-size: 10px;">×</button>
        </div>
      `;

      // Event listeners
      promptDiv.querySelector('.use-prompt-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.usePrompt(prompt.content);
      });

      promptDiv.querySelector('.edit-prompt-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.editPrompt(index);
      });

      promptDiv.querySelector('.delete-prompt-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePrompt(index);
      });

      promptList.appendChild(promptDiv);
    });
  }

  usePrompt(content) {
    const input = this.container.querySelector('.message-input');
    input.value = content;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    this.togglePromptPanel(); // Close panel
  }

  async addNewPrompt() {
    const title = prompt('Enter prompt title:');
    if (!title) return;

    const content = prompt('Enter prompt content:');
    if (!content) return;

    this.prompts.push({ title, content });
    await this.savePrompts();
    this.renderPrompts();
  }

  async editPrompt(index) {
    const prompt = this.prompts[index];
    const newTitle = window.prompt('Edit prompt title:', prompt.title);
    if (newTitle === null) return;

    const newContent = window.prompt('Edit prompt content:', prompt.content);
    if (newContent === null) return;

    this.prompts[index] = { title: newTitle, content: newContent };
    await this.savePrompts();
    this.renderPrompts();
  }

  async deletePrompt(index) {
    if (confirm('Delete this prompt?')) {
      this.prompts.splice(index, 1);
      await this.savePrompts();
      this.renderPrompts();
    }
  }

  async savePrompts() {
    try {
      await chrome.storage.local.set({ aiAssistancePrompts: this.prompts });
    } catch (error) {
      console.error('Failed to save prompts:', error);
    }
  }

  // File Attachment System
  handleFileAttachment() {
    // Show file attachment options
    this.showFileAttachmentOptions();
  }

  showFileAttachmentOptions() {
    const modal = document.createElement('div');
    modal.className = 'file-attachment-modal-overlay';
    modal.innerHTML = `
      <div class="file-attachment-modal">
        <div class="file-attachment-header">
          <h4>Attach Files</h4>
          <button class="file-attachment-close">×</button>
        </div>
        <div class="file-attachment-body">
          <div class="attachment-options">
            <button class="attachment-option" data-type="knowledge-base">
              <div class="option-icon">📚</div>
              <div class="option-info">
                <div class="option-title">Knowledge Base Files</div>
                <div class="option-desc">Select from uploaded knowledge base files</div>
              </div>
            </button>
            <button class="attachment-option" data-type="upload-new">
              <div class="option-icon">📁</div>
              <div class="option-info">
                <div class="option-title">Upload New Files</div>
                <div class="option-desc">Upload and attach new files</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .file-attachment-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .file-attachment-modal {
        background: white;
        border-radius: 8px;
        width: 400px;
        max-width: 90vw;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      }
      .file-attachment-header {
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .file-attachment-header h4 {
        margin: 0;
        color: #2c3e50;
      }
      .file-attachment-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6c757d;
      }
      .file-attachment-body {
        padding: 20px;
      }
      .attachment-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .attachment-option {
        display: flex;
        align-items: center;
        padding: 15px;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }
      .attachment-option:hover {
        border-color: #1dbf73;
        background: rgba(29, 191, 115, 0.05);
      }
      .option-icon {
        font-size: 24px;
        margin-right: 15px;
      }
      .option-info {
        flex: 1;
      }
      .option-title {
        font-weight: 500;
        color: #2c3e50;
        margin-bottom: 4px;
      }
      .option-desc {
        font-size: 13px;
        color: #6c757d;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.file-attachment-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(style);
      }
    });

    modal.querySelectorAll('.attachment-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.type;
        document.body.removeChild(modal);
        document.head.removeChild(style);

        if (type === 'knowledge-base') {
          this.showKnowledgeBaseFileSelector();
        } else if (type === 'upload-new') {
          this.showFileUploader();
        }
      });
    });
  }

  async showKnowledgeBaseFileSelector() {
    try {
      // Get knowledge base files
      const files = await this.getKnowledgeBaseFiles();

      if (!files || files.length === 0) {
        this.showToast('No knowledge base files available. Please upload files first.', 'warning');
        return;
      }

      this.displayFileSelector(files);
    } catch (error) {
      console.error('Failed to load knowledge base files:', error);
      this.showToast('Failed to load knowledge base files', 'error');
    }
  }

  showFileUploader() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.multiple = true;

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => this.processFile(file));
    };

    input.click();
  }

  async processFile(file) {
    try {
      const text = await this.readFileAsText(file);
      const messageInput = this.container.querySelector('.message-input');
      const currentValue = messageInput.value;
      const fileContent = `\n\n[File: ${file.name}]\n${text}\n[End of ${file.name}]\n\n`;
      messageInput.value = currentValue + fileContent;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

      this.addMessage('system', `File attached: ${file.name} (${file.size} bytes)`);
    } catch (error) {
      this.addMessage('system', `Failed to read file: ${file.name} - ${error.message}`);
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async prepareMessageWithFiles(message) {
    if (!this.attachedFiles || this.attachedFiles.length === 0) {
      return message;
    }

    try {
      // Get file details for attached files (fast - just metadata)
      const fileDetails = await this.getAttachedFileDetails(this.attachedFiles);

      // Filter files that have Gemini URIs (ready for AI processing)
      const readyFiles = fileDetails.filter(file => file.geminiUri);

      if (readyFiles.length > 0) {
        // Just mention attached files - the actual file content will be sent via Gemini URIs
        const fileContext = readyFiles.map(file => {
          return `📎 ${file.name} (${this.formatFileSize(file.size)})`;
        }).join(', ');

        return `${message}\n\n[Attached files: ${fileContext}]`;
      }

      return message;
    } catch (error) {
      console.error('Failed to prepare message with files:', error);
      return message;
    }
  }

  async getAttachedFileDetails(fileIds) {
    const fileDetails = [];

    for (const fileId of fileIds) {
      try {
        const details = await this.getFileDetails(fileId);
        fileDetails.push(details);
      } catch (error) {
        console.error(`Failed to get details for file ${fileId}:`, error);
      }
    }

    return fileDetails;
  }

  async getFileDetails(fileId) {
    try {
      // First get basic file details from Google Drive
      let fileDetails = null;
      if (window.googleDriveClient) {
        fileDetails = await window.googleDriveClient.getFileDetails(fileId);
      }

      // Then try to get geminiUri from knowledge base manager
      if (window.knowledgeBaseManager) {
        try {
          // Get all knowledge base files and find the one with matching ID
          const kbFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
          const kbFile = kbFiles.find(f => f.id === fileId || f.driveFileId === fileId);

          if (kbFile && kbFile.geminiUri) {
            console.log('aiFiverr: Found geminiUri for attached file:', fileId, kbFile.geminiUri);
            // Merge knowledge base data with Drive data
            fileDetails = {
              ...fileDetails,
              geminiUri: kbFile.geminiUri,
              geminiStatus: kbFile.geminiState || 'active',
              geminiName: kbFile.geminiName,
              // Use knowledge base data if Drive data is missing
              id: fileDetails?.id || kbFile.id || kbFile.driveFileId,
              name: fileDetails?.name || kbFile.name,
              mimeType: fileDetails?.mimeType || kbFile.mimeType,
              size: fileDetails?.size || kbFile.size
            };
          } else {
            console.warn('aiFiverr: No geminiUri found for attached file:', fileId);
          }
        } catch (kbError) {
          console.error('aiFiverr: Failed to get geminiUri from knowledge base:', kbError);
        }
      }

      if (!fileDetails) {
        throw new Error('Unable to get file details from any source');
      }

      return fileDetails;
    } catch (error) {
      console.error('Failed to get file details:', error);
      throw error;
    }
  }

  async getKnowledgeBaseFiles() {
    try {
      if (!window.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      const files = await window.googleDriveClient.listKnowledgeBaseFiles();
      return files || [];
    } catch (error) {
      console.error('Failed to get knowledge base files:', error);
      return [];
    }
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

  displayFileSelector(files) {
    const modal = document.createElement('div');
    modal.className = 'kb-file-selector-overlay';
    modal.innerHTML = `
      <div class="kb-file-selector-modal">
        <div class="kb-file-selector-header">
          <h4>Select Knowledge Base Files</h4>
          <button class="kb-file-selector-close">×</button>
        </div>
        <div class="kb-file-selector-body">
          <div class="kb-file-search">
            <input type="text" placeholder="Search files..." class="kb-file-search-input">
          </div>
          <div class="kb-file-list">
            ${files.map(file => `
              <div class="kb-file-item" data-file-id="${file.id}" data-file-name="${file.name}">
                <input type="checkbox" class="kb-file-checkbox" value="${file.id}">
                <div class="kb-file-info">
                  <div class="kb-file-name">${file.name}</div>
                  <div class="kb-file-meta">${this.formatFileSize(file.size)} • ${file.mimeType}</div>
                </div>
                <div class="kb-file-status">
                  <span class="status-indicator ${file.geminiStatus || 'not_uploaded'}" title="${file.geminiStatus || 'Not uploaded to Gemini'}"></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="kb-file-selector-footer">
          <div class="selected-count">0 files selected</div>
          <div class="selector-actions">
            <button class="btn-secondary" id="clearSelection">Clear All</button>
            <button class="btn-primary" id="attachSelected">Attach Selected</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .kb-file-selector-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .kb-file-selector-modal {
        background: white;
        border-radius: 8px;
        width: 500px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      }
      .kb-file-selector-header {
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .kb-file-selector-body {
        padding: 20px;
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .kb-file-search {
        margin-bottom: 15px;
      }
      .kb-file-search-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        font-size: 13px;
      }
      .kb-file-list {
        flex: 1;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        max-height: 300px;
      }
      .kb-file-item {
        display: flex;
        align-items: center;
        padding: 12px 15px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .kb-file-item:hover {
        background: #f8f9fa;
      }
      .kb-file-item.selected {
        background: rgba(29, 191, 115, 0.1);
      }
      .kb-file-checkbox {
        margin-right: 12px;
      }
      .kb-file-info {
        flex: 1;
      }
      .kb-file-name {
        font-weight: 500;
        color: #2c3e50;
        font-size: 13px;
        margin-bottom: 2px;
      }
      .kb-file-meta {
        font-size: 11px;
        color: #6c757d;
      }
      .kb-file-status {
        margin-left: 8px;
      }
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6c757d;
        display: inline-block;
      }
      .status-indicator.ACTIVE { background: #28a745; }
      .status-indicator.PROCESSING { background: #ffc107; }
      .status-indicator.FAILED { background: #dc3545; }
      .kb-file-selector-footer {
        padding: 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .selected-count {
        font-size: 13px;
        color: #6c757d;
      }
      .selector-actions {
        display: flex;
        gap: 8px;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);

    // Event listeners
    const selectedFiles = new Set();

    modal.querySelector('.kb-file-selector-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(style);
      }
    });

    // File selection
    modal.querySelectorAll('.kb-file-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const fileId = e.target.value;
        const item = e.target.closest('.kb-file-item');

        if (e.target.checked) {
          selectedFiles.add(fileId);
          item.classList.add('selected');
        } else {
          selectedFiles.delete(fileId);
          item.classList.remove('selected');
        }

        modal.querySelector('.selected-count').textContent = `${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''} selected`;
      });
    });

    // Clear selection
    modal.querySelector('#clearSelection').addEventListener('click', () => {
      selectedFiles.clear();
      modal.querySelectorAll('.kb-file-checkbox').forEach(cb => cb.checked = false);
      modal.querySelectorAll('.kb-file-item').forEach(item => item.classList.remove('selected'));
      modal.querySelector('.selected-count').textContent = '0 files selected';
    });

    // Attach selected files
    modal.querySelector('#attachSelected').addEventListener('click', async () => {
      if (selectedFiles.size === 0) {
        this.showToast('Please select at least one file', 'warning');
        return;
      }

      try {
        await this.attachKnowledgeBaseFiles(Array.from(selectedFiles));
        document.body.removeChild(modal);
        document.head.removeChild(style);
      } catch (error) {
        console.error('Failed to attach files:', error);
        this.showToast('Failed to attach files', 'error');
      }
    });

    // Search functionality
    const searchInput = modal.querySelector('.kb-file-search-input');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      modal.querySelectorAll('.kb-file-item').forEach(item => {
        const fileName = item.dataset.fileName.toLowerCase();
        item.style.display = fileName.includes(query) ? 'flex' : 'none';
      });
    });
  }

  async attachKnowledgeBaseFiles(fileIds) {
    try {
      // Store selected files for use in the next prompt (just the IDs for fast reference)
      this.attachedFiles = fileIds;

      // Show attached files in the UI with file names
      await this.displayAttachedFiles(fileIds);

      this.showToast(`${fileIds.length} file(s) attached for next prompt`, 'success');
    } catch (error) {
      console.error('Failed to attach files:', error);
      throw error;
    }
  }

  async displayAttachedFiles(fileIds) {
    // Create or update attached files display
    let attachedContainer = this.container.querySelector('.attached-files-container');

    if (!attachedContainer) {
      attachedContainer = document.createElement('div');
      attachedContainer.className = 'attached-files-container';

      const inputContainer = this.container.querySelector('.input-container');
      inputContainer.insertBefore(attachedContainer, inputContainer.firstChild);
    }

    if (fileIds.length === 0) {
      attachedContainer.style.display = 'none';
      return;
    }

    // Get file details for display (but don't process content)
    const fileDetails = await this.getAttachedFileDetails(fileIds);

    attachedContainer.style.display = 'block';
    attachedContainer.innerHTML = `
      <div class="attached-files-header">
        <span class="attached-files-title">📎 ${fileIds.length} file(s) attached</span>
        <button class="clear-attachments-btn" title="Clear all attachments">×</button>
      </div>
      <div class="attached-files-list">
        ${fileDetails.map(file => `
          <div class="attached-file-item" data-file-id="${file.id}">
            <span class="file-name">${file.name}</span>
            <span class="file-status ${file.geminiUri ? 'ready' : 'pending'}" title="${file.geminiUri ? 'Ready for AI' : 'Uploading to AI...'}">
              ${file.geminiUri ? '🟢' : '🟡'}
            </span>
            <button class="remove-attachment-btn" data-file-id="${file.id}">×</button>
          </div>
        `).join('')}
      </div>
    `;

    // Add styles if not already added
    if (!document.querySelector('#attached-files-styles')) {
      const style = document.createElement('style');
      style.id = 'attached-files-styles';
      style.textContent = `
        .attached-files-container {
          margin-bottom: 10px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        .attached-files-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .attached-files-title {
          font-size: 12px;
          color: #6c757d;
          font-weight: 500;
        }
        .clear-attachments-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          font-size: 16px;
          padding: 2px;
        }
        .attached-files-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .attached-file-item {
          display: flex;
          align-items: center;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
        }
        .file-name {
          color: #2c3e50;
          margin-right: 6px;
        }
        .remove-attachment-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          font-size: 12px;
          padding: 0;
        }
      `;
      document.head.appendChild(style);
    }

    // Event listeners for attachment management
    attachedContainer.querySelector('.clear-attachments-btn').addEventListener('click', () => {
      this.attachedFiles = [];
      this.displayAttachedFiles([]);
    });

    attachedContainer.querySelectorAll('.remove-attachment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.target.dataset.fileId;
        this.attachedFiles = this.attachedFiles.filter(id => id !== fileId);
        this.displayAttachedFiles(this.attachedFiles);
      });
    });
  }

  /**
   * Remove a specific file from attachments (called when file is deleted)
   */
  removeFileFromAttachments(fileId) {
    if (this.attachedFiles && this.attachedFiles.includes(fileId)) {
      this.attachedFiles = this.attachedFiles.filter(id => id !== fileId);
      this.displayAttachedFiles(this.attachedFiles);
      console.log('aiFiverr Chat: Removed deleted file from attachments:', fileId);
    }
  }

  // Model Settings
  showModelSettings() {
    const settingsHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  background: white; border: 1px solid #e1e5e9; border-radius: 12px;
                  padding: 24px; z-index: 10001; box-shadow: 0 12px 48px rgba(0,0,0,0.15);
                  min-width: 300px;">
        <h3 style="margin: 0 0 16px 0; color: #495057;">Model Settings</h3>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #495057;">Temperature:</label>
          <input type="range" id="temperature-slider" min="0" max="1" step="0.1" value="0.7"
                 style="width: 100%; margin-bottom: 4px;">
          <span id="temperature-value" style="font-size: 12px; color: #6c757d;">0.7</span>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #495057;">Max Tokens:</label>
          <input type="number" id="max-tokens" value="65536" min="1" max="65536"
                 style="width: 100%; padding: 8px; border: 1px solid #e1e5e9; border-radius: 6px;">
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #495057;">Model:</label>
          <select id="model-select" style="width: 100%; padding: 8px; border: 1px solid #e1e5e9; border-radius: 6px;">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
          </select>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #495057;">System Prompt:</label>
          <textarea id="system-prompt" placeholder="Enter system prompt (optional)" style="
            width: 100%; height: 60px; padding: 8px; border: 1px solid #e1e5e9; border-radius: 6px;
            resize: vertical; font-family: inherit; font-size: 12px;
          "></textarea>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-settings" style="background: #6c757d; border: none; border-radius: 6px;
                                              color: white; cursor: pointer; padding: 8px 16px;">Cancel</button>
          <button id="save-settings" style="background: #007bff; border: none; border-radius: 6px;
                                           color: white; cursor: pointer; padding: 8px 16px;">Save</button>
        </div>
        <button id="close-settings" style="position: absolute; top: 8px; right: 8px; background: none;
                                          border: none; font-size: 20px; cursor: pointer; color: #6c757d;">×</button>
      </div>
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                  background: rgba(0,0,0,0.5); z-index: 10000;" id="settings-overlay"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', settingsHtml);

    // Load current settings
    this.loadModelSettings();

    // Event listeners
    document.getElementById('temperature-slider').addEventListener('input', (e) => {
      document.getElementById('temperature-value').textContent = e.target.value;
    });

    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveModelSettings();
      this.closeModelSettings();
    });

    document.getElementById('cancel-settings').addEventListener('click', () => {
      this.closeModelSettings();
    });

    document.getElementById('close-settings').addEventListener('click', () => {
      this.closeModelSettings();
    });

    document.getElementById('settings-overlay').addEventListener('click', () => {
      this.closeModelSettings();
    });
  }

  async loadModelSettings() {
    try {
      const result = await chrome.storage.local.get('aiAssistanceModelSettings');
      const settings = result.aiAssistanceModelSettings || {
        temperature: 0.7,
        maxTokens: 65536,
        model: await this.getDefaultModel(),
        systemPrompt: ''
      };

      document.getElementById('temperature-slider').value = settings.temperature;
      document.getElementById('temperature-value').textContent = settings.temperature;
      document.getElementById('max-tokens').value = settings.maxTokens;
      document.getElementById('model-select').value = settings.model;
      document.getElementById('system-prompt').value = settings.systemPrompt || '';

      this.modelSettings = settings;
    } catch (error) {
      console.error('Failed to load model settings:', error);
    }
  }

  /**
   * Get current model from extension settings
   */
  async getCurrentModel() {
    try {
      // First try to get from local model settings
      if (this.modelSettings?.model) {
        return this.modelSettings.model;
      }

      // Then try to get from extension settings
      if (window.storageManager) {
        const settings = await window.storageManager.getSettings();
        return settings.selectedModel || settings.defaultModel || await this.getDefaultModel();
      }

      // Fallback to default
      return await this.getDefaultModel();
    } catch (error) {
      console.error('Failed to get current model:', error);
      return await this.getDefaultModel();
    }
  }

  /**
   * Get default model from extension settings or fallback
   */
  async getDefaultModel() {
    try {
      if (window.storageManager) {
        const settings = await window.storageManager.getSettings();
        return settings.selectedModel || settings.defaultModel || 'gemini-2.5-flash';
      }
      return 'gemini-2.5-flash';
    } catch (error) {
      return 'gemini-2.5-flash';
    }
  }

  async saveModelSettings() {
    const settings = {
      temperature: parseFloat(document.getElementById('temperature-slider').value),
      maxTokens: parseInt(document.getElementById('max-tokens').value),
      model: document.getElementById('model-select').value,
      systemPrompt: document.getElementById('system-prompt').value
    };

    try {
      await chrome.storage.local.set({ aiAssistanceModelSettings: settings });
      this.modelSettings = settings;
      this.addMessage('system', 'Model settings saved successfully.');
    } catch (error) {
      console.error('Failed to save model settings:', error);
      this.addMessage('system', 'Failed to save model settings.');
    }
  }

  closeModelSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const settingsDiv = overlay ? overlay.previousElementSibling : null;
    if (settingsDiv && settingsDiv.parentNode) {
      settingsDiv.parentNode.removeChild(settingsDiv);
    }
  }

  // Initialize default settings
  async initializeSettings() {
    try {
      const result = await chrome.storage.local.get('aiAssistanceModelSettings');
      this.modelSettings = result.aiAssistanceModelSettings || {
        temperature: 0.7,
        maxTokens: 4096,
        model: await this.getDefaultModel(),
        systemPrompt: ''
      };
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      this.modelSettings = {
        temperature: 0.7,
        maxTokens: 4096,
        model: await this.getDefaultModel(),
        systemPrompt: ''
      };
    }
  }

  async sendMessageWithEnhancedStreaming(message, loadingId) {
    try {
      console.log('aiFiverr: Using enhanced streaming for message:', message);

      // Get conversation history
      const contents = [];

      // Add conversation history
      for (let i = 0; i < this.messages.length - 1; i++) { // -1 to exclude the loading message
        const msg = this.messages[i];
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === 'assistant') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // Convert to prompt format for enhanced client
      const conversationPrompt = contents.map(c =>
        `${c.role === 'user' ? 'User' : 'Assistant'}: ${c.parts[0].text}`
      ).join('\n\n');

      // Get knowledge base files - prioritize attached files
      let knowledgeBaseFiles = [];

      // PRIORITY 1: Use specifically attached files if any
      if (this.attachedFiles && this.attachedFiles.length > 0) {
        console.log('aiFiverr: Using attached files for API request:', this.attachedFiles);
        try {
          // Get file details for attached files and convert to knowledge base format
          const attachedFileDetails = await this.getAttachedFileDetails(this.attachedFiles);

          // Convert to knowledge base file format and filter only files with geminiUri
          knowledgeBaseFiles = attachedFileDetails
            .filter(file => file.geminiUri)
            .map(file => ({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              geminiUri: file.geminiUri,
              size: file.size
            }));

          console.log('aiFiverr: Successfully converted', knowledgeBaseFiles.length, 'attached files for API request');
          console.log('aiFiverr: Attached files details:', knowledgeBaseFiles.map(f => ({
            name: f.name,
            geminiUri: f.geminiUri,
            mimeType: f.mimeType
          })));

        } catch (error) {
          console.error('aiFiverr: Failed to get attached file details:', error);
          // Fall through to default behavior
        }
      }

      // PRIORITY 2: If no attached files or failed to get them, use knowledge base manager
      if (knowledgeBaseFiles.length === 0 && window.knowledgeBaseManager) {
        try {
          console.log('aiFiverr: No attached files, processing prompt with knowledge base manager for AUTO_LOAD_ALL...');
          // Use a dummy prompt key to trigger AUTO_LOAD_ALL processing
          const processedResult = await window.knowledgeBaseManager.processPrompt('summary', {
            conversation: conversationPrompt,
            bio: 'User bio placeholder' // This will be replaced by actual bio from settings
          });

          if (processedResult && processedResult.knowledgeBaseFiles) {
            knowledgeBaseFiles = processedResult.knowledgeBaseFiles;
            console.log('aiFiverr: Found', knowledgeBaseFiles.length, 'knowledge base files via processPrompt');
          } else {
            console.log('aiFiverr: No knowledge base files returned from processPrompt');
          }
        } catch (error) {
          console.warn('aiFiverr: Failed to process prompt with knowledge base manager:', error);
          // Fallback to direct file access
          try {
            const files = Array.from(window.knowledgeBaseManager.files.values());
            knowledgeBaseFiles = files.filter(file => file.geminiUri);
            console.log('aiFiverr: Fallback - Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');
          } catch (fallbackError) {
            console.warn('aiFiverr: Fallback also failed:', fallbackError);
          }
        }
      }

      // Prepare options with knowledge base files
      const options = {};
      if (knowledgeBaseFiles.length > 0) {
        options.knowledgeBaseFiles = knowledgeBaseFiles;
        console.log('aiFiverr: Attaching', knowledgeBaseFiles.length, 'knowledge base files to API request');
      }

      // Use enhanced streaming with knowledge base files
      const streamResponse = await window.enhancedGeminiClient.streamGenerateContent(
        conversationPrompt,
        null, // fileUri (legacy parameter)
        null, // fileMimeType (legacy parameter)
        'default', // sessionId
        options // options with knowledgeBaseFiles
      );

      let fullResponse = '';
      let isFirstChunk = true;

      for await (const chunk of streamResponse) {
        if (isFirstChunk) {
          // Replace loading message with streaming content
          this.updateMessage(loadingId, chunk.text);
          fullResponse = chunk.text;
          isFirstChunk = false;
        } else {
          // Append to existing message
          fullResponse += chunk.text;
          this.updateMessage(loadingId, fullResponse);
        }

        // Auto-scroll during streaming
        this.scrollToBottom();
      }

      console.log('aiFiverr: Enhanced streaming completed, final length:', fullResponse.length);

    } catch (error) {
      console.error('aiFiverr: Enhanced streaming error:', error);
      // Update loading message with error
      this.updateMessage(loadingId, 'Sorry, I encountered an error. Please try again.');
      throw error;
    }
  }
}

// Export for global access
window.AIAssistanceChat = AIAssistanceChat;

// Initialize single instance when DOM is ready - ONLY if explicitly called
async function initializeAIAssistanceChat() {
  if (!window.aiAssistanceChat) {
    window.aiAssistanceChat = new AIAssistanceChat();
    // Explicitly call init() after creating the instance
    await window.aiAssistanceChat.init();
    // Also create alias for backward compatibility
    window.simpleUniversalChat = window.aiAssistanceChat;
  }
}

// Export the initialization function but DO NOT auto-initialize
window.initializeAIAssistanceChat = initializeAIAssistanceChat;

// REMOVED AUTO-INITIALIZATION - This was causing the Fiverr-only mode to not work
// The chat should only be initialized when explicitly called by the main extension
