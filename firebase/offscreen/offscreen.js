/**
 * Offscreen Document for Firebase Authentication
 * Handles Firebase authentication popup in iframe for cross-browser compatibility
 */

// Firebase hosting URL - Updated to use the correct ai-fiverr project
const FIREBASE_AUTH_URL = 'https://ai-fiverr.web.app/auth.html';

let iframe;
let statusElement;

// Initialize offscreen document
function init() {
  console.log('aiFiverr Offscreen: Initializing Firebase auth offscreen document');

  statusElement = document.getElementById('status');
  iframe = document.getElementById('authFrame');

  // Set up iframe
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

  updateStatus('Ready for authentication', 'loading');
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

  // Create a response function that includes the message ID
  const responseWithId = (response) => {
    const responseMessage = {
      ...response,
      responseToMessageId: message.messageId
    };

    // Send response back to background script
    chrome.runtime.sendMessage(responseMessage);
  };

  if (message.action === 'firebase-auth') {
    handleFirebaseAuth(responseWithId);
    return true; // Indicates async response
  } else if (message.action === 'firebase-signout') {
    handleFirebaseSignOut(responseWithId);
    return true;
  }

  return false;
}

/**
 * Handle Firebase authentication request
 */
function handleFirebaseAuth(sendResponse) {
  console.log('aiFiverr Offscreen: Starting Firebase authentication');
  updateStatus('Starting authentication...', 'loading');

  // Set up message listener for iframe response
  function handleAuthResponse(event) {
    try {
      console.log('aiFiverr Offscreen: Received auth response from iframe');

      // Parse the response data
      let data;
      if (typeof event.data === 'string') {
        // Handle JSON string responses
        if (event.data.startsWith('!_{')) {
          // Ignore Firebase internal messages
          return;
        }
        data = JSON.parse(event.data);
      } else {
        data = event.data;
      }

      // Remove the event listener
      window.removeEventListener('message', handleAuthResponse);

      if (data.success) {
        console.log('aiFiverr Offscreen: Authentication successful');
        updateStatus('Authentication successful!', 'success');

        // Send success response back to extension
        sendResponse({
          success: true,
          user: data.user,
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

      window.removeEventListener('message', handleAuthResponse);
      sendResponse({
        success: false,
        error: 'Failed to process authentication response'
      });
    }
  }

  // Add the message listener
  window.addEventListener('message', handleAuthResponse);

  // Send authentication request to iframe
  try {
    iframe.contentWindow.postMessage(
      { action: 'startAuth' },
      new URL(FIREBASE_AUTH_URL).origin
    );
  } catch (error) {
    console.error('aiFiverr Offscreen: Failed to send auth message to iframe:', error);
    updateStatus('Failed to start authentication', 'error');

    window.removeEventListener('message', handleAuthResponse);
    sendResponse({
      success: false,
      error: 'Failed to communicate with authentication service'
    });
  }
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
  }
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
