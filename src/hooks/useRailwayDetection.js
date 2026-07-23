import { useState, useEffect, useRef } from 'react';
import { checkRailways } from '../utils/api';

export function useRailwayDetection(currentLat, currentLng, isMoving) {
  const [isTrainJourney, setIsTrainJourney] = useState(false);
  const consecutiveHits = useRef(0);

  useEffect(() => {
    // Only check if we have a valid location and the user is moving
    if (!currentLat || !currentLng || !isMoving) return;

    // Run the check immediately on first run, then every 30 seconds
    const performCheck = async () => {
      try {
        const result = await checkRailways(currentLat, currentLng, 400); // 400 meters
        
        if (result.found) {
          consecutiveHits.current += 1;
          // If 5 consecutive hits (approx 2.5 minutes), flag as train journey
          if (consecutiveHits.current >= 5 && !isTrainJourney) {
            setIsTrainJourney(true);
          }
        } else {
          // Reset consecutive hits if no tracks are found
          consecutiveHits.current = 0;
        }
      } catch (e) {
        console.warn("Railway detection failed", e);
      }
    };

    performCheck();
    const interval = setInterval(performCheck, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentLat, currentLng, isMoving, isTrainJourney]);

  const dismissTrainJourney = () => {
    setIsTrainJourney(false);
    consecutiveHits.current = 0;
  };

  return { isTrainJourney, dismissTrainJourney };
}
