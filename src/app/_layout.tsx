import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Slot, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureGoogleSignin } from '../utils/googleAuth';
import * as TaskManager from 'expo-task-manager';
import { getJSON, setJSON } from '../utils/storage';
import GenderPicker from '../components/GenderPicker';

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

configureGoogleSignin('YOUR_WEB_CLIENT_ID_FROM_GOOGLE_CLOUD');

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
  }, [session, loading, hasSkipped, segments]);
}

/**
 * ProfileLoader
 * Runs inside AppProvider so it can call useApp().
 * After login, checks if the user has set up their emergency profile.
 * If not, shows the GenderPicker modal once.
 */
function ProfileLoader({ children }) {
  const { session } = useAuth();
  const { setUserProfile } = useApp();
  const [showPicker, setShowPicker] = useState(false);
  const [googleName, setGoogleName] = useState('');

  useEffect(() => {
    async function loadOrPromptProfile() {
      if (!session) return;

      // Check if we already have a saved profile
      const saved = await getJSON('userProfile', null);

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
  }, [session]);

  async function handleProfileSave(profile) {
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
      <ProfileLoader>
        <Slot />
      </ProfileLoader>
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}