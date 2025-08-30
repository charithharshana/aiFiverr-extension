/**
 * Minimal aiFiverr Popup Script - Tab Fix Version
 * This is a simplified version focused on fixing tab functionality
 */

console.log('aiFiverr: Loading minimal popup script for tab fix');

// Simple tab switching function
function switchToTab(tabName) {
  console.log('aiFiverr: Switching to tab:', tabName);
  
  try {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });
    
    // Update tab panels
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === tabName) {
        panel.classList.add('active');
      }
    });
    
    console.log('aiFiverr: Successfully switched to tab:', tabName);
    return true;
  } catch (error) {
    console.error('aiFiverr: Error switching tabs:', error);
    return false;
  }
}

// Initialize tab functionality
function initializeTabs() {
  console.log('aiFiverr: Initializing tabs...');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  console.log('aiFiverr: Found', tabButtons.length, 'tab buttons');
  
  if (tabButtons.length === 0) {
    console.error('aiFiverr: No tab buttons found!');
    return false;
  }
  
  // Add click event to each tab button
  tabButtons.forEach((btn, index) => {
    const tabName = btn.dataset.tab;
    console.log(`aiFiverr: Setting up tab ${index + 1}: ${tabName}`);
    
    // Remove any existing listeners
    btn.onclick = null;
    
    // Add new click listener
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('aiFiverr: Tab clicked:', tabName);
      switchToTab(tabName);
    });
    
    // Also add onclick as backup
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('aiFiverr: Tab onclick:', tabName);
      switchToTab(tabName);
    };
  });
  
  console.log('aiFiverr: Tabs initialized successfully');
  return true;
}

// Test tab functionality
function testTabs() {
  console.log('=== aiFiverr: Testing Tab Functionality ===');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  console.log('Tab buttons found:', tabButtons.length);
  console.log('Tab panels found:', tabPanels.length);
  
  // Test each tab
  tabButtons.forEach((btn, index) => {
    const tabName = btn.dataset.tab;
    console.log(`Testing tab ${index + 1}: ${tabName}`);
    
    // Simulate click
    switchToTab(tabName);
    
    // Check if it worked
    const isButtonActive = btn.classList.contains('active');
    const panel = document.getElementById(tabName);
    const isPanelActive = panel ? panel.classList.contains('active') : false;
    
    console.log(`  Button active: ${isButtonActive}, Panel active: ${isPanelActive}`);
  });
  
  console.log('=== Tab Test Complete ===');
}

// Force fix function for manual use
window.forceFixTabs = function() {
  console.log('aiFiverr: Force fixing tabs...');
  initializeTabs();
  testTabs();
};

// Debug function
window.debugTabs = function() {
  console.log('=== aiFiverr: Tab Debug Info ===');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  console.log('Tab buttons:', tabButtons.length);
  console.log('Tab panels:', tabPanels.length);
  
  tabButtons.forEach((btn, index) => {
    console.log(`Tab Button ${index + 1}:`, {
      text: btn.textContent.trim(),
      dataTab: btn.dataset.tab,
      isActive: btn.classList.contains('active'),
      hasEventListener: !!btn.onclick
    });
  });
  
  tabPanels.forEach((panel, index) => {
    console.log(`Tab Panel ${index + 1}:`, {
      id: panel.id,
      isActive: panel.classList.contains('active')
    });
  });
  
  console.log('=== End Debug Info ===');
};

// Initialize when DOM is ready
function initialize() {
  console.log('aiFiverr: Starting initialization...');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
    return;
  }
  
  // Wait a bit for DOM to be fully ready
  setTimeout(() => {
    console.log('aiFiverr: DOM ready, initializing tabs...');
    
    if (initializeTabs()) {
      console.log('aiFiverr: Initialization successful!');
      
      // Test tabs after initialization
      setTimeout(() => {
        testTabs();
      }, 500);
    } else {
      console.error('aiFiverr: Initialization failed!');
    }
  }, 100);
}

// Make functions globally available
window.switchToTab = switchToTab;
window.testTabs = testTabs;

// Start initialization
initialize();

console.log('aiFiverr: Minimal popup script loaded');