# Troubleshooting Custom Prompts and Variables Sync

## Quick Diagnosis Steps

### Step 1: Load Debug Script
1. Open browser console on a Fiverr page with the extension loaded
2. Copy and paste the contents of `debug-sync-functionality.js`
3. Run: `debugSync.runFullDiagnostic()`

### Step 2: Check Components
Run in console:
```javascript
// Check if all required components are available
debugSync.checkComponents()

// Check current authentication status
window.googleAuthService?.isUserAuthenticated()

// Check if knowledge base manager is available
!!window.knowledgeBaseManager
```

### Step 3: Test Authentication Listeners
```javascript
// Test if auth listeners are working
debugSync.testAuthListeners()

// Or use built-in test
window.testKnowledgeBaseSync?.testAuthListeners()
```

### Step 4: Test Sync Manually
```javascript
// Test sync functionality directly
window.knowledgeBaseManager?.syncCustomDataFromGoogleDrive()

// Or use built-in test
window.testKnowledgeBaseSync?.testSync()
```

### Step 5: Check Google Drive Files
```javascript
// Check if backup files exist in Google Drive
debugSync.checkGoogleDriveFiles()
```

## Common Issues and Solutions

### Issue 1: "Knowledge Base Manager not available"
**Symptoms:** `window.knowledgeBaseManager` is undefined
**Solutions:**
1. Refresh the page and wait for extension to fully load
2. Check browser console for initialization errors
3. Verify extension is enabled and permissions are granted

### Issue 2: "Google Auth Service not available"
**Symptoms:** `window.googleAuthService` is undefined
**Solutions:**
1. Check if `firebase-google-auth.js` is loaded in manifest.json
2. Look for authentication service initialization errors in console
3. Try refreshing the page

### Issue 3: "User not authenticated"
**Symptoms:** `isUserAuthenticated()` returns false
**Solutions:**
1. Sign in to the extension through the popup
2. Check if authentication tokens are expired
3. Try signing out and signing in again

### Issue 4: "Authentication listeners not triggering"
**Symptoms:** Sync doesn't happen after authentication
**Solutions:**
1. Check console for "Auth listener triggered" messages
2. Verify listeners are set up: `debugSync.testAuthListeners()`
3. Try manual sync: `window.knowledgeBaseManager.syncCustomDataFromGoogleDrive()`

### Issue 5: "No backup files found in Google Drive"
**Symptoms:** Sync reports "no backup found"
**Solutions:**
1. Create test data: `window.testKnowledgeBaseSync.createTestData()`
2. Save some custom prompts or variables manually
3. Check Google Drive aiFiverr folder for backup files

### Issue 6: "Google Drive client not available"
**Symptoms:** Sync fails with "no_drive_client" error
**Solutions:**
1. Check if `google-drive-client.js` is loaded
2. Verify Google Drive permissions are granted
3. Test Google Drive connection in extension popup

## Manual Testing Procedure

### 1. Create Test Data
```javascript
// Create test custom prompt and variable
window.testKnowledgeBaseSync.createTestData()

// Verify data was created
window.testKnowledgeBaseSync.checkData()
```

### 2. Test Backup
```javascript
// Test backing up to Google Drive
const testPrompts = { 'test': { title: 'Test', content: 'Test content' } }
window.knowledgeBaseManager.syncToGoogleDrive('custom-prompts', testPrompts)
```

### 3. Test Restore
```javascript
// Clear local data
window.knowledgeBaseManager.customPrompts.clear()
window.knowledgeBaseManager.variables.clear()

// Test restore from Google Drive
window.knowledgeBaseManager.syncCustomDataFromGoogleDrive()

// Check if data was restored
window.testKnowledgeBaseSync.checkData()
```

### 4. Test Authentication Flow
```javascript
// Add a test listener to see if it gets called
window.googleAuthService.addAuthListener((authState) => {
  console.log('🔔 Test listener called:', authState)
  if (authState.isAuthenticated) {
    console.log('✅ User is authenticated, sync should trigger')
  }
})

// Trigger listeners manually
window.googleAuthService.notifyAuthListeners()
```

## Expected Console Output

When sync is working correctly, you should see:
```
aiFiverr KB: Authentication listeners set up successfully
aiFiverr KB: User authenticated, starting automatic sync...
aiFiverr KB: Starting automatic sync after authentication...
aiFiverr KB: syncCustomDataFromGoogleDrive called
aiFiverr KB: Searching for custom prompts backup file...
aiFiverr KB: Found X custom prompts backup files
aiFiverr KB: Successfully synced X custom prompts from Google Drive
aiFiverr KB: Searching for variables backup file...
aiFiverr KB: Found X variables backup files
aiFiverr KB: Successfully synced X knowledge base variables from Google Drive
aiFiverr KB: Automatic sync completed after authentication
```

## Debugging Checklist

- [ ] Extension is loaded and enabled
- [ ] User is authenticated with Google
- [ ] Knowledge Base Manager is initialized
- [ ] Google Auth Service is available
- [ ] Google Drive Client is available
- [ ] Authentication listeners are set up
- [ ] Backup files exist in Google Drive aiFiverr folder
- [ ] Console shows sync attempt messages
- [ ] No JavaScript errors in console

## Advanced Debugging

### Enable Debug Mode
```javascript
window.aiFiverrDebug = true
```

### Check Extension Manifest
Verify these files are loaded in the correct order:
1. `content/auth/firebase-google-auth.js`
2. `content/auth/google-drive-client.js`
3. `content/ai/knowledge-base.js`

### Check Storage
```javascript
// Check local storage
chrome.storage.local.get(['customPrompts', 'knowledgeBase'], console.log)

// Check current in-memory data
console.log('Prompts:', Array.from(window.knowledgeBaseManager.customPrompts.entries()))
console.log('Variables:', Array.from(window.knowledgeBaseManager.variables.entries()))
```

### Force Sync
```javascript
// Force authentication listener setup
window.knowledgeBaseManager.setupAuthenticationListeners()

// Force sync
window.knowledgeBaseManager.syncCustomDataFromGoogleDrive().then(console.log)
```

## Getting Help

If sync is still not working after following these steps:

1. Run the full diagnostic: `debugSync.runFullDiagnostic()`
2. Copy the console output
3. Check the Google Drive aiFiverr folder for backup files
4. Note any error messages or unexpected behavior
5. Provide this information when reporting the issue

The most common issue is timing - the knowledge base manager initializes before the authentication service is ready. The enhanced implementation includes retry logic to handle this, but manual testing can help identify specific timing issues.
