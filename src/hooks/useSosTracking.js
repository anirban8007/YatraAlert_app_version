import { useRef, useState } from 'react';
import { getJSON } from '../utils/storage';
import { useApp } from '../context/AppContext';
import { sendSos } from '../utils/api';

// Maps gender to the correct pronoun for Telegram messages
function getPronoun(gender) {
  if (gender === 'male') return 'him';
  if (gender === 'female') return 'her';
  return 'them'; // 'other' or null
}

export function useSosTracking() {
  const { currentLat, currentLng, userProfile } = useApp();
  const [isSosActive, setIsSosActive] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const intervalRef = useRef(null);

  // Build the personalized SOS message using stored name & gender
  function buildSosMessage() {
    const name = userProfile?.name || 'Someone';
    const pronoun = getPronoun(userProfile?.gender);
    return `🚨 ${name} needs help! Please call ${pronoun}.`;
  }

  async function triggerAlert(count) {
    const contacts = await getJSON('sosContacts', []);
    if (contacts.length === 0) return;

    const chatIds = contacts.map(c => c.chat_id);
    const message = buildSosMessage();

    try {
      await sendSos(currentLat, currentLng, chatIds, message, count);
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

    // Send a cancellation message
    const contacts = await getJSON('sosContacts', []);
    if (contacts.length > 0) {
      const chatIds = contacts.map(c => c.chat_id);
      const name = userProfile?.name || 'The user';
      const msg = autoStopped
        ? `✅ SOS tracking ended. ${name} is safe.`
        : `✅ SOS cancelled by ${name}. They are safe now.`;
      try {
        await sendSos(currentLat, currentLng, chatIds, msg, 0);
      } catch(e) {}
    }
  }

  return { startSOS, stopSOS, isSosActive, updateCount };
}