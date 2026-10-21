import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import SwipeButton from './SwipeButton';

const MOVING_THRESHOLD = 2.0; // km/h

export default function AlarmPanel({ avgSpeed = 0 }) {
  const { currentDurationMin, alarmMinutes, setAlarmMinutes, alarmSet, setAlarmSet } = useApp();
  const [maxAlarm, setMaxAlarm] = useState(120);

  const isMoving = (avgSpeed || 0) >= MOVING_THRESHOLD;

  // Calculate the max allowable alarm time based on ETA (Total time - 5)
  useEffect(() => {
    if (currentDurationMin && currentDurationMin > 5) {
      let calcMax = Math.max(5, Math.min(120, currentDurationMin - 5));
      calcMax = Math.max(5, Math.floor(calcMax / 5) * 5);
      const targetMax = calcMax;
      queueMicrotask(() => {
        setMaxAlarm(targetMax);
        if (!alarmSet && alarmMinutes > targetMax) {
          setAlarmMinutes(targetMax);
        }
      });
    } else {
      setMaxAlarm(60);
    }
  }, [currentDurationMin, alarmSet, alarmMinutes, setAlarmMinutes]);

  // Hide only if ETA is computed and trip is under 2 minutes (already arrived)
  if (currentDurationMin !== null && currentDurationMin !== undefined && currentDurationMin < 2) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔔 Destination Alarm</Text>
        {!isMoving && (
          <View style={styles.stationaryBadge}>
            <Text style={styles.stationaryBadgeText}>Stationary • Armed</Text>
          </View>
        )}
      </View>

      {!alarmSet ? (
        <>
          <Text style={styles.display}>{alarmMinutes} minutes before arrival</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={5}
            maximumValue={maxAlarm}
            step={5}
            value={alarmMinutes}
            onValueChange={setAlarmMinutes}
            minimumTrackTintColor="#2563EB"
            maximumTrackTintColor="#CBD5E1"
          />
          <SwipeButton text="Slide to Set Alarm" onSwipeSuccess={() => setAlarmSet(true)} />
        </>
      ) : (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>✅ Alarm Active: Alerts {alarmMinutes}m before arrival</Text>
          <Text style={styles.activeSubtext}>
            {isMoving
              ? `Moving at ${(avgSpeed || 0).toFixed(0)} km/h • Monitoring GPS & ETA`
              : 'Waiting for movement • Will ring automatically as you approach'}
          </Text>
          <TouchableOpacity onPress={() => setAlarmSet(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel Alarm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  stationaryBadge: { backgroundColor: '#EEF2F6', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' },
  stationaryBadgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  display: { fontSize: 20, fontWeight: 'bold', color: '#2563EB', textAlign: 'center', marginVertical: 6 },
  activeBox: { backgroundColor: '#ECFDF5', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  activeText: { color: '#065F46', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  activeSubtext: { color: '#047857', fontSize: 12, marginTop: 4, marginBottom: 8, textAlign: 'center' },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: '#DC2626', fontWeight: 'bold', fontSize: 13 },
});