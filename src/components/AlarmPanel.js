import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';

const MOVING_THRESHOLD = 2; // km/h — alarm only available above this speed

export default function AlarmPanel({ avgSpeed }) {
  const { currentDurationMin, alarmMinutes, setAlarmMinutes, alarmSet, setAlarmSet } = useApp();
  const [maxAlarm, setMaxAlarm] = useState(120);

  const isMoving = avgSpeed > MOVING_THRESHOLD;

  // Calculate the max allowable alarm time based on ETA
  useEffect(() => {
    if (currentDurationMin) {
      let calcMax = Math.min(120, currentDurationMin - 20);
      calcMax = Math.max(5, Math.floor(calcMax / 5) * 5);
      setMaxAlarm(calcMax);
      
      // Auto-adjust if current setting is higher than new max
      if (alarmMinutes > calcMax) {
        setAlarmMinutes(calcMax);
      }
    }
  }, [currentDurationMin]);

  // Hide entirely if the trip is too short to need an alarm
  if (!currentDurationMin || currentDurationMin < 25) return null;

  // Show waiting message if user is stationary (speed <= 2 km/h)
  if (!isMoving) {
    return (
      <View style={[styles.container, { alignItems: 'center' }]}>
        <Text style={styles.title}>🔔 Destination Alarm</Text>
        <Text style={styles.waitingText}>⏸️ Move faster than {MOVING_THRESHOLD} km/h to set alarm</Text>
        <Text style={styles.speedText}>Current speed: {avgSpeed.toFixed(1)} km/h</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Destination Alarm</Text>
      
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
            maximumTrackTintColor="#E2E8F0"
          />
          <TouchableOpacity style={styles.btn} onPress={() => setAlarmSet(true)}>
            <Text style={styles.btnText}>Set Alarm ✓</Text>
          </TouchableOpacity>
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
  waitingText: { color: '#64748B', fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  speedText: { color: '#94A3B8', fontSize: 12, marginTop: 4, textAlign: 'center' },
  btn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  activeBox: { backgroundColor: '#D1FAE5', padding: 12, borderRadius: 8, alignItems: 'center' },
  activeText: { color: '#065F46', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  cancelText: { color: '#EF4444', fontWeight: 'bold' },
});