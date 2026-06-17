import { useRef, useState } from 'react';
import { getJSON } from '../utils/storage';
import { useApp } from '../context/AppContext';
import { sendSos } from '../utils/api';

export function useSosTracking() {
  const { currentLat, currentLng } = useApp();
  const [isSosActive, setIsSosActive] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const intervalRef = useRef(null);

  async function triggerAlert(count) {
    const contacts = await getJSON('sosContacts', []);
    if (contacts.length === 0) return;

    // Get all chat IDs from the contacts array
    const chatIds = contacts.map(c => c.chat_id);
    
    const customMessage = await getJSON('sosCustomMessage', '🚨 EMERGENCY! I need help!');

    try {
      await sendSos(currentLat, currentLng, chatIds, customMessage, count);
    } catch (e) {
      console.warn("Failed to send SOS via Edge Function:", e);
    }
  }

  async function startSOS() {
    if (isSosActive) return;

    setIsSosActive(true);
    setUpdateCount(1);

    // Send immediate first alert
    await triggerAlert(1);

    // Start background loop (Sends automatically every 45 seconds to match document.md)
    let count = 1;
    intervalRef.current = setInterval(async () => {
      count++;
      setUpdateCount(count);
      await triggerAlert(count);
      
      // Auto stop after 13 updates (approx 10 minutes) as per document.md Phase 19
      if (count >= 13) {
        stopSOS(true);
      }
    }, 45000); // 45,000 ms = 45 seconds
  }

  async function stopSOS(autoStopped = false) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsSosActive(false);
    setUpdateCount(0);

    // Send a cancellation message
    const contacts = await getJSON('sosContacts', []);
    if (contacts.length > 0) {
      const chatIds = contacts.map(c => c.chat_id);
      const msg = autoStopped
        ? '✅ SOS tracking ended automatically after 10 minutes.'
        : '✅ SOS cancelled by user. I am safe now.';
      try {
        await sendSos(currentLat, currentLng, chatIds, msg, 0);
      } catch(e) {}
    }
  }

  return { startSOS, stopSOS, isSosActive, updateCount };
}