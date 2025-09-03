/**
 * Enhanced Gemini Client for aiFiverr Extension
 * Provides streaming capabilities and advanced features
 */

class EnhancedGeminiClient {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.initialized = false;
    this.defaultModel = 'gemini-2.5-flash';
    this.sessions = new Map();
  }

  async init() {
    try {
      this.initialized = true;
      console.log('aiFiverr: Enhanced Gemini Client initialized');
    } catch (error) {
      console.error('aiFiverr: Enhanced Gemini Client initialization error:', error);
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
      console.error('aiFiverr Enhanced Gemini: Failed to get API key:', error);
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
      console.warn('aiFiverr Enhanced Gemini: Failed to get model setting, using default:', error);
      return this.defaultModel;
    }
  }

  /**
   * Generate chat reply with session context (non-streaming)
   */
  async generateChatReply(session, message, options = {}) {
    try {
      console.log('aiFiverr Enhanced Gemini: Generating chat reply for session:', session?.id);

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

      // NEW APPROACH: Only add files if they're actually referenced in the message
      // The variable processor should have already determined which files are needed
      if (options.knowledgeBaseFiles && options.knowledgeBaseFiles.length > 0) {
        for (const file of options.knowledgeBaseFiles) {
          if (file.geminiUri) {
            currentMessageParts.push({
              fileData: {
                fileUri: file.geminiUri,
                mimeType: file.mimeType || 'text/plain'
              }
            });
          }
        }
        console.log('aiFiverr Enhanced Gemini: Added', options.knowledgeBaseFiles.length, 'referenced knowledge base files to chat');
      } else {
        console.log('aiFiverr Enhanced Gemini: No knowledge base files referenced in message');
      }

      // Add text message
      currentMessageParts.push({ text: message });

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

      // DEBUG: Log the exact payload being sent to Gemini
      console.log('🚨 aiFiverr Enhanced Gemini: EXACT PAYLOAD BEING SENT:', JSON.stringify(payload, null, 2));

      // Check for any application/octet-stream in the payload
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.includes('application/octet-stream')) {
        console.error('🚨 FOUND application/octet-stream IN ENHANCED PAYLOAD!');
        console.error('🚨 Full payload:', payloadStr);
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

          console.error('🚨 ENHANCED GEMINI: STALE FILE REFERENCE DETECTED:', fileId);
          console.error('💡 This file no longer exists or you don\'t have permission to access it');
          console.error('🔧 SOLUTION: Remove this file from your knowledge base and upload a fresh copy');

          throw new Error(`Stale file reference detected (${fileId}). Please remove this file from your knowledge base and upload a fresh copy. The file may have expired or been deleted.`);
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
      }

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No response generated from Gemini API');
      }

      const responseText = result.candidates[0].content.parts[0].text;

      // Add to session if provided
      if (session && session.addMessage) {
        session.addMessage('user', message);
        session.addMessage('assistant', responseText);
      }

      return {
        response: responseText,
        text: responseText // For compatibility
      };

    } catch (error) {
      console.error('aiFiverr Enhanced Gemini: Generate chat reply failed:', error);
      throw error;
    }
  }

  /**
   * Stream generate content with real-time response
   */
  async streamGenerateContent(prompt, fileUri = null, fileMimeType = null, sessionId = 'default', options = {}) {
    try {
      const apiKey = await this.getApiKey();
      const model = options.model || await this.getSelectedModel();

      console.log('aiFiverr Enhanced Gemini: Starting streaming generation with model:', model);

      const contents = [{
        parts: [],
        role: "user"
      }];

      // NEW APPROACH: Only add files if they're actually referenced in the prompt
      // The variable processor should have already determined which files are needed
      if (options.knowledgeBaseFiles && options.knowledgeBaseFiles.length > 0) {
        for (const file of options.knowledgeBaseFiles) {
          if (file.geminiUri) {
            contents[0].parts.push({
              fileData: {
                fileUri: file.geminiUri,
                mimeType: file.mimeType || 'text/plain'
              }
            });
          }
        }
        console.log('aiFiverr Enhanced Gemini: Added', options.knowledgeBaseFiles.length, 'referenced knowledge base files to stream');
      } else {
        console.log('aiFiverr Enhanced Gemini: No knowledge base files referenced in prompt');
      }

      // Add legacy file support
      if (fileUri && fileMimeType) {
        contents[0].parts.push({
          fileData: {
            fileUri: fileUri,
            mimeType: fileMimeType
          }
        });
      }

      // Add text prompt
      contents[0].parts.push({
        text: prompt
      });

      const payload = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          candidateCount: 1
        }
      };

      const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}`, {
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

          console.error('🚨 ENHANCED GEMINI STREAMING: STALE FILE REFERENCE DETECTED:', fileId);
          console.error('💡 This file no longer exists or you don\'t have permission to access it');
          console.error('🔧 SOLUTION: Remove this file from your knowledge base and upload a fresh copy');

          throw new Error(`Stale file reference detected (${fileId}). Please remove this file from your knowledge base and upload a fresh copy. The file may have expired or been deleted.`);
        }

        throw new Error(`Gemini streaming API error: ${response.status} - ${errorMessage}`);
      }

      return this.processStreamResponse(response, sessionId);

    } catch (error) {
      console.error('aiFiverr Enhanced Gemini: Stream generate content failed:', error);
      throw error;
    }
  }

  /**
   * Process streaming response from Gemini API
   */
  async processStreamResponse(response, sessionId) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue;

              try {
                // Remove "data: " prefix if present
                const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
                const data = JSON.parse(jsonStr);

                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                  const text = data.candidates[0].content.parts[0]?.text || '';
                  if (text) {
                    fullResponse += text;
                    yield {
                      text: text,
                      fullResponse: fullResponse,
                      done: false
                    };
                  }
                }
              } catch (parseError) {
                console.warn('aiFiverr Enhanced Gemini: Failed to parse streaming chunk:', parseError);
              }
            }
          }

          // Final response
          yield {
            text: '',
            fullResponse: fullResponse,
            done: true
          };

        } catch (error) {
          console.error('aiFiverr Enhanced Gemini: Stream processing error:', error);
          throw error;
        } finally {
          reader.releaseLock();
        }
      }
    };
  }
}

// Initialize global instance
function initializeEnhancedGeminiClient() {
  if (!window.enhancedGeminiClient) {
    window.enhancedGeminiClient = new EnhancedGeminiClient();
    window.enhancedGeminiClient.init();
    console.log('aiFiverr: Enhanced Gemini Client created and initialized');
  }
  return window.enhancedGeminiClient;
}

// Export the initialization function
window.initializeEnhancedGeminiClient = initializeEnhancedGeminiClient;