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
   * Add or update user data (replaces Google Sheets functionality)
   */
  async addUserData(userData) {
    try {
      console.log('aiFiverr Firebase DB: Adding user data for:', userData.email);

      // Check if user already exists
      const existingUser = await this.getUserData(userData.email);
      
      const userDoc = {
        email: userData.email,
        name: userData.name || '',
        picture: userData.picture || '',
        id: userData.id || '',
        given_name: userData.given_name || '',
        family_name: userData.family_name || '',
        locale: userData.locale || 'en-US',
        timestamp: userData.timestamp || new Date().toISOString(),
        status: 'active',
        lastLogin: new Date().toISOString()
      };

      // If user exists, update lastLogin; otherwise create new user
      if (existingUser) {
        userDoc.firstLogin = existingUser.timestamp;
        console.log('aiFiverr Firebase DB: Updating existing user');
      } else {
        userDoc.firstLogin = userDoc.timestamp;
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
   * Get user data by email
   */
  async getUserData(userEmail) {
    try {
      const docId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      
      const response = await this.makeFirestoreRequest(`/${this.collections.users}/${docId}`);
      
      if (response.error && response.error.code === 'NOT_FOUND') {
        return null;
      }

      return this.fromFirestoreDocument(response);

    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      console.error('aiFiverr Firebase DB: Failed to get user data:', error);
      throw error;
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
