/**
 * Firebase Google Client for aiFiverr Extension
 * Replaces Google Sheets functionality with Firebase Firestore
 * Maintains the same API as the original google-client.js for compatibility
 */

class GoogleClient {
  constructor() {
    this.isInitialized = false;
    this.firebaseService = null;
    this.init();
  }

  async init() {
    try {
      console.log('aiFiverr Firebase Client: Initializing Firebase Google client...');
      
      // Wait for Firebase database service to be available
      if (window.firebaseDatabaseService) {
        this.firebaseService = window.firebaseDatabaseService;
        await this.firebaseService.init();
        this.isInitialized = true;
        console.log('aiFiverr Firebase Client: Firebase client initialized');
      } else {
        console.warn('aiFiverr Firebase Client: Firebase database service not available');
      }
    } catch (error) {
      console.error('aiFiverr Firebase Client: Initialization failed:', error);
    }
  }

  /**
   * Get access token from Firebase auth service
   */
  async getAccessToken() {
    if (window.googleAuthService) {
      return await window.googleAuthService.getAccessToken();
    }
    throw new Error('Firebase authentication service not available');
  }

  /**
   * Test connection to Firebase
   */
  async testConnection() {
    try {
      if (!this.firebaseService) {
        return { success: false, error: 'Firebase service not initialized' };
      }

      return await this.firebaseService.testConnection();
    } catch (error) {
      console.error('aiFiverr Firebase Client: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add user data to Firebase (replaces Google Sheets functionality)
   */
  async addUserData(userData) {
    try {
      console.log('aiFiverr Firebase Client: Adding user data to Firebase:', userData.email);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      // Use Firebase database service to store user data
      const result = await this.firebaseService.addUserData(userData);
      
      if (result.success) {
        console.log('aiFiverr Firebase Client: User data added to Firebase successfully');
        return { success: true };
      } else {
        throw new Error('Failed to add user data to Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to add user data:', error);
      throw error;
    }
  }

  /**
   * Get user data from Firebase (replaces Google Sheets functionality)
   */
  async getUserData(userEmail) {
    try {
      console.log('aiFiverr Firebase Client: Getting user data from Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const userData = await this.firebaseService.getUserData(userEmail);
      
      if (userData) {
        console.log('aiFiverr Firebase Client: User data retrieved from Firebase');
        return userData;
      } else {
        console.log('aiFiverr Firebase Client: User not found in Firebase');
        return null;
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to get user data:', error);
      throw error;
    }
  }

  /**
   * Check if user exists in Firebase (replaces Google Sheets functionality)
   */
  async checkUserExists(userEmail) {
    try {
      const userData = await this.getUserData(userEmail);
      return userData !== null;
    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to check user existence:', error);
      return false;
    }
  }

  /**
   * Update user data in Firebase
   */
  async updateUserData(userEmail, updateData) {
    try {
      console.log('aiFiverr Firebase Client: Updating user data in Firebase:', userEmail);

      // Get existing user data
      const existingData = await this.getUserData(userEmail);
      
      if (!existingData) {
        throw new Error('User not found');
      }

      // Merge with update data
      const updatedData = {
        ...existingData,
        ...updateData,
        lastUpdated: new Date().toISOString()
      };

      // Save updated data
      const result = await this.firebaseService.addUserData(updatedData);
      
      if (result.success) {
        console.log('aiFiverr Firebase Client: User data updated in Firebase successfully');
        return { success: true };
      } else {
        throw new Error('Failed to update user data in Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to update user data:', error);
      throw error;
    }
  }

  /**
   * Save custom prompts to Firebase (replaces Google Sheets functionality)
   */
  async saveCustomPrompts(userEmail, prompts) {
    try {
      console.log('aiFiverr Firebase Client: Saving custom prompts to Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const result = await this.firebaseService.saveCustomPrompts(userEmail, prompts);
      
      if (result.success) {
        console.log('aiFiverr Firebase Client: Custom prompts saved to Firebase successfully');
        return { success: true };
      } else {
        throw new Error('Failed to save custom prompts to Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to save custom prompts:', error);
      throw error;
    }
  }

  /**
   * Load custom prompts from Firebase (replaces Google Sheets functionality)
   */
  async loadCustomPrompts(userEmail) {
    try {
      console.log('aiFiverr Firebase Client: Loading custom prompts from Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const prompts = await this.firebaseService.loadCustomPrompts(userEmail);
      
      if (prompts) {
        console.log('aiFiverr Firebase Client: Custom prompts loaded from Firebase successfully');
        return prompts;
      } else {
        console.log('aiFiverr Firebase Client: No custom prompts found in Firebase');
        return {};
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to load custom prompts:', error);
      return {};
    }
  }

  /**
   * Save knowledge base variables to Firebase
   */
  async saveKnowledgeBaseVariables(userEmail, variables) {
    try {
      console.log('aiFiverr Firebase Client: Saving knowledge base variables to Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const result = await this.firebaseService.saveKnowledgeBaseVariables(userEmail, variables);
      
      if (result.success) {
        console.log('aiFiverr Firebase Client: Knowledge base variables saved to Firebase successfully');
        return { success: true };
      } else {
        throw new Error('Failed to save knowledge base variables to Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to save knowledge base variables:', error);
      throw error;
    }
  }

  /**
   * Load knowledge base variables from Firebase
   */
  async loadKnowledgeBaseVariables(userEmail) {
    try {
      console.log('aiFiverr Firebase Client: Loading knowledge base variables from Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const variables = await this.firebaseService.loadKnowledgeBaseVariables(userEmail);
      
      if (variables) {
        console.log('aiFiverr Firebase Client: Knowledge base variables loaded from Firebase successfully');
        return variables;
      } else {
        console.log('aiFiverr Firebase Client: No knowledge base variables found in Firebase');
        return {};
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to load knowledge base variables:', error);
      return {};
    }
  }

  /**
   * Save conversation data to Firebase
   */
  async saveConversation(userEmail, conversationId, conversationData) {
    try {
      console.log('aiFiverr Firebase Client: Saving conversation to Firebase:', userEmail, conversationId);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const result = await this.firebaseService.saveConversation(userEmail, conversationId, conversationData);
      
      if (result.success) {
        console.log('aiFiverr Firebase Client: Conversation saved to Firebase successfully');
        return { success: true };
      } else {
        throw new Error('Failed to save conversation to Firebase');
      }

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Get user conversations from Firebase
   */
  async getUserConversations(userEmail) {
    try {
      console.log('aiFiverr Firebase Client: Getting user conversations from Firebase:', userEmail);

      if (!this.firebaseService) {
        throw new Error('Firebase service not initialized');
      }

      const conversations = await this.firebaseService.getUserConversations(userEmail);
      
      console.log('aiFiverr Firebase Client: Retrieved', conversations.length, 'conversations from Firebase');
      return conversations;

    } catch (error) {
      console.error('aiFiverr Firebase Client: Failed to get user conversations:', error);
      return [];
    }
  }

  /**
   * Batch operations for data migration
   */
  async batchAddUsers(usersData) {
    try {
      console.log('aiFiverr Firebase Client: Batch adding users to Firebase:', usersData.length);

      const results = [];
      for (const userData of usersData) {
        try {
          const result = await this.addUserData(userData);
          results.push({ success: true, email: userData.email });
        } catch (error) {
          console.error('aiFiverr Firebase Client: Failed to add user:', userData.email, error);
          results.push({ success: false, email: userData.email, error: error.message });
        }
      }

      console.log('aiFiverr Firebase Client: Batch user addition completed');
      return results;

    } catch (error) {
      console.error('aiFiverr Firebase Client: Batch user addition failed:', error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  isReady() {
    return this.isInitialized && this.firebaseService;
  }

  /**
   * Wait for initialization
   */
  async waitForReady(timeout = 10000) {
    const startTime = Date.now();
    
    while (!this.isReady() && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isReady()) {
      throw new Error('Firebase client initialization timeout');
    }
    
    return true;
  }
}

// Create global instance (same pattern as original)
if (typeof window !== 'undefined') {
  window.googleClient = new GoogleClient();
}
