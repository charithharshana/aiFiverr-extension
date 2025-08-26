/**
 * Gemini Files API Client
 * Handles file uploads, management, and operations with Google's Gemini Files API
 * Supports all Gemini-compatible file types for knowledge base integration
 */

class GeminiFilesClient {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.uploadUrl = 'https://generativelanguage.googleapis.com/upload/v1beta';
    this.initialized = false;
    this.supportedMimeTypes = new Set([
      // Text and Document Files
      'text/plain', // TXT
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/pdf', // PDF
      'application/rtf', // RTF
      'application/msword-template', // DOT
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template', // DOTX
      'application/x-hwp', // HWP
      'application/x-hwpx', // HWPX
      'application/vnd.google-apps.document', // Google Docs

      // Code Files
      'text/x-c', // C
      'text/x-c++src', // CPP
      'text/x-python', // PY
      'text/x-java-source', // JAVA
      'application/x-php', // PHP
      'text/x-php', // PHP alternative
      'application/sql', // SQL
      'text/x-sql', // SQL alternative
      'text/html', // HTML
      'text/javascript', // JS
      'application/json', // JSON
      'text/xml', // XML
      'text/css', // CSS
      'text/x-shellscript', // Shell scripts
      'text/x-python-script', // Python scripts

      // Data and Spreadsheet Files
      'text/csv', // CSV
      'text/tab-separated-values', // TSV
      'application/vnd.ms-excel', // XLS
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.google-apps.spreadsheet', // Google Sheets

      // Media Files - Images
      'image/png', // PNG
      'image/jpeg', // JPEG
      'image/bmp', // BMP
      'image/webp', // WEBP
      'image/gif', // GIF (additional)
      'image/svg+xml', // SVG (additional)
      'image/tiff', // TIFF (additional)

      // Media Files - Audio
      'audio/aac', // AAC
      'audio/flac', // FLAC
      'audio/mpeg', // MP3
      'audio/mp4', // M4A
      'audio/x-mpeg', // MPEG audio
      'audio/x-mpga', // MPGA
      'audio/mp4', // MP4 audio
      'audio/opus', // OPUS
      'audio/pcm', // PCM
      'audio/wav', // WAV
      'audio/webm', // WEBM audio
      'audio/ogg', // OGG (additional)

      // Media Files - Video
      'video/mp4', // MP4
      'video/mpeg', // MPEG
      'video/quicktime', // MOV
      'video/x-msvideo', // AVI
      'video/x-flv', // X-FLV
      'video/x-mpg', // MPG
      'video/webm', // WEBM
      'video/x-ms-wmv', // WMV
      'video/3gpp', // 3GPP
      'video/ogg' // OGG video (additional)
    ]);
    
    this.init();
  }

  async init() {
    try {
      this.initialized = true;
      console.log('aiFiverr Gemini Files: Client initialized');
    } catch (error) {
      console.error('aiFiverr Gemini Files: Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * Get API key for Gemini Files API
   */
  async getApiKey() {
    try {
      if (window.apiKeyManager && window.apiKeyManager.initialized) {
        const keyData = window.apiKeyManager.getKeyForSession('gemini-files');
        if (keyData) {
          return keyData.key;
        }
      }

      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response?.success && response?.data) {
        return response.data.key;
      }
      
      throw new Error('No API key available');
    } catch (error) {
      console.error('aiFiverr Gemini Files: Failed to get API key:', error);
      throw error;
    }
  }

  /**
   * Check if file type is supported by Gemini
   */
  isSupportedFileType(mimeType) {
    return this.supportedMimeTypes.has(mimeType);
  }

  /**
   * Get MIME type from file extension
   */
  getMimeTypeFromExtension(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypeMap = {
      // Text and Document Files
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'pdf': 'application/pdf',
      'rtf': 'application/rtf',
      'dot': 'application/msword-template',
      'dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'hwp': 'application/x-hwp',
      'hwpx': 'application/x-hwpx',

      // Code Files
      'c': 'text/x-c',
      'cpp': 'text/x-c++src',
      'py': 'text/x-python',
      'java': 'text/x-java-source',
      'php': 'application/x-php',
      'sql': 'application/sql',
      'html': 'text/html',
      'htm': 'text/html',
      'js': 'text/javascript',
      'json': 'application/json',
      'xml': 'text/xml',
      'css': 'text/css',
      'sh': 'text/x-shellscript',
      'bash': 'text/x-shellscript',

      // Data and Spreadsheet Files
      'csv': 'text/csv',
      'tsv': 'text/tab-separated-values',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Media Files - Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',

      // Media Files - Audio
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mpeg': 'audio/x-mpeg',
      'mpga': 'audio/x-mpga',
      'opus': 'audio/opus',
      'pcm': 'audio/pcm',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',

      // Media Files - Video
      'mp4': 'video/mp4',
      'mpeg': 'video/mpeg',
      'mpg': 'video/x-mpg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'wmv': 'video/x-ms-wmv',
      '3gp': 'video/3gpp',
      '3gpp': 'video/3gpp',
      'ogv': 'video/ogg'
    };
    
    return mimeTypeMap[ext] || 'text/plain';
  }

  /**
   * Upload file to Gemini Files API
   */
  async uploadFile(file, displayName = null) {
    try {
      console.log('aiFiverr Gemini Files: Uploading file:', file.name);

      const apiKey = await this.getApiKey();
      
      // Validate file type
      const mimeType = file.type || this.getMimeTypeFromExtension(file.name);
      if (!this.isSupportedFileType(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Check file size (2GB limit)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        throw new Error('File size exceeds 2GB limit');
      }

      // Prepare metadata
      const metadata = {
        file: {
          displayName: displayName || file.name
        }
      };

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      const response = await fetch(`${this.uploadUrl}/files?uploadType=multipart&key=${apiKey}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('aiFiverr Gemini Files: File uploaded successfully:', result.file.name);

      return {
        name: result.file.name,
        displayName: result.file.displayName,
        mimeType: result.file.mimeType,
        sizeBytes: result.file.sizeBytes,
        uri: result.file.uri,
        state: result.file.state,
        createTime: result.file.createTime
      };

    } catch (error) {
      console.error('aiFiverr Gemini Files: Upload failed:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from Gemini Files API
   */
  async getFile(fileName) {
    try {
      const apiKey = await this.getApiKey();
      
      const response = await fetch(`${this.baseUrl}/${fileName}?key=${apiKey}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Get file failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('aiFiverr Gemini Files: Get file failed:', error);
      throw error;
    }
  }

  /**
   * List all uploaded files
   */
  async listFiles(pageSize = 50, pageToken = null) {
    try {
      const apiKey = await this.getApiKey();
      
      let url = `${this.baseUrl}/files?key=${apiKey}&pageSize=${pageSize}`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const response = await fetch(url, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`List files failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      return {
        files: result.files || [],
        nextPageToken: result.nextPageToken
      };

    } catch (error) {
      console.error('aiFiverr Gemini Files: List files failed:', error);
      throw error;
    }
  }

  /**
   * Delete file from Gemini Files API
   */
  async deleteFile(fileName) {
    try {
      const apiKey = await this.getApiKey();
      
      const response = await fetch(`${this.baseUrl}/${fileName}?key=${apiKey}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Delete file failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      console.log('aiFiverr Gemini Files: File deleted successfully:', fileName);
      return true;

    } catch (error) {
      console.error('aiFiverr Gemini Files: Delete file failed:', error);
      throw error;
    }
  }

  /**
   * Wait for file to be processed (state becomes ACTIVE)
   */
  async waitForFileProcessing(fileName, maxWaitTime = 300000) { // 5 minutes max
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const fileData = await this.getFile(fileName);
        
        if (fileData.state === 'ACTIVE') {
          return fileData;
        } else if (fileData.state === 'FAILED') {
          throw new Error(`File processing failed: ${fileData.error?.message || 'Unknown error'}`);
        }
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error('aiFiverr Gemini Files: Error checking file status:', error);
        throw error;
      }
    }
    
    throw new Error('File processing timeout');
  }
}

// Initialize global instance
if (typeof window !== 'undefined') {
  window.geminiFilesClient = new GeminiFilesClient();
}
