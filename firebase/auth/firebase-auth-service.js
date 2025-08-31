/**
 * Firebase Authentication Service for aiFiverr Extension
 * Clean, robust Firebase authentication with Google OAuth
 * Cross-browser compatible implementation
 */

/**
 * Firebase Authentication Service
 * Handles all Firebase authentication operations
 */
class FirebaseAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.authListeners = new Set();
    this.isInitialized = false;
    
    // Initialize the service
    this.initialize();
  }

  /**
   * Initialize the authentication service
   */
  async initialize() {
    try {
      console.log('🔐 Firebase Auth: Initializing authentication service...');
      
      // Load stored authentication state
      await this.loadStoredAuth();
      
      // Validate stored tokens if they exist
      if (this.accessToken) {
        const isValid = await this.validateToken();
        if (!isValid) {
          console.log('🔄 Firebase Auth: Stored token invalid, clearing auth state');
          await this.clearAuth();
        }
      }
      
      this.isInitialized = true;
      console.log('✅ Firebase Auth: Service initialized successfully');
      
      // Notify listeners of initial auth state
      this.notifyAuthListeners();
      
    } catch (error) {
      console.error('❌ Firebase Auth: Initialization failed:', error);
      this.isInitialized = true; // Set to true to prevent infinite loops
    }
  }

  /**
   * Start Google OAuth authentication flow
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate() {
    try {
      console.log('🔐 Firebase Auth: Starting Google OAuth authentication...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Send authentication request to background script
      const response = await this.sendMessageToBackground({
        type: 'FIREBASE_AUTH_START'
      });

      if (response && response.success) {
        // Update local state with authentication data
        this.currentUser = response.user;
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        this.tokenExpiry = response.tokenExpiry || (Date.now() + (3600 * 1000));
        this.isAuthenticated = true;

        // Save authentication state
        await this.saveAuth();

        // Store user data in Firestore
        await this.storeUserData();

        // Notify listeners
        this.notifyAuthListeners();

        console.log('✅ Firebase Auth: Authentication successful');
        return {
          success: true,
          user: this.currentUser
        };
      } else {
        throw new Error(response?.error || 'Authentication failed');
      }

    } catch (error) {
      console.error('❌ Firebase Auth: Authentication failed:', error);
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
      console.log('🚪 Firebase Auth: Signing out...');

      // Send sign out request to background script
      const response = await this.sendMessageToBackground({
        type: 'FIREBASE_AUTH_SIGNOUT'
      });

      // Clear local auth state regardless of response
      await this.clearAuth();

      console.log('✅ Firebase Auth: Sign out successful');
      return { success: true };

    } catch (error) {
      console.error('❌ Firebase Auth: Sign out failed:', error);
      // Still clear local state even if remote sign out fails
      await this.clearAuth();
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current authentication state
   * @returns {Object} Current auth state
   */
  getAuthState() {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.currentUser,
      hasValidToken: this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry
    };
  }

  /**
   * Send message to background script with retry logic
   * @param {Object} message - Message to send
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} Response from background script
   */
  async sendMessageToBackground(message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Firebase Auth: Sending message to background (attempt ${attempt}/${maxRetries}):`, message.type);

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

        console.log(`✅ Firebase Auth: Background response received:`, response?.success ? 'Success' : 'Failed');
        return response;

      } catch (error) {
        console.warn(`⚠️ Firebase Auth: Background message attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Store user data in Firestore
   */
  async storeUserData() {
    if (!this.currentUser) {
      console.warn('⚠️ Firebase Auth: No user data to store');
      return;
    }

    try {
      console.log('💾 Firebase Auth: Storing user data in Firestore...');

      const response = await this.sendMessageToBackground({
        type: 'FIREBASE_STORE_USER_DATA',
        userData: {
          uid: this.currentUser.uid,
          email: this.currentUser.email,
          displayName: this.currentUser.displayName,
          photoURL: this.currentUser.photoURL,
          emailVerified: this.currentUser.emailVerified,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }
      });

      if (response && response.success) {
        console.log('✅ Firebase Auth: User data stored successfully');
      } else {
        console.warn('⚠️ Firebase Auth: Failed to store user data:', response?.error);
      }

    } catch (error) {
      console.error('❌ Firebase Auth: Error storing user data:', error);
    }
  }

  /**
   * Validate current access token
   * @returns {Promise<boolean>} True if token is valid
   */
  async validateToken() {
    if (!this.accessToken) {
      return false;
    }

    try {
      // Test token with a simple Google API call
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + this.accessToken);
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Firebase Auth: Token validation failed:', error);
      return false;
    }
  }

  /**
   * Load stored authentication data
   */
  async loadStoredAuth() {
    try {
      const result = await chrome.storage.local.get(['firebase_auth_data']);
      if (result.firebase_auth_data) {
        const authData = result.firebase_auth_data;
        this.currentUser = authData.user;
        this.accessToken = authData.accessToken;
        this.refreshToken = authData.refreshToken;
        this.tokenExpiry = authData.tokenExpiry;
        this.isAuthenticated = !!authData.user && !!authData.accessToken;
        
        console.log('✅ Firebase Auth: Stored auth data loaded');
      }
    } catch (error) {
      console.error('❌ Firebase Auth: Error loading stored auth:', error);
    }
  }

  /**
   * Save authentication data to storage
   */
  async saveAuth() {
    try {
      const authData = {
        user: this.currentUser,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry,
        savedAt: Date.now()
      };

      await chrome.storage.local.set({ firebase_auth_data: authData });
      console.log('✅ Firebase Auth: Auth data saved to storage');
    } catch (error) {
      console.error('❌ Firebase Auth: Error saving auth data:', error);
    }
  }

  /**
   * Clear all authentication data
   */
  async clearAuth() {
    try {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;

      await chrome.storage.local.remove(['firebase_auth_data']);
      this.notifyAuthListeners();
      
      console.log('✅ Firebase Auth: Auth data cleared');
    } catch (error) {
      console.error('❌ Firebase Auth: Error clearing auth data:', error);
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
    const authState = this.getAuthState();
    this.authListeners.forEach(listener => {
      try {
        listener(authState);
      } catch (error) {
        console.error('❌ Firebase Auth: Listener error:', error);
      }
    });
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.FirebaseAuthService = FirebaseAuthService;
} else {
  self.FirebaseAuthService = FirebaseAuthService;
}
