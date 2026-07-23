import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

export default function ShakeAnimation() {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Creates a continuous looping shake animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(1500) // Pause for 1.5 seconds, then repeat
      ])
    ).start();
  }, [shakeAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <Text style={styles.phoneIcon}>📱</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 15 },
  phoneIcon: { fontSize: 50 }
});