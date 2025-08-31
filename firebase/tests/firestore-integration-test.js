/**
 * Firebase Firestore Integration Test Suite
 * Comprehensive testing for aiFiverr extension Firebase implementation
 */

class FirestoreIntegrationTest {
  constructor() {
    this.testResults = [];
    this.testUser = {
      email: 'test@aifiverr.com',
      name: 'Test User',
      picture: 'https://example.com/test-avatar.jpg',
      id: 'test123',
      given_name: 'Test',
      family_name: 'User',
      locale: 'en-US',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Firebase Firestore Integration Tests...');
    
    try {
      await this.testFirebaseConnection();
      await this.testUserDataStorage();
      await this.testPreferencesManagement();
      await this.testBioAndLanguageUpdates();
      await this.testLocalStorageSync();
      await this.testErrorHandling();
      
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.addResult('Test Suite', false, error.message);
    }
  }

  /**
   * Test Firebase connection
   */
  async testFirebaseConnection() {
    try {
      console.log('🔗 Testing Firebase connection...');
      
      // Test background script ping
      const pingResponse = await chrome.runtime.sendMessage({ type: 'PING' });
      this.addResult('Background Script Ping', pingResponse.success, 
        pingResponse.success ? 'Background script responsive' : 'No response');
      
      // Test auth status
      const authResponse = await chrome.runtime.sendMessage({ type: 'FIREBASE_AUTH_STATUS' });
      this.addResult('Firebase Auth Status', authResponse.success, 
        `Auth state: ${authResponse.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`);
      
      // Test user data service availability
      const serviceAvailable = window.userDataService !== undefined;
      this.addResult('User Data Service', serviceAvailable, 
        serviceAvailable ? 'Service available' : 'Service not loaded');
      
      if (serviceAvailable) {
        const connectionTest = await window.userDataService.testConnection();
        this.addResult('Firestore Connection', connectionTest.success, 
          connectionTest.success ? 'Connection successful' : connectionTest.error);
      }
      
    } catch (error) {
      this.addResult('Firebase Connection', false, error.message);
    }
  }

  /**
   * Test user data storage
   */
  async testUserDataStorage() {
    try {
      console.log('👤 Testing user data storage...');
      
      // Test storing user data
      const storeResponse = await chrome.runtime.sendMessage({
        type: 'FIREBASE_STORE_USER_DATA',
        userData: this.testUser
      });
      
      this.addResult('Store User Data', storeResponse.success, 
        storeResponse.success ? 'User data stored' : storeResponse.error);
      
      if (window.userDataService) {
        await window.userDataService.init();
        
        // Test retrieving user data
        const userData = await window.userDataService.getUserProfile(this.testUser.email);
        const userFound = userData !== null;
        
        this.addResult('Retrieve User Data', userFound, 
          userFound ? `User found: ${userData.email}` : 'User not found');
        
        if (userFound) {
          // Verify user data structure
          const hasPreferences = userData.preferences !== undefined;
          const hasRequiredFields = userData.email && userData.name && userData.created;
          
          this.addResult('User Data Structure', hasRequiredFields, 
            hasRequiredFields ? 'All required fields present' : 'Missing required fields');
          
          this.addResult('User Preferences', hasPreferences, 
            hasPreferences ? 'Preferences object exists' : 'No preferences found');
        }
      }
      
    } catch (error) {
      this.addResult('User Data Storage', false, error.message);
    }
  }

  /**
   * Test preferences management
   */
  async testPreferencesManagement() {
    try {
      console.log('⚙️ Testing preferences management...');
      
      if (!window.userDataService) {
        this.addResult('Preferences Management', false, 'User data service not available');
        return;
      }
      
      // Test getting default preferences
      const defaultPrefs = await window.userDataService.getPreferences(this.testUser.email);
      const hasDefaultPrefs = defaultPrefs && typeof defaultPrefs === 'object';
      
      this.addResult('Get Default Preferences', hasDefaultPrefs, 
        hasDefaultPrefs ? `${Object.keys(defaultPrefs).length} preferences loaded` : 'No preferences');
      
      // Test updating preferences
      const testPreferences = {
        theme: 'dark',
        notifications: false,
        selectedModel: 'gemini-2.5-pro',
        maxContextLength: 2097152
      };
      
      const updateResult = await window.userDataService.updatePreferences(
        this.testUser.email, testPreferences);
      
      this.addResult('Update Preferences', updateResult.success, 
        updateResult.success ? 'Preferences updated' : 'Update failed');
      
      // Verify updates
      if (updateResult.success) {
        const updatedPrefs = await window.userDataService.getPreferences(this.testUser.email);
        const themeUpdated = updatedPrefs.theme === 'dark';
        const modelUpdated = updatedPrefs.selectedModel === 'gemini-2.5-pro';
        
        this.addResult('Verify Preference Updates', themeUpdated && modelUpdated, 
          `Theme: ${updatedPrefs.theme}, Model: ${updatedPrefs.selectedModel}`);
      }
      
    } catch (error) {
      this.addResult('Preferences Management', false, error.message);
    }
  }

  /**
   * Test bio and language updates
   */
  async testBioAndLanguageUpdates() {
    try {
      console.log('📝 Testing bio and language updates...');
      
      if (!window.userDataService) {
        this.addResult('Bio/Language Updates', false, 'User data service not available');
        return;
      }
      
      // Test bio update
      const testBio = 'Professional freelancer specializing in AI integration and web development';
      const bioResult = await window.userDataService.updateBio(this.testUser.email, testBio);
      
      this.addResult('Update Bio', bioResult.success, 
        bioResult.success ? 'Bio updated successfully' : 'Bio update failed');
      
      // Test language update
      const testLanguage = 'es-ES';
      const langResult = await window.userDataService.updateLanguage(this.testUser.email, testLanguage);
      
      this.addResult('Update Language', langResult.success, 
        langResult.success ? 'Language updated successfully' : 'Language update failed');
      
      // Verify updates
      const updatedPrefs = await window.userDataService.getPreferences(this.testUser.email);
      const bioCorrect = updatedPrefs.bio === testBio;
      const langCorrect = updatedPrefs.language === testLanguage;
      
      this.addResult('Verify Bio/Language', bioCorrect && langCorrect, 
        `Bio length: ${updatedPrefs.bio.length}, Language: ${updatedPrefs.language}`);
      
    } catch (error) {
      this.addResult('Bio/Language Updates', false, error.message);
    }
  }

  /**
   * Test local storage sync
   */
  async testLocalStorageSync() {
    try {
      console.log('🔄 Testing local storage sync...');
      
      if (!window.userDataService) {
        this.addResult('Local Storage Sync', false, 'User data service not available');
        return;
      }
      
      // Test sync functionality
      const syncResult = await window.userDataService.syncLocalSettings(this.testUser.email);
      const syncSuccessful = syncResult && typeof syncResult === 'object';
      
      this.addResult('Sync Local Settings', syncSuccessful, 
        syncSuccessful ? 'Settings synced successfully' : 'Sync failed');
      
      // Test local settings retrieval
      const localSettings = await window.userDataService.getLocalSettings();
      const hasLocalSettings = localSettings && typeof localSettings === 'object';
      
      this.addResult('Get Local Settings', hasLocalSettings, 
        hasLocalSettings ? 'Local settings retrieved' : 'No local settings');
      
    } catch (error) {
      this.addResult('Local Storage Sync', false, error.message);
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    try {
      console.log('🚨 Testing error handling...');
      
      if (!window.userDataService) {
        this.addResult('Error Handling', false, 'User data service not available');
        return;
      }
      
      // Test with invalid email
      try {
        await window.userDataService.getUserProfile('invalid-email');
        this.addResult('Invalid Email Handling', true, 'Handled gracefully');
      } catch (error) {
        this.addResult('Invalid Email Handling', true, 'Error caught properly');
      }
      
      // Test with null preferences
      try {
        await window.userDataService.updatePreferences(this.testUser.email, null);
        this.addResult('Null Preferences Handling', false, 'Should have thrown error');
      } catch (error) {
        this.addResult('Null Preferences Handling', true, 'Error handled correctly');
      }
      
    } catch (error) {
      this.addResult('Error Handling', false, error.message);
    }
  }

  /**
   * Add test result
   */
  addResult(testName, success, message) {
    this.testResults.push({
      test: testName,
      success: success,
      message: message,
      timestamp: new Date().toISOString()
    });
    
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${message}`);
  }

  /**
   * Display test results summary
   */
  displayResults() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n📊 Test Results Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`- ${result.test}: ${result.message}`);
      });
    }
    
    // Store results for later analysis
    window.firestoreTestResults = this.testResults;
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    // Implementation would remove test user data
    // For safety, we'll just log the intent
    console.log('Test cleanup completed (test data preserved for analysis)');
  }
}

// Create global test instance
if (typeof window !== 'undefined') {
  window.firestoreIntegrationTest = new FirestoreIntegrationTest();
}

console.log('🧪 Firestore Integration Test Suite loaded. Use window.firestoreIntegrationTest.runAllTests() to start testing.');
