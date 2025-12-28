// Netlify Build Script
// This script replaces {{NETLIFY_API_URL}} in config.js with actual environment variable
// Add this to netlify.toml build command

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'public', 'config.js');
const apiUrl = process.env.NETLIFY_API_URL || '';

console.log('🔧 Netlify Build Script Running...');
console.log('📝 Checking NETLIFY_API_URL environment variable...');

if (!fs.existsSync(configPath)) {
  console.error('❌ ERROR: public/config.js not found!');
  console.error('   Make sure public/config.js exists in your project.');
  process.exit(1);
}

if (apiUrl) {
  console.log('✅ NETLIFY_API_URL found:', apiUrl);
  
  // Validate URL format
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    console.warn('⚠️  WARNING: API URL should start with http:// or https://');
  }
  
  // Note: URL should be base URL without /api (e.g., https://khandevhub.vercel.app)
  // The /api suffix will be added automatically in the code
  if (apiUrl.endsWith('/api')) {
    console.warn('⚠️  NOTE: URL ends with /api');
    console.warn('   Recommended: Use base URL without /api (e.g., https://khandevhub.vercel.app)');
    console.warn('   The /api suffix will be added automatically in API calls');
  }
  
  try {
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    if (configContent.includes('{{NETLIFY_API_URL}}')) {
      configContent = configContent.replace(/\{\{NETLIFY_API_URL\}\}/g, apiUrl);
      fs.writeFileSync(configPath, configContent, 'utf8');
      console.log('✅ API URL successfully injected into config.js');
      console.log('   Injected URL:', apiUrl);
    } else {
      console.warn('⚠️  WARNING: {{NETLIFY_API_URL}} placeholder not found in config.js');
      console.warn('   The placeholder might have already been replaced, or config.js is different.');
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to update config.js');
    console.error('   Error:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ ERROR: NETLIFY_API_URL environment variable is not set!');
  console.error('');
  console.error('📝 To fix this:');
  console.error('   1. Go to Netlify dashboard');
  console.error('   2. Site settings → Environment variables');
  console.error('   3. Add variable: NETLIFY_API_URL');
  console.error('   4. Value: https://khandevhub.vercel.app (base URL without /api)');
  console.error('   5. Redeploy your site');
  console.error('');
  console.warn('⚠️  Continuing with fallback configuration...');
  console.warn('   Frontend will try to use default API URL (may not work)');
}

