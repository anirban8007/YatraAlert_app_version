import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/api';
import { useRole } from '../context/RoleContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useGuardianRealtime() {
  const { userId } = useRole();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [pairedTravelers, setPairedTravelers] = useState([]);

  useEffect(() => {

    let subscription;

    const setupRealtime = async () => {
      // Get all travelers paired to this guardian
      const { data: pairings, error } = await supabase
        .from('guardian_pairings')
        .select('traveler_id')
        .eq('guardian_id', userId)
        .eq('status', 'active');

      if (error || !pairings) return;
      
      const travelerIds = pairings.map(p => p.traveler_id);
      setPairedTravelers(travelerIds);

      if (travelerIds.length === 0) return;

      // Subscribe to sos_alerts for those travelers
      subscription = supabase
        .channel('public:sos_alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sos_alerts',
          },
          (payload) => {
            const { new: newAlert } = payload;
            if (travelerIds.includes(newAlert.traveler_id) && newAlert.status === 'active') {
              // Update state to plot on map
              setActiveAlerts((prev) => {
                const existingIndex = prev.findIndex(a => a.id === newAlert.id);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = newAlert;
                  return updated;
                }
                return [...prev, newAlert];
              });

              // Trigger High Priority Notification
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🚨 SOS ALERT!",
                  body: "A paired traveler has triggered an SOS!",
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.MAX,
                },
                trigger: null, // trigger immediately
              });
            } else if (newAlert.status === 'resolved') {
              setActiveAlerts((prev) => prev.filter(a => a.id !== newAlert.id));
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [userId]);

  return { activeAlerts, pairedTravelers };
}
