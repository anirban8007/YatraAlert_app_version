import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useKalmanFilter } from './useKalmanFilter';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

export function useGpsTracking() {
  const { setCurrentLat, setCurrentLng } = useApp();
  // Use useRef to persist Kalman filters across renders
  const latFilterRef = useRef(null);
  const lngFilterRef = useRef(null);
  const subscription = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // Initialize filters once inside useEffect
    if (!latFilterRef.current) {
      latFilterRef.current = useKalmanFilter();
    }
    if (!lngFilterRef.current) {
      lngFilterRef.current = useKalmanFilter();
    }

    async function startTracking() {
      // 1. Request Foreground
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return;
      }

      // 2. Request Background
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission denied');
        // We can still continue with foreground only
      }

      // 3. Start Background tracking (keeps the app alive when minimized)
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'YatraAlert Active',
            notificationBody: 'Tracking your location to trigger alarm',
            notificationColor: '#EF4444',
          },
          showsBackgroundLocationIndicator: true,
        });
      }

      // 4. Start Foreground polling for immediate UI updates
      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (position) => {
          if (!isMounted) return;
          const smoothLat = latFilterRef.current.filter(position.coords.latitude);
          const smoothLng = lngFilterRef.current.filter(position.coords.longitude);
          setCurrentLat(smoothLat);
          setCurrentLng(smoothLng);
        }
      );
    }

    startTracking();

    return () => {
      isMounted = false;
      if (subscription.current) {
        subscription.current.remove();
      }
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    };
  }, [setCurrentLat, setCurrentLng]);
}
