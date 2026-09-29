import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('urban_access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const url = original.url || '';
    if (error.response?.status !== 401 || original._retry || url.includes('/api/auth/login') || url.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }
    const refreshToken = localStorage.getItem('urban_refresh');
    if (!refreshToken) return Promise.reject(error);
    original._retry = true;
    try {
      refreshPromise = refreshPromise || axios.post(`${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`, { refreshToken });
      const { data } = await refreshPromise;
      localStorage.setItem('urban_access', data.data.accessToken);
      localStorage.setItem('urban_refresh', data.data.refreshToken);
      if (data.data.user) localStorage.setItem('urban_user', JSON.stringify(data.data.user));
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      localStorage.removeItem('urban_access');
      localStorage.removeItem('urban_refresh');
      localStorage.removeItem('urban_user');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);

export default api;
