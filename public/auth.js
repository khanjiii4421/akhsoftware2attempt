// Authentication and Token Management
// API_BASE_URL: Set by config.js (loaded before this file)
// In production (Netlify), this will be your Vercel backend URL (e.g., https://khandevhub.vercel.app)
// In development, it will use localhost:3000
const API_BASE_URL = window.API_BASE_URL || 'https://khandevhub.vercel.app';

// API_BASE: Add /api suffix for API calls
const API_BASE = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🔗 API Endpoint:', API_BASE);

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
            const response = await fetch(`${API_BASE_URL}/api/login`, {
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

