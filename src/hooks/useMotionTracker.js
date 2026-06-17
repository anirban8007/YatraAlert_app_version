import { useRef, useState, useEffect } from 'react';
import { distanceM } from '../utils/haversine';
import { useApp } from '../context/AppContext';

export function useMotionTracker() {
  const { currentLat, currentLng, destLat, destLng, journeyStarted, setJourneyStarted } = useApp();
  
  const speedWindow = useRef([]);
  const lastPosition = useRef(null);
  const lastPositionTime = useRef(null);
  
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const MAX_WINDOW = 5;
  const MOVING_THRESHOLD = 2; // km/h

  useEffect(() => {
    if (!currentLat || !currentLng || !destLat || !destLng) return;

    const now = Date.now();
    
    // Initialize first point
    if (lastPosition.current === null) {
      lastPosition.current = { lat: currentLat, lng: currentLng };
      lastPositionTime.current = now;
      return;
    }

    const timeDiffSec = (now - lastPositionTime.current) / 1000;
    
    // Only calculate if at least 10 seconds have passed to avoid GPS jitter spikes
    if (timeDiffSec < 10) return;

    const dist = distanceM(
      lastPosition.current.lat, lastPosition.current.lng,
      currentLat, currentLng
    );
    
    const speedKmh = (dist / 1000) / (timeDiffSec / 3600);

    // Update rolling window
    speedWindow.current.push(speedKmh);
    if (speedWindow.current.length > MAX_WINDOW) {
      speedWindow.current.shift();
    }

    const total = speedWindow.current.reduce((sum, val) => sum + val, 0);
    const avg = total / speedWindow.current.length;
    setAvgSpeed(avg);

    const moving = avg > MOVING_THRESHOLD;
    setIsMoving(moving);
    
    if (moving && !journeyStarted) {
      setJourneyStarted(true);
    }

    // Save current for next calculation
    lastPosition.current = { lat: currentLat, lng: currentLng };
    lastPositionTime.current = now;
  }, [currentLat, currentLng]);

  function predictETA(remainingDistanceKm) {
    if (avgSpeed < MOVING_THRESHOLD || remainingDistanceKm <= 0) return null;
    return Math.round((remainingDistanceKm / avgSpeed) * 60);
  }

  function reset() {
    speedWindow.current = [];
    lastPosition.current = null;
    lastPositionTime.current = null;
    setAvgSpeed(0);
    setIsMoving(false);
  }

  return { 
    avgSpeed: Math.round(avgSpeed * 10) / 10, 
    isMoving, 
    predictETA, 
    reset, 
    samplesCount: speedWindow.current.length,
    maxSamples: MAX_WINDOW
  };
}