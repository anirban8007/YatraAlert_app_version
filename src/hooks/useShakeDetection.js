import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { ShakeDetectionModule } = NativeModules;
const shakeEmitter = ShakeDetectionModule ? new NativeEventEmitter(ShakeDetectionModule) : null;

/**
 * Custom hook to manage lifecycle for the Left -> Right -> Left shake listener.
 *
 * @param {Function} onTriggerSos Callback invoked when the complete Left -> Right -> Left pattern is recognized.
 * @param {boolean} [enabled=true] When false, listener is stopped and subscriptions removed.
 */
export const useShakeDetection = (onTriggerSos, enabled = true) => {
  const callbackRef = useRef(onTriggerSos);
  callbackRef.current = onTriggerSos;

  useEffect(() => {
    if (!enabled || !ShakeDetectionModule || !shakeEmitter) {
      return;
    }

    // Start native sensor monitoring (calibrates resting gravity and listens at ~10 Hz)
    try {
      ShakeDetectionModule.startShakeListener();
    } catch (e) {
      console.warn('Could not start ShakeDetectionModule:', e);
    }

    const subscription = shakeEmitter.addListener('onSosPatternDetected', () => {
      if (callbackRef.current) {
        callbackRef.current();
      }
    });

    // Clean up native listener and subscription on unmount or when disabled
    return () => {
      try {
        subscription.remove();
      } catch (_e) {}

      try {
        ShakeDetectionModule.stopShakeListener();
      } catch (e) {
        console.warn('Could not stop ShakeDetectionModule:', e);
      }
    };
  }, [enabled]);
};

/**
 * Helper to adjust sensitivity at runtime (e.g., from settings or testing).
 * @param {number} motionThreshold Lateral acceleration threshold in m/s² (default: 3.5)
 * @param {number} timeWindowMs Max duration for sequence in ms (default: 2000)
 * @param {number} cooldownMs Cooldown after trigger in ms (default: 3000)
 */
export const configureShakeDetection = (motionThreshold = 35.0, timeWindowMs = 1500, cooldownMs = 5000) => {
  if (ShakeDetectionModule?.setDetectionConfig) {
    ShakeDetectionModule.setDetectionConfig(motionThreshold, timeWindowMs, cooldownMs);
  }
};
