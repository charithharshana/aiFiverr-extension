/**
 * API Key Manager
 * Handles API key rotation, health monitoring, and session-based key persistence
 */

class APIKeyManager {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.keyHealth = new Map();
    this.sessionKeys = new Map(); // Maps session IDs to specific keys
    this.rateLimits = new Map();
    this.init();
  }

  async init() {
    await this.loadKeys();
    this.startHealthMonitoring();
    this.initialized = true;
  }

  /**
   * Load API keys from storage
   */
  async loadKeys() {
    try {
      const result = await storageManager.get(['apiKeys', 'keyHealth']);
      this.keys = result.apiKeys || [];
      
      // Initialize health status for all keys
      this.keys.forEach((key, index) => {
        const savedHealth = result.keyHealth?.[index];
        this.keyHealth.set(index, {
          isHealthy: savedHealth?.isHealthy ?? true,
          lastUsed: savedHealth?.lastUsed || null,
          errorCount: savedHealth?.errorCount || 0,
          quotaExhausted: savedHealth?.quotaExhausted || false,
          lastError: savedHealth?.lastError || null,
          successCount: savedHealth?.successCount || 0,
          totalRequests: savedHealth?.totalRequests || 0
        });
      });
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  }

  /**
   * Save key health status
   */
  async saveKeyHealth() {
    try {
      // Check if storage manager is available and extension context is valid
      if (!window.storageManager || !window.storageManager.isExtensionContextValid()) {
        console.warn('aiFiverr: Cannot save key health - storage unavailable or context invalidated');
        return;
      }

      const healthData = {};
      this.keyHealth.forEach((health, index) => {
        try {
          if (health && typeof health === 'object') {
            healthData[index] = health;
          }
        } catch (error) {
          console.warn(`aiFiverr: Error processing key health for index ${index}:`, error);
        }
      });

      await storageManager.set({ keyHealth: healthData });
    } catch (error) {
      console.error('aiFiverr: Failed to save key health:', error);
    }
  }

  /**
   * Add new API keys
   */
  async addKeys(newKeys) {
    const startIndex = this.keys.length;
    this.keys.push(...newKeys);
    
    // Initialize health for new keys
    newKeys.forEach((key, i) => {
      this.keyHealth.set(startIndex + i, {
        isHealthy: true,
        lastUsed: null,
        errorCount: 0,
        quotaExhausted: false,
        lastError: null,
        successCount: 0,
        totalRequests: 0
      });
    });

    await storageManager.set({ apiKeys: this.keys });
    await this.saveKeyHealth();
  }

  /**
   * Update all API keys
   */
  async updateKeys(newKeys) {
    this.keys = [...newKeys];
    this.keyHealth.clear();
    this.sessionKeys.clear();
    this.currentKeyIndex = 0;

    // Initialize health for all keys
    newKeys.forEach((key, index) => {
      this.keyHealth.set(index, {
        isHealthy: true,
        lastUsed: null,
        errorCount: 0,
        quotaExhausted: false,
        lastError: null,
        successCount: 0,
        totalRequests: 0
      });
    });

    await storageManager.set({ apiKeys: this.keys });
    await this.saveKeyHealth();
  }

  /**
   * Get API key for a specific session
   */
  getKeyForSession(sessionId) {
    // Check if session already has an assigned key
    if (this.sessionKeys.has(sessionId)) {
      const keyIndex = this.sessionKeys.get(sessionId);
      const keyHealth = this.keyHealth.get(keyIndex);
      
      // If the assigned key is still healthy, use it
      if (keyHealth?.isHealthy && !keyHealth?.quotaExhausted) {
        return {
          key: this.keys[keyIndex],
          index: keyIndex
        };
      }
    }

    // Get a new healthy key for the session
    const keyData = this.getNextHealthyKey();
    if (keyData) {
      this.sessionKeys.set(sessionId, keyData.index);
    }
    
    return keyData;
  }

  /**
   * Get next healthy API key
   */
  getNextHealthyKey() {
    if (this.keys.length === 0) {
      return null;
    }

    // Find the next healthy key
    let attempts = 0;
    while (attempts < this.keys.length) {
      const keyHealth = this.keyHealth.get(this.currentKeyIndex);
      
      if (keyHealth?.isHealthy && !keyHealth?.quotaExhausted) {
        const keyData = {
          key: this.keys[this.currentKeyIndex],
          index: this.currentKeyIndex
        };
        
        // Update last used time
        keyHealth.lastUsed = Date.now();
        this.saveKeyHealth();
        
        // Move to next key for round-robin
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        
        return keyData;
      }

      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      attempts++;
    }

    // If no healthy keys found, try to reset quota-exhausted keys
    this.resetQuotaExhaustedKeys();
    
    // Return the first available key as fallback
    if (this.keys.length > 0) {
      return {
        key: this.keys[0],
        index: 0
      };
    }

    return null;
  }

  /**
   * Mark key as successful
   */
  markKeySuccess(keyIndex) {
    const keyHealth = this.keyHealth.get(keyIndex);
    if (keyHealth) {
      keyHealth.successCount++;
      keyHealth.totalRequests++;
      keyHealth.lastUsed = Date.now();
      
      // Reset error count on success
      if (keyHealth.errorCount > 0) {
        keyHealth.errorCount = Math.max(0, keyHealth.errorCount - 1);
      }
      
      // Mark as healthy if it was unhealthy
      if (!keyHealth.isHealthy && keyHealth.errorCount === 0) {
        keyHealth.isHealthy = true;
      }
      
      this.saveKeyHealth();
    }
  }

  /**
   * Mark key as failed
   */
  markKeyFailure(keyIndex, error) {
    const keyHealth = this.keyHealth.get(keyIndex);
    if (keyHealth) {
      keyHealth.errorCount++;
      keyHealth.totalRequests++;
      keyHealth.lastError = {
        message: error.message,
        timestamp: Date.now()
      };

      // Check for quota exhaustion
      if (this.isQuotaError(error)) {
        keyHealth.quotaExhausted = true;
        keyHealth.quotaExhaustedAt = Date.now();
      }

      // Mark as unhealthy if too many errors
      if (keyHealth.errorCount >= 3) {
        keyHealth.isHealthy = false;
      }

      this.saveKeyHealth();
      
      // Remove session assignment if key failed
      this.removeKeyFromSessions(keyIndex);
    }
  }

  /**
   * Check if error is quota-related
   */
  isQuotaError(error) {
    const quotaKeywords = [
      'quota',
      'limit',
      'rate limit',
      'too many requests',
      '429',
      'exceeded'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return quotaKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Reset quota-exhausted keys (after 24 hours)
   */
  resetQuotaExhaustedKeys() {
    const now = Date.now();
    const quotaResetTime = 24 * 60 * 60 * 1000; // 24 hours

    this.keyHealth.forEach((health, index) => {
      if (health.quotaExhausted && health.quotaExhaustedAt) {
        if (now - health.quotaExhaustedAt > quotaResetTime) {
          health.quotaExhausted = false;
          health.quotaExhaustedAt = null;
          health.errorCount = 0;
          health.isHealthy = true;
        }
      }
    });

    this.saveKeyHealth();
  }

  /**
   * Remove key from all session assignments
   */
  removeKeyFromSessions(keyIndex) {
    const sessionsToRemove = [];
    this.sessionKeys.forEach((assignedKeyIndex, sessionId) => {
      if (assignedKeyIndex === keyIndex) {
        sessionsToRemove.push(sessionId);
      }
    });

    sessionsToRemove.forEach(sessionId => {
      this.sessionKeys.delete(sessionId);
    });
  }

  /**
   * Get key statistics
   */
  getKeyStats() {
    const stats = {
      totalKeys: this.keys.length,
      healthyKeys: 0,
      unhealthyKeys: 0,
      quotaExhaustedKeys: 0,
      totalRequests: 0,
      totalSuccesses: 0,
      totalErrors: 0,
      keyDetails: []
    };

    this.keyHealth.forEach((health, index) => {
      if (health.isHealthy && !health.quotaExhausted) {
        stats.healthyKeys++;
      } else if (health.quotaExhausted) {
        stats.quotaExhaustedKeys++;
      } else {
        stats.unhealthyKeys++;
      }

      stats.totalRequests += health.totalRequests;
      stats.totalSuccesses += health.successCount;
      stats.totalErrors += health.errorCount;

      stats.keyDetails.push({
        index,
        isHealthy: health.isHealthy,
        quotaExhausted: health.quotaExhausted,
        errorCount: health.errorCount,
        successCount: health.successCount,
        totalRequests: health.totalRequests,
        lastUsed: health.lastUsed,
        lastError: health.lastError
      });
    });

    return stats;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Reset quota-exhausted keys every hour
    setInterval(() => {
      this.resetQuotaExhaustedKeys();
    }, 60 * 60 * 1000);

    // Clean up old session assignments every 30 minutes
    setInterval(() => {
      this.cleanupOldSessions();
    }, 30 * 60 * 1000);
  }

  /**
   * Clean up old session assignments
   */
  async cleanupOldSessions() {
    try {
      // Check if storage manager is available and extension context is valid
      if (!window.storageManager || !window.storageManager.isExtensionContextValid()) {
        console.warn('aiFiverr: Cannot cleanup sessions - storage unavailable or context invalidated');
        return;
      }

      const allSessions = await storageManager.getAllSessions();

      // Validate sessions data
      if (!allSessions || typeof allSessions !== 'object') {
        console.warn('aiFiverr: Invalid sessions data for cleanup');
        return;
      }

      const validSessionIds = new Set(Object.keys(allSessions));

      // Remove assignments for sessions that no longer exist
      const sessionsToRemove = [];
      this.sessionKeys.forEach((keyIndex, sessionId) => {
        try {
          if (!validSessionIds.has(sessionId)) {
            sessionsToRemove.push(sessionId);
          }
        } catch (error) {
          console.warn(`aiFiverr: Error processing session ${sessionId}:`, error);
        }
      });

      sessionsToRemove.forEach(sessionId => {
        try {
          this.sessionKeys.delete(sessionId);
        } catch (error) {
          console.warn(`aiFiverr: Error removing session ${sessionId}:`, error);
        }
      });
    } catch (error) {
      console.error('aiFiverr: Failed to cleanup old sessions:', error);
    }
  }

  /**
   * Force refresh key health
   */
  async refreshKeyHealth() {
    // Reset all keys to healthy state
    this.keyHealth.forEach((health) => {
      health.isHealthy = true;
      health.errorCount = 0;
      health.quotaExhausted = false;
      health.lastError = null;
    });

    await this.saveKeyHealth();
  }

  /**
   * Get available keys count
   */
  getAvailableKeysCount() {
    let count = 0;
    this.keyHealth.forEach((health) => {
      if (health.isHealthy && !health.quotaExhausted) {
        count++;
      }
    });
    return count;
  }

  /**
   * Check if any keys are available
   */
  hasAvailableKeys() {
    return this.getAvailableKeysCount() > 0;
  }

  /**
   * Get rate limit info for key
   */
  getRateLimit(keyIndex) {
    return this.rateLimits.get(keyIndex) || {
      requestsPerMinute: 60,
      requestsPerDay: 1500,
      currentMinuteRequests: 0,
      currentDayRequests: 0,
      minuteResetTime: 0,
      dayResetTime: 0
    };
  }

  /**
   * Update rate limit info
   */
  updateRateLimit(keyIndex, requestCount = 1) {
    const now = Date.now();
    const rateLimit = this.getRateLimit(keyIndex);

    // Reset minute counter if needed
    if (now > rateLimit.minuteResetTime) {
      rateLimit.currentMinuteRequests = 0;
      rateLimit.minuteResetTime = now + 60000; // Next minute
    }

    // Reset day counter if needed
    if (now > rateLimit.dayResetTime) {
      rateLimit.currentDayRequests = 0;
      rateLimit.dayResetTime = now + 86400000; // Next day
    }

    // Update counters
    rateLimit.currentMinuteRequests += requestCount;
    rateLimit.currentDayRequests += requestCount;

    this.rateLimits.set(keyIndex, rateLimit);
  }

  /**
   * Check if key is rate limited
   */
  isRateLimited(keyIndex) {
    const rateLimit = this.getRateLimit(keyIndex);
    return rateLimit.currentMinuteRequests >= rateLimit.requestsPerMinute ||
           rateLimit.currentDayRequests >= rateLimit.requestsPerDay;
  }
}

// Create global API key manager - but only when explicitly called
function initializeAPIKeyManager() {
  if (!window.apiKeyManager) {
    window.apiKeyManager = new APIKeyManager();
    console.log('aiFiverr: API Key Manager created');
  }
  return window.apiKeyManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeAPIKeyManager = initializeAPIKeyManager;

// REMOVED AUTO-INITIALIZATION - This was causing the API key manager to load on every website
// The API key manager should only be initialized when explicitly called by the main extension
