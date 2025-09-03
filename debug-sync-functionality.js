/**
 * Debug script for custom prompts and variables sync functionality
 * Run this in the browser console on a Fiverr page with the extension loaded
 * 
 * Usage:
 * 1. Open browser console on a Fiverr page
 * 2. Copy and paste this entire script
 * 3. Run: debugSync.runFullDiagnostic()
 */

window.debugSync = {
  
  /**
   * Check if all required components are available
   */
  checkComponents() {
    console.log('🔍 Checking required components...');
    
    const components = {
      knowledgeBaseManager: !!window.knowledgeBaseManager,
      googleAuthService: !!window.googleAuthService,
      googleDriveClient: !!window.googleDriveClient,
      storageManager: !!window.storageManager
    };
    
    console.log('Components status:', components);
    
    // Check authentication service methods
    if (window.googleAuthService) {
      const authMethods = {
        isUserAuthenticated: typeof window.googleAuthService.isUserAuthenticated === 'function',
        addAuthListener: typeof window.googleAuthService.addAuthListener === 'function',
        notifyAuthListeners: typeof window.googleAuthService.notifyAuthListeners === 'function',
        authenticate: typeof window.googleAuthService.authenticate === 'function'
      };
      console.log('Auth service methods:', authMethods);
      console.log('Current auth status:', window.googleAuthService.isUserAuthenticated());
    }
    
    // Check knowledge base manager methods
    if (window.knowledgeBaseManager) {
      const kbMethods = {
        setupAuthenticationListeners: typeof window.knowledgeBaseManager.setupAuthenticationListeners === 'function',
        syncCustomDataFromGoogleDrive: typeof window.knowledgeBaseManager.syncCustomDataFromGoogleDrive === 'function',
        syncToGoogleDrive: typeof window.knowledgeBaseManager.syncToGoogleDrive === 'function'
      };
      console.log('Knowledge base manager methods:', kbMethods);
    }
    
    return components;
  },
  
  /**
   * Test authentication listeners
   */
  async testAuthListeners() {
    console.log('🔐 Testing authentication listeners...');
    
    if (!window.googleAuthService) {
      console.error('❌ Google Auth Service not available');
      return false;
    }
    
    let listenerCalled = false;
    const testListener = (authState) => {
      console.log('✅ Auth listener triggered with state:', authState);
      listenerCalled = true;
    };
    
    // Add test listener
    window.googleAuthService.addAuthListener(testListener);
    console.log('📝 Test listener added');
    
    // Trigger notification manually
    window.googleAuthService.notifyAuthListeners();
    
    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (listenerCalled) {
      console.log('✅ Authentication listeners are working');
      return true;
    } else {
      console.log('❌ Authentication listeners not working');
      return false;
    }
  },
  
  /**
   * Check if sync methods are being called
   */
  async testSyncMethods() {
    console.log('🔄 Testing sync methods...');
    
    if (!window.knowledgeBaseManager) {
      console.error('❌ Knowledge Base Manager not available');
      return false;
    }
    
    // Test if sync methods exist and can be called
    try {
      console.log('📞 Testing syncCustomDataFromGoogleDrive...');
      await window.knowledgeBaseManager.syncCustomDataFromGoogleDrive();
      console.log('✅ syncCustomDataFromGoogleDrive completed');
    } catch (error) {
      console.error('❌ syncCustomDataFromGoogleDrive failed:', error);
      return false;
    }
    
    return true;
  },
  
  /**
   * Check Google Drive files
   */
  async checkGoogleDriveFiles() {
    console.log('☁️ Checking Google Drive files...');
    
    if (!window.googleDriveClient) {
      console.error('❌ Google Drive Client not available');
      return false;
    }
    
    if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
      console.error('❌ User not authenticated');
      return false;
    }
    
    try {
      // Search for backup files
      console.log('🔍 Searching for custom prompts backup...');
      const promptFiles = await window.googleDriveClient.searchFiles('aifiverr-custom-prompts.json');
      console.log('Custom prompts files found:', promptFiles.length);
      if (promptFiles.length > 0) {
        console.log('Latest prompts file:', promptFiles[0]);
      }
      
      console.log('🔍 Searching for variables backup...');
      const variableFiles = await window.googleDriveClient.searchFiles('aifiverr-knowledge-base-variables.json');
      console.log('Variables files found:', variableFiles.length);
      if (variableFiles.length > 0) {
        console.log('Latest variables file:', variableFiles[0]);
      }
      
      return { promptFiles, variableFiles };
    } catch (error) {
      console.error('❌ Failed to check Google Drive files:', error);
      return false;
    }
  },
  
  /**
   * Test backup functionality
   */
  async testBackup() {
    console.log('💾 Testing backup functionality...');
    
    if (!window.knowledgeBaseManager) {
      console.error('❌ Knowledge Base Manager not available');
      return false;
    }
    
    // Create test data
    const testPrompts = {
      'debug-test-prompt': {
        title: 'Debug Test Prompt',
        content: 'This is a test prompt for debugging: {conversation}',
        description: 'Debug test prompt',
        created: Date.now(),
        modified: Date.now(),
        isDefault: false
      }
    };
    
    const testVariables = {
      'debug-test-var': 'Debug test variable value'
    };
    
    try {
      console.log('📝 Testing custom prompts backup...');
      await window.knowledgeBaseManager.syncToGoogleDrive('custom-prompts', testPrompts);
      console.log('✅ Custom prompts backup completed');
      
      console.log('🔧 Testing variables backup...');
      await window.knowledgeBaseManager.syncToGoogleDrive('variables', testVariables);
      console.log('✅ Variables backup completed');
      
      return true;
    } catch (error) {
      console.error('❌ Backup test failed:', error);
      return false;
    }
  },
  
  /**
   * Test restore functionality
   */
  async testRestore() {
    console.log('📥 Testing restore functionality...');
    
    if (!window.knowledgeBaseManager) {
      console.error('❌ Knowledge Base Manager not available');
      return false;
    }
    
    try {
      // Clear local data first
      console.log('🗑️ Clearing local data...');
      window.knowledgeBaseManager.customPrompts.clear();
      window.knowledgeBaseManager.variables.clear();
      
      // Test restore
      console.log('📥 Testing restore from Google Drive...');
      await window.knowledgeBaseManager.syncCustomDataFromGoogleDrive();
      
      // Check if data was restored
      const restoredPrompts = window.knowledgeBaseManager.customPrompts.size;
      const restoredVariables = window.knowledgeBaseManager.variables.size;
      
      console.log(`✅ Restored ${restoredPrompts} prompts and ${restoredVariables} variables`);
      return true;
    } catch (error) {
      console.error('❌ Restore test failed:', error);
      return false;
    }
  },
  
  /**
   * Simulate authentication to test listeners
   */
  async simulateAuthentication() {
    console.log('🎭 Simulating authentication...');
    
    if (!window.googleAuthService) {
      console.error('❌ Google Auth Service not available');
      return false;
    }
    
    // Add a listener to see if it gets called
    let syncTriggered = false;
    const syncListener = (authState) => {
      console.log('🔔 Sync listener triggered:', authState);
      if (authState.isAuthenticated) {
        syncTriggered = true;
        console.log('✅ Authentication detected, sync should start in 3 seconds...');
      }
    };
    
    window.googleAuthService.addAuthListener(syncListener);
    
    // Simulate auth state change
    console.log('📡 Triggering auth listeners...');
    window.googleAuthService.notifyAuthListeners();
    
    // Wait for potential sync
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    return syncTriggered;
  },
  
  /**
   * Check current data state
   */
  checkCurrentData() {
    console.log('📊 Checking current data state...');
    
    if (window.knowledgeBaseManager) {
      const promptCount = window.knowledgeBaseManager.customPrompts.size;
      const variableCount = window.knowledgeBaseManager.variables.size;
      
      console.log(`Current data: ${promptCount} custom prompts, ${variableCount} variables`);
      
      if (promptCount > 0) {
        console.log('Custom prompts:', Array.from(window.knowledgeBaseManager.customPrompts.keys()));
      }
      
      if (variableCount > 0) {
        console.log('Variables:', Array.from(window.knowledgeBaseManager.variables.keys()));
      }
      
      return { promptCount, variableCount };
    }
    
    return { promptCount: 0, variableCount: 0 };
  },
  
  /**
   * Run full diagnostic
   */
  async runFullDiagnostic() {
    console.log('🚀 Starting full sync functionality diagnostic...');
    console.log('================================================');
    
    const results = {};
    
    // Step 1: Check components
    results.components = this.checkComponents();
    
    // Step 2: Check current data
    results.currentData = this.checkCurrentData();
    
    // Step 3: Test auth listeners
    results.authListeners = await this.testAuthListeners();
    
    // Step 4: Check Google Drive files
    results.driveFiles = await this.checkGoogleDriveFiles();
    
    // Step 5: Test sync methods
    results.syncMethods = await this.testSyncMethods();
    
    // Step 6: Test backup
    results.backup = await this.testBackup();
    
    // Step 7: Test restore
    results.restore = await this.testRestore();
    
    // Step 8: Simulate authentication
    results.authSimulation = await this.simulateAuthentication();
    
    console.log('================================================');
    console.log('🎯 DIAGNOSTIC RESULTS:');
    console.log('Components available:', results.components);
    console.log('Auth listeners working:', results.authListeners);
    console.log('Sync methods working:', results.syncMethods);
    console.log('Backup working:', results.backup);
    console.log('Restore working:', results.restore);
    console.log('Auth simulation triggered:', results.authSimulation);
    
    const allWorking = results.authListeners && results.syncMethods && results.backup && results.restore;
    console.log('================================================');
    console.log(allWorking ? '✅ ALL SYSTEMS WORKING' : '❌ ISSUES DETECTED');
    
    return results;
  }
};

console.log('🧪 Debug script loaded. Run debugSync.runFullDiagnostic() to start diagnosis.');

// Also provide quick access to built-in test functions
console.log('🔧 Built-in test functions:');
console.log('- window.testKnowledgeBaseSync.testSync() - Test sync functionality');
console.log('- window.testKnowledgeBaseSync.createTestData() - Create test data');
console.log('- window.testKnowledgeBaseSync.checkData() - Check current data');
console.log('- window.testKnowledgeBaseSync.testAuthListeners() - Test auth listeners');
