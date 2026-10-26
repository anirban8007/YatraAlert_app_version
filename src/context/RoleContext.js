import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const RoleContext = createContext();

const UUID_STORAGE_KEY = 'yatra_persistent_user_uuid';

function generateRandomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Deterministically maps any arbitrary string (such as Clerk's user_xxx)
 * into a valid RFC4122 UUID v4 so Postgres UUID columns never error.
 */
export function stringToUUID(str) {
  if (!str) return generateRandomUUID();
  if (isValidUUID(str)) return str.toLowerCase();

  let h1 = 0x811c9dc5;
  let h2 = 0x5b358249;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = (h1 ^ ch) * 0x01000193;
    h2 = (h2 ^ (ch << 1)) * 0x01000193;
  }

  let hex = '';
  for (let i = 0; i < 4; i++) {
    const val = Math.sin(i + (h1 >>> 0) + (h2 >>> 0)) * 10000;
    const chunk = Math.floor((val - Math.floor(val)) * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    hex += chunk;
  }
  hex = hex.padEnd(32, '0').slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function RoleProvider({ children }) {
  const { session } = useAuth();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initUserId() {
      try {
        if (session?.user?.id) {
          const formatted = stringToUUID(session.user.id);
          if (isMounted) setUserId(formatted);
          await AsyncStorage.setItem(UUID_STORAGE_KEY, formatted);
        } else {
          const stored = await AsyncStorage.getItem(UUID_STORAGE_KEY);
          if (stored && isValidUUID(stored)) {
            if (isMounted) setUserId(stored);
          } else {
            const fresh = generateRandomUUID();
            if (isMounted) setUserId(fresh);
            await AsyncStorage.setItem(UUID_STORAGE_KEY, fresh);
          }
        }
      } catch (_e) {
        if (isMounted && !userId) setUserId(generateRandomUUID());
      }
    }

    initUserId();
    return () => { isMounted = false; };
  }, [session?.user?.id]);

  return (
    <RoleContext.Provider value={{ userId: userId || generateRandomUUID(), setUserId }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
