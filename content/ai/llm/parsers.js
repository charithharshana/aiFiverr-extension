/**
 * LLM.js Parsers for Browser Extension
 * Adapted from the original LLM.js parsers
 */

/**
 * JSON Parser - Extract and parse JSON from response
 * @param {string} content - Content to parse
 * @returns {any} Parsed JSON or original content
 */
export function json(content) {
  if (typeof content !== 'string') return content;
  
  // Try to parse the entire content as JSON first
  try {
    return JSON.parse(content.trim());
  } catch (e) {
    // If that fails, try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        // Fall through to regex extraction
      }
    }
    
    // Try to find JSON-like content using regex
    const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/;
    const match = content.match(jsonRegex);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // Return original content if all parsing fails
      }
    }
  }
  
  return content;
}

/**
 * XML Parser - Extract content from XML tags
 * @param {string} tagName - XML tag name to extract
 * @returns {Function} Parser function
 */
export function xml(tagName) {
  return function(content) {
    if (typeof content !== 'string') return content;
    
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : content;
  };
}

/**
 * Code Block Parser - Extract content from markdown code blocks
 * @param {string} language - Language identifier (optional)
 * @returns {Function} Parser function
 */
export function codeBlock(language = '') {
  return function(content) {
    if (typeof content !== 'string') return content;
    
    const langPattern = language ? `(?:${language})?` : '\\w*';
    const regex = new RegExp(`\`\`\`${langPattern}\\s*\\n?([\\s\\S]*?)\\n?\`\`\``, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : content;
  };
}

/**
 * Thinking Parser - Extract thinking content (for reasoning models)
 * @param {string} content - Content to parse
 * @returns {string} Thinking content or empty string
 */
export function thinking(content) {
  if (typeof content !== 'string') return '';
  
  // Look for thinking tags
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkingMatch) {
    return thinkingMatch[1].trim();
  }
  
  // Look for reasoning sections
  const reasoningMatch = content.match(/(?:reasoning|thinking):\s*([\s\S]*?)(?:\n\n|$)/i);
  if (reasoningMatch) {
    return reasoningMatch[1].trim();
  }
  
  return '';
}

/**
 * Content Parser - Extract main content (excluding thinking)
 * @param {string} content - Content to parse
 * @returns {string} Main content
 */
export function content(content) {
  if (typeof content !== 'string') return content;
  
  // Remove thinking tags
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  
  // Remove reasoning sections
  cleaned = cleaned.replace(/(?:reasoning|thinking):\s*[\s\S]*?(?:\n\n|$)/gi, '');
  
  return cleaned.trim();
}

/**
 * Markdown Parser - Basic markdown to HTML conversion
 * @param {string} content - Markdown content
 * @returns {string} HTML content
 */
export function markdown(content) {
  if (typeof content !== 'string') return content;
  
  let html = content;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
  
  // Line breaks
  html = html.replace(/\n/gim, '<br>');
  
  return html;
}

/**
 * Plain Text Parser - Strip all formatting
 * @param {string} content - Content to parse
 * @returns {string} Plain text
 */
export function plainText(content) {
  if (typeof content !== 'string') return content;
  
  // Remove HTML tags
  let text = content.replace(/<[^>]*>/g, '');
  
  // Remove markdown formatting
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  text = text.replace(/`(.*?)`/g, '$1');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * URL Parser - Extract URLs from content
 * @param {string} content - Content to parse
 * @returns {Array} Array of URLs found
 */
export function urls(content) {
  if (typeof content !== 'string') return [];
  
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return content.match(urlRegex) || [];
}

/**
 * Email Parser - Extract email addresses from content
 * @param {string} content - Content to parse
 * @returns {Array} Array of email addresses found
 */
export function emails(content) {
  if (typeof content !== 'string') return [];
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  return content.match(emailRegex) || [];
}

// Export all parsers
export const parsers = {
  json,
  xml,
  codeBlock,
  thinking,
  content,
  markdown,
  plainText,
  urls,
  emails
};

export default parsers;
