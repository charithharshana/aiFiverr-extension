/**
 * Authentication Recovery System for aiFiverr Extension
 * Handles context invalidation and authentication failures
 */

class AuthRecoveryManager {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.contextCheckInterval = 5000;
    this.isRecovering = false;
    this.recoveryCallbacks = new Set();
    
    this.startContextMonitoring();
  }

  /**
   * Monitor extension context and recover if needed
   */
  startContextMonitoring() {
    setInterval(() => {
      this.checkContextHealth();
    }, this.contextCheckInterval);
  }

  /**
   * Check if extension context is healthy
   */
  async checkContextHealth() {
    try {
      // Test chrome API access
      if (!chrome.runtime || !chrome.runtime.id) {
        throw new Error('Chrome runtime not available');
      }

      // Test storage access
      await chrome.storage.local.get('test');
      
      // Test message passing
      const response = await this.sendMessage({ type: 'PING' });
      if (!response || response.contextInvalidated) {
        throw new Error('Background script context invalidated');
      }

      return true;
    } catch (error) {
      console.warn('⚠️ Auth Recovery: Context health check failed:', error.message);
      this.triggerRecovery('context_invalidated');
      return false;
    }
  }

  /**
   * Send message with error handling
   */
  async sendMessage(message, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        
        if (response && response.contextInvalidated) {
          throw new Error('Extension context invalidated');
        }
        
        return response;
      } catch (error) {
        console.warn(`⚠️ Auth Recovery: Message attempt ${attempt}/${retries} failed:`, error.message);
        
        if (attempt === retries) {
          throw error;
        }
        
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  /**
   * Trigger authentication recovery
   */
  async triggerRecovery(reason) {
    if (this.isRecovering) {
      console.log('🔄 Auth Recovery: Recovery already in progress');
      return;
    }

    this.isRecovering = true;
    console.log('🚨 Auth Recovery: Starting recovery process, reason:', reason);

    try {
      // Step 1: Clear potentially corrupted auth state
      await this.clearCorruptedState();

      // Step 2: Attempt to restore authentication
      const recovered = await this.attemptAuthRestore();

      if (recovered) {
        console.log('✅ Auth Recovery: Successfully recovered authentication');
        this.notifyRecoveryCallbacks(true);
      } else {
        console.log('❌ Auth Recovery: Failed to recover authentication');
        this.notifyRecoveryCallbacks(false);
        this.showRecoveryUI();
      }
    } catch (error) {
      console.error('❌ Auth Recovery: Recovery process failed:', error);
      this.notifyRecoveryCallbacks(false);
      this.showRecoveryUI();
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Clear potentially corrupted authentication state
   */
  async clearCorruptedState() {
    try {
      await chrome.storage.local.remove(['firebase_auth_state', 'google_auth_state']);
      console.log('🧹 Auth Recovery: Cleared corrupted auth state');
    } catch (error) {
      console.warn('⚠️ Auth Recovery: Failed to clear state:', error.message);
    }
  }

  /**
   * Attempt to restore authentication
   */
  async attemptAuthRestore() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Auth Recovery: Restore attempt ${attempt}/${this.maxRetries}`);

        // Check current auth status
        const authStatus = await this.sendMessage({ type: 'GOOGLE_AUTH_STATUS' });
        
        if (authStatus && authStatus.success && authStatus.isAuthenticated) {
          console.log('✅ Auth Recovery: Authentication already restored');
          return true;
        }

        // Attempt fresh authentication
        const authResult = await this.sendMessage({ type: 'GOOGLE_AUTH_START' });
        
        if (authResult && authResult.success) {
          console.log('✅ Auth Recovery: Fresh authentication successful');
          return true;
        }

        console.warn(`⚠️ Auth Recovery: Attempt ${attempt} failed:`, authResult?.error);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      } catch (error) {
        console.warn(`⚠️ Auth Recovery: Attempt ${attempt} error:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    return false;
  }

  /**
   * Show recovery UI to user
   */
  showRecoveryUI() {
    const notification = document.createElement('div');
    notification.id = 'auth-recovery-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      ">
        <div style="font-weight: bold; margin-bottom: 8px;">
          🚨 aiFiverr Authentication Issue
        </div>
        <div style="margin-bottom: 12px;">
          The extension needs to be reloaded to restore functionality.
        </div>
        <button onclick="this.parentElement.parentElement.remove(); chrome.runtime.reload();" style="
          background: white;
          color: #dc3545;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">
          Reload Extension
        </button>
        <button onclick="this.parentElement.parentElement.remove();" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 8px;
        ">
          Dismiss
        </button>
      </div>
    `;

    // Remove existing notification
    const existing = document.getElementById('auth-recovery-notification');
    if (existing) {
      existing.remove();
    }

    document.body.appendChild(notification);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 30000);
  }

  /**
   * Register callback for recovery events
   */
  onRecovery(callback) {
    this.recoveryCallbacks.add(callback);
  }

  /**
   * Unregister recovery callback
   */
  offRecovery(callback) {
    this.recoveryCallbacks.delete(callback);
  }

  /**
   * Notify all recovery callbacks
   */
  notifyRecoveryCallbacks(success) {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(success);
      } catch (error) {
        console.error('❌ Auth Recovery: Callback error:', error);
      }
    });
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery status
   */
  getStatus() {
    return {
      isRecovering: this.isRecovering,
      callbackCount: this.recoveryCallbacks.size
    };
  }
}

// Create global instance
window.authRecoveryManager = new AuthRecoveryManager();

console.log('🔧 Auth Recovery: Manager initialized');
