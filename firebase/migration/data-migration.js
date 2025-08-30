/**
 * Data Migration Script for aiFiverr Firebase Migration
 * Migrates data from Chrome storage and Google Sheets to Firebase Firestore
 */

class DataMigrationTool {
  constructor() {
    this.migrationResults = {
      users: { migrated: 0, failed: 0, errors: [] },
      prompts: { migrated: 0, failed: 0, errors: [] },
      variables: { migrated: 0, failed: 0, errors: [] },
      conversations: { migrated: 0, failed: 0, errors: [] }
    };
    console.log('aiFiverr Migration: Data migration tool initialized');
  }

  /**
   * Run complete data migration
   */
  async runMigration() {
    console.log('aiFiverr Migration: Starting complete data migration...');
    
    try {
      // Step 1: Migrate user authentication data
      await this.migrateUserAuthData();
      
      // Step 2: Migrate custom prompts
      await this.migrateCustomPrompts();
      
      // Step 3: Migrate knowledge base variables
      await this.migrateKnowledgeBaseVariables();
      
      // Step 4: Migrate conversation data
      await this.migrateConversationData();
      
      // Step 5: Generate migration report
      this.generateMigrationReport();
      
      console.log('aiFiverr Migration: Complete data migration finished');
      
    } catch (error) {
      console.error('aiFiverr Migration: Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate user authentication data from Chrome storage to Firebase
   */
  async migrateUserAuthData() {
    console.log('aiFiverr Migration: Migrating user authentication data...');
    
    try {
      // Get old Chrome-specific auth data
      const oldAuthData = await chrome.storage.local.get([
        'google_access_token',
        'google_token_expiry',
        'google_user_info',
        'google_refresh_token'
      ]);

      if (oldAuthData.google_user_info) {
        console.log('aiFiverr Migration: Found old auth data for:', oldAuthData.google_user_info.email);
        
        // Convert to Firebase format
        const firebaseAuthData = {
          firebase_access_token: oldAuthData.google_access_token,
          firebase_token_expiry: oldAuthData.google_token_expiry,
          firebase_user_info: oldAuthData.google_user_info,
          firebase_refresh_token: oldAuthData.google_refresh_token
        };

        // Save in Firebase format
        await chrome.storage.local.set(firebaseAuthData);
        
        // Store user data in Firebase if authenticated
        if (window.firebaseDatabaseService && oldAuthData.google_access_token) {
          try {
            await window.firebaseDatabaseService.addUserData(oldAuthData.google_user_info);
            this.migrationResults.users.migrated++;
            console.log('aiFiverr Migration: User data migrated to Firebase');
          } catch (error) {
            this.migrationResults.users.failed++;
            this.migrationResults.users.errors.push(`User data migration failed: ${error.message}`);
          }
        }

        // Clean up old Chrome-specific keys
        await chrome.storage.local.remove([
          'google_access_token',
          'google_token_expiry', 
          'google_user_info',
          'google_refresh_token'
        ]);

        console.log('aiFiverr Migration: Auth data migration completed');
      } else {
        console.log('aiFiverr Migration: No old auth data found');
      }

    } catch (error) {
      console.error('aiFiverr Migration: Auth data migration failed:', error);
      this.migrationResults.users.failed++;
      this.migrationResults.users.errors.push(`Auth migration failed: ${error.message}`);
    }
  }

  /**
   * Migrate custom prompts from local storage to Firebase
   */
  async migrateCustomPrompts() {
    console.log('aiFiverr Migration: Migrating custom prompts...');
    
    try {
      // Get custom prompts from local storage
      const result = await chrome.storage.local.get(['customPrompts']);
      const customPrompts = result.customPrompts || {};

      if (Object.keys(customPrompts).length > 0) {
        console.log('aiFiverr Migration: Found', Object.keys(customPrompts).length, 'custom prompts');

        // Get current user info
        const userInfo = window.googleAuthService?.getUserInfo();
        if (!userInfo) {
          throw new Error('No authenticated user for prompts migration');
        }

        // Migrate to Firebase
        if (window.firebaseDatabaseService) {
          try {
            await window.firebaseDatabaseService.saveCustomPrompts(userInfo.email, customPrompts);
            this.migrationResults.prompts.migrated = Object.keys(customPrompts).length;
            console.log('aiFiverr Migration: Custom prompts migrated to Firebase');
          } catch (error) {
            this.migrationResults.prompts.failed = Object.keys(customPrompts).length;
            this.migrationResults.prompts.errors.push(`Prompts migration failed: ${error.message}`);
          }
        }
      } else {
        console.log('aiFiverr Migration: No custom prompts found');
      }

    } catch (error) {
      console.error('aiFiverr Migration: Custom prompts migration failed:', error);
      this.migrationResults.prompts.errors.push(`Prompts migration error: ${error.message}`);
    }
  }

  /**
   * Migrate knowledge base variables to Firebase
   */
  async migrateKnowledgeBaseVariables() {
    console.log('aiFiverr Migration: Migrating knowledge base variables...');
    
    try {
      // Get knowledge base data from local storage
      const result = await chrome.storage.local.get(['knowledgeBase', 'variables']);
      const knowledgeBase = result.knowledgeBase || {};
      const variables = result.variables || {};
      
      // Combine both sources
      const allVariables = { ...knowledgeBase, ...variables };

      if (Object.keys(allVariables).length > 0) {
        console.log('aiFiverr Migration: Found', Object.keys(allVariables).length, 'knowledge base variables');

        // Get current user info
        const userInfo = window.googleAuthService?.getUserInfo();
        if (!userInfo) {
          throw new Error('No authenticated user for variables migration');
        }

        // Migrate to Firebase
        if (window.firebaseDatabaseService) {
          try {
            await window.firebaseDatabaseService.saveKnowledgeBaseVariables(userInfo.email, allVariables);
            this.migrationResults.variables.migrated = Object.keys(allVariables).length;
            console.log('aiFiverr Migration: Knowledge base variables migrated to Firebase');
          } catch (error) {
            this.migrationResults.variables.failed = Object.keys(allVariables).length;
            this.migrationResults.variables.errors.push(`Variables migration failed: ${error.message}`);
          }
        }
      } else {
        console.log('aiFiverr Migration: No knowledge base variables found');
      }

    } catch (error) {
      console.error('aiFiverr Migration: Knowledge base variables migration failed:', error);
      this.migrationResults.variables.errors.push(`Variables migration error: ${error.message}`);
    }
  }

  /**
   * Migrate conversation data to Firebase
   */
  async migrateConversationData() {
    console.log('aiFiverr Migration: Migrating conversation data...');
    
    try {
      // Get all stored conversation data
      const allStorage = await chrome.storage.local.get(null);
      const conversationKeys = Object.keys(allStorage).filter(key => 
        key.startsWith('fiverr_conversation_') || key.startsWith('conversation_')
      );

      if (conversationKeys.length > 0) {
        console.log('aiFiverr Migration: Found', conversationKeys.length, 'conversations');

        // Get current user info
        const userInfo = window.googleAuthService?.getUserInfo();
        if (!userInfo) {
          throw new Error('No authenticated user for conversations migration');
        }

        // Migrate each conversation
        for (const key of conversationKeys) {
          try {
            const conversationData = allStorage[key];
            const conversationId = key.replace(/^(fiverr_conversation_|conversation_)/, '');
            
            if (window.firebaseDatabaseService) {
              await window.firebaseDatabaseService.saveConversation(
                userInfo.email, 
                conversationId, 
                conversationData
              );
              this.migrationResults.conversations.migrated++;
            }
          } catch (error) {
            this.migrationResults.conversations.failed++;
            this.migrationResults.conversations.errors.push(
              `Conversation ${key} migration failed: ${error.message}`
            );
          }
        }

        console.log('aiFiverr Migration: Conversation data migration completed');
      } else {
        console.log('aiFiverr Migration: No conversation data found');
      }

    } catch (error) {
      console.error('aiFiverr Migration: Conversation data migration failed:', error);
      this.migrationResults.conversations.errors.push(`Conversations migration error: ${error.message}`);
    }
  }

  /**
   * Clean up old Chrome-specific data
   */
  async cleanupOldData() {
    console.log('aiFiverr Migration: Cleaning up old Chrome-specific data...');
    
    try {
      // Keys to remove
      const keysToRemove = [
        'google_access_token',
        'google_token_expiry',
        'google_user_info',
        'google_refresh_token'
      ];

      // Get all storage to find conversation keys
      const allStorage = await chrome.storage.local.get(null);
      const conversationKeys = Object.keys(allStorage).filter(key => 
        key.startsWith('fiverr_conversation_') || key.startsWith('conversation_')
      );

      // Add conversation keys to removal list
      keysToRemove.push(...conversationKeys);

      // Remove old data
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log('aiFiverr Migration: Cleaned up', keysToRemove.length, 'old data keys');
      }

    } catch (error) {
      console.error('aiFiverr Migration: Cleanup failed:', error);
    }
  }

  /**
   * Verify migration integrity
   */
  async verifyMigration() {
    console.log('aiFiverr Migration: Verifying migration integrity...');
    
    const verificationResults = {
      authData: false,
      prompts: false,
      variables: false,
      conversations: false
    };

    try {
      // Check if Firebase auth data exists
      const firebaseAuth = await chrome.storage.local.get(['firebase_user_info']);
      verificationResults.authData = !!firebaseAuth.firebase_user_info;

      if (verificationResults.authData && window.firebaseDatabaseService) {
        const userEmail = firebaseAuth.firebase_user_info.email;

        // Verify prompts
        try {
          const prompts = await window.firebaseDatabaseService.loadCustomPrompts(userEmail);
          verificationResults.prompts = prompts !== null;
        } catch (error) {
          console.warn('aiFiverr Migration: Prompts verification failed:', error);
        }

        // Verify variables
        try {
          const variables = await window.firebaseDatabaseService.loadKnowledgeBaseVariables(userEmail);
          verificationResults.variables = variables !== null;
        } catch (error) {
          console.warn('aiFiverr Migration: Variables verification failed:', error);
        }

        // Verify conversations
        try {
          const conversations = await window.firebaseDatabaseService.getUserConversations(userEmail);
          verificationResults.conversations = Array.isArray(conversations);
        } catch (error) {
          console.warn('aiFiverr Migration: Conversations verification failed:', error);
        }
      }

      console.log('aiFiverr Migration: Verification results:', verificationResults);
      return verificationResults;

    } catch (error) {
      console.error('aiFiverr Migration: Verification failed:', error);
      return verificationResults;
    }
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    const totalMigrated = this.migrationResults.users.migrated + 
                         this.migrationResults.prompts.migrated + 
                         this.migrationResults.variables.migrated + 
                         this.migrationResults.conversations.migrated;

    const totalFailed = this.migrationResults.users.failed + 
                       this.migrationResults.prompts.failed + 
                       this.migrationResults.variables.failed + 
                       this.migrationResults.conversations.failed;

    console.log('\n' + '='.repeat(60));
    console.log('aiFiverr Firebase Migration Report');
    console.log('='.repeat(60));
    console.log(`Total Items Migrated: ${totalMigrated}`);
    console.log(`Total Items Failed: ${totalFailed}`);
    console.log('');
    console.log('Detailed Results:');
    console.log(`Users: ${this.migrationResults.users.migrated} migrated, ${this.migrationResults.users.failed} failed`);
    console.log(`Prompts: ${this.migrationResults.prompts.migrated} migrated, ${this.migrationResults.prompts.failed} failed`);
    console.log(`Variables: ${this.migrationResults.variables.migrated} migrated, ${this.migrationResults.variables.failed} failed`);
    console.log(`Conversations: ${this.migrationResults.conversations.migrated} migrated, ${this.migrationResults.conversations.failed} failed`);
    
    // Show errors if any
    const allErrors = [
      ...this.migrationResults.users.errors,
      ...this.migrationResults.prompts.errors,
      ...this.migrationResults.variables.errors,
      ...this.migrationResults.conversations.errors
    ];

    if (allErrors.length > 0) {
      console.log('\nErrors:');
      allErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('='.repeat(60));

    // Save report to storage
    const reportKey = `aiFiverr_migration_report_${Date.now()}`;
    const report = {
      timestamp: new Date().toISOString(),
      results: this.migrationResults,
      summary: { totalMigrated, totalFailed, totalErrors: allErrors.length }
    };

    chrome.storage.local.set({ [reportKey]: report });
    console.log(`Migration report saved: ${reportKey}`);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.aiFiverrMigrationTool = new DataMigrationTool();
  
  // Provide easy access functions
  window.runDataMigration = () => {
    return window.aiFiverrMigrationTool.runMigration();
  };
  
  window.verifyMigration = () => {
    return window.aiFiverrMigrationTool.verifyMigration();
  };
  
  window.cleanupOldData = () => {
    return window.aiFiverrMigrationTool.cleanupOldData();
  };
  
  console.log('aiFiverr Migration Tool loaded. Use window.runDataMigration() to start migration.');
}
