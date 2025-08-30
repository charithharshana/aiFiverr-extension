/**
 * LLM.js Utilities for Browser Extension
 * Adapted from the original LLM.js utilities
 */

/**
 * Check if running in browser environment
 * @returns {boolean} True if in browser
 */
export function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if running in Node.js environment
 * @returns {boolean} True if in Node.js
 */
export function isNode() {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Join URL parts
 * @param {...string} parts - URL parts to join
 * @returns {string} Joined URL
 */
export function join(...parts) {
  return parts
    .map((part, index) => {
      if (index === 0) return part.replace(/\/+$/, '');
      return part.replace(/^\/+/, '').replace(/\/+$/, '');
    })
    .filter(part => part.length > 0)
    .join('/');
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Generate a UUID
 * @returns {string} UUID string
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Filter messages by role
 * @param {Array} messages - Messages array
 * @param {string} role - Role to filter by
 * @returns {Array} Filtered messages
 */
export function filterMessageRole(messages, role) {
  return messages.filter(message => message.role === role);
}

/**
 * Filter messages excluding a role
 * @param {Array} messages - Messages array
 * @param {string} role - Role to exclude
 * @returns {Array} Filtered messages
 */
export function filterNotMessageRole(messages, role) {
  return messages.filter(message => message.role !== role);
}

/**
 * Filter array by keyword
 * @param {Array} items - Items to filter
 * @param {string} keyword - Keyword to search for
 * @param {string} field - Field to search in
 * @returns {Array} Filtered items
 */
export function keywordFilter(items, keyword, field = 'name') {
  if (!keyword) return items;
  const lowerKeyword = keyword.toLowerCase();
  return items.filter(item => 
    item[field] && item[field].toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Parse streaming response
 * @param {ReadableStream} stream - Stream to parse
 * @returns {AsyncGenerator} Async generator of chunks
 */
export async function* parseStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          
          try {
            yield JSON.parse(data);
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Handle error response from fetch
 * @param {Response} response - Fetch response
 * @param {string} message - Error message
 * @throws {Error} If response is not ok
 */
export async function handleErrorResponse(response, message) {
  if (!response.ok) {
    let errorText = `${message}: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorText += ` - ${errorData.error.message || errorData.error}`;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    throw new Error(errorText);
  }
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
