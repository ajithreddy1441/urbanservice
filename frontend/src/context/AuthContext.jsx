import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('urban_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('urban_access')));

  useEffect(() => {
    if (!localStorage.getItem('urban_access')) return;
    api.get('/api/auth/me')
      .then((res) => {
        setUser(res.data.data);
        localStorage.setItem('urban_user', JSON.stringify(res.data.data));
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    setSession(data) {
      localStorage.setItem('urban_access', data.accessToken);
      localStorage.setItem('urban_refresh', data.refreshToken);
      localStorage.setItem('urban_user', JSON.stringify(data.user));
      setUser(data.user);
    },
    async logout() {
      const refreshToken = localStorage.getItem('urban_refresh');
      try { await api.post('/api/auth/logout', { refreshToken }); } catch { /* ignore */ }
      localStorage.removeItem('urban_access');
      localStorage.removeItem('urban_refresh');
      localStorage.removeItem('urban_user');
      setUser(null);
    },
    refreshUser: async () => {
      const res = await api.get('/api/auth/me');
      setUser(res.data.data);
      localStorage.setItem('urban_user', JSON.stringify(res.data.data));
      return res.data.data;
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
