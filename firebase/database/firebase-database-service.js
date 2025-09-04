/**
 * Firebase Database Service for aiFiverr Extension
 * Replaces Google Sheets with Firebase Firestore for cross-browser compatibility
 */

class FirebaseDatabaseService {
  constructor() {
    this.isInitialized = false;
    this.collections = {
      users: 'users',
      prompts: 'prompts',
      variables: 'variables',
      conversations: 'conversations',
      knowledgeBase: 'knowledge_base'
    };
  }

  /**
   * Initialize Firebase database service
   */
  async init() {
    try {
      console.log('aiFiverr Firebase DB: Initializing database service...');
      this.isInitialized = true;
      console.log('aiFiverr Firebase DB: Database service initialized');
    } catch (error) {
      console.error('aiFiverr Firebase DB: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get access token for Firebase operations
   */
  async getAccessToken() {
    if (window.firebaseAuthService) {
      return await window.firebaseAuthService.getAccessToken();
    }
    throw new Error('Firebase authentication service not available');
  }

  /**
   * Make authenticated request to Firebase Firestore REST API
   */
  async makeFirestoreRequest(path, options = {}) {
    const token = await this.getAccessToken();
    
    if (!token) {
      throw new Error('No access token available for Firebase request');
    }

    const baseUrl = `https://firestore.googleapis.com/v1/projects/ai-fiverr/databases/(default)/documents`;
    const url = `${baseUrl}${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Firestore API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Convert JavaScript object to Firestore document format
   */
  toFirestoreDocument(data) {
    const document = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        document[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        document[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          document[key] = { integerValue: value.toString() };
        } else {
          document[key] = { doubleValue: value };
        }
      } else if (typeof value === 'boolean') {
        document[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        document[key] = { timestampValue: value.toISOString() };
      } else if (Array.isArray(value)) {
        document[key] = {
          arrayValue: {
            values: value.map(item => this.toFirestoreValue(item))
          }
        };
      } else if (typeof value === 'object') {
        document[key] = {
          mapValue: {
            fields: this.toFirestoreDocument(value)
          }
        };
      } else {
        document[key] = { stringValue: String(value) };
      }
    }
    
    return document;
  }

  /**
   * Convert single value to Firestore format
   */
  toFirestoreValue(value) {
    if (value === null || value === undefined) {
      return { nullValue: null };
    } else if (typeof value === 'string') {
      return { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { integerValue: value.toString() };
      } else {
        return { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      return { booleanValue: value };
    } else if (value instanceof Date) {
      return { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map(item => this.toFirestoreValue(item))
        }
      };
    } else if (typeof value === 'object') {
      return {
        mapValue: {
          fields: this.toFirestoreDocument(value)
        }
      };
    } else {
      return { stringValue: String(value) };
    }
  }

  /**
   * Convert Firestore document to JavaScript object
   */
  fromFirestoreDocument(document) {
    if (!document.fields) {
      return {};
    }

    const result = {};
    
    for (const [key, value] of Object.entries(document.fields)) {
      result[key] = this.fromFirestoreValue(value);
    }
    
    return result;
  }

  /**
   * Convert Firestore value to JavaScript value
   */
  fromFirestoreValue(value) {
    if (value.nullValue !== undefined) {
      return null;
    } else if (value.stringValue !== undefined) {
      return value.stringValue;
    } else if (value.integerValue !== undefined) {
      return parseInt(value.integerValue);
    } else if (value.doubleValue !== undefined) {
      return value.doubleValue;
    } else if (value.booleanValue !== undefined) {
      return value.booleanValue;
    } else if (value.timestampValue !== undefined) {
      return new Date(value.timestampValue);
    } else if (value.arrayValue !== undefined) {
      return value.arrayValue.values?.map(item => this.fromFirestoreValue(item)) || [];
    } else if (value.mapValue !== undefined) {
      return this.fromFirestoreDocument(value.mapValue);
    } else {
      return null;
    }
  }

  /**
   * Add or update user data with enhanced preferences structure
   */
  async addUserData(userData) {
    try {
      console.log('aiFiverr Firebase DB: Adding user data for:', userData.email);

      // Check if user already exists
      const existingUser = await this.getUserData(userData.email);

      const userDoc = {
        // Core user information
        email: userData.email,
        name: userData.name || userData.displayName || '',
        picture: userData.picture || userData.photoURL || '',
        id: userData.id || userData.uid || '',
        given_name: userData.given_name || '',
        family_name: userData.family_name || '',
        locale: userData.locale || 'en-US',

        // Comprehensive authentication data
        uid: userData.uid || userData.id,
        emailVerified: userData.emailVerified || false,
        phoneNumber: userData.phoneNumber || null,
        displayName: userData.displayName || userData.name || '',
        photoURL: userData.photoURL || userData.picture || '',

        // Account metadata
        creationTime: userData.creationTime || null,
        lastSignInTime: userData.lastSignInTime || null,
        authenticationMethod: userData.authenticationMethod || 'firebase',
        lastAuthenticationTime: userData.lastAuthenticationTime || new Date().toISOString(),

        // Provider information
        providerId: userData.providerId || null,
        providerData: userData.providerData || [],
        providers: userData.providers || [],

        // Additional OAuth profile data
        profile: userData.profile || null,
        verified_email: userData.verified_email || null,
        hd: userData.hd || null, // Google Workspace domain

        // System fields
        created: userData.timestamp || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: 'active',
        preferences: this.getDefaultUserPreferences()
      };

      // If user exists, preserve existing preferences and update lastLogin
      if (existingUser) {
        userDoc.created = existingUser.created || existingUser.timestamp;
        userDoc.preferences = { ...this.getDefaultUserPreferences(), ...existingUser.preferences };
        console.log('aiFiverr Firebase DB: Updating existing user');
      } else {
        console.log('aiFiverr Firebase DB: Creating new user');
      }

      // Use email as document ID (replace special characters)
      const docId = userData.email.replace(/[^a-zA-Z0-9]/g, '_');

      const firestoreDoc = {
        fields: this.toFirestoreDocument(userDoc)
      };

      await this.makeFirestoreRequest(`/${this.collections.users}/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify(firestoreDoc)
      });

      console.log('aiFiverr Firebase DB: User data stored successfully');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to add user data:', error);
      throw error;
    }
  }

  /**
   * Get default user preferences structure
   */
  getDefaultUserPreferences() {
    return {
      // UI Preferences
      theme: 'light',
      notifications: true,
      autoSave: true,

      // API Configuration
      defaultModel: 'gemini-2.5-flash',
      selectedModel: 'gemini-2.5-flash',
      keyRotation: true,
      maxContextLength: 1048576,

      // Behavior Settings
      restrictToFiverr: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxSessions: 50,
      conversationContext: true,

      // Google Search grounding and URL context settings
      googleSearchGrounding: {
        enabled: false,
        defaultEnabled: false
      },
      urlContextExtraction: {
        enabled: false,
        defaultEnabled: false,
        autoExtract: true
      },

      // User Profile Extensions
      bio: '', // User's professional bio/description
      language: 'en-US', // User's preferred language

      // Advanced Settings
      exportFormat: 'json',
      streamingEnabled: true,
      realTimeTyping: true,

      // Privacy Settings
      crossBrowserSync: true,
      driveIntegration: true,
      dataBackup: true,

      // Performance Settings
      maxCacheSize: 100, // MB
      sessionHistoryLimit: 50,
      messageHistoryLimit: 1000,
      automaticCleanup: true
    };
  }

  /**
   * Get user data by email
   */
  async getUserData(userEmail) {
    try {
      const docId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

      const response = await this.makeFirestoreRequest(`/${this.collections.users}/${docId}`);

      if (response.error && response.error.code === 'NOT_FOUND') {
        return null;
      }

      const userData = this.fromFirestoreDocument(response);

      // Ensure preferences exist with defaults
      if (userData && !userData.preferences) {
        userData.preferences = this.getDefaultUserPreferences();
      }

      return userData;

    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      console.error('aiFiverr Firebase DB: Failed to get user data:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userEmail, preferences) {
    try {
      console.log('aiFiverr Firebase DB: Updating preferences for:', userEmail);

      // Get existing user data
      const existingUser = await this.getUserData(userEmail);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Merge with existing preferences
      const updatedPreferences = {
        ...this.getDefaultUserPreferences(),
        ...existingUser.preferences,
        ...preferences
      };

      const docId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

      const updateDoc = {
        fields: {
          preferences: {
            mapValue: {
              fields: this.toFirestoreDocument(updatedPreferences).mapValue.fields
            }
          },
          lastLogin: {
            timestampValue: new Date().toISOString()
          }
        }
      };

      await this.makeFirestoreRequest(`/${this.collections.users}/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateDoc)
      });

      console.log('aiFiverr Firebase DB: User preferences updated successfully');
      return { success: true, preferences: updatedPreferences };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to update user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences only
   */
  async getUserPreferences(userEmail) {
    try {
      const userData = await this.getUserData(userEmail);
      if (!userData) {
        return this.getDefaultUserPreferences();
      }

      return { ...this.getDefaultUserPreferences(), ...userData.preferences };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to get user preferences:', error);
      return this.getDefaultUserPreferences();
    }
  }

  /**
   * Save custom prompts to Firebase
   */
  async saveCustomPrompts(userEmail, prompts) {
    try {
      console.log('aiFiverr Firebase DB: Saving custom prompts for:', userEmail);

      const docId = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_prompts`;
      
      const promptsDoc = {
        userEmail: userEmail,
        prompts: prompts,
        lastUpdated: new Date().toISOString()
      };

      const firestoreDoc = {
        fields: this.toFirestoreDocument(promptsDoc)
      };

      await this.makeFirestoreRequest(`/${this.collections.prompts}/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify(firestoreDoc)
      });

      console.log('aiFiverr Firebase DB: Custom prompts saved successfully');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to save custom prompts:', error);
      throw error;
    }
  }

  /**
   * Load custom prompts from Firebase
   */
  async loadCustomPrompts(userEmail) {
    try {
      const docId = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_prompts`;
      
      const response = await this.makeFirestoreRequest(`/${this.collections.prompts}/${docId}`);
      
      if (response.error && response.error.code === 'NOT_FOUND') {
        return null;
      }

      const data = this.fromFirestoreDocument(response);
      return data.prompts || {};

    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      console.error('aiFiverr Firebase DB: Failed to load custom prompts:', error);
      throw error;
    }
  }

  /**
   * Save knowledge base variables to Firebase
   */
  async saveKnowledgeBaseVariables(userEmail, variables) {
    try {
      console.log('aiFiverr Firebase DB: Saving knowledge base variables for:', userEmail);

      const docId = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_variables`;
      
      const variablesDoc = {
        userEmail: userEmail,
        variables: variables,
        lastUpdated: new Date().toISOString()
      };

      const firestoreDoc = {
        fields: this.toFirestoreDocument(variablesDoc)
      };

      await this.makeFirestoreRequest(`/${this.collections.variables}/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify(firestoreDoc)
      });

      console.log('aiFiverr Firebase DB: Knowledge base variables saved successfully');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to save knowledge base variables:', error);
      throw error;
    }
  }

  /**
   * Load knowledge base variables from Firebase
   */
  async loadKnowledgeBaseVariables(userEmail) {
    try {
      const docId = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_variables`;
      
      const response = await this.makeFirestoreRequest(`/${this.collections.variables}/${docId}`);
      
      if (response.error && response.error.code === 'NOT_FOUND') {
        return null;
      }

      const data = this.fromFirestoreDocument(response);
      return data.variables || {};

    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      console.error('aiFiverr Firebase DB: Failed to load knowledge base variables:', error);
      throw error;
    }
  }

  /**
   * Save conversation data to Firebase
   */
  async saveConversation(userEmail, conversationId, conversationData) {
    try {
      console.log('aiFiverr Firebase DB: Saving conversation for:', userEmail);

      const docId = `${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${conversationId}`;
      
      const conversationDoc = {
        userEmail: userEmail,
        conversationId: conversationId,
        data: conversationData,
        timestamp: new Date().toISOString()
      };

      const firestoreDoc = {
        fields: this.toFirestoreDocument(conversationDoc)
      };

      await this.makeFirestoreRequest(`/${this.collections.conversations}/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify(firestoreDoc)
      });

      console.log('aiFiverr Firebase DB: Conversation saved successfully');
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userEmail) {
    try {
      const userPrefix = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Query conversations that start with user prefix
      const response = await this.makeFirestoreRequest(
        `/${this.collections.conversations}?pageSize=100&orderBy=timestamp desc`
      );

      if (!response.documents) {
        return [];
      }

      // Filter conversations for this user
      const userConversations = response.documents
        .map(doc => this.fromFirestoreDocument(doc))
        .filter(conv => conv.userEmail === userEmail);

      return userConversations;

    } catch (error) {
      console.error('aiFiverr Firebase DB: Failed to get user conversations:', error);
      return [];
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      // Try to read from users collection
      await this.makeFirestoreRequest(`/${this.collections.users}?pageSize=1`);
      return { success: true };
    } catch (error) {
      console.error('aiFiverr Firebase DB: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.firebaseDatabaseService = new FirebaseDatabaseService();
}
