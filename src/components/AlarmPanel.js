import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import SwipeButton from './SwipeButton';

export default function AlarmPanel({ avgSpeed = 0 }) {
  const {
    currentDurationMin,
    alarmMinutes,
    setAlarmMinutes,
    alarmSet,
    setAlarmSet,
    hasSpeedExceeded2mps,
  } = useApp();

  const totalMinutes = currentDurationMin || 0;

  // Compute sensible, smooth min and max limits based on trip duration
  let minAlarm = 1;
  let maxAlarm = 60;

  if (totalMinutes > 0) {
    if (totalMinutes <= 5) {
      minAlarm = 1;
      maxAlarm = Math.max(2, totalMinutes - 1);
    } else if (totalMinutes <= 15) {
      minAlarm = 1;
      // For a 15 min trip, allow user to set alarm anywhere from 1 to 13 minutes
      maxAlarm = Math.max(3, totalMinutes - 2);
    } else if (totalMinutes <= 45) {
      minAlarm = 2;
      // For a 30 min trip, allow range up to 26 minutes
      maxAlarm = Math.max(5, totalMinutes - 4);
    } else {
      minAlarm = 5;
      maxAlarm = Math.min(120, Math.max(10, totalMinutes - 10));
    }
  } else {
    minAlarm = 1;
    maxAlarm = 60;
  }

  // Ensure current alarmMinutes stays cleanly clamped without feedback loops
  useEffect(() => {
    if (!alarmSet) {
      if (alarmMinutes > maxAlarm) {
        setAlarmMinutes(maxAlarm);
      } else if (alarmMinutes < minAlarm) {
        setAlarmMinutes(minAlarm);
      }
    }
  }, [maxAlarm, minAlarm, alarmSet]);

  // Hide only if ETA is computed and trip is under 2 minutes (already arrived)
  if (currentDurationMin !== null && currentDurationMin !== undefined && currentDurationMin < 2) {
    return null;
  }

  const currentValue = Math.max(minAlarm, Math.min(alarmMinutes || 5, maxAlarm));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🔔 Destination Alarm</Text>
        {!hasSpeedExceeded2mps && (
          <View style={styles.stationaryBadge}>
            <Text style={styles.stationaryBadgeText}>Waiting for 2 m/s movement</Text>
          </View>
        )}
      </View>

      {!alarmSet ? (
        <>
          <Text style={styles.display}>{currentValue} minutes before arrival</Text>

          <View style={styles.sliderWrapper}>
            <Slider
              style={styles.slider}
              minimumValue={minAlarm}
              maximumValue={maxAlarm}
              step={1}
              value={currentValue}
              onValueChange={(val) => setAlarmMinutes(Math.round(val))}
              minimumTrackTintColor="#2563EB"
              maximumTrackTintColor="#CBD5E1"
              thumbTintColor="#2563EB"
            />
            <View style={styles.rangeLabelsRow}>
              <Text style={styles.rangeLabel}>{minAlarm}m</Text>
              <Text style={styles.rangeLabel}>{maxAlarm}m</Text>
            </View>
          </View>

          {/* Quick preset selection chips */}
          <View style={styles.presetsRow}>
            {[2, 5, 10, 15].map((preset) => {
              if (preset < minAlarm || preset > maxAlarm) return null;
              const isSelected = currentValue === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                  onPress={() => setAlarmMinutes(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                    {preset} min
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <SwipeButton text="Slide to Set Alarm" onSwipeSuccess={() => setAlarmSet(true)} />
        </>
      ) : (
        <View style={styles.activeBox}>
          <Text style={styles.activeText}>
            {hasSpeedExceeded2mps ? '✅ Alarm Active' : '⏳ Alarm Armed'}: Alerts {currentValue}m before arrival
          </Text>
          <Text style={styles.activeSubtext}>
            {hasSpeedExceeded2mps
              ? `Moving at ${(avgSpeed || 0).toFixed(0)} km/h • Will ring ${currentValue}m before destination`
              : 'Waiting for initial movement (≥ 2 m/s / 7.2 km/h) • Will not ring until journey starts'}
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
  container: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  stationaryBadge: {
    backgroundColor: '#EEF2F6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stationaryBadgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  display: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563EB',
    textAlign: 'center',
    marginVertical: 4,
  },
  sliderWrapper: {
    marginVertical: 6,
    width: '100%',
  },
  slider: {
    width: '100%',
    height: 44,
  },
  rangeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: -4,
  },
  rangeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  activeBox: {
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeText: { color: '#065F46', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  activeSubtext: {
    color: '#047857',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: '#DC2626', fontWeight: 'bold', fontSize: 13 },
});