import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';

export default function AlarmPanel({ isMoving, journeyStarted }) {
  const { currentDurationMin, alarmMinutes, setAlarmMinutes, alarmSet, setAlarmSet } = useApp();
  const [maxAlarm, setMaxAlarm] = useState(120);

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

  // 🔴 THE FIX: Hide the slider if the user hasn't started moving yet!
  if (!isMoving && !journeyStarted) {
    return (
      <View style={[styles.container, { alignItems: 'center' }]}>
        <Text style={styles.title}>🔔 Destination Alarm</Text>
        <Text style={styles.waitingText}>⏸️ Start moving to set alarm</Text>
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
            <Text style={styles.btnText}>Set Alarm</Text>
          </TouchableOpacity>
          
          {/* Show a warning if they stopped in traffic but haven't set the alarm yet */}
          {!isMoving && journeyStarted && (
             <Text style={styles.pausedText}>⏸️ Temporarily stopped — alarm stays active</Text>
          )}
        </>
      ) : (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>✅ Alarm set for {alarmMinutes} mins before arrival</Text>
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
  waitingText: { color: '#64748B', fontWeight: 'bold', marginTop: 4 },
  btn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  activeBox: { backgroundColor: '#D1FAE5', padding: 12, borderRadius: 8, alignItems: 'center' },
  activeText: { color: '#065F46', fontWeight: 'bold', marginBottom: 8 },
  cancelText: { color: '#EF4444', fontWeight: 'bold' },
  pausedText: { color: '#F59E0B', fontWeight: '600', textAlign: 'center', marginTop: 10, fontSize: 12 }
});