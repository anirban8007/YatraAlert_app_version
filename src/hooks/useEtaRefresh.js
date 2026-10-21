import { useEffect, useRef, useState } from 'react';
import * as Network from 'expo-network';
import { getDirections } from '../utils/api';
import { useKalmanFilter } from './useKalmanFilter';
import { useMotionTracker } from './useMotionTracker';
import { getJSON, setJSON } from '../utils/storage';

const CACHED_ROUTE_KEY = 'cached_route';

// Haversine straight-line distance (for offline ETA estimation)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useEtaRefresh({
  destLat, destLng,
  currentLat, currentLng,
  setRouteCoords, setRouteDistance, setRouteTime, setCurrentDurationMin,
  isTrainMode = false
}) {
  const [isOffline, setIsOffline] = useState(false);
  const { avgSpeed } = useMotionTracker();

  // ── Refs: always hold latest values without restarting the interval ──
  // FIX Bug #3: Old code had currentLat/currentLng in the dep array,
  // causing the 30-second interval to reset on every GPS tick (every 5s).
  // The interval NEVER had a chance to fire. Refs solve this.
  const latestLoc    = useRef({ lat: currentLat, lng: currentLng });
  const latestDest   = useRef({ lat: destLat,    lng: destLng    });
  const latestSpeed  = useRef(avgSpeed);
  const isTrainRef   = useRef(isTrainMode);

  const latFilter = useKalmanFilter();
  const lngFilter = useKalmanFilter();

  useEffect(() => { latestLoc.current  = { lat: currentLat, lng: currentLng }; }, [currentLat, currentLng]);
  useEffect(() => { latestDest.current = { lat: destLat,    lng: destLng    }; }, [destLat, destLng]);
  useEffect(() => { latestSpeed.current = avgSpeed; }, [avgSpeed]);
  useEffect(() => { isTrainRef.current = isTrainMode; }, [isTrainMode]);

  // ── On destination set: restore cached route if we're already offline ──
  useEffect(() => {
    if (!destLat || !destLng || isTrainMode) return;
    const restoreCached = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!(state.isConnected && state.isInternetReachable)) {
          const cached = await getJSON(CACHED_ROUTE_KEY, null);
          if (cached?.routeCoords?.length > 0) {
            setRouteCoords(cached.routeCoords);
          }
        }
      } catch (_e) { /* silent */ }
    };
    restoreCached();
  }, [destLat, destLng, isTrainMode, setRouteCoords]);

  // ── Main 30-second refresh loop — starts once per destination ──
  useEffect(() => {
    if (!destLat || !destLng || isTrainMode) return;

    const updateInterval = setInterval(async () => {
      if (isTrainRef.current) return; // Managed by useTrainJourney during train mode
      const lat = latestLoc.current.lat;
      const lng = latestLoc.current.lng;
      if (!lat || !lng) return;

      let offline = false;
      try {
        const state = await Network.getNetworkStateAsync();
        offline = !(state.isConnected && state.isInternetReachable);
        setIsOffline(offline);
      } catch (_e) { /* network check failed, assume online */ }

      const smoothLat = latFilter.filter(lat);
      const smoothLng = lngFilter.filter(lng);
      const dLat = latestDest.current.lat;
      const dLng = latestDest.current.lng;

      if (!offline) {
        // ── ONLINE: fetch live route + ETA ──
        try {
          const data = await getDirections(smoothLat, smoothLng, dLat, dLng);
          if (data.geometry?.coordinates) {
            const formattedCoords = data.geometry.coordinates.map(([clng, clat]) => ({
              latitude: clat, longitude: clng,
            }));
            setRouteCoords(formattedCoords);
            // FIX Bug #2: cache updated route for offline use
            await setJSON(CACHED_ROUTE_KEY, { routeCoords: formattedCoords, timestamp: Date.now() });
          }
          setRouteDistance(data.distance_km);
          setRouteTime(data.time_str);
          setCurrentDurationMin(data.duration_min);
        } catch (e) {
          console.warn('ETA Refresh failed (will retry in 30s):', e);
        }
      } else {
        // ── OFFLINE: restore cached polyline + speed-based ETA ──
        try {
          const cached = await getJSON(CACHED_ROUTE_KEY, null);
          if (cached?.routeCoords?.length > 0) {
            setRouteCoords(cached.routeCoords);
          }
        } catch (_e) { /* silent */ }

        const remainingKm  = getDistanceKm(smoothLat, smoothLng, dLat, dLng);
        const speed        = latestSpeed.current > 2 ? latestSpeed.current : 30; // 30 km/h fallback
        const estimatedMin = Math.round((remainingKm / speed) * 60);

        setRouteDistance(remainingKm.toFixed(1));
        setCurrentDurationMin(estimatedMin);
        setRouteTime(
          estimatedMin >= 60
            ? `${Math.floor(estimatedMin / 60)}h ${estimatedMin % 60}min`
            : `${estimatedMin} min`
        );
      }
    }, 30000);

    return () => clearInterval(updateInterval);
  }, [destLat, destLng]); // ← Only restarts when destination changes ✓

  return { isOffline };
}
