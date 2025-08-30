/**
 * Advanced Editor Component for aiFiverr Extension
 * Provides rich text editing with markdown preview and formatting tools
 */

class AdvancedEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showToolbar: true,
      showPreview: true,
      autoSave: true,
      placeholder: 'Start typing...',
      maxHeight: 400,
      ...options
    };
    
    this.isPreviewMode = false;
    this.content = '';
    this.callbacks = {};
    
    this.init();
  }

  /**
   * Initialize the editor
   */
  init() {
    this.createEditor();
    this.attachEventListeners();
    this.addStyles();
  }

  /**
   * Create editor structure
   */
  createEditor() {
    this.container.innerHTML = `
      <div class="advanced-editor">
        ${this.options.showToolbar ? this.createToolbar() : ''}
        <div class="editor-container">
          <div class="editor-tabs">
            <button class="tab-btn active" data-tab="edit">✏️ Edit</button>
            <button class="tab-btn" data-tab="preview">👁️ Preview</button>
          </div>
          <div class="editor-content">
            <textarea class="editor-textarea" placeholder="${this.options.placeholder}"></textarea>
            <div class="editor-preview" style="display: none;"></div>
          </div>
        </div>
        <div class="editor-status">
          <span class="word-count">0 words</span>
          <span class="char-count">0 characters</span>
        </div>
      </div>
    `;

    // Get references
    this.textarea = this.container.querySelector('.editor-textarea');
    this.preview = this.container.querySelector('.editor-preview');
    this.tabBtns = this.container.querySelectorAll('.tab-btn');
    this.wordCount = this.container.querySelector('.word-count');
    this.charCount = this.container.querySelector('.char-count');
  }

  /**
   * Create toolbar HTML
   */
  createToolbar() {
    return `
      <div class="editor-toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)">
            <strong>B</strong>
          </button>
          <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)">
            <em>I</em>
          </button>
          <button class="toolbar-btn" data-action="strikethrough" title="Strikethrough">
            <s>S</s>
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" data-action="heading" title="Heading">H</button>
          <button class="toolbar-btn" data-action="list" title="Bullet List">•</button>
          <button class="toolbar-btn" data-action="numbered-list" title="Numbered List">1.</button>
          <button class="toolbar-btn" data-action="quote" title="Quote">❝</button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" data-action="code" title="Inline Code">&lt;/&gt;</button>
          <button class="toolbar-btn" data-action="code-block" title="Code Block">{ }</button>
          <button class="toolbar-btn" data-action="link" title="Link">🔗</button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" data-action="clear" title="Clear All">🗑️</button>
          <button class="toolbar-btn" data-action="copy" title="Copy All">📋</button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Tab switching
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Toolbar actions
    if (this.options.showToolbar) {
      const toolbar = this.container.querySelector('.editor-toolbar');
      toolbar.addEventListener('click', (e) => {
        if (e.target.classList.contains('toolbar-btn')) {
          const action = e.target.dataset.action;
          this.executeAction(action);
        }
      });
    }

    // Textarea events
    this.textarea.addEventListener('input', () => {
      this.content = this.textarea.value;
      this.updateCounts();
      this.updatePreview();
      this.autoResize();
      
      if (this.callbacks.onChange) {
        this.callbacks.onChange(this.content);
      }
    });

    this.textarea.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // Auto-resize
    this.textarea.addEventListener('input', () => this.autoResize());
  }

  /**
   * Switch between edit and preview tabs
   */
  switchTab(tab) {
    this.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (tab === 'edit') {
      this.textarea.style.display = 'block';
      this.preview.style.display = 'none';
      this.isPreviewMode = false;
      this.textarea.focus();
    } else {
      this.textarea.style.display = 'none';
      this.preview.style.display = 'block';
      this.isPreviewMode = true;
      this.updatePreview();
    }
  }

  /**
   * Execute toolbar actions
   */
  executeAction(action) {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selectedText = this.textarea.value.substring(start, end);
    const beforeText = this.textarea.value.substring(0, start);
    const afterText = this.textarea.value.substring(end);

    let newText = '';
    let newCursorPos = start;

    switch (action) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        newCursorPos = start + (selectedText ? newText.length : 2);
        break;
      
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        newCursorPos = start + (selectedText ? newText.length : 1);
        break;
      
      case 'strikethrough':
        newText = `~~${selectedText || 'strikethrough text'}~~`;
        newCursorPos = start + (selectedText ? newText.length : 2);
        break;
      
      case 'heading':
        newText = `## ${selectedText || 'Heading'}`;
        newCursorPos = start + newText.length;
        break;
      
      case 'list':
        newText = `- ${selectedText || 'List item'}`;
        newCursorPos = start + newText.length;
        break;
      
      case 'numbered-list':
        newText = `1. ${selectedText || 'List item'}`;
        newCursorPos = start + newText.length;
        break;
      
      case 'quote':
        newText = `> ${selectedText || 'Quote'}`;
        newCursorPos = start + newText.length;
        break;
      
      case 'code':
        newText = `\`${selectedText || 'code'}\``;
        newCursorPos = start + (selectedText ? newText.length : 1);
        break;
      
      case 'code-block':
        newText = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
        newCursorPos = start + (selectedText ? newText.length : 4);
        break;
      
      case 'link':
        const url = selectedText.startsWith('http') ? selectedText : 'https://';
        const linkText = selectedText.startsWith('http') ? 'Link text' : selectedText || 'Link text';
        newText = `[${linkText}](${url})`;
        newCursorPos = start + newText.length;
        break;
      
      case 'clear':
        if (confirm('Clear all content?')) {
          this.textarea.value = '';
          this.content = '';
          this.updateCounts();
          this.updatePreview();
        }
        return;
      
      case 'copy':
        navigator.clipboard.writeText(this.textarea.value);
        this.showToast('Content copied to clipboard!');
        return;
    }

    // Apply the change
    this.textarea.value = beforeText + newText + afterText;
    this.content = this.textarea.value;
    
    // Set cursor position
    this.textarea.focus();
    this.textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Update UI
    this.updateCounts();
    this.updatePreview();
    this.autoResize();
    
    if (this.callbacks.onChange) {
      this.callbacks.onChange(this.content);
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeydown(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          this.executeAction('bold');
          break;
        case 'i':
          e.preventDefault();
          this.executeAction('italic');
          break;
        case 'k':
          e.preventDefault();
          this.executeAction('link');
          break;
      }
    }

    // Tab handling for code blocks
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      
      this.textarea.value = this.textarea.value.substring(0, start) + 
                           '  ' + 
                           this.textarea.value.substring(end);
      
      this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
      this.content = this.textarea.value;
      this.updateCounts();
    }
  }

  /**
   * Update word and character counts
   */
  updateCounts() {
    const text = this.textarea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
  }

  /**
   * Update preview with rendered markdown
   */
  updatePreview() {
    if (window.markdownRenderer) {
      this.preview.innerHTML = window.markdownRenderer.render(this.content);
    } else {
      // Fallback simple rendering
      this.preview.innerHTML = this.content.replace(/\n/g, '<br>');
    }
  }

  /**
   * Auto-resize textarea
   */
  autoResize() {
    this.textarea.style.height = 'auto';
    const newHeight = Math.min(this.textarea.scrollHeight, this.options.maxHeight);
    this.textarea.style.height = newHeight + 'px';
  }

  /**
   * Set content
   */
  setContent(content) {
    this.content = content;
    this.textarea.value = content;
    this.updateCounts();
    this.updatePreview();
    this.autoResize();
  }

  /**
   * Get content
   */
  getContent() {
    return this.content;
  }

  /**
   * Set callback functions
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Show toast message
   */
  showToast(message) {
    // Create or update toast
    let toast = document.querySelector('.editor-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'editor-toast';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }

  /**
   * Add editor styles
   */
  addStyles() {
    if (document.getElementById('advanced-editor-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'advanced-editor-styles';
    styles.textContent = `
      .advanced-editor {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .editor-toolbar {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        padding: 8px 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .toolbar-group {
        display: flex;
        gap: 4px;
        padding-right: 8px;
        border-right: 1px solid #e5e7eb;
      }

      .toolbar-group:last-child {
        border-right: none;
      }

      .toolbar-btn {
        background: none;
        border: 1px solid transparent;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        color: #374151;
        transition: all 0.2s ease;
        min-width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toolbar-btn:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
      }

      .toolbar-btn:active {
        background: #d1d5db;
      }

      .editor-tabs {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        padding: 0 12px;
      }

      .tab-btn {
        background: none;
        border: none;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
        color: #6b7280;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
      }

      .tab-btn.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
      }

      .tab-btn:hover:not(.active) {
        color: #374151;
      }

      .editor-content {
        position: relative;
      }

      .editor-textarea {
        width: 100%;
        min-height: 120px;
        max-height: 400px;
        padding: 16px;
        border: none;
        outline: none;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
        color: #374151;
        background: white;
        box-sizing: border-box;
      }

      .editor-textarea::placeholder {
        color: #9ca3af;
      }

      .editor-preview {
        padding: 16px;
        min-height: 120px;
        max-height: 400px;
        overflow-y: auto;
        background: white;
      }

      .editor-status {
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        padding: 6px 12px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #6b7280;
      }

      .editor-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 10000;
        display: none;
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Destroy the editor
   */
  destroy() {
    this.container.innerHTML = '';
  }
}

// Export for global use
window.AdvancedEditor = AdvancedEditor;
