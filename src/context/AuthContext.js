import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser, getCurrentSession } from '../utils/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check current session on mount
    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();
        const currentSession = await getCurrentSession();
        
        setUser(currentUser);
        setSession(currentSession);
      } catch (e) {
        console.error('Session check error:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    checkSession();

    // Listen for auth state changes
    const subscription = onAuthStateChange((event, newSession) => {
      console.log('Auth event:', event);
      
      setSession(newSession);
      if (newSession?.user) {
        setUser(newSession.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
