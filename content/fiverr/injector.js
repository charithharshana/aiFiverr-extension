/**
 * Fiverr UI Injector
 * Injects AI assistance UI elements into Fiverr pages
 */

class FiverrInjector {
  constructor() {
    this.injectedElements = new Map();
    this.floatingWidget = null;
    this.init();
  }

  init() {
    // Check if we should operate normally (Facebook error handling)
    if (window.facebookErrorHandler && !window.facebookErrorHandler.shouldOperateNormally()) {
      console.warn('aiFiverr Injector: Extension disabled due to errors, skipping initialization');
      return;
    }

    // Listen for element detection events
    window.addEventListener('aifiverr:elementsDetected', (event) => {
      this.handleElementsDetected(event.detail);
    });

    // Inject floating widget
    this.injectFloatingWidget();

    // Monitor for new elements
    this.startMonitoring();

    // Add manual trigger for debugging/testing
    this.addManualTrigger();
  }

  /**
   * Handle detected elements and inject UI
   */
  handleElementsDetected(detail) {
    const { pageType, elements } = detail;
    
    switch (pageType) {
      case 'conversation':
        this.injectChatUI(elements);
        break;
      case 'proposal':
        this.injectProposalUI(elements);
        break;

    }
  }

  /**
   * Inject chat-related UI elements - CONSERVATIVE APPROACH
   */
  injectChatUI(elements) {
    console.log('aiFiverr: Injecting chat UI with elements:', elements);

    // ONLY inject for specifically detected chat inputs
    if (elements.inputs) {
      elements.inputs.forEach(element => {
        if (fiverrDetector.isChatInput(element) && !fiverrDetector.isProcessed(element)) {
          console.log('aiFiverr: Injecting chat input button for:', element);
          this.injectChatInputButton(element);
          fiverrDetector.markAsProcessed(element);
        }
      });
    }

    // ONLY inject for specifically detected message elements
    if (elements.messages && elements.messages.length > 0) {
      elements.messages.forEach(element => {
        if (!fiverrDetector.isProcessed(element)) {
          console.log('aiFiverr: Injecting message button for:', element);
          this.injectMessageAnalysisButton(element);
          fiverrDetector.markAsProcessed(element);
        }
      });
    }
  }

  /**
   * Inject proposal-related UI elements
   */
  injectProposalUI(elements) {
    if (elements.proposal) {
      elements.proposal.forEach(element => {
        if (fiverrDetector.isProposalInput(element) && !fiverrDetector.isProcessed(element)) {
          this.injectProposalButton(element);
          fiverrDetector.markAsProcessed(element);
        }
      });
    }
  }



  /**
   * Inject AI button for chat input - COMPACT VERSION
   */
  injectChatInputButton(inputElement) {
    const container = this.createButtonContainer();

    // Create compact AI button with dropdown
    const compactButton = this.createCompactAIButton(inputElement);

    container.appendChild(compactButton);
    this.insertButtonContainer(inputElement, container);

    this.injectedElements.set(inputElement, container);
  }

  /**
   * Inject message interaction buttons
   */
  injectMessageAnalysisButton(messageElement) {
    // Create container for message interaction buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'aifiverr-message-actions';

    // Create dropdown toggle button
    const toggleButton = this.createMessageToggleButton();

    // Create dropdown menu
    const dropdown = this.createMessageDropdown(messageElement);

    buttonContainer.appendChild(toggleButton);
    buttonContainer.appendChild(dropdown);

    // Position container relative to message
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '5px';
    buttonContainer.style.right = '5px';
    buttonContainer.style.zIndex = '1000';

    messageElement.style.position = 'relative';
    messageElement.appendChild(buttonContainer);

    this.injectedElements.set(messageElement, buttonContainer);
  }

  /**
   * Inject proposal generation button
   */
  injectProposalButton(inputElement) {
    const container = this.createButtonContainer();
    const button = this.createAIButton('Generate Proposal', 'proposal');
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleProposalGeneration(inputElement);
    });

    container.appendChild(button);
    this.insertButtonContainer(inputElement, container);
    
    this.injectedElements.set(inputElement, container);
  }



  /**
   * Inject floating AI widget
   */
  injectFloatingWidget() {
    if (this.floatingWidget) return;

    const widget = document.createElement('div');
    widget.className = 'aifiverr-floating-widget';
    widget.innerHTML = `
      <div class="widget-toggle">
        💬
      </div>
    `;

    // Add styles
    Object.assign(widget.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '10000',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      width: '60px',
      height: '60px',
      backgroundColor: '#007bff',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
      transition: 'all 0.3s ease',
      border: 'none',
      color: 'white',
      fontSize: '24px'
    });

    // Add hover effect
    widget.addEventListener('mouseenter', () => {
      widget.style.transform = 'scale(1.1)';
      widget.style.backgroundColor = '#0056b3';
    });

    widget.addEventListener('mouseleave', () => {
      widget.style.transform = 'scale(1)';
      widget.style.backgroundColor = '#007bff';
    });

    document.body.appendChild(widget);
    this.floatingWidget = widget;

    // Add event listeners
    this.setupFloatingWidgetEvents();
  }

  /**
   * Setup floating widget events
   */
  setupFloatingWidgetEvents() {
    const toggle = this.floatingWidget.querySelector('.widget-toggle');

    // Initialize streaming chatbox instance
    this.floatingChatbox = null;

    // Make the entire widget draggable
    this.makeFloatingWidgetDraggable();

    toggle.addEventListener('click', (e) => {
      // Don't toggle if this was part of a drag operation
      if (this.isDragging) {
        this.isDragging = false;
        return;
      }

      this.toggleFloatingChatbox();
    });
  }

  /**
   * Toggle the floating chatbox visibility
   */
  toggleFloatingChatbox() {
    // Check if StreamingChatbox is available
    if (typeof StreamingChatbox === 'undefined') {
      console.error('aiFiverr: StreamingChatbox class not available');
      return;
    }

    try {
      // If chatbox doesn't exist, create it
      if (!this.floatingChatbox) {
        this.floatingChatbox = new StreamingChatbox({
          maxWidth: '500px',
          maxHeight: '600px',
          theme: 'light',
          showActions: true,
          enableDragging: true,
          enableResizing: true
        });

        console.log('aiFiverr: Floating chatbox initialized successfully');
      }

      // Toggle visibility
      if (this.floatingChatbox.isVisible) {
        this.floatingChatbox.hide();
      } else {
        this.floatingChatbox.show('Hello! How can I help you today?');
      }

    } catch (error) {
      console.error('aiFiverr: Failed to initialize/toggle floating chatbox:', error);
    }
  }

  /**
   * Make floating widget draggable
   */
  makeFloatingWidgetDraggable() {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    this.isDragging = false;

    const handleMouseDown = (e) => {
      // Only allow dragging from the toggle button
      if (!e.target.closest('.widget-toggle')) return;

      isDragging = true;
      this.isDragging = false; // Reset for click detection
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.floatingWidget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Add dragging class for visual feedback
      this.floatingWidget.classList.add('dragging');

      // Prevent text selection during drag
      e.preventDefault();
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // If we've moved more than 5px, consider it a drag
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        this.isDragging = true;
      }

      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;

      // Keep widget within viewport bounds
      const maxLeft = window.innerWidth - this.floatingWidget.offsetWidth;
      const maxTop = window.innerHeight - this.floatingWidget.offsetHeight;

      const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
      const constrainedTop = Math.max(0, Math.min(newTop, maxTop));

      this.floatingWidget.style.left = constrainedLeft + 'px';
      this.floatingWidget.style.top = constrainedTop + 'px';
      this.floatingWidget.style.right = 'auto';
      this.floatingWidget.style.bottom = 'auto';
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        this.floatingWidget.classList.remove('dragging');
        document.body.style.userSelect = '';

        // Save position to localStorage
        const rect = this.floatingWidget.getBoundingClientRect();
        localStorage.setItem('aifiverr-widget-position', JSON.stringify({
          left: rect.left,
          top: rect.top
        }));
      }
    };

    // Add event listeners
    this.floatingWidget.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Load saved position
    this.loadFloatingWidgetPosition();
  }

  /**
   * Load saved floating widget position
   */
  loadFloatingWidgetPosition() {
    try {
      const savedPosition = localStorage.getItem('aifiverr-widget-position');
      if (savedPosition) {
        const position = JSON.parse(savedPosition);

        // Ensure position is within current viewport
        const maxLeft = window.innerWidth - this.floatingWidget.offsetWidth;
        const maxTop = window.innerHeight - this.floatingWidget.offsetHeight;

        const left = Math.max(0, Math.min(position.left, maxLeft));
        const top = Math.max(0, Math.min(position.top, maxTop));

        this.floatingWidget.style.left = left + 'px';
        this.floatingWidget.style.top = top + 'px';
        this.floatingWidget.style.right = 'auto';
        this.floatingWidget.style.bottom = 'auto';
      }
    } catch (error) {
      console.error('aiFiverr: Error loading widget position:', error);
    }
  }

  /**
   * Create AI button element
   */
  createAIButton(text, type, options = {}) {
    const button = document.createElement('button');
    button.className = `aifiverr-button aifiverr-${type}-button`;
    button.textContent = text;
    
    const baseStyles = {
      backgroundColor: '#1dbf73',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: options.small ? '4px 8px' : '8px 16px',
      fontSize: options.small ? '12px' : '14px',
      fontWeight: '600',
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    };

    Object.assign(button.style, baseStyles);

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#19a463';
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#1dbf73';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * Create AI icon for prompt selection
   */
  createAIIcon() {
    const icon = document.createElement('button');
    icon.className = 'aifiverr-ai-icon';
    icon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 13.54 2.36 14.99 3.01 16.28L2 22L7.72 20.99C9.01 21.64 10.46 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C10.74 20 9.54 19.75 8.46 19.3L6 20L6.7 17.54C6.25 16.46 6 15.26 6 14C6 8.48 8.48 6 12 6C15.52 6 18 8.48 18 12C18 15.52 15.52 18 12 18Z" fill="currentColor"/>
        <circle cx="9" cy="12" r="1" fill="currentColor"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
        <circle cx="15" cy="12" r="1" fill="currentColor"/>
      </svg>
    `;
    icon.title = 'aiFiverr: Select AI Prompt';

    const iconStyles = {
      backgroundColor: '#2563eb',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '32px',
      height: '32px',
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
      marginLeft: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };

    Object.assign(icon.style, iconStyles);

    // Hover effects
    icon.addEventListener('mouseenter', () => {
      icon.style.backgroundColor = '#1d4ed8';
      icon.style.transform = 'translateY(-1px) scale(1.05)';
    });

    icon.addEventListener('mouseleave', () => {
      icon.style.backgroundColor = '#2563eb';
      icon.style.transform = 'translateY(0) scale(1)';
    });

    return icon;
  }

  /**
   * Create single message icon button with dropdown
   */
  createCompactAIButton(inputElement) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'aifiverr-message-icon-container';
    buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      margin: 4px 0;
      position: relative;
    `;

    // Create single message icon button
    const messageButton = document.createElement('button');
    messageButton.className = 'aifiverr-message-icon-button';
    messageButton.innerHTML = '💬'; // Message icon
    messageButton.title = 'AI Reply Options';

    // Style the button with no background
    Object.assign(messageButton.style, {
      background: 'none',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      transition: 'all 0.2s ease',
      opacity: '0.7'
    });

    // Hover effect
    messageButton.addEventListener('mouseenter', () => {
      messageButton.style.opacity = '1';
      messageButton.style.transform = 'scale(1.1)';
    });

    messageButton.addEventListener('mouseleave', () => {
      messageButton.style.opacity = '0.7';
      messageButton.style.transform = 'scale(1)';
    });

    // Create dropdown menu (initially hidden)
    const dropdown = this.createPromptDropup(inputElement);

    // Click handler to toggle dropdown
    messageButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Toggle dropdown visibility
      const isVisible = dropdown.style.display === 'block';
      if (isVisible) {
        dropdown.style.display = 'none';
      } else {
        // Load prompts and show dropdown
        await this.populatePromptDropup(dropdown, inputElement);
        dropdown.style.display = 'block';

        // Position dropdown above the button
        this.positionDropup(dropdown, messageButton);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!buttonContainer.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    buttonContainer.appendChild(messageButton);
    buttonContainer.appendChild(dropdown);

    return buttonContainer;
  }

  /**
   * Create prompt dropdown menu (drop-up style)
   */
  createPromptDropup(inputElement) {
    const dropdown = document.createElement('div');
    dropdown.className = 'aifiverr-prompt-dropup';
    dropdown.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1001;
      min-width: 200px;
      max-width: 300px;
      max-height: 300px;
      overflow-y: auto;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    return dropdown;
  }

  /**
   * Populate dropdown with custom prompts
   */
  async populatePromptDropup(dropdown, inputElement) {
    try {
      // Clear existing content
      dropdown.innerHTML = '';

      // Get ALL prompts (default + custom) - always show all available prompts
      let allPrompts = {};

      // Load default prompts
      const defaultPrompts = this.getDefaultPrompts();
      allPrompts = { ...defaultPrompts };

      // Load custom prompts from storage with enhanced error handling
      let customPrompts = {};
      let defaultPromptVisibility = {};

      try {
        const customPromptsResult = await chrome.storage.local.get('customPrompts');
        customPrompts = customPromptsResult.customPrompts || {};

        console.log('aiFiverr Injector: Raw custom prompts from storage:', customPromptsResult);
        console.log('aiFiverr Injector: Processed custom prompts:', customPrompts);

        // Load floating icon visibility settings
        const visibilityResult = await chrome.storage.local.get('floatingIconVisibility');
        const floatingIconVisibility = visibilityResult.floatingIconVisibility || {};

        // Only show custom prompts (no default prompts) - same as floating message implementation
        const visibleCustomPrompts = {};
        Object.entries(customPrompts).forEach(([key, prompt]) => {
          // Default to visible if not explicitly set to false
          if (floatingIconVisibility[key] !== false) {
            visibleCustomPrompts[key] = prompt;
          }
        });

        // Use only custom prompts (no default prompts)
        allPrompts = visibleCustomPrompts;

        console.log('aiFiverr: Loaded custom prompts for Fiverr chat dropdown:', {
          customTotal: Object.keys(customPrompts).length,
          customVisible: Object.keys(visibleCustomPrompts).length,
          totalVisible: Object.keys(allPrompts).length,
          visiblePromptKeys: Object.keys(allPrompts)
        });
      } catch (error) {
        console.warn('aiFiverr: Failed to load custom prompts:', error);
      }

      if (!allPrompts || Object.keys(allPrompts).length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280;">No custom prompts available</div>';
        return;
      }

      this.renderPromptItems(dropdown, allPrompts, inputElement);
    } catch (error) {
      console.error('Failed to populate prompt dropdown:', error);
      dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280;">Failed to load prompts</div>';
    }
  }

  /**
   * Render prompt items in dropdown
   */
  renderPromptItems(dropdown, prompts, inputElement) {
    if (!dropdown) {
      console.error('aiFiverr: Dropdown element is null');
      return;
    }

    Object.entries(prompts).forEach(([key, prompt]) => {
      // Skip invalid prompts
      if (!prompt || typeof prompt !== 'object') {
        console.warn('aiFiverr: Skipping invalid prompt:', key, prompt);
        return;
      }

      try {
        const item = document.createElement('div');
        item.className = 'aifiverr-prompt-item';
      item.style.cssText = `
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
        transition: background-color 0.2s ease;
      `;

      // Enhanced title extraction with better validation
      let title = 'Untitled';
      if (prompt.name && typeof prompt.name === 'string' && prompt.name.trim()) {
        title = prompt.name.trim();
      } else if (prompt.title && typeof prompt.title === 'string' && prompt.title.trim()) {
        title = prompt.title.trim();
      } else if (key && typeof key === 'string' && key.trim()) {
        title = key.trim().replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }

      const displayTitle = (title.length > 30) ? title.substring(0, 30) + '...' : title;

      // Enhanced description extraction with better validation
      let description = 'AI-powered response';
      if (prompt.description && typeof prompt.description === 'string' && prompt.description.trim()) {
        description = prompt.description.trim();
      } else if (prompt.prompt && typeof prompt.prompt === 'string' && prompt.prompt.trim()) {
        // Use first part of prompt as description if no description available
        const promptText = prompt.prompt.trim();
        description = promptText.length > 50 ? promptText.substring(0, 50) + '...' : promptText;
      }

      console.log('aiFiverr: Rendering prompt item:', {
        key,
        title,
        description: description.substring(0, 50) + '...',
        hasPromptContent: !!(prompt.prompt || prompt.content || prompt.text)
      });

      // Use CSP-safe DOM creation instead of innerHTML
      if (window.cspSafeDOMUtils && (window.aiFiverrUseCSPSafeMode || window.cspSafeDOMUtils.isStrictCSPSite())) {
        const titleDiv = window.cspSafeDOMUtils.createElement('div', {
          textContent: displayTitle,
          styles: {
            fontSize: '14px',
            fontWeight: '500',
            color: '#111827',
            marginBottom: '2px'
          }
        });

        const descDiv = window.cspSafeDOMUtils.createElement('div', {
          textContent: description,
          styles: {
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.3'
          }
        });

        item.appendChild(titleDiv);
        item.appendChild(descDiv);
      } else {
        // Fallback to innerHTML for non-strict sites
        item.innerHTML = `
          <div style="font-size: 14px; font-weight: 500; color: #111827; margin-bottom: 2px;">
            ${this.escapeHtml(displayTitle)}
          </div>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.3;">
            ${this.escapeHtml(description)}
          </div>
        `;
      }

      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f9fafb';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });

      // Click handler
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Hide dropdown
        dropdown.style.display = 'none';

        // Execute prompt
        await this.executePrompt(inputElement, key);
      });

        dropdown.appendChild(item);
      } catch (error) {
        console.error('aiFiverr: Error creating prompt item:', key, error);
      }
    });

    // Remove border from last item
    const lastItem = dropdown.lastElementChild;
    if (lastItem) {
      lastItem.style.borderBottom = 'none';
    }
  }

  /**
   * Position dropdown above the button
   */
  positionDropup(dropdown, button) {
    const buttonRect = button.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();

    // Position above the button
    dropdown.style.bottom = '100%';
    dropdown.style.left = '0';
    dropdown.style.marginBottom = '4px';

    // Adjust if dropdown would go off-screen
    const viewportHeight = window.innerHeight;
    const spaceAbove = buttonRect.top;
    const dropdownHeight = dropdown.offsetHeight || 200; // estimated height

    if (spaceAbove < dropdownHeight + 20) {
      // Not enough space above, show below instead
      dropdown.style.bottom = 'auto';
      dropdown.style.top = '100%';
      dropdown.style.marginTop = '4px';
      dropdown.style.marginBottom = '0';
    }
  }

  /**
   * Get custom prompts from knowledge base
   */
  async getCustomPrompts() {
    try {
      // Use knowledge base manager if available
      if (window.knowledgeBaseManager) {
        return window.knowledgeBaseManager.getAllCustomPrompts();
      }

      // Fallback to direct storage access
      const result = await storageManager.get('customPrompts');
      return result.customPrompts || {};
    } catch (error) {
      console.error('Failed to get custom prompts:', error);
      return {};
    }
  }

  /**
   * Get default prompts
   */
  getDefaultPrompts() {
    // Use centralized prompt manager if available
    if (window.promptManager && window.promptManager.initialized) {
      return window.promptManager.getAllPrompts();
    }

    // Use knowledge base manager as fallback
    if (window.knowledgeBaseManager) {
      const allPrompts = window.knowledgeBaseManager.getAllPrompts();
      if (Object.keys(allPrompts).length > 0) {
        return allPrompts;
      }
    }

    // Final fallback prompts
    return {
      'summary': {
        name: 'Summary',
        title: 'Summary',
        description: 'Summarize the conversation and extract key details like budget, timeline, and next steps'
      },
      'follow_up': {
        name: 'Follow-up',
        title: 'Follow-up',
        description: 'Write a friendly and professional follow-up message based on conversation'
      },
      'proposal': {
        name: 'Proposal',
        title: 'Proposal',
        description: 'Create a Fiverr project proposal based on the conversation'
      },
      'translate': {
        name: 'Translate',
        title: 'Translate',
        description: 'Translate conversation into specified language'
      },
      'improve_translate': {
        name: 'Improve & Translate',
        title: 'Improve & Translate',
        description: 'Improve grammar and tone, then translate to English'
      },
      'improve': {
        name: 'Improve',
        title: 'Improve',
        description: 'Improve message grammar, clarity and professionalism'
      }
    };
  }

  /**
   * Execute selected prompt
   */
  async executePrompt(inputElement, promptKey) {
    try {
      // Clear any existing notifications first
      this.clearMessageIconNotification();
      await this.generateReplyWithPrompt(inputElement, promptKey);
    } catch (error) {
      console.error('Failed to execute prompt:', error);
      this.showMessageIconNotification('Failed to generate reply', inputElement);
    }
  }

  /**
   * Clear existing message icon notification
   */
  clearMessageIconNotification() {
    const existingNotification = document.querySelector('.aifiverr-message-icon-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
  }

  /**
   * Show notification next to the message icon (simple positioning)
   */
  showMessageIconNotification(message, inputElement, duration = 3000) {
    // Clear any existing notification
    this.clearMessageIconNotification();

    // Find the message icon container
    const messageIconContainer = inputElement.parentElement?.querySelector('.aifiverr-message-icon-container');
    if (!messageIconContainer) {
      // Fallback to regular tooltip if message icon not found
      showTooltip(message, inputElement);
      if (duration > 0) setTimeout(removeTooltip, duration);
      return;
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'aifiverr-message-icon-notification';
    notification.textContent = message;

    // Simple positioning: just append to the message icon container and position to the right
    messageIconContainer.style.position = 'relative';
    messageIconContainer.appendChild(notification);

    // Position to the right of the icon
    Object.assign(notification.style, {
      position: 'absolute',
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
      zIndex: '1002',
      whiteSpace: 'nowrap'
    });

    // Auto-remove after duration (if duration > 0)
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, duration);
    }
  }

  /**
   * Create message toggle button for dropdown
   */
  createMessageToggleButton() {
    const button = document.createElement('button');
    button.className = 'aifiverr-message-toggle';
    button.innerHTML = '⚡';
    button.title = 'aiFiverr: Message Actions';

    const buttonStyles = {
      backgroundColor: '#6366f1',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '28px',
      height: '28px',
      fontSize: '14px',
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };

    Object.assign(button.style, buttonStyles);

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#4f46e5';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#6366f1';
      button.style.transform = 'scale(1)';
    });

    // Toggle dropdown on click
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = button.parentElement.querySelector('.aifiverr-message-dropdown');
      if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
      }
    });

    return button;
  }

  /**
   * Create message dropdown menu
   */
  createMessageDropdown(messageElement) {
    const dropdown = document.createElement('div');
    dropdown.className = 'aifiverr-message-dropdown';

    const dropdownStyles = {
      position: 'absolute',
      top: '35px',
      right: '0',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
      minWidth: '200px',
      zIndex: '1001',
      display: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    };

    Object.assign(dropdown.style, dropdownStyles);

    // Create dropdown items
    const actions = [
      { key: 'translate_message', label: 'Translate', icon: '🌐' },
      { key: 'summarize_message', label: 'Summarize', icon: '📝' },
      { key: 'analyze', label: 'Analyze', icon: '🔍' }
    ];

    actions.forEach(action => {
      const item = document.createElement('div');
      item.className = 'aifiverr-dropdown-item';
      item.innerHTML = `<span class="dropdown-icon">${action.icon}</span> ${action.label}`;

      const itemStyles = {
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #f3f4f6',
        transition: 'background-color 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        color: '#374151'
      };

      Object.assign(item.style, itemStyles);

      // Hover effects
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f9fafb';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });

      // Click handler
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdown.style.display = 'none';
        await this.handleMessageAction(messageElement, action.key);
      });

      dropdown.appendChild(item);
    });

    // Remove border from last item
    const lastItem = dropdown.lastElementChild;
    if (lastItem) {
      lastItem.style.borderBottom = 'none';
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !dropdown.parentElement.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    return dropdown;
  }





  /**
   * Create button container
   */
  createButtonContainer() {
    const container = document.createElement('div');
    container.className = 'aifiverr-button-container';
    
    Object.assign(container.style, {
      display: 'flex',
      gap: '8px',
      margin: '8px 0',
      alignItems: 'center'
    });

    return container;
  }

  /**
   * Insert button container near input element
   */
  insertButtonContainer(inputElement, container) {
    // Try to find the best place to insert
    const parent = inputElement.parentNode;
    
    if (parent) {
      // Insert after the input element
      parent.insertBefore(container, inputElement.nextSibling);
    } else {
      // Fallback: append to body
      document.body.appendChild(container);
    }
  }

  /**
   * Handle chat generation
   */
  async handleChatGeneration(inputElement) {
    try {
      showTooltip('Generating reply...', inputElement);

      // Get conversation context
      const conversationData = await fiverrExtractor.extractConversation();
      const context = conversationData ? fiverrExtractor.getConversationSummary(conversationData) : '';

      // Get or create session
      const session = await sessionManager.getOrCreateSession(window.location.href);

      // Generate reply using AI
      const reply = await this.generateAIReply(context, session);

      if (reply) {
        inputElement.value = reply;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      }

      removeTooltip();
    } catch (error) {
      console.error('Chat generation failed:', error);
      showTooltip('Failed to generate reply', inputElement);
      setTimeout(removeTooltip, 3000);
    }
  }

  /**
   * Handle prompt selection for chat generation
   */
  async handlePromptSelection(inputElement) {
    try {
      if (!window.promptSelector) {
        console.error('Prompt selector not available');
        showTooltip('Prompt selector not available', inputElement);
        setTimeout(removeTooltip, 3000);
        return;
      }

      // Show prompt selector with callback
      await window.promptSelector.show(inputElement, async (promptKey, element) => {
        await this.generateReplyWithPrompt(element, promptKey);
      });
    } catch (error) {
      console.error('Failed to show prompt selector:', error);
      showTooltip('Failed to show prompt selector', inputElement);
      setTimeout(removeTooltip, 3000);
    }
  }

  /**
   * Generate reply with specific prompt
   */
  async generateReplyWithPrompt(inputElement, promptKey) {
    const messageIconContainer = inputElement.parentElement?.querySelector('.aifiverr-message-icon-container');
    const messageIcon = messageIconContainer?.querySelector('.aifiverr-message-icon-button');

    try {
      // Start loading animation on message icon
      this.startMessageIconLoading(messageIcon);

      // Get conversation context
      const conversationData = await fiverrExtractor.extractConversation();
      const context = conversationData ? fiverrExtractor.getConversationSummary(conversationData) : '';

      // Get or create session
      const session = await sessionManager.getOrCreateSession(window.location.href);

      // Generate reply using AI with specific prompt
      const reply = await this.generateAIReply(context, session, promptKey);

      if (reply) {
        // Remove markdown formatting from the reply
        const cleanReply = removeMarkdownFormatting(reply);
        inputElement.value = cleanReply;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        this.showMessageIconNotification('Reply generated successfully!', inputElement, 2000);
      } else {
        this.showMessageIconNotification('No reply generated', inputElement);
      }
    } catch (error) {
      console.error('Chat generation with prompt failed:', error);
      this.showMessageIconNotification('Failed to generate reply', inputElement);
    } finally {
      // Stop loading animation
      this.stopMessageIconLoading(messageIcon);
    }
  }

  /**
   * Start loading animation on message icon
   */
  startMessageIconLoading(messageIcon) {
    if (!messageIcon) return;

    messageIcon.classList.add('loading');
    messageIcon.innerHTML = '💬';

    // Add animated dots
    let dotCount = 0;
    const animateIcon = () => {
      if (!messageIcon.classList.contains('loading')) return;

      dotCount = (dotCount + 1) % 4;
      const dots = '.'.repeat(dotCount);
      messageIcon.innerHTML = `💬${dots}`;

      setTimeout(animateIcon, 500);
    };

    setTimeout(animateIcon, 500);
  }

  /**
   * Stop loading animation on message icon
   */
  stopMessageIconLoading(messageIcon) {
    if (!messageIcon) return;

    messageIcon.classList.remove('loading');
    messageIcon.innerHTML = '💬';
  }













  /**
   * Handle message action (translate, summarize, analyze)
   */
  async handleMessageAction(messageElement, actionKey) {
    try {
      const messageData = fiverrExtractor.parseMessageElement(messageElement);
      if (!messageData) {
        showTooltip('Could not extract message content', messageElement);
        setTimeout(removeTooltip, 3000);
        return;
      }

      const messageContent = messageData.content;
      let result;

      switch (actionKey) {
        case 'translate_message':
          result = await this.handleTranslateMessage(messageContent, messageElement);
          break;
        case 'summarize_message':
          result = await this.handleSummarizeMessage(messageContent, messageElement);
          break;
        case 'analyze':
          result = await this.handleAnalyzeMessage(messageContent, messageElement);
          break;
        default:
          console.warn('Unknown action key:', actionKey);
          return;
      }

      if (result) {
        this.showActionResult(result, messageElement, actionKey);
      }
    } catch (error) {
      console.error(`Message action '${actionKey}' failed:`, error);
      showTooltip(`Failed to ${actionKey.replace('_', ' ')}`, messageElement);
      setTimeout(removeTooltip, 3000);
    }
  }

  /**
   * Handle translate message action
   */
  async handleTranslateMessage(messageContent, messageElement) {
    // Show language selection popup
    const language = await this.showLanguageSelector(messageElement);
    if (!language) return null;

    showTooltip(`Translating to ${language}...`, messageElement);

    try {
      // Get conversation context
      const conversationData = await fiverrExtractor.extractConversation();
      const context = conversationData ? fiverrExtractor.getConversationSummary(conversationData) : '';

      // Prepare context variables
      const contextVars = {
        message: messageContent,
        language: language,
        conversation: context
      };

      // Process translate prompt
      const result = await knowledgeBaseManager.processPrompt('translate_message', contextVars);
      const prompt = typeof result === 'object' ? result.prompt : result;
      const knowledgeBaseFiles = typeof result === 'object' ? result.knowledgeBaseFiles : [];

      console.log('aiFiverr Injector: Translation - Knowledge base files:', knowledgeBaseFiles);
      console.log('aiFiverr Injector: Translation - Files details:', knowledgeBaseFiles.map(f => ({
        name: f.name,
        id: f.id,
        geminiUri: f.geminiUri,
        hasGeminiUri: !!f.geminiUri
      })));

      const response = await geminiClient.generateContent(prompt, { knowledgeBaseFiles });

      removeTooltip();
      return {
        title: `Translation (${language})`,
        content: removeMarkdownFormatting(response.text)
      };
    } catch (error) {
      console.error('Translation failed:', error);
      removeTooltip();
      throw error;
    }
  }

  /**
   * Handle summarize message action
   */
  async handleSummarizeMessage(messageContent, messageElement) {
    showTooltip('Summarizing message...', messageElement);

    try {
      // Get conversation context
      const conversationData = await fiverrExtractor.extractConversation();
      const context = conversationData ? fiverrExtractor.getConversationSummary(conversationData) : '';

      // Prepare context variables
      const contextVars = {
        message: messageContent,
        conversation: context
      };

      // Process summarize prompt
      const prompt = await knowledgeBaseManager.processPrompt('summarize_message', contextVars);
      const response = await geminiClient.generateContent(prompt);

      removeTooltip();
      return {
        title: 'Summary',
        content: removeMarkdownFormatting(response.text)
      };
    } catch (error) {
      console.error('Summarization failed:', error);
      removeTooltip();
      throw error;
    }
  }

  /**
   * Handle analyze message action
   */
  async handleAnalyzeMessage(messageContent, messageElement) {
    showTooltip('Analyzing message...', messageElement);

    try {
      // Use existing analysis method
      const analysis = await this.analyzeMessage(messageContent);

      removeTooltip();
      return {
        title: 'Analysis',
        content: analysis
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      removeTooltip();
      throw error;
    }
  }

  /**
   * Handle message analysis (legacy method for compatibility)
   */
  async handleMessageAnalysis(messageElement) {
    await this.handleMessageAction(messageElement, 'analyze');
  }

  /**
   * Handle proposal generation
   */
  async handleProposalGeneration(inputElement) {
    try {
      showTooltip('Generating proposal...', inputElement);
      
      // Extract brief details if available
      const briefData = fiverrExtractor.extractBriefDetails();
      
      // Generate proposal using AI
      const proposal = await this.generateAIProposal(briefData);
      
      if (proposal) {
        inputElement.value = proposal;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      removeTooltip();
    } catch (error) {
      console.error('Proposal generation failed:', error);
      showTooltip('Failed to generate proposal', inputElement);
      setTimeout(removeTooltip, 3000);
    }
  }





  /**
   * Check if element is a message element
   */
  isMessageElement(element) {
    const messageSelectors = [
      '[data-testid*="message"]',
      '.message-bubble',
      '.chat-message',
      '.conversation-message'
    ];

    return messageSelectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Start monitoring for new elements - CONSERVATIVE
   */
  startMonitoring() {
    // Less frequent detection to avoid spam
    setInterval(() => {
      fiverrDetector.detectAllElements();
    }, 10000); // Check every 10 seconds only

    // More conservative DOM monitoring - only for textareas
    const observer = new MutationObserver((mutations) => {
      let shouldRedetect = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Only check for textareas being added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // Only care about textareas
              if (element.tagName === 'TEXTAREA' ||
                  element.querySelector('textarea')) {
                shouldRedetect = true;
              }
            }
          });
        }
      });

      if (shouldRedetect) {
        setTimeout(() => {
          fiverrDetector.detectAllElements();
        }, 2000); // Longer delay to let DOM settle
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store observer for cleanup
    this.mutationObserver = observer;
  }

  /**
   * Add manual trigger for testing/debugging
   */
  addManualTrigger() {
    // Add a keyboard shortcut to manually trigger detection
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D: Manual detection trigger
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        console.log('aiFiverr: Manual detection triggered');
        this.forceDetectionAndInjection();
      }
    });

    // DISABLE automatic click-based detection - it's too aggressive
    // Only manual triggers now
  }

  /**
   * Force detection and injection - CONSERVATIVE
   */
  forceDetectionAndInjection() {
    console.log('aiFiverr: Force detecting elements...');

    // DON'T clear all processed markers - only clear if needed

    // Force detection through proper channels
    fiverrDetector.detectAllElements();

    // ONLY manually look for textareas with very specific criteria
    const textareas = document.querySelectorAll('textarea');
    console.log('aiFiverr: Found textareas:', textareas.length);

    let validTextareas = 0;
    textareas.forEach((textarea, index) => {
      console.log(`aiFiverr: Textarea ${index}:`, textarea);
      console.log('  - Placeholder:', textarea.placeholder);
      console.log('  - Is chat input:', fiverrDetector.isChatInput(textarea));
      console.log('  - Is processed:', fiverrDetector.isProcessed(textarea));

      if (fiverrDetector.isChatInput(textarea) && !fiverrDetector.isProcessed(textarea)) {
        console.log('  - Injecting button for textarea');
        this.injectChatInputButton(textarea);
        fiverrDetector.markAsProcessed(textarea);
        validTextareas++;
      }
    });

    console.log(`aiFiverr: Injected buttons for ${validTextareas} valid textareas`);

    // ONLY look for very specific message elements
    const messageElements = document.querySelectorAll('[data-qa="message-item"], [data-qa="message-bubble"], .message-item');
    console.log('aiFiverr: Found specific message elements:', messageElements.length);

    let validMessages = 0;
    messageElements.forEach((element, index) => {
      if (!fiverrDetector.isProcessed(element) &&
          element.textContent &&
          element.textContent.trim().length > 20 &&
          element.textContent.trim().length < 1000) {
        console.log(`aiFiverr: Injecting message button for element ${index}:`, element);
        this.injectMessageAnalysisButton(element);
        fiverrDetector.markAsProcessed(element);
        validMessages++;
      }
    });

    console.log(`aiFiverr: Injected buttons for ${validMessages} valid messages`);
  }

  /**
   * AI integration methods
   */
  async generateAIReply(context, session, promptKey = null) {
    try {
      // Use specified prompt key or default to professional reply
      const selectedPromptKey = promptKey || 'professional_initial_reply';

      // Get the prompt text first
      let promptText = '';
      try {
        if (window.knowledgeBaseManager) {
          const prompt = window.knowledgeBaseManager.getPrompt(selectedPromptKey);
          promptText = prompt ? prompt.prompt : '';
        }
      } catch (error) {
        console.warn('aiFiverr Injector: Could not get prompt text:', error);
      }

      // Prepare available context for variable processor
      const availableContext = {
        conversation: context || '', // Use provided context or empty
        username: 'Client', // Default username
        reply: '' // No reply context in this flow
      };

      // CRITICAL FIX: Use knowledge base manager for saved prompts to get attached files
      let prompt;
      let knowledgeBaseFiles = [];

      if (window.knowledgeBaseManager && selectedPromptKey) {
        // Use knowledge base manager for saved prompts to get attached files
        console.log('aiFiverr Injector: Using knowledge base manager for saved prompt:', selectedPromptKey);
        const processedResult = await window.knowledgeBaseManager.processPrompt(selectedPromptKey, availableContext);
        prompt = processedResult.prompt;
        knowledgeBaseFiles = processedResult.knowledgeBaseFiles || [];

        console.log('aiFiverr Injector: Files from saved prompt:', knowledgeBaseFiles.length);
        console.log('aiFiverr Injector: Files details:', knowledgeBaseFiles.map(f => ({
          name: f.name,
          hasGeminiUri: !!f.geminiUri,
          mimeType: f.mimeType
        })));

      } else if (window.variableProcessor && promptText) {
        // Use variable processor for dynamic prompts
        console.log('aiFiverr Injector: Using variable processor for dynamic prompt processing');
        const processedResult = await window.variableProcessor.processPrompt(promptText, availableContext);
        prompt = processedResult.prompt;
        knowledgeBaseFiles = processedResult.knowledgeBaseFiles || [];

        console.log('aiFiverr Injector: Using variable processor for AI reply');
        console.log('aiFiverr Injector: Variables used:', processedResult.usedVariables);
        console.log('aiFiverr Injector: Files used:', processedResult.usedFiles);
      } else {
        // Fallback to knowledge base manager
        try {
          const contextVars = {
            conversation: context || '',
            username: 'Client'
          };

          const result = await knowledgeBaseManager.processPrompt(selectedPromptKey, contextVars);
          prompt = typeof result === 'object' ? result.prompt : result;
          knowledgeBaseFiles = typeof result === 'object' ? result.knowledgeBaseFiles : [];

          console.log('aiFiverr Injector: Using knowledge base manager fallback');
        } catch (kbError) {
          console.warn(`Prompt '${selectedPromptKey}' not found, using basic fallback:`, kbError);
          // Basic fallback prompt
          prompt = 'Generate a professional reply for this Fiverr conversation';
          if (context) {
            prompt += `\n\nConversation context:\n${context}`;
          }
          prompt += '\n\nPlease generate an appropriate, professional response that addresses the conversation context.';
        }
      }

      console.log('aiFiverr Injector: Chat Reply - Calling generateChatReply with options:', { knowledgeBaseFiles });
      const response = await geminiClient.generateChatReply(session, prompt, { knowledgeBaseFiles });
      return removeMarkdownFormatting(response.response);
    } catch (error) {
      console.error('AI reply generation failed:', error);
      throw new Error('Failed to generate AI reply');
    }
  }

  async analyzeMessage(content) {
    try {
      const analysis = await geminiClient.analyzeMessage(content);
      return analysis;
    } catch (error) {
      console.error('Message analysis failed:', error);
      throw new Error('Failed to analyze message');
    }
  }

  async generateAIProposal(briefData) {
    try {
      // Extract username and conversation context
      const username = fiverrExtractor.extractUsernameFromUrl();
      const conversationData = await fiverrExtractor.extractConversation();

      // Prepare context variables for prompt processing
      const contextVars = {
        username: username || 'Client',
        conversation: conversationData ? fiverrExtractor.conversationToContext(conversationData) : '',
        proposal: briefData ? this.formatBriefData(briefData) : 'No brief data available'
      };

      // Use knowledge base manager to process the project proposal prompt
      let prompt;
      let knowledgeBaseFiles = [];
      try {
        const result = await knowledgeBaseManager.processPrompt('project_proposal', contextVars);
        prompt = typeof result === 'object' ? result.prompt : result;
        knowledgeBaseFiles = typeof result === 'object' ? result.knowledgeBaseFiles : [];

        console.log('aiFiverr Injector: Project Proposal - Knowledge base files from prompt:', knowledgeBaseFiles.length);

        // CRITICAL FIX: If prompt has no files attached, force load all available knowledge base files
        if (!knowledgeBaseFiles || knowledgeBaseFiles.length === 0) {
          console.warn('aiFiverr Injector: Project proposal prompt has no files attached, force loading all KB files');
          knowledgeBaseFiles = await this.getKnowledgeBaseFilesForced();
        }

        console.log('aiFiverr Injector: Project Proposal - Final knowledge base files:', knowledgeBaseFiles);
        console.log('aiFiverr Injector: Project Proposal - Files details:', knowledgeBaseFiles.map(f => ({
          name: f.name,
          id: f.id,
          geminiUri: f.geminiUri,
          hasGeminiUri: !!f.geminiUri
        })));
      } catch (error) {
        console.warn('Project proposal prompt not found, using fallback with files:', error);

        // Force load knowledge base files
        const knowledgeBase = await storageManager.getKnowledgeBase();
        const kbFiles = await this.getKnowledgeBaseFilesForced();

        console.log('aiFiverr Injector: Forced KB files:', kbFiles);
        console.log('aiFiverr Injector: Forced KB files details:', kbFiles.map(f => ({
          name: f.name,
          id: f.id,
          geminiUri: f.geminiUri,
          hasGeminiUri: !!f.geminiUri
        })));

        return await geminiClient.generateProposal(briefData, knowledgeBase, { knowledgeBaseFiles: kbFiles });
      }

      // Generate proposal using the processed prompt
      console.log('aiFiverr Injector: Project Proposal - Calling generateContent with options:', { knowledgeBaseFiles });
      console.log('aiFiverr Injector: Project Proposal - Files count:', knowledgeBaseFiles.length);
      console.log('aiFiverr Injector: Project Proposal - Files with Gemini URI:', knowledgeBaseFiles.filter(f => f.geminiUri).length);

      const response = await geminiClient.generateContent(prompt, { knowledgeBaseFiles });
      return removeMarkdownFormatting(response.text);
    } catch (error) {
      console.error('AI proposal generation failed:', error);
      throw new Error('Failed to generate AI proposal');
    }
  }

  /**
   * Format brief data for prompt context
   */
  formatBriefData(briefData) {
    if (!briefData) return 'No brief data available';

    let formatted = '';
    if (briefData.title) formatted += `Title: ${briefData.title}\n`;
    if (briefData.description) formatted += `Description: ${briefData.description}\n`;
    if (briefData.overview) formatted += `Brief Overview: ${briefData.overview}\n`;
    if (briefData.requirements?.length) formatted += `Requirements: ${briefData.requirements.join(', ')}\n`;
    if (briefData.budget) formatted += `Budget: ${briefData.budget}\n`;
    if (briefData.deadline) formatted += `Deadline: ${briefData.deadline}\n`;
    if (briefData.skills?.length) formatted += `Skills needed: ${briefData.skills.join(', ')}\n`;

    return formatted || 'No specific brief details available';
  }







  /**
   * Force load knowledge base files (emergency fix)
   */
  async getKnowledgeBaseFilesForced() {
    try {
      console.log('aiFiverr Injector: Force loading knowledge base files...');

      if (!window.knowledgeBaseManager) {
        console.warn('Knowledge base manager not available');
        return [];
      }

      const result = await window.knowledgeBaseManager.getKnowledgeBaseFilesFromBackground();
      if (result.success && result.data) {
        const files = result.data.filter(file => file.geminiUri);
        console.log('aiFiverr Injector: Forced files loaded:', files.length);
        console.log('aiFiverr Injector: Forced files details:', files.map(f => ({
          name: f.name,
          geminiUri: f.geminiUri,
          mimeType: f.mimeType
        })));
        return files;
      }

      console.warn('aiFiverr Injector: No files returned from background');
      return [];
    } catch (error) {
      console.error('Failed to force load knowledge base files:', error);
      return [];
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Show analysis popup
   */
  showAnalysisPopup(analysis, targetElement) {
    // Use CSP-safe popup creation
    if (window.cspSafeDOMUtils && (window.aiFiverrUseCSPSafeMode || window.cspSafeDOMUtils.isStrictCSPSite())) {
      const popup = window.cspSafeDOMUtils.createPopup({
        title: 'Message Analysis',
        content: analysis,
        className: 'aifiverr-analysis-popup',
        closable: true,
        modal: true
      });

      window.cspSafeDOMUtils.showPopup(popup);
      return popup;
    }

    // Fallback for non-strict sites
    const popup = document.createElement('div');
    popup.className = 'aifiverr-analysis-popup';
    popup.innerHTML = `
      <div class="popup-header">
        <h4>Message Analysis</h4>
        <button class="close-btn">×</button>
      </div>
      <div class="popup-content">
        ${analysis}
      </div>
    `;

    // Style the popup only if inline styles are allowed
    if (!window.facebookErrorHandler || window.facebookErrorHandler.areInlineStylesAllowed()) {
      Object.assign(popup.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '400px',
        zIndex: '10001',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      });
    }

    document.body.appendChild(popup);

    // Close button functionality
    popup.querySelector('.close-btn').addEventListener('click', () => {
      popup.remove();
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 10000);
  }

  /**
   * Show language selector popup
   */
  async showLanguageSelector(messageElement) {
    return new Promise((resolve) => {
      // Remove existing selector
      const existingSelector = document.querySelector('.aifiverr-language-selector');
      if (existingSelector) {
        existingSelector.remove();
      }

      const selector = document.createElement('div');
      selector.className = 'aifiverr-language-selector';

      const languages = [
        'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
        'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi'
      ];

      selector.innerHTML = `
        <div class="language-selector-backdrop"></div>
        <div class="language-selector-modal">
          <div class="language-selector-header">
            <h3>Select Target Language</h3>
            <button class="close-btn">×</button>
          </div>
          <div class="language-selector-content">
            ${languages.map(lang => `
              <div class="language-option" data-language="${lang}">
                ${lang}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Style the selector
      const selectorStyles = {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '10002',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      };
      Object.assign(selector.style, selectorStyles);

      document.body.appendChild(selector);

      // Event listeners
      selector.querySelector('.close-btn').addEventListener('click', () => {
        selector.remove();
        resolve(null);
      });

      selector.querySelector('.language-selector-backdrop').addEventListener('click', () => {
        selector.remove();
        resolve(null);
      });

      selector.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', () => {
          const language = option.dataset.language;
          selector.remove();
          resolve(language);
        });
      });
    });
  }

  /**
   * Show action result popup
   */
  showActionResult(result, messageElement, actionKey) {
    // Remove existing popup
    const existingPopup = document.querySelector('.aifiverr-action-result-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Use CSP-safe popup creation
    if (window.cspSafeDOMUtils && (window.aiFiverrUseCSPSafeMode || window.cspSafeDOMUtils.isStrictCSPSite())) {
      // Create content container with copy button
      const contentContainer = window.cspSafeDOMUtils.createElement('div');

      const contentDiv = window.cspSafeDOMUtils.createElement('div', {
        textContent: result.content,
        styles: {
          marginBottom: '16px',
          lineHeight: '1.5'
        }
      });

      const copyButton = window.cspSafeDOMUtils.createElement('button', {
        textContent: 'Copy',
        styles: {
          backgroundColor: '#1dbf73',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          cursor: 'pointer'
        }
      });

      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(result.content);
        copyButton.textContent = 'Copied!';
        setTimeout(() => copyButton.textContent = 'Copy', 2000);
      });

      contentContainer.appendChild(contentDiv);
      contentContainer.appendChild(copyButton);

      const popup = window.cspSafeDOMUtils.createPopup({
        title: result.title,
        content: contentContainer,
        className: 'aifiverr-action-result-popup',
        closable: true,
        modal: true
      });

      window.cspSafeDOMUtils.showPopup(popup);
      return popup;
    }

    // Fallback for non-strict sites
    const popup = document.createElement('div');
    popup.className = 'aifiverr-action-result-popup';
    popup.innerHTML = `
      <div class="result-header">
        <h3>${result.title}</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="result-content">
        ${result.content.replace(/\n/g, '<br>')}
      </div>
      <div class="result-actions">
        <button class="copy-btn">Copy</button>
      </div>
    `;

    // Position popup near the message
    const rect = messageElement.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = `${Math.min(rect.top + window.scrollY - 10, window.innerHeight - 400)}px`;
    popup.style.left = `${Math.min(rect.right + 10, window.innerWidth - 350)}px`;
    popup.style.zIndex = '10000';

    document.body.appendChild(popup);

    // Event listeners
    popup.querySelector('.close-btn').addEventListener('click', () => {
      popup.remove();
    });

    popup.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(result.content).then(() => {
        showTooltip('Copied to clipboard!', popup.querySelector('.copy-btn'));
        setTimeout(removeTooltip, 2000);
      });
    });

    // Auto-close after 15 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 15000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup injected elements
   */
  cleanup() {
    this.injectedElements.forEach((element) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.injectedElements.clear();

    if (this.floatingWidget && this.floatingWidget.parentNode) {
      this.floatingWidget.parentNode.removeChild(this.floatingWidget);
      this.floatingWidget = null;
    }
  }
}

// Create global injector instance - but only when explicitly called
function initializeFiverrInjector() {
  if (!window.fiverrInjector) {
    window.fiverrInjector = new FiverrInjector();
    console.log('aiFiverr: Fiverr Injector created');
  }
  return window.fiverrInjector;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeFiverrInjector = initializeFiverrInjector;

// REMOVED AUTO-INITIALIZATION - This was causing the Fiverr injector to load on every website
// The Fiverr injector should only be initialized when explicitly called by the main extension
