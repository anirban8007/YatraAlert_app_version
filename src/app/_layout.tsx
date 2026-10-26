import '../utils/cryptoPolyfill';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { RoleProvider } from '../context/RoleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Slot, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureGoogleSignin } from '../utils/googleAuth';
import * as TaskManager from 'expo-task-manager';
import { getJSON, setJSON } from '../utils/storage';
import Mapbox from '@rnmapbox/maps';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

const BACKGROUND_LOCATION_TASK = 'background-location-task';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }
  if (data) {
    // Just receiving locations keeps the foreground service alive
    // so that the app doesn't reset when minimized.
  }
});

import GenderPicker from '../components/GenderPicker';

const publishableKey = 
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 
  "pk_test_Zml0dGluZy1oYWRkb2NrLTU3ODkuY2xlcmsuYWNjb3VudHMuZGV2JA";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.");
}

configureGoogleSignin('17638648884-acko4iollk282l70tkluspv7jo7doeit.apps.googleusercontent.com');

function useProtectedRoute() {
  const { session, loading, hasSkipped } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!session && !hasSkipped && !inAuthGroup) {
      router.replace('/login');
    }
  }, [session, loading, hasSkipped, segments, router]);
}

interface ProfileLoaderProps {
  children: React.ReactNode;
}

/**
 * ProfileLoader
 * Runs inside AppProvider so it can call useApp().
 * After login, checks if the user has set up their emergency profile.
 * If not, shows the GenderPicker modal once.
 */
function ProfileLoader({ children }: ProfileLoaderProps) {
  const { session } = useAuth();
  const { setUserProfile } = useApp();
  const [showPicker, setShowPicker] = useState(false);
  const [googleName, setGoogleName] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadOrPromptProfile() {
      if (!session) return;

      // Check if we already have a saved profile
      const saved = await getJSON('userProfile', undefined);

      if (!isMounted) return;

      if (saved && saved.name && saved.gender) {
        // Already set up — load into context
        setUserProfile(saved);
      } else {
        // Try to pre-fill name from Google/Supabase user metadata
        const meta = session?.user?.user_metadata;
        const fullName = meta?.full_name || meta?.name || '';
        setGoogleName(fullName);
        setShowPicker(true);
      }
    }

    loadOrPromptProfile();
    return () => { isMounted = false; };
  }, [session, setUserProfile]);

  async function handleProfileSave(profile: any) {
    // Persist to storage
    await setJSON('userProfile', profile);
    // Load into app context
    setUserProfile(profile);
    setShowPicker(false);
  }

  return (
    <>
      {children}
      <GenderPicker
        visible={showPicker}
        defaultName={googleName}
        onSave={handleProfileSave}
      />
    </>
  );
}

function InitialLayout() {
  useProtectedRoute();

  return (
    <AppProvider>
      <RoleProvider>
        <ProfileLoader>
          <Slot />
        </ProfileLoader>
      </RoleProvider>
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <InitialLayout />
          </AuthProvider>
        </GestureHandlerRootView>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}