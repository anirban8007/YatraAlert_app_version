import { useState, useEffect, useRef, useCallback } from 'react';
import { distanceM } from '../utils/haversine.js';
import { buildTrainRoute, formatDuration } from '../utils/trainRouting.js';

export function useTrainJourney({
  currentLat,
  currentLng,
  destLat,
  destLng,
  destName,
  avgSpeed = 0,
  isTrainJourneyDetected = false,
  setCurrentDurationMin,
  setRouteDistance,
  setRouteTime,
  setRouteCoords,
}) {
  const [isTrainMode, setIsTrainMode] = useState(false);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [legs, setLegs] = useState([]);
  const [originStation, setOriginStation] = useState(null);
  const [destStation, setDestStation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);

  // Store initial route data
  const routeDataRef = useRef(null);

  /**
   * Initializes Train+Road mode with a computed multi-modal route.
   */
  const startTrainMode = useCallback(async (customDest = null) => {
    const targetDestLat = customDest?.lat ?? destLat;
    const targetDestLng = customDest?.lng ?? destLng;
    const targetDestName = customDest?.name ?? destName;

    if (!currentLat || !currentLng || !targetDestLat || !targetDestLng) {
      setError('Please set a valid destination first.');
      return false;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const result = await buildTrainRoute(
        currentLat,
        currentLng,
        targetDestLat,
        targetDestLng,
        targetDestName
      );

      routeDataRef.current = result;
      setLegs(result.legs);
      setOriginStation(result.originStation);
      setDestStation(result.destStation);
      setActiveLegIndex(0);
      setIsTrainMode(true);

      // Update parent states
      if (setCurrentDurationMin) setCurrentDurationMin(result.totalDurationMin);
      if (setRouteDistance) setRouteDistance(result.totalDistanceKm);
      if (setRouteTime) setRouteTime(result.totalTimeStr);
      if (setRouteCoords) setRouteCoords(result.combinedCoords);

      setIsCalculating(false);
      return true;
    } catch (err) {
      console.warn('Failed to build train route:', err);
      setError(err.message || 'Could not find a train route.');
      setIsCalculating(false);
      return false;
    }
  }, [currentLat, currentLng, destLat, destLng, destName, setCurrentDurationMin, setRouteDistance, setRouteTime, setRouteCoords]);

  /**
   * Clears Train+Road mode and resets to normal road routing.
   */
  const clearTrainMode = useCallback(() => {
    setIsTrainMode(false);
    setActiveLegIndex(0);
    setLegs([]);
    setOriginStation(null);
    setDestStation(null);
    setError(null);
    routeDataRef.current = null;
  }, []);

  /**
   * Manually switch active leg (0, 1, or 2)
   */
  const setLeg = useCallback((index) => {
    if (index >= 0 && index < legs.length) {
      setActiveLegIndex(index);
    }
  }, [legs.length]);

  /**
   * Advance to next leg
   */
  const nextLeg = useCallback(() => {
    setActiveLegIndex((prev) => Math.min(prev + 1, legs.length - 1));
  }, [legs.length]);

  // ── Auto-transition between legs based on GPS position ──────────────────
  useEffect(() => {
    if (!isTrainMode || !currentLat || !currentLng || legs.length < 3) return;

    // Leg 0: Road -> Origin Station
    if (activeLegIndex === 0 && originStation) {
      const distToStation = distanceM(currentLat, currentLng, originStation.lat, originStation.lng);
      // Arrived at origin station within 350m or railway detection confirmed on train
      if (distToStation <= 350 || isTrainJourneyDetected) {
        queueMicrotask(() => {
          setActiveLegIndex(1);
        });
      }
    }

    // Leg 1: Train -> Destination Station
    if (activeLegIndex === 1 && destStation) {
      const distToDestStation = distanceM(currentLat, currentLng, destStation.lat, destStation.lng);
      // Arrived at destination station within 450m
      if (distToDestStation <= 450) {
        queueMicrotask(() => {
          setActiveLegIndex(2);
        });
      }
    }
  }, [isTrainMode, currentLat, currentLng, activeLegIndex, originStation, destStation, isTrainJourneyDetected, legs.length]);

  // ── Live Multi-Modal ETA Updates ─────────────────────────────────────────
  useEffect(() => {
    if (!isTrainMode || !currentLat || !currentLng || legs.length < 3) return;

    const route = routeDataRef.current;
    if (!route) return;

    const leg2 = legs[1];
    const leg3 = legs[2];

    let remainingMin = 0;
    let remainingKm = 0;

    if (activeLegIndex === 0 && originStation) {
      // Leg 1 remaining
      const d1M = distanceM(currentLat, currentLng, originStation.lat, originStation.lng);
      const d1Km = d1M / 1000;
      const roadSpeed = Math.max(avgSpeed || 0, 25);
      const d1Min = Math.round((d1Km / roadSpeed) * 60);

      remainingKm = d1Km + parseFloat(leg2.distanceKm || 0) + parseFloat(leg3.distanceKm || 0);
      remainingMin = d1Min + (leg2.durationMin || 0) + (leg3.durationMin || 0);
    } else if (activeLegIndex === 1 && destStation) {
      // Leg 2 remaining (Train)
      const dTrainM = distanceM(currentLat, currentLng, destStation.lat, destStation.lng);
      const dTrainKm = (dTrainM / 1000) * 1.2;
      const trainSpeed = 60; // km/h
      const dTrainMin = Math.max(3, Math.round((dTrainKm / trainSpeed) * 60));

      remainingKm = dTrainKm + parseFloat(leg3.distanceKm || 0);
      remainingMin = dTrainMin + (leg3.durationMin || 0);
    } else if (activeLegIndex === 2 && destLat && destLng) {
      // Leg 3 remaining (Road to final destination)
      const d3M = distanceM(currentLat, currentLng, destLat, destLng);
      const d3Km = d3M / 1000;
      const roadSpeed = Math.max(avgSpeed || 0, 25);
      const d3Min = Math.round((d3Km / roadSpeed) * 60);

      remainingKm = d3Km;
      remainingMin = d3Min;
    }

    if (remainingMin > 0) {
      const timeStr = formatDuration(remainingMin);
      const distStr = remainingKm.toFixed(1);

      if (setCurrentDurationMin) setCurrentDurationMin(remainingMin);
      if (setRouteDistance) setRouteDistance(distStr);
      if (setRouteTime) setRouteTime(timeStr);
    }
  }, [isTrainMode, currentLat, currentLng, activeLegIndex, originStation, destStation, destLat, destLng, avgSpeed, legs, setCurrentDurationMin, setRouteDistance, setRouteTime]);

  return {
    isTrainMode,
    activeLegIndex,
    legs,
    originStation,
    destStation,
    isCalculating,
    error,
    startTrainMode,
    clearTrainMode,
    setLeg,
    nextLeg,
  };
}
