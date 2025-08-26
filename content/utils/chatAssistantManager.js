/**
 * Simple Chat Assistant Manager for aiFiverr Extension
 * Handles opening and communicating with the JavaScript-based chat assistant
 */

class ChatAssistantManager {
    constructor() {
        this.chatWindow = null;
        this.isReady = false;
        this.messageQueue = [];
        this.initialized = false;
        // DO NOT auto-initialize - wait for explicit call
        // this.init();
    }

    async init() {
        // Check site restrictions first
        const shouldInitialize = await this.shouldInitializeOnCurrentSite();
        if (!shouldInitialize) {
            console.log('aiFiverr: Chat Assistant Manager disabled due to site restrictions');
            return;
        }

        this.setupMessageListener();
        this.initialized = true;
        console.log('aiFiverr: Chat Assistant Manager initialized');
    }

    /**
     * Check if chat assistant should initialize on current site based on settings
     */
    async shouldInitializeOnCurrentSite() {
        try {
            // Check if extension context is valid
            if (!chrome.runtime?.id) {
                console.warn('aiFiverr: Extension context invalidated, cannot check site restrictions');
                return false;
            }

            // Get settings from storage
            const result = await chrome.storage.local.get(['settings']);
            const settings = result.settings || {};

            // Default to restricting to Fiverr only (restrictToFiverr: true)
            const restrictToFiverr = settings.restrictToFiverr !== false;

            if (restrictToFiverr) {
                // Only initialize on Fiverr pages
                return window.location.hostname.includes('fiverr.com');
            } else {
                // Initialize on all sites
                return true;
            }
        } catch (error) {
            console.error('aiFiverr: Error checking site restriction settings:', error);
            // Default to Fiverr only if there's an error
            return window.location.hostname.includes('fiverr.com');
        }
    }

    /**
     * Setup message listener for communication with chat assistant
     */
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data.source !== 'chat-assistant') return;

            const { type, data } = event.data;
            console.log('aiFiverr: Received message from chat assistant:', type, data);

            switch (type) {
                case 'CHAT_ASSISTANT_READY':
                    console.log('aiFiverr: Chat assistant is ready');
                    this.isReady = true;
                    this.processMessageQueue();
                    break;

                case 'CHAT_READY':
                    console.log('aiFiverr: Chat is ready for messages');
                    this.sendMessage('CONNECTION_ESTABLISHED', true);
                    break;

                case 'SEND_MESSAGE':
                    this.handleMessageFromChat(data);
                    break;

                case 'CLOSE_CHAT_ASSISTANT':
                    this.closeChatAssistant();
                    break;

                default:
                    console.log('aiFiverr: Unknown message from chat assistant:', type, data);
            }
        });
    }

    /**
     * Open the chat assistant with initial context
     */
    async openChatAssistant(context = {}) {
        try {
            // Check if manager is initialized (respects site restrictions)
            if (!this.initialized) {
                console.log('aiFiverr: Chat Assistant Manager not initialized, cannot open chat assistant');
                return;
            }

            console.log('aiFiverr: Opening chat assistant with context:', context);

            // Create or focus the chat window
            if (this.chatWindow && !this.chatWindow.closed) {
                this.chatWindow.focus();
                // Update context if window is already open
                this.sendMessage('UPDATE_CONTEXT', context);
                return;
            }

            // Calculate window dimensions and position
            const width = 800;
            const height = 600;
            const left = Math.max(0, (screen.width - width) / 2);
            const top = Math.max(0, (screen.height - height) / 2);

            // Get the chat assistant URL
            const chatUrl = chrome.runtime.getURL('chat-assistant.html');

            // Open new window
            this.chatWindow = window.open(
                chatUrl,
                'aiFiverrChatAssistant',
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no`
            );

            if (!this.chatWindow) {
                throw new Error('Failed to open chat assistant window. Please check popup blocker settings.');
            }

            // Reset ready state
            this.isReady = false;

            // Queue the initial context message
            this.queueMessage('INIT_CHAT_ASSISTANT', context);

            // Handle window close
            const checkClosed = setInterval(() => {
                if (this.chatWindow.closed) {
                    clearInterval(checkClosed);
                    this.chatWindow = null;
                    this.isReady = false;
                    console.log('aiFiverr: Chat assistant window closed');
                }
            }, 1000);

            console.log('aiFiverr: Chat assistant window opened');

        } catch (error) {
            console.error('aiFiverr: Failed to open chat assistant:', error);
            throw error;
        }
    }

    /**
     * Send message to chat assistant
     */
    sendMessage(type, data) {
        if (!this.chatWindow || this.chatWindow.closed) {
            console.warn('aiFiverr: Chat assistant window is not open');
            return false;
        }

        try {
            this.chatWindow.postMessage({
                type,
                data,
                source: 'extension'
            }, '*');
            return true;
        } catch (error) {
            console.error('aiFiverr: Failed to send message to chat assistant:', error);
            return false;
        }
    }

    /**
     * Queue message for when chat assistant is ready
     */
    queueMessage(type, data) {
        this.messageQueue.push({ type, data });
        if (this.isReady) {
            this.processMessageQueue();
        }
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const { type, data } = this.messageQueue.shift();
            this.sendMessage(type, data);
        }
    }

    /**
     * Handle message from chat assistant
     */
    async handleMessageFromChat(data) {
        try {
            const { message, context } = data;
            console.log('aiFiverr: Received message from chat:', message);

            // Set loading state
            this.sendMessage('SET_LOADING', true);

            // Get AI response using enhanced Gemini client with streaming
            if (!window.sessionManager) {
                throw new Error('Session manager not available. Please refresh the page.');
            }

            // Initialize enhanced Gemini client if not available
            if (!window.enhancedGeminiClient) {
                initializeEnhancedGeminiClient();
            }

            const session = await window.sessionManager.getOrCreateSession('chat_assistant');

            // Add context if available
            if (context?.selectedText) {
                session.addMessage('system', `Context: User is working with this text: "${context.selectedText}"`);
            }

            // Try streaming first, fallback to regular if needed
            try {
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

                const options = { stream: true };
                if (knowledgeBaseFiles.length > 0) {
                    options.knowledgeBaseFiles = knowledgeBaseFiles;
                    console.log('aiFiverr Chat Assistant: Attaching', knowledgeBaseFiles.length, 'knowledge base files to API request');
                }

                const streamResponse = await window.enhancedGeminiClient.generateChatReply(session, message, options);

                let fullResponse = '';
                const messageId = Date.now().toString();

                // Send initial streaming message
                this.sendMessage('AI_RESPONSE_STREAM_START', {
                    messageId: messageId
                });

                // Process streaming chunks
                for await (const chunk of streamResponse) {
                    fullResponse += chunk.text;
                    this.sendMessage('AI_RESPONSE_STREAM_CHUNK', {
                        chunk: chunk.text,
                        fullText: fullResponse,
                        messageId: messageId
                    });
                }

                // Send final response
                this.sendMessage('AI_RESPONSE', {
                    message: fullResponse,
                    messageId: messageId,
                    streaming: true
                });

            } catch (streamError) {
                console.log('aiFiverr: Streaming failed, falling back to regular generation:', streamError);

                // Fallback to regular generation with knowledge base files
                const fallbackOptions = { stream: false };
                if (knowledgeBaseFiles.length > 0) {
                    fallbackOptions.knowledgeBaseFiles = knowledgeBaseFiles;
                }
                const response = await window.enhancedGeminiClient.generateChatReply(session, message, fallbackOptions);

                this.sendMessage('AI_RESPONSE', {
                    message: response.response,
                    messageId: Date.now().toString(),
                    streaming: false
                });
            }

        } catch (error) {
            console.error('aiFiverr: Failed to get AI response:', error);
            this.sendMessage('SET_ERROR', error.message || 'Failed to get AI response');
        } finally {
            this.sendMessage('SET_LOADING', false);
        }
    }

    /**
     * Close chat assistant
     */
    closeChatAssistant() {
        if (this.chatWindow && !this.chatWindow.closed) {
            this.chatWindow.close();
        }
        this.chatWindow = null;
        this.isReady = false;
        this.messageQueue = [];
        console.log('aiFiverr: Chat assistant closed');
    }

    /**
     * Check if chat assistant is open
     */
    isOpen() {
        return this.chatWindow && !this.chatWindow.closed;
    }
}

// Create global instance - but only initialize if site restrictions allow
async function initializeChatAssistantManager() {
    if (!window.chatAssistantManager) {
        window.chatAssistantManager = new ChatAssistantManager();
        // Explicitly call init() after creating the instance
        await window.chatAssistantManager.init();
        console.log('aiFiverr: Chat Assistant Manager created and initialized');
    }
}

// Export the initialization function but DO NOT auto-initialize
window.initializeChatAssistantManager = initializeChatAssistantManager;

// REMOVED AUTO-INITIALIZATION - This was causing the chat to load on every website
// The chat assistant manager should only be initialized when explicitly called by main.js
