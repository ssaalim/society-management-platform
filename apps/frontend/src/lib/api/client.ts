import axios from 'axios';
import { supabase } from '../supabase/client';

const IS_DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

/**
 * Centered Axios instance configuring base API requests.
 * Automatically injects auth tokens and active Tenant Context (x-tenant-id) into headers.
 * 
 * In DEV mode: uses x-dev-user-id header with the stored dev token.
 * In PROD mode: uses Supabase JWT Bearer token.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor to dynamically append Auth and Tenant contexts
apiClient.interceptors.request.use(
  async (config) => {
    if (IS_DEV_AUTH) {
      // DEV MODE: inject dev user ID from localStorage
      if (typeof window !== 'undefined') {
        const devToken = localStorage.getItem('dev_token');
        if (devToken) {
          config.headers['x-dev-user-id'] = devToken;
        }
      }
    } else {
      // PROD MODE: inject Supabase JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }

    // 2. Inject active society tenant ID from window storage
    if (typeof window !== 'undefined') {
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

// Response Interceptor for auto session refreshing (Production only)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only retry for production Supabase auth
    if (!IS_DEV_AUTH && error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

      if (!refreshError && session?.access_token) {
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
