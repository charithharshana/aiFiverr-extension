/**
 * Quick Firebase Authentication Test
 * Simple test to verify Firebase authentication is working
 */

/**
 * Quick test function for Firebase authentication
 */
async function quickFirebaseAuthTest() {
  console.log('🧪 Quick Firebase Auth Test: Starting...');
  
  try {
    // Test 1: Check if background script is responding
    console.log('📡 Testing background script communication...');
    
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
    
    if (pingResponse && pingResponse.success) {
      console.log('✅ Background script is responding:', pingResponse.message);
    } else {
      throw new Error('Background script not responding properly');
    }
    
    // Test 2: Check if Google Auth Service is available
    console.log('🔍 Checking Google Auth Service...');
    
    if (typeof window.googleAuthService !== 'undefined') {
      console.log('✅ Google Auth Service is available');
      console.log('📊 Auth Service State:', window.googleAuthService.getAuthState ? window.googleAuthService.getAuthState() : 'No getAuthState method');
    } else if (typeof window.GoogleAuthService !== 'undefined') {
      console.log('✅ Google Auth Service class is available');
      window.googleAuthService = new window.GoogleAuthService();
      console.log('📊 Auth Service State:', window.googleAuthService.getAuthState());
    } else {
      console.warn('⚠️ Google Auth Service not found');
    }
    
    // Test 3: Check if Firebase Auth Service is available
    console.log('🔍 Checking Firebase Auth Service...');
    
    if (typeof window.FirebaseAuthService !== 'undefined') {
      console.log('✅ Firebase Auth Service class is available');
    } else {
      console.warn('⚠️ Firebase Auth Service not found');
    }
    
    // Test 4: Test authentication flow (optional - requires user interaction)
    console.log('🔐 Authentication flow test available. Run testAuthentication() to test sign-in.');
    
    console.log('✅ Quick Firebase Auth Test: All basic checks passed!');
    
    return {
      success: true,
      backgroundScript: !!pingResponse?.success,
      googleAuthService: typeof window.googleAuthService !== 'undefined',
      firebaseAuthService: typeof window.FirebaseAuthService !== 'undefined'
    };
    
  } catch (error) {
    console.error('❌ Quick Firebase Auth Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test authentication flow (requires user interaction)
 */
async function testAuthentication() {
  console.log('🔐 Testing authentication flow...');
  
  try {
    if (!window.googleAuthService) {
      throw new Error('Google Auth Service not available');
    }
    
    console.log('🚀 Starting authentication...');
    const result = await window.googleAuthService.authenticate();
    
    if (result.success) {
      console.log('✅ Authentication successful!');
      console.log('👤 User:', result.user);
      
      // Test getting current user
      const currentUser = window.googleAuthService.getCurrentUser();
      console.log('👤 Current user:', currentUser);
      
      // Test authentication state
      const isAuth = window.googleAuthService.isUserAuthenticated();
      console.log('🔐 Is authenticated:', isAuth);
      
      return { success: true, user: result.user };
    } else {
      throw new Error(result.error || 'Authentication failed');
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test sign out
 */
async function testSignOut() {
  console.log('🚪 Testing sign out...');
  
  try {
    if (!window.googleAuthService) {
      throw new Error('Google Auth Service not available');
    }
    
    const result = await window.googleAuthService.signOut();
    
    if (result.success) {
      console.log('✅ Sign out successful!');
      
      // Verify user is signed out
      const currentUser = window.googleAuthService.getCurrentUser();
      const isAuth = window.googleAuthService.isUserAuthenticated();
      
      console.log('👤 Current user after sign out:', currentUser);
      console.log('🔐 Is authenticated after sign out:', isAuth);
      
      return { success: true };
    } else {
      throw new Error(result.error || 'Sign out failed');
    }
    
  } catch (error) {
    console.error('❌ Sign out test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Debug function to check all services
 */
function debugFirebaseServices() {
  console.log('🔍 Firebase Services Debug Info:');
  console.log('================================');
  
  // Check background script
  console.log('📡 Background Script Test:');
  chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Background script error:', chrome.runtime.lastError.message);
    } else {
      console.log('✅ Background script response:', response);
    }
  });
  
  // Check services
  console.log('🔍 Available Services:');
  console.log('- window.googleAuthService:', typeof window.googleAuthService);
  console.log('- window.GoogleAuthService:', typeof window.GoogleAuthService);
  console.log('- window.FirebaseAuthService:', typeof window.FirebaseAuthService);
  console.log('- window.firebaseConfig:', typeof window.firebaseConfig);
  console.log('- window.firebaseConfigManager:', typeof window.firebaseConfigManager);
  
  // Check Chrome APIs
  console.log('🔍 Chrome APIs:');
  console.log('- chrome.runtime:', typeof chrome.runtime);
  console.log('- chrome.storage:', typeof chrome.storage);
  console.log('- chrome.tabs:', typeof chrome.tabs);
  
  // Check storage
  chrome.storage.local.get(['firebase_auth_data', 'google_auth_data'], (result) => {
    console.log('💾 Stored Auth Data:');
    console.log('- firebase_auth_data:', !!result.firebase_auth_data);
    console.log('- google_auth_data:', !!result.google_auth_data);
  });
}

// Export functions for global use
if (typeof window !== 'undefined') {
  window.quickFirebaseAuthTest = quickFirebaseAuthTest;
  window.testAuthentication = testAuthentication;
  window.testSignOut = testSignOut;
  window.debugFirebaseServices = debugFirebaseServices;
} else {
  self.quickFirebaseAuthTest = quickFirebaseAuthTest;
  self.testAuthentication = testAuthentication;
  self.testSignOut = testSignOut;
  self.debugFirebaseServices = debugFirebaseServices;
}

console.log('🧪 Quick Firebase Auth Test loaded!');
console.log('📋 Available test functions:');
console.log('- quickFirebaseAuthTest() - Run basic checks');
console.log('- testAuthentication() - Test sign-in flow');
console.log('- testSignOut() - Test sign-out flow');
console.log('- debugFirebaseServices() - Debug all services');
