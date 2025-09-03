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

// Selection counter state for badge
let selectionCounter = 0;

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
      reject(new Error('Offscreen document timeout after 30 seconds'));
    }, 30000);

    try {
      // Send message directly to offscreen document using chrome.runtime.sendMessage
      // The offscreen document will handle the message and respond via sendResponse
      chrome.runtime.sendMessage(
        { ...message, target: 'offscreen' },
        (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            console.error('aiFiverr Background: Offscreen message error:', chrome.runtime.lastError.message);
            reject(new Error(`Offscreen communication failed: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (!response) {
            reject(new Error('No response received from offscreen document'));
            return;
          }

          console.log('aiFiverr Background: Received offscreen response:', response);
          resolve(response);
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Badge management functions
async function updateBadge() {
  try {
    if (selectionCounter > 0) {
      await chrome.action.setBadgeText({ text: selectionCounter.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#1dbf73' }); // Fiverr green
      console.log('🔢 Firebase Background: Badge updated to:', selectionCounter);
    } else {
      await chrome.action.setBadgeText({ text: '' });
      console.log('🔢 Firebase Background: Badge cleared');
    }
  } catch (error) {
    console.error('❌ Firebase Background: Error updating badge:', error);
  }
}

async function incrementSelectionCounter() {
  selectionCounter++;
  await updateBadge();
  console.log('➕ Firebase Background: Selection counter incremented to:', selectionCounter);
}

async function resetSelectionCounter() {
  selectionCounter = 0;
  await updateBadge();
  console.log('🔄 Firebase Background: Selection counter reset');
}

// Extension lifecycle handlers
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Firebase Background: Extension startup - reloading auth state');
  await loadAuthState();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🔧 Firebase Background: Extension installed/updated - initializing auth state');
  await loadAuthState();

  if (details.reason === 'install') {
    console.log('🎉 Firebase Background: First time installation');
  } else if (details.reason === 'update') {
    console.log('🔄 Firebase Background: Extension updated from version', details.previousVersion);
  }
});

// Keep-alive mechanism to prevent service worker from going inactive
let keepAliveInterval;

function startKeepAlive() {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // Ping every 20 seconds to keep service worker alive
  keepAliveInterval = setInterval(() => {
    console.log('🔄 Firebase Background: Keep-alive ping');
  }, 20000);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive on initialization
startKeepAlive();

// Initialize on script load
loadAuthState();

// Enhanced message handler with better error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Firebase Background: Received message:', message.type);

  // Ensure we always send a response to prevent "Receiving end does not exist" errors
  let responseHandled = false;

  const safeResponse = (response) => {
    if (!responseHandled) {
      responseHandled = true;
      try {
        sendResponse(response);
      } catch (error) {
        console.warn('Firebase Background: Failed to send response:', error.message);
      }
    }
  };

  // Set a timeout to ensure response is sent even if handler fails
  const responseTimeout = setTimeout(() => {
    if (!responseHandled) {
      console.warn('Firebase Background: Handler timeout for message:', message.type);
      safeResponse({ success: false, error: 'Handler timeout' });
    }
  }, 30000); // 30 second timeout

  const clearResponseTimeout = () => {
    if (responseTimeout) {
      clearTimeout(responseTimeout);
    }
  };

  switch (message.type) {
    case 'PING':
      console.log('🏓 Firebase Background: Responding to PING');
      clearResponseTimeout();
      safeResponse({
        success: true,
        message: 'PONG from Firebase Background',
        timestamp: Date.now(),
        authState: authState.isAuthenticated
      });
      return false; // Sync response

    case 'GOOGLE_AUTH_START':
    case 'FIREBASE_AUTH_START':
      console.log('🔐 Firebase Background: Handling auth start (type: ' + message.type + ')');
      handleFirebaseAuthStart((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GOOGLE_AUTH_SIGNOUT':
    case 'FIREBASE_AUTH_SIGNOUT':
      console.log('🚪 Firebase Background: Handling sign out (type: ' + message.type + ')');
      handleFirebaseSignOut((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GOOGLE_AUTH_STATUS':
    case 'FIREBASE_AUTH_STATUS':
      console.log('📊 Firebase Background: Handling auth status (type: ' + message.type + ')');
      clearResponseTimeout();
      safeResponse({
        success: true,
        isAuthenticated: authState.isAuthenticated,
        user: authState.userInfo,
        userInfo: authState.userInfo // Keep both for compatibility
      });
      return false; // Sync response

    case 'FIREBASE_STORE_USER_DATA':
      console.log('💾 Firebase Background: Storing user data');
      handleStoreUserData(message.userData, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'FIREBASE_AUTH_REFRESH_TOKEN':
      console.log('🔄 Firebase Background: Refreshing token');
      handleRefreshToken((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'FIREBASE_AUTH_VALIDATE_TOKEN':
    case 'GOOGLE_AUTH_TOKEN':
      console.log('✅ Firebase Background: Validating token (type: ' + message.type + ')');
      handleValidateToken((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GET_KNOWLEDGE_BASE_FILES':
    case 'GET_DRIVE_FILES': // Legacy compatibility
      console.log('📁 Firebase Background: Getting knowledge base files (type: ' + message.type + ')');
      handleGetKnowledgeBaseFiles((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'UPLOAD_FILE_TO_GEMINI':
      console.log('📤 Firebase Background: Uploading file to Gemini');
      handleUploadFileToGemini(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GET_GEMINI_FILES':
      console.log('📋 Firebase Background: Getting Gemini files');
      handleGetGeminiFiles((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'UPLOAD_FILE_TO_DRIVE':
      console.log('📤 Firebase Background: Uploading file to Drive');
      handleUploadFileToDrive(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'SEARCH_DRIVE_FILES':
      console.log('🔍 Firebase Background: Searching Drive files');
      handleSearchDriveFiles(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'DELETE_DRIVE_FILE':
      console.log('🗑️ Firebase Background: Deleting Drive file');
      handleDeleteDriveFile(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GET_FILE_DETAILS':
      console.log('📄 Firebase Background: Getting file details');
      handleGetFileDetails(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'UPDATE_FILE_METADATA':
      console.log('✏️ Firebase Background: Updating file metadata');
      handleUpdateFileMetadata(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'DOWNLOAD_DRIVE_FILE':
      console.log('⬇️ Firebase Background: Downloading Drive file');
      handleDownloadDriveFile(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'UPDATE_API_KEYS':
      console.log('🔑 Firebase Background: Updating API keys');
      handleUpdateApiKeys(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'GET_API_KEY':
      console.log('🔑 Firebase Background: Getting API key');
      handleGetApiKey((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'INCREMENT_SELECTION_COUNTER':
      console.log('➕ Firebase Background: Incrementing selection counter');
      incrementSelectionCounter();
      clearResponseTimeout();
      safeResponse({ success: true, counter: selectionCounter });
      return false; // Sync response

    case 'RESET_SELECTION_COUNTER':
      console.log('🔄 Firebase Background: Resetting selection counter');
      resetSelectionCounter();
      clearResponseTimeout();
      safeResponse({ success: true, counter: selectionCounter });
      return false; // Sync response

    case 'GET_SELECTION_COUNTER':
      console.log('🔢 Firebase Background: Getting selection counter');
      clearResponseTimeout();
      safeResponse({ success: true, counter: selectionCounter });
      return false; // Sync response

    case 'LOAD_CUSTOM_PROMPTS_FROM_DRIVE':
      console.log('📥 Firebase Background: Loading custom prompts from Drive');
      handleLoadCustomPromptsFromDrive((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'SAVE_CUSTOM_PROMPTS_TO_DRIVE':
      console.log('📤 Firebase Background: Saving custom prompts to Drive');
      handleSaveCustomPromptsToDrive(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'LOAD_VARIABLES_FROM_DRIVE':
      console.log('📥 Firebase Background: Loading variables from Drive');
      handleLoadVariablesFromDrive((response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    case 'SAVE_VARIABLES_TO_DRIVE':
      console.log('📤 Firebase Background: Saving variables to Drive');
      handleSaveVariablesToDrive(message, (response) => {
        clearResponseTimeout();
        safeResponse(response);
      });
      return true; // Async response

    default:
      console.log('❓ Firebase Background: Unknown message type:', message.type);
      clearResponseTimeout();
      safeResponse({ success: false, error: 'Unknown message type: ' + message.type });
      return false;
  }
});

// Handle Firebase authentication start
async function handleFirebaseAuthStart(sendResponse) {
  try {
    console.log('🔐 Firebase Background: Starting Firebase authentication...');

    // Create offscreen document for Firebase authentication
    await createOffscreenDocument();

    // Add a small delay to ensure offscreen document is fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send authentication request to offscreen document with retry logic
    let authResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔐 Firebase Background: Authentication attempt ${attempt}/3`);

        authResult = await sendMessageToOffscreen({
          action: 'firebase-auth'
        });

        if (authResult && authResult.success) {
          break; // Success, exit retry loop
        } else {
          lastError = new Error(authResult?.error || 'Authentication failed');
          if (attempt < 3) {
            console.warn(`⚠️ Firebase Background: Auth attempt ${attempt} failed, retrying...`, lastError.message);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          console.warn(`⚠️ Firebase Background: Auth attempt ${attempt} failed with error, retrying...`, error.message);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }

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
      console.log('✅ Firebase Background: Additional user info available:', !!authResult.additionalUserInfo);

      sendResponse({
        success: true,
        user: authResult.user,
        additionalUserInfo: authResult.additionalUserInfo,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken
      });
    } else {
      throw lastError || new Error('Authentication failed after 3 attempts');
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

// Handle getting knowledge base files (merged Drive + Gemini data)
async function handleGetKnowledgeBaseFiles(sendResponse) {
  try {
    console.log('📁 Firebase Background: Getting merged knowledge base files...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to access knowledge base files');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    // Get aiFiverr folder ID
    const folderId = await ensureAiFiverrFolder();

    // Search for knowledge base files in the aiFiverr folder AND all its subfolders
    // This includes both legacy files in root folder and new organized structure files
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=properties has {key='aiFiverr_type' and value='knowledge_base'} and trashed=false&fields=files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,properties)`;

    console.log('🔍 Firebase Background: Searching for knowledge base files in all aiFiverr folders (root + subfolders)');

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
        console.error('❌ Firebase Background: Files search error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (response.status === 403) {
        throw new Error(`Cannot access knowledge base files (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (response.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else {
        throw new Error(`Failed to retrieve knowledge base files (${response.status}): ${errorDetails.error?.message || response.statusText}`);
      }
    }

    const data = await response.json();
    const driveFiles = data.files || [];

    console.log(`📁 Firebase Background: Found ${driveFiles.length} Google Drive files`);

    // Get Gemini files to merge with Drive files
    console.log('🔍 Firebase Background: Getting Gemini files for merging...');
    const geminiFiles = await getGeminiFiles();
    console.log(`🔍 Firebase Background: Found ${geminiFiles.length} Gemini files`);

    // Create map of Gemini files by display name for efficient lookup
    const geminiFileMap = new Map();
    geminiFiles.forEach(file => {
      geminiFileMap.set(file.displayName, file);
    });

    // Merge Drive files with Gemini data
    const mergedFiles = driveFiles.map(driveFile => {
      const geminiFile = geminiFileMap.get(driveFile.name);

      // Fix MIME type - never use application/octet-stream
      let safeMimeType = driveFile.mimeType;

      // If Google Drive returned application/octet-stream, try to detect proper MIME type
      if (safeMimeType === 'application/octet-stream') {
        const detectedType = getMimeTypeFromExtension(driveFile.name);
        safeMimeType = detectedType || 'text/plain';
        console.log(`📄 Firebase Background: Fixed MIME type for ${driveFile.name}: ${driveFile.mimeType} -> ${safeMimeType}`);
      }

      const mergedFile = {
        id: driveFile.id,
        name: driveFile.name,
        size: parseInt(driveFile.size) || 0,
        mimeType: safeMimeType,
        createdTime: driveFile.createdTime,
        modifiedTime: driveFile.modifiedTime,
        webViewLink: driveFile.webViewLink,
        uploadDate: driveFile.properties?.aiFiverr_upload_date,
        fileSize: driveFile.properties?.aiFiverr_file_size,
        tags: driveFile.properties?.aiFiverr_tags?.split(',') || [],
        source: 'google_drive',
        // Add Gemini data if available
        geminiName: geminiFile?.name,
        geminiUri: geminiFile?.uri,
        geminiState: geminiFile?.state,
        geminiMimeType: geminiFile?.mimeType,
        driveFileId: driveFile.id
      };

      return mergedFile;
    });

    console.log(`📁 Firebase Background: Merged ${mergedFiles.length} files`);
    console.log(`📁 Firebase Background: Files with geminiUri: ${mergedFiles.filter(f => f.geminiUri).length}`);

    sendResponse({
      success: true,
      files: mergedFiles,
      data: mergedFiles, // Also provide 'data' key for compatibility
      count: mergedFiles.length,
      message: `Retrieved ${mergedFiles.length} merged knowledge base files (${mergedFiles.filter(f => f.geminiUri).length} with Gemini URI)`
    });

  } catch (error) {
    // Reduce console spam for authentication errors on fresh installs
    if (error.message.includes('Authentication required')) {
      // Only log authentication errors if debugging is enabled
      if (window.aiFiverrDebug) {
        console.log('📁 Firebase Background: Authentication required for knowledge base files');
      }
    } else {
      console.error('❌ Firebase Background: Get knowledge base files error:', error);
    }
    sendResponse({ success: false, error: error.message });
  }
}

// Handle searching Drive files
async function handleSearchDriveFiles(message, sendResponse) {
  try {
    console.log('🔍 Firebase Background: Searching Drive files...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to search files');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { query = '' } = message;

    // Ensure aiFiverr folder exists (for folder structure validation)
    await ensureAiFiverrFolder();

    // Build search query to find files in all aiFiverr folders (root + subfolders)
    let searchQuery = `properties has {key='aiFiverr_type' and value='knowledge_base'} and trashed=false`;

    if (query.trim()) {
      // Add text search to the query
      searchQuery += ` and (name contains '${query.trim()}' or fullText contains '${query.trim()}')`;
    }

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,properties)`;

    console.log('🔍 Firebase Background: Search query:', searchQuery);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
        console.error('❌ Firebase Background: Search error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (response.status === 403) {
        throw new Error(`Cannot search files (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (response.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else {
        throw new Error(`Failed to search files (${response.status}): ${errorDetails.error?.message || response.statusText}`);
      }
    }

    const data = await response.json();
    const files = data.files || [];

    console.log(`🔍 Firebase Background: Search found ${files.length} files`);

    // Format files for the knowledge base
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      size: parseInt(file.size) || 0,
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      uploadDate: file.properties?.aiFiverr_upload_date,
      fileSize: file.properties?.aiFiverr_file_size,
      tags: file.properties?.aiFiverr_tags?.split(',') || [],
      source: 'google_drive'
    }));

    sendResponse({
      success: true,
      data: formattedFiles, // Use 'data' key for compatibility with popup
      files: formattedFiles, // Also provide 'files' key
      count: formattedFiles.length,
      query: query,
      message: `Found ${formattedFiles.length} files matching search criteria`
    });

  } catch (error) {
    console.error('❌ Firebase Background: Search Drive files error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle deleting Drive file
async function handleDeleteDriveFile(message, sendResponse) {
  try {
    console.log('🗑️ Firebase Background: Deleting Drive file...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to delete files');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { fileId } = message;

    if (!fileId) {
      throw new Error('File ID is required for deletion');
    }

    console.log('🗑️ Firebase Background: Deleting file with ID:', fileId);

    // First, try to delete from Gemini if it exists
    await deleteFileFromGemini(fileId);

    const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Firebase Background: Delete response status:', deleteResponse.status);

    if (!deleteResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await deleteResponse.json();
        console.error('❌ Firebase Background: Delete error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (deleteResponse.status === 403) {
        throw new Error(`Cannot delete file (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (deleteResponse.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else if (deleteResponse.status === 404) {
        throw new Error(`File not found (404): The file may have already been deleted or you don't have access to it.`);
      } else {
        throw new Error(`Failed to delete file (${deleteResponse.status}): ${errorDetails.error?.message || deleteResponse.statusText}`);
      }
    }

    console.log('✅ Firebase Background: File deleted successfully:', fileId);

    sendResponse({
      success: true,
      fileId: fileId,
      message: 'File deleted successfully',
      refreshRequired: true // Signal UI to refresh files list
    });

  } catch (error) {
    console.error('❌ Firebase Background: Delete Drive file error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting file details
async function handleGetFileDetails(message, sendResponse) {
  try {
    console.log('📄 Firebase Background: Getting file details...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to get file details');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { fileId } = message;

    if (!fileId) {
      throw new Error('File ID is required to get file details');
    }

    console.log('📄 Firebase Background: Getting details for file ID:', fileId);

    const detailsUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,mimeType,createdTime,modifiedTime,webViewLink,webContentLink,description,properties,parents`;

    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Firebase Background: File details response status:', detailsResponse.status);

    if (!detailsResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await detailsResponse.json();
        console.error('❌ Firebase Background: File details error:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (detailsResponse.status === 403) {
        throw new Error(`Cannot access file details (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (detailsResponse.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else if (detailsResponse.status === 404) {
        throw new Error(`File not found (404): The file may have been deleted or you don't have access to it.`);
      } else {
        throw new Error(`Failed to get file details (${detailsResponse.status}): ${errorDetails.error?.message || detailsResponse.statusText}`);
      }
    }

    const fileDetails = await detailsResponse.json();

    console.log('✅ Firebase Background: File details retrieved successfully:', fileDetails.name);

    // Format file details for the knowledge base
    const formattedDetails = {
      id: fileDetails.id,
      name: fileDetails.name,
      size: parseInt(fileDetails.size) || 0,
      mimeType: fileDetails.mimeType,
      createdTime: fileDetails.createdTime,
      modifiedTime: fileDetails.modifiedTime,
      webViewLink: fileDetails.webViewLink,
      webContentLink: fileDetails.webContentLink,
      description: fileDetails.description || '',
      uploadDate: fileDetails.properties?.aiFiverr_upload_date,
      fileSize: fileDetails.properties?.aiFiverr_file_size,
      tags: fileDetails.properties?.aiFiverr_tags?.split(',') || [],
      source: 'google_drive',
      parents: fileDetails.parents || []
    };

    sendResponse({
      success: true,
      data: formattedDetails,
      fileDetails: formattedDetails, // Also provide fileDetails key for compatibility
      message: 'File details retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Firebase Background: Get file details error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle updating file metadata
async function handleUpdateFileMetadata(message, sendResponse) {
  try {
    console.log('✏️ Firebase Background: Updating file metadata...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to update file metadata');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { fileId, metadata } = message;

    if (!fileId) {
      throw new Error('File ID is required to update metadata');
    }

    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Metadata object is required');
    }

    console.log('✏️ Firebase Background: Updating metadata for file ID:', fileId);
    console.log('📝 Firebase Background: New metadata:', metadata);

    // Prepare the update payload
    const updatePayload = {};

    // Handle basic metadata fields
    if (metadata.name) updatePayload.name = metadata.name;
    if (metadata.description !== undefined) updatePayload.description = metadata.description;

    // Handle custom properties (aiFiverr specific)
    if (metadata.tags || metadata.properties) {
      updatePayload.properties = {};

      // Preserve existing aiFiverr properties and add new ones
      if (metadata.tags && Array.isArray(metadata.tags)) {
        updatePayload.properties.aiFiverr_tags = metadata.tags.join(',');
      }

      if (metadata.properties && typeof metadata.properties === 'object') {
        Object.assign(updatePayload.properties, metadata.properties);
      }

      // Always update the modification date
      updatePayload.properties.aiFiverr_last_modified = new Date().toISOString();
    }

    console.log('📤 Firebase Background: Update payload:', updatePayload);

    const updateResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    console.log('📡 Firebase Background: Update response status:', updateResponse.status);

    if (!updateResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await updateResponse.json();
        console.error('❌ Firebase Background: Update error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (updateResponse.status === 403) {
        throw new Error(`Cannot update file metadata (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (updateResponse.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else if (updateResponse.status === 404) {
        throw new Error(`File not found (404): The file may have been deleted or you don't have access to it.`);
      } else {
        throw new Error(`Failed to update file metadata (${updateResponse.status}): ${errorDetails.error?.message || updateResponse.statusText}`);
      }
    }

    const updatedFile = await updateResponse.json();

    console.log('✅ Firebase Background: File metadata updated successfully:', updatedFile.name);

    sendResponse({
      success: true,
      data: updatedFile,
      fileId: fileId,
      message: 'File metadata updated successfully',
      refreshRequired: true // Signal UI to refresh files list
    });

  } catch (error) {
    console.error('❌ Firebase Background: Update file metadata error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle downloading Drive file
async function handleDownloadDriveFile(message, sendResponse) {
  try {
    console.log('⬇️ Firebase Background: Downloading Drive file...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required to download files');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { fileId } = message;

    if (!fileId) {
      throw new Error('File ID is required for download');
    }

    console.log('⬇️ Firebase Background: Downloading file with ID:', fileId);

    // First get file details to get the name and check if it exists
    const detailsResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!detailsResponse.ok) {
      if (detailsResponse.status === 404) {
        throw new Error('File not found. It may have been deleted or you don\'t have access to it.');
      }
      throw new Error(`Failed to get file details: ${detailsResponse.status}`);
    }

    const fileDetails = await detailsResponse.json();
    console.log('📄 Firebase Background: File details for download:', fileDetails.name);

    // Download the file content
    const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`
      }
    });

    console.log('📡 Firebase Background: Download response status:', downloadResponse.status);

    if (!downloadResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await downloadResponse.json();
        console.error('❌ Firebase Background: Download error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      if (downloadResponse.status === 403) {
        throw new Error(`Cannot download file (403): ${errorDetails.error?.message || 'Insufficient permissions'}. Please re-authorize the extension.`);
      } else if (downloadResponse.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else if (downloadResponse.status === 404) {
        throw new Error(`File not found (404): The file may have been deleted or you don't have access to it.`);
      } else {
        throw new Error(`Failed to download file (${downloadResponse.status}): ${errorDetails.error?.message || downloadResponse.statusText}`);
      }
    }

    // Convert response to blob and then to base64 for transfer
    const fileBlob = await downloadResponse.blob();
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 for message passing
    let base64String = '';
    const chunkSize = 1024;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64String += btoa(String.fromCharCode.apply(null, chunk));
    }

    console.log('✅ Firebase Background: File downloaded successfully:', fileDetails.name);

    sendResponse({
      success: true,
      fileId: fileId,
      fileName: fileDetails.name,
      mimeType: fileDetails.mimeType,
      size: fileDetails.size,
      data: base64String,
      message: 'File downloaded successfully'
    });

  } catch (error) {
    console.error('❌ Firebase Background: Download Drive file error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle file upload to Gemini
async function handleUploadFileToGemini(message, sendResponse) {
  try {
    console.log('📤 Firebase Background: Uploading file to Gemini...');

    const { file, displayName, enhanced = false } = message;

    if (!file) {
      throw new Error('File data is required');
    }

    // Get Gemini API key from storage
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key available. Please set your API key in settings.');
    }

    // Validate file type for Gemini - prioritize extension-based detection
    let mimeType = getMimeTypeFromExtension(file.name);

    // If extension-based detection fails, fall back to file.type
    if (!mimeType) {
      mimeType = file.type || 'text/plain';
    }

    // Never use application/octet-stream
    if (mimeType === 'application/octet-stream') {
      mimeType = 'text/plain';
    }

    if (!isSupportedGeminiFileType(mimeType)) {
      throw new Error(`File type '${mimeType}' is not supported by Gemini API. Supported types: text/plain, text/markdown, application/pdf, image/png, image/jpeg, etc.`);
    }

    // Check file size (2GB limit for Gemini)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      throw new Error('File size exceeds 2GB limit for Gemini API');
    }

    // Upload to Gemini
    const result = await uploadFileToGemini(file, displayName || file.name);

    console.log('✅ Firebase Background: File uploaded to Gemini successfully:', result.name);
    sendResponse({
      success: true,
      data: {
        name: result.name,
        displayName: result.displayName,
        uri: result.uri,
        state: result.state,
        sizeBytes: result.sizeBytes
      },
      message: 'File uploaded to Gemini successfully'
    });

  } catch (error) {
    console.error('❌ Firebase Background: Upload to Gemini error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting Gemini files
async function handleGetGeminiFiles(sendResponse) {
  try {
    console.log('📋 Firebase Background: Getting Gemini files...');

    // Get Gemini API key from storage
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      console.warn('⚠️ Firebase Background: No Gemini API key available');
      sendResponse({ success: true, data: [] }); // Return empty array instead of error
      return;
    }

    // Get files from Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const files = data.files || [];

    console.log(`✅ Firebase Background: Retrieved ${files.length} Gemini files`);
    sendResponse({
      success: true,
      data: files,
      message: `Retrieved ${files.length} Gemini files`
    });

  } catch (error) {
    console.error('❌ Firebase Background: Get Gemini files error:', error);
    sendResponse({ success: true, data: [] }); // Return empty array on error to avoid breaking UI
  }
}

// Delete file from Gemini API
async function deleteFileFromGemini(driveFileId) {
  try {
    console.log('🗑️ Firebase Background: Attempting to delete from Gemini for Drive file:', driveFileId);

    // Get Gemini API key
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      console.warn('⚠️ Firebase Background: No Gemini API key available for deletion');
      return; // Not an error - just skip Gemini deletion
    }

    // Get all Gemini files to find the one matching our Drive file
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ Firebase Background: Failed to list Gemini files for deletion');
      return; // Not critical - continue with Drive deletion
    }

    const data = await response.json();
    const geminiFiles = data.files || [];

    // Find Gemini file by display name (should match Drive file name)
    // We'll need to get the Drive file name first
    const driveFileDetails = await getDriveFileDetails(driveFileId);
    if (!driveFileDetails) {
      console.warn('⚠️ Firebase Background: Could not get Drive file details for Gemini deletion');
      return;
    }

    const matchingGeminiFile = geminiFiles.find(f => f.displayName === driveFileDetails.name);
    if (!matchingGeminiFile) {
      console.log('ℹ️ Firebase Background: No matching Gemini file found for deletion');
      return; // Not an error - file might not have been uploaded to Gemini
    }

    // Delete from Gemini
    const deleteResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${matchingGeminiFile.name}?key=${apiKey}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Firebase Background: File deleted from Gemini successfully:', matchingGeminiFile.name);
    } else {
      console.warn('⚠️ Firebase Background: Failed to delete from Gemini:', deleteResponse.status);
    }

  } catch (error) {
    console.warn('⚠️ Firebase Background: Error deleting from Gemini (non-critical):', error.message);
    // Don't throw - Gemini deletion failure shouldn't prevent Drive deletion
  }
}

// Get Drive file details for Gemini operations
async function getDriveFileDetails(fileId) {
  try {
    if (!authState.isAuthenticated || !authState.accessToken) {
      return null;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Firebase Background: Error getting Drive file details:', error);
    return null;
  }
}

// Handle file upload to Drive
async function handleUploadFileToDrive(message, sendResponse) {
  try {
    console.log('📤 Firebase Background: Uploading file to Drive...');
    console.log('📄 Firebase Background: Upload request details:', {
      fileName: message.fileName,
      fileType: message.file?.type,
      fileSize: message.file?.size,
      hasFileData: !!message.file?.data
    });

    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required for Drive upload');
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      throw new Error('Unable to obtain valid access token. Please sign out and sign in again.');
    }

    const { file, fileName, description = '', tags = [] } = message;

    if (!file || !fileName) {
      throw new Error('File data and fileName are required');
    }

    if (!file.name) {
      file.name = fileName; // Ensure file object has name property
    }

    // Validate file
    const validationResult = validateKnowledgeBaseFile(file);
    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    // Use the detected MIME type from validation
    let detectedMimeType = validationResult.detectedMimeType || file.type || 'text/plain';

    // Never use application/octet-stream
    if (detectedMimeType === 'application/octet-stream') {
      detectedMimeType = 'text/plain';
    }
    console.log(`📤 Firebase Background: Using MIME type '${detectedMimeType}' for file '${fileName}'`);

    // Determine appropriate folder based on file type using organized structure
    const folderPath = getFileTypeFolder(fileName, detectedMimeType);
    console.log(`📁 Firebase Background: File '${fileName}' will be uploaded to: ${folderPath}`);

    // Get the target folder ID for the organized structure
    const targetFolderId = await getFolderIdForPath(folderPath);

    // Enhanced metadata with knowledge base specific properties
    const metadata = {
      name: fileName,
      description: description || `aiFiverr Knowledge Base file uploaded on ${new Date().toISOString()}`,
      parents: [targetFolderId],
      properties: {
        'aiFiverr_type': 'knowledge_base',
        'aiFiverr_upload_date': new Date().toISOString(),
        'aiFiverr_file_size': file.size.toString(),
        'aiFiverr_mime_type': detectedMimeType,
        'aiFiverr_original_mime_type': file.type || 'unknown',
        'aiFiverr_tags': tags.join(','),
        'aiFiverr_folder_path': folderPath
      }
    };

    // Upload file to Google Drive with detected MIME type
    const result = await uploadFileToGoogleDrive(file, metadata, detectedMimeType);

    console.log('✅ Firebase Background: File uploaded successfully:', result.id);
    sendResponse({
      success: true,
      fileId: result.id,
      name: result.name,
      size: result.size,
      mimeType: result.mimeType,
      webViewLink: result.webViewLink,
      detectedMimeType: detectedMimeType,
      message: 'File uploaded to Google Drive successfully',
      refreshRequired: true // Signal UI to refresh files list
    });

  } catch (error) {
    console.error('❌ Firebase Background: Upload to Drive error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// File validation function for Google Drive uploads
function validateKnowledgeBaseFile(file) {
  const maxSize = 100 * 1024 * 1024; // 100MB limit for Drive storage

  // Check file size first
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (100MB)`
    };
  }

  // Get MIME type - use file.type if available, otherwise detect from extension
  let mimeType = file.type;
  if (!mimeType || mimeType === '') {
    mimeType = getMimeTypeFromExtension(file.name);
    console.log(`📄 Firebase Background: Detected MIME type for ${file.name}: ${mimeType}`);
  }

  // For Google Drive uploads, we're much more permissive since Google Drive supports most file types
  // We only block potentially dangerous or completely unsupported file types
  const blockedTypes = [
    'application/x-msdownload', // .exe files
    'application/x-executable',
    'application/x-msdos-program',
    'application/vnd.microsoft.portable-executable'
  ];

  const blockedExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js.exe'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

  // Check for blocked file types
  if (blockedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type '${mimeType}' is not allowed for security reasons`
    };
  }

  // Check for blocked extensions
  if (blockedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `File extension '${fileExtension}' is not allowed for security reasons`
    };
  }

  // If we get here, the file is acceptable for Google Drive upload
  console.log(`✅ Firebase Background: File validation passed for ${file.name} (${mimeType})`);
  return {
    valid: true,
    detectedMimeType: mimeType
  };
}

// Define organized folder structure
const folderStructure = {
  'knowledge-base': {
    'text': ['txt', 'md', 'docx', 'doc', 'rtf'],
    'video': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    'audio': ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'],
    'documents': ['pdf', 'ppt', 'pptx', 'xls', 'xlsx']
  },
  'chat': [] // For Fiverr conversation files
};

// Cache for subfolder IDs
let subfolderIds = {};

// Determine the appropriate folder for a file based on its type
function getFileTypeFolder(fileName, mimeType) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  // Check each category and subcategory
  for (const [categoryName, subcategories] of Object.entries(folderStructure)) {
    if (typeof subcategories === 'object' && !Array.isArray(subcategories)) {
      for (const [subcategoryName, extensions] of Object.entries(subcategories)) {
        if (extensions.includes(extension)) {
          return `${categoryName}/${subcategoryName}`;
        }
      }
    }
  }

  // Default to knowledge-base/documents for unknown types
  return 'knowledge-base/documents';
}

// Get folder ID for a specific file type path
async function getFolderIdForPath(folderPath) {
  const pathParts = folderPath.split('/');
  let currentFolderId = await ensureAiFiverrFolder();

  for (const folderName of pathParts) {
    currentFolderId = await ensureSubfolder(folderName, currentFolderId);
  }

  return currentFolderId;
}

// Ensure a subfolder exists within a parent folder
async function ensureSubfolder(folderName, parentFolderId) {
  try {
    const cacheKey = `${parentFolderId}/${folderName}`;

    // Check cache first
    if (subfolderIds[cacheKey]) {
      return subfolderIds[cacheKey];
    }

    // Search for existing subfolder
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Failed to search for subfolder: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      const folderId = searchData.files[0].id;
      subfolderIds[cacheKey] = folderId;
      return folderId;
    }

    // Create new subfolder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create subfolder: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    const folderId = createData.id;
    subfolderIds[cacheKey] = folderId;
    console.log(`📁 Firebase Background: Created subfolder '${folderName}':`, folderId);
    return folderId;

  } catch (error) {
    console.error(`❌ Firebase Background: Failed to ensure subfolder '${folderName}':`, error);
    throw error;
  }
}

// Ensure aiFiverr folder exists in Google Drive
async function ensureAiFiverrFolder() {
  try {
    console.log('📁 Firebase Background: Ensuring aiFiverr folder exists...');

    // Check authentication state
    if (!authState.isAuthenticated || !authState.accessToken) {
      throw new Error('Authentication required - no valid access token available');
    }

    console.log('🔐 Firebase Background: Using access token (length: ' + authState.accessToken.length + ')');

    const aiFiverrFolderName = 'aiFiverr';

    // Search for existing aiFiverr folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${aiFiverrFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    console.log('🔍 Firebase Background: Searching for folder with URL:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Firebase Background: Search response status:', searchResponse.status);

    if (!searchResponse.ok) {
      // Get detailed error information
      let errorDetails;
      try {
        errorDetails = await searchResponse.json();
        console.error('❌ Firebase Background: Search API error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      // Provide specific error messages based on status code
      if (searchResponse.status === 403) {
        const errorMessage = errorDetails.error?.message || 'Insufficient permissions';
        if (errorMessage.includes('insufficient') || errorMessage.includes('scope')) {
          throw new Error(`Google Drive API permission denied: ${errorMessage}. The extension may need to be re-authorized with updated permissions.`);
        } else {
          throw new Error(`Google Drive API access denied (403): ${errorMessage}. Please check your Google Drive API quotas and permissions.`);
        }
      } else if (searchResponse.status === 401) {
        throw new Error(`Authentication failed (401): ${errorDetails.error?.message || 'Invalid or expired access token'}. Please sign out and sign in again.`);
      } else {
        throw new Error(`Failed to search for aiFiverr folder (${searchResponse.status}): ${errorDetails.error?.message || searchResponse.statusText}`);
      }
    }

    const searchData = await searchResponse.json();
    console.log('📋 Firebase Background: Search results:', {
      filesFound: searchData.files?.length || 0,
      files: searchData.files?.map(f => ({ id: f.id, name: f.name })) || []
    });

    if (searchData.files && searchData.files.length > 0) {
      console.log('✅ Firebase Background: aiFiverr folder found:', searchData.files[0].id);
      return searchData.files[0].id;
    }

    // Create aiFiverr folder if it doesn't exist
    console.log('📁 Firebase Background: Creating aiFiverr folder...');

    const createPayload = {
      name: aiFiverrFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'aiFiverr Extension - Knowledge Base and Data Storage'
    };

    console.log('📤 Firebase Background: Create folder payload:', createPayload);

    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    console.log('📡 Firebase Background: Create response status:', createResponse.status);

    if (!createResponse.ok) {
      // Get detailed error information
      let errorDetails;
      try {
        errorDetails = await createResponse.json();
        console.error('❌ Firebase Background: Create API error details:', errorDetails);
      } catch (e) {
        errorDetails = { error: { message: 'Unable to parse error response' } };
      }

      // Provide specific error messages based on status code
      if (createResponse.status === 403) {
        const errorMessage = errorDetails.error?.message || 'Insufficient permissions';
        throw new Error(`Cannot create aiFiverr folder (403): ${errorMessage}. The extension needs full Google Drive access to create folders.`);
      } else if (createResponse.status === 401) {
        throw new Error(`Authentication failed during folder creation (401): ${errorDetails.error?.message || 'Invalid access token'}. Please sign out and sign in again.`);
      } else {
        throw new Error(`Failed to create aiFiverr folder (${createResponse.status}): ${errorDetails.error?.message || createResponse.statusText}`);
      }
    }

    const folderData = await createResponse.json();
    console.log('✅ Firebase Background: aiFiverr folder created successfully:', {
      id: folderData.id,
      name: folderData.name,
      mimeType: folderData.mimeType
    });
    return folderData.id;

  } catch (error) {
    console.error('❌ Firebase Background: Error managing aiFiverr folder:', error);
    throw error;
  }
}

// Upload file to Google Drive with organized folder structure
async function uploadFileToGoogleDrive(file, metadata, detectedMimeType) {
  try {
    console.log('📤 Firebase Background: Starting Google Drive upload with organized folders...');
    console.log('📄 Firebase Background: File details:', {
      name: file.name,
      originalType: file.type,
      detectedType: detectedMimeType,
      size: file.size
    });

    // Use detected MIME type or fallback to file.type, but never use application/octet-stream
    let mimeType = detectedMimeType || file.type || 'text/plain';

    // Never use application/octet-stream - always fall back to text/plain
    if (mimeType === 'application/octet-stream') {
      mimeType = 'text/plain';
    }

    // The metadata already contains the correct folder ID from the organized structure
    console.log(`📁 Firebase Background: Uploading to organized folder (ID: ${metadata.parents[0]})`);
    console.log(`📁 Firebase Background: Folder path: ${metadata.properties?.aiFiverr_folder_path || 'unknown'}`);

    // Validate that we have a valid folder ID
    if (!metadata.parents || !metadata.parents[0]) {
      throw new Error('No target folder ID specified in metadata');
    }

    // Convert file data to proper format
    let fileBlob;
    if (file.data) {
      // Handle base64 data
      const base64Data = file.data.split(',')[1] || file.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBlob = new Blob([bytes], { type: mimeType });
    } else if (file instanceof Blob) {
      fileBlob = file;
    } else {
      throw new Error('Invalid file format');
    }

    // Create form data for multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    let body = delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`;

    // Convert blob to array buffer and then to string
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    body += binaryString + close_delim;

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: body
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorData.error?.message || uploadResponse.statusText}`);
    }

    const result = await uploadResponse.json();
    console.log('✅ Firebase Background: File uploaded to Drive:', result.id);

    return {
      success: true,
      id: result.id,
      name: result.name,
      size: result.size,
      mimeType: result.mimeType,
      webViewLink: result.webViewLink,
      createdTime: result.createdTime
    };

  } catch (error) {
    console.error('❌ Firebase Background: Drive upload error:', error);
    throw error;
  }
}

// Get Gemini API key from storage
async function getGeminiApiKey() {
  try {
    // Try to get from apiKeys array first (current system)
    const result = await chrome.storage.local.get(['apiKeys', 'settings', 'gemini_api_key']);

    let apiKeys = result.apiKeys || [];

    // Fallback to settings if no keys found
    if (apiKeys.length === 0 && result.settings?.apiKeys) {
      apiKeys = result.settings.apiKeys;
    }

    // Return first available key if we have any
    if (apiKeys.length > 0) {
      console.log('✅ Firebase Background: Using API key from apiKeys array');
      return apiKeys[0];
    }

    // Legacy fallback to gemini_api_key
    if (result.gemini_api_key) {
      console.log('✅ Firebase Background: Using legacy gemini_api_key');
      return result.gemini_api_key;
    }

    console.warn('❌ Firebase Background: No Gemini API key found in storage');
    return null;
  } catch (error) {
    console.error('❌ Firebase Background: Error getting Gemini API key:', error);
    return null;
  }
}

// Get list of files from Gemini API
async function getGeminiFiles() {
  try {
    console.log('🔍 Firebase Background: Getting files from Gemini API...');

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      console.warn('❌ Firebase Background: No Gemini API key available');
      return [];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Firebase Background: Gemini files list error:', response.status, errorData);
      return [];
    }

    const data = await response.json();
    const files = data.files || [];

    console.log(`🔍 Firebase Background: Found ${files.length} files in Gemini API`);

    return files;
  } catch (error) {
    console.error('❌ Firebase Background: Error getting Gemini files:', error);
    return [];
  }
}

// Handle updating API keys
async function handleUpdateApiKeys(message, sendResponse) {
  try {
    console.log('🔑 Firebase Background: Updating API keys with', message.keys?.length || 0, 'keys');

    if (!message.keys || !Array.isArray(message.keys)) {
      throw new Error('Invalid API keys data');
    }

    // Store API keys in chrome storage
    await chrome.storage.local.set({
      apiKeys: message.keys,
      apiKeysUpdated: Date.now()
    });

    // Also store in settings for compatibility
    const settings = await chrome.storage.local.get('settings') || {};
    const currentSettings = settings.settings || {};
    currentSettings.apiKeys = message.keys;
    await chrome.storage.local.set({ settings: currentSettings });

    console.log('✅ Firebase Background: API keys updated successfully');
    sendResponse({ success: true, count: message.keys.length });

  } catch (error) {
    console.error('❌ Firebase Background: Update API keys error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting API key with rotation
async function handleGetApiKey(sendResponse) {
  try {
    console.log('🔑 Firebase Background: Getting API key');

    // Try to get from apiKeys array first
    const result = await chrome.storage.local.get(['apiKeys', 'settings', 'currentKeyIndex']);

    let apiKeys = result.apiKeys || [];

    // Fallback to settings if no keys found
    if (apiKeys.length === 0 && result.settings?.apiKeys) {
      apiKeys = result.settings.apiKeys;
    }

    if (apiKeys.length === 0) {
      throw new Error('No API keys configured');
    }

    // Implement proper key rotation
    let currentKeyIndex = result.currentKeyIndex || 0;

    // Ensure index is within bounds
    if (currentKeyIndex >= apiKeys.length) {
      currentKeyIndex = 0;
    }

    const key = apiKeys[currentKeyIndex];

    // Update index for next request (round-robin)
    const nextKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    await chrome.storage.local.set({ currentKeyIndex: nextKeyIndex });

    console.log(`✅ Firebase Background: API key retrieved successfully (${currentKeyIndex + 1}/${apiKeys.length})`);
    sendResponse({
      success: true,
      data: {
        key: key,
        totalKeys: apiKeys.length,
        currentIndex: currentKeyIndex
      }
    });

  } catch (error) {
    console.error('❌ Firebase Background: Get API key error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get MIME type from file extension - Enhanced for Google Drive compatibility
function getMimeTypeFromExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return null; // Let caller decide fallback
  }

  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    // Text and Markdown files
    'txt': 'text/plain',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'rtf': 'text/rtf',
    'csv': 'text/csv',
    'tsv': 'text/tab-separated-values',

    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'odt': 'application/vnd.oasis.opendocument.text',

    // Spreadsheets
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',

    // Presentations
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odp': 'application/vnd.oasis.opendocument.presentation',

    // Web files
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'xml': 'text/xml',

    // Programming languages
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-c',
    'h': 'text/x-c',
    'php': 'application/x-php',
    'rb': 'text/x-ruby',
    'go': 'text/x-go',
    'rs': 'text/x-rust',
    'swift': 'text/x-swift',
    'kt': 'text/x-kotlin',
    'ts': 'text/x-typescript',
    'jsx': 'text/jsx',
    'tsx': 'text/tsx',
    'vue': 'text/x-vue',
    'sql': 'text/x-sql',
    'sh': 'text/x-shellscript',
    'bash': 'text/x-shellscript',
    'yml': 'text/yaml',
    'yaml': 'text/yaml',

    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon',

    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'm4a': 'audio/m4a',
    'wma': 'audio/x-ms-wma',

    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'mpg': 'video/mpeg',
    'mpeg': 'video/mpeg',

    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'bz2': 'application/x-bzip2'
  };

  // Default to text/plain instead of octet-stream for better Gemini compatibility
  const detectedType = mimeTypes[extension];

  if (detectedType) {
    console.log(`📄 Firebase Background: Extension '${extension}' mapped to MIME type '${detectedType}'`);
    return detectedType;
  }

  // For unknown extensions, return null so caller can decide fallback strategy
  console.log(`📄 Firebase Background: Unknown extension '${extension}' - returning null for caller to handle`);
  return null;
}

// Check if file type is supported by Gemini
function isSupportedGeminiFileType(mimeType) {
  const supportedTypes = [
    // Text files
    'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/x-typescript',
    'application/x-javascript', 'text/x-python', 'application/json', 'text/xml',
    'application/rtf', 'text/rtf', 'text/markdown', 'text/csv', 'text/tab-separated-values',

    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Images
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',

    // Audio
    'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
    'audio/mpeg', 'audio/m4a', 'audio/webm',

    // Video
    'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg',
    'video/webm', 'video/wmv', 'video/3gpp', 'video/quicktime'
  ];

  return supportedTypes.includes(mimeType);
}

// Upload file to Gemini API with proper MIME type handling
async function uploadFileToGemini(file, displayName) {
  try {
    console.log('📤 Firebase Background: Starting Gemini API upload...');

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key available');
    }

    // Detect proper MIME type - prioritize file extension over file.type for better accuracy
    let mimeType = getMimeTypeFromExtension(file.name);

    // If extension-based detection fails, fall back to file.type
    if (!mimeType || mimeType === 'text/plain') {
      mimeType = file.type || mimeType || 'text/plain';
    }

    // Never use application/octet-stream - always fall back to text/plain for unknown types
    if (mimeType === 'application/octet-stream') {
      mimeType = 'text/plain';
    }

    console.log('📤 Firebase Background: Using MIME type:', mimeType, 'for file:', file.name);

    // Validate MIME type for Gemini
    if (!isSupportedGeminiFileType(mimeType)) {
      throw new Error(`File type '${mimeType}' is not supported by Gemini API. Supported types: text/plain, text/markdown, application/pdf, image/png, image/jpeg, etc.`);
    }

    // Convert file data to proper format
    let fileContent;
    if (file.data) {
      // Handle base64 data
      const base64Data = file.data.split(',')[1] || file.data;
      const binaryString = atob(base64Data);
      fileContent = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileContent[i] = binaryString.charCodeAt(i);
      }
    } else {
      throw new Error('Invalid file format - no data property');
    }

    console.log('📤 Firebase Background: File buffer size:', fileContent.length, 'bytes');

    // Create proper multipart form data using the EXACT working method from test
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const metadata = {
      file: {
        displayName: displayName || file.name
      }
    };

    // Build multipart body as binary data (EXACT method that worked in test)
    const textEncoder = new TextEncoder();
    let bodyParts = [];

    // Add metadata part
    bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
    bodyParts.push(textEncoder.encode(`Content-Disposition: form-data; name="metadata"\r\n`));
    bodyParts.push(textEncoder.encode(`Content-Type: application/json\r\n\r\n`));
    bodyParts.push(textEncoder.encode(JSON.stringify(metadata)));
    bodyParts.push(textEncoder.encode(`\r\n`));

    // Add file part
    bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
    bodyParts.push(textEncoder.encode(`Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`));
    bodyParts.push(textEncoder.encode(`Content-Type: ${mimeType}\r\n\r\n`));
    bodyParts.push(fileContent);
    bodyParts.push(textEncoder.encode(`\r\n--${boundary}--\r\n`));

    // Combine all parts
    const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of bodyParts) {
      body.set(part, offset);
      offset += part.length;
    }

    console.log('📤 Firebase Background: Body size:', body.length, 'bytes');

    // Upload to Gemini
    const uploadResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    console.log('📤 Firebase Background: Upload response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.log('📤 Firebase Background: Error response:', errorText);
      throw new Error(`Gemini upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('✅ Firebase Background: File uploaded to Gemini successfully!');
    console.log('   File name:', result.file.name);
    console.log('   File URI:', result.file.uri);
    console.log('   File state:', result.file.state);

    return {
      success: true,
      name: result.file.name,
      displayName: result.file.displayName,
      uri: result.file.uri,
      state: result.file.state,
      sizeBytes: result.file.sizeBytes,
      createTime: result.file.createTime
    };

  } catch (error) {
    console.error('❌ Firebase Background: Gemini upload error:', error);
    throw error;
  }
}

// Validate and refresh access token if needed
async function validateAndRefreshToken() {
  try {
    if (!authState.accessToken) {
      console.log('🔄 Firebase Background: No access token available');
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes

    if (authState.tokenExpiry && (now + expiryBuffer) >= authState.tokenExpiry) {
      console.log('🔄 Firebase Background: Token is expired or expiring soon, refreshing...');

      // Request token refresh from offscreen document
      const refreshResponse = await sendMessageToOffscreen({
        type: 'REFRESH_TOKEN'
      });

      if (refreshResponse && refreshResponse.success) {
        authState.accessToken = refreshResponse.accessToken;
        authState.tokenExpiry = refreshResponse.expiresAt;
        await saveAuthState();
        console.log('✅ Firebase Background: Token refreshed successfully');
        return true;
      } else {
        console.error('❌ Firebase Background: Token refresh failed:', refreshResponse?.error);
        return false;
      }
    }

    // Test token validity with a simple API call
    const testResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (testResponse.ok) {
      console.log('✅ Firebase Background: Token is valid');
      return true;
    } else if (testResponse.status === 401) {
      console.log('🔄 Firebase Background: Token is invalid, attempting refresh...');

      // Request token refresh from offscreen document
      const refreshResponse = await sendMessageToOffscreen({
        type: 'REFRESH_TOKEN'
      });

      if (refreshResponse && refreshResponse.success) {
        authState.accessToken = refreshResponse.accessToken;
        authState.tokenExpiry = refreshResponse.expiresAt;
        await saveAuthState();
        console.log('✅ Firebase Background: Token refreshed after validation failure');
        return true;
      } else {
        console.error('❌ Firebase Background: Token refresh failed after validation:', refreshResponse?.error);
        return false;
      }
    } else {
      console.warn('⚠️ Firebase Background: Token validation returned unexpected status:', testResponse.status);
      return true; // Assume token is valid for other error types
    }

  } catch (error) {
    console.error('❌ Firebase Background: Token validation error:', error);
    return false;
  }
}

// Custom Prompts and Variables Sync Handlers

/**
 * Load custom prompts from Google Drive
 */
async function handleLoadCustomPromptsFromDrive(sendResponse) {
  try {
    console.log('📥 Firebase Background: Loading custom prompts from Google Drive...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      sendResponse({ success: false, error: 'Authentication required to load custom prompts' });
      return;
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      sendResponse({ success: false, error: 'Unable to obtain valid access token. Please sign out and sign in again.' });
      return;
    }

    // Get aiFiverr folder ID and ensure prompts subfolder exists
    const folderId = await ensureAiFiverrFolder();
    const promptsFolderId = await ensureSubfolder('prompts', folderId);

    // Search for custom prompts file in prompts folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='custom-prompts.json' and parents in '${promptsFolderId}' and trashed=false&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      console.log('📥 Firebase Background: No custom prompts file found in Google Drive');
      sendResponse({ success: true, data: {} });
      return;
    }

    // Download the file content
    const fileId = searchData.files[0].id;
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`
      }
    });

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    const fileContent = await downloadResponse.text();
    const customPrompts = JSON.parse(fileContent);

    console.log('✅ Firebase Background: Custom prompts loaded from Google Drive');
    sendResponse({ success: true, data: customPrompts });

  } catch (error) {
    console.error('❌ Firebase Background: Failed to load custom prompts from Drive:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Save custom prompts to Google Drive
 */
async function handleSaveCustomPromptsToDrive(message, sendResponse) {
  try {
    console.log('📤 Firebase Background: Saving custom prompts to Google Drive...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      sendResponse({ success: false, error: 'Authentication required to save custom prompts' });
      return;
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      sendResponse({ success: false, error: 'Unable to obtain valid access token. Please sign out and sign in again.' });
      return;
    }

    const customPrompts = message.data;
    if (!customPrompts) {
      sendResponse({ success: false, error: 'No custom prompts data provided' });
      return;
    }

    // Get aiFiverr folder ID and ensure prompts subfolder exists
    const folderId = await ensureAiFiverrFolder();
    const promptsFolderId = await ensureSubfolder('prompts', folderId);

    // Check if file already exists
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='custom-prompts.json' and parents in '${promptsFolderId}' and trashed=false&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    const searchData = await searchResponse.json();
    const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    // Convert data to JSON
    const jsonData = JSON.stringify(customPrompts, null, 2);

    let uploadResponse;
    if (existingFileId) {
      // Update existing file using simple upload
      console.log('📤 Firebase Background: Updating existing custom prompts file...');
      uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonData
      });
    } else {
      // Create new file using multipart upload (same format as working handleUploadFileToDrive)
      console.log('📤 Firebase Background: Creating new custom prompts file...');

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const metadata = {
        'name': 'custom-prompts.json',
        'parents': [promptsFolderId],
        'description': 'aiFiverr custom prompts backup'
      };

      // Use the exact same format as the working file upload
      const body = delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonData +
        close_delim;

      uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: body
      });
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      console.error('❌ Firebase Background: Custom prompts upload failed:', uploadResponse.status, errorData);
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorData.error?.message || uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Firebase Background: Custom prompts saved to Google Drive');
    sendResponse({ success: true, fileId: uploadData.id });

  } catch (error) {
    console.error('❌ Firebase Background: Failed to save custom prompts to Drive:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Load knowledge base variables from Google Drive
 */
async function handleLoadVariablesFromDrive(sendResponse) {
  try {
    console.log('📥 Firebase Background: Loading variables from Google Drive...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      sendResponse({ success: false, error: 'Authentication required to load variables' });
      return;
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      sendResponse({ success: false, error: 'Unable to obtain valid access token. Please sign out and sign in again.' });
      return;
    }

    // Get aiFiverr folder ID and ensure variables subfolder exists
    const folderId = await ensureAiFiverrFolder();
    const variablesFolderId = await ensureSubfolder('variables', folderId);

    // Search for variables file in variables folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='knowledge-base-variables.json' and parents in '${variablesFolderId}' and trashed=false&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.files || searchData.files.length === 0) {
      console.log('📥 Firebase Background: No variables file found in Google Drive');
      sendResponse({ success: true, data: {} });
      return;
    }

    // Download the file content
    const fileId = searchData.files[0].id;
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`
      }
    });

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    const fileContent = await downloadResponse.text();
    const variables = JSON.parse(fileContent);

    console.log('✅ Firebase Background: Variables loaded from Google Drive');
    sendResponse({ success: true, data: variables });

  } catch (error) {
    console.error('❌ Firebase Background: Failed to load variables from Drive:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Save knowledge base variables to Google Drive
 */
async function handleSaveVariablesToDrive(message, sendResponse) {
  try {
    console.log('📤 Firebase Background: Saving variables to Google Drive...');

    if (!authState.isAuthenticated || !authState.accessToken) {
      sendResponse({ success: false, error: 'Authentication required to save variables' });
      return;
    }

    // Validate and refresh token if needed
    const tokenValid = await validateAndRefreshToken();
    if (!tokenValid) {
      sendResponse({ success: false, error: 'Unable to obtain valid access token. Please sign out and sign in again.' });
      return;
    }

    const variables = message.data;
    if (!variables) {
      sendResponse({ success: false, error: 'No variables data provided' });
      return;
    }

    // Get aiFiverr folder ID and ensure variables subfolder exists
    const folderId = await ensureAiFiverrFolder();
    const variablesFolderId = await ensureSubfolder('variables', folderId);

    // Check if file already exists
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='knowledge-base-variables.json' and parents in '${variablesFolderId}' and trashed=false&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${authState.accessToken}`,
        'Accept': 'application/json'
      }
    });

    const searchData = await searchResponse.json();
    const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    // Convert data to JSON
    const jsonData = JSON.stringify(variables, null, 2);

    let uploadResponse;
    if (existingFileId) {
      // Update existing file using simple upload
      console.log('📤 Firebase Background: Updating existing variables file...');
      uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonData
      });
    } else {
      // Create new file using multipart upload (same format as working handleUploadFileToDrive)
      console.log('📤 Firebase Background: Creating new variables file...');

      const boundary = '-------314159265358979323847';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;

      const metadata = {
        'name': 'knowledge-base-variables.json',
        'parents': [variablesFolderId],
        'description': 'aiFiverr knowledge base variables backup'
      };

      // Use the exact same format as the working file upload
      const body = delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonData +
        close_delim;

      uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: body
      });
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      console.error('❌ Firebase Background: Variables upload failed:', uploadResponse.status, errorData);
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorData.error?.message || uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Firebase Background: Variables saved to Google Drive');
    sendResponse({ success: true, fileId: uploadData.id });

  } catch (error) {
    console.error('❌ Firebase Background: Failed to save variables to Drive:', error);
    sendResponse({ success: false, error: error.message });
  }
}

console.log('✅ Firebase Background: Service worker initialized successfully');
