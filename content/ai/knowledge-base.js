/**
 * Knowledge Base Manager
 * Handles custom prompts, variables, and reusable content for AI interactions
 */

class KnowledgeBaseManager {
  constructor() {
    this.variables = new Map();
    this.customPrompts = new Map();
    this.templates = new Map();
    this.files = new Map(); // Store file references
    this.fileCache = new Map(); // Cache file data
    this.init();
  }

  async init() {
    // First, clean up any existing fake templates
    await this.cleanupFakeTemplates();

    await this.loadKnowledgeBase();
    await this.loadCustomPrompts();
    await this.loadTemplates();

    // Only load knowledge base files if authenticated to prevent errors on fresh install
    if (this.isUserAuthenticated()) {
      await this.loadKnowledgeBaseFiles();

      // Initialize comprehensive file lifecycle manager
      await this.initializeFileLifecycleManager();

      // Sync with Gemini Files API in background to avoid blocking initialization
      this.syncWithGeminiFilesInBackground();
    } else {
      if (window.aiFiverrDebug) {
        console.log('aiFiverr KB: Skipping file operations - user not authenticated');
      }
    }
  }

  /**
   * Check if user is authenticated with Google
   */
  isUserAuthenticated() {
    return window.googleAuthService && window.googleAuthService.isUserAuthenticated();
  }

  /**
   * Clean up fake templates that were causing confusion with AI prompts
   */
  async cleanupFakeTemplates() {
    try {
      if (window.storageManager) {
        // Clear templates from storage
        await window.storageManager.set({ templates: {} });
        console.log('aiFiverr KB: Cleaned up fake templates from storage');
      }

      // Clear any cached templates
      this.templates.clear();
      console.log('aiFiverr KB: Fake templates cleanup completed');
    } catch (error) {
      console.error('aiFiverr KB: Failed to cleanup fake templates:', error);
    }
  }

  /**
   * Sync with Gemini Files API in background without blocking initialization
   */
  syncWithGeminiFilesInBackground() {
    setTimeout(async () => {
      try {
        await this.syncWithGeminiFiles();
        // Only log if debugging is enabled
        if (window.aiFiverrDebug) {
          console.log('aiFiverr KB: Background sync with Gemini Files completed');
        }
      } catch (error) {
        console.warn('aiFiverr KB: Background sync with Gemini Files failed:', error);
      }
    }, 2000); // Wait 2 seconds after initialization
  }

  /**
   * Load knowledge base variables from storage
   */
  async loadKnowledgeBase() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping knowledge base load');
        return;
      }

      const data = await window.storageManager.getKnowledgeBase();
      this.variables.clear();

      Object.entries(data).forEach(([key, value]) => {
        this.variables.set(key, value);
      });
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    }
  }

  /**
   * Load custom prompts from storage
   */
  async loadCustomPrompts() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping custom prompts load');
        return;
      }

      const result = await window.storageManager.get('customPrompts');
      const prompts = result.customPrompts || {};

      this.customPrompts.clear();
      Object.entries(prompts).forEach(([key, prompt]) => {
        this.customPrompts.set(key, prompt);
      });

      // Don't automatically add default prompts as custom prompts
      // Users should explicitly save default prompts as custom if they want to edit them
    } catch (error) {
      console.error('Failed to load custom prompts:', error);
    }
  }

  /**
   * Load templates from storage
   */
  async loadTemplates() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping templates load');
        return;
      }

      // Clear any existing templates to prevent fake prompts from showing
      this.templates.clear();

      // Also clear from storage to prevent them from reappearing
      await window.storageManager.set({ templates: {} });

      console.log('aiFiverr KB: Templates cleared to prevent confusion with AI prompts');
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * Add default prompts (deprecated - now handled by prompt manager)
   */
  addDefaultPrompts() {
    // This method is deprecated - default prompts are now managed by the centralized prompt manager
    // Only add if prompt manager is not available (fallback)
    if (window.promptManager && window.promptManager.initialized) {
      console.log('aiFiverr KB: Skipping default prompts - using centralized prompt manager');
      return;
    }

    console.warn('aiFiverr KB: Prompt manager not available, using fallback default prompts');
    // Minimal fallback - the prompt manager should handle this
  }

  /**
   * Add default templates - DISABLED
   * These client communication templates were causing confusion by appearing as AI prompts
   */
  addDefaultTemplates() {
    // No default templates - user should create their own if needed
    console.log('aiFiverr KB: Default templates disabled to prevent confusion with AI prompts');
  }

  /**
   * Add or update knowledge base variable
   */
  async addVariable(key, value) {
    this.variables.set(key, value);
    await this.saveKnowledgeBase();
  }

  /**
   * Remove knowledge base variable
   */
  async removeVariable(key) {
    this.variables.delete(key);
    await this.saveKnowledgeBase();
  }

  /**
   * Get knowledge base variable
   */
  getVariable(key) {
    return this.variables.get(key) || '';
  }

  /**
   * Get all variables as object
   */
  getAllVariables() {
    return Object.fromEntries(this.variables);
  }

  /**
   * Replace variables in text
   */
  replaceVariables(text) {
    let result = text;

    this.variables.forEach((value, key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  /**
   * Replace file references in text
   */
  replaceFileReferences(text) {
    let processedText = text;

    // Replace file references with file information
    this.files.forEach((fileData, key) => {
      const regex = new RegExp(`{{file:${key}}}`, 'g');
      const fileInfo = this.formatFileReference(fileData);
      processedText = processedText.replace(regex, fileInfo);
    });

    return processedText;
  }

  /**
   * Format file reference for inclusion in text
   */
  formatFileReference(fileData) {
    let fileInfo = `[File: ${fileData.name}]`;

    if (fileData.mimeType) {
      fileInfo += `\nType: ${fileData.mimeType}`;
    }

    if (fileData.size) {
      fileInfo += `\nSize: ${this.formatFileSize(fileData.size)}`;
    }

    if (fileData.geminiUri) {
      fileInfo += `\nGemini URI: ${fileData.geminiUri}`;
    } else if (fileData.webViewLink) {
      fileInfo += `\nDrive Link: ${fileData.webViewLink}`;
    }

    fileInfo += '\n[End of file reference]';

    return fileInfo;
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    // Handle undefined, null, or non-numeric values
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    // Ensure i is within bounds
    const sizeIndex = Math.min(i, sizes.length - 1);
    const size = Math.round(bytes / Math.pow(1024, sizeIndex) * 100) / 100;

    return size + ' ' + sizes[sizeIndex];
  }

  /**
   * Add or update custom prompt
   */
  async addCustomPrompt(key, prompt) {
    this.customPrompts.set(key, prompt);
    await this.saveCustomPrompts();
  }

  /**
   * Remove custom prompt
   */
  async removeCustomPrompt(key) {
    this.customPrompts.delete(key);
    await this.saveCustomPrompts();
  }

  /**
   * Get custom prompt
   */
  getCustomPrompt(key) {
    return this.customPrompts.get(key);
  }

  /**
   * Get all custom prompts
   */
  getAllCustomPrompts() {
    return Object.fromEntries(this.customPrompts);
  }

  /**
   * Get all prompts (delegates to prompt manager)
   * NOTE: This does NOT include templates - templates are separate from AI prompts
   */
  getAllPrompts() {
    // Use centralized prompt manager if available
    if (window.promptManager && window.promptManager.initialized) {
      return window.promptManager.getAllPrompts();
    }

    // Fallback to local prompts only (no templates)
    const defaultPrompts = this.getDefaultPrompts();
    const customPrompts = Object.fromEntries(this.customPrompts);
    return { ...defaultPrompts, ...customPrompts };
  }

  /**
   * Get default prompts (delegates to prompt manager)
   */
  getDefaultPrompts() {
    // Use centralized prompt manager if available
    if (window.promptManager && window.promptManager.initialized) {
      return window.promptManager.getDefaultPrompts();
    }

    // Fallback prompts if prompt manager not available
    return {
      'summary': {
        name: 'Summary',
        description: 'Extract key details',
        prompt: 'Please go through the attached documents.\n\nSummarize the conversation: {conversation}\n\nExtract key details like budget, timeline, and next steps. Write a clear summary. No markdown or explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'follow_up': {
        name: 'Follow-up',
        description: 'Write follow-up message',
        prompt: 'Please go through the attached documents.\n\nWrite a friendly and professional follow-up message based on this conversation: {conversation}\n\nMention a specific detail we discussed and include clear next steps. No markdown or explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'proposal': {
        name: 'Proposal',
        description: 'Create project proposal',
        prompt: 'Create a short and concise project proposal (under 3000 characters) based on this:\n\n{conversation}\n\nextract and Include more example urls from my previous work.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'translate': {
        name: 'Translate',
        description: 'Translate text',
        prompt: 'Please go through the attached documents.\n\nTranslate this conversation: {conversation}\n\nInto this language: {language}\n\nProvide only the translated text. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve_translate': {
        name: 'Improve & Translate',
        description: 'Improve and translate',
        prompt: 'Please go through the attached documents.\n\nImprove the grammar and tone of this message: {conversation}\n\nThen, translate the improved message to English. Use my bio: {bio} to add relevant details about me as a Fiverr freelancer. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      },
      'improve': {
        name: 'Improve',
        description: 'Improve message',
        prompt: 'Please go through the attached documents.\n\nImprove this message: {conversation}\n\nMake it grammatically correct, clear, and professional, but keep the original meaning. No explanations.',
        knowledgeBaseFiles: 'AUTO_LOAD_ALL'
      }
    };
  }

  /**
   * Process prompt with variables and context
   * NEW: Now works with variable processor for smart variable and file inclusion
   */
  async processPrompt(promptKey, context = {}) {
    console.log('=== aiFiverr KB: Processing prompt ===');
    console.log('aiFiverr KB: Processing prompt:', promptKey);
    console.log('aiFiverr KB: Context provided:', context);

    // First try to get from custom prompts
    let prompt = this.getCustomPrompt(promptKey);
    console.log('aiFiverr KB: Custom prompt found:', !!prompt);

    // If not found in custom, try default prompts
    if (!prompt) {
      const defaultPrompts = this.getDefaultPrompts();
      prompt = defaultPrompts[promptKey];
      console.log('aiFiverr KB: Default prompt found:', !!prompt);
    }

    if (!prompt) {
      console.warn('aiFiverr KB: Prompt not found:', promptKey);
      console.log('aiFiverr KB: Available custom prompts:', Array.from(this.customPrompts.keys()));
      console.log('aiFiverr KB: Available default prompts:', Object.keys(this.getDefaultPrompts()));
      throw new Error(`Prompt '${promptKey}' not found`);
    }

    // Store original knowledgeBaseFiles value for processing
    const originalKnowledgeBaseFiles = prompt.knowledgeBaseFiles;

    // Ensure knowledgeBaseFiles is always an array for forEach operations
    let knowledgeBaseFilesForLogging = [];
    if (!prompt.knowledgeBaseFiles) {
      knowledgeBaseFilesForLogging = [];
    } else if (typeof prompt.knowledgeBaseFiles === 'string') {
      // Handle special string values like 'AUTO_LOAD_ALL'
      if (prompt.knowledgeBaseFiles === 'AUTO_LOAD_ALL') {
        // Will be resolved later in the function
        console.log('aiFiverr KB: Prompt configured to auto-load all knowledge base files');
        knowledgeBaseFilesForLogging = [];
      } else {
        console.warn('aiFiverr KB: Unknown knowledgeBaseFiles string value:', prompt.knowledgeBaseFiles);
        knowledgeBaseFilesForLogging = [];
      }
    } else if (Array.isArray(prompt.knowledgeBaseFiles)) {
      knowledgeBaseFilesForLogging = prompt.knowledgeBaseFiles;
    } else {
      console.warn('aiFiverr KB: knowledgeBaseFiles is not an array, converting:', typeof prompt.knowledgeBaseFiles);
      knowledgeBaseFilesForLogging = [];
    }

    console.log('aiFiverr KB: Found prompt:', {
      name: prompt.name,
      description: prompt.description,
      knowledgeBaseFilesType: typeof originalKnowledgeBaseFiles,
      knowledgeBaseFilesValue: originalKnowledgeBaseFiles,
      hasKnowledgeBaseFiles: knowledgeBaseFilesForLogging.length > 0,
      knowledgeBaseFilesCount: knowledgeBaseFilesForLogging.length
    });

    // Log the knowledge base files configuration (only if it's an array with items)
    if (knowledgeBaseFilesForLogging.length > 0) {
      console.log('=== aiFiverr KB: Prompt Knowledge Base Files Configuration ===');
      knowledgeBaseFilesForLogging.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          id: file.id,
          name: file.name,
          driveFileId: file.driveFileId,
          geminiUri: file.geminiUri,
          hasGeminiUri: !!file.geminiUri
        });
      });
    }

    let processedPrompt = prompt.prompt;
    let knowledgeBaseFiles = [];

    // NEW APPROACH: Use variable processor if available for smart processing
    if (window.variableProcessor) {
      console.log('aiFiverr KB: Using variable processor for smart prompt processing');
      try {
        const processedResult = await window.variableProcessor.processPrompt(processedPrompt, context);
        processedPrompt = processedResult.prompt;
        knowledgeBaseFiles = processedResult.knowledgeBaseFiles || [];

        console.log('aiFiverr KB: Variable processor results:');
        console.log('- Variables used:', processedResult.usedVariables);
        console.log('- Files used:', processedResult.usedFiles);
      } catch (error) {
        console.warn('aiFiverr KB: Variable processor failed, using fallback:', error);
        // Fall back to old method
        processedPrompt = this.replaceVariables(processedPrompt);
        Object.entries(context).forEach(([key, value]) => {
          const regex = new RegExp(`{${key}}`, 'g');
          processedPrompt = processedPrompt.replace(regex, value);
        });
      }
    } else {
      // Fallback to old method
      console.log('aiFiverr KB: Variable processor not available, using legacy processing');
      processedPrompt = this.replaceVariables(processedPrompt);
      Object.entries(context).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        processedPrompt = processedPrompt.replace(regex, value);
      });
    }

    // Determine which files to attach - use original value for processing
    let filesToResolve = originalKnowledgeBaseFiles || [];

    // CRITICAL FIX: Handle AUTO_LOAD_ALL directive
    if (filesToResolve === 'AUTO_LOAD_ALL' || (Array.isArray(filesToResolve) && filesToResolve.includes('AUTO_LOAD_ALL'))) {
      console.log('aiFiverr KB: AUTO_LOAD_ALL detected - loading all available knowledge base files');
      const allFiles = await this.getKnowledgeBaseFilesFromBackground();
      if (allFiles.success && allFiles.data) {
        filesToResolve = allFiles.data.filter(file => file.geminiUri);
        console.log('aiFiverr KB: Auto-loaded files:', filesToResolve.length);
        console.log('aiFiverr KB: Auto-loaded file details:', filesToResolve.map(f => ({
          name: f.name,
          id: f.id,
          hasGeminiUri: !!f.geminiUri
        })));
      } else {
        console.warn('aiFiverr KB: Failed to auto-load files, falling back to empty array');
        filesToResolve = [];
      }
    }

    // Log file selection for debugging
    if (filesToResolve.length === 0) {
      console.log('aiFiverr KB: No specific files configured for prompt - no files will be attached');
    } else {
      console.log('aiFiverr KB: Using configured files for prompt:', filesToResolve.map(f => f.name || f.id || f));
    }

    console.log('aiFiverr KB: Files to resolve:', filesToResolve.length, 'files');

    // Resolve knowledge base files to full file data
    const resolvedFiles = await this.resolveKnowledgeBaseFiles(filesToResolve);

    console.log('aiFiverr KB: Resolved files for prompt:', resolvedFiles.length, 'files with geminiUri');

    // Return both processed prompt and knowledge base files
    return {
      prompt: processedPrompt,
      knowledgeBaseFiles: resolvedFiles
    };
  }

  /**
   * Add or update template
   */
  async addTemplate(key, template) {
    this.templates.set(key, template);
    await this.saveTemplates();
  }

  /**
   * Remove template
   */
  async removeTemplate(key) {
    this.templates.delete(key);
    await this.saveTemplates();
  }

  /**
   * Get template
   */
  getTemplate(key) {
    return this.templates.get(key);
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Object.fromEntries(this.templates);
  }

  /**
   * Load knowledge base files from storage
   */
  async loadKnowledgeBaseFiles() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping knowledge base files load');
        return;
      }

      const result = await window.storageManager.get('knowledgeBaseFiles');
      const files = result.knowledgeBaseFiles || {};

      this.files.clear();
      Object.entries(files).forEach(([key, fileData]) => {
        this.files.set(key, fileData);
      });

      // Only log if debugging is enabled
      if (window.aiFiverrDebug) {
        console.log('aiFiverr KB: Loaded', this.files.size, 'file references');
      }
    } catch (error) {
      console.error('Failed to load knowledge base files:', error);
    }
  }

  /**
   * Save knowledge base files to storage
   */
  async saveKnowledgeBaseFiles() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping knowledge base files save');
        return;
      }

      const filesObject = Object.fromEntries(this.files);
      await window.storageManager.set({ knowledgeBaseFiles: filesObject });
    } catch (error) {
      console.error('Failed to save knowledge base files:', error);
    }
  }

  /**
   * Add file reference to knowledge base
   */
  async addFileReference(key, fileData) {
    this.files.set(key, {
      ...fileData,
      addedAt: new Date().toISOString(),
      type: 'file'
    });
    await this.saveKnowledgeBaseFiles();
  }

  /**
   * Remove file reference from knowledge base
   */
  async removeFileReference(key) {
    this.files.delete(key);
    this.fileCache.delete(key);
    await this.saveKnowledgeBaseFiles();
  }

  /**
   * Get file reference
   */
  getFileReference(key) {
    return this.files.get(key);
  }

  /**
   * Get all file references
   */
  getAllFileReferences() {
    return Object.fromEntries(this.files);
  }

  /**
   * Get all knowledge base files with valid geminiUri for API attachment
   * Enhanced with comprehensive deduplication and validation
   */
  async getKnowledgeBaseFiles() {
    if (window.aiFiverrDebug) {
      console.log('=== aiFiverr KB: Getting knowledge base files for API attachment ===');
    }

    try {
      // Get all files from our local storage
      const allFiles = Array.from(this.files.values());
      if (window.aiFiverrDebug) {
        console.log('aiFiverr KB: Total files in local storage:', allFiles.length);
      }

      // Filter files that have valid geminiUri and are not expired
      const validFiles = allFiles.filter(file => {
        const hasGeminiUri = !!file.geminiUri;
        const isNotExpired = !this.isFileExpired(file);

        if (window.aiFiverrDebug) {
          console.log('aiFiverr KB: File validation:', {
            name: file.name,
            hasGeminiUri,
            isNotExpired,
            geminiUri: file.geminiUri ? 'present' : 'missing'
          });
        }

        return hasGeminiUri && isNotExpired;
      });

      if (window.aiFiverrDebug) {
        console.log('aiFiverr KB: Valid files before deduplication:', validFiles.length);
      }

      // Convert to API format first
      const apiFiles = validFiles.map(file => ({
        id: file.driveFileId || file.id,
        name: file.name,
        mimeType: file.mimeType,
        geminiUri: file.geminiUri,
        size: file.size
      }));

      // Apply comprehensive deduplication
      const deduplicatedFiles = this.deduplicateFilesForAPI(apiFiles);

      console.log('aiFiverr KB: Returning deduplicated files for API:', deduplicatedFiles.map(f => ({
        name: f.name,
        hasGeminiUri: !!f.geminiUri,
        mimeType: f.mimeType,
        signature: f.signature
      })));

      return deduplicatedFiles;
    } catch (error) {
      console.error('aiFiverr KB: Error getting knowledge base files:', error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Get knowledge base files with smart attachment logic and comprehensive deduplication
   * Enhanced version that supports manual selection, prompt analysis, and robust duplicate prevention
   */
  async getKnowledgeBaseFilesOptimized(options = {}) {
    try {
      console.log('aiFiverr KB: Getting knowledge base files with optimized logic, options:', options);

      let candidateFiles = [];

      // Priority 1: Use manually selected files if provided
      if (options.manuallySelectedFiles && options.manuallySelectedFiles.length > 0) {
        console.log('aiFiverr KB: Using manually selected files:', options.manuallySelectedFiles.length);
        candidateFiles = await this.resolveKnowledgeBaseFiles(options.manuallySelectedFiles);
      }
      // Priority 2: Use prompt-referenced files if specified
      else if (options.promptReferencedFiles && options.promptReferencedFiles.length > 0) {
        console.log('aiFiverr KB: Using prompt-referenced files:', options.promptReferencedFiles.length);
        candidateFiles = await this.resolveKnowledgeBaseFiles(options.promptReferencedFiles);
      }
      // Priority 3: Smart selection based on context (if enabled)
      else if (options.enableSmartSelection && options.promptText) {
        console.log('aiFiverr KB: Attempting smart file selection based on prompt context');
        const smartFiles = await this.getSmartSelectedFiles(options.promptText);
        if (smartFiles.length > 0) {
          candidateFiles = smartFiles;
        }
      }
      // Priority 4: Fallback to original behavior if explicitly requested
      else if (options.fallbackToAll === true) {
        console.log('aiFiverr KB: Falling back to all available files');
        candidateFiles = await this.getKnowledgeBaseFiles();
      }

      // Apply comprehensive deduplication to all candidate files
      const deduplicatedFiles = this.deduplicateFilesForAPI(candidateFiles);

      // If no files found and fallback is allowed, try one more time
      if (deduplicatedFiles.length === 0 && options.fallbackToAll === true) {
        console.log('aiFiverr KB: No files after deduplication, trying direct file access');
        const allFiles = Array.from(this.files.values());
        const validFiles = allFiles.filter(file => this.validateFileForAPI(file));
        return this.deduplicateFilesForAPI(validFiles);
      }

      console.log('aiFiverr KB: Returning', deduplicatedFiles.length, 'deduplicated files');
      return deduplicatedFiles;

    } catch (error) {
      console.error('aiFiverr KB: Error getting optimized knowledge base files:', error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Resolve specific knowledge base files by IDs with validation and deduplication
   */
  async resolveKnowledgeBaseFiles(fileIds) {
    try {
      if (!fileIds || fileIds.length === 0) {
        return [];
      }

      console.log('aiFiverr KB: Resolving files:', fileIds);

      // Get all available files
      const allFiles = Array.from(this.files.values());
      console.log('aiFiverr KB: Available files for resolution:', allFiles.length);

      // Resolve requested files with validation and deduplication
      const resolvedFiles = [];
      const duplicateCheck = new Set();

      for (const fileId of fileIds) {
        const file = allFiles.find(f =>
          f.driveFileId === fileId ||
          f.id === fileId ||
          f.internalId === fileId ||
          f.name === fileId
        );

        if (file && this.validateFileForAPI(file)) {
          // Check for duplicates using geminiUri
          const uniqueKey = file.geminiUri || file.driveFileId || file.id;
          if (!duplicateCheck.has(uniqueKey)) {
            duplicateCheck.add(uniqueKey);
            resolvedFiles.push({
              id: file.driveFileId || file.id,
              name: file.name,
              mimeType: file.mimeType,
              geminiUri: file.geminiUri,
              size: file.size
            });
            console.log('aiFiverr KB: Resolved file:', file.name, 'with geminiUri:', !!file.geminiUri);
          } else {
            console.log('aiFiverr KB: Skipped duplicate file:', file.name);
          }
        } else if (file) {
          console.warn('aiFiverr KB: File failed validation:', file.name, 'expired:', this.isFileExpired(file));
        } else {
          console.warn('aiFiverr KB: File not found:', fileId);
        }
      }

      console.log('aiFiverr KB: Successfully resolved', resolvedFiles.length, 'files out of', fileIds.length, 'requested');
      return resolvedFiles;

    } catch (error) {
      console.error('aiFiverr KB: Error resolving knowledge base files:', error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Validate file for API attachment
   */
  validateFileForAPI(file) {
    if (!file) {
      console.warn('aiFiverr KB: File is null or undefined');
      return false;
    }
    if (!file.geminiUri) {
      console.warn('aiFiverr KB: File missing geminiUri:', file.name);
      return false;
    }
    if (this.isFileExpired(file)) {
      console.warn('aiFiverr KB: File expired:', file.name);
      return false;
    }
    return true;
  }

  /**
   * OPTIMIZED: Smart file selection based on prompt content
   */
  async getSmartSelectedFiles(promptText) {
    try {
      // Simple implementation: look for file references in prompt
      const fileReferences = this.extractFileReferencesFromPrompt(promptText);
      if (fileReferences.length > 0) {
        console.log('aiFiverr KB: Found file references in prompt:', fileReferences);
        return await this.resolveKnowledgeBaseFiles(fileReferences);
      }
      return [];
    } catch (error) {
      console.error('aiFiverr KB: Error in smart file selection:', error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Extract file references from prompt text
   */
  extractFileReferencesFromPrompt(promptText) {
    const fileReferences = [];

    // Look for {{file:filename}} patterns
    const filePattern = /\{\{file:([^}]+)\}\}/g;
    let match;
    while ((match = filePattern.exec(promptText)) !== null) {
      fileReferences.push(match[1]);
    }

    return fileReferences;
  }

  /**
   * COMPREHENSIVE FILE LIFECYCLE MANAGER
   * Handles file expiration, cleanup, and API key rotation
   */
  async initializeFileLifecycleManager() {
    console.log('aiFiverr KB: Initializing comprehensive file lifecycle manager');

    // Check for expired files and clean them up
    await this.cleanupExpiredFiles();

    // Validate file accessibility with current API keys
    await this.validateFileAccessibility();

    // Set up periodic cleanup (every 30 minutes)
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredFiles();
      await this.validateFileAccessibility();
    }, 30 * 60 * 1000); // 30 minutes

    console.log('aiFiverr KB: File lifecycle manager initialized');
  }

  /**
   * INTELLIGENT DUPLICATE DETECTION SYSTEM
   * Uses multiple identifiers to prevent duplicate file attachments
   */
  createFileSignature(file) {
    // Create a unique signature using multiple identifiers
    const identifiers = [
      file.geminiUri,
      file.driveFileId,
      file.id,
      file.name,
      `${file.name}_${file.size}_${file.mimeType}`
    ].filter(Boolean);

    // Return the most specific identifier available
    return identifiers[0] || `unknown_${Date.now()}`;
  }

  /**
   * ROBUST DEDUPLICATION FOR API REQUESTS
   * Prevents same file from being sent multiple times
   */
  deduplicateFilesForAPI(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    console.log('aiFiverr KB: Starting comprehensive file deduplication for', files.length, 'files');

    const uniqueFiles = new Map();
    const duplicateLog = [];

    files.forEach((file, index) => {
      if (!file) {
        console.warn('aiFiverr KB: Skipping null/undefined file at index', index);
        return;
      }

      const signature = this.createFileSignature(file);

      if (uniqueFiles.has(signature)) {
        duplicateLog.push({
          signature,
          name: file.name,
          index,
          reason: 'Duplicate signature'
        });
        console.log('aiFiverr KB: Duplicate file detected:', file.name, 'signature:', signature);
      } else {
        // Validate file before adding
        if (this.validateFileForAPI(file)) {
          uniqueFiles.set(signature, {
            id: file.driveFileId || file.id,
            name: file.name,
            mimeType: file.mimeType,
            geminiUri: file.geminiUri,
            size: file.size,
            signature: signature
          });
          console.log('aiFiverr KB: Added unique file:', file.name, 'signature:', signature);
        } else {
          duplicateLog.push({
            signature,
            name: file.name,
            index,
            reason: 'Failed validation'
          });
          console.warn('aiFiverr KB: File failed validation:', file.name);
        }
      }
    });

    const deduplicatedFiles = Array.from(uniqueFiles.values());

    console.log('aiFiverr KB: Deduplication complete:', {
      original: files.length,
      deduplicated: deduplicatedFiles.length,
      duplicatesRemoved: duplicateLog.length,
      duplicates: duplicateLog
    });

    return deduplicatedFiles;
  }

  /**
   * CLEANUP EXPIRED FILES FROM GEMINI API
   * Automatically removes files that have expired (48+ hours)
   */
  async cleanupExpiredFiles() {
    try {
      console.log('aiFiverr KB: Starting expired file cleanup');

      const allFiles = Array.from(this.files.values());
      const expiredFiles = allFiles.filter(file => this.isFileExpired(file));

      console.log('aiFiverr KB: Found', expiredFiles.length, 'expired files out of', allFiles.length, 'total');

      for (const file of expiredFiles) {
        try {
          // Remove from Gemini API if possible
          if (file.geminiName && window.geminiFilesClient) {
            await window.geminiFilesClient.deleteFile(file.geminiName);
            console.log('aiFiverr KB: Deleted expired file from Gemini API:', file.name);
          }

          // Update local reference to mark as expired
          file.geminiUri = null;
          file.geminiState = 'EXPIRED';
          file.isGeminiReady = false;
          file.expiredAt = Date.now();

        } catch (deleteError) {
          console.warn('aiFiverr KB: Failed to delete expired file:', file.name, deleteError);
        }
      }

      // Save updated file references
      await this.saveKnowledgeBaseFiles();

      console.log('aiFiverr KB: Expired file cleanup completed');

    } catch (error) {
      console.error('aiFiverr KB: Error during expired file cleanup:', error);
    }
  }

  /**
   * Get all available file references as an array for prompt processing
   */
  getAllAvailableFileReferences() {
    const allFiles = this.getAllFileReferences();
    return Object.entries(allFiles).map(([key, fileData]) => ({
      id: fileData.driveFileId || fileData.id || key,
      name: fileData.name,
      driveFileId: fileData.driveFileId,
      mimeType: fileData.mimeType,
      geminiUri: fileData.geminiUri
    }));
  }

  /**
   * Sync with Google Drive files
   */
  async syncWithGoogleDrive() {
    try {
      if (!window.googleDriveClient) {
        console.warn('aiFiverr KB: Google Drive client not available');
        return;
      }

      const driveFiles = await window.googleDriveClient.listKnowledgeBaseFiles();

      // Update file references with latest Drive data
      for (const driveFile of driveFiles) {
        const existingRef = Array.from(this.files.entries())
          .find(([key, data]) => data.driveId === driveFile.id);

        if (existingRef) {
          const [key, data] = existingRef;
          this.files.set(key, {
            ...data,
            ...driveFile,
            lastSynced: new Date().toISOString()
          });
        } else {
          // Add new file reference
          const key = this.generateFileKey(driveFile.name);
          await this.addFileReference(key, {
            driveId: driveFile.id,
            name: driveFile.name,
            mimeType: driveFile.mimeType,
            size: driveFile.size,
            webViewLink: driveFile.webViewLink,
            lastSynced: new Date().toISOString()
          });
        }
      }

      await this.saveKnowledgeBaseFiles();
      console.log('aiFiverr KB: Synced with Google Drive');

    } catch (error) {
      console.error('aiFiverr KB: Failed to sync with Google Drive:', error);
    }
  }

  /**
   * Sync with Gemini Files API
   */
  async syncWithGeminiFiles() {
    try {
      console.log('aiFiverr KB: Starting sync with merged knowledge base files...');

      // Get merged knowledge base files from background script (includes both Drive and Gemini data)
      const kbFilesResult = await this.getKnowledgeBaseFilesFromBackground();
      if (!kbFilesResult.success) {
        console.warn('aiFiverr KB: Failed to get knowledge base files from background:', kbFilesResult.error);
        return;
      }

      const kbFiles = kbFilesResult.data || [];
      console.log('aiFiverr KB: Syncing with', kbFiles.length, 'knowledge base files');

      // Update file references with merged data
      let updatedCount = 0;
      let newCount = 0;

      for (const kbFile of kbFiles) {
        const fileKey = this.generateFileKey(kbFile.name);
        const existingRef = this.files.get(fileKey);

        const updatedFileData = {
          name: kbFile.name,
          mimeType: kbFile.mimeType,
          size: kbFile.size,
          driveFileId: kbFile.driveFileId || kbFile.id,
          webViewLink: kbFile.webViewLink,
          createdTime: kbFile.createdTime,
          modifiedTime: kbFile.modifiedTime,
          // Gemini data
          geminiName: kbFile.geminiName,
          geminiUri: kbFile.geminiUri,
          geminiState: kbFile.geminiState,
          geminiMimeType: kbFile.geminiMimeType,
          // Sync metadata
          lastSynced: new Date().toISOString(),
          source: 'merged_sync'
        };

        if (existingRef) {
          // Update existing reference
          this.files.set(fileKey, {
            ...existingRef,
            ...updatedFileData
          });
          updatedCount++;
          console.log('aiFiverr KB: Updated file reference:', kbFile.name, 'geminiUri:', kbFile.geminiUri);
        } else {
          // Add new reference
          this.files.set(fileKey, {
            ...updatedFileData,
            addedAt: new Date().toISOString(),
            type: 'file'
          });
          newCount++;
          console.log('aiFiverr KB: Added new file reference:', kbFile.name, 'geminiUri:', kbFile.geminiUri);
        }
      }

      // Save updated file references
      if (updatedCount > 0 || newCount > 0) {
        await this.saveKnowledgeBaseFiles();
        console.log(`aiFiverr KB: Sync complete - Updated: ${updatedCount}, New: ${newCount}, Total: ${this.files.size}`);
      }
    } catch (error) {
      console.error('aiFiverr KB: Failed to sync with Gemini Files API:', error);
    }
  }

  /**
   * Get Gemini files from background script
   */
  async getGeminiFilesFromBackground() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_GEMINI_FILES' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }

  /**
   * Get knowledge base files from background script (merged Drive + Gemini data)
   */
  async getKnowledgeBaseFilesFromBackground() {
    try {
      const response = await this.sendMessageWithRetry({ type: 'GET_KNOWLEDGE_BASE_FILES' }, 2);
      console.log('aiFiverr KB: Got files from background:', response);

      // CRITICAL FIX: Clean up MIME types in the response
      if (response && response.success && response.data && Array.isArray(response.data)) {
        response.data = response.data.map(file => {
          if (file.mimeType === 'application/octet-stream') {
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

            const newMimeType = mimeMap[extension] || 'text/plain';
            console.warn(`🔧 aiFiverr KB: Fixed MIME type for ${file.name}: ${file.mimeType} → ${newMimeType}`);

            return {
              ...file,
              mimeType: newMimeType
            };
          }
          return file;
        });
      }

      // AUTOMATIC CLEANUP: Remove stale file references after getting fresh data
      if (response && response.success) {
        try {
          await this.cleanupStaleFileReferences();
        } catch (cleanupError) {
          console.warn('⚠️ aiFiverr KB: Failed to cleanup stale references:', cleanupError);
        }
      }

      return response || { success: false, error: 'No response' };
    } catch (error) {
      console.error('aiFiverr KB: Error getting files from background:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up stale file references (files that no longer exist in Gemini API)
   */
  async cleanupStaleFileReferences() {
    try {
      console.log('🧹 aiFiverr KB: Cleaning up stale file references...');

      // Get current valid files from Gemini API
      const geminiResponse = await this.sendMessageWithRetry({
        type: 'GET_GEMINI_FILES'
      }, 2);

      if (!geminiResponse.success) {
        console.warn('⚠️ aiFiverr KB: Could not get Gemini files for cleanup:', geminiResponse.error);
        return false;
      }

      const validGeminiFiles = geminiResponse.data || [];
      const validGeminiUris = new Set(validGeminiFiles.map(f => f.uri));

      console.log(`📊 aiFiverr KB: Found ${validGeminiFiles.length} valid files in Gemini API`);

      // Check local files for stale references
      let cleanedCount = 0;
      const filesToRemove = [];

      for (const [key, fileRef] of this.files.entries()) {
        if (fileRef.geminiUri && !validGeminiUris.has(fileRef.geminiUri)) {
          console.warn(`🚨 aiFiverr KB: Stale file reference detected: ${fileRef.name} (${fileRef.geminiUri})`);
          filesToRemove.push(key);
          cleanedCount++;
        }
      }

      // Remove stale references
      for (const key of filesToRemove) {
        this.files.delete(key);
        console.log(`🗑️ aiFiverr KB: Removed stale file reference: ${key}`);
      }

      if (cleanedCount > 0) {
        // Save updated file list
        await this.saveFiles();
        console.log(`✅ aiFiverr KB: Cleaned up ${cleanedCount} stale file references`);
      } else {
        console.log('✅ aiFiverr KB: No stale file references found');
      }

      return true;

    } catch (error) {
      console.error('❌ aiFiverr KB: Failed to cleanup stale file references:', error);
      return false;
    }
  }

  /**
   * Force refresh a file with problematic MIME type
   */
  async forceRefreshProblematicFile(fileName) {
    try {
      console.log(`🔧 aiFiverr KB: Force refreshing problematic file: ${fileName}`);

      // Find the file in our local storage
      const fileKey = this.generateFileKey(fileName);
      const fileRef = this.files.get(fileKey);

      if (!fileRef) {
        throw new Error(`File not found in knowledge base: ${fileName}`);
      }

      // Delete the existing Gemini file if it exists
      if (fileRef.geminiUri) {
        try {
          const fileId = fileRef.geminiUri.split('/').pop();
          const deleteResponse = await this.sendMessageWithRetry({
            type: 'DELETE_GEMINI_FILE',
            fileId: fileId
          }, 2);

          if (deleteResponse.success) {
            console.log(`🗑️ aiFiverr KB: Deleted problematic Gemini file: ${fileId}`);
          }
        } catch (deleteError) {
          console.warn(`⚠️ aiFiverr KB: Failed to delete Gemini file, continuing with refresh:`, deleteError);
        }
      }

      // Clear the Gemini URI from local storage
      fileRef.geminiUri = null;
      fileRef.geminiName = null;
      fileRef.geminiState = null;
      this.files.set(fileKey, fileRef);

      // Re-upload to Gemini with correct MIME type
      const uploadResult = await this.uploadFileToGemini(fileRef);

      console.log(`✅ aiFiverr KB: Successfully refreshed file: ${fileName}`);
      return uploadResult;

    } catch (error) {
      console.error(`❌ aiFiverr KB: Failed to force refresh file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Upload a file to Gemini Files API and store URI
   */
  async uploadFileToGemini(fileData) {
    try {
      console.log('=== aiFiverr KB: Starting Gemini File Upload ===');
      console.log('aiFiverr KB: File data:', {
        name: fileData.name,
        mimeType: fileData.mimeType,
        driveFileId: fileData.driveFileId,
        size: fileData.size
      });

      // First download the file from Google Drive
      const downloadResponse = await this.sendMessageWithRetry({
        type: 'DOWNLOAD_FILE_FROM_DRIVE',
        fileId: fileData.driveFileId
      }, 3);

      if (!downloadResponse.success) {
        throw new Error(`Failed to download file from Drive: ${downloadResponse.error}`);
      }

      // Upload to Gemini with the downloaded file data
      const messageData = {
        type: 'UPLOAD_FILE_TO_GEMINI',
        file: {
          name: fileData.name,
          type: fileData.mimeType,
          size: fileData.size,
          data: downloadResponse.data // Base64 data from Drive
        },
        displayName: fileData.name
      };

      console.log('aiFiverr KB: Sending upload message to background:', messageData);

      // Use retry mechanism for file upload
      const response = await this.sendMessageWithRetry(messageData, 3);

      if (response && response.success && response.data) {
        console.log('aiFiverr KB: File uploaded to Gemini successfully:', {
          name: response.data.displayName,
          uri: response.data.uri,
          state: response.data.state
        });

        // Update file data with Gemini information for fast access
        const file = this.files.get(fileData.driveFileId);
        if (file) {
          file.geminiUri = response.data.uri;
          file.geminiName = response.data.name;
          file.geminiState = response.data.state;
          file.geminiUploadTime = Date.now();
          file.geminiExpirationTime = response.data.expirationTime;
          file.isGeminiReady = response.data.state === 'ACTIVE';

          // Save updated file data for persistence
          await this.saveFiles();
          console.log('✅ aiFiverr KB: File data updated with Gemini URI for fast access:', file.geminiUri);
        }

        // Return the response in the format expected by resolveKnowledgeBaseFiles
        console.log('aiFiverr KB: Returning upload response:', response);
        return response;
      } else {
        console.error('aiFiverr KB: Failed to upload file to Gemini:', {
          success: response?.success,
          error: response?.error,
          hasData: !!response?.data
        });
        return { success: false, error: response?.error || 'Upload failed - no response data' };
      }
    } catch (error) {
      console.error('aiFiverr KB: Error in uploadFileToGemini:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message to background script with retry mechanism
   */
  async sendMessageWithRetry(message, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`aiFiverr KB: Sending message (attempt ${attempt}/${maxRetries}):`, message.type);

        const response = await new Promise((resolve, reject) => {
          // Add timeout to prevent hanging
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout - no response received'));
          }, 15000); // 15 second timeout for file uploads

          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              console.error('aiFiverr KB: Chrome runtime error:', chrome.runtime.lastError.message);

              // Handle "Receiving end does not exist" error specifically
              if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                reject(new Error('Could not establish connection. Background script may be inactive.'));
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
            } else {
              resolve(response);
            }
          });
        });

        console.log(`aiFiverr KB: Message response received (attempt ${attempt}):`, response);
        return response;

      } catch (error) {
        console.error(`aiFiverr KB: Message attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          throw new Error(`Failed to communicate with background script after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retrying
        console.log(`aiFiverr KB: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }

  /**
   * Generate unique key for file
   */
  generateFileKey(fileName) {
    const baseName = fileName.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    let key = baseName;
    let counter = 1;

    while (this.files.has(key) || this.variables.has(key)) {
      key = `${baseName}_${counter}`;
      counter++;
    }

    return key;
  }

  /**
   * Check if a file is expired (Gemini files expire after 48 hours)
   */
  isFileExpired(file) {
    if (!file.geminiExpirationTimestamp && !file.lastUploaded && !file.geminiUploadTime) {
      return false; // No expiration info, assume not expired
    }

    const now = Date.now();

    // Check explicit expiration timestamp first
    if (file.geminiExpirationTimestamp) {
      return now > file.geminiExpirationTimestamp;
    }

    // Check geminiUploadTime (more reliable)
    if (file.geminiUploadTime) {
      const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      return now > (file.geminiUploadTime + fortyEightHours);
    }

    // Fallback: check if file was uploaded more than 48 hours ago
    if (file.lastUploaded) {
      const uploadTime = new Date(file.lastUploaded).getTime();
      const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      return now > (uploadTime + fortyEightHours);
    }

    return false;
  }

  /**
   * VALIDATE FILE ACCESSIBILITY WITH CURRENT API KEYS
   * Handles API key rotation by checking file accessibility
   */
  async validateFileAccessibility() {
    try {
      console.log('aiFiverr KB: Validating file accessibility with current API keys');

      const allFiles = Array.from(this.files.values());
      const geminiFiles = allFiles.filter(file => file.geminiUri && !this.isFileExpired(file));

      console.log('aiFiverr KB: Checking accessibility for', geminiFiles.length, 'Gemini files');

      // Get current API key to check accessibility
      const currentApiKey = await this.getCurrentApiKey();
      if (!currentApiKey) {
        console.warn('aiFiverr KB: No API key available for accessibility check');
        return;
      }

      const inaccessibleFiles = [];

      for (const file of geminiFiles) {
        try {
          // Check if file is accessible with current API key
          const isAccessible = await this.checkFileAccessibility(file, currentApiKey);

          if (!isAccessible) {
            inaccessibleFiles.push(file);
            console.log('aiFiverr KB: File inaccessible with current API key:', file.name);
          }

        } catch (accessError) {
          console.warn('aiFiverr KB: Error checking file accessibility:', file.name, accessError);
          inaccessibleFiles.push(file);
        }
      }

      // Handle inaccessible files (likely due to API key rotation)
      if (inaccessibleFiles.length > 0) {
        console.log('aiFiverr KB: Found', inaccessibleFiles.length, 'inaccessible files, attempting refresh');
        await this.refreshInaccessibleFiles(inaccessibleFiles);
      }

    } catch (error) {
      console.error('aiFiverr KB: Error validating file accessibility:', error);
    }
  }

  /**
   * CHECK IF FILE IS ACCESSIBLE WITH CURRENT API KEY
   */
  async checkFileAccessibility(file, apiKey) {
    try {
      if (!file.geminiName || !apiKey) {
        return false;
      }

      // Try to get file info from Gemini API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${file.geminiName}?key=${apiKey}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const fileInfo = await response.json();
        return fileInfo.state === 'ACTIVE';
      }

      return false;

    } catch (error) {
      // Only log if it's not a timeout or abort error
      if (error.name !== 'AbortError') {
        console.warn('aiFiverr KB: File accessibility check failed:', file.name, error.message);
      }
      return false;
    }
  }

  /**
   * REFRESH INACCESSIBLE FILES BY RE-UPLOADING FROM GOOGLE DRIVE
   */
  async refreshInaccessibleFiles(inaccessibleFiles) {
    try {
      console.log('aiFiverr KB: Refreshing', inaccessibleFiles.length, 'inaccessible files');

      for (const file of inaccessibleFiles) {
        try {
          if (file.driveFileId) {
            console.log('aiFiverr KB: Re-uploading file from Google Drive:', file.name);

            // Re-upload file from Google Drive to Gemini API
            await this.uploadFileToGemini(file);

            console.log('aiFiverr KB: Successfully refreshed file:', file.name);
          } else {
            console.warn('aiFiverr KB: Cannot refresh file without Google Drive ID:', file.name);
          }

        } catch (refreshError) {
          console.error('aiFiverr KB: Failed to refresh file:', file.name, refreshError);
        }
      }

    } catch (error) {
      console.error('aiFiverr KB: Error refreshing inaccessible files:', error);
    }
  }

  /**
   * GET CURRENT API KEY FOR FILE OPERATIONS
   */
  async getCurrentApiKey() {
    try {
      // Try API key manager first
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        const keyData = window.apiKeyManager.getKeyForSession('file-operations');
        if (keyData) {
          return keyData.key;
        }
      }

      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response?.success && response?.data) {
        return response.data.key;
      }

      return null;

    } catch (error) {
      console.error('aiFiverr KB: Failed to get current API key:', error);
      return null;
    }
  }

  /**
   * Process template with variables and files
   */
  processTemplate(templateKey, variables = {}) {
    const template = this.getTemplate(templateKey);
    if (!template) {
      throw new Error(`Template '${templateKey}' not found`);
    }

    let processedContent = template.content;

    // Replace knowledge base variables
    processedContent = this.replaceVariables(processedContent);

    // Replace file references
    processedContent = this.replaceFileReferences(processedContent);

    // Replace additional variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    });

    return processedContent;
  }

  /**
   * Save knowledge base to storage
   */
  async saveKnowledgeBase() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping knowledge base save');
        return;
      }

      const data = Object.fromEntries(this.variables);
      await window.storageManager.saveKnowledgeBase(data);

      // Also sync to Google Drive if authenticated
      await this.syncToGoogleDrive('variables', data);
    } catch (error) {
      console.error('Failed to save knowledge base:', error);
    }
  }

  /**
   * Save custom prompts to storage
   */
  async saveCustomPrompts() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping custom prompts save');
        return;
      }

      const data = Object.fromEntries(this.customPrompts);
      await window.storageManager.set({ customPrompts: data });

      // Also sync to Google Drive if authenticated
      await this.syncToGoogleDrive('custom-prompts', data);
    } catch (error) {
      console.error('Failed to save custom prompts:', error);
    }
  }

  /**
   * Save templates to storage
   */
  async saveTemplates() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping templates save');
        return;
      }

      const data = Object.fromEntries(this.templates);
      await window.storageManager.set({ templates: data });
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }

  /**
   * Export knowledge base data
   */
  exportData() {
    return {
      variables: this.getAllVariables(),
      customPrompts: this.getAllCustomPrompts(),
      // templates: this.getAllTemplates(), // Disabled to prevent confusion with AI prompts
      exportedAt: Date.now()
    };
  }

  /**
   * Import knowledge base data
   */
  async importData(data) {
    try {
      if (data.variables) {
        this.variables.clear();
        Object.entries(data.variables).forEach(([key, value]) => {
          this.variables.set(key, value);
        });
        await this.saveKnowledgeBase();
      }

      if (data.customPrompts) {
        this.customPrompts.clear();
        Object.entries(data.customPrompts).forEach(([key, prompt]) => {
          this.customPrompts.set(key, prompt);
        });
        await this.saveCustomPrompts();
      }

      if (data.templates) {
        this.templates.clear();
        Object.entries(data.templates).forEach(([key, template]) => {
          this.templates.set(key, template);
        });
        await this.saveTemplates();
      }

      return true;
    } catch (error) {
      console.error('Failed to import knowledge base data:', error);
      return false;
    }
  }

  /**
   * Search prompts only (templates are disabled to prevent confusion)
   */
  search(query) {
    const results = {
      prompts: [],
      templates: [] // Always empty since templates are disabled
    };

    const searchTerm = query.toLowerCase();

    // Search prompts only
    this.customPrompts.forEach((prompt, key) => {
      if (prompt.name.toLowerCase().includes(searchTerm) ||
          prompt.description.toLowerCase().includes(searchTerm) ||
          prompt.prompt.toLowerCase().includes(searchTerm)) {
        results.prompts.push({ key, ...prompt });
      }
    });

    // Templates search disabled to prevent confusion with AI prompts
    console.log('aiFiverr KB: Template search disabled to prevent confusion with AI prompts');

    return results;
  }

  /**
   * Resolve knowledge base file IDs to full file data
   */
  async resolveKnowledgeBaseFiles(fileReferences) {
    console.log('=== aiFiverr KB: Resolving knowledge base files ===');
    console.log('aiFiverr KB: Resolving knowledge base files:', fileReferences.length, 'references');
    console.log('aiFiverr KB: File references details:', fileReferences.map(ref => ({
      id: ref.id,
      name: ref.name,
      driveFileId: ref.driveFileId,
      hasGeminiUri: !!ref.geminiUri
    })));

    if (!fileReferences || fileReferences.length === 0) {
      console.log('aiFiverr KB: No file references provided');
      return [];
    }

    console.log('aiFiverr KB: Total files in knowledge base:', this.files.size);
    console.log('aiFiverr KB: Available file keys:', Array.from(this.files.keys()).slice(0, 10), '...');  // Show first 10 keys

    const resolvedFiles = [];
    let filesProcessed = 0;
    let filesWithGeminiUri = 0;
    let filesSkipped = 0;

    for (const fileRef of fileReferences) {
      try {
        filesProcessed++;
        console.log(`aiFiverr KB: Processing file reference ${filesProcessed}/${fileReferences.length}:`, {
          id: fileRef.id,
          name: fileRef.name,
          driveFileId: fileRef.driveFileId,
          hasGeminiUri: !!fileRef.geminiUri
        });

        // If it's already a full file object with geminiUri, use it as is
        if (fileRef.geminiUri) {
          console.log('aiFiverr KB: File already has geminiUri:', fileRef.name, fileRef.geminiUri);
          resolvedFiles.push({
            id: fileRef.id || fileRef.driveFileId,
            driveFileId: fileRef.driveFileId || fileRef.id,
            name: fileRef.name,
            mimeType: fileRef.mimeType,
            geminiUri: fileRef.geminiUri,
            size: fileRef.size
          });
          filesWithGeminiUri++;
          continue;
        }

        // Try to find the file in our knowledge base by ID or name
        let fullFileData = null;

        // First try by ID (could be driveFileId or regular id)
        if (fileRef.id) {
          console.log('aiFiverr KB: Looking up file by ID:', fileRef.id);
          fullFileData = this.getFileReference(fileRef.id);
        }
        if (!fullFileData && fileRef.driveFileId) {
          console.log('aiFiverr KB: Looking up file by driveFileId:', fileRef.driveFileId);
          fullFileData = this.getFileReference(fileRef.driveFileId);
        }

        // ENHANCED: Also try to find by name if ID lookup fails
        if (!fullFileData && fileRef.name) {
          console.log('aiFiverr KB: Looking up file by name:', fileRef.name);
          const allFiles = Array.from(this.files.values());
          fullFileData = allFiles.find(file =>
            file.name === fileRef.name ||
            (file.name && file.name.toLowerCase() === fileRef.name.toLowerCase())
          );
          if (fullFileData) {
            console.log('aiFiverr KB: Found file by name match:', fullFileData.name);
          }
        }

        // If not found by ID, try by name
        if (!fullFileData && fileRef.name) {
          console.log('aiFiverr KB: Looking up file by name:', fileRef.name);
          const allFiles = this.getAllFileReferences();
          console.log('aiFiverr KB: Available files:', Object.keys(allFiles));
          fullFileData = Object.values(allFiles).find(file => file.name === fileRef.name);
        }

        console.log('aiFiverr KB: Found file data:', fullFileData);

        // If we found the full file data and it has geminiUri, add it
        if (fullFileData && fullFileData.geminiUri) {
          console.log('aiFiverr KB: File has geminiUri, adding to resolved files:', fullFileData.name, fullFileData.geminiUri);
          resolvedFiles.push({
            id: fileRef.id || fileRef.driveFileId || fullFileData.driveFileId,
            name: fullFileData.name,
            mimeType: fullFileData.mimeType,
            geminiUri: fullFileData.geminiUri,
            size: fullFileData.size
          });
          filesWithGeminiUri++;
        } else if (fullFileData) {
          // File exists but no geminiUri - try to get from background or sync
          console.warn('aiFiverr KB: File found but no geminiUri, attempting to sync:', fileRef.name);

          // Try to get updated file data from background
          const backgroundFiles = await this.getKnowledgeBaseFilesFromBackground();
          if (backgroundFiles.success && backgroundFiles.data) {
            const matchingFile = backgroundFiles.data.find(f =>
              f.name === fullFileData.name || f.driveFileId === fullFileData.driveFileId
            );

            if (matchingFile && matchingFile.geminiUri) {
              console.log('aiFiverr KB: Found geminiUri from background sync:', matchingFile.name, matchingFile.geminiUri);

              // Update local file reference
              const fileKey = this.generateFileKey(matchingFile.name);
              this.files.set(fileKey, {
                ...fullFileData,
                geminiUri: matchingFile.geminiUri,
                geminiName: matchingFile.geminiName,
                geminiState: matchingFile.geminiState
              });
              await this.saveKnowledgeBaseFiles();

              resolvedFiles.push({
                id: fileRef.id || fileRef.driveFileId || matchingFile.driveFileId,
                name: matchingFile.name,
                mimeType: matchingFile.mimeType,
                geminiUri: matchingFile.geminiUri,
                size: matchingFile.size
              });
              filesWithGeminiUri++;
            } else {
              console.warn('aiFiverr KB: File not found in background or missing geminiUri, attempting upload:', fileRef.name);

              // Try to upload file to Gemini if it has a driveFileId
              if (fullFileData.driveFileId) {
                try {
                  console.log('aiFiverr KB: Attempting to upload file to Gemini:', {
                    name: fullFileData.name,
                    driveFileId: fullFileData.driveFileId,
                    mimeType: fullFileData.mimeType
                  });

                  const uploadResult = await this.uploadFileToGemini(fullFileData);
                  console.log('aiFiverr KB: Upload result received:', uploadResult);

                  if (uploadResult && uploadResult.success && uploadResult.data) {
                    // Map the response data correctly - background script returns 'uri' not 'geminiUri'
                    const geminiUri = uploadResult.data.uri;
                    const geminiName = uploadResult.data.name;
                    const geminiState = uploadResult.data.state;

                    if (geminiUri) {
                      console.log('aiFiverr KB: Successfully uploaded file to Gemini:', {
                        name: geminiName,
                        geminiUri: geminiUri,
                        state: geminiState
                      });

                      // Update local file reference with correct property mapping
                      const fileKey = this.generateFileKey(fullFileData.name);
                      const updatedFileData = {
                        ...fullFileData,
                        geminiUri: geminiUri,
                        geminiName: geminiName,
                        geminiState: geminiState,
                        lastUploaded: new Date().toISOString()
                      };

                      this.files.set(fileKey, updatedFileData);
                      await this.saveKnowledgeBaseFiles();

                      console.log('aiFiverr KB: File reference updated and saved:', fileKey);

                      resolvedFiles.push({
                        id: fileRef.id || fileRef.driveFileId,
                        name: geminiName,
                        mimeType: uploadResult.data.mimeType,
                        geminiUri: geminiUri,
                        size: uploadResult.data.sizeBytes
                      });
                      filesWithGeminiUri++;
                    } else {
                      console.warn('aiFiverr KB: Upload succeeded but no URI in response:', {
                        fileName: fileRef.name,
                        uploadResult: uploadResult.data,
                        hasUri: !!uploadResult.data.uri
                      });
                    }
                  } else {
                    console.warn('aiFiverr KB: Upload failed - invalid response format:', {
                      fileName: fileRef.name,
                      uploadResult: uploadResult,
                      hasResult: !!uploadResult,
                      hasSuccess: !!(uploadResult && uploadResult.success),
                      hasData: !!(uploadResult && uploadResult.data),
                      error: uploadResult?.error
                    });
                  }
                } catch (error) {
                  console.error('aiFiverr KB: Error uploading file to Gemini:', {
                    fileName: fileRef.name,
                    error: error.message,
                    stack: error.stack
                  });
                }
              }
            }
          } else {
            console.warn('aiFiverr KB: Failed to get files from background, skipping file:', fileRef.name);
          }
        } else {
          console.warn('aiFiverr KB: Could not resolve file reference:', fileRef);
          filesSkipped++;
        }
      } catch (error) {
        console.error('aiFiverr KB: Error resolving file:', fileRef, error);
        filesSkipped++;
      }
    }

    console.log('aiFiverr KB: File resolution summary:', {
      totalProcessed: filesProcessed,
      resolvedWithGeminiUri: resolvedFiles.length,
      filesWithExistingGeminiUri: filesWithGeminiUri,
      filesSkipped: filesSkipped
    });

    console.log('aiFiverr KB: Resolved files for API request:', resolvedFiles.map(f => ({
      name: f.name,
      geminiUri: f.geminiUri,
      mimeType: f.mimeType
    })));

    return resolvedFiles;
  }

  /**
   * Process prompt with automatic context extraction from Fiverr page
   */
  async processPromptWithFiverrContext(promptKey, additionalContext = {}) {
    try {
      // Determine optimal context type based on prompt
      const contextType = this.determineOptimalContextType(promptKey);

      // Extract context from current Fiverr page
      const context = await this.extractFiverrContext(contextType);

      // Merge with additional context
      const fullContext = { ...context, ...additionalContext };

      // Process the prompt
      const result = this.processPrompt(promptKey, fullContext);

      // Return the processed prompt text for backward compatibility
      // but also include the knowledge base files
      if (typeof result === 'object' && result.prompt) {
        return result;
      } else {
        // Fallback for old format
        return { prompt: result, knowledgeBaseFiles: [] };
      }
    } catch (error) {
      console.error('Failed to process prompt with Fiverr context:', error);
      throw error;
    }
  }

  /**
   * Determine optimal context type based on prompt key
   */
  determineOptimalContextType(promptKey) {
    const contextMapping = {
      'project_proposal': 'project_focused',
      'brief_analysis': 'project_focused',
      'requirement_clarification': 'key_points',
      'follow_up': 'recent',
      'general_reply': 'recent',
      'summary': 'summary',
      'default': 'recent'
    };

    return contextMapping[promptKey] || contextMapping['default'];
  }

  /**
   * Extract context variables from current Fiverr page with intelligent context management
   */
  async extractFiverrContext(contextType = 'recent', maxLength = 4000) {
    const context = {};

    try {
      // Extract username from URL
      if (window.fiverrExtractor) {
        context.username = window.fiverrExtractor.extractUsernameFromUrl() || 'Client';

        // Extract conversation if available
        const conversationData = await window.fiverrExtractor.extractConversation();
        if (conversationData) {
          // Use intelligent context based on use case
          context.conversation = window.fiverrExtractor.getIntelligentContext(conversationData, contextType, maxLength);
          context.conversation_summary = window.fiverrExtractor.getConversationSummary(conversationData, 1500);
          context.conversation_count = conversationData.messages?.length || 0;
          context.conversation_last_message = conversationData.messages?.length > 0
            ? conversationData.messages[conversationData.messages.length - 1].body
            : 'No messages';

          // Add context metadata
          context.conversation_type = contextType;
          context.conversation_length = context.conversation.length;
          context.is_large_conversation = conversationData.messages?.length > 50;
        }

        // Extract brief details if on brief page
        const briefData = window.fiverrExtractor.extractBriefDetails();
        if (briefData) {
          // Format brief data for proposal context
          let proposalText = '';
          if (briefData.title) proposalText += `Title: ${briefData.title}\n`;
          if (briefData.description) proposalText += `Description: ${briefData.description}\n`;
          if (briefData.overview) proposalText += `Brief Overview: ${briefData.overview}\n`;
          if (briefData.requirements?.length) proposalText += `Requirements: ${briefData.requirements.join(', ')}\n`;
          if (briefData.budget) proposalText += `Budget: ${briefData.budget}\n`;
          if (briefData.deadline) proposalText += `Deadline: ${briefData.deadline}\n`;
          if (briefData.skills?.length) proposalText += `Skills needed: ${briefData.skills.join(', ')}\n`;

          context.proposal = proposalText || 'No specific brief details available';
        }
      }

      // Set default values for missing context
      if (!context.conversation) context.conversation = 'No conversation data available';
      if (!context.conversation_summary) context.conversation_summary = 'No conversation summary available';
      if (!context.conversation_count) context.conversation_count = 0;
      if (!context.conversation_last_message) context.conversation_last_message = 'No recent messages';
      if (!context.username) context.username = 'Client';
      if (!context.proposal) context.proposal = 'No proposal data available';

    } catch (error) {
      console.error('Failed to extract Fiverr context:', error);
      // Set fallback values
      context.conversation = 'No conversation data available';
      context.username = 'Client';
      context.proposal = 'No proposal data available';
    }

    return context;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      variableCount: this.variables.size,
      promptCount: this.customPrompts.size,
      templateCount: this.templates.size,
      totalItems: this.variables.size + this.customPrompts.size + this.templates.size
    };
  }

  // Google Drive Integration Methods
  async uploadFileToGoogleDrive(file, fileName, description = '') {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        throw new Error('Google authentication required');
      }

      if (!window.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      console.log('aiFiverr KB: Uploading file to Google Drive:', fileName);

      const result = await window.googleDriveClient.uploadFile(file, fileName, description);

      if (result.success) {
        // Store file reference in local knowledge base
        await this.addFileReference(result.fileId, {
          name: fileName,
          size: result.size,
          mimeType: result.mimeType,
          driveFileId: result.fileId,
          webViewLink: result.webViewLink,
          uploadedAt: new Date().toISOString(),
          source: 'google_drive'
        });

        console.log('aiFiverr KB: File uploaded successfully:', result.fileId);
        return result;
      } else {
        throw new Error('Upload failed');
      }

    } catch (error) {
      console.error('aiFiverr KB: Failed to upload file to Google Drive:', error);
      throw error;
    }
  }

  async listGoogleDriveFiles() {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        return [];
      }

      if (!window.googleDriveClient) {
        return [];
      }

      const files = await window.googleDriveClient.listKnowledgeBaseFiles();

      // Update local file references
      for (const file of files) {
        await this.addFileReference(file.id, {
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          driveFileId: file.id,
          webViewLink: file.webViewLink,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
          source: 'google_drive'
        });
      }

      return files;

    } catch (error) {
      console.error('aiFiverr KB: Failed to list Google Drive files:', error);
      return [];
    }
  }

  async downloadFileFromGoogleDrive(fileId) {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        throw new Error('Google authentication required');
      }

      if (!window.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      const blob = await window.googleDriveClient.downloadFile(fileId);
      return blob;

    } catch (error) {
      console.error('aiFiverr KB: Failed to download file from Google Drive:', error);
      throw error;
    }
  }

  async deleteFileFromGoogleDrive(fileId) {
    try {
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        throw new Error('Google authentication required');
      }

      if (!window.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Get file info before deletion for Gemini cleanup
      const file = this.files.get(fileId);

      await window.googleDriveClient.deleteFile(fileId);

      // Remove from local file references
      await this.removeFileReference(fileId);

      // Notify UI components to remove file from any attached prompts
      if (window.universalChatSimple) {
        window.universalChatSimple.removeFileFromAttachments(fileId);
      }

      console.log('aiFiverr KB: File deleted from Google Drive and removed from prompts:', fileId);
      return { success: true };

    } catch (error) {
      console.error('aiFiverr KB: Failed to delete file from Google Drive:', error);
      throw error;
    }
  }

  async addFileReference(fileId, fileInfo) {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping add file reference');
        return;
      }

      const fileReferences = await window.storageManager.get('knowledgeBaseFiles') || {};
      fileReferences[fileId] = fileInfo;
      await window.storageManager.set({ knowledgeBaseFiles: fileReferences });
    } catch (error) {
      console.error('aiFiverr KB: Failed to add file reference:', error);
    }
  }

  async removeFileReference(fileId) {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, skipping remove file reference');
        return;
      }

      const result = await window.storageManager.get('knowledgeBaseFiles');
      const fileReferences = result.knowledgeBaseFiles || {};
      delete fileReferences[fileId];
      await window.storageManager.set({ knowledgeBaseFiles: fileReferences });
    } catch (error) {
      console.error('aiFiverr KB: Failed to remove file reference:', error);
    }
  }

  async getFileReferences() {
    try {
      if (!window.storageManager) {
        console.warn('aiFiverr KB: Storage manager not available, returning empty file references');
        return {};
      }

      const result = await window.storageManager.get('knowledgeBaseFiles');
      return result.knowledgeBaseFiles || {};
    } catch (error) {
      console.error('aiFiverr KB: Failed to get file references:', error);
      return {};
    }
  }

  async syncWithGoogleDrive() {
    try {
      if (!this.isUserAuthenticated()) {
        if (window.aiFiverrDebug) {
          console.log('aiFiverr KB: Not authenticated, skipping Google Drive sync');
        }
        return { success: false, reason: 'not_authenticated' };
      }

      console.log('aiFiverr KB: Syncing with Google Drive...');

      // Get files from Google Drive
      const driveFiles = await this.listGoogleDriveFiles();

      // Get local file references
      const localFiles = await this.getFileReferences();

      // Find files that exist in Drive but not locally
      const newFiles = driveFiles.filter(driveFile => !localFiles[driveFile.id]);

      // Find files that exist locally but not in Drive (deleted)
      const deletedFiles = Object.keys(localFiles).filter(fileId =>
        localFiles[fileId].source === 'google_drive' &&
        !driveFiles.find(driveFile => driveFile.id === fileId)
      );

      // Remove references to deleted files
      for (const fileId of deletedFiles) {
        await this.removeFileReference(fileId);
      }

      console.log('aiFiverr KB: Sync complete', {
        totalDriveFiles: driveFiles.length,
        newFiles: newFiles.length,
        deletedFiles: deletedFiles.length
      });

      return {
        success: true,
        totalFiles: driveFiles.length,
        newFiles: newFiles.length,
        deletedFiles: deletedFiles.length
      };

    } catch (error) {
      console.error('aiFiverr KB: Failed to sync with Google Drive:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file content for processing (cached)
   */
  async getFileContent(key) {
    if (this.fileCache.has(key)) {
      return this.fileCache.get(key);
    }

    const fileRef = this.files.get(key);
    if (!fileRef) {
      throw new Error(`File reference '${key}' not found`);
    }

    try {
      let content = null;

      // Try to get content from Gemini first (if available)
      if (fileRef.geminiUri && window.geminiFilesClient) {
        // Gemini Files API doesn't provide direct content access
        // Content is handled by the API during generation
        content = `[Gemini File: ${fileRef.name}]`;
      } else if (fileRef.webViewLink && window.googleDriveClient) {
        // For text files, try to get content from Drive
        if (fileRef.mimeType && fileRef.mimeType.startsWith('text/')) {
          content = await this.fetchDriveFileContent(fileRef);
        } else {
          content = `[Binary File: ${fileRef.name}]`;
        }
      }

      if (content) {
        this.fileCache.set(key, content);
      }

      return content;

    } catch (error) {
      console.error(`Failed to get content for file '${key}':`, error);
      return `[Error loading file: ${fileRef.name}]`;
    }
  }

  /**
   * Fetch file content from Google Drive
   */
  async fetchDriveFileContent(fileRef) {
    try {
      const response = await fetch(fileRef.webViewLink);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Failed to fetch Drive file content:', error);
      return `[Unable to load content from: ${fileRef.name}]`;
    }
  }

  /**
   * Clear file cache
   */
  clearFileCache() {
    this.fileCache.clear();
  }

  /**
   * Get combined knowledge base data (variables + files)
   */
  getAllKnowledgeBaseData() {
    return {
      variables: Object.fromEntries(this.variables),
      files: Object.fromEntries(this.files),
      stats: {
        variableCount: this.variables.size,
        fileCount: this.files.size,
        cacheSize: this.fileCache.size
      }
    };
  }

  /**
   * Sync data to Google Drive
   */
  async syncToGoogleDrive(dataType, data) {
    try {
      // Check if Google Drive client is available and user is authenticated
      if (!window.googleDriveClient) {
        console.log('aiFiverr KB: Google Drive client not available for sync');
        return;
      }

      // Check if Google Auth service is available and user is authenticated
      if (!window.googleAuthService || !window.googleAuthService.isUserAuthenticated()) {
        console.log('aiFiverr KB: User not authenticated for Google Drive sync');
        return;
      }

      // Test connection to ensure everything is working
      const authResult = await window.googleDriveClient.testConnection();
      if (!authResult.success) {
        console.log('aiFiverr KB: Google Drive connection test failed:', authResult.error);
        return;
      }

      const fileName = `aifiverr-${dataType}.json`;
      const description = `aiFiverr ${dataType} data - automatically synced`;

      await window.googleDriveClient.saveDataFile(fileName, {
        type: dataType,
        timestamp: new Date().toISOString(),
        data: data
      }, description);

      console.log(`aiFiverr KB: Synced ${dataType} to Google Drive`);
    } catch (error) {
      console.warn(`aiFiverr KB: Failed to sync ${dataType} to Google Drive:`, error);
      // Don't throw error - sync is optional
    }
  }
}

// Create global knowledge base manager - but only when explicitly called
function initializeKnowledgeBaseManager() {
  if (!window.knowledgeBaseManager) {
    window.knowledgeBaseManager = new KnowledgeBaseManager();
    console.log('aiFiverr: Knowledge Base Manager created');
  }
  return window.knowledgeBaseManager;
}

// Export the initialization function but DO NOT auto-initialize
window.initializeKnowledgeBaseManager = initializeKnowledgeBaseManager;

// REMOVED AUTO-INITIALIZATION - This was causing the knowledge base manager to load on every website
// The knowledge base manager should only be initialized when explicitly called by the main extension

/**
 * COMPREHENSIVE FILE MANAGEMENT TESTING SUITE
 * Use these functions to test and verify the file management system
 */
window.testFileManagement = {

  /**
   * Test duplicate file detection and prevention
   */
  async testDuplicatePrevention() {
    console.log('🧪 Testing duplicate file prevention...');

    if (!window.knowledgeBaseManager) {
      console.error('Knowledge base manager not initialized');
      return;
    }

    // Create test files with various duplicate scenarios
    const testFiles = [
      { name: 'document.pdf', geminiUri: 'uri1', driveFileId: 'drive1', size: 1000, mimeType: 'application/pdf' },
      { name: 'document.pdf', geminiUri: 'uri1', driveFileId: 'drive1', size: 1000, mimeType: 'application/pdf' }, // Exact duplicate
      { name: 'document.pdf', geminiUri: 'uri2', driveFileId: 'drive1', size: 1000, mimeType: 'application/pdf' }, // Same file, different URI
      { name: 'report.docx', geminiUri: 'uri3', driveFileId: 'drive2', size: 2000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'report.docx', geminiUri: 'uri3', driveFileId: 'drive2', size: 2000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, // Exact duplicate
      { name: 'data.xlsx', geminiUri: 'uri4', driveFileId: 'drive3', size: 3000, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    ];

    console.log('Original files:', testFiles.length);

    const deduplicated = window.knowledgeBaseManager.deduplicateFilesForAPI(testFiles);

    console.log('After deduplication:', deduplicated.length);
    console.log('Duplicates removed:', testFiles.length - deduplicated.length);
    console.log('Deduplicated files:', deduplicated.map(f => ({ name: f.name, signature: f.signature })));

    return {
      original: testFiles.length,
      deduplicated: deduplicated.length,
      duplicatesRemoved: testFiles.length - deduplicated.length,
      files: deduplicated
    };
  },

  /**
   * Test file lifecycle management
   */
  async testLifecycleManagement() {
    console.log('🧪 Testing file lifecycle management...');

    if (!window.knowledgeBaseManager) {
      console.error('Knowledge base manager not initialized');
      return;
    }

    try {
      // Test expired file cleanup
      await window.knowledgeBaseManager.cleanupExpiredFiles();
      console.log('✅ Expired file cleanup completed');

      // Test file accessibility validation
      await window.knowledgeBaseManager.validateFileAccessibility();
      console.log('✅ File accessibility validation completed');

      return { success: true, message: 'Lifecycle management tests completed' };

    } catch (error) {
      console.error('❌ Lifecycle management test failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Test optimized file retrieval
   */
  async testOptimizedRetrieval() {
    console.log('🧪 Testing optimized file retrieval...');

    if (!window.knowledgeBaseManager) {
      console.error('Knowledge base manager not initialized');
      return;
    }

    try {
      // Test different retrieval scenarios
      const scenarios = [
        { name: 'Manual Selection', options: { manuallySelectedFiles: ['file1', 'file2'] } },
        { name: 'Smart Selection', options: { enableSmartSelection: true, promptText: 'Analyze {{file:report.pdf}}' } },
        { name: 'Fallback All', options: { fallbackToAll: true } },
        { name: 'No Options', options: {} }
      ];

      const results = {};

      for (const scenario of scenarios) {
        const files = await window.knowledgeBaseManager.getKnowledgeBaseFilesOptimized(scenario.options);
        results[scenario.name] = {
          count: files.length,
          files: files.map(f => ({ name: f.name, signature: f.signature }))
        };
        console.log(`${scenario.name}: ${files.length} files`);
      }

      return results;

    } catch (error) {
      console.error('❌ Optimized retrieval test failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Running comprehensive file management tests...');

    const results = {
      duplicatePrevention: await this.testDuplicatePrevention(),
      lifecycleManagement: await this.testLifecycleManagement(),
      optimizedRetrieval: await this.testOptimizedRetrieval()
    };

    console.log('📊 Test Results:', results);
    return results;
  }
};
