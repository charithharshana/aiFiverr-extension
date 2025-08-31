/**
 * Firebase Authentication Service for aiFiverr Extension
 * Cross-browser compatible Firebase authentication using offscreen documents
 * Replaces Chrome-specific identity API
 */

class FirebaseAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.userInfo = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.authListeners = new Set();
    this.firebaseUser = null;
    this.init();
  }

  async init() {
    try {
      console.log('aiFiverr Firebase Auth: Initializing authentication manager...');

      // Load stored authentication data
      await this.loadStoredAuth();

      // Check if stored token is still valid
      if (this.accessToken && this.tokenExpiry) {
        const timeUntilExpiry = this.tokenExpiry - Date.now();
        console.log('aiFiverr Firebase Auth: Token expires in', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');

        if (Date.now() < this.tokenExpiry - 300000) { // 5 minute buffer
          this.isAuthenticated = true;
          console.log('aiFiverr Firebase Auth: Using stored valid token');

          // Validate token with background script
          await this.validateTokenWithBackground();
        } else {
          console.log('aiFiverr Firebase Auth: Stored token expired or expiring soon, attempting refresh');
          await this.refreshTokenIfNeeded();
        }
      } else {
        console.log('aiFiverr Firebase Auth: No stored authentication data found');
      }

      console.log('aiFiverr Firebase Auth: Initialization complete. Authenticated:', this.isAuthenticated);
    } catch (error) {
      console.error('aiFiverr Firebase Auth: Initialization failed:', error);
      await this.clearAuth();
    }
  }

  /**
   * Load stored authentication data from Chrome storage
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
        console.log('aiFiverr Firebase Auth: Loaded stored auth for:', this.userInfo.email);
      }
    } catch (error) {
      console.error('aiFiverr Firebase Auth: Failed to load stored auth:', error);
    }
  }

  /**
   * Save authentication data to Chrome storage
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
      console.log('aiFiverr Firebase Auth: Authentication data saved');
    } catch (error) {
      console.error('aiFiverr Firebase Auth: Failed to save auth data:', error);
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
      this.firebaseUser = null;

      await chrome.storage.local.remove([
        'firebase_access_token',
        'firebase_token_expiry',
        'firebase_user_info',
        'firebase_refresh_token'
      ]);

      this.notifyAuthListeners();
      console.log('aiFiverr Firebase Auth: Authentication data cleared');
    } catch (error) {
      console.error('aiFiverr Firebase Auth: Failed to clear auth data:', error);
    }
  }

  /**
   * Start Firebase authentication flow using offscreen document
   */
  async authenticate() {
    try {
      console.log('aiFiverr Firebase Auth: Starting Firebase authentication flow...');

      // Send message to background script to handle Firebase auth
      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_START'
      }, 3);

      if (response && response.success) {
        // Update local state with comprehensive Firebase authentication data
        this.firebaseUser = response.user;
        this.userInfo = this.extractComprehensiveUserData(response.user, response.additionalUserInfo);
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour from now
        this.isAuthenticated = true;

        console.log('aiFiverr Firebase Auth: Extracted comprehensive user data:', {
          email: this.userInfo.email,
          displayName: this.userInfo.displayName,
          emailVerified: this.userInfo.emailVerified,
          hasProfile: !!this.userInfo.profile,
          hasProviders: !!this.userInfo.providers,
          locale: this.userInfo.locale,
          givenName: this.userInfo.given_name,
          familyName: this.userInfo.family_name
        });

        // Save authentication data
        await this.saveAuth();

        // Collect comprehensive user data for Firebase storage
        await this.collectComprehensiveUserData();

        this.notifyAuthListeners();

        console.log('aiFiverr Firebase Auth: Authentication successful with comprehensive data');
        return {
          success: true,
          user: this.userInfo
        };
      } else {
        throw new Error(response?.error || 'Firebase authentication failed');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Auth: Authentication failed:', error);
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
        console.log(`aiFiverr Firebase Auth: Sending message (attempt ${attempt}/${maxRetries}):`, message.type);

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

        console.log(`aiFiverr Firebase Auth: Message response received:`, response?.success ? 'Success' : 'Failed');
        return response;

      } catch (error) {
        console.warn(`aiFiverr Firebase Auth: Message attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      console.log('aiFiverr Firebase Auth: Signing out user...');

      // Send sign out message to background script
      await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_SIGNOUT'
      }, 2);

      // Clear local authentication data
      await this.clearAuth();

      console.log('aiFiverr Firebase Auth: Sign out successful');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Firebase Auth: Sign out failed:', error);
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
      console.log('aiFiverr Firebase Auth: Token expired, attempting refresh...');
      await this.refreshTokenIfNeeded();
    }

    return this.accessToken;
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      console.log('aiFiverr Firebase Auth: Refreshing token...');

      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_REFRESH_TOKEN'
      }, 2);

      if (response && response.success && response.accessToken) {
        this.accessToken = response.accessToken;
        this.tokenExpiry = Date.now() + (3600 * 1000);
        this.isAuthenticated = true;
        await this.saveAuth();
        this.notifyAuthListeners();
        console.log('aiFiverr Firebase Auth: Token refreshed successfully');
        return this.accessToken;
      } else {
        console.warn('aiFiverr Firebase Auth: Token refresh failed');
        await this.clearAuth();
        return null;
      }

    } catch (error) {
      console.error('aiFiverr Firebase Auth: Token refresh error:', error);
      await this.clearAuth();
      return null;
    }
  }

  /**
   * Validate token with background script
   */
  async validateTokenWithBackground() {
    try {
      console.log('aiFiverr Firebase Auth: Validating token with background script...');

      const response = await this.sendMessageWithRetry({
        type: 'FIREBASE_AUTH_VALIDATE_TOKEN'
      }, 2);

      if (response && response.success && response.token) {
        if (response.token !== this.accessToken) {
          console.log('aiFiverr Firebase Auth: Updating local token from background');
          this.accessToken = response.token;
          this.tokenExpiry = Date.now() + (3600 * 1000);
          await this.saveAuth();
        }
        this.isAuthenticated = true;
      } else {
        console.warn('aiFiverr Firebase Auth: Token validation failed, clearing local auth');
        await this.clearAuth();
      }

    } catch (error) {
      console.error('aiFiverr Firebase Auth: Token validation error:', error);
      await this.clearAuth();
    }
  }

  /**
   * Extract comprehensive user data from Firebase authentication response
   */
  extractComprehensiveUserData(firebaseUser, additionalUserInfo = null) {
    console.log('aiFiverr Firebase Auth: Extracting comprehensive user data');

    // Base user data from Firebase User object
    const userData = {
      // Core identification
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,

      // Display information
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,

      // Phone information
      phoneNumber: firebaseUser.phoneNumber,

      // Account metadata
      creationTime: firebaseUser.metadata?.creationTime,
      lastSignInTime: firebaseUser.metadata?.lastSignInTime,

      // Provider information
      providerId: firebaseUser.providerId,
      providerData: firebaseUser.providerData || [],

      // Derived fields for compatibility
      id: firebaseUser.uid,
      name: firebaseUser.displayName || '',
      picture: firebaseUser.photoURL || '',
      given_name: '',
      family_name: '',
      locale: 'en-US'
    };

    // Parse display name into given_name and family_name
    if (firebaseUser.displayName) {
      const nameParts = firebaseUser.displayName.trim().split(' ');
      userData.given_name = nameParts[0] || '';
      userData.family_name = nameParts.slice(1).join(' ') || '';
    }

    // Extract additional OAuth provider data if available
    if (additionalUserInfo && additionalUserInfo.profile) {
      const profile = additionalUserInfo.profile;

      // Google OAuth specific fields
      if (additionalUserInfo.providerId === 'google.com') {
        userData.locale = profile.locale || userData.locale;
        userData.given_name = profile.given_name || userData.given_name;
        userData.family_name = profile.family_name || userData.family_name;
        userData.verified_email = profile.verified_email;
        userData.hd = profile.hd; // Hosted domain for G Suite accounts
      }

      // Additional profile fields that might be available
      userData.profile = {
        ...profile,
        provider: additionalUserInfo.providerId
      };
    }

    // Extract provider-specific data
    if (firebaseUser.providerData && firebaseUser.providerData.length > 0) {
      userData.providers = firebaseUser.providerData.map(provider => ({
        providerId: provider.providerId,
        uid: provider.uid,
        displayName: provider.displayName,
        email: provider.email,
        phoneNumber: provider.phoneNumber,
        photoURL: provider.photoURL
      }));
    }

    console.log('aiFiverr Firebase Auth: Comprehensive user data extracted:', {
      email: userData.email,
      displayName: userData.displayName,
      emailVerified: userData.emailVerified,
      providersCount: userData.providers?.length || 0
    });

    return userData;
  }

  /**
   * Collect comprehensive user data for Firebase storage
   */
  async collectComprehensiveUserData() {
    if (!this.userInfo || !this.userInfo.email) {
      console.warn('aiFiverr Firebase Auth: No user info available for data collection');
      return;
    }

    try {
      console.log('aiFiverr Firebase Auth: Collecting comprehensive user data for:', this.userInfo.email);

      // Send comprehensive user data to background script for Firebase storage
      const response = await chrome.runtime.sendMessage({
        type: 'FIREBASE_STORE_USER_DATA',
        userData: {
          ...this.userInfo,
          timestamp: new Date().toISOString(),
          authenticationMethod: 'firebase',
          lastAuthenticationTime: new Date().toISOString()
        }
      });

      if (!response?.success) {
        console.warn('aiFiverr Firebase Auth: Failed to store comprehensive user data:', response?.error);
      } else {
        console.log('aiFiverr Firebase Auth: Comprehensive user data stored in Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Auth: Error collecting comprehensive user data:', error);
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
        console.error('aiFiverr Firebase Auth: Listener callback error:', error);
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
  window.firebaseAuthService = new FirebaseAuthService();
}
