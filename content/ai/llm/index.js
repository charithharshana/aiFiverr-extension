/**
 * LLM.js Main Interface for Browser Extension
 * Adapted from the original LLM.js index
 */

import LLM from './base.js';
import Google from './google.js';
import { parsers } from './parsers.js';
import { SERVICES, DEFAULT_CONFIG, createOptions } from './types.js';

// Available services (only Google for now as requested)
let SERVICES_LIST = [Google];

/**
 * Main LLM Interface Function
 * Can be called as a function or constructor
 */
function LLMInterface(initOrOpts, opts) {
  let input;
  let options;

  // Parse arguments
  if (typeof initOrOpts === 'string' || Array.isArray(initOrOpts)) {
    input = initOrOpts;
    options = createOptions(opts || {});
  } else if (typeof initOrOpts === 'object' && initOrOpts !== null) {
    input = undefined;
    options = createOptions(initOrOpts);
  } else {
    input = undefined;
    options = createOptions({});
  }

  let llm;

  // Find the appropriate service
  const service = options?.service ?? DEFAULT_CONFIG.service;
  let LLMClass = SERVICES_LIST.find(Service => Service.service === service);
  
  // Default to Google if service not found
  if (!LLMClass) {
    console.warn(`Service ${service} not found, defaulting to Google`);
    LLMClass = Google;
  }

  llm = new LLMClass(input, options);

  // If called with new, return the instance
  if (new.target) return llm;

  // Otherwise, send the request and return the promise
  const response = llm.send();
  return response;
}

// Attach static properties and methods
LLMInterface.parsers = parsers;
LLMInterface.services = SERVICES_LIST;

// Attach service classes
LLMInterface.LLM = LLM;
LLMInterface.Google = Google;

// Service registration methods
LLMInterface.register = (LLMClass) => {
  SERVICES_LIST.push(LLMClass);
};

LLMInterface.unregister = (LLMClass) => {
  SERVICES_LIST = SERVICES_LIST.filter(Service => Service !== LLMClass);
};

// Attachment helper (simplified for browser extension)
LLMInterface.Attachment = {
  fromJPEG: (data) => ({
    type: 'image',
    data,
    mimeType: 'image/jpeg',
    content: {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${data}`
      }
    }
  }),
  
  fromPNG: (data) => ({
    type: 'image',
    data,
    mimeType: 'image/png',
    content: {
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${data}`
      }
    }
  }),
  
  fromPDF: (data) => ({
    type: 'document',
    data,
    mimeType: 'application/pdf',
    content: {
      type: 'document',
      document: {
        data: data,
        mimeType: 'application/pdf'
      }
    }
  }),
  
  fromImageURL: (url) => ({
    type: 'image',
    url,
    content: {
      type: 'image_url',
      image_url: { url }
    }
  })
};

// Export the main interface
export default LLMInterface;

// Also export individual components for direct use
export { LLM, Google, parsers, SERVICES };

// Helper function to create a new LLM instance with specific service
export function createLLM(service = SERVICES.GOOGLE, options = {}) {
  return new LLMInterface({ ...options, service });
}

// Helper function for quick chat
export async function quickChat(message, options = {}) {
  return await LLMInterface(message, options);
}

// Helper function for streaming chat
export async function streamChat(message, options = {}) {
  return await LLMInterface(message, { ...options, stream: true });
}

// Helper function for extended chat with full response details
export async function extendedChat(message, options = {}) {
  return await LLMInterface(message, { ...options, extended: true });
}

// Helper function for thinking mode
export async function thinkingChat(message, options = {}) {
  return await LLMInterface(message, { ...options, think: true, extended: true });
}

// Helper function for JSON mode
export async function jsonChat(message, options = {}) {
  return await LLMInterface(message, { ...options, json: true });
}

// Helper function for tool usage
export async function toolChat(message, tools, options = {}) {
  return await LLMInterface(message, { ...options, tools, extended: true });
}

// Configuration helper
export function configure(config) {
  Object.assign(DEFAULT_CONFIG, config);
}

// API key management helper for browser extension
export function setApiKey(service, apiKey) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`${service.toUpperCase()}_API_KEY`, apiKey);
  }
}

export function getApiKey(service) {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(`${service.toUpperCase()}_API_KEY`);
  }
  return null;
}

export function removeApiKey(service) {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`${service.toUpperCase()}_API_KEY`);
  }
}

// Model management helpers
export async function getModels(service = SERVICES.GOOGLE, options = {}) {
  const llm = new LLMInterface({ service, ...options });
  return await llm.getModels();
}

export async function verifyConnection(service = SERVICES.GOOGLE, options = {}) {
  const llm = new LLMInterface({ service, ...options });
  return await llm.verifyConnection();
}

// Utility to check if a service is available
export function isServiceAvailable(service) {
  return SERVICES_LIST.some(Service => Service.service === service);
}

// Get list of available services
export function getAvailableServices() {
  return SERVICES_LIST.map(Service => Service.service);
}

// Debug helper
export function enableDebug() {
  window.LLM_DEBUG = true;
}

export function disableDebug() {
  window.LLM_DEBUG = false;
}

// Version info
export const VERSION = '1.0.0-extension';
export const DESCRIPTION = 'LLM.js for Browser Extensions - Universal LLM Interface';

console.log(`LLM.js ${VERSION} loaded - ${DESCRIPTION}`);
