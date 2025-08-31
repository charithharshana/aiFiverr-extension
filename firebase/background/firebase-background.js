/**
 * Firebase Background Service Worker for aiFiverr Extension
 * Clean, robust Firebase authentication and Firestore integration
 * Handles all Firebase operations in the background
 */

// Import Firebase configuration
importScripts('../firebase-config.js');

// Authentication state
let authState = {
  isAuthenticated: false,
  currentUser: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null
};

// Firebase app instance
let firebaseApp = null;
let firebaseAuth = null;
let firebaseFirestore = null;

console.log('🚀 Firebase Background: Service worker starting...');

/**
 * Initialize Firebase services
 */
async function initializeFirebase() {
  try {
    if (firebaseApp) {
      return; // Already initialized
    }

    console.log('🔥 Firebase Background: Initializing Firebase services...');

    // Get Firebase configuration
    const config = self.firebaseConfigManager.getConfig();

    // Import Firebase modules dynamically
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } = 
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getFirestore, doc, setDoc, getDoc, updateDoc } = 
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

    // Initialize Firebase app
    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseFirestore = getFirestore(firebaseApp);

    // Set up Google Auth Provider
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    // Store provider for later use
    self.googleAuthProvider = provider;

    // Monitor auth state changes
    onAuthStateChanged(firebaseAuth, (user) => {
      console.log('🔐 Firebase Background: Auth state changed:', !!user);
      if (user) {
        updateAuthState(user);
      } else {
        clearAuthState();
      }
    });

    console.log('✅ Firebase Background: Firebase services initialized successfully');

  } catch (error) {
    console.error('❌ Firebase Background: Firebase initialization failed:', error);
    throw error;
  }
}

/**
 * Update authentication state
 */
async function updateAuthState(user) {
  try {
    // Get access token
    const token = await user.getIdToken();
    
    authState = {
      isAuthenticated: true,
      currentUser: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified
      },
      accessToken: token,
      refreshToken: user.refreshToken,
      tokenExpiry: Date.now() + (3600 * 1000) // 1 hour
    };

    // Save to storage
    await saveAuthState();
    console.log('✅ Firebase Background: Auth state updated');

  } catch (error) {
    console.error('❌ Firebase Background: Error updating auth state:', error);
  }
}

/**
 * Clear authentication state
 */
async function clearAuthState() {
  authState = {
    isAuthenticated: false,
    currentUser: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null
  };

  await saveAuthState();
  console.log('✅ Firebase Background: Auth state cleared');
}

/**
 * Save authentication state to storage
 */
async function saveAuthState() {
  try {
    await chrome.storage.local.set({ firebase_auth_state: authState });
  } catch (error) {
    console.error('❌ Firebase Background: Error saving auth state:', error);
  }
}

/**
 * Load authentication state from storage
 */
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

/**
 * Handle Firebase authentication start
 */
async function handleFirebaseAuthStart(sendResponse) {
  try {
    console.log('🔐 Firebase Background: Starting Firebase authentication...');

    // Ensure Firebase is initialized
    await initializeFirebase();

    // Create a new tab for authentication
    const authTab = await chrome.tabs.create({
      url: 'about:blank',
      active: false
    });

    // Inject authentication script
    await chrome.scripting.executeScript({
      target: { tabId: authTab.id },
      func: performFirebaseAuth,
      args: [self.firebaseConfigManager.getConfig()]
    });

    // Listen for authentication result
    const authResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 60000); // 60 second timeout

      const messageListener = (message, sender) => {
        if (sender.tab?.id === authTab.id && message.type === 'FIREBASE_AUTH_RESULT') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(message.result);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
    });

    // Close the authentication tab
    await chrome.tabs.remove(authTab.id);

    if (authResult.success) {
      // Update auth state
      await updateAuthState(authResult.user);

      // Store user data in Firestore
      await storeUserDataInFirestore(authResult.user);

      sendResponse({
        success: true,
        user: authState.currentUser,
        accessToken: authState.accessToken,
        refreshToken: authState.refreshToken,
        tokenExpiry: authState.tokenExpiry
      });
    } else {
      throw new Error(authResult.error || 'Authentication failed');
    }

  } catch (error) {
    console.error('❌ Firebase Background: Authentication failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Function to be injected into authentication tab
 */
async function performFirebaseAuth(firebaseConfig) {
  try {
    // Import Firebase modules
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getAuth, signInWithPopup, GoogleAuthProvider } = 
      await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Set up Google Auth Provider
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    // Perform authentication
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Send result back to background script
    chrome.runtime.sendMessage({
      type: 'FIREBASE_AUTH_RESULT',
      result: {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        }
      }
    });

  } catch (error) {
    // Send error back to background script
    chrome.runtime.sendMessage({
      type: 'FIREBASE_AUTH_RESULT',
      result: {
        success: false,
        error: error.message
      }
    });
  }
}

/**
 * Handle Firebase sign out
 */
async function handleFirebaseSignOut(sendResponse) {
  try {
    console.log('🚪 Firebase Background: Signing out...');

    // Ensure Firebase is initialized
    await initializeFirebase();

    // Sign out from Firebase
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }

    // Clear local auth state
    await clearAuthState();

    sendResponse({ success: true });

  } catch (error) {
    console.error('❌ Firebase Background: Sign out failed:', error);
    // Still clear local state
    await clearAuthState();
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Store user data in Firestore
 */
async function storeUserDataInFirestore(user) {
  try {
    console.log('💾 Firebase Background: Storing user data in Firestore...');

    if (!firebaseFirestore) {
      await initializeFirebase();
    }

    const userDoc = doc(firebaseFirestore, 'users', user.uid);
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if user exists
    const existingDoc = await getDoc(userDoc);
    if (existingDoc.exists()) {
      // Update existing user
      await updateDoc(userDoc, {
        ...userData,
        createdAt: existingDoc.data().createdAt // Preserve creation date
      });
    } else {
      // Create new user
      await setDoc(userDoc, {
        ...userData,
        createdAt: new Date().toISOString()
      });
    }

    console.log('✅ Firebase Background: User data stored successfully');

  } catch (error) {
    console.error('❌ Firebase Background: Error storing user data:', error);
    throw error;
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Firebase Background: Received message:', message.type);

  switch (message.type) {
    case 'FIREBASE_AUTH_START':
      handleFirebaseAuthStart(sendResponse);
      return true; // Async response

    case 'FIREBASE_AUTH_SIGNOUT':
      handleFirebaseSignOut(sendResponse);
      return true; // Async response

    case 'FIREBASE_STORE_USER_DATA':
      storeUserDataInFirestore(message.userData)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    default:
      console.warn('⚠️ Firebase Background: Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Firebase Background: Extension startup');
  await loadAuthState();
  await initializeFirebase();
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 Firebase Background: Extension installed');
  await loadAuthState();
  await initializeFirebase();
});

// Load auth state on script load
loadAuthState().then(() => {
  console.log('✅ Firebase Background: Service worker ready');
});
