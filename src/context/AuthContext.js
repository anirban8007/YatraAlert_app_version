import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/expo';
import { onAuthStateChange, getCurrentUser, getCurrentSession } from '../utils/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const clerkAuth = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const [supabaseUser, setSupabaseUser] = useState(null);
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    // Check current Supabase session on mount
    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();
        const currentSession = await getCurrentSession();
        setSupabaseUser(currentUser);
        setSupabaseSession(currentSession);
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
      setSupabaseSession(newSession);
      if (newSession?.user) {
        setSupabaseUser(newSession.user);
      } else {
        setSupabaseUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const skipLogin = () => {
    setHasSkipped(true);
  };

  // Active user: Clerk user takes priority, fallback to Supabase user
  const activeUser = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        name: clerkUser.fullName || clerkUser.firstName || 'Traveler',
        user_metadata: {
          full_name: clerkUser.fullName || clerkUser.firstName,
          name: clerkUser.fullName || clerkUser.firstName,
          email: clerkUser.primaryEmailAddress?.emailAddress,
        },
      }
    : supabaseUser;

  const activeSession = clerkAuth.isSignedIn
    ? { user: activeUser, token: clerkAuth.sessionId }
    : supabaseSession;

  const isAuth = clerkAuth.isSignedIn || !!supabaseUser;
  const isLoaded = clerkAuth.isLoaded && !loading;

  const value = {
    user: activeUser,
    session: activeSession,
    loading: !isLoaded,
    error,
    isAuthenticated: isAuth,
    hasSkipped,
    skipLogin,
    clerkAuth,
    clerkUser,
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
