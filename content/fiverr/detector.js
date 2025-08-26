/**
 * Fiverr DOM Detector
 * Detects and monitors Fiverr page elements for AI integration
 */

class FiverrDetector {
  constructor() {
    this.observers = new Map();
    this.detectedElements = new Map();
    this.pageType = this.detectPageType();
    this.init();
  }

  init() {
    // Start monitoring for dynamic content
    this.startObserving();
    
    // Initial detection
    this.detectAllElements();
    
    // Re-detect on navigation
    this.monitorNavigation();
  }

  /**
   * Detect current Fiverr page type
   */
  detectPageType() {
    const url = window.location.href;
    
    if (url.includes('/inbox/')) {
      return 'conversation';
    } else if (url.includes('/briefs/')) {
      return 'brief';
    } else if (url.includes('/create_offer') || url.includes('/proposals/')) {
      return 'proposal';
    } else if (url.includes('/gigs/')) {
      return 'gig';
    } else {
      return 'other';
    }
  }

  /**
   * Start observing DOM changes
   */
  startObserving() {
    const observer = new MutationObserver((mutations) => {
      let shouldRedetect = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain relevant elements
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.isRelevantElement(node)) {
                shouldRedetect = true;
              }
            }
          });
        }
      });
      
      if (shouldRedetect) {
        // Debounce re-detection
        clearTimeout(this.redetectTimeout);
        this.redetectTimeout = setTimeout(() => {
          this.detectAllElements();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('main', observer);
  }

  /**
   * Check if element is relevant for AI integration
   */
  isRelevantElement(element) {
    const relevantSelectors = [
      // Chat elements
      '[data-testid*="chat"]',
      '[data-testid*="message"]',
      '.chat-input',
      '.message-input',
      '.conversation-input',
      
      // Proposal elements
      '[data-testid*="proposal"]',
      '[data-testid*="offer"]',
      '.proposal-input',
      '.offer-description',
      
      // Brief elements
      '[data-testid*="brief"]',
      '.brief-description',
      
      // General input elements
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]'
    ];

    return relevantSelectors.some(selector => {
      try {
        return element.matches(selector) || element.querySelector(selector);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Detect all relevant elements on the page
   */
  detectAllElements() {
    this.detectChatElements();
    this.detectProposalElements();
    this.detectBriefElements();
    this.detectInputElements();
    this.detectMessageElements();

    // Notify about detected elements
    this.notifyDetection();
  }

  /**
   * Detect chat-related elements
   */
  detectChatElements() {
    const chatSelectors = [
      // Modern Fiverr message containers - more specific selectors
      '[data-qa="message-item"]',
      '[data-qa*="message"]',
      '.message-item',
      '.message-bubble',
      '.chat-message',
      '.conversation-message',

      // Fiverr inbox specific selectors
      '[class*="message"]',
      '[class*="Message"]',
      'div[role="listitem"]', // Fiverr uses this for message items

      // Input areas - updated for current Fiverr
      'textarea[placeholder*="Type a message"]',
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="reply"]',
      'textarea[placeholder*="Write"]',
      '[data-qa="message-input"]',
      '[data-testid="chat-input"]',
      '[data-testid*="message-input"]',
      '.chat-input',
      '.message-input',
      '.conversation-input',

      // Send buttons
      '[data-testid*="send"]',
      'button[type="submit"]',
      '.send-button',
      '.message-send',
      'button[aria-label*="Send"]'
    ];

    const elements = this.findElements(chatSelectors);
    this.detectedElements.set('chat', elements);

    return elements;
  }

  /**
   * Detect proposal-related elements
   */
  detectProposalElements() {
    const proposalSelectors = [
      // Proposal inputs
      '[data-testid*="proposal"]',
      '[data-testid*="offer"]',
      '.proposal-input',
      '.offer-description',
      'textarea[placeholder*="proposal"]',
      'textarea[placeholder*="offer"]',
      'textarea[placeholder*="describe"]',
      
      // Brief copy buttons
      '.brief-copy',
      '[data-testid*="copy"]',
      'button[title*="copy"]'
    ];

    const elements = this.findElements(proposalSelectors);
    this.detectedElements.set('proposal', elements);
    
    return elements;
  }

  /**
   * Detect brief-related elements
   */
  detectBriefElements() {
    const briefSelectors = [
      // Brief content
      '[data-testid*="brief"]',
      '.brief-description',
      '.brief-content',
      '.project-description',
      
      // Brief details
      '.brief-details',
      '.project-details',
      '.brief-requirements'
    ];

    const elements = this.findElements(briefSelectors);
    this.detectedElements.set('brief', elements);
    
    return elements;
  }

  /**
   * Detect general input elements
   */
  detectInputElements() {
    const inputSelectors = [
      'textarea:not([data-aifiverr-processed])',
      'input[type="text"]:not([data-aifiverr-processed])',
      '[contenteditable="true"]:not([data-aifiverr-processed])'
    ];

    const elements = this.findElements(inputSelectors);

    // Filter out elements that are too small or hidden
    const validElements = elements.filter(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      return rect.width > 50 &&
             rect.height > 20 &&
             style.display !== 'none' &&
             style.visibility !== 'hidden';
    });

    this.detectedElements.set('inputs', validElements);

    return validElements;
  }

  /**
   * Detect message elements - VERY CONSERVATIVE
   */
  detectMessageElements() {
    // Only use very specific selectors - no generic div scanning
    const messageSelectors = [
      '[data-qa="message-item"]',
      '[data-qa="message-bubble"]',
      '[data-testid*="message-item"]',
      '.message-item:not([data-aifiverr-processed])',
      '.message-bubble:not([data-aifiverr-processed])'
    ];

    let messageElements = [];

    // Only try specific selectors - no generic div scanning
    messageSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        messageElements.push(...Array.from(elements));
      } catch (e) {
        // Ignore invalid selectors
      }
    });

    // Remove duplicates and filter valid elements
    const uniqueElements = [...new Set(messageElements)];
    const validElements = uniqueElements.filter(el => {
      const rect = el.getBoundingClientRect();
      const hasGoodSize = rect.width > 200 && rect.height > 40 && rect.height < 300;
      const hasText = el.textContent && el.textContent.trim().length > 20;
      return hasGoodSize && hasText;
    });

    this.detectedElements.set('messages', validElements);
    console.log('aiFiverr: Detected message elements:', validElements.length);
    return validElements;
  }

  /**
   * Check if an element looks like a message - VERY CONSERVATIVE
   */
  looksLikeMessage(element) {
    if (!element || !element.textContent) return false;

    const text = element.textContent.trim();

    // Much stricter criteria
    const hasReasonableText = text.length > 20 && text.length < 1000; // Not too short or too long
    const hasGoodSize = element.offsetWidth > 200 && element.offsetHeight > 40 && element.offsetHeight < 300;
    const isNotInput = !['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SPAN'].includes(element.tagName);
    const isNotScript = !['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'META'].includes(element.tagName);

    // Must be a div or similar container
    const isContainer = ['DIV', 'P', 'ARTICLE', 'SECTION'].includes(element.tagName);

    // Must have specific message-related attributes or be in message context
    const hasMessageAttribute = element.hasAttribute('data-qa') && element.getAttribute('data-qa').includes('message');
    const hasMessageClass = element.className && element.className.includes('message');

    // Avoid common non-message elements
    const isNotNavigation = !element.closest('nav') && !element.closest('[role="navigation"]');
    const isNotHeader = !element.closest('header') && !element.closest('h1, h2, h3, h4, h5, h6');
    const isNotSidebar = !element.closest('[class*="sidebar"]') && !element.closest('[class*="menu"]');

    return hasReasonableText &&
           hasGoodSize &&
           isNotInput &&
           isNotScript &&
           isContainer &&
           (hasMessageAttribute || hasMessageClass) &&
           isNotNavigation &&
           isNotHeader &&
           isNotSidebar;
  }

  /**
   * Find elements using multiple selectors
   */
  findElements(selectors) {
    const elements = [];
    
    selectors.forEach(selector => {
      try {
        const found = document.querySelectorAll(selector);
        elements.push(...Array.from(found));
      } catch (e) {
        console.warn('Invalid selector:', selector, e);
      }
    });

    // Remove duplicates
    return [...new Set(elements)];
  }

  /**
   * Get detected elements by type
   */
  getElements(type) {
    return this.detectedElements.get(type) || [];
  }

  /**
   * Get all detected elements
   */
  getAllElements() {
    const all = {};
    this.detectedElements.forEach((elements, type) => {
      all[type] = elements;
    });
    return all;
  }

  /**
   * Check if element is a Fiverr chat input
   */
  isChatInput(element) {
    if (!element) return false;

    // Be very specific - only textarea elements with message-related placeholders
    if (element.tagName !== 'TEXTAREA') return false;

    const placeholder = element.placeholder ? element.placeholder.toLowerCase() : '';
    const isInInbox = window.location.href.includes('/inbox/');

    // Very specific placeholder checks
    const hasValidPlaceholder = placeholder.includes('type a message') ||
                               placeholder.includes('write a message') ||
                               placeholder.includes('message') && placeholder.length < 50; // Avoid long descriptions

    // Additional checks to ensure it's actually a chat input
    const hasReasonableSize = element.offsetWidth > 200 && element.offsetHeight > 30;
    const isVisible = element.offsetParent !== null;

    return isInInbox && hasValidPlaceholder && hasReasonableSize && isVisible;
  }

  /**
   * Check if element is a proposal input
   */
  isProposalInput(element) {
    if (!element) return false;
    
    const proposalInputSelectors = [
      '[data-testid*="proposal"]',
      '[data-testid*="offer"]',
      '.proposal-input',
      '.offer-description'
    ];

    return proposalInputSelectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Monitor navigation changes
   */
  monitorNavigation() {
    let currentUrl = window.location.href;
    
    const checkNavigation = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.pageType = this.detectPageType();
        
        // Re-detect elements after navigation
        setTimeout(() => {
          this.detectAllElements();
        }, 1000);
      }
    };

    // Check for navigation changes
    setInterval(checkNavigation, 1000);
    
    // Listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(checkNavigation, 100);
    });
  }

  /**
   * Notify about detected elements
   */
  notifyDetection() {
    const elementCounts = {};
    this.detectedElements.forEach((elements, type) => {
      elementCounts[type] = elements.length;
    });

    // Just log locally - no background script communication needed
    console.log('aiFiverr: Elements detected:', {
      pageType: this.pageType,
      elementCounts,
      url: window.location.href
    });

    // Dispatch custom event for other scripts
    window.dispatchEvent(new CustomEvent('aifiverr:elementsDetected', {
      detail: {
        pageType: this.pageType,
        elements: this.getAllElements()
      }
    }));
  }

  /**
   * Mark element as processed
   */
  markAsProcessed(element) {
    if (element) {
      element.setAttribute('data-aifiverr-processed', 'true');
    }
  }

  /**
   * Check if element is already processed
   */
  isProcessed(element) {
    return element && element.hasAttribute('data-aifiverr-processed');
  }

  /**
   * Cleanup observers
   */
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    this.detectedElements.clear();
  }
}

// Create global detector instance - but only when explicitly called
function initializeFiverrDetector() {
  if (!window.fiverrDetector) {
    window.fiverrDetector = new FiverrDetector();
    console.log('aiFiverr: Fiverr Detector created');
  }
  return window.fiverrDetector;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeFiverrDetector = initializeFiverrDetector;

// REMOVED AUTO-INITIALIZATION - This was causing the Fiverr detector to load on every website
// The Fiverr detector should only be initialized when explicitly called by the main extension
