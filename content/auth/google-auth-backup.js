/**
 * Google Authentication Service for aiFiverr Extension
 * Firebase-compatible wrapper that maintains the same API as the original Chrome-specific version
 * Now uses Firebase Authentication for cross-browser compatibility
 */

class GoogleAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.userInfo = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.authListeners = new Set();
    this.useFirebase = true; // Flag to indicate Firebase usage
    this.init();
  }

  async init() {
    try {
      console.log('aiFiverr Auth: Initializing authentication manager...');

      // Load stored authentication data
      await this.loadStoredAuth();

      // Check if stored token is still valid
      if (this.accessToken && this.tokenExpiry) {
        const timeUntilExpiry = this.tokenExpiry - Date.now();
        console.log('aiFiverr Auth: Token expires in', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');

        if (Date.now() < this.tokenExpiry - 300000) { // 5 minute buffer
          this.isAuthenticated = true;
          console.log('aiFiverr Auth: Using stored valid token');

          // Validate token with background script
          await this.validateTokenWithBackground();
        } else {
          console.log('aiFiverr Auth: Stored token expired or expiring soon, attempting refresh');
          await this.refreshTokenIfNeeded();
        }
      } else {
        console.log('aiFiverr Auth: No stored authentication data found');
      }

      this.initialized = true;
      this.notifyAuthListeners();

      // Start periodic token validation
      this.startTokenValidationTimer();

      console.log('aiFiverr Auth: Authentication manager initialized, authenticated:', this.isAuthenticated);
    } catch (error) {
      console.error('aiFiverr Auth: Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * Start periodic token validation to maintain session
   */
  startTokenValidationTimer() {
    // Check token every 10 minutes
    setInterval(async () => {
      if (this.isAuthenticated && this.accessToken) {
        console.log('aiFiverr Auth: Periodic token validation check');
        await this.refreshTokenIfNeeded();
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Load stored authentication data from Chrome storage
   */
  async loadStoredAuth() {
    try {
      const result = await chrome.storage.local.get([
        'google_access_token',
        'google_refresh_token', 
        'google_token_expiry',
        'google_user_info'
      ]);

      this.accessToken = result.google_access_token;
      this.refreshToken = result.google_refresh_token;
      this.tokenExpiry = result.google_token_expiry;
      this.userInfo = result.google_user_info;

      if (this.userInfo) {
        this.isAuthenticated = true;
      }
    } catch (error) {
      console.error('aiFiverr Auth: Failed to load stored auth:', error);
    }
  }

  /**
   * Save authentication data to Chrome storage
   */
  async saveAuth() {
    try {
      await chrome.storage.local.set({
        google_access_token: this.accessToken,
        google_refresh_token: this.refreshToken,
        google_token_expiry: this.tokenExpiry,
        google_user_info: this.userInfo
      });
    } catch (error) {
      console.error('aiFiverr Auth: Failed to save auth:', error);
    }
  }

  /**
   * Clear authentication data
   */
  async clearAuth() {
    this.isAuthenticated = false;
    this.userInfo = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;

    try {
      await chrome.storage.local.remove([
        'google_access_token',
        'google_refresh_token',
        'google_token_expiry', 
        'google_user_info'
      ]);
    } catch (error) {
      console.error('aiFiverr Auth: Failed to clear auth storage:', error);
    }

    this.notifyAuthListeners();
  }

  /**
   * Start Google OAuth 2.0 authentication flow
   */
  async authenticate() {
    try {
      console.log('aiFiverr Auth: Starting authentication flow...');

      // Send message to background script with retry mechanism
      const response = await this.sendMessageWithRetry({
        type: 'GOOGLE_AUTH_START'
      }, 3); // Retry up to 3 times

      if (response && response.success) {
        // Update local state with authentication data
        this.userInfo = response.user;
        this.isAuthenticated = true;

        // Load the full auth state from storage
        await this.loadStoredAuth();

        this.notifyAuthListeners();

        console.log('aiFiverr Auth: Authentication successful');
        return {
          success: true,
          user: this.userInfo
        };
      } else {
        throw new Error(response?.error || 'Authentication failed');
      }

    } catch (error) {
      console.error('aiFiverr Auth: Authentication failed:', error);
      await this.clearAuth();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send message to background script with retry mechanism
   */
  async sendMessageWithRetry(message, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`aiFiverr Auth: Sending message (attempt ${attempt}/${maxRetries}):`, message.type);

        const response = await new Promise((resolve, reject) => {
          // Add timeout to prevent hanging
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout - no response received'));
          }, 10000); // 10 second timeout

          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              console.error('aiFiverr Auth: Chrome runtime error:', chrome.runtime.lastError.message);

              // Handle specific Chrome runtime errors
              if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                reject(new Error('Could not establish connection. Receiving end does not exist.'));
              } else if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                // For context invalidation, don't retry - just log and continue
                console.warn('aiFiverr Auth: Extension context invalidated - this is expected during extension updates');
                reject(new Error('Extension context invalidated'));
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
            } else {
              resolve(response);
            }
          });
        });

        console.log(`aiFiverr Auth: Message response received (attempt ${attempt}):`, response);
        return response;

      } catch (error) {
        console.error(`aiFiverr Auth: Message attempt ${attempt} failed:`, error.message);

        // For extension context invalidation, don't retry but return gracefully
        if (error.message.includes('Extension context invalidated')) {
          console.warn('aiFiverr Auth: Extension context invalidated - this is expected during extension updates');
          return { success: false, error: 'Extension context invalidated', recoverable: true };
        }

        if (attempt === maxRetries) {
          throw new Error(`Failed to communicate with background script after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retrying
        console.log(`aiFiverr Auth: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }

  /**
   * Fetch user information from Google API
   */
  async fetchUserInfo() {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      this.userInfo = await response.json();
      console.log('aiFiverr Auth: User info fetched:', this.userInfo.email);

    } catch (error) {
      console.error('aiFiverr Auth: Failed to fetch user info:', error);
      throw error;
    }
  }

  /**
   * Collect user data and store in Google Sheets
   */
  async collectUserData() {
    try {
      if (!this.userInfo) {
        throw new Error('No user info available');
      }

      console.log('aiFiverr Auth: Collecting user data for:', this.userInfo.email);

      // Store user data in Google Sheets using the Google client
      if (window.googleClient) {
        try {
          await window.googleClient.addUserData({
            email: this.userInfo.email,
            name: this.userInfo.name,
            picture: this.userInfo.picture,
            id: this.userInfo.id,
            given_name: this.userInfo.given_name,
            family_name: this.userInfo.family_name,
            locale: this.userInfo.locale,
            timestamp: new Date().toISOString()
          });
          console.log('aiFiverr Auth: User data stored in Google Sheets with all fields');
        } catch (sheetsError) {
          console.warn('aiFiverr Auth: Failed to store in Google Sheets:', sheetsError);
        }
      }

      // Also send to background script for local backup
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'COLLECT_USER_DATA',
          userData: {
            email: this.userInfo.email,
            name: this.userInfo.name,
            picture: this.userInfo.picture,
            id: this.userInfo.id,
            given_name: this.userInfo.given_name,
            family_name: this.userInfo.family_name,
            locale: this.userInfo.locale,
            timestamp: new Date().toISOString()
          }
        });

        if (!response?.success) {
          console.warn('aiFiverr Auth: Failed to store local backup:', response?.error);
        } else {
          console.log('aiFiverr Auth: User data backed up locally');
        }
      } catch (backupError) {
        console.warn('aiFiverr Auth: Failed to create local backup:', backupError);
      }

    } catch (error) {
      console.error('aiFiverr Auth: Failed to collect user data:', error);
      // Don't throw - this shouldn't block authentication
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      // Send message to background script to handle sign out with retry
      const response = await this.sendMessageWithRetry({
        type: 'GOOGLE_AUTH_SIGNOUT'
      });

      if (response && response.success) {
        // Clear local authentication data
        await this.clearAuth();

        console.log('aiFiverr Auth: Sign out successful');
        return { success: true };
      } else {
        throw new Error(response?.error || 'Sign out failed');
      }

    } catch (error) {
      console.error('aiFiverr Auth: Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.userInfo && this.accessToken;
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.userInfo;
  }

  /**
   * Get current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Add authentication state listener
   */
  addAuthListener(callback) {
    this.authListeners.add(callback);
  }

  /**
   * Remove authentication state listener
   */
  removeAuthListener(callback) {
    this.authListeners.delete(callback);
  }

  /**
   * Notify all authentication listeners
   */
  notifyAuthListeners() {
    this.authListeners.forEach(callback => {
      try {
        callback({
          isAuthenticated: this.isAuthenticated,
          user: this.userInfo
        });
      } catch (error) {
        console.error('aiFiverr Auth: Listener error:', error);
      }
    });
  }

  /**
   * Validate token with background script
   */
  async validateTokenWithBackground() {
    try {
      console.log('aiFiverr Auth: Validating token with background script...');

      const response = await this.sendMessageWithRetry({
        type: 'GOOGLE_AUTH_TOKEN'
      }, 2); // Only retry twice for token validation

      if (response && response.success && response.token) {
        // Update local token if background has a newer one
        if (response.token !== this.accessToken) {
          console.log('aiFiverr Auth: Updating local token from background');
          this.accessToken = response.token;
          this.tokenExpiry = Date.now() + (3600 * 1000);
          await this.saveAuth();
        }
        this.isAuthenticated = true;
      } else {
        console.warn('aiFiverr Auth: Token validation failed, clearing local auth');
        await this.clearAuth();
      }
    } catch (error) {
      console.error('aiFiverr Auth: Token validation error:', error);
      // Don't clear auth on connection errors, just log the issue
      if (!error.message.includes('Could not establish connection')) {
        await this.clearAuth();
      }
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    if (!this.tokenExpiry || Date.now() < this.tokenExpiry - 300000) { // 5 minutes buffer
      return this.accessToken;
    }

    try {
      console.log('aiFiverr Auth: Refreshing token...');

      // Get fresh token from background script with retry
      const response = await this.sendMessageWithRetry({
        type: 'GOOGLE_AUTH_TOKEN'
      }, 2); // Only retry twice for token refresh

      if (response && response.success && response.token) {
        this.accessToken = response.token;
        this.tokenExpiry = Date.now() + (3600 * 1000);
        this.isAuthenticated = true;
        await this.saveAuth();
        this.notifyAuthListeners();
        console.log('aiFiverr Auth: Token refreshed successfully');
        return this.accessToken;
      } else {
        console.warn('aiFiverr Auth: Token refresh failed - no valid token from background');
        await this.clearAuth();
        return null;
      }

    } catch (error) {
      console.error('aiFiverr Auth: Token refresh failed:', error);
      // Don't clear auth on connection errors
      if (!error.message.includes('Could not establish connection')) {
        await this.clearAuth();
      }
      return null;
    }
  }
}

// Create global instance
window.googleAuthService = new GoogleAuthService();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleAuthService;
}
