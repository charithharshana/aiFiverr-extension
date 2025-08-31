/**
 * User Data Service for aiFiverr Extension
 * Handles all user data operations with Firebase Firestore
 */

class UserDataService {
  constructor() {
    this.firebaseDB = null;
    this.currentUser = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the service
   */
  async init() {
    try {
      console.log('aiFiverr User Data Service: Initializing...');
      
      // Wait for Firebase database service
      if (window.firebaseDatabaseService) {
        this.firebaseDB = window.firebaseDatabaseService;
        await this.firebaseDB.init();
        this.isInitialized = true;
        console.log('aiFiverr User Data Service: Initialized successfully');
      } else {
        throw new Error('Firebase database service not available');
      }
    } catch (error) {
      console.error('aiFiverr User Data Service: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create or update user profile
   */
  async createOrUpdateUser(userData) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }

      console.log('aiFiverr User Data Service: Creating/updating user:', userData.email);

      const result = await this.firebaseDB.addUserData(userData);
      
      if (result.success) {
        this.currentUser = await this.firebaseDB.getUserData(userData.email);
        console.log('aiFiverr User Data Service: User profile updated successfully');
      }

      return result;
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to create/update user:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userEmail) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }

      const userData = await this.firebaseDB.getUserData(userEmail);
      
      if (userData) {
        this.currentUser = userData;
      }

      return userData;
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userEmail, preferences) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }

      console.log('aiFiverr User Data Service: Updating preferences for:', userEmail);

      const result = await this.firebaseDB.updateUserPreferences(userEmail, preferences);
      
      if (result.success && this.currentUser) {
        this.currentUser.preferences = result.preferences;
      }

      return result;
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to update preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userEmail) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }

      return await this.firebaseDB.getUserPreferences(userEmail);
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to get preferences:', error);
      return this.firebaseDB.getDefaultUserPreferences();
    }
  }

  /**
   * Update specific preference
   */
  async updatePreference(userEmail, key, value) {
    try {
      const preferences = { [key]: value };
      return await this.updatePreferences(userEmail, preferences);
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to update preference:', error);
      throw error;
    }
  }

  /**
   * Update user bio
   */
  async updateBio(userEmail, bio) {
    try {
      return await this.updatePreference(userEmail, 'bio', bio);
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to update bio:', error);
      throw error;
    }
  }

  /**
   * Update user language preference
   */
  async updateLanguage(userEmail, language) {
    try {
      return await this.updatePreference(userEmail, 'language', language);
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to update language:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Clear current user data
   */
  clearCurrentUser() {
    this.currentUser = null;
  }

  /**
   * Sync local settings with Firebase preferences
   */
  async syncLocalSettings(userEmail) {
    try {
      console.log('aiFiverr User Data Service: Syncing local settings with Firebase...');

      // Get local settings
      const localSettings = await this.getLocalSettings();
      
      // Get Firebase preferences
      const firebasePreferences = await this.getPreferences(userEmail);
      
      // Merge and update Firebase with local settings if they're newer
      const mergedPreferences = { ...firebasePreferences, ...localSettings };
      
      // Update Firebase
      await this.updatePreferences(userEmail, mergedPreferences);
      
      // Update local storage with merged preferences
      await this.saveLocalSettings(mergedPreferences);
      
      console.log('aiFiverr User Data Service: Settings synced successfully');
      return mergedPreferences;

    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to sync settings:', error);
      throw error;
    }
  }

  /**
   * Get local settings from Chrome storage
   */
  async getLocalSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      return result.settings || {};
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to get local settings:', error);
      return {};
    }
  }

  /**
   * Save settings to local Chrome storage
   */
  async saveLocalSettings(settings) {
    try {
      await chrome.storage.local.set({ settings });
      console.log('aiFiverr User Data Service: Local settings saved');
    } catch (error) {
      console.error('aiFiverr User Data Service: Failed to save local settings:', error);
      throw error;
    }
  }

  /**
   * Test Firebase connection
   */
  async testConnection() {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
      
      return await this.firebaseDB.testConnection();
    } catch (error) {
      console.error('aiFiverr User Data Service: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.userDataService = new UserDataService();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserDataService;
}
