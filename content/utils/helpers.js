/**
 * Utility functions for aiFiverr extension
 * Based on AiQuickFill helpers with Fiverr-specific enhancements
 */

/**
 * Checks if an element is a valid input field for AI assistance
 * Enhanced for Fiverr's specific input types
 */
function isValidInputField(element) {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const type = element.type?.toLowerCase();
  
  // Standard input validation
  const isTextarea = tagName === 'textarea';
  const isTextInput = tagName === 'input' && (type === 'text' || !type);
  const isContentEditable = element.isContentEditable;
  
  // Fiverr-specific selectors
  const isFiverrChatInput = element.matches([
    '[data-testid="chat-input"]',
    '.chat-input',
    '.message-input',
    '.conversation-input',
    '[placeholder*="message"]',
    '[placeholder*="reply"]'
  ].join(','));
  
  const isFiverrProposalInput = element.matches([
    '[data-testid="proposal-description"]',
    '.proposal-input',
    '.offer-description',
    '[placeholder*="proposal"]',
    '[placeholder*="offer"]'
  ].join(','));
  
  // Exclude password and email fields
  const isExcluded = type === 'password' || type === 'email' || type === 'search';
  
  return (isTextarea || isTextInput || isContentEditable || isFiverrChatInput || isFiverrProposalInput) && !isExcluded;
}

/**
 * Gets cursor position for tooltip placement
 * Enhanced version from AiQuickFill
 */
function getCursorPosition(input, selectionPoint = null) {
  if (!input) return { x: 0, y: 0 };
  
  const point = selectionPoint !== null ? selectionPoint : input.selectionStart || 0;
  
  const {
    offsetLeft: inputX,
    offsetTop: inputY,
    offsetWidth: inputWidth,
    offsetHeight: inputHeight
  } = input;
  
  // Create a dummy element to measure text
  const div = document.createElement('div');
  const computedStyle = getComputedStyle(input);
  
  // Copy all relevant styles
  for (const prop of computedStyle) {
    div.style[prop] = computedStyle[prop];
  }
  
  // Set positioning and dimensions
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.height = 'auto';
  div.style.width = inputWidth + 'px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  
  // Get text content up to cursor
  const textContent = (input.value || '').substring(0, point);
  div.textContent = textContent;
  
  document.body.appendChild(div);
  
  const coords = {
    x: inputX,
    y: inputY + div.offsetHeight + 5 // Add small offset
  };
  
  document.body.removeChild(div);
  
  return coords;
}

/**
 * Creates and shows a tooltip with AI content
 */
function showTooltip(content, targetElement, options = {}) {
  // Remove existing tooltip
  removeTooltip();
  
  const tooltip = document.createElement('div');
  tooltip.id = 'aifiverr-tooltip';
  tooltip.className = 'aifiverr-tooltip';
  
  // Set content
  if (typeof content === 'string') {
    tooltip.textContent = content;
  } else {
    tooltip.appendChild(content);
  }
  
  // Apply styles
  Object.assign(tooltip.style, {
    position: 'absolute',
    zIndex: '10000',
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '400px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #34495e',
    lineHeight: '1.4',
    wordWrap: 'break-word',
    ...options.style
  });
  
  document.body.appendChild(tooltip);
  
  // Position tooltip
  const { x, y } = getCursorPosition(targetElement);
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  
  // Adjust position if tooltip goes off screen
  const rect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  if (rect.right > viewportWidth) {
    tooltip.style.left = (viewportWidth - rect.width - 10) + 'px';
  }
  
  if (rect.bottom > viewportHeight) {
    tooltip.style.top = (y - rect.height - 10) + 'px';
  }
  
  return tooltip;
}

/**
 * Removes existing tooltip
 */
function removeTooltip() {
  const existing = document.getElementById('aifiverr-tooltip');
  if (existing) {
    existing.remove();
  }
}

/**
 * Remove markdown formatting from text
 */
function removeMarkdownFormatting(text) {
  if (!text || typeof text !== 'string') return text;

  return text
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')      // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')      // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')        // _italic_ -> italic

    // Remove headers
    .replace(/^#{1,6}\s+(.+)$/gm, '$1') // # Header -> Header

    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')     // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')        // `code` -> code

    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text

    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')

    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '• ')    // Convert to bullet points
    .replace(/^\s*\d+\.\s+/gm, '')      // Remove numbered list markers

    // Remove blockquotes
    .replace(/^>\s+/gm, '')

    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')         // Max 2 consecutive newlines
    .trim();
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generates a unique session ID
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Formats timestamp for display
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Safely gets nested object properties
 */
function safeGet(obj, path, defaultValue = null) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}

/**
 * Creates a loading spinner element
 */
function createLoadingSpinner() {
  const spinner = document.createElement('div');
  spinner.className = 'aifiverr-spinner';
  spinner.innerHTML = `
    <div class="spinner-circle"></div>
    <span>AI is thinking...</span>
  `;
  return spinner;
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Checks if current page is a Fiverr conversation page
 */
function isFiverrConversationPage() {
  return window.location.href.includes('/inbox/') && 
         window.location.href.includes('fiverr.com');
}

/**
 * Checks if current page is a Fiverr brief page
 */
function isFiverrBriefPage() {
  return window.location.href.includes('/briefs/') && 
         window.location.href.includes('fiverr.com');
}

/**
 * Checks if current page is a Fiverr proposal page
 */
function isFiverrProposalPage() {
  return (window.location.href.includes('/create_offer') || 
          window.location.href.includes('/proposals/')) && 
         window.location.href.includes('fiverr.com');
}

/**
 * Waits for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Copies text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
}
