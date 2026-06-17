import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/api';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  hasSkipped: boolean;
  skipLogin: () => void;
};

const AuthContext = createContext<AuthContextType>({ session: null, loading: true, hasSkipped: false, skipLogin: () => {} });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const skipLogin = () => setHasSkipped(true);

  return (
    <AuthContext.Provider value={{ session, loading, hasSkipped, skipLogin }}>
      {children}
    </AuthContext.Provider>
  );
}
