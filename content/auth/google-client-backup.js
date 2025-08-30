/**
 * Google API Client for aiFiverr Extension
 * Handles user data collection and authorization checking with Google Sheets
 */

class GoogleClient {
  constructor() {
    // Configuration from your Google Apps Script
    this.SPREADSHEET_ID = "15qpoZbgOQnKQr52X-oXF6_euBGHflKuxHaW6xAmROAY";
    this.USERS_SHEET_NAME = "Users";
    this.USER_EMAILS_RANGE = "B2:B"; // Email column range
    this.USER_DATA_RANGE = "A2:I"; // Full user data range (A=Name, B=Email, C=Picture, D=Timestamp, E=Status, F=Google ID, G=Given Name, H=Family Name, I=Locale)
    this.baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      this.initialized = true;
      console.log('aiFiverr Google Client: Client initialized');
    } catch (error) {
      console.error('aiFiverr Google Client: Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * Get access token from auth service
   */
  async getAccessToken() {
    if (!window.googleAuthService) {
      throw new Error('Google Auth Service not available');
    }

    await window.googleAuthService.refreshTokenIfNeeded();
    return window.googleAuthService.getAccessToken();
  }

  /**
   * Make authenticated request to Google Sheets API
   */
  async makeRequest(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    if (!token) {
      throw new Error('No access token available');
    }

    const url = `${this.baseUrl}/${this.SPREADSHEET_ID}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Sheets API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if user is authorized (email exists in the Users sheet)
   */
  async checkUserAuthorization(userEmail) {
    try {
      console.log('aiFiverr Google Client: Checking authorization for:', userEmail);

      // Get all emails from the Users sheet
      const response = await this.makeRequest(`/values/${this.USERS_SHEET_NAME}!${this.USER_EMAILS_RANGE}`);
      
      const emails = response.values ? response.values.flat().filter(email => email && email.trim()) : [];
      
      const isAuthorized = emails.includes(userEmail);
      
      console.log('aiFiverr Google Client: Authorization check result:', {
        email: userEmail,
        authorized: isAuthorized,
        totalEmails: emails.length
      });

      return isAuthorized;

    } catch (error) {
      console.error('aiFiverr Google Client: Authorization check failed:', error);
      // Return false on error to be safe
      return false;
    }
  }

  /**
   * Add or update user data in the Users sheet
   */
  async addUserData(userData) {
    try {
      console.log('aiFiverr Google Client: Adding user data:', userData.email);

      // First check if user already exists
      const existingData = await this.getUserData(userData.email);
      
      if (existingData) {
        // Update existing user
        return await this.updateUserData(userData, existingData.rowIndex);
      } else {
        // Add new user
        return await this.appendUserData(userData);
      }

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to add user data:', error);
      throw error;
    }
  }

  /**
   * Get user data from the sheet
   */
  async getUserData(userEmail) {
    try {
      const response = await this.makeRequest(`/values/${this.USERS_SHEET_NAME}!${this.USER_DATA_RANGE}`);
      
      if (!response.values) {
        return null;
      }

      // Find user by email (column B, index 1)
      for (let i = 0; i < response.values.length; i++) {
        const row = response.values[i];
        if (row[1] === userEmail) { // Email is in column B (index 1)
          return {
            rowIndex: i + 2, // +2 because range starts at row 2
            name: row[0] || '',
            email: row[1] || '',
            picture: row[2] || '',
            timestamp: row[3] || '',
            status: row[4] || 'active',
            id: row[5] || '',
            given_name: row[6] || '',
            family_name: row[7] || '',
            locale: row[8] || 'en-US'
          };
        }
      }

      return null;

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to get user data:', error);
      return null;
    }
  }

  /**
   * Append new user data to the sheet
   */
  async appendUserData(userData) {
    try {
      const values = [[
        userData.name || '',                    // A: Name (Full Name)
        userData.email || '',                   // B: Email
        userData.picture || '',                 // C: Picture URL
        userData.timestamp || new Date().toISOString(), // D: Timestamp
        'active',                               // E: Status
        userData.id || '',                      // F: Google User ID
        userData.given_name || '',              // G: Given Name (First Name)
        userData.family_name || '',             // H: Family Name (Last Name)
        userData.locale || 'en-US'              // I: Locale
      ]];

      const response = await this.makeRequest(`/values/${this.USERS_SHEET_NAME}!A:I:append?valueInputOption=RAW`, {
        method: 'POST',
        body: JSON.stringify({
          values: values
        })
      });

      console.log('aiFiverr Google Client: User data appended successfully with all fields');
      return response;

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to append user data:', error);
      throw error;
    }
  }

  /**
   * Update existing user data
   */
  async updateUserData(userData, rowIndex) {
    try {
      const range = `${this.USERS_SHEET_NAME}!A${rowIndex}:I${rowIndex}`;

      const values = [[
        userData.name || '',                    // A: Name (Full Name)
        userData.email || '',                   // B: Email
        userData.picture || '',                 // C: Picture URL
        userData.timestamp || new Date().toISOString(), // D: Timestamp
        'active',                               // E: Status
        userData.id || '',                      // F: Google User ID
        userData.given_name || '',              // G: Given Name (First Name)
        userData.family_name || '',             // H: Family Name (Last Name)
        userData.locale || 'en-US'              // I: Locale
      ]];

      const response = await this.makeRequest(`/values/${range}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          values: values
        })
      });

      console.log('aiFiverr Google Client: User data updated successfully with all fields');
      return response;

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to update user data:', error);
      throw error;
    }
  }

  /**
   * Get all users from the sheet
   */
  async getAllUsers() {
    try {
      const response = await this.makeRequest(`/values/${this.USERS_SHEET_NAME}!${this.USER_DATA_RANGE}`);
      
      if (!response.values) {
        return [];
      }

      return response.values.map((row, index) => ({
        rowIndex: index + 2,
        name: row[0] || '',
        email: row[1] || '',
        picture: row[2] || '',
        timestamp: row[3] || '',
        status: row[4] || 'active',
        id: row[5] || '',
        given_name: row[6] || '',
        family_name: row[7] || '',
        locale: row[8] || 'en-US'
      }));

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to get all users:', error);
      return [];
    }
  }

  /**
   * Remove user from the sheet
   */
  async removeUser(userEmail) {
    try {
      const userData = await this.getUserData(userEmail);
      
      if (!userData) {
        throw new Error('User not found');
      }

      // Mark as inactive instead of deleting
      await this.updateUserData({
        ...userData,
        status: 'inactive',
        timestamp: new Date().toISOString()
      }, userData.rowIndex);

      console.log('aiFiverr Google Client: User marked as inactive');
      return true;

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to remove user:', error);
      throw error;
    }
  }

  /**
   * Get sheet statistics
   */
  async getStats() {
    try {
      const users = await this.getAllUsers();
      const activeUsers = users.filter(user => user.status === 'active');
      
      return {
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        inactiveUsers: users.length - activeUsers.length,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('aiFiverr Google Client: Failed to get stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Test connection to the spreadsheet
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('');
      return {
        success: true,
        spreadsheetId: response.spreadsheetId,
        title: response.properties?.title,
        sheets: response.sheets?.map(sheet => sheet.properties?.title)
      };

    } catch (error) {
      console.error('aiFiverr Google Client: Connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create global instance
window.googleClient = new GoogleClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleClient;
}
