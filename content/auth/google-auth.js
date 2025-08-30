/**
 * Firebase-Compatible Google Authentication Service for aiFiverr Extension
 * Maintains the same API as the original google-auth.js but uses Firebase Authentication
 * Drop-in replacement for cross-browser compatibility
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
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      console.log('aiFiverr Auth: Initializing Firebase-compatible authentication manager...');

      // Load stored authentication data (now from Firebase storage keys)
      await this.loadStoredAuth();

      // Check if stored token is still valid
      if (this.accessToken && this.tokenExpiry) {
        const timeUntilExpiry = this.tokenExpiry - Date.now();
        console.log('aiFiverr Auth: Token expires in', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');

        if (Date.now() < this.tokenExpiry - 300000) { // 5 minute buffer
          this.isAuthenticated = true;
          console.log('aiFiverr Auth: Using stored valid Firebase token');

          // Validate token with Firebase background script
          await this.validateTokenWithBackground();
        } else {
          console.log('aiFiverr Auth: Stored token expired or expiring soon, attempting refresh');
          await this.refreshTokenIfNeeded();
        }
      } else {
        console.log('aiFiverr Auth: No stored Firebase authentication data found');
      }

      this.initialized = true;
      this.notifyAuthListeners();

      console.log('aiFiverr Auth: Firebase initialization complete. Authenticated:', this.isAuthenticated);
    } catch (error) {
      console.error('aiFiverr Auth: Firebase initialization failed:', error);
      this.initialized = true;
    }
  }

  /**
   * Load stored authentication data from Chrome storage (Firebase keys)
   */
  async loadStoredAuth() {
    try {
      const result = await chrome.storage.local.get([
        'firebase_access_token',
        'firebase_token_expiry', 
        'firebase_user_info',
        'firebase_refresh_token'
      ]);

      this.accessToken = result.firebase_access_token || null;
      this.tokenExpiry = result.firebase_token_expiry || null;
      this.userInfo = result.firebase_user_info || null;
      this.refreshToken = result.firebase_refresh_token || null;

      if (this.userInfo) {
        this.isAuthenticated = true;
        console.log('aiFiverr Auth: Loaded stored Firebase auth for:', this.userInfo.email);
      }
    } catch (error) {
      console.error('aiFiverr Auth: Failed to load stored Firebase auth:', error);
    }
  }

  /**
   * Save authentication data to Chrome storage (Firebase keys)
   */
  async saveAuth() {
    try {
      const authData = {
        firebase_access_token: this.accessToken,
        firebase_token_expiry: this.tokenExpiry,
        firebase_user_info: this.userInfo,
        firebase_refresh_token: this.refreshToken
      };

      await chrome.storage.local.set(authData);
      console.log('aiFiverr Auth: Firebase authentication data saved');
    } catch (error) {
      console.error('aiFiverr Auth: Failed to save Firebase auth data:', error);
    }
  }

  /**
   * Clear all authentication data
   */
  async clearAuth() {
    try {
      this.isAuthenticated = false;
      this.userInfo = null;
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;

      await chrome.storage.local.remove([
        'firebase_access_token',
        'firebase_token_expiry',
        'firebase_user_info', 
        'firebase_refresh_token'
      ]);

      this.notifyAuthListeners();
      console.log('aiFiverr Auth: Firebase authentication data cleared');
    } catch (error) {
      console.error('aiFiverr Auth: Failed to clear Firebase auth data:', error);
    }
  }

  /**
   * Start Firebase authentication flow (replaces Chrome identity API)
   */
  async authenticate() {
    try {
      console.log('aiFiverr Auth: Starting Firebase authentication flow...');

      // Send message to Firebase background script
      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_START'
      }, 3);

      if (response && response.success) {
        // Update local state with Firebase authentication data
        this.userInfo = {
          email: response.user.email,
          name: response.user.displayName,
          picture: response.user.photoURL,
          id: response.user.uid,
          given_name: response.user.displayName?.split(' ')[0] || '',
          family_name: response.user.displayName?.split(' ').slice(1).join(' ') || '',
          locale: 'en-US' // Default locale
        };
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour from now
        this.isAuthenticated = true;

        // Save authentication data
        await this.saveAuth();

        // Collect user data (same as before, but now uses Firebase)
        await this.collectUserData();

        this.notifyAuthListeners();

        console.log('aiFiverr Auth: Firebase authentication successful');
        return {
          success: true,
          user: this.userInfo
        };
      } else {
        throw new Error(response?.error || 'Firebase authentication failed');
      }

    } catch (error) {
      console.error('aiFiverr Auth: Firebase authentication failed:', error);
      await this.clearAuth();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign out user (Firebase)
   */
  async signOut() {
    try {
      console.log('aiFiverr Auth: Signing out Firebase user...');

      // Send sign out message to Firebase background script
      await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_SIGNOUT'
      }, 2);

      // Clear local authentication data
      await this.clearAuth();

      console.log('aiFiverr Auth: Firebase sign out successful');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Auth: Firebase sign out failed:', error);
      // Clear local data even if Firebase signout fails
      await this.clearAuth();
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current access token
   */
  async getAccessToken() {
    if (!this.isAuthenticated || !this.accessToken) {
      return null;
    }

    // Check if token is expired or expiring soon
    if (this.tokenExpiry && Date.now() >= this.tokenExpiry - 300000) { // 5 minute buffer
      console.log('aiFiverr Auth: Firebase token expired, attempting refresh...');
      await this.refreshTokenIfNeeded();
    }

    return this.accessToken;
  }

  /**
   * Send message to background script with retry mechanism
   */
  async sendMessageWithRetry(message, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`aiFiverr Auth: Sending Firebase message (attempt ${attempt}/${maxRetries}):`, message.type);

        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout - no response received'));
          }, 10000); // 10 second timeout

          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        console.log(`aiFiverr Auth: Firebase message response received:`, response?.success ? 'Success' : 'Failed');
        return response;

      } catch (error) {
        console.warn(`aiFiverr Auth: Firebase message attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Collect user data and store in Firebase (replaces Google Sheets)
   */
  async collectUserData() {
    if (!this.userInfo) {
      console.warn('aiFiverr Auth: No user info available for data collection');
      return;
    }

    try {
      console.log('aiFiverr Auth: Collecting user data for Firebase storage:', this.userInfo.email);

      // Send user data to Firebase background script for Firestore storage
      const response = await chrome.runtime.sendMessage({
        type: 'FIREBASE_STORE_USER_DATA',
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
        console.warn('aiFiverr Auth: Failed to store user data in Firebase:', response?.error);
      } else {
        console.log('aiFiverr Auth: User data stored in Firebase successfully');
      }

    } catch (error) {
      console.warn('aiFiverr Auth: Failed to collect user data for Firebase:', error);
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      console.log('aiFiverr Auth: Refreshing Firebase token...');

      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_REFRESH_TOKEN'
      }, 2);

      if (response && response.success && response.accessToken) {
        this.accessToken = response.accessToken;
        this.tokenExpiry = Date.now() + (3600 * 1000);
        this.isAuthenticated = true;
        await this.saveAuth();
        this.notifyAuthListeners();
        console.log('aiFiverr Auth: Firebase token refreshed successfully');
        return this.accessToken;
      } else {
        console.warn('aiFiverr Auth: Firebase token refresh failed');
        await this.clearAuth();
        return null;
      }

    } catch (error) {
      console.error('aiFiverr Auth: Firebase token refresh error:', error);
      await this.clearAuth();
      return null;
    }
  }

  /**
   * Validate token with Firebase background script
   */
  async validateTokenWithBackground() {
    try {
      console.log('aiFiverr Auth: Validating Firebase token with background script...');

      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_VALIDATE_TOKEN'
      }, 2);

      if (response && response.success && response.token) {
        if (response.token !== this.accessToken) {
          console.log('aiFiverr Auth: Updating local Firebase token from background');
          this.accessToken = response.token;
          this.tokenExpiry = Date.now() + (3600 * 1000);
          await this.saveAuth();
        }
        this.isAuthenticated = true;
      } else {
        console.warn('aiFiverr Auth: Firebase token validation failed, clearing local auth');
        await this.clearAuth();
      }

    } catch (error) {
      console.error('aiFiverr Auth: Firebase token validation error:', error);
      await this.clearAuth();
    }
  }

  /**
   * Add authentication state change listener
   */
  addAuthListener(callback) {
    this.authListeners.add(callback);
  }

  /**
   * Remove authentication state change listener
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
        console.error('aiFiverr Auth: Listener callback error:', error);
      }
    });
  }

  /**
   * Get current user info
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated;
  }
}

// Create global instance (same pattern as original)
if (typeof window !== 'undefined') {
  window.googleAuthService = new GoogleAuthService();
}
