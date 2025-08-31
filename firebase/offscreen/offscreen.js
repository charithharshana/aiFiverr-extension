/**
 * Offscreen Document for Firebase Authentication
 * Handles Firebase authentication popup in iframe for cross-browser compatibility
 */

// Firebase hosting URL - Updated to use the correct ai-fiverr project
// Using .firebaseapp.com domain for better OAuth compatibility
const FIREBASE_AUTH_URL = 'https://ai-fiverr.firebaseapp.com/auth.html';

let iframe;
let statusElement;

// Initialize offscreen document
function init() {
  console.log('aiFiverr Offscreen: Initializing Firebase auth offscreen document');

  statusElement = document.getElementById('status');
  iframe = document.getElementById('authFrame');

  // Set up iframe with better error handling
  iframe.onload = () => {
    console.log('aiFiverr Offscreen: Auth iframe loaded successfully');
    updateStatus('Authentication service ready', 'success');
  };

  iframe.onerror = (error) => {
    console.error('aiFiverr Offscreen: Auth iframe failed to load:', error);
    updateStatus('Failed to load authentication service', 'error');
  };

  // Add timeout for iframe loading
  const iframeTimeout = setTimeout(() => {
    if (!iframe.contentDocument || iframe.contentDocument.readyState !== 'complete') {
      console.warn('aiFiverr Offscreen: Auth iframe loading timeout');
      updateStatus('Authentication service loading slowly...', 'loading');
    }
  }, 5000);

  iframe.onload = () => {
    clearTimeout(iframeTimeout);
    console.log('aiFiverr Offscreen: Auth iframe loaded successfully');
    updateStatus('Authentication service ready', 'success');
  };

  iframe.src = FIREBASE_AUTH_URL;

  // Listen for messages from the iframe
  window.addEventListener('message', handleIframeMessage);

  // Listen for messages from the extension (background script)
  // For offscreen documents, we need to listen for messages differently
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(handleExtensionMessage);
  }

  // Also listen for direct messages from background script
  if (chrome.offscreen && chrome.offscreen.onMessage) {
    chrome.offscreen.onMessage.addListener(handleExtensionMessage);
  }

  updateStatus('Initializing authentication service...', 'loading');
}

/**
 * Handle messages from the extension (background script)
 */
function handleExtensionMessage(message, sender, sendResponse) {
  console.log('aiFiverr Offscreen: Received message:', message);

  // Filter messages intended for offscreen document
  if (message.target !== 'offscreen') {
    return false;
  }

  try {
    if (message.action === 'firebase-auth') {
      console.log('aiFiverr Offscreen: Handling Firebase auth request');
      handleFirebaseAuth(sendResponse);
      return true; // Indicates async response
    } else if (message.action === 'firebase-signout') {
      console.log('aiFiverr Offscreen: Handling Firebase signout request');
      handleFirebaseSignOut(sendResponse);
      return true; // Indicates async response
    } else {
      console.warn('aiFiverr Offscreen: Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action: ' + message.action });
      return false;
    }
  } catch (error) {
    console.error('aiFiverr Offscreen: Error handling message:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
}

/**
 * Handle Firebase authentication request
 */
function handleFirebaseAuth(sendResponse) {
  console.log('aiFiverr Offscreen: Starting Firebase authentication');
  updateStatus('Starting authentication...', 'loading');

  // Prevent multiple simultaneous authentication attempts
  if (window.authInProgress) {
    console.warn('aiFiverr Offscreen: Authentication already in progress');
    sendResponse({
      success: false,
      error: 'Authentication already in progress'
    });
    return;
  }

  window.authInProgress = true;

  // Add timeout for authentication process
  const authTimeout = setTimeout(() => {
    console.error('aiFiverr Offscreen: Authentication timeout after 45 seconds');
    updateStatus('Authentication timeout - please try again', 'error');
    cleanup();
    sendResponse({
      success: false,
      error: 'Authentication timeout after 45 seconds. Please try again.'
    });
  }, 45000); // Reduced from 60s to 45s

  // Cleanup function to prevent memory leaks
  function cleanup() {
    window.authInProgress = false;
    clearTimeout(authTimeout);
    window.removeEventListener('message', handleAuthResponse);
  }

  // Set up message listener for iframe response
  function handleAuthResponse(event) {
    try {
      // Validate event origin for security
      if (event.origin !== new URL(FIREBASE_AUTH_URL).origin) {
        console.warn('aiFiverr Offscreen: Ignoring message from unauthorized origin:', event.origin);
        return;
      }

      console.log('aiFiverr Offscreen: Received auth response from iframe');

      // Parse the response data
      let data;
      if (typeof event.data === 'string') {
        // Handle JSON string responses
        if (event.data.startsWith('!_{')) {
          // Ignore Firebase internal messages
          return;
        }
        try {
          data = JSON.parse(event.data);
        } catch (parseError) {
          console.warn('aiFiverr Offscreen: Failed to parse response data:', event.data);
          return;
        }
      } else {
        data = event.data;
      }

      // Only process authentication responses
      if (!data || typeof data !== 'object' || !data.hasOwnProperty('success')) {
        return;
      }

      // Clear timeout and remove event listener
      cleanup();

      if (data.success) {
        console.log('aiFiverr Offscreen: Authentication successful');
        console.log('aiFiverr Offscreen: Received comprehensive user data:', {
          user: data.user,
          additionalUserInfo: data.additionalUserInfo
        });
        updateStatus('Authentication successful!', 'success');

        // Send comprehensive response back to extension
        sendResponse({
          success: true,
          user: data.user,
          additionalUserInfo: data.additionalUserInfo,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        });
      } else {
        console.error('aiFiverr Offscreen: Authentication failed:', data.error);
        updateStatus('Authentication failed: ' + (data.error || 'Unknown error'), 'error');
        
        // Send error response back to extension
        sendResponse({
          success: false,
          error: data.error || 'Authentication failed'
        });
      }

    } catch (error) {
      console.error('aiFiverr Offscreen: Error parsing auth response:', error);
      updateStatus('Error processing authentication response', 'error');

      clearTimeout(authTimeout);
      window.removeEventListener('message', handleAuthResponse);
      sendResponse({
        success: false,
        error: 'Failed to process authentication response'
      });
    }
  }

  // Add the message listener
  window.addEventListener('message', handleAuthResponse);

  // Send authentication request to iframe with improved timing
  const sendAuthRequest = () => {
    try {
      if (!iframe || !iframe.contentWindow) {
        throw new Error('Iframe not ready');
      }

      console.log('aiFiverr Offscreen: Sending auth request to iframe');
      iframe.contentWindow.postMessage(
        { action: 'startAuth' },
        new URL(FIREBASE_AUTH_URL).origin
      );
    } catch (error) {
      console.error('aiFiverr Offscreen: Failed to send auth message to iframe:', error);
      updateStatus('Failed to start authentication', 'error');

      cleanup();
      sendResponse({
        success: false,
        error: 'Failed to communicate with authentication service'
      });
    }
  };

  // Improved iframe readiness detection
  const waitForIframeReady = () => {
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      console.log('aiFiverr Offscreen: Iframe ready, sending auth request');
      sendAuthRequest();
    } else {
      console.log('aiFiverr Offscreen: Waiting for iframe to load...');
      setTimeout(waitForIframeReady, 500);
    }
  };

  // Start waiting for iframe to be ready
  waitForIframeReady();
}

/**
 * Handle Firebase sign out request
 */
function handleFirebaseSignOut(sendResponse) {
  console.log('aiFiverr Offscreen: Starting Firebase sign out');
  updateStatus('Signing out...', 'loading');

  // Set up message listener for iframe response
  function handleSignOutResponse(event) {
    try {
      let data;
      if (typeof event.data === 'string') {
        if (event.data.startsWith('!_{')) {
          return;
        }
        data = JSON.parse(event.data);
      } else {
        data = event.data;
      }

      window.removeEventListener('message', handleSignOutResponse);

      if (data.success) {
        console.log('aiFiverr Offscreen: Sign out successful');
        updateStatus('Signed out successfully', 'success');
        sendResponse({ success: true });
      } else {
        console.error('aiFiverr Offscreen: Sign out failed:', data.error);
        updateStatus('Sign out failed', 'error');
        sendResponse({ success: false, error: data.error });
      }

    } catch (error) {
      console.error('aiFiverr Offscreen: Error parsing sign out response:', error);
      window.removeEventListener('message', handleSignOutResponse);
      sendResponse({ success: false, error: 'Failed to process sign out response' });
    }
  }

  // Add the message listener
  window.addEventListener('message', handleSignOutResponse);

  // Send sign out request to iframe
  try {
    iframe.contentWindow.postMessage(
      { action: 'signOut' }, 
      new URL(FIREBASE_AUTH_URL).origin
    );
  } catch (error) {
    console.error('aiFiverr Offscreen: Failed to send sign out message to iframe:', error);
    updateStatus('Failed to sign out', 'error');
    
    window.removeEventListener('message', handleSignOutResponse);
    sendResponse({
      success: false,
      error: 'Failed to communicate with authentication service'
    });
  }
}

/**
 * Handle messages from the iframe
 */
function handleIframeMessage(event) {
  // Verify origin for security
  const allowedOrigin = new URL(FIREBASE_AUTH_URL).origin;
  if (event.origin !== allowedOrigin) {
    console.warn('aiFiverr Offscreen: Ignoring message from unauthorized origin:', event.origin);
    return;
  }

  console.log('aiFiverr Offscreen: Received message from iframe:', event.data);
  
  // Messages from iframe are handled by specific auth/signout handlers
  // This is just for logging and debugging
}

/**
 * Update status display
 */
function updateStatus(message, type = 'loading') {
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
  }
  console.log(`aiFiverr Offscreen Status (${type}):`, message);
}

/**
 * Handle iframe load errors
 */
function handleIframeError() {
  console.error('aiFiverr Offscreen: Failed to load Firebase auth iframe');
  updateStatus('Failed to load authentication service', 'error');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle iframe load error
iframe?.addEventListener('error', handleIframeError);
