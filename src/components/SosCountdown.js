import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import * as Speech from 'expo-speech';

export default function SosCountdown({ onComplete, onCancel }) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    if (seconds === 0) {
      onComplete();
    }
  }, [seconds, onComplete]);

  useEffect(() => {
    // Announce the SOS natively
    Speech.speak('Emergency SOS will be sent in 5 seconds', { rate: 0.9 });

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>🚨 EMERGENCY SOS</Text>
      <Text style={styles.countdown}>{seconds}</Text>
      <Text style={styles.subtitle}>
        Shake detected — sending location to all contacts
      </Text>
      
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => {
          Vibration.vibrate(100);
          Speech.stop();
          onCancel();
        }}
      >
        <Text style={styles.cancelText}>CANCEL SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 18, marginBottom: 12, letterSpacing: 1, fontWeight: 'bold' },
  countdown: { color: '#FFFFFF', fontSize: 100, fontWeight: '900' },
  subtitle: { color: '#CCCCCC', fontSize: 15, marginVertical: 30, textAlign: 'center', paddingHorizontal: 40 },
  cancelBtn: {
    backgroundColor: '#E74C3C', paddingHorizontal: 40, paddingVertical: 18,
    borderRadius: 14,
  },
  cancelText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});