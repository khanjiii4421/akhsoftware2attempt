// Configuration file for API endpoints
// This file is loaded before auth.js to set API_BASE_URL
// FREE Solution: API URL is set directly in HTML files (no Netlify Pro needed)

(function() {
  // Method 1: Check for manually set API URL (via script tag in HTML before config.js)
  // This is the PRIMARY method - set in HTML files
  if (window.API_BASE_URL && typeof window.API_BASE_URL === 'string' && window.API_BASE_URL.length > 0) {
    console.log('✅ Using API URL from HTML:', window.API_BASE_URL);
    return; // Already set, use it
  }
  
  // Method 2: Check if we're in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.API_BASE_URL = 'http://localhost:3000';
    console.log('✅ Development mode: Using localhost API');
    return;
  }
  
  // Method 3: Fallback - Use default backend URL (if not set in HTML)
  window.API_BASE_URL = 'https://khandevhub.vercel.app';
  console.log('✅ Using default backend URL:', window.API_BASE_URL);
  console.warn('⚠️ API URL not set in HTML. Using default. Add <script>window.API_BASE_URL = "https://khandevhub.vercel.app";</script> in HTML.');
})();

