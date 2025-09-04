/**
 * CSP-Safe DOM Manipulation Utilities
 * 
 * This module provides utilities for creating and manipulating DOM elements
 * in a way that's compatible with strict Content Security Policies,
 * particularly on sites like Facebook that block inline styles and scripts.
 */

class CSPSafeDOMUtils {
  constructor() {
    this.styleSheets = new Map();
    this.classCounter = 0;
    this.initializeStyleSheet();
  }

  /**
   * Initialize a dedicated stylesheet for dynamic styles
   */
  initializeStyleSheet() {
    try {
      // Create a dedicated stylesheet for aiFiverr dynamic styles
      const styleElement = document.createElement('style');
      styleElement.id = 'aifiverr-dynamic-styles';
      styleElement.type = 'text/css';
      
      // Add to head if possible, otherwise to document
      const target = document.head || document.documentElement;
      target.appendChild(styleElement);
      
      this.dynamicStyleSheet = styleElement.sheet;
      console.log('aiFiverr CSP-Safe DOM: Dynamic stylesheet initialized');
    } catch (error) {
      console.warn('aiFiverr CSP-Safe DOM: Could not create dynamic stylesheet:', error);
      this.dynamicStyleSheet = null;
    }
  }

  /**
   * Create a unique CSS class name
   */
  generateClassName(prefix = 'aifiverr-dynamic') {
    return `${prefix}-${++this.classCounter}`;
  }

  /**
   * Add CSS rules to the dynamic stylesheet
   */
  addCSSRule(selector, rules) {
    if (!this.dynamicStyleSheet) {
      console.warn('aiFiverr CSP-Safe DOM: Dynamic stylesheet not available');
      return null;
    }

    try {
      const ruleText = `${selector} { ${rules} }`;
      const index = this.dynamicStyleSheet.insertRule(ruleText, this.dynamicStyleSheet.cssRules.length);
      return index;
    } catch (error) {
      console.warn('aiFiverr CSP-Safe DOM: Could not add CSS rule:', error);
      return null;
    }
  }

  /**
   * Create an element with CSP-safe styling
   */
  createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    // Set basic attributes
    if (options.className) {
      element.className = options.className;
    }
    
    if (options.id) {
      element.id = options.id;
    }

    // Set text content safely
    if (options.textContent) {
      element.textContent = options.textContent;
    }

    // Set attributes
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    // Apply styles via CSS classes instead of inline styles
    if (options.styles) {
      const className = this.generateClassName();
      element.classList.add(className);
      
      const cssRules = Object.entries(options.styles)
        .map(([property, value]) => `${this.camelToKebab(property)}: ${value}`)
        .join('; ');
      
      this.addCSSRule(`.${className}`, cssRules);
    }

    return element;
  }

  /**
   * Create a popup element with CSP-safe styling
   */
  createPopup(options = {}) {
    const {
      title = 'aiFiverr',
      content = '',
      className = 'aifiverr-popup',
      closable = true,
      modal = true
    } = options;

    // Create popup container
    const popup = this.createElement('div', {
      className: `${className} aifiverr-csp-safe-popup`,
      styles: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '0',
        maxWidth: '500px',
        maxHeight: '80vh',
        zIndex: '10001',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }
    });

    // Create header
    const header = this.createElement('div', {
      className: 'popup-header',
      styles: {
        padding: '16px 20px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
      }
    });

    const titleElement = this.createElement('h4', {
      textContent: title,
      styles: {
        margin: '0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#111827'
      }
    });

    header.appendChild(titleElement);

    // Add close button if closable
    if (closable) {
      const closeButton = this.createElement('button', {
        textContent: '×',
        className: 'popup-close-btn',
        styles: {
          background: 'none',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280'
        }
      });

      closeButton.addEventListener('click', () => {
        this.removePopup(popup);
      });

      header.appendChild(closeButton);
    }

    // Create content area
    const contentArea = this.createElement('div', {
      className: 'popup-content',
      styles: {
        padding: '20px',
        maxHeight: '60vh',
        overflowY: 'auto'
      }
    });

    // Set content safely
    if (typeof content === 'string') {
      contentArea.textContent = content;
    } else if (content instanceof HTMLElement) {
      contentArea.appendChild(content);
    }

    popup.appendChild(header);
    popup.appendChild(contentArea);

    // Add modal backdrop if requested
    if (modal) {
      const backdrop = this.createElement('div', {
        className: 'popup-backdrop',
        styles: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: '10000'
        }
      });

      backdrop.addEventListener('click', () => {
        if (closable) {
          this.removePopup(popup);
        }
      });

      document.body.appendChild(backdrop);
      popup.backdrop = backdrop;
    }

    return popup;
  }

  /**
   * Show a popup
   */
  showPopup(popup) {
    document.body.appendChild(popup);
    
    // Focus management for accessibility
    const firstFocusable = popup.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Remove a popup
   */
  removePopup(popup) {
    if (popup.backdrop) {
      popup.backdrop.remove();
    }
    popup.remove();
  }

  /**
   * Create a notification/toast element
   */
  createNotification(message, type = 'info', duration = 5000) {
    const notification = this.createElement('div', {
      className: `aifiverr-notification aifiverr-notification-${type}`,
      textContent: message,
      styles: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        zIndex: '10002',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease-out'
      }
    });

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }, duration);
    }

    return notification;
  }

  /**
   * Convert camelCase to kebab-case for CSS properties
   */
  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Safely set HTML content without using innerHTML
   */
  setHTMLContent(element, htmlString) {
    // Clear existing content
    element.textContent = '';
    
    try {
      // Use DOMParser for safe HTML parsing
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      // Move nodes from parsed document to target element
      Array.from(doc.body.childNodes).forEach(node => {
        element.appendChild(node.cloneNode(true));
      });
    } catch (error) {
      console.warn('aiFiverr CSP-Safe DOM: Could not parse HTML safely, using text content:', error);
      element.textContent = htmlString.replace(/<[^>]*>/g, ''); // Strip HTML tags
    }
  }

  /**
   * Check if we're on a site with strict CSP
   */
  isStrictCSPSite() {
    const hostname = window.location.hostname.toLowerCase();
    const strictSites = [
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'linkedin.com'
    ];
    
    return strictSites.some(site => hostname.includes(site));
  }

  /**
   * Get site-specific configuration
   */
  getSiteConfig() {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('facebook.com')) {
      return {
        name: 'facebook',
        strictCSP: true,
        reactSite: true,
        avoidDOMManipulation: true,
        preferTextContent: true
      };
    }
    
    return {
      name: 'default',
      strictCSP: false,
      reactSite: false,
      avoidDOMManipulation: false,
      preferTextContent: false
    };
  }
}

// Create global instance
window.cspSafeDOMUtils = new CSPSafeDOMUtils();

console.log('aiFiverr: CSP-Safe DOM utilities loaded');
