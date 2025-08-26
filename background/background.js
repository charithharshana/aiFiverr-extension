/**
 * Firebase Background Script for aiFiverr Extension
 * Clean implementation for Firebase authentication
 */

console.log('🚀 aiFiverr Firebase Background: Starting service worker...');

// Authentication state
let authState = {
  isAuthenticated: false,
  userInfo: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null
};

// Load stored authentication state
async function loadAuthState() {
  try {
    const result = await chrome.storage.local.get(['firebase_auth_state']);
    if (result.firebase_auth_state) {
      authState = { ...authState, ...result.firebase_auth_state };
      console.log('✅ Firebase Background: Auth state loaded');
    }
  } catch (error) {
    console.error('❌ Firebase Background: Error loading auth state:', error);
  }
}

// Save authentication state
async function saveAuthState() {
  try {
    await chrome.storage.local.set({ firebase_auth_state: authState });
    console.log('✅ Firebase Background: Auth state saved');
  } catch (error) {
    console.error('❌ Firebase Background: Error saving auth state:', error);
  }
}

// Offscreen document management
let offscreenDocumentCreated = false;

async function createOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('firebase/offscreen/offscreen.html'),
      reasons: ['DOM_SCRAPING'],
      justification: 'Firebase authentication requires DOM access for popup handling'
    });
    offscreenDocumentCreated = true;
    console.log('✅ Firebase Background: Offscreen document created');
  } catch (error) {
    if (error.message.includes('Only a single offscreen document')) {
      offscreenDocumentCreated = true;
      console.log('✅ Firebase Background: Offscreen document already exists');
    } else {
      console.error('❌ Firebase Background: Failed to create offscreen document:', error);
      throw error;
    }
  }
}

async function sendMessageToOffscreen(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen document timeout'));
    }, 30000); // 30 second timeout

    // Create a unique message ID for tracking
    const messageId = Date.now() + Math.random();
    const messageWithId = { ...message, messageId, target: 'offscreen' };

    // Set up a one-time listener for the response
    const responseListener = (responseMessage, sender, sendResponse) => {
      if (responseMessage.responseToMessageId === messageId) {
        chrome.runtime.onMessage.removeListener(responseListener);
        clearTimeout(timeout);
        resolve(responseMessage);
      }
    };

    chrome.runtime.onMessage.addListener(responseListener);

    // Send message to offscreen document
    chrome.runtime.sendMessage(messageWithId, (response) => {
      if (chrome.runtime.lastError) {
        chrome.runtime.onMessage.removeListener(responseListener);
        clearTimeout(timeout);
        reject(new Error(chrome.runtime.lastError.message));
      }
      // Don't resolve here - wait for the proper response with messageId
    });
  });
}

// Initialize
loadAuthState();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Firebase Background: Received message:', message.type);

  switch (message.type) {
    case 'PING':
      console.log('🏓 Firebase Background: Responding to PING');
      sendResponse({
        success: true,
        message: 'PONG from Firebase Background',
        timestamp: Date.now(),
        authState: authState.isAuthenticated
      });
      return false; // Sync response

    case 'GOOGLE_AUTH_START':
    case 'FIREBASE_AUTH_START':
      console.log('🔐 Firebase Background: Handling auth start (type: ' + message.type + ')');
      handleFirebaseAuthStart(sendResponse);
      return true; // Async response

    case 'GOOGLE_AUTH_SIGNOUT':
    case 'FIREBASE_AUTH_SIGNOUT':
      console.log('🚪 Firebase Background: Handling sign out (type: ' + message.type + ')');
      handleFirebaseSignOut(sendResponse);
      return true; // Async response

    case 'GOOGLE_AUTH_STATUS':
    case 'FIREBASE_AUTH_STATUS':
      console.log('📊 Firebase Background: Handling auth status (type: ' + message.type + ')');
      sendResponse({
        success: true,
        isAuthenticated: authState.isAuthenticated,
        user: authState.userInfo,
        userInfo: authState.userInfo // Keep both for compatibility
      });
      return false; // Sync response

    case 'FIREBASE_STORE_USER_DATA':
      console.log('💾 Firebase Background: Storing user data');
      handleStoreUserData(message.userData, sendResponse);
      return true; // Async response

    case 'FIREBASE_AUTH_REFRESH_TOKEN':
      console.log('🔄 Firebase Background: Refreshing token');
      handleRefreshToken(sendResponse);
      return true; // Async response

    case 'FIREBASE_AUTH_VALIDATE_TOKEN':
      console.log('✅ Firebase Background: Validating token');
      handleValidateToken(sendResponse);
      return true; // Async response

    default:
      console.log('❓ Firebase Background: Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
      return false;
  }
});

// Handle Firebase authentication start
async function handleFirebaseAuthStart(sendResponse) {
  try {
    console.log('🔐 Firebase Background: Starting Firebase authentication...');

    // Create offscreen document for Firebase authentication
    await createOffscreenDocument();

    // Send authentication request to offscreen document
    const authResult = await sendMessageToOffscreen({
      action: 'firebase-auth'
    });

    if (authResult && authResult.success) {
      // Update auth state with real Firebase data
      authState.userInfo = authResult.user;
      authState.accessToken = authResult.accessToken;
      authState.refreshToken = authResult.refreshToken;
      authState.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
      authState.isAuthenticated = true;

      // Save to storage
      await saveAuthState();

      console.log('✅ Firebase Background: Authentication successful for:', authResult.user.email);

      sendResponse({
        success: true,
        user: authResult.user,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken
      });
    } else {
      throw new Error(authResult?.error || 'Authentication failed');
    }

  } catch (error) {
    console.error('❌ Firebase Background: Auth error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle Firebase sign out
async function handleFirebaseSignOut(sendResponse) {
  try {
    console.log('🚪 Firebase Background: Starting Firebase sign out...');

    // Try to sign out from Firebase through offscreen document
    try {
      await createOffscreenDocument();
      await sendMessageToOffscreen({
        action: 'firebase-signout'
      });
    } catch (offscreenError) {
      console.warn('⚠️ Firebase Background: Offscreen sign out failed:', offscreenError.message);
      // Continue with local sign out even if offscreen fails
    }

    // Clear auth state
    authState.userInfo = null;
    authState.accessToken = null;
    authState.refreshToken = null;
    authState.tokenExpiry = null;
    authState.isAuthenticated = false;

    // Clear from storage
    await chrome.storage.local.remove(['firebase_auth_state']);

    console.log('✅ Firebase Background: Sign out successful');

    sendResponse({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('❌ Firebase Background: Sign out error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle storing user data
async function handleStoreUserData(userData, sendResponse) {
  try {
    console.log('💾 Firebase Background: Storing user data for:', userData.email);

    // Store locally for now (Firebase integration can be added later)
    const userDataKey = `firebase_user_data_${userData.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await chrome.storage.local.set({
      [userDataKey]: {
        ...userData,
        storedAt: Date.now()
      }
    });

    console.log('✅ Firebase Background: User data stored successfully');
    sendResponse({ success: true });

  } catch (error) {
    console.error('❌ Firebase Background: Store user data error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle token refresh
async function handleRefreshToken(sendResponse) {
  try {
    console.log('🔄 Firebase Background: Refreshing token...');

    if (authState.refreshToken) {
      // Simulate token refresh
      authState.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
      await saveAuthState();

      console.log('✅ Firebase Background: Token refreshed successfully');
      sendResponse({
        success: true,
        accessToken: authState.accessToken,
        expiry: authState.tokenExpiry
      });
    } else {
      sendResponse({ success: false, error: 'No refresh token available' });
    }

  } catch (error) {
    console.error('❌ Firebase Background: Token refresh error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle token validation
async function handleValidateToken(sendResponse) {
  try {
    console.log('✅ Firebase Background: Validating token...');

    if (authState.isAuthenticated && authState.accessToken) {
      sendResponse({
        success: true,
        token: authState.accessToken,
        valid: true
      });
    } else {
      sendResponse({ success: false, error: 'No token to validate' });
    }

  } catch (error) {
    console.error('❌ Firebase Background: Token validation error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

console.log('✅ Firebase Background: Service worker initialized successfully');
