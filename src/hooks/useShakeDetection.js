import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

export function useShakeDetection(onShakeDetected) {
  const motionPattern = useRef([]);
  const lastMotionTime = useRef(0);
  const triggered = useRef(false);
  const callbackRef = useRef(onShakeDetected);

  // Keep callbackRef up to date without causing useEffect to re-run
  useEffect(() => {
    callbackRef.current = onShakeDetected;
  }, [onShakeDetected]);

  useEffect(() => {
    // Set sensor to check 10 times a second
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Convert g-force to m/s²
      const xMs2 = x * 9.8;
      const yMs2 = y * 9.8;
      const now = Date.now();

      // Ignore minor movements
      if (Math.abs(xMs2) < 13 && Math.abs(yMs2) < 13) return;

      let direction = '';
      if (Math.abs(xMs2) > Math.abs(yMs2)) {
        direction = xMs2 > 0 ? 'RIGHT' : 'LEFT';
      } else {
        direction = yMs2 > 0 ? 'UP' : 'DOWN';
      }

      // Prevent duplicate consecutive directions
      if (motionPattern.current.length > 0 &&
          motionPattern.current[motionPattern.current.length - 1] === direction) {
        return;
      }

      // Reset pattern if too much time has passed since the last shake
      if (now - lastMotionTime.current > 2500) {
        motionPattern.current = [];
      }
      
      lastMotionTime.current = now;
      motionPattern.current.push(direction);
      
      if (motionPattern.current.length > 4) {
        motionPattern.current.shift();
      }

      const pattern = motionPattern.current.join('-');
      
      if ((pattern === 'LEFT-RIGHT-LEFT-RIGHT' || pattern === 'RIGHT-LEFT-RIGHT-LEFT') && !triggered.current) {
        triggered.current = true;
        
        // Trigger the callback passed from the UI
        if (callbackRef.current) {
          callbackRef.current();
        }
        
        motionPattern.current = [];
        
        // 5-second cooldown before it can be triggered again
        setTimeout(() => { 
          triggered.current = false; 
        }, 5000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []); // Empty dependency array ensures listener is only added once
}
