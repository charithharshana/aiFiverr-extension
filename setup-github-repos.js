#!/usr/bin/env node

/**
 * GitHub Repository Setup Helper
 * Helps configure the two-repository system for aiFiverr
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setupRepositories() {
  console.log('🚀 aiFiverr GitHub Repository Setup');
  console.log('=====================================\n');
  
  console.log('This will help you set up:');
  console.log('1. 🔒 PRIVATE repo (your development code)');
  console.log('2. 🌍 PUBLIC repo (extension releases for users)\n');
  
  // Get user information
  const username = await question('Enter your GitHub username: ');
  const publicRepoName = await question('Enter public repository name (default: aiFiverr-extension): ') || 'aiFiverr-extension';
  
  console.log('\n📋 Configuration Summary:');
  console.log(`Private Repo: ${username}/aiFiverr (current repo - will be made private)`);
  console.log(`Public Repo:  ${username}/${publicRepoName} (for user downloads)`);
  
  const confirm = await question('\nProceed with setup? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    return;
  }
  
  // Update deploy script configuration
  console.log('\n🔧 Updating deployment configuration...');
  
  const deployScript = fs.readFileSync('deploy-to-public.js', 'utf8');
  const updatedScript = deployScript.replace(
    'https://github.com/YOUR_USERNAME/aiFiverr-extension.git',
    `https://github.com/${username}/${publicRepoName}.git`
  );
  
  fs.writeFileSync('deploy-to-public.js', updatedScript);
  console.log('✅ Updated deploy-to-public.js');
  
  // Create setup instructions
  const instructions = `
# 🚀 aiFiverr Repository Setup Complete!

## Next Steps:

### 1. Create Public Repository
Go to GitHub and create a new repository:
- **Name**: ${publicRepoName}
- **Visibility**: PUBLIC
- **Initialize**: Don't add README (script will create it)
- **URL**: https://github.com/${username}/${publicRepoName}

### 2. Make Current Repository Private
Go to your current repository settings:
- **Repository**: ${username}/aiFiverr (or current repo name)
- **Settings** → **General** → **Danger Zone**
- **Change repository visibility** → **Make private**

### 3. Deploy Extension
Run the deployment script:
\`\`\`bash
node deploy-to-public.js
\`\`\`

### 4. Verify Setup
Check that:
- ✅ Private repo contains all your development files
- ✅ Public repo contains only extension files
- ✅ Users can download from public repo

## 🔄 Daily Workflow

### Development (Private Repo)
\`\`\`bash
# Make changes
git add .
git commit -m "Add feature"
git push origin main

# Release to public
node deploy-to-public.js
\`\`\`

### Users (Public Repo)
- Download ZIP from: https://github.com/${username}/${publicRepoName}
- Or clone: \`git clone https://github.com/${username}/${publicRepoName}.git\`

## 🎯 What This Achieves

### Your Benefits (Private Repo)
- 🔒 Source code stays private
- 🔧 Keep development files private
- 🚀 Automated public releases

### User Benefits (Public Repo)
- 🌍 Easy extension download
- 📋 Clear installation instructions
- 🔄 Regular updates
- 🚫 No access to your private code

## 🔑 Security Notes

- ✅ Firebase API key in extension is OK (client-side keys are public)
- ✅ Users authenticate through YOUR Firebase project
- ❌ Users add their own Gemini API keys (never in repos)

Your setup is ready! 🎉
`;
  
  fs.writeFileSync('SETUP_COMPLETE.md', instructions);
  console.log('✅ Created SETUP_COMPLETE.md with next steps');
  
  console.log('\n🎉 Setup Complete!');
  console.log('\nNext steps:');
  console.log(`1. Create public repo: https://github.com/new`);
  console.log(`   - Name: ${publicRepoName}`);
  console.log(`   - Visibility: PUBLIC`);
  console.log('2. Make current repo private in settings');
  console.log('3. Run: node deploy-to-public.js');
  console.log('\nSee SETUP_COMPLETE.md for detailed instructions.');
  
  rl.close();
}

if (require.main === module) {
  setupRepositories().catch(error => {
    console.error('❌ Setup failed:', error.message);
    rl.close();
    process.exit(1);
  });
}
