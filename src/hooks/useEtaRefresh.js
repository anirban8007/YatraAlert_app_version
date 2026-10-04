import { useEffect, useRef, useState } from 'react';
import * as Network from 'expo-network';
import { getDirections } from '../utils/api';
import { useKalmanFilter } from './useKalmanFilter';
import { useMotionTracker } from './useMotionTracker';

// Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useEtaRefresh({
  destLat, destLng, 
  currentLat, currentLng,
  setRouteCoords, setRouteDistance, setRouteTime, setCurrentDurationMin
}) {
  const [isOffline, setIsOffline] = useState(false);
  const { avgSpeed } = useMotionTracker();
  
  // smoothed coords
  const latFilter = useKalmanFilter();
  const lngFilter = useKalmanFilter();

  useEffect(() => {
    let updateInterval;
    
    if (destLat && destLng && currentLat && currentLng) {
      updateInterval = setInterval(async () => {
        try {
          const state = await Network.getNetworkStateAsync();
          const offline = !(state.isConnected && state.isInternetReachable);
          setIsOffline(offline);

          const smoothLat = latFilter.filter(currentLat);
          const smoothLng = lngFilter.filter(currentLng);

          if (!offline) {
            // Online: Fetch updated ETA from /directions
            const data = await getDirections(smoothLat, smoothLng, destLat, destLng);
            if (data.geometry && data.geometry.coordinates) {
              const formattedCoords = data.geometry.coordinates.map(([clng, clat]) => ({ latitude: clat, longitude: clng }));
              setRouteCoords(formattedCoords);
            }
            setRouteDistance(data.distance_km);
            setRouteTime(data.time_str);
            setCurrentDurationMin(data.duration_min);
          } else {
            // Offline fallback
            const remainingDistKm = getDistanceFromLatLonInKm(smoothLat, smoothLng, destLat, destLng);
            // using avgSpeed from useMotionTracker
            const rollingSpeed = avgSpeed > 0 ? avgSpeed : 30; // fallback if 0
            const currentDurationMin = (remainingDistKm / rollingSpeed) * 60;
            setCurrentDurationMin(Math.round(currentDurationMin));
          }
        } catch (e) {
          console.warn("ETA Refresh error", e);
        }
      }, 30000);
    }
    
    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [destLat, destLng, currentLat, currentLng, avgSpeed, setRouteCoords, setRouteDistance, setRouteTime, setCurrentDurationMin]);

  return { isOffline };
}
