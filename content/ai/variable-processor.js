/**
 * Variable Processor - Smart variable handling for aiFiverr extension
 * Only includes variables and files when explicitly referenced in prompts
 */

class VariableProcessor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the variable processor
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('aiFiverr: Variable Processor initialized');
  }

  /**
   * Parse prompt to find variable references
   * @param {string} promptText - The prompt text to analyze
   * @returns {Object} - Object containing found variables and files
   */
  parsePromptReferences(promptText) {
    if (!promptText || typeof promptText !== 'string') {
      return {
        variables: [],
        knowledgeBaseVariables: [],
        fileReferences: [],
        hasVariables: false,
        hasFiles: false
      };
    }

    const result = {
      variables: [],
      knowledgeBaseVariables: [],
      fileReferences: [],
      hasVariables: false,
      hasFiles: false
    };

    // Find single brace variables {variable_name}
    const singleBraceRegex = /\{([^{}]+)\}/g;
    let match;
    while ((match = singleBraceRegex.exec(promptText)) !== null) {
      const varName = match[1].trim();
      if (!result.variables.includes(varName)) {
        result.variables.push(varName);
      }
    }

    // Find double brace variables {{variable_name}}
    const doubleBraceRegex = /\{\{([^{}]+)\}\}/g;
    while ((match = doubleBraceRegex.exec(promptText)) !== null) {
      const varName = match[1].trim();
      
      // Check if it's a file reference
      if (varName.startsWith('file:')) {
        const fileName = varName.substring(5);
        if (!result.fileReferences.includes(fileName)) {
          result.fileReferences.push(fileName);
        }
      } else {
        // It's a knowledge base variable
        if (!result.knowledgeBaseVariables.includes(varName)) {
          result.knowledgeBaseVariables.push(varName);
        }
      }
    }

    result.hasVariables = result.variables.length > 0 || result.knowledgeBaseVariables.length > 0;
    result.hasFiles = result.fileReferences.length > 0;

    console.log('aiFiverr Variable Processor: Parsed prompt references:', result);
    return result;
  }

  /**
   * Get context variables based on prompt requirements
   * @param {string} promptText - The prompt text
   * @param {Object} availableContext - Available context data
   * @returns {Object} - Context object with only required variables
   */
  async getRequiredContext(promptText, availableContext = {}) {
    const references = this.parsePromptReferences(promptText);
    const context = {};

    // Only include variables that are referenced in the prompt
    for (const varName of references.variables) {
      if (availableContext.hasOwnProperty(varName)) {
        // FIXED: Use provided context directly to prevent duplication
        context[varName] = availableContext[varName];
        console.log(`aiFiverr Variable Processor: Including provided variable {${varName}}`);
      } else {
        // Only auto-populate if not already provided in context
        const value = await this.getSystemVariable(varName);
        if (value !== null) {
          context[varName] = value;
          console.log(`aiFiverr Variable Processor: Auto-populated system variable {${varName}}`);
        }
      }
    }

    // Include knowledge base variables only if referenced
    if (references.knowledgeBaseVariables.length > 0) {
      const kbVariables = await this.getKnowledgeBaseVariables(references.knowledgeBaseVariables);
      Object.assign(context, kbVariables);
    }

    console.log('aiFiverr Variable Processor: Final context:', Object.keys(context));
    return context;
  }

  /**
   * Get knowledge base files that are referenced in the prompt or manually attached
   * @param {string} promptText - The prompt text
   * @param {Array} manuallyAttachedFiles - Files manually attached through UI
   * @returns {Array} - Array of knowledge base files to attach
   */
  async getRequiredFiles(promptText, manuallyAttachedFiles = []) {
    const references = this.parsePromptReferences(promptText);
    const requiredFiles = [];

    // PRIORITY 1: Always include manually attached files (regardless of prompt references)
    if (manuallyAttachedFiles && manuallyAttachedFiles.length > 0) {
      console.log('aiFiverr Variable Processor: Processing manually attached files:', manuallyAttachedFiles.length);

      for (const attachedFile of manuallyAttachedFiles) {
        if (attachedFile && attachedFile.geminiUri) {
          requiredFiles.push(attachedFile);
          console.log(`aiFiverr Variable Processor: Including manually attached file: ${attachedFile.name}`);
        } else if (attachedFile && attachedFile.name) {
          // ENHANCED: If file doesn't have geminiUri, try to resolve it from knowledge base
          console.log(`aiFiverr Variable Processor: File missing geminiUri, attempting to resolve: ${attachedFile.name}`);

          if (window.knowledgeBaseManager) {
            try {
              const resolvedFiles = await window.knowledgeBaseManager.resolveKnowledgeBaseFiles([attachedFile]);
              if (resolvedFiles.length > 0 && resolvedFiles[0].geminiUri) {
                requiredFiles.push(resolvedFiles[0]);
                console.log(`aiFiverr Variable Processor: Successfully resolved file: ${resolvedFiles[0].name}`);
              } else {
                console.warn(`aiFiverr Variable Processor: Could not resolve file: ${attachedFile.name}`);
              }
            } catch (error) {
              console.error(`aiFiverr Variable Processor: Error resolving file ${attachedFile.name}:`, error);
            }
          }
        }
      }
    }

    // PRIORITY 2: Add files referenced via {{file:filename}} syntax (if not already included)
    if (references.hasFiles) {
      const kbManager = window.knowledgeBaseManager;
      if (!kbManager) {
        console.warn('aiFiverr Variable Processor: Knowledge base manager not available for file references');
      } else {
        // Get files that match the references
        for (const fileName of references.fileReferences) {
          try {
            const files = kbManager.getAllFiles();
            const matchingFile = Array.from(files.values()).find(file =>
              file.name === fileName || file.name.includes(fileName)
            );

            if (matchingFile && matchingFile.geminiUri) {
              // Check if this file is already included from manual attachments
              const alreadyIncluded = requiredFiles.some(file =>
                file.geminiUri === matchingFile.geminiUri ||
                file.name === matchingFile.name
              );

              if (!alreadyIncluded) {
                requiredFiles.push(matchingFile);
                console.log(`aiFiverr Variable Processor: Including file reference {{file:${fileName}}}`);
              } else {
                console.log(`aiFiverr Variable Processor: File ${fileName} already included from manual attachments`);
              }
            } else {
              console.warn(`aiFiverr Variable Processor: File not found or not ready: ${fileName}`);
            }
          } catch (error) {
            console.error(`aiFiverr Variable Processor: Error getting file ${fileName}:`, error);
          }
        }
      }
    }

    if (requiredFiles.length === 0) {
      console.log('aiFiverr Variable Processor: No files to attach (no manual attachments or file references)');
    }

    return requiredFiles;
  }

  /**
   * Get system variables (Fiverr-specific auto-populated variables)
   * @param {string} varName - Variable name
   * @returns {string|null} - Variable value or null if not available
   */
  async getSystemVariable(varName) {
    try {
      switch (varName) {
        case 'username':
          if (window.fiverrExtractor) {
            return window.fiverrExtractor.extractUsernameFromUrl() || 'Client';
          }
          return 'User';

        case 'conversation':
          // FIXED: Only extract conversation if not already provided in context
          // This prevents duplication when conversation is already available
          if (window.fiverrExtractor) {
            const conversationData = await window.fiverrExtractor.extractConversation();
            return conversationData ? window.fiverrExtractor.conversationToContext(conversationData) : '';
          }
          return '';

        case 'conversation_summary':
          if (window.fiverrExtractor) {
            const conversationData = await window.fiverrExtractor.extractConversation();
            return conversationData ? window.fiverrExtractor.getConversationSummary(conversationData) : '';
          }
          return '';

        case 'conversation_count':
          if (window.fiverrExtractor) {
            const conversationData = await window.fiverrExtractor.extractConversation();
            return conversationData ? (conversationData.messages?.length || 0).toString() : '0';
          }
          return '0';

        case 'conversation_last_message':
          if (window.fiverrExtractor) {
            const conversationData = await window.fiverrExtractor.extractConversation();
            if (conversationData && conversationData.messages && conversationData.messages.length > 0) {
              const lastMessage = conversationData.messages[conversationData.messages.length - 1];
              return lastMessage.body || '';
            }
          }
          return '';

        default:
          return null;
      }
    } catch (error) {
      console.error(`aiFiverr Variable Processor: Error getting system variable ${varName}:`, error);
      return null;
    }
  }

  /**
   * Get specific knowledge base variables
   * @param {Array} variableNames - Array of variable names to get
   * @returns {Object} - Object with variable name-value pairs
   */
  async getKnowledgeBaseVariables(variableNames) {
    const variables = {};
    
    try {
      const kbManager = window.knowledgeBaseManager;
      if (!kbManager) {
        console.warn('aiFiverr Variable Processor: Knowledge base manager not available');
        return variables;
      }

      for (const varName of variableNames) {
        const value = kbManager.getVariable(varName);
        if (value) {
          variables[varName] = value;
          console.log(`aiFiverr Variable Processor: Including KB variable {{${varName}}}`);
        }
      }
    } catch (error) {
      console.error('aiFiverr Variable Processor: Error getting KB variables:', error);
    }

    return variables;
  }

  /**
   * Process a prompt with smart variable and file inclusion
   * @param {string} promptText - The prompt text
   * @param {Object} additionalContext - Additional context variables
   * @param {Array} manuallyAttachedFiles - Files manually attached through UI
   * @returns {Object} - Processed prompt data
   */
  async processPrompt(promptText, additionalContext = {}, manuallyAttachedFiles = []) {
    try {
      // Get required context based on prompt references
      const requiredContext = await this.getRequiredContext(promptText, additionalContext);

      // Get required files based on prompt references AND manually attached files
      const requiredFiles = await this.getRequiredFiles(promptText, manuallyAttachedFiles);

      // Process the prompt text with variables
      let processedPrompt = promptText;

      // FIXED: Track which variables have been replaced to prevent duplication
      const replacedVariables = new Set();

      // Replace single brace variables
      Object.entries(requiredContext).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        if (processedPrompt.includes(`{${key}}`)) {
          processedPrompt = processedPrompt.replace(regex, value || '');
          replacedVariables.add(key);
          console.log(`aiFiverr Variable Processor: Replaced {${key}} with content length: ${(value || '').length}`);
        }
      });

      // Replace knowledge base variables (only if not already replaced)
      if (window.knowledgeBaseManager) {
        // Get references to avoid double processing
        const references = this.parsePromptReferences(processedPrompt);
        if (references.knowledgeBaseVariables.length > 0) {
          processedPrompt = window.knowledgeBaseManager.replaceVariables(processedPrompt);
        }
      }

      // Replace file references with file information
      if (window.knowledgeBaseManager) {
        processedPrompt = window.knowledgeBaseManager.replaceFileReferences(processedPrompt);
      }

      const result = {
        prompt: processedPrompt,
        knowledgeBaseFiles: requiredFiles,
        usedVariables: Object.keys(requiredContext),
        usedFiles: requiredFiles.map(f => f.name)
      };

      console.log('aiFiverr Variable Processor: Processed prompt result:', {
        originalLength: promptText.length,
        processedLength: processedPrompt.length,
        usedVariables: result.usedVariables,
        usedFiles: result.usedFiles
      });

      return result;
    } catch (error) {
      console.error('aiFiverr Variable Processor: Error processing prompt:', error);
      return {
        prompt: promptText,
        knowledgeBaseFiles: [],
        usedVariables: [],
        usedFiles: []
      };
    }
  }
}

// Create global instance
window.variableProcessor = new VariableProcessor();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.variableProcessor.init();
  });
} else {
  window.variableProcessor.init();
}

console.log('aiFiverr: Variable Processor loaded');
