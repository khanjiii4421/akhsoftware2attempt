// Authentication and Token Management
// API_BASE: Auto-detect based on environment
// In production (Netlify), this will be your Vercel backend URL
// In development, it will use localhost
const API_BASE = (() => {
  // Check if we have a custom API URL set (for Netlify deployment)
  if (window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  
  // Check if we're in production (Netlify)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // This will be set via Netlify environment variable
    // Default to same origin if not set (for same-domain deployment)
    return '/api';
  }
  
  // Development: use localhost
  return 'http://localhost:3000/api';
})();

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // If on login page and already logged in, redirect
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        if (token && user) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // If not on login page and not logged in, redirect to login
        if (!token || !user) {
            window.location.href = 'index.html';
        } else {
            // Display user info
            const userInfoEl = document.getElementById('userInfo');
            if (userInfoEl) {
                userInfoEl.textContent = `${user.username} (${user.role})`;
            }
        }
    }
});

// Login function
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Fetch with authentication
async function fetchWithAuth(url, options = {}) {
    try {
    const headers = { ...getAuthHeaders(), ...options.headers };
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        logout();
        return null;
    }
    
    return response;
    } catch (error) {
        console.error('Network error in fetchWithAuth:', error);
        // Return a fake response object that indicates failure
        return {
            ok: false,
            status: 0,
            statusText: 'Network Error',
            json: async () => ({ error: error.message || 'Network error. Please check if server is running.' }),
            text: async () => error.message || 'Network error'
        };
    }
}

