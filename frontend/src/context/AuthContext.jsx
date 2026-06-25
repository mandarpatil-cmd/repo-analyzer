import { createContext, useState, useEffect } from 'react';
import api from "../api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token is still valid
      api.get('/auth/me')
        .then(res => setUser({ ...res.data.user, id: res.data.user._id || res.data.user.id }))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.token);
    setUser({ ...res.data.user, id: res.data.user._id || res.data.user.id });
    localStorage.setItem('token', res.data.token);
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    setToken(res.data.token);
    setUser({ ...res.data.user, id: res.data.user._id || res.data.user.id });
    localStorage.setItem('token', res.data.token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    // We do not redirect here, ProtectedRoute handles redirect when user becomes null
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};