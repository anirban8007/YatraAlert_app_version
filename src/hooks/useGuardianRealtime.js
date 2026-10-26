import { useEffect, useState, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/api';
import { useRole } from '../context/RoleContext';

const SOS_CHANNEL_ID = 'emergency_sos_channel';

// Configure heads-up notification display (banner, sound, badge)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
  }),
});

/**
 * Initializes Android notification channel with MAX priority and vibration
 * and requests permission on Android 13+ (POST_NOTIFICATIONS)
 */
async function initNotificationSystem() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
        name: 'Emergency SOS Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#EF4444',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }
  } catch (err) {
    console.warn('Failed to configure emergency notification channel:', err);
  }
}

/**
 * Dispatches an instant heads-up popup banner notification and hardware vibration
 */
async function triggerEmergencyNotification(alert) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 EMERGENCY SOS ALERT!',
        body: `A paired traveler has triggered an SOS!\nLive GPS: ${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}`,
        sound: true,
        vibrate: [0, 500, 250, 500, 250, 500],
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { alertId: alert.id, lat: alert.latitude, lng: alert.longitude },
      },
      trigger: Platform.OS === 'android' ? { channelId: SOS_CHANNEL_ID } : null,
    });

    // Hardware vibration alert
    Vibration.vibrate([0, 500, 250, 500, 250, 500]);
  } catch (err) {
    console.warn('Error triggering SOS notification popup:', err);
  }
}

export function useGuardianRealtime() {
  const { userId } = useRole();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [pairedTravelers, setPairedTravelers] = useState([]);

  // Set of alert IDs we have already notified the user for (prevents spam on 3s poll)
  const notifiedAlertIdsRef = useRef(new Set());
  // Ref holding all monitored traveler IDs so Realtime callback and polling always have the latest IDs
  const monitoredIdsRef = useRef(new Set());

  const resolveAlert = async (alertId) => {
    try {
      await supabase
        .from('sos_alerts')
        .update({ status: 'resolved' })
        .eq('id', alertId);
      setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
      notifiedAlertIdsRef.current.delete(alertId);
    } catch (e) {
      console.warn('Failed to resolve alert:', e);
    }
  };

  useEffect(() => {
    if (!userId) return;

    let subscription;
    let pollInterval;
    let isMounted = true;

    // Initialize notification system on mount
    initNotificationSystem();

    /**
     * Re-queries guardian pairings AND active SOS alerts.
     * Running this on every poll ensures that as soon as a traveler and guardian pair,
     * the new traveler is IMMEDIATELY detected without requiring app restarts or reopening.
     */
    const syncPairingsAndAlerts = async () => {
      try {
        // 1. Fetch all active pairings where this user is guardian or traveler
        const { data: pairings, error: pErr } = await supabase
          .from('guardian_pairings')
          .select('traveler_id, guardian_id')
          .or(`guardian_id.eq.${userId},traveler_id.eq.${userId}`)
          .eq('status', 'active');

        const ids = new Set();
        // Always include own userId (so self-testing and single-device monitoring works)
        ids.add(userId);

        if (!pErr && pairings) {
          pairings.forEach((p) => {
            if (p.guardian_id === userId && p.traveler_id) ids.add(p.traveler_id);
            if (p.traveler_id === userId && p.guardian_id) ids.add(p.guardian_id);
          });
        }

        const externalTravelers = Array.from(ids).filter((id) => id !== userId);
        if (isMounted) {
          setPairedTravelers(externalTravelers);
        }
        monitoredIdsRef.current = ids;

        // 2. Fetch all active alerts for ANY of the monitored traveler IDs
        const monitoredArray = Array.from(ids);
        if (monitoredArray.length === 0) return;

        const { data: alerts, error: aErr } = await supabase
          .from('sos_alerts')
          .select('*')
          .in('traveler_id', monitoredArray)
          .eq('status', 'active')
          .order('timestamp', { ascending: false });

        if (!aErr && alerts && isMounted) {
          setActiveAlerts(alerts);

          // Check if any alert is new and needs a heads-up notification popup
          alerts.forEach((alert) => {
            if (!notifiedAlertIdsRef.current.has(alert.id)) {
              notifiedAlertIdsRef.current.add(alert.id);
              triggerEmergencyNotification(alert);
            }
          });
        }
      } catch (err) {
        console.warn('Sync pairings and alerts error:', err);
      }
    };

    const setupRealtime = async () => {
      // 1. Initial immediate sync
      await syncPairingsAndAlerts();

      // 2. Continuous 3.5s sync poll (ensures newly paired phones & alerts show up immediately)
      pollInterval = setInterval(() => {
        syncPairingsAndAlerts();
      }, 3500);

      // 3. Supabase Realtime WebSocket subscription for sub-second alert updates
      try {
        subscription = supabase
          .channel('public:sos_alerts_channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'sos_alerts',
            },
            (payload) => {
              const newAlert = payload.new;
              if (!newAlert) return;

              // Check if alert belongs to any of our monitored travelers
              if (monitoredIdsRef.current.has(newAlert.traveler_id) && newAlert.status === 'active') {
                if (isMounted) {
                  setActiveAlerts((prev) => {
                    const existingIndex = prev.findIndex((a) => a.id === newAlert.id);
                    if (existingIndex >= 0) {
                      const updated = [...prev];
                      updated[existingIndex] = newAlert;
                      return updated;
                    }
                    return [newAlert, ...prev];
                  });
                }

                // Trigger popup notification if not already notified
                if (!notifiedAlertIdsRef.current.has(newAlert.id)) {
                  notifiedAlertIdsRef.current.add(newAlert.id);
                  triggerEmergencyNotification(newAlert);
                }
              } else if (newAlert.status === 'resolved') {
                if (isMounted) {
                  setActiveAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
                }
                notifiedAlertIdsRef.current.delete(newAlert.id);
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime subscription error:', e);
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [userId]);

  return { activeAlerts, pairedTravelers, resolveAlert };
}
