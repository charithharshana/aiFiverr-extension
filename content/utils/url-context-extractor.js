/**
 * URL Context Extractor for aiFiverr Extension
 * Detects URLs in text and extracts their content for use in prompts
 */

class URLContextExtractor {
  constructor() {
    this.urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    this.cache = new Map(); // Cache extracted content
    this.maxCacheSize = 50;
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Extract URLs from text
   */
  extractURLs(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const urls = text.match(this.urlRegex) || [];
    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Check if URL context extraction is enabled
   */
  async isEnabled() {
    try {
      const settings = await this.getSettings();
      return settings?.urlContextExtraction?.enabled === true;
    } catch (error) {
      console.error('aiFiverr URL Extractor: Error checking if enabled:', error);
      return false;
    }
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
      console.error('aiFiverr URL Extractor: Error getting settings:', error);
      return {};
    }
  }

  /**
   * Extract content from URLs and return formatted context
   */
  async extractURLContext(text) {
    try {
      if (!await this.isEnabled()) {
        console.log('aiFiverr URL Extractor: URL context extraction is disabled');
        return { urls: [], context: '', hasContent: false };
      }

      const urls = this.extractURLs(text);
      if (urls.length === 0) {
        return { urls: [], context: '', hasContent: false };
      }

      console.log('aiFiverr URL Extractor: Found URLs:', urls);

      const contextParts = [];
      const processedUrls = [];

      for (const url of urls) {
        try {
          const content = await this.fetchURLContent(url);
          if (content) {
            contextParts.push(`URL: ${url}\nContent: ${content}\n`);
            processedUrls.push({ url, content, success: true });
          } else {
            processedUrls.push({ url, content: null, success: false });
          }
        } catch (error) {
          console.warn('aiFiverr URL Extractor: Failed to extract content from:', url, error);
          processedUrls.push({ url, content: null, success: false, error: error.message });
        }
      }

      const context = contextParts.length > 0 ? 
        `\n--- URL Context ---\n${contextParts.join('\n')}\n--- End URL Context ---\n` : '';

      return {
        urls: processedUrls,
        context,
        hasContent: contextParts.length > 0
      };

    } catch (error) {
      console.error('aiFiverr URL Extractor: Error extracting URL context:', error);
      return { urls: [], context: '', hasContent: false };
    }
  }

  /**
   * Fetch content from a URL (with caching)
   */
  async fetchURLContent(url) {
    try {
      // Check cache first
      const cached = this.getCachedContent(url);
      if (cached) {
        console.log('aiFiverr URL Extractor: Using cached content for:', url);
        return cached;
      }

      // Note: Due to CORS restrictions, we can't directly fetch content from arbitrary URLs
      // in a browser extension content script. This would need to be implemented via:
      // 1. Background script with host permissions
      // 2. External service/API
      // 3. Proxy service
      
      // For now, we'll return a placeholder that indicates the URL was detected
      const placeholder = `[URL detected: ${url}] - Content extraction requires additional permissions or external service.`;
      
      // Cache the placeholder
      this.setCachedContent(url, placeholder);
      
      return placeholder;

    } catch (error) {
      console.error('aiFiverr URL Extractor: Error fetching URL content:', error);
      return null;
    }
  }

  /**
   * Get cached content for URL
   */
  getCachedContent(url) {
    const cached = this.cache.get(url);
    if (!cached) return null;

    // Check if cache has expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(url);
      return null;
    }

    return cached.content;
  }

  /**
   * Set cached content for URL
   */
  setCachedContent(url, content) {
    // Implement LRU cache behavior
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(url, {
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Process text and automatically extract URL context if enabled
   */
  async processText(text) {
    try {
      const settings = await this.getSettings();
      const autoExtract = settings?.urlContextExtraction?.autoExtract !== false;

      if (!autoExtract) {
        return { originalText: text, enhancedText: text, urlContext: null };
      }

      const urlContext = await this.extractURLContext(text);
      
      if (urlContext.hasContent) {
        const enhancedText = text + urlContext.context;
        return {
          originalText: text,
          enhancedText,
          urlContext
        };
      }

      return {
        originalText: text,
        enhancedText: text,
        urlContext
      };

    } catch (error) {
      console.error('aiFiverr URL Extractor: Error processing text:', error);
      return { originalText: text, enhancedText: text, urlContext: null };
    }
  }

  /**
   * Check if text contains URLs
   */
  hasURLs(text) {
    return this.extractURLs(text).length > 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      timeout: this.cacheTimeout
    };
  }
}

// Create global instance
if (!window.urlContextExtractor) {
  window.urlContextExtractor = new URLContextExtractor();
  console.log('aiFiverr: URL Context Extractor initialized');
}
