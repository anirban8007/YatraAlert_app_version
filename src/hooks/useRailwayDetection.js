import { useState, useEffect, useRef } from 'react';
import { checkRailways } from '../utils/api.js';
import { findNearestStation } from '../utils/trainRouting.js';

export function useRailwayDetection(currentLat, currentLng, isMoving) {
  const [isTrainJourney, setIsTrainJourney] = useState(false);
  const [nearestStation, setNearestStation] = useState(null);
  const [nearestTrackDistKm, setNearestTrackDistKm] = useState(null);
  const [isNearTrack, setIsNearTrack] = useState(false);
  const [proximityWarning, setProximityWarning] = useState(null);

  const consecutiveHits = useRef(0);
  const lastRegionalScan = useRef(0);

  useEffect(() => {
    if (!currentLat || !currentLng) return;

    const performCheck = async () => {
      try {
        // ── 1. Immediate Track Detection (400m) ───────────────────────
        // Determines if the user is physically moving on a train
        if (isMoving) {
          const closeResult = await checkRailways(currentLat, currentLng, 400);
          if (closeResult.found) {
            consecutiveHits.current += 1;
            const station = (closeResult.stations && closeResult.stations.length > 0)
              ? closeResult.stations[0]
              : closeResult.closest;
            if (station) {
              queueMicrotask(() => setNearestStation(station));
            }

            // 5 consecutive hits (approx 2.5 minutes) flags as train journey
            if (consecutiveHits.current >= 5 && !isTrainJourney) {
              queueMicrotask(() => setIsTrainJourney(true));
            }
          } else {
            consecutiveHits.current = 0;
          }
        }

        // ── 2. Regional 30-40 km Scan ─────────────────────────────────
        // Finds the nearest railway line/station within a 40 km radius
        const now = Date.now();
        // Check once per minute, or immediately on first location lock
        if (now - lastRegionalScan.current > 60000 || !nearestTrackDistKm) {
          lastRegionalScan.current = now;

          let foundTrack = null;

          // Tier A: Check Supabase PostGIS with 40,000m (40 km) radius
          try {
            const wideResult = await checkRailways(currentLat, currentLng, 40000);
            if (wideResult.found && wideResult.closest) {
              foundTrack = {
                name: wideResult.closest.name || 'Railway Line',
                lat: wideResult.closest.lat,
                lng: wideResult.closest.lng,
                distanceMeters: Math.round(wideResult.closest.distance || 0),
                distanceKm: ((wideResult.closest.distance || 0) / 1000).toFixed(1),
              };
            }
          } catch (_dbErr) {
            // DB fallback handled below
          }

          // Tier B: Fallback to Photon/Nominatim (40 km radius)
          if (!foundTrack) {
            const station = await findNearestStation(currentLat, currentLng, 40);
            if (station) {
              foundTrack = station;
            }
          }

          if (foundTrack) {
            queueMicrotask(() => {
              setNearestStation(foundTrack);
              setNearestTrackDistKm(foundTrack.distanceKm);

              // Proximity alert: approaching within 800m of a railway line or crossing
              if (foundTrack.distanceMeters <= 800 && !isTrainJourney) {
                setIsNearTrack(true);
                setProximityWarning(
                  `Approaching railway line / crossing (${foundTrack.name}, ~${foundTrack.distanceMeters}m away)`
                );
              } else {
                setIsNearTrack(false);
                setProximityWarning(null);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Railway detection check failed:', e);
      }
    };

    performCheck();
    const interval = setInterval(performCheck, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentLat, currentLng, isMoving, isTrainJourney, nearestTrackDistKm]);

  const dismissTrainJourney = () => {
    setIsTrainJourney(false);
    consecutiveHits.current = 0;
  };

  const dismissProximityWarning = () => {
    setProximityWarning(null);
    setIsNearTrack(false);
  };

  return {
    isTrainJourney,
    dismissTrainJourney,
    nearestStation,
    stationName: nearestStation?.name || null,
    nearestTrackDistKm,
    isNearTrack,
    proximityWarning,
    dismissProximityWarning,
  };
}
