import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useRole } from '../context/RoleContext';
import { sendSos, supabase } from '../utils/api';

export function useSosTracking() {
  const { currentLat, currentLng, userProfile } = useApp();
  const { userId } = useRole();
  const [isSosActive, setIsSosActive] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const intervalRef = useRef(null);

  // Build the personalized SOS message using stored name & gender
  function buildSosMessage() {
    const name = userProfile?.name || 'Someone';
    return `🚨 ${name} needs help!`;
  }

  async function triggerAlert(count) {
    try {
      await sendSos(currentLat, currentLng, userId);
    } catch (e) {
      console.warn("Failed to send SOS:", e);
    }
  }

  async function startSOS() {
    if (isSosActive) return;

    setIsSosActive(true);
    setUpdateCount(1);

    // Send immediate first alert
    await triggerAlert(1);

    // Send every 60 seconds until the user manually taps Stop
    let count = 1;
    intervalRef.current = setInterval(async () => {
      count++;
      setUpdateCount(count);
      await triggerAlert(count);
      // ✅ No auto-stop — runs indefinitely until stopSOS() is called
    }, 60000); // 60,000 ms = 1 minute
  }

  async function stopSOS(autoStopped = false) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsSosActive(false);
    setUpdateCount(0);

    try {
      // Mark active alerts as resolved in Supabase
      await supabase
        .from('sos_alerts')
        .update({ status: 'resolved' })
        .eq('traveler_id', userId)
        .eq('status', 'active');
    } catch (e) {
      console.warn("Failed to resolve SOS:", e);
    }
  }

  return { startSOS, stopSOS, isSosActive, updateCount };
}