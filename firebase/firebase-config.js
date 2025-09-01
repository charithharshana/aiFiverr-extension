/**
 * Firebase Configuration for aiFiverr Extension
 * Cross-browser compatible Firebase setup
 */

// Firebase configuration - This is YOUR project configuration as the developer
// Firebase client-side API keys are meant to be public and visible in client code
// Security is handled by Firebase Authentication rules, not by hiding the API key
const firebaseConfig = {
  apiKey: "AIzaSyCelf-I9gafjAtydLL3_5n6z-hhdoeQn5A",
  authDomain: "ai-fiverr.firebaseapp.com",
  projectId: "ai-fiverr",
  storageBucket: "ai-fiverr.firebasestorage.app",
  messagingSenderId: "423530712122",
  appId: "1:423530712122:web:b3e7f12ee346031371b903",
  measurementId: "G-NN00R02JB9"
};

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = firebaseConfig;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.firebaseConfig = firebaseConfig;
} else {
  // Extension environment
  self.firebaseConfig = firebaseConfig;
}
