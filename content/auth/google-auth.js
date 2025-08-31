/**
 * Google Authentication Service for aiFiverr Extension
 * Clean Firebase-based authentication service
 * Drop-in replacement for Chrome identity API with cross-browser compatibility
 */

class GoogleAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.userInfo = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.authListeners = new Set();
    this.isInitialized = false;
    
    // Initialize the service
    this.init();
  }

  /**
   * Initialize the authentication service
   */
  async init() {
    try {
      console.log('🔐 Google Auth: Initializing Firebase-based authentication service...');
      
      // Load stored authentication data
      await this.loadStoredAuth();
      
      // Validate stored tokens if they exist
      if (this.accessToken && this.tokenExpiry) {
        const now = Date.now();
        if (now < this.tokenExpiry - (5 * 60 * 1000)) { // 5 minute buffer
          this.isAuthenticated = true;
          console.log('✅ Google Auth: Using valid stored token');
        } else {
          console.log('🔄 Google Auth: Stored token expired, clearing auth state');
          await this.clearAuth();
        }
      }
      
      this.isInitialized = true;
      console.log('✅ Google Auth: Service initialized successfully');
      
      // Notify listeners of initial auth state
      this.notifyAuthListeners();
      
    } catch (error) {
      console.error('❌ Google Auth: Initialization failed:', error);
      this.isInitialized = true; // Set to true to prevent infinite loops
    }
  }

  /**
   * Start Firebase authentication flow
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate() {
    try {
      console.log('🔐 Google Auth: Starting Firebase authentication flow...');
      
      if (!this.isInitialized) {
        await this.init();
      }

      // Send authentication request to Firebase background script
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
          locale: 'en-US', // Default locale
          verified_email: response.user.emailVerified
        };
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        this.tokenExpiry = response.tokenExpiry || (Date.now() + (3600 * 1000));
        this.isAuthenticated = true;

        // Save authentication data
        await this.saveAuth();

        // Collect user data for analytics/tracking
        await this.collectUserData();

        this.notifyAuthListeners();

        console.log('✅ Google Auth: Firebase authentication successful');
        return {
          success: true,
          user: this.userInfo
        };
      } else {
        throw new Error(response?.error || 'Firebase authentication failed');
      }

    } catch (error) {
      console.error('❌ Google Auth: Firebase authentication failed:', error);
      await this.clearAuth();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<Object>} Sign out result
   */
  async signOut() {
    try {
      console.log('🚪 Google Auth: Signing out...');

      // Send sign out request to Firebase background script
      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_SIGNOUT'
      }, 2);

      // Clear local auth state regardless of response
      await this.clearAuth();

      console.log('✅ Google Auth: Sign out successful');
      return { success: true };

    } catch (error) {
      console.error('❌ Google Auth: Sign out failed:', error);
      // Still clear local state even if remote sign out fails
      await this.clearAuth();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current user information
   * @returns {Object|null} Current user info or null if not authenticated
   */
  getCurrentUser() {
    return this.isAuthenticated ? this.userInfo : null;
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} True if authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.accessToken && 
           this.tokenExpiry && Date.now() < this.tokenExpiry;
  }

  /**
   * Get current access token
   * @returns {string|null} Access token or null if not available
   */
  getAccessToken() {
    if (this.isUserAuthenticated()) {
      return this.accessToken;
    }
    return null;
  }

  /**
   * Refresh access token if needed
   * @returns {Promise<string|null>} New access token or null if failed
   */
  async refreshTokenIfNeeded() {
    try {
      if (!this.refreshToken) {
        console.warn('⚠️ Google Auth: No refresh token available');
        return null;
      }

      // Check if token needs refresh (refresh 5 minutes before expiry)
      const now = Date.now();
      const refreshBuffer = 5 * 60 * 1000; // 5 minutes
      
      if (this.tokenExpiry && (now + refreshBuffer) < this.tokenExpiry) {
        // Token is still valid
        return this.accessToken;
      }

      console.log('🔄 Google Auth: Refreshing access token...');

      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_REFRESH_TOKEN',
        refreshToken: this.refreshToken
      }, 2);

      if (response && response.success && response.accessToken) {
        this.accessToken = response.accessToken;
        this.tokenExpiry = response.tokenExpiry || (Date.now() + (3600 * 1000));
        this.isAuthenticated = true;
        await this.saveAuth();
        this.notifyAuthListeners();
        console.log('✅ Google Auth: Token refreshed successfully');
        return this.accessToken;
      } else {
        console.warn('⚠️ Google Auth: Token refresh failed');
        await this.clearAuth();
        return null;
      }

    } catch (error) {
      console.error('❌ Google Auth: Token refresh error:', error);
      await this.clearAuth();
      return null;
    }
  }

  /**
   * Add authentication state listener
   * @param {Function} listener - Callback function
   */
  addAuthListener(listener) {
    this.authListeners.add(listener);
  }

  /**
   * Remove authentication state listener
   * @param {Function} listener - Callback function
   */
  removeAuthListener(listener) {
    this.authListeners.delete(listener);
  }

  /**
   * Notify all authentication listeners
   */
  notifyAuthListeners() {
    const authState = {
      isAuthenticated: this.isAuthenticated,
      user: this.userInfo,
      hasValidToken: this.isUserAuthenticated()
    };
    
    this.authListeners.forEach(listener => {
      try {
        listener(authState);
      } catch (error) {
        console.error('❌ Google Auth: Listener error:', error);
      }
    });
  }

  /**
   * Send message to background script with retry logic
   * @param {Object} message - Message to send
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} Response from background script
   */
  async sendMessageWithRetry(message, maxRetries = 3) {
    const delay = 1000; // 1 second base delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Google Auth: Sending message to background (attempt ${attempt}/${maxRetries}):`, message.type);

        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Background script timeout'));
          }, 30000); // 30 second timeout

          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        console.log(`✅ Google Auth: Background response received:`, response?.success ? 'Success' : 'Failed');
        return response;

      } catch (error) {
        console.warn(`⚠️ Google Auth: Background message attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Collect user data for analytics/tracking (Firebase-based)
   */
  async collectUserData() {
    if (!this.userInfo) {
      console.warn('⚠️ Google Auth: No user info available for data collection');
      return;
    }

    try {
      console.log('📊 Google Auth: Collecting user data...');

      // Send user data to Firebase background script for Firestore storage
      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_STORE_USER_DATA',
        userData: {
          email: this.userInfo.email,
          name: this.userInfo.name,
          picture: this.userInfo.picture,
          id: this.userInfo.id,
          verified_email: this.userInfo.verified_email,
          locale: this.userInfo.locale,
          timestamp: new Date().toISOString()
        }
      }, 2);

      if (response && response.success) {
        console.log('✅ Google Auth: User data collected successfully');
      } else {
        console.warn('⚠️ Google Auth: Failed to collect user data:', response?.error);
      }

    } catch (error) {
      console.error('❌ Google Auth: Error collecting user data:', error);
    }
  }

  /**
   * Load stored authentication data from Chrome storage
   */
  async loadStoredAuth() {
    try {
      const result = await chrome.storage.local.get(['google_auth_data']);
      if (result.google_auth_data) {
        const authData = result.google_auth_data;
        this.userInfo = authData.userInfo;
        this.accessToken = authData.accessToken;
        this.refreshToken = authData.refreshToken;
        this.tokenExpiry = authData.tokenExpiry;
        this.isAuthenticated = !!authData.userInfo && !!authData.accessToken;

        console.log('✅ Google Auth: Stored auth data loaded');
      }
    } catch (error) {
      console.error('❌ Google Auth: Error loading stored auth:', error);
    }
  }

  /**
   * Save authentication data to Chrome storage
   */
  async saveAuth() {
    try {
      const authData = {
        userInfo: this.userInfo,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry,
        savedAt: Date.now()
      };

      await chrome.storage.local.set({ google_auth_data: authData });
      console.log('✅ Google Auth: Auth data saved to storage');
    } catch (error) {
      console.error('❌ Google Auth: Error saving auth data:', error);
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

      await chrome.storage.local.remove(['google_auth_data']);
      this.notifyAuthListeners();

      console.log('✅ Google Auth: Auth data cleared');
    } catch (error) {
      console.error('❌ Google Auth: Error clearing auth data:', error);
    }
  }
}

// Create global instance for backward compatibility
if (typeof window !== 'undefined') {
  window.GoogleAuthService = GoogleAuthService;
  // Create global instance
  window.googleAuthService = new GoogleAuthService();
} else {
  self.GoogleAuthService = GoogleAuthService;
  self.googleAuthService = new GoogleAuthService();
}
