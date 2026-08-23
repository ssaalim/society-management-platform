import axios from 'axios';

/**
 * Centered Axios instance configuring base API requests.
 * Automatically injects native JWT tokens and active Tenant Context (x-tenant-id) into headers.
 */
let apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').trim().replace(/\/+$/, '');
if (!apiBase.endsWith('/api/v1')) {
  apiBase = `${apiBase}/api/v1`;
}

export const apiClient = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to dynamically append Auth and Tenant contexts
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('dev_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Also support x-dev-user-id header if dev mode
        if (localStorage.getItem('dev_token')) {
          config.headers['x-dev-user-id'] = localStorage.getItem('dev_token');
        }
      }

      // Inject active society tenant ID from window storage
      const activeSocietyId = localStorage.getItem('active_society_id');
      if (activeSocietyId) {
        config.headers['x-tenant-id'] = activeSocietyId;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // If token expired and not on login page, redirect to login
      if (!window.location.pathname.startsWith('/login')) {
        // Optional: window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
