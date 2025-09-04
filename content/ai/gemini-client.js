/**
 * Gemini Client for aiFiverr Extension
 * Handles direct API calls to Google's Gemini API
 */

class GeminiClient {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.initialized = false;
    this.defaultModel = 'gemini-2.5-flash';
  }

  async init() {
    try {
      this.initialized = true;
      console.log('aiFiverr: Gemini Client initialized');
    } catch (error) {
      console.error('aiFiverr: Gemini Client initialization error:', error);
      this.initialized = true; // Still mark as initialized to prevent blocking
    }
  }

  /**
   * Get API key for Gemini API
   */
  async getApiKey() {
    try {
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        const keyData = window.apiKeyManager.getKeyForSession('gemini');
        if (keyData) {
          return keyData.key;
        }
      }

      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response?.success && response?.data) {
        return response.data.key;
      }

      throw new Error('No API key available');
    } catch (error) {
      console.error('aiFiverr Gemini: Failed to get API key:', error);
      throw error;
    }
  }

  /**
   * Get selected model from settings
   */
  async getSelectedModel() {
    try {
      if (window.storageManager && window.storageManager.initialized) {
        const settings = await window.storageManager.get('settings');
        return settings.settings?.selectedModel || settings.settings?.defaultModel || this.defaultModel;
      }

      // Fallback to chrome storage
      const result = await chrome.storage.local.get('settings');
      return result.settings?.selectedModel || result.settings?.defaultModel || this.defaultModel;
    } catch (error) {
      console.warn('aiFiverr Gemini: Failed to get model setting, using default:', error);
      return this.defaultModel;
    }
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(prompt, options = {}) {
    try {
      const apiKey = await this.getApiKey();
      const model = options.model || await this.getSelectedModel();

      console.log('aiFiverr Gemini: Generating content with model:', model);

      const contents = [{
        parts: [],
        role: "user"
      }];

      // Process URL context extraction if enabled
      let processedPrompt = prompt;
      if (options.urlContextExtraction && window.urlContextExtractor) {
        try {
          const urlResult = await window.urlContextExtractor.processText(prompt);
          processedPrompt = urlResult.enhancedText;
          console.log('aiFiverr Gemini: URL context extraction applied');
        } catch (error) {
          console.warn('aiFiverr Gemini: URL context extraction failed:', error);
        }
      }

      // Add knowledge base files first if provided
      if (options.knowledgeBaseFiles && options.knowledgeBaseFiles.length > 0) {
        let validFilesCount = 0;
        console.log('🔍 GEMINI CLIENT: Checking', options.knowledgeBaseFiles.length, 'knowledge base files for expiration');

        for (const file of options.knowledgeBaseFiles) {
          // Enhanced file expiration logging with multiple timestamp field support
          if (file.geminiUri) {
            const isExpired = this.isFileExpired(file);

            // Check all possible timestamp fields
            const createTimeRaw = file.createTime || file.geminiCreateTime || file.geminiUploadTime || file.uploadTimestamp;
            const createTime = createTimeRaw ? (typeof createTimeRaw === 'number' ? new Date(createTimeRaw) : new Date(createTimeRaw)) : null;
            const hoursSinceCreation = createTime ? (Date.now() - createTime.getTime()) / (1000 * 60 * 60) : 'unknown';

            console.log(`🔍 File: ${file.name}`, {
              geminiUri: file.geminiUri.substring(0, 50) + '...',
              createTime: createTime?.toISOString(),
              createTimeSource: file.createTime ? 'createTime' : file.geminiCreateTime ? 'geminiCreateTime' : file.geminiUploadTime ? 'geminiUploadTime' : file.uploadTimestamp ? 'uploadTimestamp' : 'none',
              hoursSinceCreation: typeof hoursSinceCreation === 'number' ? hoursSinceCreation.toFixed(1) : hoursSinceCreation,
              isExpired,
              status: isExpired ? '❌ EXPIRED' : '✅ VALID'
            });
          }

          if (file.geminiUri && !this.isFileExpired(file)) {
            let finalMimeType = file.mimeType || 'text/plain';

            // AGGRESSIVE MIME TYPE FIXING - Multiple levels of protection
            if (finalMimeType === 'application/octet-stream' ||
                finalMimeType === '' ||
                finalMimeType === null ||
                finalMimeType === undefined) {

              console.error('🚨🚨🚨 GEMINI CLIENT EMERGENCY OVERRIDE: Found problematic MIME type:', finalMimeType);
              console.error('🚨 File object:', JSON.stringify(file, null, 2));

              // Try to detect proper MIME type from file extension
              const extension = file.name ? file.name.toLowerCase().split('.').pop() : '';
              const mimeMap = {
                'txt': 'text/plain',
                'md': 'text/markdown',
                'pdf': 'application/pdf',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'json': 'application/json',
                'csv': 'text/csv',
                'html': 'text/html',
                'js': 'text/javascript',
                'py': 'text/x-python'
              };

              finalMimeType = mimeMap[extension] || 'text/plain';
              console.error('🚨 OVERRIDE: Changed to:', finalMimeType);
            }

            // Additional safety check - ensure it's a supported MIME type
            const supportedTypes = [
              'text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript',
              'application/json', 'text/csv', 'application/pdf', 'image/jpeg', 'image/png',
              'image/gif', 'video/mp4', 'audio/mpeg', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!supportedTypes.includes(finalMimeType)) {
              console.warn('🚨 UNSUPPORTED MIME TYPE DETECTED:', finalMimeType, 'for file:', file.name);
              finalMimeType = 'text/plain'; // Ultimate fallback
            }

            const fileDataPart = {
              fileData: {
                fileUri: file.geminiUri,
                mimeType: finalMimeType
              }
            };

            console.log('🚨 GEMINI CLIENT FILE DATA PART:', JSON.stringify(fileDataPart, null, 2));
            contents[0].parts.push(fileDataPart);
            validFilesCount++;
          } else if (file.geminiUri && this.isFileExpired(file)) {
            console.warn('aiFiverr Gemini: Skipping expired file:', file.name);
          }
        }
        console.log('aiFiverr Gemini: Added', validFilesCount, 'valid knowledge base files (', options.knowledgeBaseFiles.length, 'total)');
      }

      // Add text prompt (use processed prompt with URL context if available)
      contents[0].parts.push({
        text: processedPrompt
      });

      const payload = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          candidateCount: 1
        }
      };

      // Add tools for grounding and URL context if enabled
      const tools = [];

      // Add Google Search grounding tool if enabled
      if (options.googleSearchGrounding) {
        tools.push({ googleSearch: {} });
        console.log('aiFiverr Gemini: Google Search grounding enabled');
      }

      // Add URL context tool if enabled
      if (options.urlContextTool) {
        tools.push({ urlContext: {} });
        console.log('aiFiverr Gemini: URL context tool enabled');
      }

      // Add tools to payload if any are enabled
      if (tools.length > 0) {
        payload.tools = tools;
        console.log('aiFiverr Gemini: Added tools to payload:', tools.length);
      }

      // Log payload summary for debugging
      console.log('aiFiverr Gemini: Sending request to API with', payload.contents.length, 'content parts');

      // FINAL SAFETY CHECK - Scan and fix any remaining application/octet-stream in payload
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.includes('application/octet-stream')) {
        console.error('🚨🚨🚨 CRITICAL: FOUND application/octet-stream IN PAYLOAD AFTER ALL FIXES!');
        console.error('🚨 Full payload before fix:', payloadStr);

        // EMERGENCY PAYLOAD SURGERY - Replace all application/octet-stream with text/plain
        const fixedPayloadStr = payloadStr.replace(/application\/octet-stream/g, 'text/plain');
        payload = JSON.parse(fixedPayloadStr);

        console.error('🚨 EMERGENCY PAYLOAD SURGERY APPLIED - Fixed payload:', JSON.stringify(payload, null, 2));
      } else {
        console.log('✅ REGULAR PAYLOAD CLEAN: No application/octet-stream found in payload');
      }

      // ULTIMATE SAFETY CHECK - Scan the final JSON string being sent
      let finalPayloadString = JSON.stringify(payload);
      if (finalPayloadString.includes('application/octet-stream')) {
        console.error('🚨🚨🚨 ULTIMATE SAFETY: FOUND application/octet-stream IN FINAL PAYLOAD STRING!');
        console.error('🚨 Original payload string:', finalPayloadString);

        // Replace ALL instances of application/octet-stream with text/plain
        finalPayloadString = finalPayloadString.replace(/application\/octet-stream/g, 'text/plain');

        console.error('🚨 ULTIMATE SAFETY: Fixed payload string:', finalPayloadString);

        // Parse back to object to ensure it's valid JSON
        payload = JSON.parse(finalPayloadString);
      }

      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: finalPayloadString
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        // CRITICAL FIX: Handle stale file references (403 errors)
        if (response.status === 403 && errorMessage.includes('You do not have permission to access the File')) {
          // Extract file ID from error message
          const fileIdMatch = errorMessage.match(/File (\w+)/);
          const fileId = fileIdMatch ? fileIdMatch[1] : 'unknown';

          console.error('🚨 STALE FILE REFERENCE DETECTED:', fileId);
          console.error('💡 This file no longer exists or you don\'t have permission to access it');
          console.error('🔧 SOLUTION: Remove this file from your knowledge base and upload a fresh copy');

          // Try to auto-refresh expired files if knowledge base manager is available
          if (window.knowledgeBaseManager) {
            console.log('🔄 Attempting to auto-refresh expired files...');
            try {
              const currentApiKey = await this.getApiKey();
              const refreshResult = await window.knowledgeBaseManager.refreshExpiredFiles(currentApiKey);
              if (refreshResult.refreshed > 0) {
                throw new Error(`File access error detected. ${refreshResult.refreshed} files were automatically refreshed. Please try your request again.`);
              }
            } catch (refreshError) {
              console.warn('🚨 Auto-refresh failed:', refreshError);
            }
          }

          throw new Error(`Stale file reference detected (${fileId}). Please remove this file from your knowledge base and upload a fresh copy. The file may have expired or been deleted.`);
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
      }

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No response generated from Gemini API');
      }

      const text = result.candidates[0].content.parts[0].text;

      // Extract grounding metadata if available
      const groundingMetadata = result.candidates[0].groundingMetadata;
      const urlContextMetadata = result.candidates[0].urlContextMetadata;

      return {
        text: text,
        response: text, // For compatibility
        groundingMetadata,
        urlContextMetadata,
        fullResult: result // Include full result for advanced processing
      };

    } catch (error) {
      console.error('aiFiverr Gemini: Generate content failed:', error);
      throw error;
    }
  }

  /**
   * Generate chat reply with session context
   */
  async generateChatReply(session, message, options = {}) {
    try {
      console.log('aiFiverr Gemini: Generating chat reply for session:', session?.id);

      const apiKey = await this.getApiKey();
      const model = options.model || await this.getSelectedModel();

      // Build conversation history
      const contents = [];

      if (session && session.messages && session.messages.length > 0) {
        // Add recent conversation history (last 10 messages for context)
        const recentMessages = session.messages.slice(-10);
        for (const msg of recentMessages) {
          if (msg.role === 'user') {
            contents.push({
              role: 'user',
              parts: [{ text: msg.content }]
            });
          } else if (msg.role === 'assistant' || msg.role === 'model') {
            contents.push({
              role: 'model',
              parts: [{ text: msg.content }]
            });
          }
        }
      }

      // Add current message
      const currentMessageParts = [];

      // Add knowledge base files first if provided
      if (options.knowledgeBaseFiles && options.knowledgeBaseFiles.length > 0) {
        let validFilesCount = 0;
        console.log('🔍 GEMINI CHAT: Checking', options.knowledgeBaseFiles.length, 'knowledge base files for expiration');

        for (const file of options.knowledgeBaseFiles) {
          // Enhanced file expiration logging for chat with multiple timestamp field support
          if (file.geminiUri) {
            const isExpired = this.isFileExpired(file);

            // Check all possible timestamp fields
            const createTimeRaw = file.createTime || file.geminiCreateTime || file.geminiUploadTime || file.uploadTimestamp;
            const createTime = createTimeRaw ? (typeof createTimeRaw === 'number' ? new Date(createTimeRaw) : new Date(createTimeRaw)) : null;
            const hoursSinceCreation = createTime ? (Date.now() - createTime.getTime()) / (1000 * 60 * 60) : 'unknown';

            console.log(`🔍 Chat File: ${file.name}`, {
              geminiUri: file.geminiUri.substring(0, 50) + '...',
              createTime: createTime?.toISOString(),
              createTimeSource: file.createTime ? 'createTime' : file.geminiCreateTime ? 'geminiCreateTime' : file.geminiUploadTime ? 'geminiUploadTime' : file.uploadTimestamp ? 'uploadTimestamp' : 'none',
              hoursSinceCreation: typeof hoursSinceCreation === 'number' ? hoursSinceCreation.toFixed(1) : hoursSinceCreation,
              isExpired,
              status: isExpired ? '❌ EXPIRED' : '✅ VALID'
            });
          }

          if (file.geminiUri && !this.isFileExpired(file)) {
            let finalMimeType = file.mimeType || 'text/plain';

            // AGGRESSIVE MIME TYPE FIXING - Multiple levels of protection (STREAMING)
            if (finalMimeType === 'application/octet-stream' ||
                finalMimeType === '' ||
                finalMimeType === null ||
                finalMimeType === undefined) {

              console.error('🚨🚨🚨 GEMINI CLIENT STREAMING EMERGENCY OVERRIDE: Found problematic MIME type:', finalMimeType);
              console.error('🚨 File object:', JSON.stringify(file, null, 2));

              // Try to detect proper MIME type from file extension
              const extension = file.name ? file.name.toLowerCase().split('.').pop() : '';
              const mimeMap = {
                'txt': 'text/plain',
                'md': 'text/markdown',
                'pdf': 'application/pdf',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'json': 'application/json',
                'csv': 'text/csv',
                'html': 'text/html',
                'js': 'text/javascript',
                'py': 'text/x-python'
              };

              finalMimeType = mimeMap[extension] || 'text/plain';
              console.error('🚨 STREAMING OVERRIDE: Changed to:', finalMimeType);
            }

            // Additional safety check - ensure it's a supported MIME type
            const supportedTypes = [
              'text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript',
              'application/json', 'text/csv', 'application/pdf', 'image/jpeg', 'image/png',
              'image/gif', 'video/mp4', 'audio/mpeg', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!supportedTypes.includes(finalMimeType)) {
              console.warn('🚨 STREAMING UNSUPPORTED MIME TYPE DETECTED:', finalMimeType, 'for file:', file.name);
              finalMimeType = 'text/plain'; // Ultimate fallback
            }

            const fileDataPart = {
              fileData: {
                fileUri: file.geminiUri,
                mimeType: finalMimeType
              }
            };

            console.log('🚨 GEMINI CLIENT STREAMING FILE DATA PART:', JSON.stringify(fileDataPart, null, 2));
            currentMessageParts.push(fileDataPart);
            validFilesCount++;
          } else if (file.geminiUri && this.isFileExpired(file)) {
            const createTimeRaw = file.createTime || file.geminiCreateTime || file.geminiUploadTime || file.uploadTimestamp;
            const createTime = createTimeRaw ? (typeof createTimeRaw === 'number' ? new Date(createTimeRaw) : new Date(createTimeRaw)) : null;
            const hoursSinceCreation = createTime ? (Date.now() - createTime.getTime()) / (1000 * 60 * 60) : 'unknown';
            console.warn('🚨 aiFiverr Gemini: Skipping expired file:', {
              name: file.name,
              createTime: createTime?.toISOString(),
              createTimeSource: file.createTime ? 'createTime' : file.geminiCreateTime ? 'geminiCreateTime' : file.geminiUploadTime ? 'geminiUploadTime' : file.uploadTimestamp ? 'uploadTimestamp' : 'none',
              hoursSinceCreation: typeof hoursSinceCreation === 'number' ? hoursSinceCreation.toFixed(1) + ' hours' : hoursSinceCreation,
              geminiUri: file.geminiUri.substring(0, 50) + '...',
              message: 'File expired (48-hour limit exceeded). Please refresh or re-upload.'
            });
          } else if (file.geminiUri) {
            console.warn('🚨 aiFiverr Gemini: File has URI but failed other checks:', {
              name: file.name,
              hasGeminiUri: !!file.geminiUri,
              hasCreateTime: !!file.createTime,
              hasGeminiCreateTime: !!file.geminiCreateTime,
              hasGeminiUploadTime: !!file.geminiUploadTime,
              hasUploadTimestamp: !!file.uploadTimestamp,
              message: 'File may be in invalid state - check timestamp fields'
            });
          }
        }
        console.log('aiFiverr Gemini: Added', validFilesCount, 'valid knowledge base files to chat (', options.knowledgeBaseFiles.length, 'total)');
      }

      // Process URL context extraction if enabled
      let processedMessage = message;
      if (options.urlContextExtraction && window.urlContextExtractor) {
        try {
          const urlResult = await window.urlContextExtractor.processText(message);
          processedMessage = urlResult.enhancedText;
          console.log('aiFiverr Gemini Chat: URL context extraction applied');
        } catch (error) {
          console.warn('aiFiverr Gemini Chat: URL context extraction failed:', error);
        }
      }

      // Add text message (use processed message with URL context if available)
      currentMessageParts.push({ text: processedMessage });

      contents.push({
        role: 'user',
        parts: currentMessageParts
      });

      const payload = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          candidateCount: 1
        }
      };

      // Add tools for grounding and URL context if enabled
      const tools = [];

      // Add Google Search grounding tool if enabled
      if (options.googleSearchGrounding) {
        tools.push({ googleSearch: {} });
        console.log('aiFiverr Gemini Chat: Google Search grounding enabled');
      }

      // Add URL context tool if enabled
      if (options.urlContextTool) {
        tools.push({ urlContext: {} });
        console.log('aiFiverr Gemini Chat: URL context tool enabled');
      }

      // Add tools to payload if any are enabled
      if (tools.length > 0) {
        payload.tools = tools;
        console.log('aiFiverr Gemini Chat: Added tools to payload:', tools.length);
      }

      // COMPREHENSIVE PAYLOAD DEBUGGING - Log the entire payload being sent
      console.log('🚨 STREAMING PAYLOAD DEBUG: Full payload being sent to Gemini API:', JSON.stringify(payload, null, 2));

      // FINAL SAFETY CHECK FOR STREAMING - Scan and fix any remaining application/octet-stream in payload
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.includes('application/octet-stream')) {
        console.error('🚨🚨🚨 CRITICAL STREAMING: FOUND application/octet-stream IN PAYLOAD AFTER ALL FIXES!');
        console.error('🚨 Full streaming payload before fix:', payloadStr);

        // EMERGENCY PAYLOAD SURGERY - Replace all application/octet-stream with text/plain
        const fixedPayloadStr = payloadStr.replace(/application\/octet-stream/g, 'text/plain');
        payload = JSON.parse(fixedPayloadStr);

        console.error('🚨 EMERGENCY STREAMING PAYLOAD SURGERY APPLIED - Fixed payload:', JSON.stringify(payload, null, 2));
      } else {
        console.log('✅ STREAMING PAYLOAD CLEAN: No application/octet-stream found in payload');
      }

      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        // CRITICAL FIX: Handle stale file references (403 errors)
        if (response.status === 403 && errorMessage.includes('You do not have permission to access the File')) {
          // Extract file ID from error message
          const fileIdMatch = errorMessage.match(/File (\w+)/);
          const fileId = fileIdMatch ? fileIdMatch[1] : 'unknown';

          console.error('🚨 STALE FILE REFERENCE DETECTED:', fileId);
          console.error('💡 This file no longer exists or you don\'t have permission to access it');
          console.error('🔧 SOLUTION: Remove this file from your knowledge base and upload a fresh copy');

          // Try to auto-refresh expired files if knowledge base manager is available
          if (window.knowledgeBaseManager) {
            console.log('🔄 Attempting to auto-refresh expired files...');
            try {
              const currentApiKey = await this.getApiKey();
              const refreshResult = await window.knowledgeBaseManager.refreshExpiredFiles(currentApiKey);
              if (refreshResult.refreshed > 0) {
                throw new Error(`File access error detected. ${refreshResult.refreshed} files were automatically refreshed. Please try your request again.`);
              }
            } catch (refreshError) {
              console.warn('🚨 Auto-refresh failed:', refreshError);
            }
          }

          throw new Error(`Stale file reference detected (${fileId}). Please remove this file from your knowledge base and upload a fresh copy. The file may have expired or been deleted.`);
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
      }

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No response generated from Gemini API');
      }

      const responseText = result.candidates[0].content.parts[0].text;

      // Extract grounding metadata if available
      const groundingMetadata = result.candidates[0].groundingMetadata;
      const urlContextMetadata = result.candidates[0].urlContextMetadata;

      // Add to session if provided
      if (session && session.addMessage) {
        session.addMessage('user', message);
        session.addMessage('assistant', responseText);
      }

      return {
        response: responseText,
        text: responseText, // For compatibility
        groundingMetadata,
        urlContextMetadata,
        fullResult: result // Include full result for advanced processing
      };

    } catch (error) {
      console.error('aiFiverr Gemini: Generate chat reply failed:', error);
      throw error;
    }
  }

  /**
   * Check if a file is expired (48 hours from creation)
   */
  isFileExpired(file) {
    if (!file) {
      return false;
    }

    // Check multiple possible timestamp fields (different parts of system use different names)
    const createTime = file.createTime || file.geminiCreateTime || file.geminiUploadTime || file.uploadTimestamp;

    if (!createTime) {
      console.warn('aiFiverr Gemini: No timestamp found for file:', file.name, {
        hasCreateTime: !!file.createTime,
        hasGeminiCreateTime: !!file.geminiCreateTime,
        hasGeminiUploadTime: !!file.geminiUploadTime,
        hasUploadTimestamp: !!file.uploadTimestamp
      });
      return false;
    }

    try {
      // Handle both ISO string and timestamp formats
      const createTimeDate = typeof createTime === 'number' ? new Date(createTime) : new Date(createTime);
      const now = new Date();
      const hoursDiff = (now - createTimeDate) / (1000 * 60 * 60);

      return hoursDiff >= 48;
    } catch (error) {
      console.warn('aiFiverr Gemini: Error checking file expiration:', error);
      return false;
    }
  }
}

// Initialize global instance
function initializeGeminiClient() {
  if (!window.geminiClient) {
    window.geminiClient = new GeminiClient();
    window.geminiClient.init();
    console.log('aiFiverr: Gemini Client created and initialized');
  }
  return window.geminiClient;
}

// Export the initialization function
window.initializeGeminiClient = initializeGeminiClient;