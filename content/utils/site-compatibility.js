/**
 * Site-Specific Compatibility Layer
 * 
 * Adapts extension behavior based on site-specific restrictions,
 * CSP policies, and known compatibility issues.
 */

class SiteCompatibilityManager {
  constructor() {
    this.currentSite = this.detectSite();
    this.siteConfig = this.getSiteConfiguration();
    this.compatibilityMode = this.determineCompatibilityMode();
    
    this.init();
  }

  init() {
    console.log('aiFiverr Site Compatibility:', {
      site: this.currentSite,
      config: this.siteConfig,
      mode: this.compatibilityMode
    });

    // Apply site-specific configurations
    this.applySiteConfiguration();
    
    // Set up site-specific event listeners
    this.setupSiteSpecificHandlers();
  }

  detectSite() {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('fiverr.com')) return 'fiverr';
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('gmail.com')) return 'gmail';
    if (hostname.includes('github.com')) return 'github';
    
    return 'generic';
  }

  getSiteConfiguration() {
    const configs = {
      facebook: {
        name: 'Facebook',
        strictCSP: true,
        reactSite: true,
        avoidDOMManipulation: true,
        preferTextContent: true,
        disableInlineStyles: true,
        disableInnerHTML: true,
        maxRetries: 2,
        retryDelay: 2000,
        features: {
          knowledgeBase: 'limited',
          textSelection: 'safe',
          popups: 'csp-safe',
          notifications: 'toast-only'
        },
        restrictions: [
          'no-inline-styles',
          'no-innerHTML',
          'no-eval',
          'limited-dom-access'
        ]
      },
      
      twitter: {
        name: 'Twitter/X',
        strictCSP: true,
        reactSite: true,
        avoidDOMManipulation: false,
        preferTextContent: true,
        disableInlineStyles: true,
        disableInnerHTML: false,
        maxRetries: 3,
        retryDelay: 1500,
        features: {
          knowledgeBase: 'full',
          textSelection: 'full',
          popups: 'csp-safe',
          notifications: 'full'
        }
      },
      
      fiverr: {
        name: 'Fiverr',
        strictCSP: false,
        reactSite: false,
        avoidDOMManipulation: false,
        preferTextContent: false,
        disableInlineStyles: false,
        disableInnerHTML: false,
        maxRetries: 3,
        retryDelay: 1000,
        features: {
          knowledgeBase: 'full',
          textSelection: 'full',
          popups: 'full',
          notifications: 'full'
        }
      },
      
      generic: {
        name: 'Generic Site',
        strictCSP: false,
        reactSite: false,
        avoidDOMManipulation: false,
        preferTextContent: false,
        disableInlineStyles: false,
        disableInnerHTML: false,
        maxRetries: 3,
        retryDelay: 1000,
        features: {
          knowledgeBase: 'full',
          textSelection: 'full',
          popups: 'full',
          notifications: 'full'
        }
      }
    };

    return configs[this.currentSite] || configs.generic;
  }

  determineCompatibilityMode() {
    if (this.siteConfig.strictCSP) {
      return 'strict-csp';
    } else if (this.siteConfig.reactSite) {
      return 'react-safe';
    } else {
      return 'standard';
    }
  }

  applySiteConfiguration() {
    // Set global flags based on site configuration
    if (this.siteConfig.disableInlineStyles) {
      window.aiFiverrDisableInlineStyles = true;
    }
    
    if (this.siteConfig.disableInnerHTML) {
      window.aiFiverrDisableInnerHTML = true;
    }
    
    if (this.siteConfig.strictCSP) {
      window.aiFiverrUseCSPSafeMode = true;
    }
    
    if (this.siteConfig.avoidDOMManipulation) {
      window.aiFiverrMinimalDOMMode = true;
    }

    // Configure retry settings
    window.aiFiverrMaxRetries = this.siteConfig.maxRetries;
    window.aiFiverrRetryDelay = this.siteConfig.retryDelay;
  }

  setupSiteSpecificHandlers() {
    switch (this.currentSite) {
      case 'facebook':
        this.setupFacebookHandlers();
        break;
      case 'twitter':
        this.setupTwitterHandlers();
        break;
      case 'fiverr':
        this.setupFiverrHandlers();
        break;
    }
  }

  setupFacebookHandlers() {
    // Monitor for React errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorString = args.join(' ');
      if (errorString.includes('Minified React error')) {
        console.warn('aiFiverr Site Compatibility: React error detected on Facebook, switching to safe mode');
        this.enableSafeMode();
      }
      originalConsoleError.apply(console, args);
    };

    // Monitor for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.sourceFile && event.sourceFile.includes('chrome-extension://')) {
        console.warn('aiFiverr Site Compatibility: CSP violation on Facebook:', event.violatedDirective);
        this.handleCSPViolation(event);
      }
    });
  }

  setupTwitterHandlers() {
    // Twitter-specific handlers
    console.log('aiFiverr Site Compatibility: Setting up Twitter-specific handlers');
  }

  setupFiverrHandlers() {
    // Fiverr-specific handlers (full functionality)
    console.log('aiFiverr Site Compatibility: Setting up Fiverr-specific handlers');
  }

  enableSafeMode() {
    console.log('aiFiverr Site Compatibility: Enabling safe mode');
    window.aiFiverrSafeMode = true;
    window.aiFiverrUseCSPSafeMode = true;
    window.aiFiverrDisableInlineStyles = true;
    window.aiFiverrDisableInnerHTML = true;
    window.aiFiverrMinimalDOMMode = true;
  }

  handleCSPViolation(event) {
    const directive = event.violatedDirective;
    
    if (directive.includes('style-src')) {
      window.aiFiverrDisableInlineStyles = true;
    }
    
    if (directive.includes('script-src')) {
      window.aiFiverrDisableDynamicScripts = true;
    }
    
    // Notify other components
    window.dispatchEvent(new CustomEvent('aifiverr:csp-violation', {
      detail: { directive, blockedURI: event.blockedURI }
    }));
  }

  // Public API methods
  isFeatureAllowed(feature) {
    const featureLevel = this.siteConfig.features[feature];
    return featureLevel === 'full' || featureLevel === 'limited';
  }

  getFeatureLevel(feature) {
    return this.siteConfig.features[feature] || 'disabled';
  }

  shouldUseCSPSafeMode() {
    return this.siteConfig.strictCSP || window.aiFiverrUseCSPSafeMode;
  }

  shouldAvoidDOMManipulation() {
    return this.siteConfig.avoidDOMManipulation || window.aiFiverrMinimalDOMMode;
  }

  canUseInlineStyles() {
    return !this.siteConfig.disableInlineStyles && !window.aiFiverrDisableInlineStyles;
  }

  canUseInnerHTML() {
    return !this.siteConfig.disableInnerHTML && !window.aiFiverrDisableInnerHTML;
  }

  getRetrySettings() {
    return {
      maxRetries: window.aiFiverrMaxRetries || this.siteConfig.maxRetries,
      retryDelay: window.aiFiverrRetryDelay || this.siteConfig.retryDelay
    };
  }

  // Method to create elements safely based on site compatibility
  createElement(tagName, options = {}) {
    if (this.shouldUseCSPSafeMode() && window.cspSafeDOMUtils) {
      return window.cspSafeDOMUtils.createElement(tagName, options);
    } else {
      // Standard DOM creation
      const element = document.createElement(tagName);
      
      if (options.className) element.className = options.className;
      if (options.id) element.id = options.id;
      if (options.textContent) element.textContent = options.textContent;
      
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      
      if (options.styles && this.canUseInlineStyles()) {
        Object.assign(element.style, options.styles);
      }
      
      return element;
    }
  }

  // Method to show notifications based on site compatibility
  showNotification(message, type = 'info', duration = 5000) {
    if (this.shouldUseCSPSafeMode() && window.cspSafeDOMUtils) {
      return window.cspSafeDOMUtils.createNotification(message, type, duration);
    } else {
      // Standard notification (implement as needed)
      console.log(`aiFiverr Notification [${type}]:`, message);
    }
  }
}

// Initialize site compatibility manager
if (typeof window !== 'undefined') {
  window.siteCompatibilityManager = new SiteCompatibilityManager();
}

console.log('aiFiverr: Site compatibility manager loaded');
