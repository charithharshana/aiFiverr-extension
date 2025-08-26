/**
 * AI Assistance Types for Browser Extension
 * Type definitions for the AI assistance system
 */

// Service names supported
export const SERVICES = {
  GOOGLE: 'google',
  OPENAI: 'openai', 
  ANTHROPIC: 'anthropic',
  GROQ: 'groq',
  DEEPSEEK: 'deepseek',
  XAI: 'xai',
  OLLAMA: 'ollama'
};

// Message roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant', 
  SYSTEM: 'system',
  THINKING: 'thinking',
  TOOL_CALL: 'tool_call'
};

// Stream chunk types
export const CHUNK_TYPES = {
  CONTENT: 'content',
  THINKING: 'thinking', 
  USAGE: 'usage',
  TOOL_CALLS: 'tool_calls',
  BUFFERS: 'buffers'
};

// Default configuration
export const DEFAULT_CONFIG = {
  service: SERVICES.GOOGLE,
  max_tokens: 4096,
  temperature: 0.7,
  stream: false,
  extended: false,
  think: false
};

/**
 * Create a message object
 * @param {string} role - Message role
 * @param {string|object} content - Message content
 * @returns {object} Message object
 */
export function createMessage(role, content) {
  return { role, content };
}

/**
 * Create options object with defaults
 * @param {object} options - User options
 * @returns {object} Options with defaults applied
 */
export function createOptions(options = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...options
  };
}

/**
 * Validate service name
 * @param {string} service - Service name to validate
 * @returns {boolean} True if valid
 */
export function isValidService(service) {
  return Object.values(SERVICES).includes(service);
}

/**
 * Validate message role
 * @param {string} role - Role to validate
 * @returns {boolean} True if valid
 */
export function isValidRole(role) {
  return Object.values(MESSAGE_ROLES).includes(role);
}

/**
 * Create a tool definition
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @param {object} input_schema - Input schema
 * @returns {object} Tool definition
 */
export function createTool(name, description, input_schema) {
  return {
    name,
    description,
    input_schema
  };
}

/**
 * Create attachment object
 * @param {string} type - Attachment type
 * @param {string} data - Attachment data
 * @param {string} mimeType - MIME type
 * @returns {object} Attachment object
 */
export function createAttachment(type, data, mimeType) {
  return {
    type,
    data,
    mimeType,
    content: {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${data}`
      }
    }
  };
}
