/**
 * Text Selection Handler for aiFiverr Extension
 * Detects text selection, copies to clipboard, and shows floating action icon
 */

class TextSelector {
  constructor() {
    this.isActive = false;
    this.isEnabled = true; // New property to control if floating icon should appear
    this.currentSelection = null;
    this.floatingIcon = null;
    this.contextMenu = null;
    this.selectedText = '';
    this.replyText = ''; // Store text for {reply} variable
    this.selectionRect = null;
    this.hideTimeout = null;
    this.isInteractingWithUI = false;
    this.preservedSelection = null; // Store selection to prevent clearing
    this.preservedRange = null; // Store range to restore selection

    this.init();
  }

  /**
   * Initialize text selection handler
   */
  async init() {
    console.log('aiFiverr: Initializing text selector...');

    // Load enabled state from settings
    await this.loadEnabledState();

    // TEMPORARY FIX: Always initialize for debugging
    // TODO: Restore site restriction check after debugging
    console.log('aiFiverr: Text selector initializing on all sites for debugging');

    this.setupEventListeners();
    this.createFloatingIcon();
    this.isActive = true;
  }

  /**
   * Check if text selector should initialize on current site based on settings
   */
  async shouldInitializeOnCurrentSite() {
    try {
      // Get settings from storage
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};

      // Default to restricting to Fiverr only (restrictToFiverr: true) - consistent with other components
      const restrictToFiverr = settings.restrictToFiverr !== false;

      if (restrictToFiverr) {
        // Only initialize on Fiverr pages
        return window.location.hostname.includes('fiverr.com');
      } else {
        // Initialize on all sites
        return true;
      }
    } catch (error) {
      console.error('aiFiverr: Error checking site restriction settings:', error);
      // Default to Fiverr only if there's an error
      return window.location.hostname.includes('fiverr.com');
    }
  }

  /**
   * Setup event listeners for text selection
   */
  setupEventListeners() {
    // Listen for text selection events
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Hide floating icon when clicking elsewhere
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));

    // Handle window resize - only hide dropdown, never hide the icon
    window.addEventListener('resize', () => {
      if (this.contextMenu && this.contextMenu.style.display === 'block') {
        this.contextMenu.style.display = 'none';
      }
      // Note: Icon position will be updated when user makes a new selection
    });

    // Handle scroll - only hide dropdown if scrolling outside the dropdown area
    document.addEventListener('scroll', (e) => {
      // Don't hide dropdown if scrolling within the dropdown itself
      if (this.contextMenu && this.contextMenu.style.display === 'block') {
        // Check if the scroll event is coming from within the dropdown
        if (!this.contextMenu.contains(e.target)) {
          this.contextMenu.style.display = 'none';
        }
      }
    }, true);
  }

  /**
   * Handle mouse up events (end of selection)
   */
  async handleMouseUp(e) {
    // Don't process selection if interacting with our UI elements
    if (this.floatingIcon && this.floatingIcon.contains(e.target)) {
      return;
    }
    if (this.contextMenu && this.contextMenu.contains(e.target)) {
      return;
    }

    // Small delay to ensure selection is complete
    setTimeout(async () => {
      await this.checkSelection(e);
    }, 10);
  }

  /**
   * Handle keyboard selection (Shift+Arrow keys, Ctrl+A, etc.)
   */
  async handleKeyUp(e) {
    // Check for selection-related keys
    if (e.shiftKey || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
        (e.ctrlKey && e.key === 'a')) {
      setTimeout(async () => {
        await this.checkSelection(e);
      }, 10);
    }
  }

  /**
   * Handle mouse down events - only hide dropdown, never hide the icon automatically
   */
  handleMouseDown(e) {
    // Don't hide anything if clicking on our UI elements
    if (this.floatingIcon && this.floatingIcon.contains(e.target)) {
      return;
    }
    if (this.contextMenu && this.contextMenu.contains(e.target)) {
      return;
    }

    // Only hide the dropdown when clicking outside, but keep the icon visible
    if (this.contextMenu && this.contextMenu.style.display === 'block') {
      this.contextMenu.style.display = 'none';
    }

    // IMPORTANT: Never hide the floating icon automatically
    // The icon should only be hidden when the close button is clicked
  }

  /**
   * Check current text selection and handle it
   */
  async checkSelection(e) {
    // Don't process if floating icon is disabled
    if (!this.isEnabled) {
      return;
    }

    // Don't hide icon if user is interacting with our UI
    if (this.isInteractingWithUI) {
      return;
    }

    const selection = window.getSelection();

    // If there's already a floating icon visible, don't hide it unless explicitly closed
    if (this.floatingIcon && this.floatingIcon.style.display === 'flex') {
      // Only process new selections, don't hide existing icon
      if (!selection || selection.rangeCount === 0 || selection.toString().trim().length < 3) {
        return; // Keep existing icon visible
      }
    }

    if (!selection || selection.rangeCount === 0) {
      // Don't hide existing icon, just return
      return;
    }

    const selectedText = selection.toString().trim();
    console.log('aiFiverr: Text selected:', selectedText.length, 'characters');

    // Minimum text length requirement
    if (selectedText.length < 3) {
      console.log('aiFiverr: Text too short, keeping existing icon if present');
      // Don't hide existing icon, just return
      return;
    }

    // Check if selection is within valid content areas
    const isValid = await this.isValidSelectionArea(selection);
    console.log('aiFiverr: Selection area valid:', isValid);

    if (!isValid) {
      // Don't hide existing icon, just return
      return;
    }

    console.log('aiFiverr: Showing floating icon for selected text');

    // FEATURE 2: Multi-selection conversation building
    // Append new selection to existing conversation instead of replacing
    if (this.selectedText && this.selectedText.trim().length > 0) {
      // FIXED: Check for duplicate content before appending
      const existingParts = this.selectedText.split('\n\n---\n\n');
      const isDuplicate = existingParts.some(part =>
        part.trim() === selectedText.trim() ||
        this.calculateSimilarity(part.trim(), selectedText.trim()) > 0.9
      );

      if (!isDuplicate) {
        // Add separator and append new selection
        this.selectedText += '\n\n---\n\n' + selectedText;
        // Appended new selection to existing conversation
      } else {
        // Duplicate content detected, skipping append
        // Show brief notification to user
        this.showToast('Duplicate content detected - not added to conversation', 'warning');
      }
    } else {
      // First selection
      this.selectedText = selectedText;
      // First selection added to conversation
    }

    // Update badge counter for each selection (including first and subsequent)
    this.updateSelectionBadge();

    this.currentSelection = selection;

    // Preserve selection and range for later restoration
    this.preservedSelection = selection;
    if (selection.rangeCount > 0) {
      this.preservedRange = selection.getRangeAt(0).cloneRange();
    }

    // Copy to clipboard
    await this.copyToClipboard(selectedText);

    // Get selection position - handle input fields differently
    this.selectionRect = this.getSelectionRect(selection);
    console.log('aiFiverr: Selection rect:', this.selectionRect);

    // Show floating icon
    this.showFloatingIcon();
  }

  /**
   * Get selection rectangle - handles both regular text and input fields
   */
  getSelectionRect(selection) {
    if (!selection.rangeCount) {
      console.log('aiFiverr: No selection range found');
      return null;
    }

    const range = selection.getRangeAt(0);

    // First, try to get the actual selection bounds using range.getBoundingClientRect()
    // This works for most cases including contentEditable elements
    let rect = range.getBoundingClientRect();

    console.log('aiFiverr: Range getBoundingClientRect:', rect);

    // If the rect has valid dimensions, use it
    if (rect.width > 0 && rect.height > 0) {
      // Ensure we have all required properties
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }

    // Fallback for input/textarea elements where range.getBoundingClientRect() might not work
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    // Handle different types of input elements
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const elementRect = element.getBoundingClientRect();

      // Try to get more precise position using selection properties
      const selectionStart = element.selectionStart || 0;
      const selectionEnd = element.selectionEnd || 0;

      if (selectionEnd > selectionStart && element.value) {
        try {
          // Create a temporary element to measure text position more accurately
          const tempDiv = document.createElement('div');
          const computedStyle = window.getComputedStyle(element);

          // Copy relevant styles to get accurate measurement
          tempDiv.style.position = 'absolute';
          tempDiv.style.visibility = 'hidden';
          tempDiv.style.whiteSpace = 'pre-wrap';
          tempDiv.style.wordWrap = 'break-word';
          tempDiv.style.font = computedStyle.font;
          tempDiv.style.fontSize = computedStyle.fontSize;
          tempDiv.style.fontFamily = computedStyle.fontFamily;
          tempDiv.style.lineHeight = computedStyle.lineHeight;
          tempDiv.style.width = elementRect.width + 'px';
          tempDiv.style.padding = computedStyle.padding;
          tempDiv.style.border = computedStyle.border;

          // Get text before selection end to calculate position
          const textBeforeEnd = element.value.substring(0, selectionEnd);
          tempDiv.textContent = textBeforeEnd;
          document.body.appendChild(tempDiv);

          const tempRect = tempDiv.getBoundingClientRect();
          document.body.removeChild(tempDiv);

          // Calculate position relative to the input element
          const padding = parseInt(computedStyle.paddingLeft) || 0;
          const estimatedX = elementRect.left + padding + (tempRect.width % elementRect.width);
          const estimatedY = elementRect.top + (Math.floor(tempRect.width / elementRect.width) * parseInt(computedStyle.lineHeight || '20'));

          return {
            left: Math.min(estimatedX, elementRect.right - 20),
            right: Math.min(estimatedX + 20, elementRect.right),
            top: Math.max(estimatedY, elementRect.top),
            bottom: Math.min(estimatedY + 20, elementRect.bottom),
            width: 20,
            height: 20
          };
        } catch (error) {
          console.warn('aiFiverr: Error calculating precise text position:', error);
        }
      }

      // Fallback: position near the right side of the input field
      return {
        left: elementRect.right - 40,
        right: elementRect.right - 10,
        top: elementRect.top + 5,
        bottom: elementRect.bottom - 5,
        width: 30,
        height: elementRect.height - 10
      };
    }

    // For contentEditable elements, try to use the range if available
    if (element.contentEditable === 'true') {
      try {
        // For contentEditable, the range should work better
        const rangeRect = range.getBoundingClientRect();
        if (rangeRect.width > 0 && rangeRect.height > 0) {
          return rangeRect;
        }
      } catch (error) {
        console.warn('aiFiverr: Error getting range rect for contentEditable:', error);
      }

      // Fallback to element bounds for contentEditable
      const elementRect = element.getBoundingClientRect();
      return {
        left: elementRect.right - 40,
        right: elementRect.right - 10,
        top: elementRect.top + 5,
        bottom: elementRect.bottom - 5,
        width: 30,
        height: Math.min(30, elementRect.height - 10)
      };
    }

    // For other elements, use element bounds
    const elementRect = element.getBoundingClientRect();
    return elementRect;
  }

  /**
   * Check if selection is in a valid area (including input fields, textareas, etc.)
   */
  async isValidSelectionArea(selection) {
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    console.log('aiFiverr: Checking selection area:', element.tagName, element.className);

    // Skip if selection is within our own UI elements
    if (element.closest('.aifiverr-floating-icon, .aifiverr-context-menu, .aifiverr-chat-container, .aifiverr-ui')) {
      console.log('aiFiverr: Selection within aiFiverr UI, skipping');
      return false;
    }

    // Allow selections from input fields, textareas, and contenteditable elements
    // This is the main fix - we now ALLOW these instead of rejecting them
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ||
        element.contentEditable === 'true') {
      console.log('aiFiverr: Selection in input field, allowing');
      return true;
    }

    // TEMPORARY FIX: Skip site restriction checks for debugging
    console.log('aiFiverr: Allowing all text selections for debugging');

    // Allow selection in general content areas (paragraphs, divs, etc.)
    const contentTags = ['P', 'DIV', 'SPAN', 'ARTICLE', 'SECTION', 'MAIN', 'TD', 'TH', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    const isValidTag = contentTags.includes(element.tagName);
    console.log('aiFiverr: Content tag check:', isValidTag, element.tagName);
    return isValidTag;
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      console.log('aiFiverr: Text copied to clipboard:', text.substring(0, 50) + '...');
    } catch (error) {
      console.error('aiFiverr: Failed to copy to clipboard:', error);
    }
  }

  /**
   * Create floating action icon with close button
   */
  createFloatingIcon() {
    // Create container for icon and close button
    this.floatingIcon = document.createElement('div');
    this.floatingIcon.className = 'aifiverr-text-selection-container';

    // Create main action button
    const actionButton = document.createElement('button');
    actionButton.className = 'aifiverr-text-selection-icon';
    actionButton.innerHTML = '💬'; // Same icon as chat
    actionButton.title = 'AI Text Actions';

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'aifiverr-text-selection-close';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';

    // Style container
    Object.assign(this.floatingIcon.style, {
      position: 'fixed',
      zIndex: '10000',
      display: 'none',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4px'
    });

    // Style action button exactly like the chat icon
    Object.assign(actionButton.style, {
      background: 'none',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      transition: 'all 0.2s ease',
      opacity: '0.7'
    });

    // Style close button
    Object.assign(closeButton.style, {
      background: 'rgba(0, 0, 0, 0.1)',
      border: 'none',
      fontSize: '14px',
      cursor: 'pointer',
      padding: '2px 4px',
      borderRadius: '50%',
      transition: 'all 0.2s ease',
      opacity: '0.6',
      color: '#666',
      width: '20px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    // Hover effects
    actionButton.addEventListener('mouseenter', () => {
      actionButton.style.opacity = '1';
      actionButton.style.transform = 'scale(1.1)';
    });

    actionButton.addEventListener('mouseleave', () => {
      actionButton.style.opacity = '0.7';
      actionButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.opacity = '1';
      closeButton.style.background = 'rgba(255, 0, 0, 0.1)';
      closeButton.style.color = '#ff0000';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.opacity = '0.6';
      closeButton.style.background = 'rgba(0, 0, 0, 0.1)';
      closeButton.style.color = '#666';
    });

    // Add click handlers
    actionButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('aiFiverr: Text selection icon clicked');

      // Restore selection if it was cleared
      this.restoreSelection();

      try {
        await this.showContextMenu();
      } catch (error) {
        console.error('aiFiverr: Error showing context menu:', error);
        this.showErrorMessage('Failed to show AI menu. Please try again.');
      }
    });

    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('aiFiverr: Close button clicked');
      this.hideFloatingIcon();
    });

    // Track when user is interacting with floating icon
    this.floatingIcon.addEventListener('mouseenter', () => {
      this.isInteractingWithUI = true;
    });

    this.floatingIcon.addEventListener('mouseleave', () => {
      this.isInteractingWithUI = false;
    });

    // Append buttons to container
    this.floatingIcon.appendChild(actionButton);
    this.floatingIcon.appendChild(closeButton);

    document.body.appendChild(this.floatingIcon);
  }

  /**
   * Position dropdown relative to icon - SAME AS CHAT DROPDOWN
   */
  positionDropdown() {
    if (!this.contextMenu || !this.floatingIcon) return;

    const iconRect = this.floatingIcon.getBoundingClientRect();
    const dropdownHeight = this.contextMenu.offsetHeight || 200;
    const viewportHeight = window.innerHeight;
    const spaceAbove = iconRect.top;
    const spaceBelow = viewportHeight - iconRect.bottom;

    // Position above icon if there's more space above, otherwise below
    if (spaceAbove > spaceBelow && spaceAbove > dropdownHeight + 20) {
      // Position above
      this.contextMenu.style.top = (iconRect.top - dropdownHeight - 4) + 'px';
    } else {
      // Position below
      this.contextMenu.style.top = (iconRect.bottom + 4) + 'px';
    }

    // Center horizontally relative to icon
    const iconCenterX = iconRect.left + (iconRect.width / 2);
    const dropdownWidth = this.contextMenu.offsetWidth || 200;
    let left = iconCenterX - (dropdownWidth / 2);

    // Keep within viewport
    const viewportWidth = window.innerWidth;
    if (left < 8) left = 8;
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    this.contextMenu.style.left = left + 'px';
  }

  /**
   * Show floating icon near selection
   */
  showFloatingIcon() {
    if (!this.floatingIcon || !this.selectionRect) {
      console.log('aiFiverr: Cannot show floating icon - missing icon or selectionRect:', {
        hasIcon: !!this.floatingIcon,
        hasRect: !!this.selectionRect,
        rect: this.selectionRect
      });
      return;
    }

    // Clear any existing hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Calculate position based on selection type
    const iconSize = 60; // Increased to accommodate close button
    const margin = 8;

    // Check if this is an input field selection by looking at the current selection
    const selection = window.getSelection();
    const isInputField = this.isInputFieldSelection(selection);

    let left, top;

    // Ensure we have valid rect dimensions
    const rect = {
      left: this.selectionRect.left || 0,
      right: this.selectionRect.right || this.selectionRect.left || 0,
      top: this.selectionRect.top || 0,
      bottom: this.selectionRect.bottom || this.selectionRect.top || 0,
      width: this.selectionRect.width || 0,
      height: this.selectionRect.height || 0
    };

    console.log('aiFiverr: Positioning icon with rect:', rect, 'isInputField:', isInputField);

    if (isInputField) {
      // For input fields, position icon closer to the text, vertically centered
      left = rect.right + margin;
      top = rect.top + (rect.height / 2) - (iconSize / 2);

      // If the icon would be too far to the right, position it to the left of the selection
      if (left + iconSize > window.innerWidth - margin) {
        left = rect.left - iconSize - margin;
      }
    } else {
      // For regular text, position at top-right of selection
      left = rect.right + margin;
      top = rect.top - margin;
    }

    // Ensure icon stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left + iconSize > viewportWidth) {
      left = rect.left - iconSize - margin;
    }

    if (top < 0) {
      top = rect.bottom + margin;
    }

    if (top + iconSize > viewportHeight) {
      top = viewportHeight - iconSize - margin;
    }

    // Ensure minimum positioning (prevent negative values)
    left = Math.max(0, left);
    top = Math.max(0, top);

    console.log('aiFiverr: Final icon position:', { left, top });

    // Position and show icon
    this.floatingIcon.style.left = `${left}px`;
    this.floatingIcon.style.top = `${top}px`;
    this.floatingIcon.style.display = 'flex';

    // Force a repaint to ensure positioning takes effect
    this.floatingIcon.offsetHeight;
  }

  /**
   * Check if current selection is in an input field
   */
  isInputFieldSelection(selection) {
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.contentEditable === 'true';
  }

  /**
   * Restore previously preserved selection
   */
  restoreSelection() {
    if (this.preservedRange) {
      try {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.preservedRange);
        console.log('aiFiverr: Selection restored');
      } catch (error) {
        console.warn('aiFiverr: Could not restore selection:', error);
      }
    }
  }

  /**
   * Hide floating icon - should only be called when user explicitly closes it
   */
  hideFloatingIcon() {
    console.log('aiFiverr: Hiding floating icon (explicit close)');

    if (this.floatingIcon) {
      this.floatingIcon.style.display = 'none';
    }

    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }

    // Clear selection data
    this.selectedText = '';
    this.replyText = ''; // Clear reply text
    this.currentSelection = null;
    this.selectionRect = null;
    this.preservedSelection = null;
    this.preservedRange = null;

    // Reset badge counter when floating icon is closed
    this.resetSelectionBadge();

    // Reset interaction flag
    this.isInteractingWithUI = false;
  }

  /**
   * Calculate similarity between two text strings to detect duplicates
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} - Similarity ratio (0-1)
   */
  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    // Simple similarity check based on common words
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (words1.length === 0 || words2.length === 0) return 0;

    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = (commonWords.length * 2) / (words1.length + words2.length);

    return similarity;
  }

  /**
   * FEATURE 3: Start new session - clear both variables for fresh multi-selection
   */
  startNewSession() {
    console.log('aiFiverr: Starting new session - clearing both {conversation} and {reply} variables');

    // Clear both variables
    this.selectedText = '';
    this.replyText = '';

    // Clear processed context
    this.lastProcessedContext = null;
    this.lastUsedVariables = null;
    this.lastKnowledgeBaseFiles = null;

    // Reset badge counter
    this.resetSelectionBadge();

    // Update the UI to reflect the cleared state
    if (this.contextMenu) {
      // Find and clear the reply textarea if it exists
      const textarea = this.contextMenu.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        textarea.style.height = '60px'; // Reset to minimum height
      }
    }

    // Clear streaming chatbox session if it exists
    if (this.streamingChatbox) {
      this.streamingChatbox.startNewSession();
    }

    console.log('aiFiverr: New session started - variables and context cleared');

    // Optionally show a brief confirmation
    this.showBriefMessage('New session started - variables cleared');
  }

  /**
   * Get manually attached files from UI components AND files used in last AI result
   * @returns {Array} - Array of manually attached files and context files
   */
  getManuallyAttachedFiles() {
    const attachedFiles = [];

    try {
      // PRIORITY 1: Include files that were used in the last AI result (for streaming chat context)
      if (this.lastKnowledgeBaseFiles && Array.isArray(this.lastKnowledgeBaseFiles)) {
        attachedFiles.push(...this.lastKnowledgeBaseFiles);
        console.log('aiFiverr: Found files from last AI result for streaming context:', this.lastKnowledgeBaseFiles.length);
      }

      // PRIORITY 2: Check if there are any manually attached files in the floating menu or other UI
      // This would be populated by file attachment UI components
      if (this.attachedFiles && Array.isArray(this.attachedFiles)) {
        // Use deduplication to avoid adding same files twice
        const existingUris = new Set(attachedFiles.map(f => f.geminiUri || f.id));
        const newFiles = this.attachedFiles.filter(f => !existingUris.has(f.geminiUri || f.id));
        attachedFiles.push(...newFiles);
        console.log('aiFiverr: Found manually attached files:', this.attachedFiles.length, 'new files:', newFiles.length);
      }

      // PRIORITY 3: Check universal chat attached files if available
      if (window.universalChat && window.universalChat.attachedFiles) {
        const existingUris = new Set(attachedFiles.map(f => f.geminiUri || f.id));
        const newFiles = window.universalChat.attachedFiles.filter(f => !existingUris.has(f.geminiUri || f.id));
        attachedFiles.push(...newFiles);
        console.log('aiFiverr: Found universal chat attached files:', window.universalChat.attachedFiles.length, 'new files:', newFiles.length);
      }

      console.log('aiFiverr: Total files for streaming chat context:', attachedFiles.length);

    } catch (error) {
      console.error('aiFiverr: Error getting manually attached files:', error);
    }

    return attachedFiles;
  }

  /**
   * Show a brief confirmation message
   */
  showBriefMessage(message) {
    // Create a small notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 10002;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  /**
   * Show context menu with AI prompts - SAME AS CHAT DROPDOWN
   */
  async showContextMenu() {
    console.log('aiFiverr: Attempting to show dropdown...');

    // Wait for prompt selector to be available
    if (!await this.waitForPromptSelector()) {
      console.error('aiFiverr: Prompt selector not available after waiting');
      this.showErrorMessage('AI prompts are not ready yet. Please try again in a moment.');
      return;
    }

    // Create dropdown if it doesn't exist
    if (!this.contextMenu) {
      this.createDropdown();
    }

    // Toggle dropdown visibility
    const isVisible = this.contextMenu.style.display === 'block';
    if (isVisible) {
      this.contextMenu.style.display = 'none';
    } else {
      // Load prompts and show dropdown
      await this.populateDropdown();
      this.contextMenu.style.display = 'block';

      // Position dropdown relative to icon
      this.positionDropdown();
    }
  }

  /**
   * Wait for prompt selector to be available and initialized
   */
  async waitForPromptSelector() {
    const maxWait = 5000; // 5 seconds
    const checkInterval = 100; // 100ms
    let waited = 0;

    while (waited < maxWait) {
      if (window.promptSelector &&
          window.promptSelector.allPrompts &&
          Object.keys(window.promptSelector.allPrompts).length > 0) {
        console.log('aiFiverr: Prompt selector is ready');
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    console.error('aiFiverr: Prompt selector not ready after', maxWait, 'ms');
    return false;
  }

  /**
   * Create dropdown menu - SAME AS CHAT DROPDOWN
   */
  createDropdown() {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'aifiverr-text-selection-dropdown';

    // Style exactly like chat dropdown
    Object.assign(this.contextMenu.style, {
      position: 'fixed',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: '10001',
      minWidth: '200px',
      maxWidth: '300px',
      maxHeight: '300px',
      overflowY: 'auto',
      display: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    document.body.appendChild(this.contextMenu);

    // Track when user is interacting with dropdown
    this.contextMenu.addEventListener('mouseenter', () => {
      this.isInteractingWithUI = true;
    });

    this.contextMenu.addEventListener('mouseleave', () => {
      this.isInteractingWithUI = false;
    });

    // Prevent wheel events from bubbling up when scrolling within dropdown
    this.contextMenu.addEventListener('wheel', (e) => {
      e.stopPropagation();
    });

    // Note: Click handling is now managed by handleMouseDown to avoid conflicts
  }

  /**
   * Add styles for context menu
   */
  addContextMenuStyles() {
    if (document.getElementById('aifiverr-context-menu-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'aifiverr-context-menu-styles';
    styles.textContent = `
      .aifiverr-text-selection-menu {
        position: fixed;
        z-index: 10001;
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border: 1px solid #e1e8ed;
        min-width: 250px;
        max-width: 300px;
        max-height: 400px;
        overflow: hidden;
        animation: aifiverr-slideIn 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aifiverr-text-selection-menu .menu-header {
        background: linear-gradient(135deg, #1dbf73 0%, #19a463 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
      }

      .aifiverr-text-selection-menu .menu-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s ease;
      }

      .aifiverr-text-selection-menu .menu-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .aifiverr-text-selection-menu .menu-content {
        max-height: 320px;
        overflow-y: auto;
      }

      .aifiverr-text-selection-menu .menu-loading {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 14px;
      }

      .aifiverr-text-selection-menu .prompt-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .aifiverr-text-selection-menu .prompt-item:hover {
        background: #f8f9fa;
      }

      .aifiverr-text-selection-menu .prompt-item:last-child {
        border-bottom: none;
      }

      .aifiverr-text-selection-menu .prompt-name {
        font-weight: 600;
        font-size: 14px;
        color: #2c3e50;
        margin-bottom: 4px;
      }

      .aifiverr-text-selection-menu .prompt-description {
        font-size: 12px;
        color: #666;
        line-height: 1.4;
      }

      @keyframes aifiverr-slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    
    document.head.appendChild(styles);
  }



  /**
   * Populate dropdown with prompts - SAME AS CHAT DROPDOWN
   */
  async populateDropdown() {
    try {
      console.log('aiFiverr: Populating dropdown with prompts...');

      // Check if prompt selector is available
      if (!window.promptSelector) {
        console.warn('aiFiverr: Prompt selector not available');
        this.contextMenu.innerHTML = '<div style="padding: 12px; color: #666;">Prompt selector not available</div>';
        return;
      }

      // Get prompts from prompt selector - ONLY CUSTOM PROMPTS for floating icon
      await window.promptSelector.loadPrompts();
      const allPrompts = window.promptSelector.allPrompts || {};
      const favoritePrompts = window.promptSelector.favoritePrompts || [];

      // Filter to show only custom prompts (exclude default prompts)
      const customPrompts = {};

      // Check if prompt manager is available for better filtering
      if (window.promptManager && window.promptManager.initialized) {
        // Use prompt manager to get only custom prompts
        const customPromptsFromManager = window.promptManager.getCustomPrompts();
        Object.entries(customPromptsFromManager).forEach(([key, prompt]) => {
          customPrompts[key] = prompt;
        });
      } else {
        // Fallback: filter by checking if prompt has isDefault property
        Object.entries(allPrompts).forEach(([key, prompt]) => {
          // Only include prompts that are explicitly marked as custom (not default)
          if (prompt.isDefault === false || (!prompt.hasOwnProperty('isDefault') && !this.isDefaultPromptKey(key))) {
            customPrompts[key] = prompt;
          }
        });
      }

      const prompts = customPrompts;

      console.log('aiFiverr Text Selector: Available custom prompts for floating icon:', {
        total: Object.keys(prompts).length,
        promptKeys: Object.keys(prompts),
        samplePrompt: Object.keys(prompts).length > 0 ? prompts[Object.keys(prompts)[0]] : null
      });

      if (!prompts || Object.keys(prompts).length === 0) {
        this.contextMenu.innerHTML = '<div style="padding: 12px; color: #666;">No custom prompts available</div>';
        return;
      }

      // Clear dropdown
      this.contextMenu.innerHTML = '';

      // Add text area for {reply} variable at the top
      const replySection = this.createReplySection();
      this.contextMenu.appendChild(replySection);

      // Add grounding controls section
      const groundingSection = await this.createGroundingControlsSection();
      this.contextMenu.appendChild(groundingSection);

      // Add separator
      const separator = document.createElement('div');
      separator.style.cssText = 'height: 1px; background: #e5e7eb; margin: 8px 0;';
      this.contextMenu.appendChild(separator);

      // Add favorite custom prompts first (only if they are custom prompts)
      if (Array.isArray(favoritePrompts)) {
        favoritePrompts.forEach(promptKey => {
          const prompt = prompts[promptKey]; // prompts already filtered to custom only
          if (prompt) {
            const item = this.createDropdownItem(promptKey, prompt);
            this.contextMenu.appendChild(item);
          }
        });
      }

      // Add other custom prompts (show all prompts)
      const otherPrompts = Object.keys(prompts).filter(key => !favoritePrompts.includes(key));
      otherPrompts.forEach(promptKey => {
        const prompt = prompts[promptKey];
        if (prompt) {
          const item = this.createDropdownItem(promptKey, prompt);
          this.contextMenu.appendChild(item);
        }
      });

      // Floating icon dropdown populated with custom prompts

    } catch (error) {
      console.error('aiFiverr: Failed to populate dropdown:', error);
      this.contextMenu.innerHTML = '<div style="padding: 12px; color: #dc3545;">Failed to load prompts</div>';
    }
  }

  /**
   * Create reply section with text area for {reply} variable
   */
  createReplySection() {
    const section = document.createElement('div');
    section.style.cssText = 'padding: 12px 16px; background: #f8f9fa;';

    // Header with session management
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 600; font-size: 12px; color: #374151; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap;';

    const leftSection = document.createElement('div');
    leftSection.style.cssText = 'display: flex; align-items: center; justify-content: flex-start;';

    const mainSpan = document.createElement('span');
    mainSpan.textContent = 'Reply Text ({reply})';

    const optionalSpan = document.createElement('span');
    optionalSpan.textContent = 'Optional';
    optionalSpan.style.cssText = 'font-size: 10px; color: #6b7280; font-weight: normal; margin-left: 8px;';

    leftSection.appendChild(mainSpan);
    leftSection.appendChild(optionalSpan);

    // FEATURE 3: Session management - New Session button
    const rightSection = document.createElement('div');
    rightSection.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: 8px;';

    const newSessionBtn = document.createElement('button');
    newSessionBtn.innerHTML = '🔄';
    newSessionBtn.title = 'New Session - Clear both {conversation} and {reply} variables to start fresh';
    newSessionBtn.style.cssText = `
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 14px;
      color: #495057;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      margin: 0;
      outline: none;
    `;

    newSessionBtn.addEventListener('mouseenter', () => {
      newSessionBtn.style.background = '#e9ecef';
      newSessionBtn.style.borderColor = '#ced4da';
      newSessionBtn.style.transform = 'translateY(-1px)';
      newSessionBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    newSessionBtn.addEventListener('mouseleave', () => {
      newSessionBtn.style.background = '#f8f9fa';
      newSessionBtn.style.borderColor = '#dee2e6';
      newSessionBtn.style.transform = 'translateY(0)';
      newSessionBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    });

    newSessionBtn.addEventListener('mousedown', () => {
      newSessionBtn.style.transform = 'translateY(0)';
      newSessionBtn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
    });

    newSessionBtn.addEventListener('mouseup', () => {
      newSessionBtn.style.transform = 'translateY(-1px)';
      newSessionBtn.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    newSessionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startNewSession();
    });

    rightSection.appendChild(newSessionBtn);
    header.appendChild(leftSection);
    header.appendChild(rightSection);

    // Text area
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Type your reply text here (will be available as {reply} variable in prompts)';
    textarea.style.cssText = `
      width: 100%;
      min-height: 60px;
      max-height: 120px;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      resize: vertical;
      box-sizing: border-box;
    `;

    // Restore existing reply text if available (FEATURE 1: Persistent reply text)
    if (this.replyText) {
      textarea.value = this.replyText;
      // Auto-resize to fit existing content
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Auto-resize functionality
    textarea.addEventListener('input', (e) => {
      this.replyText = e.target.value;
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    // Prevent dropdown from closing when interacting with textarea
    textarea.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = true;
    });

    textarea.addEventListener('focus', () => {
      this.isInteractingWithUI = true;
    });

    textarea.addEventListener('blur', () => {
      this.isInteractingWithUI = false;
    });

    section.appendChild(header);
    section.appendChild(textarea);

    return section;
  }

  /**
   * Create grounding controls section
   */
  async createGroundingControlsSection() {
    const section = document.createElement('div');
    section.style.cssText = 'padding: 12px 16px; background: #f8f9fa; border-top: 1px solid #e5e7eb;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 600; font-size: 12px; color: #374151; margin-bottom: 8px;';
    header.textContent = 'AI Enhancement Tools';

    // Controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Get current settings
    const settings = await this.getSettings();
    const googleSearchDefault = settings?.googleSearchGrounding?.defaultEnabled || false;
    const urlContextDefault = settings?.urlContextExtraction?.defaultEnabled || false;

    // Google Search grounding control
    const googleSearchControl = this.createToggleControl(
      'googleSearchGrounding',
      'Google Search grounding',
      'Enable real-time web search for accurate, up-to-date information',
      googleSearchDefault
    );

    // URL context extraction control
    const urlContextControl = this.createToggleControl(
      'urlContextExtraction',
      'URL context extraction',
      'Automatically extract and include content from URLs in text',
      urlContextDefault
    );

    controlsContainer.appendChild(googleSearchControl);
    controlsContainer.appendChild(urlContextControl);

    section.appendChild(header);
    section.appendChild(controlsContainer);

    return section;
  }

  /**
   * Create a toggle control (checkbox)
   */
  createToggleControl(id, label, description, defaultChecked = false) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: flex-start; gap: 8px;';

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `aifiverr-${id}`;
    checkbox.checked = defaultChecked;
    checkbox.style.cssText = `
      margin: 0;
      margin-top: 2px;
      cursor: pointer;
      accent-color: #10b981;
    `;

    // Label and description container
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'flex: 1;';

    const labelElement = document.createElement('label');
    labelElement.htmlFor = checkbox.id;
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      display: block;
      margin-bottom: 2px;
    `;

    const descriptionElement = document.createElement('div');
    descriptionElement.textContent = description;
    descriptionElement.style.cssText = `
      font-size: 10px;
      color: #6b7280;
      line-height: 1.3;
    `;

    labelContainer.appendChild(labelElement);
    labelContainer.appendChild(descriptionElement);

    container.appendChild(checkbox);
    container.appendChild(labelContainer);

    // Prevent dropdown from closing when interacting with controls
    container.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = true;
    });

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      console.log(`aiFiverr: ${id} toggled:`, e.target.checked);
    });

    return container;
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
   * Get grounding options from UI controls
   */
  getGroundingOptions() {
    const options = {};

    // Check Google Search grounding checkbox
    const googleSearchCheckbox = document.getElementById('aifiverr-googleSearchGrounding');
    if (googleSearchCheckbox && googleSearchCheckbox.checked) {
      options.googleSearchGrounding = true;
    }

    // Check URL context extraction checkbox
    const urlContextCheckbox = document.getElementById('aifiverr-urlContextExtraction');
    if (urlContextCheckbox && urlContextCheckbox.checked) {
      options.urlContextExtraction = true;
      options.urlContextTool = true; // Enable the URL context tool in Gemini API
    }

    return options;
  }

  /**
   * Create dropdown item - SAME AS CHAT DROPDOWN
   */
  createDropdownItem(promptKey, prompt) {
    const item = document.createElement('div');
    item.className = 'aifiverr-dropdown-item';
    item.dataset.promptKey = promptKey;

    // Style like chat dropdown items
    Object.assign(item.style, {
      padding: '12px 16px',
      cursor: 'pointer',
      borderBottom: '1px solid #f3f4f6',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'background-color 0.2s ease'
    });

    // Enhanced content creation with better validation
    const name = document.createElement('div');
    name.style.fontWeight = '500';
    name.style.color = '#374151';

    // Enhanced title extraction
    let title = 'Untitled';
    if (prompt.name && typeof prompt.name === 'string' && prompt.name.trim()) {
      title = prompt.name.trim();
    } else if (prompt.title && typeof prompt.title === 'string' && prompt.title.trim()) {
      title = prompt.title.trim();
    } else if (promptKey && typeof promptKey === 'string' && promptKey.trim()) {
      title = promptKey.trim().replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    name.textContent = title;

    const description = document.createElement('div');
    description.style.fontSize = '12px';
    description.style.color = '#6b7280';
    description.style.marginTop = '2px';

    // Enhanced description extraction
    let descText = 'AI-powered response';
    if (prompt.description && typeof prompt.description === 'string' && prompt.description.trim()) {
      descText = prompt.description.trim();
    } else if (prompt.prompt && typeof prompt.prompt === 'string' && prompt.prompt.trim()) {
      // Use first part of prompt as description if no description available
      const promptText = prompt.prompt.trim();
      descText = promptText.length > 50 ? promptText.substring(0, 50) + '...' : promptText;
    }
    description.textContent = descText;

    console.log('aiFiverr Text Selector: Creating dropdown item:', {
      promptKey,
      title,
      description: descText.substring(0, 30) + '...',
      hasPromptContent: !!(prompt.prompt || prompt.content || prompt.text)
    });

    item.appendChild(name);
    item.appendChild(description);

    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f9fafb';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    // Click handler
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('aiFiverr: Dropdown item clicked:', promptKey);
      this.contextMenu.style.display = 'none';
      this.handlePromptSelection(promptKey);
    });

    return item;
  }

  /**
   * Check if a prompt key corresponds to a default prompt
   */
  isDefaultPromptKey(key) {
    const defaultPromptKeys = [
      'summary', 'follow_up', 'proposal', 'project_proposal',
      'translate', 'improve_translate', 'improve'
    ];
    return defaultPromptKeys.includes(key);
  }

  /**
   * Handle prompt selection
   */
  async handlePromptSelection(promptKey) {
    console.log('aiFiverr: Selected prompt:', promptKey, 'for text:', this.selectedText.substring(0, 50) + '...');

    // Hide dropdown
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }

    // Process the selected text with the chosen prompt
    await this.processTextWithPrompt(promptKey, this.selectedText);
  }

  /**
   * Process selected text with chosen prompt
   */
  async processTextWithPrompt(promptKey, selectedText) {
    try {
      console.log('=== aiFiverr Text Selection Processing Started ===');

      // Validate input parameters
      if (!promptKey || typeof promptKey !== 'string') {
        throw new Error('Invalid prompt key provided');
      }

      if (!selectedText || typeof selectedText !== 'string' || selectedText.trim().length === 0) {
        throw new Error('No valid text selected for processing');
      }

      // Sanitize selected text
      selectedText = selectedText.trim();

      console.log('aiFiverr: Processing text with prompt:', promptKey);
      console.log('aiFiverr: Selected text length:', selectedText.length);
      console.log('aiFiverr: Selected text preview:', selectedText.substring(0, 200) + '...');

      // Show loading animation on the icon
      this.startIconLoadingAnimation();

      // Get the prompt from prompt selector
      let prompt = null;
      if (window.promptSelector && window.promptSelector.allPrompts) {
        prompt = window.promptSelector.allPrompts[promptKey];
      }

      if (!prompt) {
        throw new Error(`Prompt '${promptKey}' not found`);
      }

      // Enhanced prompt debugging
      console.log('aiFiverr: Found prompt:', {
        name: prompt.name || promptKey,
        hasDescription: !!prompt.description,
        hasPrompt: !!prompt.prompt,
        hasContent: !!prompt.content,
        hasText: !!prompt.text,
        keys: Object.keys(prompt),
        promptType: prompt.isDefault ? 'default' : 'custom'
      });

      // Check if required managers are available with graceful degradation
      if (!window.sessionManager) {
        console.warn('aiFiverr: Session manager not available, attempting to initialize...');
        if (typeof window.initializeSessionManager === 'function') {
          await window.initializeSessionManager();
        }
        if (!window.sessionManager) {
          throw new Error('Session manager not available and could not be initialized');
        }
      }

      // CRITICAL FIX: Handle knowledge base manager initialization gracefully
      if (!window.knowledgeBaseManager) {
        console.warn('aiFiverr: Knowledge base manager not available, attempting to initialize...');
        if (typeof window.initializeKnowledgeBaseManager === 'function') {
          await window.initializeKnowledgeBaseManager();
        }

        // If still not available, continue with degraded functionality
        if (!window.knowledgeBaseManager) {
          console.warn('aiFiverr: Knowledge base manager not available - continuing with limited functionality');
        }
      } else if (window.knowledgeBaseManager && !window.knowledgeBaseManager.initialized) {
        // Manager exists but not initialized - wait for it
        console.log('aiFiverr: Knowledge base manager exists but not initialized, waiting...');
        try {
          await window.knowledgeBaseManager.waitForInitialization(3000); // 3 second timeout
        } catch (error) {
          console.warn('aiFiverr: Failed to wait for knowledge base manager initialization:', error);
        }
      }

      if (!window.geminiClient) {
        console.warn('aiFiverr: Gemini client not available, attempting to initialize...');
        if (typeof window.initializeGeminiClient === 'function') {
          await window.initializeGeminiClient();
        }
        if (!window.geminiClient) {
          throw new Error('Gemini client not available and could not be initialized');
        }
      }

      // Get or create session for text selection
      const session = await window.sessionManager.getOrCreateSession('text_selection');
      console.log('aiFiverr: Got session:', session.id);

      // Enhanced prompt text extraction with better error handling
      let promptText = null;

      // Try different property names that might contain the prompt content
      if (prompt.prompt && typeof prompt.prompt === 'string' && prompt.prompt.trim()) {
        promptText = prompt.prompt.trim();
        console.log('aiFiverr: Using prompt.prompt property');
      } else if (prompt.content && typeof prompt.content === 'string' && prompt.content.trim()) {
        promptText = prompt.content.trim();
        console.log('aiFiverr: Using prompt.content property');
      } else if (prompt.text && typeof prompt.text === 'string' && prompt.text.trim()) {
        promptText = prompt.text.trim();
        console.log('aiFiverr: Using prompt.text property');
      } else if (prompt.description && typeof prompt.description === 'string' && prompt.description.trim()) {
        promptText = prompt.description.trim();
        console.log('aiFiverr: Using prompt.description property as fallback');
      } else {
        console.error('aiFiverr: No valid prompt content found in prompt object:', prompt);
        throw new Error(`Prompt '${promptKey}' has no valid content. Available properties: ${Object.keys(prompt).join(', ')}`);
      }

      console.log('aiFiverr: Extracted prompt text:', promptText.substring(0, 100) + '...');

      // Process prompt with enhanced error handling
      let result;
      try {
        // Get all knowledge base variables to include in context (with graceful degradation)
        let knowledgeBaseVariables = {};
        if (window.knowledgeBaseManager) {
          try {
            knowledgeBaseVariables = window.knowledgeBaseManager.getAllVariables();
            console.log('aiFiverr: Available knowledge base variables:', Object.keys(knowledgeBaseVariables));
          } catch (error) {
            console.warn('aiFiverr: Failed to get knowledge base variables:', error);
          }
        } else {
          console.log('aiFiverr: Knowledge base manager not available - using empty variables');
        }

        // NEW APPROACH: Use variable processor to only include variables referenced in prompt
        const availableContext = {
          conversation: selectedText, // Selected text as conversation
          reply: this.replyText || '', // Reply text from text area
          username: 'User',
          selected_text: selectedText // Always provide selected text as separate variable
        };

        // Use variable processor to get only required context
        let context = {};
        if (window.variableProcessor) {
          context = await window.variableProcessor.getRequiredContext(promptText, availableContext);
          console.log('aiFiverr: Using variable processor - context:', Object.keys(context));
        } else {
          // Fallback to old behavior if variable processor not available
          console.warn('aiFiverr: Variable processor not available, using fallback');
          const promptContainsConversationVar = promptText.includes('{conversation}');
          context = {
            conversation: promptContainsConversationVar ? selectedText : '',
            reply: this.replyText || '',
            username: 'User',
            selected_text: selectedText,
            ...knowledgeBaseVariables
          };
        }

        console.log('aiFiverr: Context variables available:', Object.keys(context));

        // CRITICAL FIX: Use knowledge base manager for saved prompts to get attached files
        // The variable processor doesn't know about files attached to saved prompts
        if (window.knowledgeBaseManager && promptKey) {
          try {
            console.log('aiFiverr: Using knowledge base manager for saved prompt processing');

            // First get the prompt processing result from knowledge base manager
            // This will include files that were attached to the saved prompt
            result = await window.knowledgeBaseManager.processPrompt(promptKey, context);

            // Store context for streaming chat consistency
            this.lastProcessedContext = availableContext;
            this.lastUsedVariables = Object.keys(context);
            this.lastKnowledgeBaseFiles = result.knowledgeBaseFiles || [];
            this.lastUsedPrompt = result.prompt;
          } catch (error) {
            console.warn('aiFiverr: Failed to process saved prompt with knowledge base manager:', error);
            // Fall back to variable processor
            result = null;
          }

          console.log('aiFiverr: Knowledge base manager processing result:');
          console.log('aiFiverr: Files from saved prompt:', (result.knowledgeBaseFiles || []).length);
          console.log('aiFiverr: Files details:', (result.knowledgeBaseFiles || []).map(f => ({
            name: f.name,
            hasGeminiUri: !!f.geminiUri,
            mimeType: f.mimeType
          })));

        } else if (window.variableProcessor) {
          console.log('aiFiverr: Using variable processor for dynamic prompt processing');

          // Get manually attached files if any (from floating menu or other UI)
          const manuallyAttachedFiles = this.getManuallyAttachedFiles();

          const processedResult = await window.variableProcessor.processPrompt(
            promptText,
            availableContext,
            manuallyAttachedFiles
          );
          result = {
            prompt: processedResult.prompt,
            knowledgeBaseFiles: processedResult.knowledgeBaseFiles
          };

          // Store context for streaming chat consistency
          this.lastProcessedContext = availableContext;
          this.lastUsedVariables = processedResult.usedVariables;
          this.lastKnowledgeBaseFiles = processedResult.knowledgeBaseFiles;
          this.lastUsedPrompt = processedResult.prompt;

          console.log('aiFiverr: Variable processor processing result:');
          console.log('aiFiverr: Variables used:', processedResult.usedVariables);
          console.log('aiFiverr: Files used:', processedResult.usedFiles);
          console.log('aiFiverr: Manually attached files:', manuallyAttachedFiles.length);
        } else {
          // Final fallback
          console.warn('aiFiverr: No prompt processing system available, using basic processing');
          result = {
            prompt: promptText,
            knowledgeBaseFiles: []
          };
        }
      } catch (processError) {
        console.error('aiFiverr: Error processing prompt:', processError);
        // Improved fallback - only replace variables that exist in the prompt
        let fallbackPrompt = promptText;

        // Only replace variables that are actually referenced in the prompt
        Object.entries(context).forEach(([key, value]) => {
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          if (fallbackPrompt.includes(`{${key}}`)) {
            fallbackPrompt = fallbackPrompt.replace(regex, value || '');
            console.log(`aiFiverr: Replaced {${key}} in fallback processing`);
          }
        });

        result = {
          prompt: fallbackPrompt,
          knowledgeBaseFiles: []
        };
        console.log('aiFiverr: Using improved fallback prompt processing');
      }

      // Safely extract processed prompt and knowledge base files
      let processedPrompt, knowledgeBaseFiles;

      if (typeof result === 'object' && result !== null) {
        processedPrompt = result.prompt;
        knowledgeBaseFiles = result.knowledgeBaseFiles;
      } else {
        processedPrompt = result;
        knowledgeBaseFiles = [];
      }

      // Ensure knowledgeBaseFiles is always an array
      if (!Array.isArray(knowledgeBaseFiles)) {
        console.warn('aiFiverr: knowledgeBaseFiles is not an array, converting:', typeof knowledgeBaseFiles);
        knowledgeBaseFiles = [];
      }

      // OPTIMIZED: Use smart file attachment based on prompt analysis
      console.log('aiFiverr: Knowledge base files from prompt processing:', knowledgeBaseFiles.length, 'files');

      // CRITICAL FIX: If no files specified in prompt, include all available knowledge base files
      // This ensures floating icon has access to knowledge base files like other components
      if (knowledgeBaseFiles.length === 0 && window.knowledgeBaseManager) {
        try {
          console.log('aiFiverr: No files from variable processor, attempting to load all available knowledge base files');

          // For floating icon, we should include all available knowledge base files
          // This matches the behavior of other components like popup and streaming chatbox
          knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();

          console.log('aiFiverr: Loaded all available knowledge base files:', knowledgeBaseFiles.length, 'files');

          // If the main method didn't work, try the optimized method as fallback
          if (knowledgeBaseFiles.length === 0) {
            console.log('aiFiverr: Main method returned no files, trying optimized method');

            const fileOptions = {
              manuallySelectedFiles: null,
              promptReferencedFiles: null,
              enableSmartSelection: true,
              promptText: processedPrompt,
              fallbackToAll: true // Load all files as fallback
            };

            knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFilesOptimized(fileOptions);
            console.log('aiFiverr: Optimized method found', knowledgeBaseFiles.length, 'files');
          }

        } catch (error) {
          console.warn('aiFiverr: Failed to load knowledge base files:', error);

          // Final fallback: empty array
          knowledgeBaseFiles = [];
        }
      } else if (knowledgeBaseFiles.length === 0 && !window.knowledgeBaseManager) {
        console.log('aiFiverr: Knowledge base manager not available - proceeding without knowledge base files');
        knowledgeBaseFiles = [];
      }

      if (knowledgeBaseFiles.length === 0) {
        console.log('aiFiverr: No files will be attached - no files available or referenced');
      } else {
        console.log('aiFiverr: Using', knowledgeBaseFiles.length, 'knowledge base files for prompt');
      }

      const safeProcessedPrompt = processedPrompt || 'No processed prompt available';
      console.log('aiFiverr: Processed prompt:', safeProcessedPrompt.substring(0, 100) + '...');
      console.log('aiFiverr: Knowledge base files for prompt:', knowledgeBaseFiles.length, 'files');

      // Check for files that might need re-upload due to MIME type issues
      console.log('🚨 TEXT-SELECTOR: Checking files for potential MIME type issues...');

      knowledgeBaseFiles = knowledgeBaseFiles.filter(file => {
        if (!file || !file.geminiUri) {
          console.log('🚨 Skipping file without Gemini URI:', file?.name);
          return false;
        }

        return true;
      });

      // CRITICAL FIX: Clean up MIME types before sending to API
      knowledgeBaseFiles = knowledgeBaseFiles.map(file => {
        if (file.mimeType === 'application/octet-stream' ||
            !file.mimeType ||
            file.mimeType === '' ||
            file.mimeType === null) {

          // Try to detect proper MIME type from file extension
          const extension = file.name ? file.name.toLowerCase().split('.').pop() : '';
          const mimeMap = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'json': 'application/json',
            'csv': 'text/csv',
            'html': 'text/html',
            'js': 'text/javascript',
            'py': 'text/x-python'
          };

          const newMimeType = mimeMap[extension] || 'text/plain';
          console.warn(`🔧 Text Selector: Fixed MIME type for ${file.name}: ${file.mimeType} → ${newMimeType}`);

          return {
            ...file,
            mimeType: newMimeType
          };
        }
        return file;
      });

      console.log('🚨 TEXT-SELECTOR: After filtering, using', knowledgeBaseFiles.length, 'files');

      // Safely log knowledge base files details
      try {
        console.log('aiFiverr: Knowledge base files details:', knowledgeBaseFiles.map(f => ({
          name: f?.name || 'Unknown',
          id: f?.id || 'Unknown',
          geminiUri: f?.geminiUri || 'None',
          mimeType: f?.mimeType || 'Unknown',
          hasGeminiUri: !!(f?.geminiUri)
        })));
      } catch (mappingError) {
        console.warn('aiFiverr: Error mapping knowledge base files for logging:', mappingError);
      }

      // Generate AI response with enhanced error handling
      console.log('aiFiverr: Generating AI response with options:', { knowledgeBaseFiles: knowledgeBaseFiles.length + ' files' });

      // DEBUG: Check what geminiClient we're using
      console.log('🚨 TEXT-SELECTOR: window.geminiClient type:', typeof window.geminiClient);
      console.log('🚨 TEXT-SELECTOR: window.geminiClient constructor:', window.geminiClient?.constructor?.name);

      // DEBUG: Log the exact files being passed
      console.log('🚨 TEXT-SELECTOR: Files being passed to Gemini:', JSON.stringify(knowledgeBaseFiles, null, 2));

      // CRITICAL: Store the finalized files for streaming chat context transfer
      this.lastKnowledgeBaseFiles = knowledgeBaseFiles;
      console.log('aiFiverr: Stored', knowledgeBaseFiles.length, 'files for potential streaming chat context');

      // If we have files, modify the prompt to explicitly reference them
      let finalPrompt = safeProcessedPrompt;
      if (knowledgeBaseFiles.length > 0) {
        const fileNames = knowledgeBaseFiles.map(f => f.name).join(', ');
        finalPrompt = `Based on the attached file(s) (${fileNames}) and the following context, please provide a response:\n\n${safeProcessedPrompt}\n\nPlease reference and use information from the attached file(s) in your response.`;
        console.log('🚨 TEXT-SELECTOR: Modified prompt to reference files:', finalPrompt.substring(0, 200) + '...');
      }

      // CRITICAL: Store the final prompt that will be sent to AI for streaming chat context consistency
      this.lastUsedPrompt = finalPrompt;
      console.log('aiFiverr: Stored final prompt for streaming chat context:', finalPrompt.substring(0, 100) + '...');

      // Get grounding settings from UI controls
      const groundingOptions = this.getGroundingOptions();
      console.log('aiFiverr: Using grounding options:', groundingOptions);

      let response;
      try {
        const apiOptions = {
          knowledgeBaseFiles,
          ...groundingOptions
        };

        response = await window.geminiClient.generateChatReply(session, finalPrompt, apiOptions);

        if (!response || !response.response) {
          throw new Error('Empty response from AI service');
        }

        console.log('aiFiverr: Got AI response:', response.response.substring(0, 100) + '...');

        // Log grounding metadata if available
        if (response.groundingMetadata) {
          console.log('aiFiverr: Response includes grounding metadata');
        }
        if (response.urlContextMetadata) {
          console.log('aiFiverr: Response includes URL context metadata');
        }
      } catch (aiError) {
        console.error('aiFiverr: Error generating AI response:', aiError);
        throw new Error(`AI service error: ${aiError.message}`);
      }

      // Show result popup near the icon (like chatbox style) - RESTORED ORIGINAL BEHAVIOR
      this.showResultPopup(response.response, selectedText);

    } catch (error) {
      console.error('aiFiverr: Failed to process text with prompt:', error);
      this.showErrorMessage(`Failed to process text: ${error.message}. Please try again.`);
    } finally {
      this.stopIconLoadingAnimation();
    }
  }

  /**
   * Start loading animation on the floating icon
   */
  startIconLoadingAnimation() {
    const actionButton = this.floatingIcon?.querySelector('.aifiverr-text-selection-icon');
    if (!actionButton) return;

    actionButton.classList.add('loading');
    actionButton.innerHTML = '💬';

    // Add animated dots
    let dotCount = 0;
    const animateIcon = () => {
      if (!actionButton.classList.contains('loading')) return;

      dotCount = (dotCount + 1) % 4;
      const dots = '.'.repeat(dotCount);
      actionButton.innerHTML = `💬${dots}`;

      setTimeout(animateIcon, 500);
    };

    setTimeout(animateIcon, 500);
  }

  /**
   * Stop loading animation on the floating icon
   */
  stopIconLoadingAnimation() {
    const actionButton = this.floatingIcon?.querySelector('.aifiverr-text-selection-icon');
    if (!actionButton) return;

    actionButton.classList.remove('loading');
    actionButton.innerHTML = '💬';
  }

  /**
   * Show processing indicator
   */
  showProcessingIndicator() {
    if (!this.processingIndicator) {
      this.createProcessingIndicator();
    }
    this.processingIndicator.style.display = 'flex';
  }

  /**
   * Hide processing indicator
   */
  hideProcessingIndicator() {
    if (this.processingIndicator) {
      this.processingIndicator.style.display = 'none';
    }
  }

  /**
   * Create processing indicator
   */
  createProcessingIndicator() {
    this.processingIndicator = document.createElement('div');
    this.processingIndicator.className = 'aifiverr-processing-indicator';
    this.processingIndicator.innerHTML = `
      <div class="processing-content">
        <div class="processing-spinner"></div>
        <div class="processing-text">Processing with AI...</div>
      </div>
    `;

    // Add styles
    this.addProcessingIndicatorStyles();
    document.body.appendChild(this.processingIndicator);
    this.processingIndicator.style.display = 'none';
  }

  /**
   * Add styles for processing indicator
   */
  addProcessingIndicatorStyles() {
    if (document.getElementById('aifiverr-processing-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'aifiverr-processing-styles';
    styles.textContent = `
      .aifiverr-processing-indicator {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aifiverr-processing-indicator .processing-content {
        background: white;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .aifiverr-processing-indicator .processing-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #1dbf73;
        border-radius: 50%;
        animation: aifiverr-spin 1s linear infinite;
      }

      .aifiverr-processing-indicator .processing-text {
        font-size: 16px;
        color: #2c3e50;
        font-weight: 500;
      }

      @keyframes aifiverr-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Show result popup near the floating icon (like chatbox style)
   */
  showResultPopup(result, originalText) {
    // Remove existing popup with proper cleanup
    const existingPopup = document.querySelector('.aifiverr-text-result-popup');
    if (existingPopup) {
      this.closeResultPopup(existingPopup);
    }

    const popup = document.createElement('div');
    popup.className = 'aifiverr-text-result-popup';

    // Convert markdown-like formatting to HTML with user-friendly links
    const formattedResult = this.formatAIResult(result, { editMode: false });

    popup.innerHTML = `
      <div class="result-header draggable-handle" title="Drag to move">
        <div class="result-title">
          <span class="result-icon">✨</span>
          <h3>AI Result</h3>
          <span class="drag-indicator">⋮⋮</span>
        </div>
        <button class="close-btn" title="Close">×</button>
      </div>
      <div class="result-content">
        <div class="result-display">${formattedResult}</div>
        <textarea class="result-text-editor" style="display: none;" placeholder="AI generated text...">${result}</textarea>
      </div>
      <div class="result-actions">
        <button class="copy-btn" title="Left click: Text | Right click: Markdown">📋 Copy <small>T|M</small></button>
        <button class="edit-btn" title="Edit text">✏️ Edit</button>
        <button class="insert-btn" title="Insert into field">📝 Insert</button>
        <button class="continue-chat-btn" title="Continue conversation with AI">💬 Chat</button>
      </div>
    `;

    // Add styles
    this.addResultPopupStyles();

    // Position popup near the floating icon
    this.positionResultPopup(popup);

    // Make popup draggable
    this.makeDraggable(popup);

    // Get elements
    const resultDisplay = popup.querySelector('.result-display');
    const textarea = popup.querySelector('.result-text-editor');
    const editBtn = popup.querySelector('.edit-btn');

    // Auto-resize textarea
    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    // Event listeners
    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.closeResultPopup(popup);
    });

    // Initialize the popup with original content and store original text for context
    popup.dataset.currentText = result;
    popup.dataset.originalText = originalText;

    // Simple copy functionality with right-click context menu
    const copyBtn = popup.querySelector('.copy-btn');

    // Left click - copy as plain text (default)
    copyBtn.addEventListener('click', async () => {
      const textToCopy = this.getContentForCopyInsert(popup, 'text');
      await this.copyToClipboard(textToCopy);
      this.showToast('📋 Copied as text!');
    });

    // Right click - copy as markdown
    copyBtn.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      const textToCopy = this.getContentForCopyInsert(popup, 'markdown');
      await this.copyToClipboard(textToCopy);
      this.showToast('📝 Copied as markdown!');
    });

    editBtn.addEventListener('click', () => {
      this.toggleEditMode(popup, result);
    });

    popup.querySelector('.insert-btn').addEventListener('click', () => {
      const textToInsert = this.getContentForCopyInsert(popup, 'text');
      this.insertTextIntoActiveField(textToInsert);
      this.showToast('📝 Text inserted!');
    });

    // Chat button - transition to streaming chatbox
    const continueBtn = popup.querySelector('.continue-chat-btn');
    console.log('aiFiverr: Chat button found:', continueBtn);

    if (continueBtn) {
      // Add debouncing to prevent multiple rapid clicks
      let isTransitioning = false;

      continueBtn.addEventListener('click', async (event) => {
        console.log('aiFiverr: Chat button clicked!', event);
        event.preventDefault();
        event.stopPropagation();

        // Prevent multiple simultaneous transitions
        if (isTransitioning) {
          console.log('aiFiverr: Transition already in progress, ignoring click');
          return;
        }

        isTransitioning = true;
        continueBtn.disabled = true;
        continueBtn.textContent = '💬 Opening...';

        const isEditing = textarea.style.display !== 'none';
        const currentText = isEditing ? textarea.value : (popup.dataset.currentText || result);
        const originalSelectedText = popup.dataset.originalText || originalText;

        console.log('aiFiverr: Chat clicked', { currentText, originalSelectedText });

        try {
          // Check if StreamingChatbox is available
          if (typeof window.StreamingChatbox === 'undefined') {
            console.error('aiFiverr: StreamingChatbox not available, keeping popup open');
            console.error('aiFiverr: Available window properties:', Object.keys(window).filter(key => key.includes('Stream') || key.includes('Chat')));
            this.showToast('Streaming chat not available. Please try again.');
            return;
          }

          console.log('aiFiverr: StreamingChatbox class is available');

          // Validate context before transition (with fallback)
          try {
            const contextValidation = this.validateTransitionContext(currentText, originalSelectedText);
            if (!contextValidation.isValid) {
              console.error('aiFiverr: Context validation failed:', contextValidation.error);
              this.showToast(`Cannot transition to chat: ${contextValidation.error}`);
              return;
            }
            console.log('aiFiverr: Context validation passed');
          } catch (validationError) {
            console.warn('aiFiverr: Context validation threw error, proceeding anyway:', validationError);
            // Continue with transition even if validation fails
          }

          // Show streaming chatbox with conversation context
          const success = await this.showStreamingChatbox(currentText, originalSelectedText);

          // Only close popup if chatbox opened successfully
          if (success) {
            console.log('aiFiverr: Streaming chatbox opened successfully, closing popup');
            this.closeResultPopup(popup);
          } else {
            console.error('aiFiverr: Failed to open streaming chatbox, keeping popup open');
            this.showToast('Failed to open streaming chat. Please try again.');
          }
        } catch (error) {
          console.error('aiFiverr: Error opening streaming chatbox:', error);
          this.showToast('Error opening chat. Please try again.');
        } finally {
          // Reset button state
          isTransitioning = false;
          continueBtn.disabled = false;
          continueBtn.textContent = '💬 Chat';
        }
      });
    } else {
      console.error('aiFiverr: Chat button not found in popup!');
    }

    // Auto-resize on input and save changes
    textarea.addEventListener('input', (e) => {
      autoResize();
      // Save the current edited content
      popup.dataset.currentText = e.target.value;
    });

    // Store reference to popup for potential cleanup
    this.currentResultPopup = popup;
  }

  /**
   * Format AI result with proper HTML formatting using enhanced markdown renderer
   */
  formatAIResult(text, options = {}) {
    if (!text) return '';

    const { editMode = false } = options;

    // Use enhanced markdown renderer if available
    if (window.enhancedMarkdownRenderer && !editMode) {
      try {
        return window.enhancedMarkdownRenderer.render(text);
      } catch (error) {
        console.error('aiFiverr: Enhanced markdown rendering failed, falling back:', error);
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
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="ai-header-3">$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="ai-header-2">$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="ai-header-1">$1</h1>');

    // Process bold and italic (order matters)
    formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="ai-bold">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="ai-italic">$1</em>');

    // Process strikethrough
    formatted = formatted.replace(/~~(.*?)~~/g, '<del class="ai-strikethrough">$1</del>');

    // Process inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

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
          processedLines.push('<ul class="ai-bullet-list">');
          inList = true;
          listType = 'ul';
        }
        processedLines.push(`<li class="ai-list-item">${bulletMatch[1]}</li>`);
      } else if (numberMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ol class="ai-numbered-list">');
          inList = true;
          listType = 'ol';
        }
        processedLines.push(`<li class="ai-list-item">${numberMatch[2]}</li>`);
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
        return `<a href="${this.escapeHtml(url)}" class="ai-link" target="_blank" rel="noopener noreferrer" data-url-id="${urlId}" data-original-url="${this.escapeHtml(url)}">${this.escapeHtml(linkText)}</a>`;
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
        return `<a href="${this.escapeHtml(url)}" class="ai-link ai-auto-link" target="_blank" rel="noopener noreferrer" data-url-id="${urlId}" data-original-url="${this.escapeHtml(url)}">${this.escapeHtml(displayText)}</a>`;
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
   * Process code blocks
   */
  processCodeBlocks(text) {
    // Multi-line code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'text';
      return `<pre class="ai-code-block"><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
    });

    return text;
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
   * Extract plain text from formatted content for copy/insert operations
   * This removes HTML tags and restores original URLs
   */
  extractPlainText(htmlContent) {
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
      if (link.classList.contains('ai-auto-link')) {
        // For auto-detected URLs, just use the URL
        link.replaceWith(document.createTextNode(originalUrl));
      } else {
        // For markdown links, restore the markdown format
        link.replaceWith(document.createTextNode(`[${linkText}](${originalUrl})`));
      }
    });

    // Get plain text and clean up formatting
    let plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Remove extra whitespace and normalize line breaks
    plainText = plainText.replace(/\s+/g, ' ').trim();

    return plainText;
  }

  /**
   * Get content for copy/insert operations with support for different formats
   */
  getContentForCopyInsert(popup, copyType = 'text') {
    const isEditing = popup.querySelector('.result-text-editor').style.display !== 'none';

    if (isEditing) {
      // In edit mode, return the raw text from textarea
      return popup.querySelector('.result-text-editor').value;
    } else {
      // In view mode, get content based on copy type
      const currentText = popup.dataset.currentText || '';

      if (copyType === 'markdown') {
        // Return original markdown text
        return currentText;
      } else {
        // Return plain text extracted from HTML
        if (window.enhancedMarkdownRenderer) {
          try {
            const htmlContent = window.enhancedMarkdownRenderer.render(currentText);
            return window.enhancedMarkdownRenderer.htmlToPlainText(htmlContent);
          } catch (error) {
            console.error('aiFiverr: Error extracting plain text:', error);
          }
        }
        // Fallback to legacy extraction
        return this.extractPlainText(this.formatAIResult(currentText, { editMode: true }));
      }
    }
  }

  /**
   * Toggle between display and edit mode
   */
  toggleEditMode(popup, originalText) {
    const resultDisplay = popup.querySelector('.result-display');
    const textarea = popup.querySelector('.result-text-editor');
    const editBtn = popup.querySelector('.edit-btn');

    const isEditing = textarea.style.display !== 'none';

    if (isEditing) {
      // Switch to display mode - save the edited content
      const editedText = textarea.value;

      // Store the edited content back to the popup for future use
      popup.dataset.currentText = editedText;

      // Format with view mode (user-friendly links)
      const formattedText = this.formatAIResult(editedText, { editMode: false });
      resultDisplay.innerHTML = formattedText;

      resultDisplay.style.display = 'block';
      textarea.style.display = 'none';
      editBtn.innerHTML = '✏️ Edit';
      editBtn.title = 'Edit text';
    } else {
      // Switch to edit mode - use current content with full URLs
      const currentText = popup.dataset.currentText || originalText;

      // For edit mode, show the original plain text without any formatting
      textarea.value = currentText;

      resultDisplay.style.display = 'none';
      textarea.style.display = 'block';
      editBtn.innerHTML = '👁️ View';
      editBtn.title = 'View formatted text';

      // Auto-resize and focus
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
      setTimeout(() => textarea.focus(), 10);
    }
  }

  /**
   * Position result popup near the floating icon with intelligent positioning
   */
  positionResultPopup(popup) {
    if (!this.floatingIcon) return;

    // First, add popup to DOM temporarily to get actual dimensions
    popup.style.position = 'fixed';
    popup.style.left = '-9999px';
    popup.style.top = '-9999px';
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);

    // Get actual dimensions after rendering
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width;
    const popupHeight = popupRect.height;

    // Get icon and viewport dimensions
    const iconRect = this.floatingIcon.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Define possible positions in order of preference
    const positions = [
      // Right of icon (preferred)
      {
        left: iconRect.right + margin,
        top: iconRect.top,
        name: 'right'
      },
      // Left of icon
      {
        left: iconRect.left - popupWidth - margin,
        top: iconRect.top,
        name: 'left'
      },
      // Below icon
      {
        left: iconRect.left,
        top: iconRect.bottom + margin,
        name: 'below'
      },
      // Above icon
      {
        left: iconRect.left,
        top: iconRect.top - popupHeight - margin,
        name: 'above'
      },
      // Center of viewport (fallback)
      {
        left: (viewportWidth - popupWidth) / 2,
        top: (viewportHeight - popupHeight) / 2,
        name: 'center'
      }
    ];

    // Find the best position that fits within viewport
    let bestPosition = null;
    for (const pos of positions) {
      const fitsHorizontally = pos.left >= margin && pos.left + popupWidth <= viewportWidth - margin;
      const fitsVertically = pos.top >= margin && pos.top + popupHeight <= viewportHeight - margin;

      if (fitsHorizontally && fitsVertically) {
        bestPosition = pos;
        break;
      }
    }

    // If no position fits perfectly, use the center position with adjustments
    if (!bestPosition) {
      bestPosition = positions[positions.length - 1]; // center position

      // Ensure it fits within viewport bounds
      bestPosition.left = Math.max(margin, Math.min(bestPosition.left, viewportWidth - popupWidth - margin));
      bestPosition.top = Math.max(margin, Math.min(bestPosition.top, viewportHeight - popupHeight - margin));
    }

    // Apply the final position
    popup.style.left = `${bestPosition.left}px`;
    popup.style.top = `${bestPosition.top}px`;
    popup.style.visibility = 'visible';
    popup.style.zIndex = '10001';

    console.log(`aiFiverr: Positioned popup at ${bestPosition.name} position (${bestPosition.left}, ${bestPosition.top})`);
  }

  /**
   * Make popup draggable
   */
  makeDraggable(popup) {
    const header = popup.querySelector('.draggable-handle');
    if (!header) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    // Add dragging cursor style
    header.style.cursor = 'move';

    const handleMouseDown = (e) => {
      // Don't start dragging if clicking on close button
      if (e.target.classList.contains('close-btn')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = popup.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Add dragging class for visual feedback
      popup.classList.add('dragging');

      // Prevent text selection during drag
      e.preventDefault();
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      // Get popup dimensions
      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;

      // Constrain to viewport bounds
      newLeft = Math.max(margin, Math.min(newLeft, viewportWidth - popupRect.width - margin));
      newTop = Math.max(margin, Math.min(newTop, viewportHeight - popupRect.height - margin));

      popup.style.left = `${newLeft}px`;
      popup.style.top = `${newTop}px`;
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      isDragging = false;
      popup.classList.remove('dragging');
      document.body.style.userSelect = '';
    };

    // Add event listeners
    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store cleanup function
    popup._dragCleanup = () => {
      header.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }



  /**
   * Close result popup with proper cleanup
   */
  closeResultPopup(popup) {
    if (!popup || !popup.parentNode) return;

    // Clean up event listeners
    if (popup._dragCleanup) {
      popup._dragCleanup();
    }

    // Remove popup
    popup.remove();

    // Clear reference
    if (this.currentResultPopup === popup) {
      this.currentResultPopup = null;
    }
  }

  /**
   * Load enabled state from settings
   */
  async loadEnabledState() {
    try {
      let settings = {};
      if (window.storageManager) {
        settings = await window.storageManager.getSettings();
      } else {
        // Fallback to direct storage access
        const result = await chrome.storage.local.get('settings');
        settings = result.settings || {};
      }

      // Default to enabled if not explicitly set
      this.isEnabled = settings.floatingIconEnabled !== false;
      console.log('aiFiverr: Floating text selection icon enabled:', this.isEnabled);
    } catch (error) {
      console.error('aiFiverr: Error loading floating icon enabled state:', error);
      this.isEnabled = true; // Default to enabled on error
    }
  }

  /**
   * Set enabled state for floating icon
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;

    // Hide floating icon if disabled
    if (!enabled && this.floatingIcon) {
      this.hideFloatingIcon();
    }

    console.log('aiFiverr: Floating text selection icon enabled:', enabled);
  }

  /**
   * Get current enabled state
   */
  isFloatingIconEnabled() {
    return this.isEnabled;
  }

  /**
   * Clean up all popups and UI elements
   */
  cleanup() {
    // Close current result popup
    if (this.currentResultPopup) {
      this.closeResultPopup(this.currentResultPopup);
    }

    // Hide floating icon
    this.hideFloatingIcon();

    // Clean up any remaining popups
    const remainingPopups = document.querySelectorAll('.aifiverr-text-result-popup');
    remainingPopups.forEach(popup => this.closeResultPopup(popup));
  }







  /**
   * Add styles for result popup
   */
  addResultPopupStyles() {
    if (document.getElementById('aifiverr-result-popup-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'aifiverr-result-popup-styles';
    styles.textContent = `
      .aifiverr-text-result-popup {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        width: 455px;
        max-height: 624px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: popupSlideIn 0.2s ease-out;
        display: flex;
        flex-direction: column;
        position: fixed;
        z-index: 10001;
      }

      @keyframes popupSlideIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .aifiverr-text-result-popup .result-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        user-select: none;
      }

      .aifiverr-text-result-popup .draggable-handle {
        cursor: move;
      }

      .aifiverr-text-result-popup.dragging {
        opacity: 0.9;
        transform: scale(1.02);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.1);
        transition: none;
      }

      .aifiverr-text-result-popup .result-title {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .aifiverr-text-result-popup .drag-indicator {
        color: #94a3b8;
        font-size: 12px;
        margin-left: auto;
        margin-right: 8px;
        opacity: 0.6;
        transition: opacity 0.2s ease;
      }

      .aifiverr-text-result-popup .draggable-handle:hover .drag-indicator {
        opacity: 1;
        color: #64748b;
      }

      .aifiverr-text-result-popup .result-icon {
        font-size: 16px;
      }

      .aifiverr-text-result-popup .result-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }

      .aifiverr-text-result-popup .close-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #64748b;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .aifiverr-text-result-popup .close-btn:hover {
        background: rgba(248, 113, 113, 0.1);
        color: #ef4444;
      }

      .aifiverr-text-result-popup .result-content {
        padding: 16px 20px;
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      .aifiverr-text-result-popup .result-display {
        min-height: 187px;
        max-height: none;
        font-size: 14px;
        line-height: 1.4;
        color: #334155;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        background: #fafbfc;
        overflow-y: visible;
        white-space: normal;
        font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* Enhanced formatting styles */
      .aifiverr-text-result-popup .result-display .ai-header-1 {
        font-size: 1.5em;
        font-weight: 600;
        color: #1a73e8;
        margin: 1.2em 0 0.6em 0;
        border-bottom: 2px solid #e8eaed;
        padding-bottom: 0.3em;
      }

      .aifiverr-text-result-popup .result-display .ai-header-2 {
        font-size: 1.3em;
        font-weight: 600;
        color: #202124;
        margin: 1em 0 0.5em 0;
      }

      .aifiverr-text-result-popup .result-display .ai-header-3 {
        font-size: 1.1em;
        font-weight: 600;
        color: #5f6368;
        margin: 0.8em 0 0.4em 0;
      }

      .aifiverr-text-result-popup .result-display .ai-bold {
        font-weight: 600;
        color: #1e293b;
      }

      .aifiverr-text-result-popup .result-display .ai-italic {
        font-style: italic;
        color: #475569;
      }

      .aifiverr-text-result-popup .result-display .ai-strikethrough {
        text-decoration: line-through;
        color: #64748b;
      }

      .aifiverr-text-result-popup .result-display .ai-inline-code {
        background: #f1f5f9;
        color: #e11d48;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 0.9em;
        border: 1px solid #e2e8f0;
      }

      .aifiverr-text-result-popup .result-display .ai-code-block {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        margin: 12px 0;
        overflow-x: auto;
      }

      .aifiverr-text-result-popup .result-display .ai-code-block code {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 0.9em;
        color: #334155;
        line-height: 1.5;
      }

      .aifiverr-text-result-popup .result-display .ai-bullet-list,
      .aifiverr-text-result-popup .result-display .ai-numbered-list {
        margin: 12px 0;
        padding-left: 24px;
      }

      .aifiverr-text-result-popup .result-display .ai-bullet-list {
        list-style-type: disc;
      }

      .aifiverr-text-result-popup .result-display .ai-numbered-list {
        list-style-type: decimal;
      }

      .aifiverr-text-result-popup .result-display .ai-list-item {
        margin: 6px 0;
        line-height: 1.5;
        color: #334155;
      }

      .aifiverr-text-result-popup .result-display .ai-link {
        color: #1a73e8;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
        font-weight: 500;
      }

      .aifiverr-text-result-popup .result-display .ai-link:hover {
        border-bottom-color: #1a73e8;
        background-color: rgba(26, 115, 232, 0.1);
        border-radius: 2px;
      }

      .aifiverr-text-result-popup .result-display .ai-auto-link {
        font-style: italic;
        opacity: 0.9;
      }

      /* Legacy support */
      .aifiverr-text-result-popup .result-display strong {
        font-weight: 600;
        color: #1e293b;
      }

      .aifiverr-text-result-popup .result-display em {
        font-style: italic;
        color: #475569;
      }

      .aifiverr-text-result-popup .result-display ul {
        margin: 4px 0;
        padding-left: 18px;
      }

      .aifiverr-text-result-popup .result-display ol {
        margin: 4px 0;
        padding-left: 18px;
      }

      .aifiverr-text-result-popup .result-display li {
        margin: 0;
        padding: 0;
        list-style-type: disc;
        line-height: 1.4;
      }

      .aifiverr-text-result-popup .result-display li[data-number] {
        list-style-type: decimal;
      }

      /* Fix excessive spacing on markdown elements */
      .aifiverr-text-result-popup .result-display p,
      .aifiverr-text-result-popup .result-display .markdown-paragraph {
        margin: 0 0 4px 0 !important;
        padding: 0 !important;
        line-height: 1.4 !important;
      }

      .aifiverr-text-result-popup .result-display p:last-child,
      .aifiverr-text-result-popup .result-display .markdown-paragraph:last-child {
        margin-bottom: 0 !important;
      }

      .aifiverr-text-result-popup .result-display .markdown-list-item {
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.4 !important;
      }

      .aifiverr-text-result-popup .result-text-editor {
        width: 100%;
        min-height: 187px;
        max-height: none;
        font-size: 14px;
        line-height: 1.6;
        color: #334155;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        resize: vertical;
        font-family: inherit;
        background: white;
        transition: border-color 0.2s ease;
      }

      .aifiverr-text-result-popup .result-text-editor:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .aifiverr-text-result-popup .result-actions {
        padding: 8px 16px 10px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 6px;
        background: #fafbfc;
        flex-shrink: 0;
      }

      .aifiverr-text-result-popup .result-actions button {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #e2e8f0;
        background: white;
        color: #64748b;
        flex: 1;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .aifiverr-text-result-popup .result-actions button:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #475569;
        transform: translateY(-1px);
      }

      .aifiverr-text-result-popup .edit-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        color: white !important;
        border-color: transparent !important;
      }

      .aifiverr-text-result-popup .edit-btn:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
        transform: translateY(-1px);
      }

      .aifiverr-text-result-popup .insert-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
        color: white !important;
        border-color: transparent !important;
      }

      .aifiverr-text-result-popup .insert-btn:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
        transform: translateY(-1px);
      }

      .aifiverr-text-result-popup .continue-chat-btn {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
        color: white !important;
        border-color: transparent !important;
      }

      .aifiverr-text-result-popup .continue-chat-btn:hover {
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%) !important;
        transform: translateY(-1px);
      }
    `;

    document.head.appendChild(styles);
  }









  /**
   * Show success message
   */
  showSuccessMessage(message) {
    this.showToastMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    this.showToastMessage(message, 'error');
  }

  /**
   * Show toast message (wrapper for showToastMessage)
   */
  showToast(message, type = 'info') {
    this.showToastMessage(message, type);
  }

  /**
   * Show toast message
   */
  showToastMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `aifiverr-toast aifiverr-toast-${type}`;
    toast.textContent = message;

    // Add toast styles if not already added
    this.addToastStyles();

    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Add toast styles
   */
  addToastStyles() {
    if (document.getElementById('aifiverr-toast-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'aifiverr-toast-styles';
    styles.textContent = `
      .aifiverr-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 10004;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aifiverr-toast.show {
        opacity: 1;
        transform: translateX(0);
      }

      .aifiverr-toast-success {
        background: #28a745;
      }

      .aifiverr-toast-error {
        background: #dc3545;
      }

      .aifiverr-toast-info {
        background: #17a2b8;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Hide context menu
   */
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  /**
   * Insert text into active field
   */
  async insertTextIntoActiveField(text) {
    // Find suitable input fields on the page
    const inputSelectors = [
      'textarea[data-testid="message-input"]', // Fiverr chat input
      'textarea[placeholder*="message"]', // Generic message inputs
      'textarea[placeholder*="reply"]', // Reply inputs
      'div[contenteditable="true"]', // Contenteditable divs
      'textarea:not([readonly]):not([disabled])', // Any enabled textarea
      'input[type="text"]:not([readonly]):not([disabled])', // Text inputs
      '.ql-editor', // Quill editor
      '[data-testid="offer-description"]', // Offer description
      '[data-testid="brief-description"]' // Brief description
    ];

    // Try to find the most suitable field
    let targetField = null;

    for (const selector of inputSelectors) {
      const fields = document.querySelectorAll(selector);
      for (const field of fields) {
        // Check if field is visible and not disabled
        if (this.isFieldSuitable(field)) {
          targetField = field;
          break;
        }
      }
      if (targetField) break;
    }

    if (!targetField) {
      // Try to find the last focused input
      targetField = document.activeElement;
      if (!this.isFieldSuitable(targetField)) {
        return false;
      }
    }

    // Insert text into the field
    return this.insertTextIntoField(targetField, text);
  }

  /**
   * Check if field is suitable for text insertion
   */
  isFieldSuitable(field) {
    if (!field) return false;

    // Check if field is visible
    const rect = field.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Check if field is not disabled or readonly
    if (field.disabled || field.readOnly) return false;

    // Check if field is actually an input field
    const tagName = field.tagName.toLowerCase();
    const isInput = tagName === 'textarea' || tagName === 'input' || field.contentEditable === 'true';

    return isInput;
  }

  /**
   * Insert text into specific field
   */
  insertTextIntoField(field, text) {
    try {
      if (field.contentEditable === 'true') {
        // Handle contenteditable elements
        field.focus();

        // Try to use execCommand first
        if (document.execCommand) {
          const success = document.execCommand('insertText', false, text);
          if (success) {
            field.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }

        // Fallback: replace content
        field.textContent = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));

      } else {
        // Handle regular input/textarea elements
        field.focus();

        // Get current cursor position
        const start = field.selectionStart || 0;
        const end = field.selectionEnd || 0;

        // Insert text at cursor position
        const currentValue = field.value || '';
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);

        field.value = newValue;

        // Set cursor position after inserted text
        const newCursorPos = start + text.length;
        field.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger events
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return true;
    } catch (error) {
      console.error('Failed to insert text into field:', error);
      return false;
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.isActive = false;

    if (this.floatingIcon) {
      this.floatingIcon.remove();
      this.floatingIcon = null;
    }

    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }

    if (this.processingIndicator) {
      this.processingIndicator.remove();
      this.processingIndicator = null;
    }

    if (this.resultModal) {
      this.resultModal.remove();
      this.resultModal = null;
    }

    if (this.streamingChatbox) {
      this.streamingChatbox.destroy();
      this.streamingChatbox = null;
    }

    // Clear timeouts
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Remove event listeners
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('resize', this.hideFloatingIcon);
    document.removeEventListener('scroll', this.hideFloatingIcon, true);
  }

  /**
   * Validate context before transitioning to streaming chat
   * @param {string} currentText - The current AI result text
   * @param {string} originalText - The original selected text
   * @returns {Object} - Validation result with isValid and error properties
   */
  validateTransitionContext(currentText, originalText) {
    // Check if we have the essential content
    if (!currentText || currentText.trim().length === 0) {
      return {
        isValid: false,
        error: 'No AI result content to transfer'
      };
    }

    if (!originalText || originalText.trim().length === 0) {
      return {
        isValid: false,
        error: 'No original text context available'
      };
    }

    // Check if context data is available
    if (!this.lastProcessedContext && !this.lastUsedVariables) {
      console.warn('aiFiverr: No processed context available for transition');
      // This is not a fatal error, but log it for debugging
    }

    // Validate manually attached files if any
    const manuallyAttachedFiles = this.getManuallyAttachedFiles();
    if (manuallyAttachedFiles && manuallyAttachedFiles.length > 0) {
      const invalidFiles = manuallyAttachedFiles.filter(file =>
        !file.geminiUri || !file.name
      );

      if (invalidFiles.length > 0) {
        console.warn('aiFiverr: Some manually attached files are invalid:', invalidFiles);
        // Continue anyway, but log the issue
      }
    }

    return {
      isValid: true,
      error: null
    };
  }

  /**
   * Show streaming chatbox with AI result and enable continuous conversation
   * @param {string} initialResult - The AI response text
   * @param {string} originalText - The original selected text
   * @returns {Promise<boolean>} - Returns true if chatbox opened successfully, false otherwise
   */
  async showStreamingChatbox(initialResult, originalText) {
    console.log('aiFiverr: Showing streaming chatbox with initial result', { initialResult, originalText });

    try {
      // Set transition state
      const transitionStartTime = Date.now();
      const maxTransitionTime = 10000; // 10 seconds timeout

      // Create or get existing chatbox instance
      if (!this.streamingChatbox) {
        // Check if StreamingChatbox class is available
        if (typeof window.StreamingChatbox === 'undefined') {
          console.error('aiFiverr: StreamingChatbox class not available');
          return false;
        }

        console.log('aiFiverr: Creating new StreamingChatbox instance');

        this.streamingChatbox = new window.StreamingChatbox({
          maxWidth: '700px',
          maxHeight: '600px',
          theme: 'light',
          showActions: true,
          enableDragging: true,
          enableResizing: true
        });

        // Check if creation was successful
        if (!this.streamingChatbox) {
          console.error('aiFiverr: Failed to create StreamingChatbox instance - constructor returned null/undefined');
          return false;
        }

        if (!this.streamingChatbox.chatboxElement) {
          console.error('aiFiverr: StreamingChatbox created but chatboxElement is null/undefined');
          console.error('aiFiverr: StreamingChatbox properties:', {
            hasInit: typeof this.streamingChatbox.init === 'function',
            hasShow: typeof this.streamingChatbox.show === 'function',
            hasHide: typeof this.streamingChatbox.hide === 'function',
            isVisible: this.streamingChatbox.isVisible
          });
          return false;
        }

        console.log('aiFiverr: StreamingChatbox instance created successfully');
      }

      // NEW: Enhanced context preservation with validation
      console.log('aiFiverr: Transferring context to streaming chatbox...');

      // Set original context for consistent variable usage
      if (this.lastProcessedContext) {
        this.streamingChatbox.setOriginalContext(this.lastProcessedContext);
        console.log('aiFiverr: Original context transferred:', Object.keys(this.lastProcessedContext));
      } else {
        console.warn('aiFiverr: No lastProcessedContext available for transfer');
      }

      if (this.lastUsedVariables) {
        this.streamingChatbox.setOriginalVariableUsage(this.lastUsedVariables);
        console.log('aiFiverr: Original variables transferred:', this.lastUsedVariables);
      } else {
        console.warn('aiFiverr: No lastUsedVariables available for transfer');
      }

      // Transfer manually attached files with validation
      const manuallyAttachedFiles = this.getManuallyAttachedFiles();
      if (manuallyAttachedFiles && manuallyAttachedFiles.length > 0) {
        console.log('aiFiverr: Transferring manually attached files:', manuallyAttachedFiles.length);
        this.streamingChatbox.setManuallyAttachedFiles(manuallyAttachedFiles);
      } else {
        console.log('aiFiverr: No manually attached files to transfer');
      }

      // NEW: Ensure API key session consistency (with fallback)
      try {
        await this.ensureAPIKeySessionConsistency();
        console.log('aiFiverr: API key session consistency ensured');
      } catch (apiKeyError) {
        console.warn('aiFiverr: API key session consistency failed, proceeding anyway:', apiKeyError);
        // Continue with transition even if API key session setup fails
      }

      // Clear any existing conversation history and UI messages
      this.streamingChatbox.conversationHistory = [];

      // Clear existing messages from UI
      const messagesContainer = this.streamingChatbox.messagesContainer;
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
      }

      // FIXED: Use the processed prompt that was actually sent to generate the AI response
      // This ensures conversation history matches what the AI originally responded to
      let userMessageForHistory = originalText;

      // If we have the processed prompt from the original request, use that for conversation history
      if (this.lastUsedPrompt && this.lastUsedPrompt.trim()) {
        userMessageForHistory = this.lastUsedPrompt;
        console.log('aiFiverr: Using processed prompt for conversation history to maintain context consistency:', userMessageForHistory.substring(0, 100) + '...');
      } else {
        console.log('aiFiverr: No processed prompt available, using original text:', originalText.substring(0, 100) + '...');
      }

      // Add the conversation history with the actual prompt that generated the response
      const userMessageParts = [{ text: userMessageForHistory }];

      // CRITICAL: Include the same files that were used in the original AI request
      if (this.lastKnowledgeBaseFiles && this.lastKnowledgeBaseFiles.length > 0) {
        // Add files to the beginning of the parts array (same as streaming chat does)
        for (const file of this.lastKnowledgeBaseFiles) {
          if (file.geminiUri) {
            userMessageParts.unshift({
              fileData: {
                fileUri: file.geminiUri,
                mimeType: file.mimeType || 'text/plain'
              }
            });
            console.log('aiFiverr: Added original file to conversation history:', file.name);
          }
        }
      }

      this.streamingChatbox.conversationHistory.push({
        role: 'user',
        parts: userMessageParts
      });

      this.streamingChatbox.conversationHistory.push({
        role: 'model',
        parts: [{ text: initialResult }]
      });

      // CRITICAL FIX: Actually show the chatbox before checking visibility
      console.log('aiFiverr: Showing streaming chatbox...');
      this.streamingChatbox.show();

      // Verify chatbox is actually visible after showing it
      if (!this.streamingChatbox.isVisible) {
        console.error('aiFiverr: Streaming chatbox failed to show after calling show() method');
        return false;
      }

      console.log('aiFiverr: Streaming chatbox is now visible');

      // Add the initial messages to the UI (display the original text for user, AI result as-is)
      this.streamingChatbox.addMessage('user', originalText);
      this.streamingChatbox.addMessage('assistant', initialResult);

      // Only hide the floating icon after successful chatbox initialization
      this.hideFloatingIcon();

      console.log('aiFiverr: Streaming chatbox initialized successfully with conversation context:', this.streamingChatbox.conversationHistory);

      // Log transition completion time
      const transitionTime = Date.now() - transitionStartTime;
      console.log(`aiFiverr: Transition completed in ${transitionTime}ms`);

      return true; // Success
    } catch (error) {
      console.error('aiFiverr: Error initializing streaming chatbox:', error);

      // Cleanup on failure
      if (this.streamingChatbox && this.streamingChatbox.isVisible) {
        try {
          this.streamingChatbox.hide();
        } catch (cleanupError) {
          console.error('aiFiverr: Error during cleanup:', cleanupError);
        }
      }

      return false; // Failure
    }
  }

  /**
   * Ensure API key session consistency between popup and streaming chat
   * @returns {Promise<void>}
   */
  async ensureAPIKeySessionConsistency() {
    try {
      console.log('aiFiverr: Ensuring API key session consistency...');

      // Check if API key manager is available
      if (!window.apiKeyManager || !window.apiKeyManager.initialized) {
        console.warn('aiFiverr: API key manager not available, cannot ensure session consistency');
        return;
      }

      // CRITICAL FIX: Inherit API key from 'gemini' session to maintain file access consistency
      const geminiSessionKey = window.apiKeyManager.getKeyForSession('gemini');
      const streamingSessionId = 'streaming_chat';

      if (geminiSessionKey && geminiSessionKey.key) {
        // Use the same API key from the initial request for streaming chat
        const success = window.apiKeyManager.setSessionKey(streamingSessionId, geminiSessionKey.key);
        if (success) {
          console.log('aiFiverr: Successfully inherited API key from gemini session for streaming chat consistency');
        } else {
          console.warn('aiFiverr: Failed to set inherited API key for streaming chat session');
          // Fallback to creating new session
          this.createFallbackStreamingSession(streamingSessionId);
        }
      } else {
        console.log('aiFiverr: No gemini session key found, creating new streaming session');
        this.createFallbackStreamingSession(streamingSessionId);
      }

    } catch (error) {
      console.error('aiFiverr: Error ensuring API key session consistency:', error);
      // Don't fail the transition for API key issues, just log the error
    }
  }

  /**
   * Create fallback streaming session when gemini session key is not available
   * @param {string} sessionId - The session ID for streaming chat
   */
  createFallbackStreamingSession(sessionId) {
    try {
      // Get any available healthy key for the streaming session
      const newKeyData = window.apiKeyManager.getNextHealthyKey();
      if (newKeyData) {
        window.apiKeyManager.setSessionKey(sessionId, newKeyData.key);
        console.log('aiFiverr: Created fallback API key session for streaming chat');
      } else {
        console.warn('aiFiverr: No healthy API keys available for streaming session');
      }
    } catch (error) {
      console.error('aiFiverr: Error creating fallback streaming session:', error);
    }
  }

  /**
   * Update selection badge counter
   */
  async updateSelectionBadge() {
    try {
      // Send message to background script to increment counter
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'INCREMENT_SELECTION_COUNTER'
        }, (response) => {
          if (response && response.success) {
            console.log('aiFiverr: Selection badge counter updated to:', response.counter);
          }
        });
      }
    } catch (error) {
      console.error('aiFiverr: Error updating selection badge:', error);
    }
  }

  /**
   * Reset selection badge counter
   */
  async resetSelectionBadge() {
    try {
      // Send message to background script to reset counter
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'RESET_SELECTION_COUNTER'
        }, (response) => {
          if (response && response.success) {
            console.log('aiFiverr: Selection badge counter reset to:', response.counter);
          }
        });
      }
    } catch (error) {
      console.error('aiFiverr: Error resetting selection badge:', error);
    }
  }
}

// Create global text selector - but only when explicitly called
function initializeTextSelector() {
  if (!window.textSelector) {
    window.textSelector = new TextSelector();
    console.log('aiFiverr: Text Selector created');
  }
  return window.textSelector;
}

// Export the initialization function but DO NOT auto-initialize
if (typeof window !== 'undefined') {
  window.initializeTextSelector = initializeTextSelector;
}

// REMOVED AUTO-INITIALIZATION - This was causing the text selector to load on every website
// The text selector should only be initialized when explicitly called by the main extension
