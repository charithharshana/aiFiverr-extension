/**
 * Backup and Sync Manager
 * Handles backup and synchronization of custom prompts and variables
 * Supports local export/import and Google Drive sync
 */

class BackupSyncManager {
  constructor() {
    this.version = '1.0.0';
    this.activityLog = [];
    this.maxLogEntries = 50;
    this.isInitialized = false;
    this.googleDriveClient = null;
    this.storageManager = null;
    this.knowledgeBaseManager = null;
    
    this.init();
  }

  async init() {
    try {
      // Wait for dependencies to be available
      await this.waitForDependencies();

      this.googleDriveClient = window.googleDriveClient;
      this.storageManager = window.storageManager;
      this.knowledgeBaseManager = window.knowledgeBaseManager;

      // Load activity log
      await this.loadActivityLog();

      // Set up authentication listeners for auto-sync
      this.setupAuthListeners();

      this.isInitialized = true;
      this.logActivity('system', 'BackupSyncManager initialized successfully');

      console.log('aiFiverr BackupSync: Manager initialized successfully');
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to initialize:', error);
      this.logActivity('error', `Initialization failed: ${error.message}`);
    }
  }

  async waitForDependencies() {
    const maxWait = 10000; // 10 seconds
    const checkInterval = 100; // 100ms
    let waited = 0;

    while (waited < maxWait) {
      if (window.googleDriveClient && window.storageManager && window.knowledgeBaseManager) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    
    throw new Error('Required dependencies not available after timeout');
  }

  /**
   * Export custom prompts and variables to local files
   */
  async exportToLocal(format = 'json') {
    try {
      if (!this.isInitialized) {
        throw new Error('BackupSyncManager not initialized');
      }

      this.logActivity('export', `Starting local export in ${format} format`);

      // Get current data
      const exportData = await this.prepareExportData();
      
      let content, filename, mimeType;

      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          filename = `aifiverr-settings-backup-${this.getDateString()}.json`;
          mimeType = 'application/json';
          break;
          
        case 'markdown':
          content = this.convertToMarkdown(exportData);
          filename = `aifiverr-settings-backup-${this.getDateString()}.md`;
          mimeType = 'text/markdown';
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      this.logActivity('export', `Local export completed: ${filename}`);
      
      return {
        content,
        filename,
        mimeType,
        size: content.length
      };

    } catch (error) {
      this.logActivity('error', `Local export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import backup data from file content
   */
  async importFromLocal(fileContent, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('BackupSyncManager not initialized');
      }

      this.logActivity('import', 'Starting local import');

      // Parse and validate import data
      const importData = this.parseImportData(fileContent);
      this.validateImportData(importData);

      // Check for conflicts
      const conflicts = await this.detectConflicts(importData);
      
      if (conflicts.length > 0 && !options.forceOverwrite) {
        this.logActivity('import', `Import paused: ${conflicts.length} conflicts detected`);
        return {
          success: false,
          conflicts,
          requiresUserDecision: true,
          importData
        };
      }

      // Apply import
      await this.applyImportData(importData, options);
      
      this.logActivity('import', 'Local import completed successfully');
      
      return {
        success: true,
        imported: {
          customPrompts: Object.keys(importData.customPrompts || {}).length,
          variables: Object.keys(importData.knowledgeBase || {}).length
        }
      };

    } catch (error) {
      this.logActivity('error', `Local import failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync with Google Drive
   */
  async syncWithGoogleDrive(direction = 'auto') {
    try {
      if (!this.isInitialized) {
        throw new Error('BackupSyncManager not initialized');
      }

      if (!this.googleDriveClient || !await this.googleDriveClient.isAuthenticated()) {
        throw new Error('Google Drive authentication required');
      }

      this.logActivity('sync', `Starting Google Drive sync (${direction})`);

      const localData = await this.prepareExportData();
      const cloudData = await this.loadFromGoogleDrive();

      let syncResult;

      switch (direction) {
        case 'upload':
          syncResult = await this.uploadToGoogleDrive(localData);
          break;
          
        case 'download':
          syncResult = await this.downloadFromGoogleDrive(cloudData);
          break;
          
        case 'auto':
        default:
          syncResult = await this.performAutoSync(localData, cloudData);
          break;
      }

      this.logActivity('sync', `Google Drive sync completed: ${syncResult.action}`);
      return syncResult;

    } catch (error) {
      this.logActivity('error', `Google Drive sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare export data structure
   */
  async prepareExportData() {
    const customPrompts = await this.storageManager.get('customPrompts');
    const knowledgeBase = await this.storageManager.getKnowledgeBase();
    
    return {
      version: this.version,
      timestamp: Date.now(),
      exportType: 'aifiverr-settings-backup',
      customPrompts: customPrompts.customPrompts || {},
      knowledgeBase: knowledgeBase || {},
      metadata: {
        exportedAt: new Date().toISOString(),
        totalPrompts: Object.keys(customPrompts.customPrompts || {}).length,
        totalVariables: Object.keys(knowledgeBase || {}).length
      }
    };
  }

  /**
   * Parse import data from file content
   */
  parseImportData(fileContent) {
    try {
      // Try JSON first
      return JSON.parse(fileContent);
    } catch (jsonError) {
      // Try to detect if it's markdown and extract JSON
      if (fileContent.includes('```json')) {
        const jsonMatch = fileContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch (markdownJsonError) {
            throw new Error('Invalid JSON in markdown format');
          }
        }
      }
      throw new Error('Invalid import file format. Please provide a valid JSON backup file.');
    }
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data structure');
    }

    if (!data.exportType || data.exportType !== 'aifiverr-settings-backup') {
      throw new Error('Invalid backup file type');
    }

    if (!data.version) {
      throw new Error('Missing version information');
    }

    // Check version compatibility
    if (!this.isVersionCompatible(data.version)) {
      throw new Error(`Incompatible backup version: ${data.version}`);
    }

    return true;
  }

  /**
   * Check version compatibility
   */
  isVersionCompatible(version) {
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.version.split('.').map(Number);
    
    return major <= currentMajor;
  }

  /**
   * Detect conflicts between import data and existing data
   */
  async detectConflicts(importData) {
    const conflicts = [];
    
    // Check custom prompts conflicts
    const existingPrompts = await this.storageManager.get('customPrompts');
    const currentPrompts = existingPrompts.customPrompts || {};
    
    Object.keys(importData.customPrompts || {}).forEach(key => {
      if (currentPrompts[key]) {
        conflicts.push({
          type: 'customPrompt',
          key,
          current: currentPrompts[key],
          incoming: importData.customPrompts[key]
        });
      }
    });

    // Check knowledge base variables conflicts
    const currentKB = await this.storageManager.getKnowledgeBase();
    
    Object.keys(importData.knowledgeBase || {}).forEach(key => {
      if (currentKB[key]) {
        conflicts.push({
          type: 'variable',
          key,
          current: currentKB[key],
          incoming: importData.knowledgeBase[key]
        });
      }
    });

    return conflicts;
  }

  /**
   * Apply import data to storage
   */
  async applyImportData(importData, options = {}) {
    const { mergeStrategy = 'overwrite' } = options;

    // Import custom prompts
    if (importData.customPrompts) {
      const existingPrompts = await this.storageManager.get('customPrompts');
      let updatedPrompts = existingPrompts.customPrompts || {};

      if (mergeStrategy === 'overwrite') {
        updatedPrompts = { ...updatedPrompts, ...importData.customPrompts };
      } else if (mergeStrategy === 'skip') {
        Object.keys(importData.customPrompts).forEach(key => {
          if (!updatedPrompts[key]) {
            updatedPrompts[key] = importData.customPrompts[key];
          }
        });
      }

      await this.storageManager.set({ customPrompts: updatedPrompts });
      
      // Update knowledge base manager
      if (this.knowledgeBaseManager) {
        this.knowledgeBaseManager.customPrompts.clear();
        Object.entries(updatedPrompts).forEach(([key, prompt]) => {
          this.knowledgeBaseManager.customPrompts.set(key, prompt);
        });
      }
    }

    // Import knowledge base variables
    if (importData.knowledgeBase) {
      const currentKB = await this.storageManager.getKnowledgeBase();
      let updatedKB = { ...currentKB };

      if (mergeStrategy === 'overwrite') {
        updatedKB = { ...updatedKB, ...importData.knowledgeBase };
      } else if (mergeStrategy === 'skip') {
        Object.keys(importData.knowledgeBase).forEach(key => {
          if (!updatedKB[key]) {
            updatedKB[key] = importData.knowledgeBase[key];
          }
        });
      }

      await this.storageManager.saveKnowledgeBase(updatedKB);
      
      // Update knowledge base manager
      if (this.knowledgeBaseManager) {
        this.knowledgeBaseManager.variables.clear();
        Object.entries(updatedKB).forEach(([key, value]) => {
          this.knowledgeBaseManager.variables.set(key, value);
        });
      }
    }
  }

  /**
   * Convert export data to markdown format
   */
  convertToMarkdown(exportData) {
    let markdown = `# aiFiverr Settings Backup\n\n`;
    markdown += `**Exported:** ${new Date(exportData.timestamp).toLocaleString()}\n`;
    markdown += `**Version:** ${exportData.version}\n\n`;

    // Custom Prompts section
    markdown += `## Custom Prompts (${exportData.metadata.totalPrompts})\n\n`;
    
    Object.entries(exportData.customPrompts || {}).forEach(([key, prompt]) => {
      markdown += `### ${prompt.name || key}\n\n`;
      if (prompt.description) {
        markdown += `**Description:** ${prompt.description}\n\n`;
      }
      markdown += `**Prompt:**\n\`\`\`\n${prompt.prompt || ''}\n\`\`\`\n\n`;
      if (prompt.knowledgeBaseFiles && prompt.knowledgeBaseFiles.length > 0) {
        markdown += `**Files:** ${prompt.knowledgeBaseFiles.join(', ')}\n\n`;
      }
      markdown += `---\n\n`;
    });

    // Variables section
    markdown += `## Knowledge Base Variables (${exportData.metadata.totalVariables})\n\n`;
    
    Object.entries(exportData.knowledgeBase || {}).forEach(([key, value]) => {
      markdown += `**${key}:** ${value}\n\n`;
    });

    // Include JSON data for re-import
    markdown += `## Raw Data (for import)\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(exportData, null, 2)}\n\`\`\`\n`;

    return markdown;
  }

  /**
   * Get formatted date string for filenames
   */
  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Log activity with timestamp
   */
  logActivity(type, message) {
    const entry = {
      timestamp: Date.now(),
      type,
      message,
      date: new Date().toISOString()
    };

    this.activityLog.unshift(entry);
    
    // Keep only recent entries
    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog = this.activityLog.slice(0, this.maxLogEntries);
    }

    // Save to storage
    this.saveActivityLog();
  }

  /**
   * Get recent activity log
   */
  getActivityLog(limit = 10) {
    return this.activityLog.slice(0, limit);
  }

  /**
   * Save activity log to storage
   */
  async saveActivityLog() {
    try {
      if (this.storageManager) {
        await this.storageManager.set({ backupActivityLog: this.activityLog });
      }
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to save activity log:', error);
    }
  }

  /**
   * Load activity log from storage
   */
  async loadActivityLog() {
    try {
      if (this.storageManager) {
        const result = await this.storageManager.get('backupActivityLog');
        this.activityLog = result.backupActivityLog || [];
      }
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to load activity log:', error);
      this.activityLog = [];
    }
  }

  /**
   * Upload backup data to Google Drive
   */
  async uploadToGoogleDrive(exportData) {
    try {
      const fileName = `aifiverr-settings-backup-${this.getDateString()}.json`;
      const jsonData = JSON.stringify(exportData, null, 2);

      const result = await this.googleDriveClient.saveDataFile(
        fileName,
        exportData,
        'aiFiverr settings backup'
      );

      return {
        success: true,
        action: 'uploaded',
        fileId: result.id,
        fileName,
        size: jsonData.length
      };
    } catch (error) {
      throw new Error(`Google Drive upload failed: ${error.message}`);
    }
  }

  /**
   * Load backup data from Google Drive
   */
  async loadFromGoogleDrive() {
    try {
      // List backup files in Google Drive
      const files = await this.googleDriveClient.listFiles();
      const backupFiles = files.filter(file =>
        file.name.startsWith('aifiverr-settings-backup-') &&
        file.name.endsWith('.json')
      );

      if (backupFiles.length === 0) {
        return null;
      }

      // Get the most recent backup file
      const latestFile = backupFiles.sort((a, b) =>
        new Date(b.modifiedTime) - new Date(a.modifiedTime)
      )[0];

      // Download and parse the file
      const fileBlob = await this.googleDriveClient.downloadFile(latestFile.id);
      const fileContent = await fileBlob.text();

      return {
        data: JSON.parse(fileContent),
        fileInfo: latestFile
      };
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to load from Google Drive:', error);
      return null;
    }
  }

  /**
   * Download and apply backup from Google Drive
   */
  async downloadFromGoogleDrive(cloudData) {
    if (!cloudData) {
      throw new Error('No backup data found in Google Drive');
    }

    await this.applyImportData(cloudData.data, { mergeStrategy: 'overwrite' });

    return {
      success: true,
      action: 'downloaded',
      fileName: cloudData.fileInfo.name,
      timestamp: cloudData.fileInfo.modifiedTime
    };
  }

  /**
   * Perform automatic sync based on data comparison
   */
  async performAutoSync(localData, cloudData) {
    // If no cloud data exists, upload local data
    if (!cloudData) {
      if (this.hasLocalData(localData)) {
        return await this.uploadToGoogleDrive(localData);
      } else {
        return { success: true, action: 'no_action', reason: 'No data to sync' };
      }
    }

    // If no local data exists, download cloud data
    if (!this.hasLocalData(localData)) {
      return await this.downloadFromGoogleDrive(cloudData);
    }

    // Compare timestamps to determine sync direction
    const localTimestamp = localData.timestamp || 0;
    const cloudTimestamp = cloudData.data.timestamp || 0;

    if (localTimestamp > cloudTimestamp) {
      // Local data is newer, upload to cloud
      return await this.uploadToGoogleDrive(localData);
    } else if (cloudTimestamp > localTimestamp) {
      // Cloud data is newer, download to local
      return await this.downloadFromGoogleDrive(cloudData);
    } else {
      // Data is in sync
      return { success: true, action: 'in_sync', reason: 'Data is already synchronized' };
    }
  }

  /**
   * Check if local data has meaningful content
   */
  hasLocalData(localData) {
    const hasPrompts = Object.keys(localData.customPrompts || {}).length > 0;
    const hasVariables = Object.keys(localData.knowledgeBase || {}).length > 0;
    return hasPrompts || hasVariables;
  }

  /**
   * Set up authentication listeners for auto-sync
   */
  setupAuthListeners() {
    try {
      // Listen for Firebase authentication changes
      if (window.firebaseAuth) {
        window.firebaseAuth.addAuthListener((authState) => {
          this.handleAuthStateChange(authState);
        });
      }

      // Also listen for Google authentication changes (fallback)
      if (window.googleAuth) {
        window.googleAuth.addAuthListener((authState) => {
          this.handleAuthStateChange(authState);
        });
      }

      console.log('aiFiverr BackupSync: Authentication listeners set up');
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to set up auth listeners:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  async handleAuthStateChange(authState) {
    try {
      if (authState.isAuthenticated) {
        this.logActivity('auth', 'User signed in - triggering auto-sync');

        // Wait a moment for other systems to initialize
        setTimeout(async () => {
          await this.performAutoSyncOnSignIn();
        }, 2000);
      } else {
        this.logActivity('auth', 'User signed out');
      }
    } catch (error) {
      console.error('aiFiverr BackupSync: Error handling auth state change:', error);
      this.logActivity('error', `Auth state change error: ${error.message}`);
    }
  }

  /**
   * Perform auto-sync when user signs in
   */
  async performAutoSyncOnSignIn() {
    try {
      if (!this.isInitialized) {
        console.log('aiFiverr BackupSync: Not initialized, skipping auto-sync');
        return;
      }

      this.logActivity('sync', 'Starting auto-sync on sign-in');

      const localData = await this.prepareExportData();
      const hasLocalData = this.hasLocalData(localData);

      if (!hasLocalData) {
        // New user or empty local data - try to restore from cloud
        this.logActivity('sync', 'No local data found - attempting cloud restore');

        try {
          const result = await this.syncWithGoogleDrive('download');
          if (result.success && result.action === 'downloaded') {
            this.logActivity('sync', 'Successfully restored settings from cloud');
          } else {
            this.logActivity('sync', 'No cloud backup found for new user');
          }
        } catch (error) {
          this.logActivity('warning', `Cloud restore failed: ${error.message}`);
        }
      } else {
        // Existing user with local data - perform smart sync
        this.logActivity('sync', 'Local data found - performing smart sync');

        try {
          const result = await this.syncWithGoogleDrive('auto');
          if (result.success) {
            this.logActivity('sync', `Auto-sync completed: ${result.action}`);
          }
        } catch (error) {
          this.logActivity('warning', `Auto-sync failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('aiFiverr BackupSync: Auto-sync on sign-in failed:', error);
      this.logActivity('error', `Auto-sync failed: ${error.message}`);
    }
  }

  /**
   * Get backup status information
   */
  async getBackupStatus() {
    try {
      const localData = await this.prepareExportData();
      const isAuthenticated = this.googleDriveClient && await this.googleDriveClient.isAuthenticated();

      let cloudStatus = {
        connected: isAuthenticated,
        lastBackup: null,
        hasBackup: false
      };

      if (isAuthenticated) {
        try {
          const cloudData = await this.loadFromGoogleDrive();
          if (cloudData) {
            cloudStatus.hasBackup = true;
            cloudStatus.lastBackup = cloudData.fileInfo.modifiedTime;
          }
        } catch (error) {
          console.error('aiFiverr BackupSync: Failed to check cloud status:', error);
        }
      }

      return {
        local: {
          totalPrompts: localData.metadata.totalPrompts,
          totalVariables: localData.metadata.totalVariables,
          lastModified: localData.timestamp
        },
        cloud: cloudStatus,
        recentActivity: this.getActivityLog(5)
      };
    } catch (error) {
      console.error('aiFiverr BackupSync: Failed to get backup status:', error);
      throw error;
    }
  }
}

// Initialize global instance
if (typeof window !== 'undefined') {
  window.backupSyncManager = new BackupSyncManager();
}
