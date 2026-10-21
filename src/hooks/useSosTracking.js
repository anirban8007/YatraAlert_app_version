import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import { sendSos, supabase } from '../utils/api';

/**
 * Manages the emergency SOS lifecycle:
 * - Checks location permissions and acquires live GPS coordinates
 * - Dispatches emergency alert to Supabase and notified guardians/contacts
 * - Emits updated coordinates every 60 seconds until manually stopped
 * - Visibly handles location, permission, database, and network errors
 */
export function useSosTracking() {
  const { currentLat, currentLng, userProfile } = useApp();
  const { userId } = useRole();
  const [isSosActive, setIsSosActive] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [sosError, setSosError] = useState(null);
  const intervalRef = useRef(null);
  const latestCoordsRef = useRef({ lat: currentLat, lng: currentLng });

  // Keep latest coordinates reference updated
  latestCoordsRef.current = { lat: currentLat, lng: currentLng };

  /**
   * Acquires valid latitude and longitude, checking permissions and querying GPS if needed.
   */
  async function acquireCoordinates() {
    try {
      // 1. Verify foreground location permissions
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
        if (reqStatus !== 'granted') {
          const errMsg = 'Location permission is required to send emergency SOS with coordinates.';
          setSosError(errMsg);
          Alert.alert('Location Permission Required', errMsg);
          return null;
        }
      }

      // 2. Use existing active coordinate if available
      if (latestCoordsRef.current.lat && latestCoordsRef.current.lng) {
        return latestCoordsRef.current;
      }

      // 3. Fallback to immediate GPS fix
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
    } catch (e) {
      const errMsg = `GPS error: ${e.message || 'Unable to determine location.'}`;
      setSosError(errMsg);
      Alert.alert('GPS Error', errMsg);
      return null;
    }
  }

  /**
   * Sends the emergency dispatch payload to Supabase and edge functions.
   */
  async function triggerAlert(count) {
    const coords = await acquireCoordinates();
    const effectiveLat = coords?.lat ?? latestCoordsRef.current.lat;
    const effectiveLng = coords?.lng ?? latestCoordsRef.current.lng;

    if (!effectiveLat || !effectiveLng) {
      const errMsg = 'Cannot dispatch SOS: GPS coordinates unavailable.';
      setSosError(errMsg);
      Alert.alert('Location Missing', errMsg);
      return;
    }

    if (!userId) {
      const errMsg = 'User ID missing. Please check authentication.';
      setSosError(errMsg);
      Alert.alert('Auth Error', errMsg);
      return;
    }

    try {
      setSosError(null);
      await sendSos(effectiveLat, effectiveLng, userId);
    } catch (e) {
      const errMsg = e.message || 'Network / server error while dispatching SOS';
      console.warn('Failed to send SOS update:', errMsg);
      setSosError(errMsg);

      // Visibly alert the user on the initial dispatch failure
      if (count === 1) {
        Alert.alert(
          'SOS Dispatch Warning',
          `Could not confirm server transmission: ${errMsg}. We will continue retrying every 60 seconds.`
        );
      }
    }
  }

  /**
   * Starts the emergency SOS sequence.
   */
  async function startSOS() {
    if (isSosActive) return;

    setIsSosActive(true);
    setUpdateCount(1);
    setSosError(null);

    // Send immediate first alert
    await triggerAlert(1);

    // Send updated coordinates every 60 seconds indefinitely until stopSOS() is called
    let count = 1;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      count++;
      setUpdateCount(count);
      await triggerAlert(count);
    }, 60000);
  }

  /**
   * Stops the active SOS tracking and marks alerts resolved in Supabase.
   */
  async function stopSOS(autoStopped = false) {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsSosActive(false);
    setUpdateCount(0);
    setSosError(null);

    try {
      if (userId) {
        await supabase
          .from('sos_alerts')
          .update({ status: 'resolved' })
          .eq('traveler_id', userId)
          .eq('status', 'active');
      }
    } catch (e) {
      console.warn('Failed to resolve SOS status in Supabase:', e);
    }
  }

  return {
    startSOS,
    stopSOS,
    isSosActive,
    updateCount,
    sosError,
    clearSosError: () => setSosError(null),
  };
}