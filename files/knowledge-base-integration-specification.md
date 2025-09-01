# aiFiverr Extension: Knowledge Base File Integration Specification

## Current Architecture Analysis

### Existing Components
1. **KnowledgeBaseManager** (`content/ai/knowledge-base.js`) - Manages file references and metadata
2. **GoogleDriveClient** (`content/auth/google-drive-client.js`) - Handles Drive uploads/downloads
3. **GeminiFilesClient** (`content/ai/gemini-files-client.js`) - Manages Gemini Files API
4. **Firebase Background** (`firebase/background/firebase-background.js`) - Merges Drive + Gemini data
5. **Chat Interfaces** - Multiple implementations for different contexts

### Current File Flow
1. Files uploaded to Google Drive via `GoogleDriveClient`
2. Files uploaded to Gemini Files API via background script
3. File metadata stored in `chrome.storage.local` and `KnowledgeBaseManager.files` Map
4. Background script merges Drive + Gemini data when requested
5. Chat interfaces attempt to retrieve and attach files to API calls

## Identified Issues

### Primary Problem: Missing getKnowledgeBaseFiles() Method
The chat interfaces call `window.knowledgeBaseManager.getKnowledgeBaseFiles()` but this method **does not exist** in the KnowledgeBaseManager class. This is the root cause of knowledge base files not being attached to prompts.

### Secondary Issues
1. **Inconsistent File Retrieval**: Different chat interfaces use different approaches to get files
2. **Fallback Logic Gaps**: Some fallback methods access `files` Map directly, others fail silently
3. **File State Management**: No unified way to check if files have valid `geminiUri`
4. **Error Handling**: Inconsistent error handling across different retrieval methods

## Required Implementation Changes

### 1. Add Missing getKnowledgeBaseFiles() Method

**Location**: `content/ai/knowledge-base.js`
**Insert after line 637** (after `getAllAvailableFileReferences()` method):

```javascript
/**
 * Get all knowledge base files with valid geminiUri for API calls
 * This is the main method called by chat interfaces
 */
async getKnowledgeBaseFiles() {
  try {
    console.log('aiFiverr KB: Getting knowledge base files for API calls...');
    
    // First try to get merged files from background (most reliable)
    const backgroundResult = await this.getKnowledgeBaseFilesFromBackground();
    if (backgroundResult.success && backgroundResult.data) {
      const validFiles = backgroundResult.data.filter(file => file.geminiUri);
      console.log('aiFiverr KB: Retrieved', validFiles.length, 'files with geminiUri from background');
      return validFiles;
    }
    
    // Fallback to local files Map
    console.log('aiFiverr KB: Background failed, using local files Map');
    const localFiles = Array.from(this.files.values());
    const validLocalFiles = localFiles.filter(file => file.geminiUri);
    console.log('aiFiverr KB: Found', validLocalFiles.length, 'local files with geminiUri');
    
    return validLocalFiles.map(file => ({
      id: file.driveFileId || file.id,
      name: file.name,
      mimeType: file.mimeType,
      geminiUri: file.geminiUri,
      size: file.size
    }));
    
  } catch (error) {
    console.error('aiFiverr KB: Error getting knowledge base files:', error);
    return [];
  }
}
```

### 2. Standardize Chat Interface File Retrieval

**Files to Update**:
- `content/ai/universal-chat-simple.js` (lines 549, 668, 2010)
- `content/utils/chatAssistantManager.js` (line 238)
- `content/fiverr/injector.js` (line 1478)

**Current Code Pattern**:
```javascript
const allFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
knowledgeBaseFiles = allFiles.filter(file => file.geminiUri);
```

**Updated Pattern** (remove redundant filtering):
```javascript
const knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
```

### 3. Update Enhanced Streaming Implementation

**Location**: `content/ai/universal-chat-simple.js` lines 1990-2024
**Current Issue**: Uses complex `processPrompt()` method with fallback logic
**Solution**: Simplify to direct `getKnowledgeBaseFiles()` call:

```javascript
// Get knowledge base files for API request
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    console.log('aiFiverr: Found', knowledgeBaseFiles.length, 'knowledge base files for enhanced streaming');
  } catch (error) {
    console.warn('aiFiverr: Failed to get knowledge base files:', error);
  }
}
```

### 4. Fix File Attachment UI Integration

**Location**: `content/ai/universal-chat-simple.js`
**Current Issue**: File attachment UI (`attachedFiles`) is separate from automatic knowledge base loading
**Solution**: Merge both approaches in `prepareMessageWithFiles()` method

### 5. Add Debugging and Monitoring

**Add to all chat interfaces**:
```javascript
// Log file attachment details for debugging
if (knowledgeBaseFiles.length > 0) {
  console.log('aiFiverr: Attaching files to API request:', knowledgeBaseFiles.map(f => ({
    name: f.name,
    geminiUri: f.geminiUri ? 'present' : 'missing',
    mimeType: f.mimeType
  })));
}
```

## Implementation Priority

### Phase 1: Critical Fix (Immediate)
1. Add `getKnowledgeBaseFiles()` method to KnowledgeBaseManager
2. Update all chat interfaces to use the new method
3. Test with existing uploaded files

### Phase 2: Optimization (Next)
1. Standardize error handling across all interfaces
2. Improve file state validation
3. Add comprehensive logging

### Phase 3: Enhancement (Future)
1. Implement file expiration checking
2. Add automatic re-upload for expired files
3. Optimize file retrieval performance

## Testing Strategy

### Unit Tests
1. Test `getKnowledgeBaseFiles()` with various file states
2. Test fallback mechanisms when background script fails
3. Test file filtering logic

### Integration Tests
1. Upload file through popup interface
2. Verify file appears in chat interface
3. Send message and verify file is attached to API request
4. Check API request payload contains correct `fileData` structure

### API Request Validation
Expected Gemini API request structure:
```json
{
  "contents": [{
    "role": "user",
    "parts": [
      {
        "fileData": {
          "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/...",
          "mimeType": "application/pdf"
        }
      },
      {
        "text": "User's prompt text"
      }
    ]
  }]
}
```

## Compatibility Notes

### Firebase Authentication
- All file operations require valid Firebase auth token
- Background script handles token refresh automatically
- File retrieval will fail gracefully if not authenticated

### Google Drive Integration
- Files stored in dedicated "aiFiverr" folder
- Metadata includes extension-specific properties
- Supports all Gemini-compatible file types

### Existing Settings
- No changes required to current settings interface
- Knowledge base file management UI remains unchanged
- Custom prompts with file attachments continue to work

## Risk Assessment

### Low Risk
- Adding missing method (backward compatible)
- Standardizing existing patterns
- Improved error handling

### Medium Risk
- Changes to streaming implementation
- File attachment UI modifications

### Mitigation
- Preserve all existing fallback mechanisms
- Add comprehensive logging for debugging
- Test with various file types and sizes

## Detailed Code Changes

### Change 1: Add getKnowledgeBaseFiles() Method

**File**: `content/ai/knowledge-base.js`
**Location**: After line 637 (after `getAllAvailableFileReferences()` method)
**Action**: Insert new method

```javascript
/**
 * Get all knowledge base files with valid geminiUri for API calls
 * This is the main method called by chat interfaces
 */
async getKnowledgeBaseFiles() {
  try {
    console.log('aiFiverr KB: Getting knowledge base files for API calls...');

    // First try to get merged files from background (most reliable)
    const backgroundResult = await this.getKnowledgeBaseFilesFromBackground();
    if (backgroundResult.success && backgroundResult.data) {
      const validFiles = backgroundResult.data.filter(file => file.geminiUri);
      console.log('aiFiverr KB: Retrieved', validFiles.length, 'files with geminiUri from background');
      return validFiles;
    }

    // Fallback to local files Map
    console.log('aiFiverr KB: Background failed, using local files Map');
    const localFiles = Array.from(this.files.values());
    const validLocalFiles = localFiles.filter(file => file.geminiUri);
    console.log('aiFiverr KB: Found', validLocalFiles.length, 'local files with geminiUri');

    return validLocalFiles.map(file => ({
      id: file.driveFileId || file.id,
      name: file.name,
      mimeType: file.mimeType,
      geminiUri: file.geminiUri,
      size: file.size
    }));

  } catch (error) {
    console.error('aiFiverr KB: Error getting knowledge base files:', error);
    return [];
  }
}
```

### Change 2: Fix Universal Chat Simple (Fallback Streaming)

**File**: `content/ai/universal-chat-simple.js`
**Location**: Lines 547-566
**Action**: Replace existing code

**Current Code**:
```javascript
// Add knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    const allFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    knowledgeBaseFiles = allFiles.filter(file => file.geminiUri);
    console.log('aiFiverr Fallback Non-Streaming: Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');

    // Add file parts to current message
    knowledgeBaseFiles.forEach(file => {
      console.log('aiFiverr Fallback Non-Streaming: Adding file to request:', file.name, file.geminiUri);
      currentMessageParts.push({
        fileData: {
          mimeType: file.mimeType || 'text/plain',
          fileUri: file.geminiUri
        }
      });
    });
  } catch (error) {
    console.warn('aiFiverr Fallback Non-Streaming: Failed to get knowledge base files:', error);
  }
}
```

**New Code**:
```javascript
// Add knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    console.log('aiFiverr Fallback Non-Streaming: Found', knowledgeBaseFiles.length, 'knowledge base files');

    // Add file parts to current message
    knowledgeBaseFiles.forEach(file => {
      console.log('aiFiverr Fallback Non-Streaming: Adding file to request:', file.name, file.geminiUri);
      currentMessageParts.push({
        fileData: {
          mimeType: file.mimeType || 'text/plain',
          fileUri: file.geminiUri
        }
      });
    });
  } catch (error) {
    console.warn('aiFiverr Fallback Non-Streaming: Failed to get knowledge base files:', error);
  }
}
```

### Change 3: Fix Universal Chat Simple (Regular Streaming)

**File**: `content/ai/universal-chat-simple.js`
**Location**: Lines 666-685
**Action**: Replace existing code

**Current Code**:
```javascript
// Add knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    const allFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    knowledgeBaseFiles = allFiles.filter(file => file.geminiUri);
    console.log('aiFiverr Fallback: Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');

    // Add file parts to current message
    knowledgeBaseFiles.forEach(file => {
      console.log('aiFiverr Fallback: Adding file to request:', file.name, file.geminiUri);
      currentMessageParts.push({
        fileData: {
          mimeType: file.mimeType || 'text/plain',
          fileUri: file.geminiUri
        }
      });
    });
  } catch (error) {
    console.warn('aiFiverr Fallback: Failed to get knowledge base files:', error);
  }
}
```

**New Code**:
```javascript
// Add knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    console.log('aiFiverr Fallback: Found', knowledgeBaseFiles.length, 'knowledge base files');

    // Add file parts to current message
    knowledgeBaseFiles.forEach(file => {
      console.log('aiFiverr Fallback: Adding file to request:', file.name, file.geminiUri);
      currentMessageParts.push({
        fileData: {
          mimeType: file.mimeType || 'text/plain',
          fileUri: file.geminiUri
        }
      });
    });
  } catch (error) {
    console.warn('aiFiverr Fallback: Failed to get knowledge base files:', error);
  }
}
```

### Change 4: Fix Enhanced Streaming Implementation

**File**: `content/ai/universal-chat-simple.js`
**Location**: Lines 1990-2024
**Action**: Replace complex processPrompt logic

**Current Code**:
```javascript
// Get knowledge base files for enhanced streaming
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    console.log('aiFiverr: Processing prompt with knowledge base manager for AUTO_LOAD_ALL...');
    // Use a dummy prompt key to trigger AUTO_LOAD_ALL processing
    const processedResult = await window.knowledgeBaseManager.processPrompt('summary', {
      conversation: conversationPrompt,
      bio: 'User bio placeholder' // This will be replaced by actual bio from settings
    });

    if (processedResult && processedResult.knowledgeBaseFiles) {
      knowledgeBaseFiles = processedResult.knowledgeBaseFiles;
      console.log('aiFiverr: Found', knowledgeBaseFiles.length, 'knowledge base files via processPrompt');
    } else {
      console.log('aiFiverr: No knowledge base files returned from processPrompt');
    }
  } catch (error) {
    console.warn('aiFiverr: Failed to process prompt with knowledge base manager:', error);
    // Fallback to direct file access
    try {
      const files = Array.from(window.knowledgeBaseManager.files.values());
      knowledgeBaseFiles = files.filter(file => file.geminiUri);
      console.log('aiFiverr: Fallback - Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');
    } catch (fallbackError) {
      console.warn('aiFiverr: Fallback also failed:', fallbackError);
    }
  }
}
```

**New Code**:
```javascript
// Get knowledge base files for enhanced streaming
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
  try {
    knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
    console.log('aiFiverr: Found', knowledgeBaseFiles.length, 'knowledge base files for enhanced streaming');
  } catch (error) {
    console.warn('aiFiverr: Failed to get knowledge base files:', error);
  }
}
```

### Change 5: Fix Chat Assistant Manager

**File**: `content/utils/chatAssistantManager.js`
**Location**: Lines 236-244
**Action**: Replace direct files Map access

**Current Code**:
```javascript
// Get knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
    try {
        const files = Array.from(window.knowledgeBaseManager.files.values());
        knowledgeBaseFiles = files.filter(file => file.geminiUri);
        console.log('aiFiverr Chat Assistant: Found', knowledgeBaseFiles.length, 'knowledge base files with geminiUri');
    } catch (error) {
        console.warn('aiFiverr Chat Assistant: Failed to get knowledge base files:', error);
    }
}
```

**New Code**:
```javascript
// Get knowledge base files if available
let knowledgeBaseFiles = [];
if (window.knowledgeBaseManager) {
    try {
        knowledgeBaseFiles = await window.knowledgeBaseManager.getKnowledgeBaseFiles();
        console.log('aiFiverr Chat Assistant: Found', knowledgeBaseFiles.length, 'knowledge base files');
    } catch (error) {
        console.warn('aiFiverr Chat Assistant: Failed to get knowledge base files:', error);
    }
}
```

### Change 6: Fix Fiverr Injector

**File**: `content/fiverr/injector.js`
**Location**: Line 1478 (in generateAIReply method)
**Action**: Ensure consistent file retrieval

**Current Code**:
```javascript
console.log('aiFiverr Injector: Chat Reply - Calling generateChatReply with options:', { knowledgeBaseFiles });
const response = await geminiClient.generateChatReply(session, prompt, { knowledgeBaseFiles });
```

**Context**: Verify that `knowledgeBaseFiles` is populated using the correct method. If not already using `getKnowledgeBaseFiles()`, update the code that populates this variable.

## Verification Steps

### 1. Console Logging Verification
After implementing changes, check browser console for:
- "aiFiverr KB: Getting knowledge base files for API calls..."
- "aiFiverr KB: Retrieved X files with geminiUri from background"
- "aiFiverr: Found X knowledge base files for enhanced streaming"

### 2. Network Request Verification
Check Network tab in DevTools for Gemini API requests:
- URL should be `https://generativelanguage.googleapis.com/v1beta/models/*/generateContent`
- Request payload should contain `fileData` objects in `contents[].parts[]`

### 3. API Request Structure Validation
Verify the request payload structure matches:
```json
{
  "contents": [{
    "role": "user",
    "parts": [
      {
        "fileData": {
          "fileUri": "https://generativelanguage.googleapis.com/v1beta/files/...",
          "mimeType": "application/pdf"
        }
      },
      {
        "text": "User prompt text"
      }
    ]
  }]
}
```

## Implementation Order

1. **First**: Add `getKnowledgeBaseFiles()` method to KnowledgeBaseManager
2. **Second**: Update universal-chat-simple.js (all three locations)
3. **Third**: Update chatAssistantManager.js
4. **Fourth**: Verify fiverr/injector.js is using correct method
5. **Fifth**: Test with uploaded files and verify API requests

This specification provides a complete roadmap for fixing the knowledge base file attachment issue in your aiFiverr extension.
```
