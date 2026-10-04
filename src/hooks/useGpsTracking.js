import { useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

export const useGpsTracking = (onLocationUpdate) => {
  useEffect(() => {
    let foregroundSub = null;

    const startTracking = async () => {
      // 1. Request foreground permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') return;

      // 2. Request background permissions
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

      // 3. Start high-accuracy foreground tracking (for active UI updates)
      foregroundSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          onLocationUpdate({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: location.coords.speed,
            heading: location.coords.heading,
          });
        }
      );

      // 4. Start background service tracking if allowed
      if (bgStatus === 'granted') {
        try {
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
          console.warn('Could not start background location updates:', error);
        }
      }
    };

    startTracking();

    return () => {
      if (foregroundSub) {
        foregroundSub.remove();
      }
      TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).then(isRegistered => {
        if (isRegistered) {
          Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
        }
      });
    };
  }, [onLocationUpdate]);
};
