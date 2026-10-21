import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * Full-screen 5-second countdown overlay triggered by deliberate shake.
 * Speaks voice warning and allows immediate prominent cancellation.
 */
export default function SosCountdown({ onComplete, onCancel }) {
  const [seconds, setSeconds] = useState(5);
  const completedRef = useRef(false);

  useEffect(() => {
    if (seconds === 0 && !completedRef.current) {
      completedRef.current = true;
      Speech.stop();
      onComplete();
    }
  }, [seconds, onComplete]);

  useEffect(() => {
    // Announce the SOS natively with TTS
    Speech.speak('Emergency SOS will be sent in 5 seconds. Tap cancel to abort.', { rate: 0.95 });

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      Speech.stop(); // Always halt speech on cleanup/unmount
    };
  }, []);

  const handleCancel = () => {
    try {
      Vibration.vibrate([0, 80, 50, 80]);
    } catch (_e) {}
    Speech.stop();
    onCancel();
  };

  return (
    <View style={styles.overlay} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.card}>
        <Text style={styles.badge}>⚠️ EMERGENCY TRIGGERED</Text>
        <Text style={styles.title}>Deliberate Shake Detected</Text>
        <Text style={styles.countdown}>{seconds}</Text>
        <Text style={styles.subtitle}>
          Left → Right → Left pattern confirmed.{'\n'}
          Sending live GPS location to paired guardians and contacts in {seconds}s.
        </Text>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          activeOpacity={0.8}
          accessibilityLabel="Cancel SOS emergency alert"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>✕ CANCEL SOS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.92)', zIndex: 99999,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#1E293B',
    borderRadius: 24, padding: 28, alignItems: 'center',
    borderWidth: 2, borderColor: '#EF4444',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 15,
  },
  badge: {
    color: '#EF4444', fontSize: 13, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 8, textTransform: 'uppercase'
  },
  title: {
    color: '#F8FAFC', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16
  },
  countdown: {
    color: '#EF4444', fontSize: 96, fontWeight: '900', marginVertical: 8,
    textShadowColor: 'rgba(239, 68, 68, 0.6)', textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  subtitle: {
    color: '#CBD5E1', fontSize: 15, textAlign: 'center', marginVertical: 18,
    lineHeight: 22, paddingHorizontal: 12,
  },
  cancelBtn: {
    backgroundColor: '#EF4444', width: '100%', paddingVertical: 18,
    borderRadius: 14, alignItems: 'center', marginTop: 8,
  },
  cancelText: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1
  },
});