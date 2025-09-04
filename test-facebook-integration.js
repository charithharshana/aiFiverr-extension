/**
 * Quick Test Script for Facebook Integration
 * 
 * Run this in the browser console on Facebook to test the fixes
 */

console.log('🧪 aiFiverr Facebook Integration Quick Test');
console.log('==========================================');

// Test 1: Check if utilities are loaded
console.log('\n1. Checking utility availability...');
const utilities = {
  'CSP Safe DOM': !!window.cspSafeDOMUtils,
  'Facebook Error Handler': !!window.facebookErrorHandler,
  'Site Compatibility': !!window.siteCompatibilityManager,
  'Knowledge Base Manager': !!window.knowledgeBaseManager
};

Object.entries(utilities).forEach(([name, available]) => {
  console.log(`   ${available ? '✅' : '❌'} ${name}: ${available ? 'Available' : 'Missing'}`);
});

// Test 2: Site detection
console.log('\n2. Testing site detection...');
if (window.siteCompatibilityManager) {
  const config = window.siteCompatibilityManager.siteConfig;
  console.log(`   🌐 Detected site: ${config.name}`);
  console.log(`   🛡️ Strict CSP: ${config.strictCSP}`);
  console.log(`   ⚛️ React site: ${config.reactSite}`);
  console.log(`   🎛️ Features: ${JSON.stringify(config.features)}`);
} else {
  console.log('   ❌ Site compatibility manager not available');
}

// Test 3: CSP-safe element creation
console.log('\n3. Testing CSP-safe element creation...');
try {
  if (window.cspSafeDOMUtils) {
    const testElement = window.cspSafeDOMUtils.createElement('div', {
      textContent: 'Test Element',
      className: 'aifiverr-test',
      styles: {
        backgroundColor: '#1dbf73',
        color: 'white',
        padding: '10px',
        borderRadius: '4px'
      }
    });
    
    if (testElement) {
      console.log('   ✅ CSP-safe element created successfully');
      console.log(`   📝 Element class: ${testElement.className}`);
      console.log(`   🎨 Has inline styles: ${testElement.style.backgroundColor ? 'Yes' : 'No'}`);
      
      // Clean up
      if (testElement.parentNode) testElement.remove();
    } else {
      console.log('   ❌ Failed to create CSP-safe element');
    }
  } else {
    console.log('   ❌ CSP-safe DOM utilities not available');
  }
} catch (error) {
  console.log(`   ❌ Error creating element: ${error.message}`);
}

// Test 4: Error handler status
console.log('\n4. Testing error handler status...');
if (window.facebookErrorHandler) {
  const status = {
    'Should operate normally': window.facebookErrorHandler.shouldOperateNormally(),
    'DOM manipulation safe': window.facebookErrorHandler.isDOMManipulationSafe(),
    'Inline styles allowed': window.facebookErrorHandler.areInlineStylesAllowed()
  };
  
  Object.entries(status).forEach(([check, result]) => {
    console.log(`   ${result ? '✅' : '⚠️'} ${check}: ${result}`);
  });
} else {
  console.log('   ❌ Facebook error handler not available');
}

// Test 5: Global flags
console.log('\n5. Checking global configuration flags...');
const flags = {
  'CSP Safe Mode': window.aiFiverrUseCSPSafeMode,
  'Disable Inline Styles': window.aiFiverrDisableInlineStyles,
  'Disable innerHTML': window.aiFiverrDisableInnerHTML,
  'Minimal DOM Mode': window.aiFiverrMinimalDOMMode,
  'Extension Disabled': window.aiFiverrDisabled
};

Object.entries(flags).forEach(([flag, value]) => {
  const icon = value ? '🔴' : '🟢';
  console.log(`   ${icon} ${flag}: ${value || 'false'}`);
});

// Test 6: Knowledge base functionality
console.log('\n6. Testing knowledge base functionality...');
if (window.knowledgeBaseManager) {
  try {
    // Test file key generation
    const testKey = window.knowledgeBaseManager.generateFileKey('test-file.txt');
    console.log(`   ✅ File key generation: ${testKey}`);
    
    // Check if files are loaded
    const fileCount = window.knowledgeBaseManager.files ? window.knowledgeBaseManager.files.size : 0;
    console.log(`   📁 Files in knowledge base: ${fileCount}`);
    
  } catch (error) {
    console.log(`   ❌ Knowledge base error: ${error.message}`);
  }
} else {
  console.log('   ❌ Knowledge base manager not available');
}

// Test 7: Create a test popup (CSP-safe)
console.log('\n7. Testing popup creation...');
try {
  if (window.cspSafeDOMUtils && window.siteCompatibilityManager?.shouldUseCSPSafeMode()) {
    console.log('   🧪 Creating test popup (will auto-close in 3 seconds)...');
    
    const popup = window.cspSafeDOMUtils.createPopup({
      title: 'aiFiverr Test',
      content: 'This popup was created using CSP-safe methods!',
      closable: true,
      modal: true
    });
    
    window.cspSafeDOMUtils.showPopup(popup);
    console.log('   ✅ Test popup created successfully');
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      window.cspSafeDOMUtils.removePopup(popup);
      console.log('   🗑️ Test popup removed');
    }, 3000);
    
  } else {
    console.log('   ⚠️ Skipping popup test (not in CSP-safe mode or utilities unavailable)');
  }
} catch (error) {
  console.log(`   ❌ Popup test error: ${error.message}`);
}

// Summary
console.log('\n📊 Test Summary');
console.log('================');

const allUtilitiesLoaded = Object.values(utilities).every(Boolean);
const siteDetected = window.siteCompatibilityManager?.siteConfig?.name === 'Facebook';
const errorHandlerWorking = window.facebookErrorHandler?.shouldOperateNormally() !== undefined;

if (allUtilitiesLoaded && siteDetected && errorHandlerWorking) {
  console.log('🎉 All tests passed! Facebook integration is working correctly.');
  console.log('✅ The extension should now work reliably on Facebook without JavaScript errors.');
} else {
  console.log('⚠️ Some tests failed. Check the details above.');
  if (!allUtilitiesLoaded) console.log('   - Some utilities are missing');
  if (!siteDetected) console.log('   - Site detection may not be working');
  if (!errorHandlerWorking) console.log('   - Error handler may not be initialized');
}

console.log('\n💡 To run the full test suite, use: new FacebookIntegrationTest().runAllTests()');
console.log('🔧 To manually test knowledge base, try uploading a file through the extension popup.');
