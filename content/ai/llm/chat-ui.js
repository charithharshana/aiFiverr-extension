/**
 * Universal Chat UI Components for LLM.js
 * Modern chat interface with streaming, thinking mode, and all LLM features
 */

// Note: In browser extension context, we'll use global variables instead of ES6 imports
// The files are loaded in order via manifest.json

/**
 * Chat UI Manager
 */
export default class ChatUI {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = {
      theme: 'dark',
      showThinking: true,
      showTokens: true,
      showCost: true,
      autoScroll: true,
      enableMarkdown: true,
      enableCopy: true,
      enableEdit: true,
      enableExport: true,
      maxHeight: '600px',
      ...options
    };

    this.chatInterface = null;
    this.elements = {};
    this.isVisible = false;
    this.isMinimized = false;
    this.currentStreamingMessage = null;
    
    this.init();
  }

  async init() {
    try {
      // Create chat interface
      this.chatInterface = new window.UniversalChatInterface(this.options);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Create UI
      this.createUI();
      
      // Wait for chat interface to initialize
      await new Promise(resolve => {
        if (this.chatInterface.llm) {
          resolve();
        } else {
          this.chatInterface.on('initialized', resolve);
        }
      });

      console.log('Chat UI initialized');
    } catch (error) {
      console.error('Failed to initialize Chat UI:', error);
    }
  }

  createUI() {
    // Inject styles
    this.injectStyles();

    this.container.innerHTML = '';
    this.container.className = `llm-chat-container ${this.options.theme}`;

    // Create main structure
    const chatWindow = this.createElement('div', 'llm-chat-window');
    
    // Header
    const header = this.createHeader();
    chatWindow.appendChild(header);

    // Messages container
    const messagesContainer = this.createElement('div', 'llm-messages-container');
    messagesContainer.style.maxHeight = this.options.maxHeight;
    chatWindow.appendChild(messagesContainer);

    // Input container
    const inputContainer = this.createInputContainer();
    chatWindow.appendChild(inputContainer);

    // Status bar
    const statusBar = this.createStatusBar();
    chatWindow.appendChild(statusBar);

    this.container.appendChild(chatWindow);

    // Store element references
    this.elements = {
      chatWindow,
      header,
      messagesContainer,
      inputContainer,
      statusBar,
      messageInput: inputContainer.querySelector('.llm-message-input'),
      sendButton: inputContainer.querySelector('.llm-send-button'),
      thinkingToggle: header.querySelector('.llm-thinking-toggle'),
      settingsButton: header.querySelector('.llm-settings-button'),
      minimizeButton: header.querySelector('.llm-minimize-button'),
      closeButton: header.querySelector('.llm-close-button')
    };

    // Set up UI event listeners
    this.setupUIEventListeners();

    // Load existing conversation
    this.loadCurrentConversation();
  }

  createHeader() {
    const header = this.createElement('div', 'llm-chat-header');
    
    header.innerHTML = `
      <div class="llm-header-left">
        <h3 class="llm-chat-title">AI Assistant</h3>
        <span class="llm-conversation-info"></span>
      </div>
      <div class="llm-header-right">
        <button class="llm-thinking-toggle" title="Toggle Thinking Mode">
          <span class="llm-icon">🧠</span>
        </button>
        <button class="llm-settings-button" title="Settings">
          <span class="llm-icon">⚙️</span>
        </button>
        <button class="llm-minimize-button" title="Minimize">
          <span class="llm-icon">−</span>
        </button>
        <button class="llm-close-button" title="Close">
          <span class="llm-icon">×</span>
        </button>
      </div>
    `;

    return header;
  }

  createInputContainer() {
    const container = this.createElement('div', 'llm-input-container');
    
    container.innerHTML = `
      <div class="llm-input-wrapper">
        <textarea 
          class="llm-message-input" 
          placeholder="Type your message..." 
          rows="1"
        ></textarea>
        <div class="llm-input-actions">
          <button class="llm-attach-button" title="Attach File">
            <span class="llm-icon">📎</span>
          </button>
          <button class="llm-send-button" title="Send Message">
            <span class="llm-icon">➤</span>
          </button>
        </div>
      </div>
      <div class="llm-quick-prompts">
        <button class="llm-quick-prompt" data-prompt="Explain this">Explain</button>
        <button class="llm-quick-prompt" data-prompt="Summarize this">Summarize</button>
        <button class="llm-quick-prompt" data-prompt="Improve this">Improve</button>
        <button class="llm-quick-prompt" data-prompt="Translate this">Translate</button>
      </div>
    `;

    return container;
  }

  createStatusBar() {
    const statusBar = this.createElement('div', 'llm-status-bar');
    
    statusBar.innerHTML = `
      <div class="llm-status-left">
        <span class="llm-connection-status">●</span>
        <span class="llm-model-info">Gemini 2.5 Flash</span>
      </div>
      <div class="llm-status-right">
        <span class="llm-token-count">0 tokens</span>
        <span class="llm-cost-info">$0.00</span>
      </div>
    `;

    return statusBar;
  }

  setupEventListeners() {
    // Chat interface events
    this.chatInterface.on('messageAdded', (message, conversation) => {
      this.renderMessage(message);
      this.updateConversationInfo(conversation);
    });

    this.chatInterface.on('streamStarted', (message) => {
      this.currentStreamingMessage = this.renderMessage(message);
    });

    this.chatInterface.on('streamChunk', (chunk, message) => {
      this.updateStreamingMessage(chunk, message);
    });

    this.chatInterface.on('thinkingChunk', (chunk, message) => {
      if (this.options.showThinking) {
        this.updateThinkingMessage(chunk, message);
      }
    });

    this.chatInterface.on('streamCompleted', (response, message) => {
      this.finalizeStreamingMessage(response, message);
      this.currentStreamingMessage = null;
    });

    this.chatInterface.on('error', (error) => {
      this.showError(error);
    });

    // UI events will be set up after elements are created
  }

  injectStyles() {
    if (document.getElementById('llm-chat-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'llm-chat-styles';
    styles.textContent = `
      .llm-chat-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        max-width: 90vw;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }

      .llm-chat-window {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .llm-chat-window.minimized .llm-messages-container,
      .llm-chat-window.minimized .llm-input-container,
      .llm-chat-window.minimized .llm-status-bar {
        display: none;
      }

      .llm-chat-header {
        background: #2d2d2d;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #333;
        cursor: move;
      }

      .llm-header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .llm-chat-title {
        margin: 0;
        color: #fff;
        font-size: 16px;
        font-weight: 600;
      }

      .llm-conversation-info {
        color: #888;
        font-size: 12px;
      }

      .llm-header-right {
        display: flex;
        gap: 8px;
      }

      .llm-header-right button {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .llm-header-right button:hover {
        background: #444;
        color: #fff;
      }

      .llm-thinking-toggle.active {
        background: #4a9eff;
        color: #fff;
      }

      .llm-messages-container {
        overflow-y: auto;
        padding: 16px;
        background: #1a1a1a;
        min-height: 200px;
        max-height: 400px;
      }

      .llm-message {
        margin-bottom: 16px;
      }

      .llm-message-content {
        background: #2d2d2d;
        border-radius: 8px;
        overflow: hidden;
      }

      .llm-message-user .llm-message-content {
        background: #4a9eff;
        margin-left: 20%;
      }

      .llm-message-header {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
      }

      .llm-message-role {
        font-weight: 600;
        color: #fff;
      }

      .llm-message-time {
        color: #888;
      }

      .llm-message-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .llm-message:hover .llm-message-actions {
        opacity: 1;
      }

      .llm-message-actions button {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 12px;
      }

      .llm-message-actions button:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .llm-message-body {
        padding: 12px;
        color: #fff;
        word-wrap: break-word;
      }

      .llm-message-body pre {
        background: #000;
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 8px 0;
      }

      .llm-message-body code {
        background: #000;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
      }

      .llm-thinking-message {
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 8px;
        margin-bottom: 16px;
        overflow: hidden;
      }

      .llm-thinking-header {
        padding: 8px 12px;
        background: #333;
        color: #fff;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .llm-thinking-content {
        padding: 12px;
        color: #ccc;
        font-style: italic;
        max-height: 150px;
        overflow-y: auto;
      }

      .llm-input-container {
        padding: 16px;
        background: #2d2d2d;
        border-top: 1px solid #333;
      }

      .llm-input-wrapper {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      .llm-message-input {
        flex: 1;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        color: #fff;
        resize: none;
        min-height: 20px;
        max-height: 120px;
        font-family: inherit;
        font-size: 14px;
      }

      .llm-message-input:focus {
        outline: none;
        border-color: #4a9eff;
      }

      .llm-message-input::placeholder {
        color: #666;
      }

      .llm-input-actions {
        display: flex;
        gap: 4px;
      }

      .llm-input-actions button {
        background: #4a9eff;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .llm-input-actions button:hover {
        background: #357abd;
      }

      .llm-input-actions button:disabled {
        background: #666;
        cursor: not-allowed;
      }

      .llm-quick-prompts {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .llm-quick-prompt {
        background: #333;
        border: none;
        border-radius: 16px;
        padding: 4px 12px;
        color: #ccc;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .llm-quick-prompt:hover {
        background: #4a9eff;
        color: #fff;
      }

      .llm-status-bar {
        padding: 8px 16px;
        background: #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #888;
      }

      .llm-connection-status {
        color: #4caf50;
      }

      .llm-error-message {
        background: #ff4444;
        border-radius: 8px;
        margin-bottom: 16px;
        overflow: hidden;
      }

      .llm-error-content {
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #fff;
      }

      .llm-error-close {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        margin-left: auto;
        padding: 0 4px;
      }

      .llm-toast {
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #333;
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 10001;
      }

      .llm-toast.show {
        transform: translateY(0);
        opacity: 1;
      }

      /* Dark theme (default) */
      .llm-chat-container.dark {
        /* Already defined above */
      }

      /* Light theme */
      .llm-chat-container.light .llm-chat-window {
        background: #fff;
        border-color: #ddd;
      }

      .llm-chat-container.light .llm-chat-header {
        background: #f5f5f5;
        border-bottom-color: #ddd;
      }

      .llm-chat-container.light .llm-chat-title {
        color: #333;
      }

      .llm-chat-container.light .llm-messages-container {
        background: #fff;
      }

      .llm-chat-container.light .llm-message-content {
        background: #f5f5f5;
      }

      .llm-chat-container.light .llm-message-body {
        color: #333;
      }

      .llm-chat-container.light .llm-input-container {
        background: #f5f5f5;
        border-top-color: #ddd;
      }

      .llm-chat-container.light .llm-message-input {
        background: #fff;
        border-color: #ddd;
        color: #333;
      }

      .llm-chat-container.light .llm-status-bar {
        background: #f0f0f0;
      }

      /* Scrollbar styling */
      .llm-messages-container::-webkit-scrollbar {
        width: 6px;
      }

      .llm-messages-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .llm-messages-container::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
      }

      .llm-messages-container::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      /* Responsive design */
      @media (max-width: 480px) {
        .llm-chat-container {
          width: 100vw;
          height: 100vh;
          bottom: 0;
          right: 0;
          border-radius: 0;
        }

        .llm-chat-window {
          border-radius: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .llm-messages-container {
          flex: 1;
          max-height: none;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  setupUIEventListeners() {
    // Send message
    this.elements.sendButton.addEventListener('click', () => this.sendMessage());
    
    // Input handling
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.elements.messageInput.addEventListener('input', () => {
      this.autoResizeTextarea(this.elements.messageInput);
    });

    // Quick prompts
    this.elements.inputContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('llm-quick-prompt')) {
        const prompt = e.target.dataset.prompt;
        this.elements.messageInput.value = prompt;
        this.elements.messageInput.focus();
      }
    });

    // Header buttons
    this.elements.thinkingToggle.addEventListener('click', () => {
      this.toggleThinkingMode();
    });

    this.elements.settingsButton.addEventListener('click', () => {
      this.showSettings();
    });

    this.elements.minimizeButton.addEventListener('click', () => {
      this.toggleMinimize();
    });

    this.elements.closeButton.addEventListener('click', () => {
      this.hide();
    });

    // Message actions (copy, edit, etc.)
    this.elements.messagesContainer.addEventListener('click', (e) => {
      this.handleMessageAction(e);
    });
  }

  async sendMessage() {
    const input = this.elements.messageInput.value.trim();
    if (!input) return;

    // Clear input
    this.elements.messageInput.value = '';
    this.autoResizeTextarea(this.elements.messageInput);

    // Disable send button
    this.elements.sendButton.disabled = true;

    try {
      await this.chatInterface.sendMessage(input, {
        stream: true,
        think: this.options.showThinking
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.elements.sendButton.disabled = false;
    }
  }

  renderMessage(message) {
    const messageElement = this.createElement('div', `llm-message llm-message-${message.role}`);
    messageElement.dataset.messageId = message.id;

    const content = this.createElement('div', 'llm-message-content');
    
    // Message header
    const header = this.createElement('div', 'llm-message-header');
    header.innerHTML = `
      <span class="llm-message-role">${this.formatRole(message.role)}</span>
      <span class="llm-message-time">${this.formatTime(message.timestamp)}</span>
      <div class="llm-message-actions">
        <button class="llm-copy-button" title="Copy">📋</button>
        <button class="llm-edit-button" title="Edit">✏️</button>
        <button class="llm-delete-button" title="Delete">🗑️</button>
      </div>
    `;

    // Message body
    const body = this.createElement('div', 'llm-message-body');
    body.innerHTML = this.formatMessageContent(message.content, message.role);

    content.appendChild(header);
    content.appendChild(body);
    messageElement.appendChild(content);

    // Add to container
    this.elements.messagesContainer.appendChild(messageElement);

    // Auto-scroll
    if (this.options.autoScroll) {
      this.scrollToBottom();
    }

    return messageElement;
  }

  updateStreamingMessage(chunk, message) {
    if (!this.currentStreamingMessage) return;

    const body = this.currentStreamingMessage.querySelector('.llm-message-body');
    if (body) {
      body.innerHTML = this.formatMessageContent(message.content, message.role);
    }

    if (this.options.autoScroll) {
      this.scrollToBottom();
    }
  }

  updateThinkingMessage(chunk, message) {
    let thinkingElement = this.elements.messagesContainer.querySelector('.llm-thinking-message');
    
    if (!thinkingElement) {
      thinkingElement = this.createElement('div', 'llm-thinking-message');
      thinkingElement.innerHTML = `
        <div class="llm-thinking-header">
          <span class="llm-thinking-icon">🧠</span>
          <span>Thinking...</span>
        </div>
        <div class="llm-thinking-content"></div>
      `;
      this.elements.messagesContainer.appendChild(thinkingElement);
    }

    const content = thinkingElement.querySelector('.llm-thinking-content');
    if (content) {
      content.innerHTML = this.formatMessageContent(message.content, 'thinking'); // MESSAGE_ROLES.THINKING
    }

    if (this.options.autoScroll) {
      this.scrollToBottom();
    }
  }

  finalizeStreamingMessage(response, message) {
    // Remove thinking message if it exists
    const thinkingElement = this.elements.messagesContainer.querySelector('.llm-thinking-message');
    if (thinkingElement) {
      thinkingElement.remove();
    }

    // Update status bar with usage info
    if (response.usage) {
      this.updateStatusBar(response.usage);
    }
  }

  formatMessageContent(content, role) {
    if (!content) return '';

    if (typeof content === 'object') {
      content = JSON.stringify(content, null, 2);
    }

    if (this.options.enableMarkdown && role === 'assistant') { // MESSAGE_ROLES.ASSISTANT
      return this.renderMarkdown(content);
    }

    return this.escapeHtml(content).replace(/\n/g, '<br>');
  }

  renderMarkdown(content) {
    // Basic markdown rendering
    let html = this.escapeHtml(content);
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  formatRole(role) {
    const roleMap = {
      'user': 'You',
      'assistant': 'AI',
      'system': 'System',
      'thinking': 'Thinking',
      'tool_call': 'Tool'
    };
    return roleMap[role] || role;
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createElement(tag, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  scrollToBottom() {
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }

  loadCurrentConversation() {
    const conversation = this.chatInterface.getCurrentConversation();
    if (!conversation) return;

    // Clear existing messages
    this.elements.messagesContainer.innerHTML = '';

    // Render all messages
    for (const message of conversation.messages) {
      if (message.role !== 'system') { // MESSAGE_ROLES.SYSTEM
        this.renderMessage(message);
      }
    }

    this.updateConversationInfo(conversation);
  }

  updateConversationInfo(conversation) {
    const info = this.elements.header.querySelector('.llm-conversation-info');
    if (info) {
      info.textContent = `${conversation.metadata.messageCount} messages`;
    }
  }

  updateStatusBar(usage) {
    const tokenCount = this.elements.statusBar.querySelector('.llm-token-count');
    const costInfo = this.elements.statusBar.querySelector('.llm-cost-info');

    if (tokenCount) {
      tokenCount.textContent = `${usage.total_tokens} tokens`;
    }

    if (costInfo) {
      costInfo.textContent = `$${usage.total_cost.toFixed(4)}`;
    }
  }

  handleMessageAction(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const messageElement = button.closest('.llm-message');
    if (!messageElement) return;

    const messageId = messageElement.dataset.messageId;
    const action = button.className;

    if (action.includes('copy')) {
      this.copyMessage(messageId);
    } else if (action.includes('edit')) {
      this.editMessage(messageId);
    } else if (action.includes('delete')) {
      this.deleteMessage(messageId);
    }
  }

  copyMessage(messageId) {
    const conversation = this.chatInterface.getCurrentConversation();
    const message = conversation.messages.find(m => m.id === messageId);
    
    if (message && navigator.clipboard) {
      navigator.clipboard.writeText(message.content);
      this.showToast('Message copied to clipboard');
    }
  }

  editMessage(messageId) {
    // Implementation for editing messages
    console.log('Edit message:', messageId);
  }

  deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatInterface.deleteMessage(messageId);
      const messageElement = this.elements.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.remove();
      }
    }
  }

  toggleThinkingMode() {
    this.options.showThinking = !this.options.showThinking;
    this.elements.thinkingToggle.classList.toggle('active', this.options.showThinking);
    this.chatInterface.updateOptions({ think: this.options.showThinking });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.elements.chatWindow.classList.toggle('minimized', this.isMinimized);
    this.elements.minimizeButton.querySelector('.llm-icon').textContent = this.isMinimized ? '+' : '−';
  }

  showSettings() {
    // Implementation for settings modal
    console.log('Show settings');
  }

  showError(error) {
    const errorElement = this.createElement('div', 'llm-error-message');
    errorElement.innerHTML = `
      <div class="llm-error-content">
        <span class="llm-error-icon">⚠️</span>
        <span class="llm-error-text">${error.message}</span>
        <button class="llm-error-close">×</button>
      </div>
    `;

    errorElement.querySelector('.llm-error-close').addEventListener('click', () => {
      errorElement.remove();
    });

    this.elements.messagesContainer.appendChild(errorElement);
    this.scrollToBottom();

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.remove();
      }
    }, 5000);
  }

  showToast(message) {
    const toast = this.createElement('div', 'llm-toast');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  show() {
    this.isVisible = true;
    this.container.style.display = 'block';
    this.elements.messageInput.focus();
  }

  hide() {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy() {
    if (this.chatInterface) {
      this.chatInterface.destroy();
    }
    this.container.innerHTML = '';
  }
}

// Export to global window object for browser extension
if (typeof window !== 'undefined') {
  window.ChatUI = ChatUI;
}
