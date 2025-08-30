#!/usr/bin/env node

/**
 * Build Icons Script
 * 
 * Converts SVG source to PNG icons with proper transparency
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Sharp library not found. Please install it with: npm install sharp');
  process.exit(1);
}

const ICON_SIZES = [16, 48, 128];
const SVG_SOURCE = 'icons/icon.svg';
const OUTPUT_DIR = 'icons';

async function buildIcons() {
  console.log('🎨 Building extension icons with transparency...');
  
  // Check if SVG source exists
  if (!fs.existsSync(SVG_SOURCE)) {
    console.error(`❌ SVG source not found: ${SVG_SOURCE}`);
    process.exit(1);
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Read SVG source
  const svgBuffer = fs.readFileSync(SVG_SOURCE);
  
  // Generate PNG icons for each size
  for (const size of ICON_SIZES) {
    try {
      console.log(`📐 Generating ${size}x${size} icon...`);
      
      const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true
        })
        .toFile(outputPath);
      
      console.log(`   ✅ Created: ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ Failed to generate ${size}x${size} icon:`, error.message);
    }
  }
  
  console.log('\n🎉 Icon generation completed!');
  console.log('\n📋 Generated files:');
  ICON_SIZES.forEach(size => {
    const filePath = path.join(OUTPUT_DIR, `icon${size}.png`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   📄 icon${size}.png (${Math.round(stats.size / 1024)}KB)`);
    }
  });
}

// Alternative method using Canvas API if Sharp is not available
async function buildIconsWithCanvas() {
  console.log('🎨 Building icons using Canvas API (fallback method)...');
  
  // This would require canvas library: npm install canvas
  // For now, we'll just show the command to install sharp
  console.log('💡 For best results, install Sharp library:');
  console.log('   npm install sharp');
  console.log('   node build-icons.js');
}

if (require.main === module) {
  buildIcons().catch(error => {
    console.error('❌ Icon build failed:', error.message);
    console.log('\n💡 Trying fallback method...');
    buildIconsWithCanvas();
  });
}

module.exports = { buildIcons };
