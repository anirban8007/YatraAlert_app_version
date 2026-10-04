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
    if (currentDurationMin) {
      let calcMax = Math.max(5, Math.min(120, currentDurationMin - 5));
      calcMax = Math.max(5, Math.floor(calcMax / 5) * 5);
      const targetMax = calcMax;
      queueMicrotask(() => {
        setMaxAlarm(targetMax);
        if (!alarmSet && alarmMinutes > targetMax) {
          setAlarmMinutes(targetMax);
        }
      });
    }
  }, [currentDurationMin, alarmSet, alarmMinutes, setAlarmMinutes]);

  // Hide entirely if the trip is too short to need an alarm (< 5 mins)
  if (!currentDurationMin || currentDurationMin < 5) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Destination Alarm</Text>

      {!isMoving ? (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingIcon}>🚗💨</Text>
          <Text style={styles.waitingText}>Start moving to enable Destination Alarm</Text>
          <Text style={styles.speedText}>Current speed: {(avgSpeed || 0).toFixed(1)} km/h (Requires ≥ 2.0 km/h)</Text>
        </View>
      ) : !alarmSet ? (
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
            maximumTrackTintColor="#E2E8F0"
          />
          <SwipeButton text="Slide to Set Alarm" onSwipeSuccess={() => setAlarmSet(true)} />
        </>
      ) : (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>✅ Alarm set: {alarmMinutes} mins before arrival</Text>
          <TouchableOpacity onPress={() => setAlarmSet(false)}>
            <Text style={styles.cancelText}>Cancel Alarm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 12 },
  display: { fontSize: 20, fontWeight: 'bold', color: '#2563EB', textAlign: 'center' },
  waitingBox: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  waitingIcon: { fontSize: 24, marginBottom: 4 },
  waitingText: { color: '#334155', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  speedText: { color: '#64748B', fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '500' },
  activeBox: { backgroundColor: '#D1FAE5', padding: 12, borderRadius: 8, alignItems: 'center' },
  activeText: { color: '#065F46', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  cancelText: { color: '#EF4444', fontWeight: 'bold' },
});