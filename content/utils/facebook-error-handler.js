/**
 * Facebook-Specific Error Handler
 * 
 * Handles JavaScript errors and CSP violations that occur specifically
 * on Facebook and other React-based sites with strict CSP policies.
 */

class FacebookErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorCooldown = 5000; // 5 seconds
    this.lastErrorTime = 0;
    this.knownErrors = new Set();
    this.isInitialized = false;
    
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    // Only initialize on Facebook or other problematic sites
    if (!this.shouldHandleErrors()) {
      return;
    }

    console.log('aiFiverr Facebook Error Handler: Initializing for', window.location.hostname);
    
    // Handle global errors
    this.setupGlobalErrorHandling();
    
    // Handle CSP violations
    this.setupCSPViolationHandling();
    
    // Handle React errors
    this.setupReactErrorHandling();
    
    // Handle extension context errors
    this.setupExtensionErrorHandling();
    
    this.isInitialized = true;
  }

  shouldHandleErrors() {
    const hostname = window.location.hostname.toLowerCase();
    const problematicSites = [
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com',
      'web.facebook.com'
    ];
    
    return problematicSites.some(site => hostname.includes(site));
  }

  setupGlobalErrorHandling() {
    // Capture and handle global JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event);
    });
  }

  setupCSPViolationHandling() {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleCSPViolation(event);
    });
  }

  setupReactErrorHandling() {
    // Monitor for React-specific errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Check for React error patterns
      const errorString = args.join(' ');
      if (this.isReactError(errorString)) {
        this.handleReactError(errorString, args);
      }
      
      // Call original console.error
      originalConsoleError.apply(console, args);
    };
  }

  setupExtensionErrorHandling() {
    // Handle extension context invalidation
    const originalSendMessage = chrome.runtime?.sendMessage;
    if (originalSendMessage) {
      chrome.runtime.sendMessage = (...args) => {
        try {
          return originalSendMessage.apply(chrome.runtime, args);
        } catch (error) {
          this.handleExtensionError(error);
          throw error;
        }
      };
    }
  }

  handleGlobalError(event) {
    const error = event.error;
    const errorKey = `${event.filename}:${event.lineno}:${error?.message}`;
    
    // Avoid spam from the same error
    if (this.knownErrors.has(errorKey)) {
      return;
    }
    
    this.knownErrors.add(errorKey);
    
    // Check if this is an aiFiverr-related error
    if (this.isAiFiverrError(event)) {
      console.warn('aiFiverr Facebook Error Handler: Handling aiFiverr-related error:', {
        message: error?.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
      
      // Attempt graceful degradation
      this.attemptGracefulDegradation(error);
    }
  }

  handlePromiseRejection(event) {
    const reason = event.reason;
    
    if (this.isAiFiverrError({ error: reason })) {
      console.warn('aiFiverr Facebook Error Handler: Handling promise rejection:', reason);
      
      // Prevent the error from being logged to console
      event.preventDefault();
      
      // Attempt recovery
      this.attemptPromiseRecovery(reason);
    }
  }

  handleCSPViolation(event) {
    // Only handle violations related to our extension
    if (event.sourceFile && event.sourceFile.includes('chrome-extension://')) {
      console.warn('aiFiverr Facebook Error Handler: CSP violation detected:', {
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber
      });
      
      // Disable problematic features
      this.disableProblematicFeatures(event.violatedDirective);
    }
  }

  handleReactError(errorString, args) {
    if (errorString.includes('Minified React error #418')) {
      console.warn('aiFiverr Facebook Error Handler: React error #418 detected - likely DOM manipulation conflict');
      
      // Disable DOM manipulation features temporarily
      this.temporarilyDisableDOMManipulation();
    }
  }

  handleExtensionError(error) {
    if (error.message.includes('Extension context invalidated')) {
      console.warn('aiFiverr Facebook Error Handler: Extension context invalidated');
      
      // Disable extension features gracefully
      this.disableExtensionFeatures();
    }
  }

  isAiFiverrError(event) {
    const error = event.error;
    const message = error?.message || '';
    const stack = error?.stack || '';
    const filename = event.filename || '';
    
    // Check for aiFiverr-related patterns
    return (
      message.includes('aiFiverr') ||
      stack.includes('aiFiverr') ||
      filename.includes('chrome-extension://') ||
      message.includes('knowledge base') ||
      message.includes('gemini') ||
      stack.includes('knowledgeBaseManager')
    );
  }

  isReactError(errorString) {
    return (
      errorString.includes('React') ||
      errorString.includes('Minified React error') ||
      errorString.includes('ReactDOM') ||
      errorString.includes('Cannot read properties of null')
    );
  }

  attemptGracefulDegradation(error) {
    // Rate limit error handling
    const now = Date.now();
    if (now - this.lastErrorTime < this.errorCooldown) {
      return;
    }
    
    this.lastErrorTime = now;
    this.errorCount++;
    
    if (this.errorCount > this.maxErrors) {
      console.warn('aiFiverr Facebook Error Handler: Too many errors, disabling extension features');
      this.disableExtensionFeatures();
      return;
    }
    
    // Try to recover based on error type
    if (error.message.includes('knowledge base')) {
      this.recoverKnowledgeBaseFeatures();
    } else if (error.message.includes('DOM')) {
      this.recoverDOMFeatures();
    }
  }

  attemptPromiseRecovery(reason) {
    console.log('aiFiverr Facebook Error Handler: Attempting promise recovery for:', reason);
    
    // If it's a knowledge base related error, try to reinitialize
    if (reason.message && reason.message.includes('knowledge base')) {
      setTimeout(() => {
        this.reinitializeKnowledgeBase();
      }, 1000);
    }
  }

  disableProblematicFeatures(violatedDirective) {
    if (violatedDirective.includes('style-src')) {
      // Disable inline styling
      console.log('aiFiverr Facebook Error Handler: Disabling inline styling due to CSP violation');
      window.aiFiverrDisableInlineStyles = true;
    }
    
    if (violatedDirective.includes('script-src')) {
      // Disable dynamic script features
      console.log('aiFiverr Facebook Error Handler: Disabling dynamic scripts due to CSP violation');
      window.aiFiverrDisableDynamicScripts = true;
    }
  }

  temporarilyDisableDOMManipulation() {
    console.log('aiFiverr Facebook Error Handler: Temporarily disabling DOM manipulation');
    
    window.aiFiverrDisableDOMManipulation = true;
    
    // Re-enable after 30 seconds
    setTimeout(() => {
      window.aiFiverrDisableDOMManipulation = false;
      console.log('aiFiverr Facebook Error Handler: Re-enabling DOM manipulation');
    }, 30000);
  }

  disableExtensionFeatures() {
    console.log('aiFiverr Facebook Error Handler: Disabling extension features due to errors');
    
    // Set global flags to disable features
    window.aiFiverrDisabled = true;
    window.aiFiverrDisableDOMManipulation = true;
    window.aiFiverrDisableInlineStyles = true;
    
    // Try to clean up any existing UI elements
    this.cleanupExtensionUI();
  }

  recoverKnowledgeBaseFeatures() {
    console.log('aiFiverr Facebook Error Handler: Attempting to recover knowledge base features');
    
    // Try to reinitialize knowledge base manager
    setTimeout(() => {
      if (window.knowledgeBaseManager && typeof window.knowledgeBaseManager.initialize === 'function') {
        try {
          window.knowledgeBaseManager.initialize();
        } catch (error) {
          console.warn('aiFiverr Facebook Error Handler: Could not recover knowledge base:', error);
        }
      }
    }, 2000);
  }

  recoverDOMFeatures() {
    console.log('aiFiverr Facebook Error Handler: Attempting to recover DOM features');
    
    // Switch to CSP-safe DOM manipulation
    window.aiFiverrUseCSPSafeDOM = true;
  }

  reinitializeKnowledgeBase() {
    if (window.knowledgeBaseManager) {
      try {
        console.log('aiFiverr Facebook Error Handler: Reinitializing knowledge base manager');
        window.knowledgeBaseManager.initialize();
      } catch (error) {
        console.warn('aiFiverr Facebook Error Handler: Failed to reinitialize knowledge base:', error);
      }
    }
  }

  cleanupExtensionUI() {
    // Remove any aiFiverr UI elements that might be causing issues
    const aiFiverrElements = document.querySelectorAll('[class*="aifiverr"], [id*="aifiverr"]');
    aiFiverrElements.forEach(element => {
      try {
        element.remove();
      } catch (error) {
        console.warn('aiFiverr Facebook Error Handler: Could not remove element:', error);
      }
    });
  }

  // Public method to check if extension should operate normally
  shouldOperateNormally() {
    return !window.aiFiverrDisabled && this.errorCount < this.maxErrors;
  }

  // Public method to check if DOM manipulation is safe
  isDOMManipulationSafe() {
    return !window.aiFiverrDisableDOMManipulation && !window.aiFiverrDisabled;
  }

  // Public method to check if inline styles are allowed
  areInlineStylesAllowed() {
    return !window.aiFiverrDisableInlineStyles && !window.aiFiverrDisabled;
  }
}

// Initialize Facebook error handler
if (typeof window !== 'undefined') {
  window.facebookErrorHandler = new FacebookErrorHandler();
}

console.log('aiFiverr: Facebook error handler loaded');
