import { NativeModules, TurboModuleRegistry } from 'react-native';

let GoogleSigninModule: any = null;
let isGoogleSigninSupported = false;

// Safely check if the native module 'RNGoogleSignin' exists in the compiled binary
// (TurboModuleRegistry.get returns null safely without throwing Invariant Violation)
const hasNativeGoogleSigninModule = !!(
  NativeModules?.RNGoogleSignin ||
  (TurboModuleRegistry?.get && TurboModuleRegistry.get('RNGoogleSignin'))
);

if (hasNativeGoogleSigninModule) {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSigninModule = GoogleSignin;
    isGoogleSigninSupported = true;
  } catch (error) {
    isGoogleSigninSupported = false;
    GoogleSigninModule = null;
  }
} else {
  // Running in Expo Go or environment without RNGoogleSignin native module compiled into binary
  isGoogleSigninSupported = false;
  GoogleSigninModule = null;
}

export function configureGoogleSignin(webClientId?: string) {
  if (isGoogleSigninSupported && GoogleSigninModule) {
    try {
      GoogleSigninModule.configure({
        webClientId: webClientId || 'YOUR_WEB_CLIENT_ID_FROM_GOOGLE_CLOUD',
      });
    } catch (err) {
      console.warn('Failed to configure GoogleSignin:', err);
    }
  }
}

export function getGoogleSignin() {
  return GoogleSigninModule;
}

export function isGoogleAuthAvailable(): boolean {
  return isGoogleSigninSupported && GoogleSigninModule !== null;
}
