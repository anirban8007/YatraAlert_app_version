import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const RoleContext = createContext();

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const fallbackId = generateUUID();

export function RoleProvider({ children }) {
  const { session } = useAuth();
  const [userId, setUserId] = useState(fallbackId);

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
    }
  }, [session]);

  return (
    <RoleContext.Provider value={{ userId, setUserId }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
