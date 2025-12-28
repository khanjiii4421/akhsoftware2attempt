// Netlify Build Script
// This script replaces {{NETLIFY_API_URL}} in config.js with actual environment variable
// Add this to netlify.toml build command

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'public', 'config.js');
const apiUrl = process.env.NETLIFY_API_URL || '';

if (apiUrl) {
  let configContent = fs.readFileSync(configPath, 'utf8');
  configContent = configContent.replace(/\{\{NETLIFY_API_URL\}\}/g, apiUrl);
  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log('✅ API URL injected:', apiUrl);
} else {
  console.log('⚠️  NETLIFY_API_URL not set, using fallback');
}

