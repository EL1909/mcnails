import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchProfile } from '../api/auth';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mcnails_token'));

  const refreshUser = async () => {
    const t = token || localStorage.getItem('mcnails_token');
    if (!t) return;
    try {
      const data = await fetchProfile(t);
      setUser(data);
    } catch {
      logout();
    }
  };

  const login = async (newToken: string) => {
    localStorage.setItem('mcnails_token', newToken);
    setToken(newToken);
    try {
      const data = await fetchProfile(newToken);
      setUser(data);
    } catch {
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('mcnails_token');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (token && !user) {
      refreshUser();
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
