// Configuration file for API endpoints
// This file is loaded before auth.js to set API_BASE_URL

// Auto-detect API URL based on environment
(function() {
  // Method 1: Check for manually set API URL (via script tag in HTML before config.js)
  // You can add this in HTML: <script>window.API_BASE_URL = 'https://your-backend.vercel.app/api';</script>
  if (window.API_BASE_URL && typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.length > 0) {
    console.log('Using manually set API URL:', window.API_BASE_URL);
    return; // Already set, use it
  }
  
  // Method 2: Check if we're in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.API_BASE_URL = 'http://localhost:3000/api';
    console.log('Development mode: Using localhost API');
    return;
  }
  
  // Method 3: Production - Use Netlify environment variable
  // This will be set by netlify-build-script.js during build
  // The script replaces {{NETLIFY_API_URL}} with actual value from environment
  const netlifyApiUrl = '{{NETLIFY_API_URL}}';
  
  if (netlifyApiUrl && netlifyApiUrl !== '{{NETLIFY_API_URL}}' && netlifyApiUrl.trim() !== '') {
    window.API_BASE_URL = netlifyApiUrl;
    console.log('Using Netlify environment API URL:', netlifyApiUrl);
    return;
  }
  
  // Method 4: Fallback - Show error in console
  console.error('⚠️ API_BASE_URL not configured!');
  console.error('Please set NETLIFY_API_URL in Netlify environment variables');
  console.error('Or set window.API_BASE_URL in HTML before config.js loads');
  
  // Default fallback (will likely fail, but prevents complete breakage)
  window.API_BASE_URL = '/api';
})();

