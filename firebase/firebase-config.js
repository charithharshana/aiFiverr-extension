/**
 * Firebase Configuration for aiFiverr Extension
 * Clean, environment-aware Firebase setup with proper configuration management
 */

/**
 * Firebase Configuration Manager
 * Handles environment-specific configuration and validation
 */
class FirebaseConfigManager {
  constructor() {
    this.config = null;
    this.isInitialized = false;
  }

  /**
   * Get Firebase configuration
   * @returns {Object} Firebase configuration object
   */
  getConfig() {
    if (!this.config) {
      this.config = this.loadConfiguration();
    }
    return this.config;
  }

  /**
   * Load Firebase configuration based on environment
   * @returns {Object} Firebase configuration
   */
  loadConfiguration() {
    // Production Firebase configuration for ai-fiverr project
    // Note: Firebase client-side API keys are meant to be public
    // Security is handled by Firebase Authentication and Firestore rules
    const config = {
      apiKey: "AIzaSyCelf-I9gafjAtydLL3_5n6z-hhdoeQn5A",
      authDomain: "ai-fiverr.firebaseapp.com",
      projectId: "ai-fiverr",
      storageBucket: "ai-fiverr.firebasestorage.app",
      messagingSenderId: "423530712122",
      appId: "1:423530712122:web:b3e7f12ee346031371b903",
      measurementId: "G-NN00R02JB9"
    };

    // Validate configuration
    this.validateConfig(config);

    return config;
  }

  /**
   * Validate Firebase configuration
   * @param {Object} config - Firebase configuration to validate
   */
  validateConfig(config) {
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Firebase configuration missing required field: ${field}`);
      }
    }

    // Validate format
    if (!config.apiKey.startsWith('AIza')) {
      throw new Error('Invalid Firebase API key format');
    }

    if (!config.authDomain.includes('.firebaseapp.com')) {
      throw new Error('Invalid Firebase auth domain format');
    }

    console.log('✅ Firebase Config: Configuration validated successfully');
  }

  /**
   * Initialize Firebase configuration
   */
  initialize() {
    if (this.isInitialized) {
      return this.config;
    }

    try {
      this.config = this.getConfig();
      this.isInitialized = true;
      console.log('✅ Firebase Config: Initialized successfully');
      return this.config;
    } catch (error) {
      console.error('❌ Firebase Config: Initialization failed:', error);
      throw error;
    }
  }
}

// Create global instance
const firebaseConfigManager = new FirebaseConfigManager();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    firebaseConfig: firebaseConfigManager.getConfig(),
    firebaseConfigManager
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.firebaseConfig = firebaseConfigManager.getConfig();
  window.firebaseConfigManager = firebaseConfigManager;
} else {
  // Extension environment
  self.firebaseConfig = firebaseConfigManager.getConfig();
  self.firebaseConfigManager = firebaseConfigManager;
}
