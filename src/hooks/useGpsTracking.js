import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useKalmanFilter } from './useKalmanFilter';

export function useGpsTracking() {
  const { setCurrentLat, setCurrentLng } = useApp();
  const latFilter = useKalmanFilter();
  const lngFilter = useKalmanFilter();
  const subscription = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (position) => {
          if (!isMounted) return;
          const smoothLat = latFilter.filter(position.coords.latitude);
          const smoothLng = lngFilter.filter(position.coords.longitude);
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
    };
  }, []);
}