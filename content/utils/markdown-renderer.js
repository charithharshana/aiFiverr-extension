/**
 * Advanced Markdown Renderer for aiFiverr Extension
 * Provides Google Gemini-like formatting with rich HTML output
 */

class MarkdownRenderer {
  constructor() {
    this.codeBlockCounter = 0;
    this.tableCounter = 0;
  }

  /**
   * Convert markdown to HTML with advanced formatting
   */
  render(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    let html = markdown;

    // Process in order: code blocks first to protect content
    html = this.processCodeBlocks(html);
    html = this.processTables(html);
    html = this.processHeaders(html);
    html = this.processLists(html);
    html = this.processBlockquotes(html);
    html = this.processInlineFormatting(html);
    html = this.processLinks(html);
    html = this.processLineBreaks(html);
    html = this.processEmphasis(html);

    return this.wrapInContainer(html);
  }

  /**
   * Process code blocks with syntax highlighting
   */
  processCodeBlocks(text) {
    // Process fenced code blocks (```)
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const id = `code-block-${++this.codeBlockCounter}`;
      const lang = language || 'text';
      const escapedCode = this.escapeHtml(code.trim());
      
      return `<div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${lang}</span>
          <button class="copy-code-btn" onclick="copyCodeBlock('${id}')" title="Copy code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="m5 15-4-4 4-4"></path>
            </svg>
          </button>
        </div>
        <pre class="code-block" id="${id}"><code class="language-${lang}">${escapedCode}</code></pre>
      </div>`;
    });

    // Process inline code
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    return text;
  }

  /**
   * Process tables with enhanced styling
   */
  processTables(text) {
    const tableRegex = /^\|(.+)\|\s*\n\|[-\s|:]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm;
    
    return text.replace(tableRegex, (match, header, rows) => {
      const id = `table-${++this.tableCounter}`;
      
      // Process header
      const headerCells = header.split('|').map(cell => 
        `<th>${cell.trim()}</th>`
      ).join('');
      
      // Process rows
      const rowsHtml = rows.trim().split('\n').map(row => {
        if (!row.trim()) return '';
        const cells = row.split('|').slice(1, -1).map(cell => 
          `<td>${this.processInlineFormatting(cell.trim())}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).filter(row => row).join('');

      return `<div class="table-container">
        <table class="markdown-table" id="${id}">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    });
  }

  /**
   * Process headers with anchor links
   */
  processHeaders(text) {
    return text.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      const id = this.generateId(content);
      const processedContent = this.processInlineFormatting(content);
      
      return `<h${level} class="markdown-header" id="${id}">
        <a href="#${id}" class="header-anchor" aria-hidden="true">#</a>
        ${processedContent}
      </h${level}>`;
    });
  }

  /**
   * Process lists with proper nesting
   */
  processLists(text) {
    // Process unordered lists
    text = text.replace(/^(\s*)([-*+])\s+(.+)$/gm, (match, indent, marker, content) => {
      const level = Math.floor(indent.length / 2);
      const processedContent = this.processInlineFormatting(content);
      return `<li class="list-item" data-level="${level}">${processedContent}</li>`;
    });

    // Process ordered lists
    text = text.replace(/^(\s*)(\d+\.)\s+(.+)$/gm, (match, indent, marker, content) => {
      const level = Math.floor(indent.length / 2);
      const processedContent = this.processInlineFormatting(content);
      return `<li class="list-item ordered" data-level="${level}">${processedContent}</li>`;
    });

    // Wrap consecutive list items
    text = text.replace(/((?:<li class="list-item"[^>]*>.*?<\/li>\s*)+)/gs, (match) => {
      return `<ul class="markdown-list">${match}</ul>`;
    });

    text = text.replace(/((?:<li class="list-item ordered"[^>]*>.*?<\/li>\s*)+)/gs, (match) => {
      return `<ol class="markdown-list ordered">${match}</ol>`;
    });

    return text;
  }

  /**
   * Process blockquotes
   */
  processBlockquotes(text) {
    return text.replace(/^>\s+(.+)$/gm, (match, content) => {
      const processedContent = this.processInlineFormatting(content);
      return `<blockquote class="markdown-blockquote">${processedContent}</blockquote>`;
    });
  }

  /**
   * Process inline formatting (bold, italic, etc.)
   */
  processInlineFormatting(text) {
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="markdown-bold">$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong class="markdown-bold">$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em class="markdown-italic">$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em class="markdown-italic">$1</em>');
    
    // Strikethrough
    text = text.replace(/~~([^~]+)~~/g, '<del class="markdown-strikethrough">$1</del>');
    
    return text;
  }

  /**
   * Process links
   */
  processLinks(text) {
    // Markdown links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="markdown-link" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Auto-links
    text = text.replace(/(https?:\/\/[^\s]+)/g, 
      '<a href="$1" class="markdown-link auto-link" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return text;
  }

  /**
   * Process line breaks and paragraphs
   */
  processLineBreaks(text) {
    // Convert double line breaks to paragraphs
    text = text.replace(/\n\n+/g, '</p><p class="markdown-paragraph">');
    
    // Wrap in paragraph if not already wrapped
    if (!text.startsWith('<')) {
      text = '<p class="markdown-paragraph">' + text;
    }
    if (!text.endsWith('>')) {
      text = text + '</p>';
    }
    
    // Single line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  /**
   * Process emphasis and special formatting
   */
  processEmphasis(text) {
    // Highlight important text
    text = text.replace(/==(.*?)==/g, '<mark class="markdown-highlight">$1</mark>');
    
    // Subscript and superscript
    text = text.replace(/~([^~]+)~/g, '<sub class="markdown-subscript">$1</sub>');
    text = text.replace(/\^([^^]+)\^/g, '<sup class="markdown-superscript">$1</sup>');
    
    return text;
  }

  /**
   * Wrap content in styled container
   */
  wrapInContainer(html) {
    return `<div class="markdown-content">${html}</div>`;
  }

  /**
   * Generate ID from text
   */
  generateId(text) {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS styles for markdown rendering
   */
  getStyles() {
    return `
      .markdown-content {
        font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.7;
        color: #202124;
        max-width: 100%;
        word-wrap: break-word;
        font-size: 14px;
        letter-spacing: 0.2px;
      }

      .markdown-header {
        margin: 1.8em 0 0.8em 0;
        font-weight: 500;
        line-height: 1.4;
        position: relative;
        color: #202124;
      }

      .markdown-header:first-child {
        margin-top: 0.5em;
      }

      .markdown-header h1 {
        font-size: 1.75em;
        color: #1a73e8;
        font-weight: 400;
        border-bottom: 1px solid #e8eaed;
        padding-bottom: 0.5em;
      }
      .markdown-header h2 {
        font-size: 1.5em;
        color: #202124;
        font-weight: 500;
        margin-top: 2em;
      }
      .markdown-header h3 {
        font-size: 1.25em;
        color: #202124;
        font-weight: 500;
      }
      .markdown-header h4 {
        font-size: 1.1em;
        color: #5f6368;
        font-weight: 500;
      }
      .markdown-header h5 {
        font-size: 1em;
        color: #5f6368;
        font-weight: 500;
      }
      .markdown-header h6 {
        font-size: 0.9em;
        color: #80868b;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .header-anchor {
        opacity: 0;
        margin-left: 8px;
        color: #3b82f6;
        text-decoration: none;
        transition: opacity 0.2s ease;
      }

      .markdown-header:hover .header-anchor {
        opacity: 1;
      }

      .markdown-paragraph {
        margin: 1em 0;
        line-height: 1.7;
        color: #202124;
      }

      .markdown-list {
        margin: 1em 0;
        padding-left: 1.8em;
      }

      .list-item {
        margin: 0.4em 0;
        line-height: 1.7;
        color: #202124;
      }

      .markdown-list li::marker {
        color: #1a73e8;
        font-weight: 500;
      }

      .markdown-blockquote {
        margin: 1.5em 0;
        padding: 1em 1.5em;
        border-left: 4px solid #1a73e8;
        background: #f8f9fa;
        font-style: normal;
        color: #5f6368;
        border-radius: 0 8px 8px 0;
        position: relative;
      }

      .markdown-blockquote::before {
        content: '"';
        font-size: 3em;
        color: #1a73e8;
        position: absolute;
        top: -0.2em;
        left: 0.3em;
        opacity: 0.3;
        font-family: Georgia, serif;
      }

      .code-block-container {
        margin: 1.5em 0;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #e8eaed;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .code-block-header {
        background: #f8f9fa;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e8eaed;
      }

      .code-language {
        font-size: 12px;
        color: #5f6368;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .copy-code-btn {
        background: none;
        border: 1px solid #dadce0;
        color: #5f6368;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s ease;
        font-size: 12px;
        font-weight: 500;
      }

      .copy-code-btn:hover {
        background: #f1f3f4;
        border-color: #1a73e8;
        color: #1a73e8;
      }

      .code-block {
        background: #202124;
        color: #e8eaed;
        padding: 1.5em;
        margin: 0;
        overflow-x: auto;
        font-family: 'Roboto Mono', 'SF Mono', Monaco, 'Cascadia Code', Consolas, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
      }

      .inline-code {
        background: #f1f3f4;
        color: #202124;
        padding: 3px 6px;
        border-radius: 6px;
        font-family: 'Roboto Mono', 'SF Mono', Monaco, 'Cascadia Code', Consolas, 'Courier New', monospace;
        font-size: 0.9em;
        font-weight: 500;
      }

      .table-container {
        margin: 1em 0;
        overflow-x: auto;
      }

      .markdown-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .markdown-table th {
        background: #f9fafb;
        padding: 12px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
      }

      .markdown-table td {
        padding: 12px;
        border-bottom: 1px solid #f3f4f6;
      }

      .markdown-table tr:last-child td {
        border-bottom: none;
      }

      .markdown-bold {
        font-weight: 600;
        color: #111827;
      }

      .markdown-italic {
        font-style: italic;
      }

      .markdown-strikethrough {
        text-decoration: line-through;
        color: #6b7280;
      }

      .markdown-link {
        color: #3b82f6;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
      }

      .markdown-link:hover {
        border-bottom-color: #3b82f6;
      }

      .markdown-highlight {
        background: #fef3c7;
        color: #92400e;
        padding: 2px 4px;
        border-radius: 3px;
      }

      .markdown-subscript {
        font-size: 0.8em;
        vertical-align: sub;
      }

      .markdown-superscript {
        font-size: 0.8em;
        vertical-align: super;
      }
    `;
  }
}

// Global utility functions for code copying
window.copyCodeBlock = function(blockId) {
  const codeBlock = document.getElementById(blockId);
  if (codeBlock) {
    const text = codeBlock.textContent;
    navigator.clipboard.writeText(text).then(() => {
      // Show success feedback
      const btn = codeBlock.parentElement.querySelector('.copy-code-btn');
      const originalContent = btn.innerHTML;
      btn.innerHTML = '<span style="color: #10b981;">✓</span>';
      setTimeout(() => {
        btn.innerHTML = originalContent;
      }, 1000);
    });
  }
};

// Create global instance
window.markdownRenderer = new MarkdownRenderer();
