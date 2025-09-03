/**
 * Backup and Sync Manager for aiFiverr Extension
 * Handles export/import of custom prompts and variables to/from local files and Google Drive
 */

class BackupSyncManager {
  constructor() {
    this.storageManager = window.storageManager;
    this.googleDriveClient = window.googleDriveClient;
    this.exportVersion = '1.0.0';
    this.supportedFormats = ['json', 'markdown'];
  }

  /**
   * Initialize the backup sync manager
   */
  async initialize() {
    try {
      if (!this.storageManager) {
        console.warn('aiFiverr Backup: Storage manager not available');
        return false;
      }

      // Set up authentication listener for auto-sync
      this.setupAuthListener();

      console.log('aiFiverr Backup: Backup Sync Manager initialized');
      return true;
    } catch (error) {
      console.error('aiFiverr Backup: Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Set up authentication listener for auto-sync
   */
  setupAuthListener() {
    try {
      // Check if Google Auth Service is available
      if (window.googleAuthService && typeof window.googleAuthService.addAuthListener === 'function') {
        // Add listener for authentication state changes
        window.googleAuthService.addAuthListener(async (authState) => {
          if (authState.isAuthenticated && authState.user) {
            console.log('aiFiverr Backup: User authenticated, triggering auto-sync');

            // Delay auto-sync slightly to ensure all services are ready
            setTimeout(async () => {
              try {
                const result = await this.autoSyncOnAuth();
                console.log('aiFiverr Backup: Auto-sync completed:', result);
              } catch (error) {
                console.error('aiFiverr Backup: Auto-sync failed:', error);
              }
            }, 2000); // 2 second delay
          }
        });

        console.log('aiFiverr Backup: Authentication listener registered');
      } else {
        console.warn('aiFiverr Backup: Google Auth Service not available for auto-sync');
      }
    } catch (error) {
      console.error('aiFiverr Backup: Failed to setup auth listener:', error);
    }
  }

  /**
   * Export custom prompts and variables to local file
   */
  async exportToLocal(format = 'json', options = {}) {
    try {
      console.log('aiFiverr Backup: Starting local export in format:', format);

      // Get current custom prompts and variables
      const exportData = await this.gatherExportData();

      // Format the data based on requested format
      const formattedData = await this.formatExportData(exportData, format, options);

      // Create and download the file
      await this.downloadFile(formattedData.content, formattedData.filename, formattedData.mimeType);

      console.log('aiFiverr Backup: Local export completed successfully');
      return {
        success: true,
        filename: formattedData.filename,
        format: format,
        itemCount: this.getExportItemCount(exportData)
      };

    } catch (error) {
      console.error('aiFiverr Backup: Local export failed:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Import custom prompts and variables from local file
   */
  async importFromLocal(fileContent, options = {}) {
    try {
      console.log('aiFiverr Backup: Starting local import');

      // Parse the import data
      const importData = await this.parseImportData(fileContent);

      // Validate the import data
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data structure');
      }

      // Check for conflicts if not forcing import
      const conflicts = await this.detectConflicts(importData);
      if (conflicts.length > 0 && !options.forceImport) {
        return {
          success: false,
          conflicts: conflicts,
          requiresUserDecision: true
        };
      }

      // Perform the import
      const results = await this.performImport(importData, options);

      console.log('aiFiverr Backup: Local import completed successfully');
      return {
        success: true,
        results: results
      };

    } catch (error) {
      console.error('aiFiverr Backup: Local import failed:', error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Sync to Google Drive
   */
  async syncToGoogleDrive() {
    try {
      console.log('aiFiverr Backup: Starting Google Drive sync');

      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Get current data
      const exportData = await this.gatherExportData();

      // Create backup file
      const backupData = {
        version: this.exportVersion,
        timestamp: Date.now(),
        type: 'aifiverr-settings-backup',
        data: exportData
      };

      const fileName = `aifiverr-settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      const description = 'aiFiverr custom prompts and variables backup';

      // Save to Google Drive
      await this.googleDriveClient.saveDataFile(fileName, backupData, description);

      console.log('aiFiverr Backup: Google Drive sync completed successfully');
      return {
        success: true,
        filename: fileName,
        timestamp: backupData.timestamp
      };

    } catch (error) {
      console.error('aiFiverr Backup: Google Drive sync failed:', error);
      throw new Error(`Google Drive sync failed: ${error.message}`);
    }
  }

  /**
   * Restore from Google Drive
   */
  async restoreFromGoogleDrive(options = {}) {
    try {
      console.log('aiFiverr Backup: Starting Google Drive restore');

      if (!this.googleDriveClient) {
        throw new Error('Google Drive client not available');
      }

      // Check authentication
      const authResult = await this.googleDriveClient.testConnection();
      if (!authResult.success) {
        throw new Error('Google Drive authentication required');
      }

      // Find the most recent backup file
      const backupFile = await this.findLatestBackupFile();
      if (!backupFile) {
        return {
          success: false,
          message: 'No backup files found in Google Drive'
        };
      }

      // Download and parse the backup
      const blob = await this.googleDriveClient.downloadFile(backupFile.id);
      const text = await blob.text();
      const backupData = JSON.parse(text);

      // Check for conflicts if not forcing restore
      const conflicts = await this.detectConflicts(backupData.data);
      if (conflicts.length > 0 && !options.forceRestore) {
        return {
          success: false,
          conflicts: conflicts,
          requiresUserDecision: true,
          backupInfo: {
            filename: backupFile.name,
            timestamp: backupData.timestamp,
            version: backupData.version
          }
        };
      }

      // Perform the restore
      const results = await this.performImport(backupData.data, options);

      console.log('aiFiverr Backup: Google Drive restore completed successfully');
      return {
        success: true,
        results: results,
        backupInfo: {
          filename: backupFile.name,
          timestamp: backupData.timestamp,
          version: backupData.version
        }
      };

    } catch (error) {
      console.error('aiFiverr Backup: Google Drive restore failed:', error);
      throw new Error(`Google Drive restore failed: ${error.message}`);
    }
  }

  /**
   * Auto-sync on authentication (called when user authenticates with Google)
   */
  async autoSyncOnAuth() {
    try {
      console.log('aiFiverr Backup: Starting auto-sync on authentication');

      // First, try to restore from Google Drive if local data is empty
      const currentData = await this.gatherExportData();
      const hasLocalData = this.hasSignificantData(currentData);

      if (!hasLocalData) {
        console.log('aiFiverr Backup: No local data found, attempting restore from Google Drive');
        const restoreResult = await this.restoreFromGoogleDrive({ forceRestore: true });
        if (restoreResult.success) {
          console.log('aiFiverr Backup: Successfully restored data from Google Drive');
          return { restored: true, synced: false };
        }
      }

      // Then sync current data to Google Drive
      const syncResult = await this.syncToGoogleDrive();
      if (syncResult.success) {
        console.log('aiFiverr Backup: Successfully synced data to Google Drive');
        return { restored: false, synced: true };
      }

      return { restored: false, synced: false };

    } catch (error) {
      console.error('aiFiverr Backup: Auto-sync failed:', error);
      return { restored: false, synced: false, error: error.message };
    }
  }

  /**
   * Get sync status information
   */
  async getSyncStatus() {
    try {
      const status = {
        googleDriveConnected: false,
        lastBackupDate: null,
        localDataCount: 0,
        cloudDataAvailable: false
      };

      // Check Google Drive connection
      if (this.googleDriveClient) {
        const authResult = await this.googleDriveClient.testConnection();
        status.googleDriveConnected = authResult.success;

        if (status.googleDriveConnected) {
          // Check for existing backup files
          const backupFile = await this.findLatestBackupFile();
          if (backupFile) {
            status.cloudDataAvailable = true;
            status.lastBackupDate = new Date(backupFile.modifiedTime);
          }
        }
      }

      // Count local data
      const localData = await this.gatherExportData();
      status.localDataCount = this.getExportItemCount(localData);

      return status;

    } catch (error) {
      console.error('aiFiverr Backup: Failed to get sync status:', error);
      return {
        googleDriveConnected: false,
        lastBackupDate: null,
        localDataCount: 0,
        cloudDataAvailable: false,
        error: error.message
      };
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Gather all export data (custom prompts and variables)
   */
  async gatherExportData() {
    try {
      const data = {
        customPrompts: {},
        knowledgeBaseVariables: {}
      };

      // Get custom prompts
      const customPromptsResult = await this.storageManager.get('customPrompts');
      data.customPrompts = customPromptsResult.customPrompts || {};

      // Get knowledge base variables
      const knowledgeBaseResult = await this.storageManager.get('knowledgeBase');
      data.knowledgeBaseVariables = knowledgeBaseResult.knowledgeBase || {};

      console.log('aiFiverr Backup: Gathered export data:', {
        customPrompts: Object.keys(data.customPrompts).length,
        knowledgeBaseVariables: Object.keys(data.knowledgeBaseVariables).length
      });

      return data;

    } catch (error) {
      console.error('aiFiverr Backup: Failed to gather export data:', error);
      throw error;
    }
  }

  /**
   * Format export data based on requested format
   */
  async formatExportData(data, format, options = {}) {
    const timestamp = new Date().toISOString().split('T')[0];

    switch (format.toLowerCase()) {
      case 'json':
        return this.formatAsJSON(data, timestamp, options);
      case 'markdown':
        return this.formatAsMarkdown(data, timestamp, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Format data as JSON
   */
  formatAsJSON(data, timestamp, options = {}) {
    const exportData = {
      version: this.exportVersion,
      timestamp: Date.now(),
      exportDate: timestamp,
      type: 'aifiverr-settings-export',
      data: data
    };

    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `aifiverr-settings-${timestamp}.json`,
      mimeType: 'application/json'
    };
  }

  /**
   * Format data as Markdown
   */
  formatAsMarkdown(data, timestamp, options = {}) {
    let markdown = `# aiFiverr Settings Export\n\n`;
    markdown += `**Export Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Version:** ${this.exportVersion}\n\n`;

    // Custom Prompts section
    if (data.customPrompts && Object.keys(data.customPrompts).length > 0) {
      markdown += `## Custom Prompts (${Object.keys(data.customPrompts).length})\n\n`;

      Object.entries(data.customPrompts).forEach(([key, prompt]) => {
        markdown += `### ${prompt.name || key}\n\n`;
        if (prompt.description) {
          markdown += `**Description:** ${prompt.description}\n\n`;
        }
        markdown += `**Prompt:**\n\`\`\`\n${prompt.prompt || ''}\n\`\`\`\n\n`;
        if (prompt.knowledgeBaseFiles && prompt.knowledgeBaseFiles.length > 0) {
          markdown += `**Knowledge Base Files:** ${prompt.knowledgeBaseFiles.join(', ')}\n\n`;
        }
        markdown += `**Created:** ${new Date(prompt.created || 0).toLocaleString()}\n`;
        markdown += `**Modified:** ${new Date(prompt.modified || 0).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Knowledge Base Variables section
    if (data.knowledgeBaseVariables && Object.keys(data.knowledgeBaseVariables).length > 0) {
      markdown += `## Knowledge Base Variables (${Object.keys(data.knowledgeBaseVariables).length})\n\n`;

      Object.entries(data.knowledgeBaseVariables).forEach(([key, value]) => {
        markdown += `### {{${key}}}\n\n`;
        markdown += `\`\`\`\n${value}\n\`\`\`\n\n`;
      });
    }

    return {
      content: markdown,
      filename: `aifiverr-settings-${timestamp}.md`,
      mimeType: 'text/markdown'
    };
  }

  /**
   * Parse import data from file content
   */
  async parseImportData(fileContent) {
    try {
      // Try to parse as JSON first
      const importData = JSON.parse(fileContent);

      // If it's a direct export, return the data section
      if (importData.type === 'aifiverr-settings-export' && importData.data) {
        return importData.data;
      }

      // If it's already in the expected format, return as is
      if (importData.customPrompts || importData.knowledgeBaseVariables) {
        return importData;
      }

      throw new Error('Unrecognized import data format');

    } catch (parseError) {
      throw new Error('Invalid import file format. Please provide a valid JSON export file.');
    }
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check if it has at least one of the expected sections
    const hasCustomPrompts = data.customPrompts && typeof data.customPrompts === 'object';
    const hasVariables = data.knowledgeBaseVariables && typeof data.knowledgeBaseVariables === 'object';

    return hasCustomPrompts || hasVariables;
  }

  /**
   * Detect conflicts between import data and existing data
   */
  async detectConflicts(importData) {
    try {
      const conflicts = [];
      const currentData = await this.gatherExportData();

      // Check custom prompts conflicts
      if (importData.customPrompts) {
        Object.keys(importData.customPrompts).forEach(key => {
          if (currentData.customPrompts[key]) {
            conflicts.push({
              type: 'customPrompt',
              key: key,
              name: importData.customPrompts[key].name || key,
              current: currentData.customPrompts[key],
              incoming: importData.customPrompts[key]
            });
          }
        });
      }

      // Check knowledge base variables conflicts
      if (importData.knowledgeBaseVariables) {
        Object.keys(importData.knowledgeBaseVariables).forEach(key => {
          if (currentData.knowledgeBaseVariables[key]) {
            conflicts.push({
              type: 'knowledgeBaseVariable',
              key: key,
              name: key,
              current: currentData.knowledgeBaseVariables[key],
              incoming: importData.knowledgeBaseVariables[key]
            });
          }
        });
      }

      return conflicts;

    } catch (error) {
      console.error('aiFiverr Backup: Failed to detect conflicts:', error);
      return [];
    }
  }

  /**
   * Perform the actual import operation
   */
  async performImport(importData, options = {}) {
    try {
      const results = {
        customPrompts: 0,
        knowledgeBaseVariables: 0,
        errors: []
      };

      // Import custom prompts
      if (importData.customPrompts) {
        try {
          const currentPrompts = await this.storageManager.get('customPrompts');
          const mergedPrompts = options.replaceExisting
            ? importData.customPrompts
            : { ...currentPrompts.customPrompts || {}, ...importData.customPrompts };

          await this.storageManager.set({ customPrompts: mergedPrompts });
          results.customPrompts = Object.keys(importData.customPrompts).length;

          console.log('aiFiverr Backup: Imported custom prompts:', results.customPrompts);
        } catch (error) {
          results.errors.push(`Custom prompts import failed: ${error.message}`);
        }
      }

      // Import knowledge base variables
      if (importData.knowledgeBaseVariables) {
        try {
          const currentVariables = await this.storageManager.get('knowledgeBase');
          const mergedVariables = options.replaceExisting
            ? importData.knowledgeBaseVariables
            : { ...currentVariables.knowledgeBase || {}, ...importData.knowledgeBaseVariables };

          await this.storageManager.set({ knowledgeBase: mergedVariables });
          results.knowledgeBaseVariables = Object.keys(importData.knowledgeBaseVariables).length;

          console.log('aiFiverr Backup: Imported knowledge base variables:', results.knowledgeBaseVariables);
        } catch (error) {
          results.errors.push(`Knowledge base variables import failed: ${error.message}`);
        }
      }

      // Trigger reload of managers if they exist
      if (window.knowledgeBaseManager) {
        await window.knowledgeBaseManager.loadKnowledgeBase();
        await window.knowledgeBaseManager.loadCustomPrompts();
      }

      return results;

    } catch (error) {
      console.error('aiFiverr Backup: Import operation failed:', error);
      throw error;
    }
  }

  /**
   * Find the latest backup file in Google Drive
   */
  async findLatestBackupFile() {
    try {
      if (!this.googleDriveClient) {
        return null;
      }

      // Search for backup files
      const files = await this.googleDriveClient.searchFiles('aifiverr-settings-backup');

      if (files.length === 0) {
        return null;
      }

      // Return the most recent file
      return files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime))[0];

    } catch (error) {
      console.error('aiFiverr Backup: Failed to find backup files:', error);
      return null;
    }
  }

  /**
   * Check if data contains significant content
   */
  hasSignificantData(data) {
    const promptCount = data.customPrompts ? Object.keys(data.customPrompts).length : 0;
    const variableCount = data.knowledgeBaseVariables ? Object.keys(data.knowledgeBaseVariables).length : 0;

    return promptCount > 0 || variableCount > 0;
  }

  /**
   * Get count of items in export data
   */
  getExportItemCount(data) {
    const promptCount = data.customPrompts ? Object.keys(data.customPrompts).length : 0;
    const variableCount = data.knowledgeBaseVariables ? Object.keys(data.knowledgeBaseVariables).length : 0;

    return promptCount + variableCount;
  }

  /**
   * Download file to user's computer
   */
  async downloadFile(content, filename, mimeType) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      console.log('aiFiverr Backup: File downloaded:', filename);
    } catch (error) {
      console.error('aiFiverr Backup: File download failed:', error);
      throw error;
    }
  }
}

// Initialize global backup sync manager
window.initializeBackupSyncManager = function() {
  if (!window.backupSyncManager) {
    window.backupSyncManager = new BackupSyncManager();
    console.log('aiFiverr: Backup Sync Manager created');
  }
  return window.backupSyncManager;
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackupSyncManager;
}
