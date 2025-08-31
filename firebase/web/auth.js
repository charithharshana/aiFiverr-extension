/**
 * Firebase Authentication Web Page
 * This page runs in an iframe within the offscreen document
 * Handles Firebase authentication popup and communicates results back to extension
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Firebase configuration - Developer's project configuration
// Firebase client-side API keys are public and meant to be visible
// Security is handled by Firebase Authentication rules
const firebaseConfig = {
  apiKey: "AIzaSyCelf-I9gafjAtydLL3_5n6z-hhdoeQn5A",
  authDomain: "ai-fiverr.firebaseapp.com",
  projectId: "ai-fiverr",
  storageBucket: "ai-fiverr.firebasestorage.app",
  messagingSenderId: "423530712122",
  appId: "1:423530712122:web:b3e7f12ee346031371b903",
  measurementId: "G-NN00R02JB9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google Auth Provider - Updated scopes to resolve incremental authorization issue
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
// Removed spreadsheets scope - using Firebase instead of Google Sheets
// provider.addScope('https://www.googleapis.com/auth/spreadsheets');
// Changed to more restrictive Drive scope to resolve verification issues
provider.addScope('https://www.googleapis.com/auth/drive.file'); // Only files created by the app

// Force account selection to avoid cached authentication issues
provider.setCustomParameters({
  prompt: 'select_account'
});

// Get reference to parent frame for postMessage
const PARENT_FRAME = document.location.ancestorOrigins?.[0] || window.parent.location.origin;

// DOM elements
let statusElement;
let signInButton;
let signOutButton;

/**
 * Initialize the authentication page
 */
function init() {
  console.log('aiFiverr Firebase Web Auth: Initializing...');
  
  statusElement = document.getElementById('status');
  signInButton = document.getElementById('signInButton');
  signOutButton = document.getElementById('signOutButton');

  // Set up event listeners
  signInButton?.addEventListener('click', handleSignIn);
  signOutButton?.addEventListener('click', handleSignOut);

  // Listen for messages from parent (offscreen document)
  window.addEventListener('message', handleParentMessage);

  // Monitor auth state changes
  onAuthStateChanged(auth, (user) => {
    console.log('aiFiverr Firebase Web Auth: Auth state changed:', !!user);
    updateUI(user);
  });

  updateStatus('Ready for authentication', 'loading');
  console.log('aiFiverr Firebase Web Auth: Initialization complete');
}

/**
 * Handle messages from parent frame (offscreen document)
 */
function handleParentMessage(event) {
  console.log('aiFiverr Firebase Web Auth: Received message from parent:', event.data);

  if (event.data.action === 'startAuth') {
    handleSignIn();
  } else if (event.data.action === 'signOut') {
    handleSignOut();
  }
}

/**
 * Handle Google sign in
 */
async function handleSignIn() {
  try {
    console.log('aiFiverr Firebase Web Auth: Starting sign in...');
    updateStatus('Signing in with Google...', 'loading');

    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential.accessToken;

    console.log('aiFiverr Firebase Web Auth: Sign in successful:', user.email);
    console.log('aiFiverr Firebase Web Auth: Full result object:', {
      user: user,
      credential: credential,
      additionalUserInfo: result.additionalUserInfo
    });
    updateStatus('Sign in successful!', 'success');

    // Extract comprehensive user data including OAuth profile
    const comprehensiveUserData = {
      // Core Firebase user data
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,

      // Account metadata
      creationTime: user.metadata?.creationTime,
      lastSignInTime: user.metadata?.lastSignInTime,

      // Provider information
      providerId: user.providerId,
      providerData: user.providerData || [],

      // Token information
      refreshToken: user.refreshToken
    };

    // Extract additional OAuth profile data if available
    let additionalUserInfo = null;
    if (result.additionalUserInfo) {
      additionalUserInfo = {
        providerId: result.additionalUserInfo.providerId,
        isNewUser: result.additionalUserInfo.isNewUser,
        profile: result.additionalUserInfo.profile || {}
      };

      console.log('aiFiverr Firebase Web Auth: Additional user info:', additionalUserInfo);
    }

    // Send comprehensive response to parent
    sendResponseToParent({
      success: true,
      user: comprehensiveUserData,
      additionalUserInfo: additionalUserInfo,
      accessToken: accessToken,
      refreshToken: user.refreshToken
    });

  } catch (error) {
    console.error('aiFiverr Firebase Web Auth: Sign in failed:', error);
    
    let errorMessage = 'Sign in failed';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign in cancelled by user';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup blocked by browser';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Google sign in not enabled';
    } else {
      errorMessage = error.message || 'Unknown error occurred';
    }

    updateStatus(errorMessage, 'error');

    // Send error response to parent
    sendResponseToParent({
      success: false,
      error: errorMessage,
      code: error.code
    });
  }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
  try {
    console.log('aiFiverr Firebase Web Auth: Starting sign out...');
    updateStatus('Signing out...', 'loading');

    await signOut(auth);

    console.log('aiFiverr Firebase Web Auth: Sign out successful');
    updateStatus('Signed out successfully', 'success');

    // Send success response to parent
    sendResponseToParent({
      success: true,
      action: 'signOut'
    });

  } catch (error) {
    console.error('aiFiverr Firebase Web Auth: Sign out failed:', error);
    updateStatus('Sign out failed: ' + error.message, 'error');

    // Send error response to parent
    sendResponseToParent({
      success: false,
      error: error.message,
      action: 'signOut'
    });
  }
}

/**
 * Send response to parent frame
 */
function sendResponseToParent(data) {
  try {
    console.log('aiFiverr Firebase Web Auth: Sending response to parent:', data);
    window.parent.postMessage(JSON.stringify(data), PARENT_FRAME);
  } catch (error) {
    console.error('aiFiverr Firebase Web Auth: Failed to send response to parent:', error);
  }
}

/**
 * Update status display
 */
function updateStatus(message, type = 'loading') {
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
  }
  console.log(`aiFiverr Firebase Web Auth Status (${type}):`, message);
}

/**
 * Update UI based on authentication state
 */
function updateUI(user) {
  if (user) {
    // User is signed in
    if (signInButton) signInButton.style.display = 'none';
    if (signOutButton) signOutButton.style.display = 'inline-block';
    updateStatus(`Signed in as ${user.email}`, 'success');
  } else {
    // User is signed out
    if (signInButton) signInButton.style.display = 'inline-block';
    if (signOutButton) signOutButton.style.display = 'none';
    updateStatus('Ready to sign in', 'loading');
  }
}

/**
 * Handle page errors
 */
window.addEventListener('error', (event) => {
  console.error('aiFiverr Firebase Web Auth: Page error:', event.error);
  updateStatus('Authentication service error', 'error');
  
  sendResponseToParent({
    success: false,
    error: 'Authentication service error: ' + event.error.message
  });
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
