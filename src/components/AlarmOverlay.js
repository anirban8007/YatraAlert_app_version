import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import * as Speech from 'expo-speech';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

export default function AlarmOverlay({ destName, alarmMinutes, onDismiss }) {
  // Load a free public alarm beep provided by Google
  const player = useAudioPlayer('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

  useEffect(() => {
    // 1. Intense Vibration Pattern [wait, vibrate, wait, vibrate...]
    const VIBRATION_PATTERN = [0, 500, 200, 500]; 
    Vibration.vibrate(VIBRATION_PATTERN, true); // 'true' means it will loop forever until dismissed

    // 2. Voice Announcement
    Speech.speak(`Attention! You are arriving at ${destName} in ${alarmMinutes} minutes. Please get ready.`, {
      rate: 0.9,
      pitch: 1.1,
    });

    // 3. Audio Beep
    async function playLoudBeep() {
      try {
        // Set audio to play through the loud phone speaker, ignoring silent mode
        await setAudioModeAsync({
          playsInSilentMode: true,
          staysActiveInBackground: true,
          interruptionMode: 'duckOthers',
        });

        if (player) {
          player.loop = true;
          player.play();
        }
      } catch (error) {
        console.warn("Could not play alarm sound", error);
      }
    }

    playLoudBeep();

    // 4. Cleanup function: stop everything when the user clicks "Dismiss"
    return () => {
      Vibration.cancel();
      Speech.stop();
      if (player) {
        player.pause();
      }
    };
  }, [player]); // Dependency on player

  return (
    <View style={styles.overlay}>
      <View style={styles.alarmBox}>
        <Text style={styles.icon}>🚨</Text>
        <Text style={styles.title}>ALARM</Text>
        <Text style={styles.subtitle}>Approaching your destination!</Text>
        
        <TouchableOpacity 
          style={styles.dismissBtn} 
          onPress={onDismiss}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(231, 76, 60, 0.95)', // Red transparent background
    justifyContent: 'center', alignItems: 'center',
    zIndex: 99999,
  },
  alarmBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  icon: { fontSize: 50, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#E74C3C', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  dismissBtn: {
    backgroundColor: '#E74C3C',
    paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%', alignItems: 'center'
  },
  dismissText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});