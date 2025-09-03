/**
 * Google Drive API Client for aiFiverr Extension
 * Handles knowledge base file uploads, folder management, and file operations
 */

class GoogleDriveClient {
  constructor() {
    this.baseUrl = "https://www.googleapis.com/drive/v3";
    this.uploadUrl = "https://www.googleapis.com/upload/drive/v3";
    this.aiFiverrFolderName = "aiFiverr";
    this.aiFiverrFolderId = null;
    this.subfolderIds = {}; // Cache for subfolder IDs
    this.initialized = false;

    // Define organized folder structure
    this.folderStructure = {
      'knowledge-base': {
        'text': ['txt', 'md', 'docx', 'doc', 'rtf'],
        'video': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
        'audio': ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'],
        'documents': ['pdf', 'ppt', 'pptx', 'xls', 'xlsx']
      },
      'chat': [], // For Fiverr conversation files
      'prompts': [], // For custom prompts backup
      'variables': [] // For knowledge base variables backup
    };

    this.init();
  }

  async init() {
    try {
      this.initialized = true;
      console.log('aiFiverr Drive: Client initialized (Firebase-compatible)');
    } catch (error) {
      console.error('aiFiverr Drive: Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * Get access token from Firebase auth service
   */
  async getAccessToken() {
    if (!window.googleAuthService) {
      throw new Error('Firebase Google Auth Service not available');
    }

    // Firebase auth service handles token refresh automatically
    const token = await window.googleAuthService.getAccessToken();

    if (!token) {
      console.warn('aiFiverr Drive: No Firebase access token available, attempting refresh...');
      await window.googleAuthService.refreshTokenIfNeeded();
      return window.googleAuthService.getAccessToken();
    }

    return token;
  }

  /**
   * Make authenticated request to Google Drive API
   */
  async makeRequest(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    if (!token) {
      throw new Error('No access token available');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Drive API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create or get aiFiverr knowledge base folder
   */
  async ensureAiFiverrFolder() {
    try {
      if (this.aiFiverrFolderId) {
        return this.aiFiverrFolderId;
      }

      // Search for existing folder
      const searchResponse = await this.makeRequest(`/files?q=name='${this.aiFiverrFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);

      if (searchResponse.files && searchResponse.files.length > 0) {
        this.aiFiverrFolderId = searchResponse.files[0].id;
        console.log('aiFiverr Drive: Found existing folder:', this.aiFiverrFolderId);
      } else {
        // Create new folder
        const createResponse = await this.makeRequest('/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: this.aiFiverrFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          })
        });

        this.aiFiverrFolderId = createResponse.id;
        console.log('aiFiverr Drive: Created new folder:', this.aiFiverrFolderId);
      }

      // Ensure organized subfolder structure exists
      await this.ensureOrganizedFolderStructure();

      return this.aiFiverrFolderId;

    } catch (error) {
      console.error('aiFiverr Drive: Failed to ensure folder:', error);
      throw error;
    }
  }

  /**
   * Create organized subfolder structure within aiFiverr folder
   */
  async ensureOrganizedFolderStructure() {
    try {
      const rootFolderId = this.aiFiverrFolderId;

      // Create main category folders
      for (const [categoryName, subcategories] of Object.entries(this.folderStructure)) {
        const categoryFolderId = await this.ensureSubfolder(categoryName, rootFolderId);

        // Create subcategory folders if they exist
        if (typeof subcategories === 'object' && !Array.isArray(subcategories)) {
          for (const subcategoryName of Object.keys(subcategories)) {
            await this.ensureSubfolder(subcategoryName, categoryFolderId);
          }
        }
      }

      console.log('aiFiverr Drive: Organized folder structure ensured');
    } catch (error) {
      console.error('aiFiverr Drive: Failed to create organized folder structure:', error);
    }
  }

  /**
   * Ensure a subfolder exists within a parent folder
   */
  async ensureSubfolder(folderName, parentFolderId) {
    try {
      const cacheKey = `${parentFolderId}/${folderName}`;

      // Check cache first
      if (this.subfolderIds[cacheKey]) {
        return this.subfolderIds[cacheKey];
      }

      // Search for existing subfolder
      const searchResponse = await this.makeRequest(
        `/files?q=name='${folderName}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      );

      if (searchResponse.files && searchResponse.files.length > 0) {
        const folderId = searchResponse.files[0].id;
        this.subfolderIds[cacheKey] = folderId;
        return folderId;
      }

      // Create new subfolder
      const createResponse = await this.makeRequest('/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        })
      });

      const folderId = createResponse.id;
      this.subfolderIds[cacheKey] = folderId;
      console.log(`aiFiverr Drive: Created subfolder '${folderName}':`, folderId);
      return folderId;

    } catch (error) {
      console.error(`aiFiverr Drive: Failed to ensure subfolder '${folderName}':`, error);
      throw error;
    }
  }

  /**
   * Determine the appropriate folder for a file based on its type
   */
  getFileTypeFolder(fileName, mimeType) {
    const extension = fileName.split('.').pop()?.toLowerCase();

    // Check each category and subcategory
    for (const [categoryName, subcategories] of Object.entries(this.folderStructure)) {
      if (typeof subcategories === 'object' && !Array.isArray(subcategories)) {
        for (const [subcategoryName, extensions] of Object.entries(subcategories)) {
          if (extensions.includes(extension)) {
            return `${categoryName}/${subcategoryName}`;
          }
        }
      }
    }

    // Default to knowledge-base/documents for unknown types
    return 'knowledge-base/documents';
  }

  /**
   * Get folder ID for a specific file type path
   */
  async getFolderIdForPath(folderPath) {
    const pathParts = folderPath.split('/');
    let currentFolderId = this.aiFiverrFolderId;

    for (const folderName of pathParts) {
      currentFolderId = await this.ensureSubfolder(folderName, currentFolderId);
    }

    return currentFolderId;
  }

  /**
   * Validate file for knowledge base upload
   */
  validateKnowledgeBaseFile(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB limit for Drive storage
    const allowedTypes = [
      // Documents & Text
      'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf', 'application/rtf',

      // Spreadsheets & Data
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/tab-separated-values',

      // Code files
      'text/x-c', 'text/x-c++src', 'text/x-java-source', 'text/x-python', 'application/x-php',
      'text/html', 'text/javascript', 'application/json', 'text/xml', 'text/css',

      // Images
      'image/jpeg', 'image/png', 'image/bmp', 'image/gif', 'image/svg+xml', 'image/tiff', 'image/webp',

      // Video
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp',
      'video/x-flv', 'video/x-ms-wmv', 'video/ogg',

      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/opus', 'audio/flac', 'audio/aac'
    ];

    if (file.size > maxSize) {
      throw new Error(`File size exceeds 100MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}. Please use supported formats for knowledge base files.`);
    }

    return true;
  }

  /**
   * Upload file to Google Drive with enhanced metadata and organized folder structure
   */
  async uploadFile(file, fileName, description = '', tags = []) {
    try {
      console.log('aiFiverr Drive: Uploading file:', fileName);

      // Validate file
      this.validateKnowledgeBaseFile(file);

      // Ensure aiFiverr folder exists
      await this.ensureAiFiverrFolder();

      // Determine appropriate folder based on file type
      const folderPath = this.getFileTypeFolder(fileName, file.type);
      const targetFolderId = await this.getFolderIdForPath(folderPath);

      console.log(`aiFiverr Drive: Uploading '${fileName}' to organized folder: ${folderPath}`);

      // Enhanced metadata with knowledge base specific properties
      const metadata = {
        name: fileName,
        description: description || `aiFiverr Knowledge Base file uploaded on ${new Date().toISOString()}`,
        parents: [targetFolderId],
        properties: {
          'aiFiverr_type': 'knowledge_base',
          'aiFiverr_upload_date': new Date().toISOString(),
          'aiFiverr_file_size': file.size.toString(),
          'aiFiverr_mime_type': file.type,
          'aiFiverr_tags': tags.join(','),
          'aiFiverr_folder_path': folderPath
        }
      };

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      const token = await this.getAccessToken();

      const response = await fetch(`${this.uploadUrl}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('aiFiverr Drive: File uploaded successfully:', result.id);

      return {
        success: true,
        fileId: result.id,
        fileName: result.name,
        webViewLink: result.webViewLink,
        size: file.size,
        mimeType: file.type
      };

    } catch (error) {
      console.error('aiFiverr Drive: Upload failed:', error);
      throw error;
    }
  }

  /**
   * List files in aiFiverr folder
   */
  async listKnowledgeBaseFiles() {
    try {
      const folderId = await this.ensureAiFiverrFolder();

      const response = await this.makeRequest(`/files?q=parents in '${folderId}' and trashed=false&fields=files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,description)`);

      const files = response.files || [];
      
      console.log('aiFiverr Drive: Found', files.length, 'knowledge base files');

      return files.map(file => ({
        id: file.id,
        name: file.name,
        size: parseInt(file.size) || 0,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        description: file.description || ''
      }));

    } catch (error) {
      console.error('aiFiverr Drive: Failed to list files:', error);
      return [];
    }
  }

  /**
   * Get detailed file information
   */
  async getFileDetails(fileId) {
    try {
      const response = await this.makeRequest(`/files/${fileId}?fields=id,name,size,mimeType,createdTime,modifiedTime,webViewLink,description,properties`);

      // Add additional metadata
      return {
        ...response,
        tags: response.properties?.aiFiverr_tags ? response.properties.aiFiverr_tags.split(',') : [],
        geminiStatus: 'not_uploaded', // Default status
        geminiUri: null
      };

    } catch (error) {
      console.error('aiFiverr Drive: Get file details failed:', error);
      throw error;
    }
  }

  /**
   * Download file content
   */
  async downloadFile(fileId) {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      return await response.blob();

    } catch (error) {
      console.error('aiFiverr Drive: Download failed:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId) {
    try {
      await this.makeRequest(`/files/${fileId}`, {
        method: 'DELETE'
      });

      console.log('aiFiverr Drive: File deleted:', fileId);
      return { success: true };

    } catch (error) {
      console.error('aiFiverr Drive: Delete failed:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.makeRequest(`/files/${fileId}?fields=id,name,size,mimeType,createdTime,modifiedTime,webViewLink,description,parents`);
      
      return {
        id: response.id,
        name: response.name,
        size: parseInt(response.size) || 0,
        mimeType: response.mimeType,
        createdTime: response.createdTime,
        modifiedTime: response.modifiedTime,
        webViewLink: response.webViewLink,
        description: response.description || '',
        parents: response.parents || []
      };

    } catch (error) {
      console.error('aiFiverr Drive: Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(fileId, updates) {
    try {
      const response = await this.makeRequest(`/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      console.log('aiFiverr Drive: File metadata updated:', fileId);
      return response;

    } catch (error) {
      console.error('aiFiverr Drive: Failed to update metadata:', error);
      throw error;
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota() {
    try {
      const response = await this.makeRequest('/about?fields=storageQuota');
      
      const quota = response.storageQuota;
      
      return {
        limit: parseInt(quota.limit) || 0,
        usage: parseInt(quota.usage) || 0,
        usageInDrive: parseInt(quota.usageInDrive) || 0,
        usageInDriveTrash: parseInt(quota.usageInDriveTrash) || 0
      };

    } catch (error) {
      console.error('aiFiverr Drive: Failed to get storage quota:', error);
      return {
        limit: 0,
        usage: 0,
        usageInDrive: 0,
        usageInDriveTrash: 0,
        error: error.message
      };
    }
  }

  /**
   * Search files by name or content with enhanced filtering
   */
  async searchFiles(query, filters = {}) {
    try {
      const folderId = await this.ensureAiFiverrFolder();

      let searchQuery = `parents in '${folderId}' and trashed=false`;

      if (query) {
        searchQuery += ` and (name contains '${query}' or fullText contains '${query}')`;
      }

      // Add file type filter
      if (filters.mimeType) {
        searchQuery += ` and mimeType='${filters.mimeType}'`;
      }

      // Add date range filter
      if (filters.createdAfter) {
        searchQuery += ` and createdTime > '${filters.createdAfter}'`;
      }

      if (filters.createdBefore) {
        searchQuery += ` and createdTime < '${filters.createdBefore}'`;
      }

      const response = await this.makeRequest(`/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,description,properties)&orderBy=modifiedTime desc`);

      return response.files || [];

    } catch (error) {
      console.error('aiFiverr Drive: Search failed:', error);
      return [];
    }
  }

  /**
   * Batch upload multiple files
   */
  async batchUploadFiles(files, progressCallback = null) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        if (progressCallback) {
          progressCallback(i, files.length, files[i].name);
        }

        const result = await this.uploadFile(files[i], files[i].name);
        results.push(result);

      } catch (error) {
        console.error(`aiFiverr Drive: Failed to upload ${files[i].name}:`, error);
        errors.push({ file: files[i].name, error: error.message });
      }
    }

    if (progressCallback) {
      progressCallback(files.length, files.length, 'Complete');
    }

    return { results, errors };
  }

  /**
   * Batch delete multiple files
   */
  async batchDeleteFiles(fileIds, progressCallback = null) {
    const results = [];
    const errors = [];

    for (let i = 0; i < fileIds.length; i++) {
      try {
        if (progressCallback) {
          progressCallback(i, fileIds.length, fileIds[i]);
        }

        await this.deleteFile(fileIds[i]);
        results.push(fileIds[i]);

      } catch (error) {
        console.error(`aiFiverr Drive: Failed to delete ${fileIds[i]}:`, error);
        errors.push({ fileId: fileIds[i], error: error.message });
      }
    }

    if (progressCallback) {
      progressCallback(fileIds.length, fileIds.length, 'Complete');
    }

    return { results, errors };
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(fileId, metadata) {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Update metadata failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('aiFiverr Drive: File metadata updated:', fileId);
      return result;

    } catch (error) {
      console.error('aiFiverr Drive: Update metadata failed:', error);
      throw error;
    }
  }

  /**
   * Get file statistics for knowledge base
   */
  async getKnowledgeBaseStats() {
    try {
      const files = await this.listKnowledgeBaseFiles();

      const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
        fileTypes: {},
        recentFiles: files.slice(0, 5)
      };

      // Count file types
      files.forEach(file => {
        const type = file.mimeType || 'unknown';
        stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('aiFiverr Drive: Failed to get stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        recentFiles: []
      };
    }
  }

  /**
   * Test connection to Google Drive
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('/about?fields=user,storageQuota');
      
      return {
        success: true,
        user: response.user,
        storageQuota: response.storageQuota
      };

    } catch (error) {
      console.error('aiFiverr Drive: Connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save data to Google Drive as JSON file with organized folder structure
   */
  async saveDataFile(fileName, data, description = '') {
    try {
      console.log('aiFiverr Drive: Saving data file:', fileName);

      // Ensure aiFiverr folder exists
      await this.ensureAiFiverrFolder();

      // Determine folder based on file type
      let folderPath;
      if (fileName.includes('conversation') || fileName.includes('chat')) {
        folderPath = 'chat';
      } else if (fileName.includes('custom-prompts') || fileName.includes('prompts')) {
        folderPath = 'prompts';
      } else if (fileName.includes('variables') || fileName.includes('knowledge-base-variables')) {
        folderPath = 'variables';
      } else {
        folderPath = 'knowledge-base/documents';
      }

      const targetFolderId = await this.getFolderIdForPath(folderPath);

      console.log(`aiFiverr Drive: Saving data file '${fileName}' to organized folder: ${folderPath}`);

      // Convert data to JSON
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Check if file already exists in the target folder
      const existingFiles = await this.makeRequest(`/files?q=name='${fileName}' and parents in '${targetFolderId}' and trashed=false`);

      let fileId = null;
      if (existingFiles.files && existingFiles.files.length > 0) {
        fileId = existingFiles.files[0].id;
      }

      const metadata = {
        name: fileName,
        description: description || `aiFiverr data file updated on ${new Date().toISOString()}`,
        parents: [targetFolderId],
        properties: {
          'aiFiverr_type': 'data',
          'aiFiverr_data_type': fileName.replace('.json', ''),
          'aiFiverr_upload_date': new Date().toISOString(),
          'aiFiverr_folder_path': folderPath
        }
      };

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob);

      let url, method;
      if (fileId) {
        // Update existing file
        url = `${this.uploadUrl}/files/${fileId}?uploadType=multipart`;
        method = 'PATCH';
      } else {
        // Create new file
        url = `${this.uploadUrl}/files?uploadType=multipart`;
        method = 'POST';
      }

      const token = await this.getAccessToken();
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to save data file: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('aiFiverr Drive: Data file saved successfully:', result.id);
      return { success: true, data: result };

    } catch (error) {
      console.error('aiFiverr Drive: Failed to save data file:', error);
      throw error;
    }
  }

  /**
   * Load data from Google Drive JSON file with organized folder structure support
   */
  async loadDataFile(fileName) {
    try {
      console.log('aiFiverr Drive: Loading data file:', fileName);

      // Ensure aiFiverr folder exists
      await this.ensureAiFiverrFolder();

      // Determine likely folder based on file type
      let folderPath;
      if (fileName.includes('conversation') || fileName.includes('chat')) {
        folderPath = 'chat';
      } else if (fileName.includes('custom-prompts') || fileName.includes('prompts')) {
        folderPath = 'prompts';
      } else if (fileName.includes('variables') || fileName.includes('knowledge-base-variables')) {
        folderPath = 'variables';
      } else {
        folderPath = 'knowledge-base/documents';
      }

      const targetFolderId = await this.getFolderIdForPath(folderPath);

      // Search for the file in the organized folder first
      let searchResponse = await this.makeRequest(`/files?q=name='${fileName}' and parents in '${targetFolderId}' and trashed=false`);

      // If not found in organized folder, search in root aiFiverr folder (for backward compatibility)
      if (!searchResponse.files || searchResponse.files.length === 0) {
        searchResponse = await this.makeRequest(`/files?q=name='${fileName}' and parents in '${this.aiFiverrFolderId}' and trashed=false`);
      }

      if (!searchResponse.files || searchResponse.files.length === 0) {
        return { success: false, error: 'File not found' };
      }

      const fileId = searchResponse.files[0].id;

      // Download file content
      const token = await this.getAccessToken();
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} - ${response.statusText}`);
      }

      const jsonText = await response.text();
      const data = JSON.parse(jsonText);

      console.log('aiFiverr Drive: Data file loaded successfully');
      return { success: true, data: data };

    } catch (error) {
      console.error('aiFiverr Drive: Failed to load data file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save custom prompts to Google Drive
   */
  async saveCustomPrompts(customPrompts) {
    try {
      console.log('aiFiverr Drive: Saving custom prompts to Google Drive');

      const fileName = 'custom-prompts.json';
      const description = 'aiFiverr custom prompts backup';

      const result = await this.saveDataFile(fileName, customPrompts, description);

      if (result.success) {
        console.log('aiFiverr Drive: Custom prompts saved successfully');
        return { success: true, fileId: result.fileId };
      } else {
        throw new Error(result.error || 'Failed to save custom prompts');
      }
    } catch (error) {
      console.error('aiFiverr Drive: Failed to save custom prompts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load custom prompts from Google Drive
   */
  async loadCustomPrompts() {
    try {
      console.log('aiFiverr Drive: Loading custom prompts from Google Drive');

      const fileName = 'custom-prompts.json';
      const result = await this.loadDataFile(fileName);

      if (result.success) {
        console.log('aiFiverr Drive: Custom prompts loaded successfully');
        return { success: true, data: result.data };
      } else if (result.error === 'File not found') {
        console.log('aiFiverr Drive: No custom prompts backup found');
        return { success: true, data: {} }; // Return empty object if no backup exists
      } else {
        throw new Error(result.error || 'Failed to load custom prompts');
      }
    } catch (error) {
      console.error('aiFiverr Drive: Failed to load custom prompts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save knowledge base variables to Google Drive
   */
  async saveKnowledgeBaseVariables(variables) {
    try {
      console.log('aiFiverr Drive: Saving knowledge base variables to Google Drive');

      const fileName = 'knowledge-base-variables.json';
      const description = 'aiFiverr knowledge base variables backup';

      const result = await this.saveDataFile(fileName, variables, description);

      if (result.success) {
        console.log('aiFiverr Drive: Knowledge base variables saved successfully');
        return { success: true, fileId: result.fileId };
      } else {
        throw new Error(result.error || 'Failed to save knowledge base variables');
      }
    } catch (error) {
      console.error('aiFiverr Drive: Failed to save knowledge base variables:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load knowledge base variables from Google Drive
   */
  async loadKnowledgeBaseVariables() {
    try {
      console.log('aiFiverr Drive: Loading knowledge base variables from Google Drive');

      const fileName = 'knowledge-base-variables.json';
      const result = await this.loadDataFile(fileName);

      if (result.success) {
        console.log('aiFiverr Drive: Knowledge base variables loaded successfully');
        return { success: true, data: result.data };
      } else if (result.error === 'File not found') {
        console.log('aiFiverr Drive: No knowledge base variables backup found');
        return { success: true, data: {} }; // Return empty object if no backup exists
      } else {
        throw new Error(result.error || 'Failed to load knowledge base variables');
      }
    } catch (error) {
      console.error('aiFiverr Drive: Failed to load knowledge base variables:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.googleDriveClient = new GoogleDriveClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleDriveClient;
}
