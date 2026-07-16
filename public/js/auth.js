// --- Authentication Helpers ---

const AUTH_TOKEN_KEY = 'library_jwt_token';
const AUTH_USER_KEY = 'library_user_info';

const Auth = {
  // Save token and user details to localStorage
  login(token, user) {
    if (user.username && user.username.toLowerCase() === 'student') user = { ...user, role: 'student' };
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },

  // Log out the user and clear keys
  logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    // Show login screen
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    
    // Clear credentials forms
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  },

  // Check if token exists
  isLoggedIn() {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },

  // Retrieve JWT string
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  // Retrieve user object
  getUser() {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Error parsing stored user data', e);
      return null;
    }
  },

  // Check if logged in user is admin
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // Get authorization request header
  getHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // Authenticated fetch wrapper
  async fetch(url, options = {}) {
    // Inject headers
    options.headers = {
      ...options.headers,
      ...this.getHeaders()
    };

    try {
      const response = await fetch(url, options);
      
      // Auto logout if unauthorized or forbidden
      if (response.status === 401 || response.status === 403) {
        showToast('Session expired. Please log in again.', 'warning');
        this.logout();
        throw new Error('Unauthorized');
      }

      return response;
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        console.error(`Fetch error on ${url}:`, err);
        showToast('Network error connecting to backend.', 'error');
      }
      throw err;
    }
  }
};

// Global toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';
  if (type === 'warning') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
