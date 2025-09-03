/**
 * Settings Backup and Sync Utility
 * Handles backup and sync of custom prompts and knowledge base variables
 * Follows existing patterns from conversation export and Google Drive integration
 */

class SettingsBackupManager {
  constructor() {
    this.storageManager = window.storageManager;
    this.googleDriveClient = window.googleDriveClient;
    this.initialized = false;
  }

  /**
   * Initialize the backup manager
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Ensure storage manager is available
      if (!this.storageManager) {
        this.storageManager = window.storageManager;
      }
      
      this.initialized = true;
      console.log('aiFiverr Settings Backup: Initialized successfully');
    } catch (error) {
      console.error('aiFiverr Settings Backup: Initialization failed:', error);
    }
  }

  /**
   * Export custom prompts to local file
   */
  async exportCustomPrompts(format = 'json') {
    try {
      await this.init();
      
      const customPrompts = await this.storageManager?.get('customPrompts') || {};
      const favoritePrompts = await this.storageManager?.get('favoritePrompts') || [];
      
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'custom_prompts',
        data: {
          customPrompts: customPrompts.customPrompts || {},
          favoritePrompts: favoritePrompts.favoritePrompts || []
        },
        metadata: {
          totalPrompts: Object.keys(customPrompts.customPrompts || {}).length,
          totalFavorites: (favoritePrompts.favoritePrompts || []).length,
          exportFormat: format
        }
      };

      return this.formatExportData(exportData, format, 'custom-prompts');
    } catch (error) {
      console.error('aiFiverr Settings Backup: Export custom prompts failed:', error);
      throw new Error(`Failed to export custom prompts: ${error.message}`);
    }
  }

  /**
   * Export knowledge base variables to local file
   */
  async exportKnowledgeBase(format = 'json') {
    try {
      await this.init();
      
      const knowledgeBase = await this.storageManager?.get('knowledgeBase') || {};
      
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'knowledge_base',
        data: {
          knowledgeBase: knowledgeBase.knowledgeBase || {}
        },
        metadata: {
          totalVariables: Object.keys(knowledgeBase.knowledgeBase || {}).length,
          exportFormat: format
        }
      };

      return this.formatExportData(exportData, format, 'knowledge-base');
    } catch (error) {
      console.error('aiFiverr Settings Backup: Export knowledge base failed:', error);
      throw new Error(`Failed to export knowledge base: ${error.message}`);
    }
  }

  /**
   * Export all settings (prompts + knowledge base) to local file
   */
  async exportAllSettings(format = 'json') {
    try {
      await this.init();
      
      const customPrompts = await this.storageManager?.get('customPrompts') || {};
      const favoritePrompts = await this.storageManager?.get('favoritePrompts') || [];
      const knowledgeBase = await this.storageManager?.get('knowledgeBase') || {};
      
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        exportedAt: new Date().toISOString(),
        type: 'all_settings',
        data: {
          customPrompts: customPrompts.customPrompts || {},
          favoritePrompts: favoritePrompts.favoritePrompts || [],
          knowledgeBase: knowledgeBase.knowledgeBase || {}
        },
        metadata: {
          totalPrompts: Object.keys(customPrompts.customPrompts || {}).length,
          totalFavorites: (favoritePrompts.favoritePrompts || []).length,
          totalVariables: Object.keys(knowledgeBase.knowledgeBase || {}).length,
          exportFormat: format
        }
      };

      return this.formatExportData(exportData, format, 'all-settings');
    } catch (error) {
      console.error('aiFiverr Settings Backup: Export all settings failed:', error);
      throw new Error(`Failed to export all settings: ${error.message}`);
    }
  }

  /**
   * Format export data based on the specified format
   */
  formatExportData(exportData, format, filePrefix) {
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (format) {
      case 'json':
        return {
          content: JSON.stringify(exportData, null, 2),
          filename: `aifiverr-${filePrefix}-${timestamp}.json`,
          mimeType: 'application/json'
        };
        
      case 'markdown':
        return {
          content: this.convertToMarkdown(exportData),
          filename: `aifiverr-${filePrefix}-${timestamp}.md`,
          mimeType: 'text/markdown'
        };
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert export data to markdown format
   */
  convertToMarkdown(exportData) {
    let markdown = `# aiFiverr Settings Export\n\n`;
    markdown += `**Export Date:** ${exportData.exportedAt}\n`;
    markdown += `**Export Type:** ${exportData.type.replace('_', ' ').toUpperCase()}\n`;
    markdown += `**Version:** ${exportData.version}\n\n`;

    // Add metadata
    if (exportData.metadata) {
      markdown += `## Export Summary\n\n`;
      Object.entries(exportData.metadata).forEach(([key, value]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        markdown += `- **${label}:** ${value}\n`;
      });
      markdown += `\n`;
    }

    // Add custom prompts
    if (exportData.data.customPrompts && Object.keys(exportData.data.customPrompts).length > 0) {
      markdown += `## Custom Prompts\n\n`;
      Object.entries(exportData.data.customPrompts).forEach(([key, prompt]) => {
        markdown += `### ${prompt.name} (${key})\n\n`;
        markdown += `**Description:** ${prompt.description || 'No description'}\n\n`;
        markdown += `**Content:**\n\`\`\`\n${prompt.prompt}\n\`\`\`\n\n`;
        if (prompt.knowledgeBaseFiles && prompt.knowledgeBaseFiles.length > 0) {
          markdown += `**Knowledge Base Files:** ${prompt.knowledgeBaseFiles.join(', ')}\n\n`;
        }
        markdown += `**Created:** ${new Date(prompt.created).toLocaleString()}\n`;
        markdown += `**Modified:** ${new Date(prompt.modified).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Add knowledge base variables
    if (exportData.data.knowledgeBase && Object.keys(exportData.data.knowledgeBase).length > 0) {
      markdown += `## Knowledge Base Variables\n\n`;
      Object.entries(exportData.data.knowledgeBase).forEach(([key, value]) => {
        markdown += `### {{${key}}}\n\n`;
        markdown += `\`\`\`\n${value}\n\`\`\`\n\n`;
      });
    }

    // Add favorite prompts
    if (exportData.data.favoritePrompts && exportData.data.favoritePrompts.length > 0) {
      markdown += `## Favorite Prompts\n\n`;
      exportData.data.favoritePrompts.forEach(promptKey => {
        markdown += `- ${promptKey}\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Import custom prompts from local file
   */
  async importCustomPrompts(fileContent, options = {}) {
    try {
      await this.init();
      
      const importData = this.parseImportData(fileContent);
      
      if (importData.type !== 'custom_prompts' && importData.type !== 'all_settings') {
        throw new Error('Invalid import file: not a custom prompts export');
      }

      const { customPrompts, favoritePrompts } = importData.data;
      
      // Validate data structure
      this.validateCustomPromptsData(customPrompts);
      this.validateFavoritePromptsData(favoritePrompts);

      // Handle conflicts if merge mode is enabled
      if (options.merge) {
        return await this.mergeCustomPrompts(customPrompts, favoritePrompts, options);
      } else {
        return await this.replaceCustomPrompts(customPrompts, favoritePrompts);
      }
    } catch (error) {
      console.error('aiFiverr Settings Backup: Import custom prompts failed:', error);
      throw new Error(`Failed to import custom prompts: ${error.message}`);
    }
  }

  /**
   * Import knowledge base variables from local file
   */
  async importKnowledgeBase(fileContent, options = {}) {
    try {
      await this.init();
      
      const importData = this.parseImportData(fileContent);
      
      if (importData.type !== 'knowledge_base' && importData.type !== 'all_settings') {
        throw new Error('Invalid import file: not a knowledge base export');
      }

      const { knowledgeBase } = importData.data;
      
      // Validate data structure
      this.validateKnowledgeBaseData(knowledgeBase);

      // Handle conflicts if merge mode is enabled
      if (options.merge) {
        return await this.mergeKnowledgeBase(knowledgeBase, options);
      } else {
        return await this.replaceKnowledgeBase(knowledgeBase);
      }
    } catch (error) {
      console.error('aiFiverr Settings Backup: Import knowledge base failed:', error);
      throw new Error(`Failed to import knowledge base: ${error.message}`);
    }
  }

  /**
   * Parse import data from file content
   */
  parseImportData(fileContent) {
    try {
      // Try to parse as JSON first
      return JSON.parse(fileContent);
    } catch (jsonError) {
      // If JSON parsing fails, try to extract from markdown
      try {
        return this.parseMarkdownImport(fileContent);
      } catch (markdownError) {
        throw new Error('Invalid file format: must be JSON or Markdown export');
      }
    }
  }

  /**
   * Parse markdown import (basic implementation)
   */
  parseMarkdownImport(markdownContent) {
    // This is a simplified markdown parser for the specific format we export
    // In a full implementation, you might want to use a proper markdown parser
    throw new Error('Markdown import not yet implemented. Please use JSON format.');
  }

  /**
   * Validate custom prompts data structure
   */
  validateCustomPromptsData(customPrompts) {
    if (!customPrompts || typeof customPrompts !== 'object') {
      throw new Error('Invalid custom prompts data structure');
    }
    
    for (const [key, prompt] of Object.entries(customPrompts)) {
      if (!prompt.name || !prompt.prompt) {
        throw new Error(`Invalid prompt data for key "${key}": missing name or prompt`);
      }
    }
  }

  /**
   * Validate favorite prompts data structure
   */
  validateFavoritePromptsData(favoritePrompts) {
    if (favoritePrompts && !Array.isArray(favoritePrompts)) {
      throw new Error('Invalid favorite prompts data: must be an array');
    }
  }

  /**
   * Validate knowledge base data structure
   */
  validateKnowledgeBaseData(knowledgeBase) {
    if (!knowledgeBase || typeof knowledgeBase !== 'object') {
      throw new Error('Invalid knowledge base data structure');
    }
  }

  /**
   * Replace custom prompts completely
   */
  async replaceCustomPrompts(customPrompts, favoritePrompts) {
    try {
      const result = await this.storageManager.set({
        customPrompts: customPrompts || {},
        favoritePrompts: favoritePrompts || []
      });

      if (!result) {
        throw new Error('Failed to save custom prompts to storage');
      }

      return {
        success: true,
        imported: Object.keys(customPrompts || {}).length,
        favorites: (favoritePrompts || []).length,
        conflicts: 0,
        message: 'Custom prompts imported successfully'
      };
    } catch (error) {
      throw new Error(`Failed to replace custom prompts: ${error.message}`);
    }
  }

  /**
   * Merge custom prompts with existing data
   */
  async mergeCustomPrompts(newCustomPrompts, newFavoritePrompts, options = {}) {
    try {
      // Get existing data
      const existingCustomPrompts = await this.storageManager?.get('customPrompts') || {};
      const existingFavoritePrompts = await this.storageManager?.get('favoritePrompts') || [];

      const currentCustomPrompts = existingCustomPrompts.customPrompts || {};
      const currentFavoritePrompts = existingFavoritePrompts.favoritePrompts || [];

      // Merge custom prompts
      const mergedCustomPrompts = { ...currentCustomPrompts };
      const conflicts = [];
      let imported = 0;

      for (const [key, prompt] of Object.entries(newCustomPrompts || {})) {
        if (currentCustomPrompts[key]) {
          // Handle conflict
          if (options.overwriteConflicts) {
            mergedCustomPrompts[key] = prompt;
            conflicts.push({ key, action: 'overwritten' });
          } else {
            conflicts.push({ key, action: 'skipped' });
            continue;
          }
        } else {
          mergedCustomPrompts[key] = prompt;
          imported++;
        }
      }

      // Merge favorite prompts
      const mergedFavoritePrompts = [...new Set([...currentFavoritePrompts, ...(newFavoritePrompts || [])])];

      // Save merged data
      const result = await this.storageManager.set({
        customPrompts: mergedCustomPrompts,
        favoritePrompts: mergedFavoritePrompts
      });

      if (!result) {
        throw new Error('Failed to save merged custom prompts to storage');
      }

      return {
        success: true,
        imported,
        favorites: mergedFavoritePrompts.length - currentFavoritePrompts.length,
        conflicts: conflicts.length,
        conflictDetails: conflicts,
        message: `Imported ${imported} prompts, ${conflicts.length} conflicts ${options.overwriteConflicts ? 'resolved' : 'skipped'}`
      };
    } catch (error) {
      throw new Error(`Failed to merge custom prompts: ${error.message}`);
    }
  }

  /**
   * Replace knowledge base completely
   */
  async replaceKnowledgeBase(knowledgeBase) {
    try {
      const result = await this.storageManager.set({
        knowledgeBase: knowledgeBase || {}
      });

      if (!result) {
        throw new Error('Failed to save knowledge base to storage');
      }

      return {
        success: true,
        imported: Object.keys(knowledgeBase || {}).length,
        conflicts: 0,
        message: 'Knowledge base imported successfully'
      };
    } catch (error) {
      throw new Error(`Failed to replace knowledge base: ${error.message}`);
    }
  }

  /**
   * Merge knowledge base with existing data
   */
  async mergeKnowledgeBase(newKnowledgeBase, options = {}) {
    try {
      // Get existing data
      const existingKnowledgeBase = await this.storageManager?.get('knowledgeBase') || {};
      const currentKnowledgeBase = existingKnowledgeBase.knowledgeBase || {};

      // Merge knowledge base variables
      const mergedKnowledgeBase = { ...currentKnowledgeBase };
      const conflicts = [];
      let imported = 0;

      for (const [key, value] of Object.entries(newKnowledgeBase || {})) {
        if (currentKnowledgeBase[key]) {
          // Handle conflict
          if (options.overwriteConflicts) {
            mergedKnowledgeBase[key] = value;
            conflicts.push({ key, action: 'overwritten' });
          } else {
            conflicts.push({ key, action: 'skipped' });
            continue;
          }
        } else {
          mergedKnowledgeBase[key] = value;
          imported++;
        }
      }

      // Save merged data
      const result = await this.storageManager.set({
        knowledgeBase: mergedKnowledgeBase
      });

      if (!result) {
        throw new Error('Failed to save merged knowledge base to storage');
      }

      return {
        success: true,
        imported,
        conflicts: conflicts.length,
        conflictDetails: conflicts,
        message: `Imported ${imported} variables, ${conflicts.length} conflicts ${options.overwriteConflicts ? 'resolved' : 'skipped'}`
      };
    } catch (error) {
      throw new Error(`Failed to merge knowledge base: ${error.message}`);
    }
  }

  /**
   * Backup custom prompts to Google Drive
   */
  async backupCustomPromptsToGoogleDrive() {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Get current custom prompts and favorites
      const customPrompts = await this.storageManager?.get('customPrompts') || {};
      const favoritePrompts = await this.storageManager?.get('favoritePrompts') || [];

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        backedUpAt: new Date().toISOString(),
        type: 'custom_prompts_backup',
        data: {
          customPrompts: customPrompts.customPrompts || {},
          favoritePrompts: favoritePrompts.favoritePrompts || []
        }
      };

      const fileName = `aifiverr-custom-prompts-backup-${new Date().toISOString().split('T')[0]}.json`;
      const description = `aiFiverr custom prompts backup - ${new Date().toLocaleString()}`;

      await this.googleDriveClient.saveDataFile(fileName, backupData, description);

      return {
        success: true,
        fileName,
        promptCount: Object.keys(backupData.data.customPrompts).length,
        favoriteCount: backupData.data.favoritePrompts.length,
        message: 'Custom prompts backed up to Google Drive successfully'
      };
    } catch (error) {
      console.error('aiFiverr Settings Backup: Google Drive backup failed:', error);
      throw new Error(`Failed to backup to Google Drive: ${error.message}`);
    }
  }

  /**
   * Backup knowledge base to Google Drive
   */
  async backupKnowledgeBaseToGoogleDrive() {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Get current knowledge base
      const knowledgeBase = await this.storageManager?.get('knowledgeBase') || {};

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        backedUpAt: new Date().toISOString(),
        type: 'knowledge_base_backup',
        data: {
          knowledgeBase: knowledgeBase.knowledgeBase || {}
        }
      };

      const fileName = `aifiverr-knowledge-base-backup-${new Date().toISOString().split('T')[0]}.json`;
      const description = `aiFiverr knowledge base backup - ${new Date().toLocaleString()}`;

      await this.googleDriveClient.saveDataFile(fileName, backupData, description);

      return {
        success: true,
        fileName,
        variableCount: Object.keys(backupData.data.knowledgeBase).length,
        message: 'Knowledge base backed up to Google Drive successfully'
      };
    } catch (error) {
      console.error('aiFiverr Settings Backup: Google Drive backup failed:', error);
      throw new Error(`Failed to backup to Google Drive: ${error.message}`);
    }
  }

  /**
   * Backup all settings to Google Drive
   */
  async backupAllSettingsToGoogleDrive() {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Get all settings data
      const customPrompts = await this.storageManager?.get('customPrompts') || {};
      const favoritePrompts = await this.storageManager?.get('favoritePrompts') || [];
      const knowledgeBase = await this.storageManager?.get('knowledgeBase') || {};

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        backedUpAt: new Date().toISOString(),
        type: 'all_settings_backup',
        data: {
          customPrompts: customPrompts.customPrompts || {},
          favoritePrompts: favoritePrompts.favoritePrompts || [],
          knowledgeBase: knowledgeBase.knowledgeBase || {}
        }
      };

      const fileName = `aifiverr-all-settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      const description = `aiFiverr complete settings backup - ${new Date().toLocaleString()}`;

      await this.googleDriveClient.saveDataFile(fileName, backupData, description);

      return {
        success: true,
        fileName,
        promptCount: Object.keys(backupData.data.customPrompts).length,
        favoriteCount: backupData.data.favoritePrompts.length,
        variableCount: Object.keys(backupData.data.knowledgeBase).length,
        message: 'All settings backed up to Google Drive successfully'
      };
    } catch (error) {
      console.error('aiFiverr Settings Backup: Google Drive backup failed:', error);
      throw new Error(`Failed to backup to Google Drive: ${error.message}`);
    }
  }

  /**
   * Restore custom prompts from Google Drive
   */
  async restoreCustomPromptsFromGoogleDrive(options = {}) {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Find the most recent custom prompts backup
      const backupFile = await this.findLatestBackupFile('custom_prompts_backup');
      if (!backupFile) {
        return {
          success: false,
          message: 'No custom prompts backup found in Google Drive'
        };
      }

      // Load the backup data
      const backupData = await this.googleDriveClient.loadDataFile(backupFile.name);

      if (!backupData || backupData.type !== 'custom_prompts_backup') {
        throw new Error('Invalid backup file format');
      }

      // Import the data
      const result = options.merge
        ? await this.mergeCustomPrompts(backupData.data.customPrompts, backupData.data.favoritePrompts, options)
        : await this.replaceCustomPrompts(backupData.data.customPrompts, backupData.data.favoritePrompts);

      return {
        ...result,
        backupFile: backupFile.name,
        backupDate: backupData.backedUpAt
      };
    } catch (error) {
      console.error('aiFiverr Settings Backup: Google Drive restore failed:', error);
      throw new Error(`Failed to restore from Google Drive: ${error.message}`);
    }
  }

  /**
   * Restore knowledge base from Google Drive
   */
  async restoreKnowledgeBaseFromGoogleDrive(options = {}) {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Find the most recent knowledge base backup
      const backupFile = await this.findLatestBackupFile('knowledge_base_backup');
      if (!backupFile) {
        return {
          success: false,
          message: 'No knowledge base backup found in Google Drive'
        };
      }

      // Load the backup data
      const backupData = await this.googleDriveClient.loadDataFile(backupFile.name);

      if (!backupData || backupData.type !== 'knowledge_base_backup') {
        throw new Error('Invalid backup file format');
      }

      // Import the data
      const result = options.merge
        ? await this.mergeKnowledgeBase(backupData.data.knowledgeBase, options)
        : await this.replaceKnowledgeBase(backupData.data.knowledgeBase);

      return {
        ...result,
        backupFile: backupFile.name,
        backupDate: backupData.backedUpAt
      };
    } catch (error) {
      console.error('aiFiverr Settings Backup: Google Drive restore failed:', error);
      throw new Error(`Failed to restore from Google Drive: ${error.message}`);
    }
  }

  /**
   * Auto-sync settings on authentication
   */
  async autoSyncOnAuthentication(options = { merge: true, overwriteConflicts: false }) {
    try {
      if (!this.googleDriveClient) {
        console.log('aiFiverr Settings Backup: Google Drive client not available for auto-sync');
        return { success: false, message: 'Google Drive not available' };
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        console.log('aiFiverr Settings Backup: Not authenticated, skipping auto-sync');
        return { success: false, message: 'Not authenticated' };
      }

      console.log('aiFiverr Settings Backup: Starting auto-sync...');

      const results = {
        customPrompts: null,
        knowledgeBase: null,
        success: false
      };

      // Try to restore custom prompts
      try {
        results.customPrompts = await this.restoreCustomPromptsFromGoogleDrive(options);
        console.log('aiFiverr Settings Backup: Custom prompts sync result:', results.customPrompts);
      } catch (error) {
        console.warn('aiFiverr Settings Backup: Custom prompts sync failed:', error.message);
        results.customPrompts = { success: false, message: error.message };
      }

      // Try to restore knowledge base
      try {
        results.knowledgeBase = await this.restoreKnowledgeBaseFromGoogleDrive(options);
        console.log('aiFiverr Settings Backup: Knowledge base sync result:', results.knowledgeBase);
      } catch (error) {
        console.warn('aiFiverr Settings Backup: Knowledge base sync failed:', error.message);
        results.knowledgeBase = { success: false, message: error.message };
      }

      // Determine overall success
      results.success = results.customPrompts?.success || results.knowledgeBase?.success;

      if (results.success) {
        console.log('aiFiverr Settings Backup: Auto-sync completed successfully');
      } else {
        console.log('aiFiverr Settings Backup: Auto-sync found no backups to restore');
      }

      return results;
    } catch (error) {
      console.error('aiFiverr Settings Backup: Auto-sync failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Find the latest backup file of a specific type
   */
  async findLatestBackupFile(backupType) {
    try {
      // Search for backup files in Google Drive
      const searchQuery = `name contains 'aifiverr' and name contains 'backup' and mimeType='application/json'`;
      const files = await this.googleDriveClient.searchFiles(searchQuery);

      if (!files || files.length === 0) {
        return null;
      }

      // Filter files by backup type and find the most recent
      let latestFile = null;
      let latestDate = 0;

      for (const file of files) {
        try {
          // Load file to check its type
          const fileData = await this.googleDriveClient.loadDataFile(file.name);
          if (fileData && fileData.type === backupType) {
            const fileDate = new Date(fileData.backedUpAt || fileData.timestamp).getTime();
            if (fileDate > latestDate) {
              latestDate = fileDate;
              latestFile = file;
            }
          }
        } catch (error) {
          console.warn(`aiFiverr Settings Backup: Failed to check file ${file.name}:`, error.message);
        }
      }

      return latestFile;
    } catch (error) {
      console.error('aiFiverr Settings Backup: Failed to find backup files:', error);
      return null;
    }
  }

  /**
   * List all available backup files
   */
  async listBackupFiles() {
    try {
      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Search for backup files
      const searchQuery = `name contains 'aifiverr' and name contains 'backup' and mimeType='application/json'`;
      const files = await this.googleDriveClient.searchFiles(searchQuery);

      if (!files || files.length === 0) {
        return [];
      }

      // Get details for each backup file
      const backupFiles = [];
      for (const file of files) {
        try {
          const fileData = await this.googleDriveClient.loadDataFile(file.name);
          if (fileData) {
            backupFiles.push({
              id: file.id,
              name: file.name,
              type: fileData.type,
              backedUpAt: fileData.backedUpAt || new Date(fileData.timestamp).toISOString(),
              size: file.size,
              metadata: fileData.data ? {
                promptCount: Object.keys(fileData.data.customPrompts || {}).length,
                favoriteCount: (fileData.data.favoritePrompts || []).length,
                variableCount: Object.keys(fileData.data.knowledgeBase || {}).length
              } : null
            });
          }
        } catch (error) {
          console.warn(`aiFiverr Settings Backup: Failed to load backup file ${file.name}:`, error.message);
        }
      }

      // Sort by backup date (newest first)
      backupFiles.sort((a, b) => new Date(b.backedUpAt).getTime() - new Date(a.backedUpAt).getTime());

      return backupFiles;
    } catch (error) {
      console.error('aiFiverr Settings Backup: Failed to list backup files:', error);
      throw new Error(`Failed to list backup files: ${error.message}`);
    }
  }
}

// Make the class available globally
window.SettingsBackupManager = SettingsBackupManager;

// Auto-initialize if storage manager is available
if (window.storageManager) {
  window.settingsBackupManager = new SettingsBackupManager();
}
