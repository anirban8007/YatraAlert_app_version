import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

export const useGpsTracking = (onLocationUpdate) => {
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  useEffect(() => {
    let foregroundSub = null;
    let appStateSub = null;
    let isCancelled = false;

    const startTracking = async () => {
      // 1. Request foreground permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted' || isCancelled) return;

      // 2. Start high-accuracy foreground tracking (for active UI updates)
      foregroundSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          if (onLocationUpdateRef.current) {
            onLocationUpdateRef.current({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              speed: location.coords.speed,
              heading: location.coords.heading,
            });
          }
        }
      );

      // 3. Request background permissions
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted' || isCancelled) return;

      // Helper to safely start background service only when app is active
      const tryStartBackground = async () => {
        if (AppState.currentState !== 'active' || isCancelled) return;
        try {
          const hasSupport = await Location.isBackgroundLocationAvailableAsync();
          if (!hasSupport) return;

          const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
          if (!isRegistered) {
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 10,
              timeInterval: 10000,
              foregroundService: {
                notificationTitle: 'YatraAlert Active',
                notificationBody: 'Monitoring journey progress and station proximity',
                notificationColor: '#2563EB',
              },
            });
          }
        } catch (error) {
          // Android 12+ prevents starting foreground services from background state;
          // will retry when AppState becomes active.
        }
      };

      // Attempt when active
      await tryStartBackground();

      // Listen for app coming back to foreground (e.g., after OS permission modal closes)
      appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          tryStartBackground();
        }
      });
    };

    startTracking();

    return () => {
      isCancelled = true;
      if (foregroundSub) {
        foregroundSub.remove();
      }
      if (appStateSub) {
        appStateSub.remove();
      }
      TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).then(isRegistered => {
        if (isRegistered) {
          Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
        }
      });
    };
  }, []);
};
