/**
 * Firebase Authentication Integration Test
 * Comprehensive test suite for the new Firebase authentication system
 */

/**
 * Firebase Authentication Test Suite
 */
class FirebaseAuthTest {
  constructor() {
    this.testResults = [];
    this.authService = null;
    this.googleAuthService = null;
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    try {
      console.log('🧪 Firebase Auth Test: Initializing test environment...');
      
      // Initialize services
      if (typeof FirebaseAuthService !== 'undefined') {
        this.authService = new FirebaseAuthService();
      }
      
      if (typeof GoogleAuthService !== 'undefined') {
        this.googleAuthService = new GoogleAuthService();
      } else if (window.googleAuthService) {
        this.googleAuthService = window.googleAuthService;
      }

      console.log('✅ Firebase Auth Test: Test environment initialized');
      return true;
    } catch (error) {
      console.error('❌ Firebase Auth Test: Initialization failed:', error);
      return false;
    }
  }

  /**
   * Run all authentication tests
   */
  async runAllTests() {
    console.log('🚀 Firebase Auth Test: Starting comprehensive test suite...');
    
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('❌ Firebase Auth Test: Cannot run tests - initialization failed');
      return;
    }

    // Test configuration
    await this.testFirebaseConfiguration();
    
    // Test service initialization
    await this.testServiceInitialization();
    
    // Test authentication state management
    await this.testAuthStateManagement();
    
    // Test storage operations
    await this.testStorageOperations();
    
    // Test background script communication
    await this.testBackgroundCommunication();
    
    // Test error handling
    await this.testErrorHandling();
    
    // Display results
    this.displayTestResults();
  }

  /**
   * Test Firebase configuration
   */
  async testFirebaseConfiguration() {
    console.log('🔧 Testing Firebase configuration...');
    
    try {
      // Test configuration manager
      if (typeof firebaseConfigManager !== 'undefined') {
        const config = firebaseConfigManager.getConfig();
        
        this.assert(config !== null, 'Firebase config should not be null');
        this.assert(config.apiKey, 'Firebase config should have apiKey');
        this.assert(config.authDomain, 'Firebase config should have authDomain');
        this.assert(config.projectId, 'Firebase config should have projectId');
        this.assert(config.projectId === 'ai-fiverr', 'Project ID should be ai-fiverr');
        
        console.log('✅ Firebase configuration test passed');
      } else {
        this.assert(false, 'Firebase config manager not available');
      }
    } catch (error) {
      console.error('❌ Firebase configuration test failed:', error);
      this.assert(false, `Firebase configuration test failed: ${error.message}`);
    }
  }

  /**
   * Test service initialization
   */
  async testServiceInitialization() {
    console.log('🔧 Testing service initialization...');
    
    try {
      // Test Firebase Auth Service
      if (this.authService) {
        this.assert(this.authService.isInitialized !== undefined, 'Firebase auth service should have isInitialized property');
        this.assert(typeof this.authService.authenticate === 'function', 'Firebase auth service should have authenticate method');
        this.assert(typeof this.authService.signOut === 'function', 'Firebase auth service should have signOut method');
      }
      
      // Test Google Auth Service
      if (this.googleAuthService) {
        this.assert(this.googleAuthService.isInitialized !== undefined, 'Google auth service should have isInitialized property');
        this.assert(typeof this.googleAuthService.authenticate === 'function', 'Google auth service should have authenticate method');
        this.assert(typeof this.googleAuthService.signOut === 'function', 'Google auth service should have signOut method');
        this.assert(typeof this.googleAuthService.getCurrentUser === 'function', 'Google auth service should have getCurrentUser method');
      }
      
      console.log('✅ Service initialization test passed');
    } catch (error) {
      console.error('❌ Service initialization test failed:', error);
      this.assert(false, `Service initialization test failed: ${error.message}`);
    }
  }

  /**
   * Test authentication state management
   */
  async testAuthStateManagement() {
    console.log('🔧 Testing authentication state management...');
    
    try {
      if (this.googleAuthService) {
        // Test initial state
        const initialUser = this.googleAuthService.getCurrentUser();
        const isAuthenticated = this.googleAuthService.isUserAuthenticated();
        
        this.assert(typeof isAuthenticated === 'boolean', 'isUserAuthenticated should return boolean');
        
        // Test auth listeners
        let listenerCalled = false;
        const testListener = (authState) => {
          listenerCalled = true;
          this.assert(typeof authState === 'object', 'Auth state should be object');
          this.assert(typeof authState.isAuthenticated === 'boolean', 'Auth state should have isAuthenticated boolean');
        };
        
        this.googleAuthService.addAuthListener(testListener);
        this.googleAuthService.notifyAuthListeners();
        
        this.assert(listenerCalled, 'Auth listener should be called');
        
        // Clean up
        this.googleAuthService.removeAuthListener(testListener);
        
        console.log('✅ Authentication state management test passed');
      } else {
        this.assert(false, 'Google auth service not available for state management test');
      }
    } catch (error) {
      console.error('❌ Authentication state management test failed:', error);
      this.assert(false, `Authentication state management test failed: ${error.message}`);
    }
  }

  /**
   * Test storage operations
   */
  async testStorageOperations() {
    console.log('🔧 Testing storage operations...');
    
    try {
      // Test storage availability
      this.assert(typeof chrome !== 'undefined', 'Chrome APIs should be available');
      this.assert(typeof chrome.storage !== 'undefined', 'Chrome storage API should be available');
      this.assert(typeof chrome.storage.local !== 'undefined', 'Chrome local storage should be available');
      
      // Test storage operations
      const testData = { test: 'firebase_auth_test', timestamp: Date.now() };
      
      // Save test data
      await chrome.storage.local.set({ firebase_auth_test: testData });
      
      // Retrieve test data
      const result = await chrome.storage.local.get(['firebase_auth_test']);
      this.assert(result.firebase_auth_test !== undefined, 'Test data should be retrievable');
      this.assert(result.firebase_auth_test.test === 'firebase_auth_test', 'Test data should match');
      
      // Clean up
      await chrome.storage.local.remove(['firebase_auth_test']);
      
      console.log('✅ Storage operations test passed');
    } catch (error) {
      console.error('❌ Storage operations test failed:', error);
      this.assert(false, `Storage operations test failed: ${error.message}`);
    }
  }

  /**
   * Test background script communication
   */
  async testBackgroundCommunication() {
    console.log('🔧 Testing background script communication...');
    
    try {
      // Test basic message sending
      this.assert(typeof chrome.runtime !== 'undefined', 'Chrome runtime API should be available');
      this.assert(typeof chrome.runtime.sendMessage === 'function', 'Chrome sendMessage should be available');
      
      // Test ping to background script
      const pingResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Background script ping timeout'));
        }, 5000);

        chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      this.assert(pingResponse !== undefined, 'Background script should respond to ping');
      console.log('📡 Background script ping response:', pingResponse);
      
      console.log('✅ Background script communication test passed');
    } catch (error) {
      console.error('❌ Background script communication test failed:', error);
      this.assert(false, `Background script communication test failed: ${error.message}`);
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('🔧 Testing error handling...');
    
    try {
      if (this.googleAuthService) {
        // Test invalid message handling
        try {
          await this.googleAuthService.sendMessageWithRetry({ type: 'INVALID_MESSAGE_TYPE' }, 1);
          // Should not reach here if error handling works
          this.assert(false, 'Invalid message should throw error');
        } catch (error) {
          // This is expected
          this.assert(true, 'Invalid message correctly handled with error');
        }
        
        // Test token validation with invalid token
        const originalToken = this.googleAuthService.accessToken;
        this.googleAuthService.accessToken = 'invalid_token';
        
        const isValid = await this.googleAuthService.refreshTokenIfNeeded();
        this.assert(isValid === null, 'Invalid token should return null');
        
        // Restore original token
        this.googleAuthService.accessToken = originalToken;
        
        console.log('✅ Error handling test passed');
      } else {
        this.assert(false, 'Google auth service not available for error handling test');
      }
    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      this.assert(false, `Error handling test failed: ${error.message}`);
    }
  }

  /**
   * Assert helper function
   */
  assert(condition, message) {
    const result = {
      passed: !!condition,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    if (condition) {
      console.log(`✅ ${message}`);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Display test results
   */
  displayTestResults() {
    console.log('\n📊 Firebase Authentication Test Results:');
    console.log('==========================================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.message}`);
      });
    }
    
    console.log('\n==========================================');
    
    // Return results for programmatic access
    return {
      total,
      passed,
      failed,
      successRate: (passed / total) * 100,
      results: this.testResults
    };
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.FirebaseAuthTest = FirebaseAuthTest;
  
  // Create global test function
  window.testFirebaseAuth = async function() {
    const test = new FirebaseAuthTest();
    return await test.runAllTests();
  };
} else {
  self.FirebaseAuthTest = FirebaseAuthTest;
  
  self.testFirebaseAuth = async function() {
    const test = new FirebaseAuthTest();
    return await test.runAllTests();
  };
}

console.log('🧪 Firebase Authentication Test Suite loaded. Run testFirebaseAuth() to start testing.');
