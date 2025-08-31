/**
 * Firebase Firestore Usage Examples for aiFiverr Extension
 * Demonstrates how to use the Firebase integration for user data storage
 */

// Example 1: Initialize and authenticate user
async function exampleAuthenticateAndStoreUser() {
  try {
    console.log('=== Example 1: User Authentication and Storage ===');
    
    // Simulate user authentication (this would come from Firebase Auth)
    const userData = {
      email: 'user@example.com',
      name: 'John Doe',
      picture: 'https://example.com/avatar.jpg',
      id: 'user123',
      given_name: 'John',
      family_name: 'Doe',
      locale: 'en-US',
      timestamp: new Date().toISOString()
    };

    // Store user data via background script
    const response = await chrome.runtime.sendMessage({
      type: 'FIREBASE_STORE_USER_DATA',
      userData: userData
    });

    if (response.success) {
      console.log('✅ User data stored successfully');
      return userData;
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('❌ Authentication example failed:', error);
    throw error;
  }
}

// Example 2: Update user preferences
async function exampleUpdateUserPreferences() {
  try {
    console.log('=== Example 2: Update User Preferences ===');
    
    // Initialize user data service
    if (!window.userDataService) {
      console.error('User data service not available');
      return;
    }

    await window.userDataService.init();
    
    const userEmail = 'user@example.com';
    
    // Update specific preferences
    const newPreferences = {
      theme: 'dark',
      language: 'es-ES',
      bio: 'Professional freelancer specializing in web development',
      notifications: false,
      selectedModel: 'gemini-2.5-pro'
    };

    const result = await window.userDataService.updatePreferences(userEmail, newPreferences);
    
    if (result.success) {
      console.log('✅ Preferences updated:', result.preferences);
      return result.preferences;
    } else {
      throw new Error('Failed to update preferences');
    }

  } catch (error) {
    console.error('❌ Update preferences example failed:', error);
    throw error;
  }
}

// Example 3: Get user profile and preferences
async function exampleGetUserProfile() {
  try {
    console.log('=== Example 3: Get User Profile ===');
    
    if (!window.userDataService) {
      console.error('User data service not available');
      return;
    }

    await window.userDataService.init();
    
    const userEmail = 'user@example.com';
    
    // Get complete user profile
    const userProfile = await window.userDataService.getUserProfile(userEmail);
    
    if (userProfile) {
      console.log('✅ User profile retrieved:', {
        email: userProfile.email,
        name: userProfile.name,
        created: userProfile.created,
        lastLogin: userProfile.lastLogin,
        preferences: userProfile.preferences
      });
      
      // Get just preferences
      const preferences = await window.userDataService.getPreferences(userEmail);
      console.log('✅ User preferences:', preferences);
      
      return { profile: userProfile, preferences };
    } else {
      console.log('❌ User not found');
      return null;
    }

  } catch (error) {
    console.error('❌ Get user profile example failed:', error);
    throw error;
  }
}

// Example 4: Update specific user attributes
async function exampleUpdateUserAttributes() {
  try {
    console.log('=== Example 4: Update Specific User Attributes ===');
    
    if (!window.userDataService) {
      console.error('User data service not available');
      return;
    }

    await window.userDataService.init();
    
    const userEmail = 'user@example.com';
    
    // Update bio
    await window.userDataService.updateBio(userEmail, 
      'Experienced full-stack developer with expertise in React, Node.js, and Firebase. Available for freelance projects.');
    
    // Update language preference
    await window.userDataService.updateLanguage(userEmail, 'fr-FR');
    
    // Update individual preference
    await window.userDataService.updatePreference(userEmail, 'maxContextLength', 2097152);
    
    console.log('✅ User attributes updated successfully');
    
    // Verify updates
    const updatedPreferences = await window.userDataService.getPreferences(userEmail);
    console.log('✅ Updated preferences:', {
      bio: updatedPreferences.bio,
      language: updatedPreferences.language,
      maxContextLength: updatedPreferences.maxContextLength
    });

  } catch (error) {
    console.error('❌ Update user attributes example failed:', error);
    throw error;
  }
}

// Example 5: Sync local settings with Firebase
async function exampleSyncSettings() {
  try {
    console.log('=== Example 5: Sync Local Settings with Firebase ===');
    
    if (!window.userDataService) {
      console.error('User data service not available');
      return;
    }

    await window.userDataService.init();
    
    const userEmail = 'user@example.com';
    
    // Sync settings between local storage and Firebase
    const syncedSettings = await window.userDataService.syncLocalSettings(userEmail);
    
    console.log('✅ Settings synced successfully:', syncedSettings);
    
    return syncedSettings;

  } catch (error) {
    console.error('❌ Sync settings example failed:', error);
    throw error;
  }
}

// Example 6: Test Firebase connection
async function exampleTestConnection() {
  try {
    console.log('=== Example 6: Test Firebase Connection ===');
    
    if (!window.userDataService) {
      console.error('User data service not available');
      return;
    }

    const connectionTest = await window.userDataService.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Firebase connection successful');
    } else {
      console.log('❌ Firebase connection failed:', connectionTest.error);
    }
    
    return connectionTest;

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    throw error;
  }
}

// Example 7: Complete workflow demonstration
async function exampleCompleteWorkflow() {
  try {
    console.log('=== Example 7: Complete Workflow ===');
    
    // Step 1: Authenticate and store user
    const userData = await exampleAuthenticateAndStoreUser();
    
    // Step 2: Update preferences
    await exampleUpdateUserPreferences();
    
    // Step 3: Get user profile
    const profileData = await exampleGetUserProfile();
    
    // Step 4: Update specific attributes
    await exampleUpdateUserAttributes();
    
    // Step 5: Sync settings
    await exampleSyncSettings();
    
    // Step 6: Test connection
    await exampleTestConnection();
    
    console.log('✅ Complete workflow executed successfully');
    
    return {
      userData,
      profileData,
      message: 'All Firebase operations completed successfully'
    };

  } catch (error) {
    console.error('❌ Complete workflow failed:', error);
    throw error;
  }
}

// Utility function to run all examples
async function runAllExamples() {
  console.log('🚀 Running all Firebase Firestore examples...');
  
  try {
    await exampleCompleteWorkflow();
    console.log('🎉 All examples completed successfully!');
  } catch (error) {
    console.error('💥 Examples failed:', error);
  }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
  window.firestoreExamples = {
    authenticateAndStoreUser: exampleAuthenticateAndStoreUser,
    updateUserPreferences: exampleUpdateUserPreferences,
    getUserProfile: exampleGetUserProfile,
    updateUserAttributes: exampleUpdateUserAttributes,
    syncSettings: exampleSyncSettings,
    testConnection: exampleTestConnection,
    completeWorkflow: exampleCompleteWorkflow,
    runAll: runAllExamples
  };
}

console.log('📚 Firebase Firestore examples loaded. Use window.firestoreExamples to access functions.');
