import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';

const { ShakeDetectionModule } = NativeModules;
const shakeEmitter = new NativeEventEmitter(ShakeDetectionModule);

export const useShakeDetection = (onTriggerSos) => {
  useEffect(() => {
    ShakeDetectionModule.startShakeListener();

    const subscription = shakeEmitter.addListener('onSosPatternDetected', () => {
      onTriggerSos();
    });

    return () => {
      subscription.remove();
      ShakeDetectionModule.stopShakeListener();
    };
  }, [onTriggerSos]);
};
