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
    this.initialized = false;
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
        return this.aiFiverrFolderId;
      }

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
      return this.aiFiverrFolderId;

    } catch (error) {
      console.error('aiFiverr Drive: Failed to ensure folder:', error);
      throw error;
    }
  }

  /**
   * Ensure chat folder exists for Fiverr conversations
   */
  async ensureChatFolder() {
    try {
      // First ensure main aiFiverr folder
      const mainFolderId = await this.ensureAiFiverrFolder();

      // Search for existing chat folder
      const searchResponse = await this.makeRequest(`/files?q=name='chat' and parents in '${mainFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);

      if (searchResponse.files && searchResponse.files.length > 0) {
        console.log('aiFiverr Drive: Found existing chat folder:', searchResponse.files[0].id);
        return searchResponse.files[0].id;
      }

      // Create chat folder
      const createResponse = await this.makeRequest('/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'chat',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mainFolderId],
          description: 'aiFiverr Extension - Fiverr Conversations'
        })
      });

      console.log('aiFiverr Drive: Created chat folder:', createResponse.id);
      return createResponse.id;

    } catch (error) {
      console.error('aiFiverr Drive: Failed to ensure chat folder:', error);
      throw error;
    }
  }

  /**
   * Get subfolder ID if it exists (helper method)
   */
  async getSubfolderId(folderPath, mainFolderId) {
    try {
      const pathParts = folderPath.split('/');
      let currentParentId = mainFolderId;

      for (const folderName of pathParts) {
        const searchResponse = await this.makeRequest(`/files?q=name='${folderName}' and parents in '${currentParentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);

        if (searchResponse.files && searchResponse.files.length > 0) {
          currentParentId = searchResponse.files[0].id;
        } else {
          return null; // Folder doesn't exist
        }
      }

      return currentParentId;
    } catch (error) {
      console.warn('aiFiverr Drive: Failed to get subfolder ID for', folderPath, ':', error);
      return null;
    }
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
   * Upload file to Google Drive with enhanced metadata
   */
  async uploadFile(file, fileName, description = '', tags = []) {
    try {
      console.log('aiFiverr Drive: Uploading file:', fileName);

      // Validate file
      this.validateKnowledgeBaseFile(file);

      // Ensure aiFiverr folder exists
      const folderId = await this.ensureAiFiverrFolder();

      // Enhanced metadata with knowledge base specific properties
      const metadata = {
        name: fileName,
        description: description || `aiFiverr Knowledge Base file uploaded on ${new Date().toISOString()}`,
        parents: [folderId],
        properties: {
          'aiFiverr_type': 'knowledge_base',
          'aiFiverr_upload_date': new Date().toISOString(),
          'aiFiverr_file_size': file.size.toString(),
          'aiFiverr_mime_type': file.type,
          'aiFiverr_tags': tags.join(',')
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
   * List files in organized aiFiverr folder structure
   */
  async listKnowledgeBaseFiles() {
    try {
      // Get main folder and organized subfolders
      const mainFolderId = await this.ensureAiFiverrFolder();
      const knowledgeBaseFolders = [mainFolderId];

      // Try to get organized subfolders (they may not exist yet)
      try {
        const textFolderId = await this.getSubfolderId('knowledge-base/text', mainFolderId);
        const videoFolderId = await this.getSubfolderId('knowledge-base/video', mainFolderId);
        const audioFolderId = await this.getSubfolderId('knowledge-base/audio', mainFolderId);
        const documentsFolderId = await this.getSubfolderId('knowledge-base/documents', mainFolderId);

        if (textFolderId) knowledgeBaseFolders.push(textFolderId);
        if (videoFolderId) knowledgeBaseFolders.push(videoFolderId);
        if (audioFolderId) knowledgeBaseFolders.push(audioFolderId);
        if (documentsFolderId) knowledgeBaseFolders.push(documentsFolderId);
      } catch (error) {
        console.log('aiFiverr Drive: Organized folders not found, using main folder only');
      }

      // Build search query for all folders
      const folderQuery = knowledgeBaseFolders.map(id => `parents in '${id}'`).join(' or ');
      const response = await this.makeRequest(`/files?q=(${folderQuery}) and trashed=false&fields=files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,description)`);

      const files = response.files || [];

      console.log('aiFiverr Drive: Found', files.length, 'knowledge base files across', knowledgeBaseFolders.length, 'folders');

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

      // Determine target folder based on data type
      let targetFolderId;
      if (data.type === 'fiverr-conversation' || fileName.includes('fiverr-conversation')) {
        // Use chat folder for Fiverr conversations
        targetFolderId = await this.ensureChatFolder();
        console.log('aiFiverr Drive: Saving conversation to chat folder:', targetFolderId);
      } else {
        // Use main aiFiverr folder for other data files
        targetFolderId = await this.ensureAiFiverrFolder();
      }

      // Convert data to JSON
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Check if file already exists in target folder
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
          'aiFiverr_type': data.type === 'fiverr-conversation' ? 'conversation' : 'data',
          'aiFiverr_data_type': fileName.replace('.json', ''),
          'aiFiverr_upload_date': new Date().toISOString()
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
   * Load data from Google Drive JSON file
   */
  async loadDataFile(fileName) {
    try {
      console.log('aiFiverr Drive: Loading data file:', fileName);

      // Ensure aiFiverr folder exists
      const folderId = await this.ensureAiFiverrFolder();

      // Search for the file
      const searchResponse = await this.makeRequest(`/files?q=name='${fileName}' and parents in '${folderId}' and trashed=false`);

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
}

// Create global instance
window.googleDriveClient = new GoogleDriveClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleDriveClient;
}
