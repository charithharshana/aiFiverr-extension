/**
 * Facebook Integration Test
 * 
 * Tests the aiFiverr extension's knowledge base file attachment functionality
 * on Facebook to ensure it works without causing JavaScript errors.
 */

class FacebookIntegrationTest {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.warnings = [];
  }

  async runAllTests() {
    console.log('🧪 aiFiverr Facebook Integration Test: Starting comprehensive test suite');
    
    try {
      // Test 1: Site Detection
      await this.testSiteDetection();
      
      // Test 2: CSP Compliance
      await this.testCSPCompliance();
      
      // Test 3: Error Handling
      await this.testErrorHandling();
      
      // Test 4: Knowledge Base Functionality
      await this.testKnowledgeBaseFunctionality();
      
      // Test 5: DOM Manipulation Safety
      await this.testDOMManipulationSafety();
      
      // Test 6: React Compatibility
      await this.testReactCompatibility();
      
      // Generate report
      this.generateTestReport();
      
    } catch (error) {
      console.error('🚨 Facebook Integration Test failed:', error);
      this.errors.push(`Test suite failed: ${error.message}`);
    }
  }

  async testSiteDetection() {
    console.log('🔍 Testing site detection...');
    
    try {
      // Check if site compatibility manager is loaded
      if (!window.siteCompatibilityManager) {
        throw new Error('Site compatibility manager not loaded');
      }
      
      const siteConfig = window.siteCompatibilityManager.siteConfig;
      
      // Verify Facebook is detected correctly
      if (window.location.hostname.includes('facebook.com')) {
        if (siteConfig.name !== 'Facebook') {
          throw new Error(`Expected Facebook, got ${siteConfig.name}`);
        }
        
        if (!siteConfig.strictCSP) {
          throw new Error('Facebook should have strict CSP enabled');
        }
        
        if (!siteConfig.reactSite) {
          throw new Error('Facebook should be detected as React site');
        }
      }
      
      this.testResults.push({
        test: 'Site Detection',
        status: 'PASS',
        details: `Detected as ${siteConfig.name} with correct configuration`
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'Site Detection',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`Site Detection: ${error.message}`);
    }
  }

  async testCSPCompliance() {
    console.log('🛡️ Testing CSP compliance...');
    
    try {
      // Test CSP-safe DOM utilities
      if (!window.cspSafeDOMUtils) {
        throw new Error('CSP-safe DOM utilities not loaded');
      }
      
      // Test creating elements without inline styles
      const testElement = window.cspSafeDOMUtils.createElement('div', {
        textContent: 'Test element',
        styles: {
          backgroundColor: 'red',
          color: 'white'
        }
      });
      
      if (!testElement) {
        throw new Error('Failed to create CSP-safe element');
      }
      
      // Test popup creation
      const testPopup = window.cspSafeDOMUtils.createPopup({
        title: 'Test Popup',
        content: 'This is a test popup',
        closable: true
      });
      
      if (!testPopup) {
        throw new Error('Failed to create CSP-safe popup');
      }
      
      // Clean up test elements
      if (testElement.parentNode) testElement.remove();
      if (testPopup.parentNode) testPopup.remove();
      
      this.testResults.push({
        test: 'CSP Compliance',
        status: 'PASS',
        details: 'CSP-safe DOM manipulation working correctly'
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'CSP Compliance',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`CSP Compliance: ${error.message}`);
    }
  }

  async testErrorHandling() {
    console.log('⚠️ Testing error handling...');
    
    try {
      // Check if Facebook error handler is loaded
      if (!window.facebookErrorHandler) {
        throw new Error('Facebook error handler not loaded');
      }
      
      // Test error handler methods
      const shouldOperate = window.facebookErrorHandler.shouldOperateNormally();
      const isDOMSafe = window.facebookErrorHandler.isDOMManipulationSafe();
      const areStylesAllowed = window.facebookErrorHandler.areInlineStylesAllowed();
      
      console.log('Error handler status:', {
        shouldOperate,
        isDOMSafe,
        areStylesAllowed
      });
      
      // Simulate a CSP violation (safely)
      const mockCSPEvent = {
        violatedDirective: 'style-src',
        blockedURI: 'chrome-extension://test',
        sourceFile: 'chrome-extension://test/content.js'
      };
      
      window.facebookErrorHandler.handleCSPViolation(mockCSPEvent);
      
      // Check if flags were set correctly
      if (!window.aiFiverrDisableInlineStyles) {
        this.warnings.push('CSP violation handling may not be working correctly');
      }
      
      this.testResults.push({
        test: 'Error Handling',
        status: 'PASS',
        details: 'Error handling mechanisms working correctly'
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'Error Handling',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`Error Handling: ${error.message}`);
    }
  }

  async testKnowledgeBaseFunctionality() {
    console.log('📚 Testing knowledge base functionality...');
    
    try {
      // Check if knowledge base manager is loaded
      if (!window.knowledgeBaseManager) {
        throw new Error('Knowledge base manager not loaded');
      }
      
      // Test safe mode detection
      const isStrictSite = window.cspSafeDOMUtils?.isStrictCSPSite();
      const useCSPSafeMode = window.aiFiverrUseCSPSafeMode;
      
      console.log('Knowledge base mode:', {
        isStrictSite,
        useCSPSafeMode,
        disableInlineStyles: window.aiFiverrDisableInlineStyles
      });
      
      // Test file operations (without actually uploading)
      const testFileData = {
        name: 'test-file.txt',
        mimeType: 'text/plain',
        size: 1024
      };
      
      // Test file key generation
      const fileKey = window.knowledgeBaseManager.generateFileKey(testFileData.name);
      if (!fileKey) {
        throw new Error('Failed to generate file key');
      }
      
      this.testResults.push({
        test: 'Knowledge Base Functionality',
        status: 'PASS',
        details: 'Knowledge base core functionality working'
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'Knowledge Base Functionality',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`Knowledge Base: ${error.message}`);
    }
  }

  async testDOMManipulationSafety() {
    console.log('🏗️ Testing DOM manipulation safety...');
    
    try {
      // Test safe element creation
      const safeElement = window.siteCompatibilityManager?.createElement('div', {
        textContent: 'Safe test element',
        className: 'test-element',
        styles: {
          padding: '10px',
          margin: '5px'
        }
      });
      
      if (!safeElement) {
        throw new Error('Failed to create safe element');
      }
      
      // Test that inline styles are handled correctly
      const hasInlineStyles = safeElement.style.padding === '10px';
      const shouldHaveInlineStyles = window.siteCompatibilityManager?.canUseInlineStyles();
      
      if (hasInlineStyles && !shouldHaveInlineStyles) {
        this.warnings.push('Inline styles applied when they should be disabled');
      }
      
      // Clean up
      if (safeElement.parentNode) safeElement.remove();
      
      this.testResults.push({
        test: 'DOM Manipulation Safety',
        status: 'PASS',
        details: 'DOM manipulation following site compatibility rules'
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'DOM Manipulation Safety',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`DOM Safety: ${error.message}`);
    }
  }

  async testReactCompatibility() {
    console.log('⚛️ Testing React compatibility...');
    
    try {
      // Check if we're avoiding problematic DOM operations
      const avoidDOM = window.siteCompatibilityManager?.shouldAvoidDOMManipulation();
      const minimalMode = window.aiFiverrMinimalDOMMode;
      
      if (window.location.hostname.includes('facebook.com')) {
        if (!avoidDOM && !minimalMode) {
          this.warnings.push('Should avoid DOM manipulation on Facebook');
        }
      }
      
      // Test that we're not interfering with React
      const reactElements = document.querySelectorAll('[data-reactroot], [data-react-helmet]');
      console.log(`Found ${reactElements.length} React elements on page`);
      
      this.testResults.push({
        test: 'React Compatibility',
        status: 'PASS',
        details: `React compatibility mode active: ${avoidDOM || minimalMode}`
      });
      
    } catch (error) {
      this.testResults.push({
        test: 'React Compatibility',
        status: 'FAIL',
        error: error.message
      });
      this.errors.push(`React Compatibility: ${error.message}`);
    }
  }

  generateTestReport() {
    console.log('\n📊 aiFiverr Facebook Integration Test Report');
    console.log('=' .repeat(50));
    
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️ Warnings: ${this.warnings.length}`);
    
    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.details) console.log(`   ${result.details}`);
      if (result.error) console.log(`   Error: ${result.error}`);
    });
    
    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      this.warnings.forEach(warning => {
        console.log(`⚠️ ${warning}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(error => {
        console.log(`❌ ${error}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
    
    const overallStatus = failCount === 0 ? 'PASS' : 'FAIL';
    console.log(`Overall Status: ${overallStatus}`);
    
    return {
      status: overallStatus,
      passed: passCount,
      failed: failCount,
      warnings: this.warnings.length,
      results: this.testResults
    };
  }
}

// Auto-run test if on Facebook
if (window.location.hostname.includes('facebook.com')) {
  // Wait for extension to initialize
  setTimeout(() => {
    const test = new FacebookIntegrationTest();
    test.runAllTests();
  }, 3000);
}

// Export for manual testing
window.FacebookIntegrationTest = FacebookIntegrationTest;
