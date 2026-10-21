import React, { useEffect, useState, useRef } from 'react';
import {
  Animated,
  Text,
  View,
  StyleSheet,
  AccessibilityInfo,
  Platform,
} from 'react-native';

/**
 * Accessible, lightweight animation that demonstrates the exact
 * Left -> Right -> Left SOS shake gesture.
 *
 * - Slowly repeats Left -> Right -> Left movement
 * - Displays active direction indicators & arrows
 * - Automatically respects system reduced-motion preferences with static fallback
 */
export default function ShakeAnimation({ compact = false }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1 = Left, 2 = Right, 3 = Left, 0 = Rest
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  // Check accessibility reduced-motion preference
  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (isMounted) setReduceMotion(enabled);
      }
    );

    return () => {
      isMounted = false;
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, []);

  // Run the Left -> Right -> Left animation loop
  useEffect(() => {
    if (reduceMotion) {
      shakeAnim.setValue(0);
      return;
    }

    let isCancelled = false;

    const runSequence = () => {
      if (isCancelled) return;

      // Reset
      shakeAnim.setValue(0);
      setActiveStep(1); // 1: Move Left

      Animated.sequence([
        // Step 1: Move Left (-38px)
        Animated.timing(shakeAnim, {
          toValue: -38,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.delay(120),

        // Transition to Step 2: Move Right (+38px)
        Animated.timing(shakeAnim, {
          toValue: 38,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.delay(120),

        // Transition to Step 3: Move Left again (-38px)
        Animated.timing(shakeAnim, {
          toValue: -38,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.delay(120),

        // Return to center
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),

        // Pause before looping
        Animated.delay(1300),
      ]).start(({ finished }) => {
        if (finished && !isCancelled) {
          runSequence();
        }
      });
    };

    // Synchronize active step highlight with animation timing
    let timer1, timer2, timer3, timerReset;
    const scheduleStepIndicators = () => {
      if (isCancelled) return;
      setActiveStep(1); // Left (0ms)
      timer2 = setTimeout(() => { if (!isCancelled) setActiveStep(2); }, 500); // Right
      timer3 = setTimeout(() => { if (!isCancelled) setActiveStep(3); }, 1100); // Left
      timerReset = setTimeout(() => {
        if (!isCancelled) {
          setActiveStep(0);
          timer1 = setTimeout(scheduleStepIndicators, 1600);
        }
      }, 1700);
    };

    runSequence();
    scheduleStepIndicators();

    return () => {
      isCancelled = true;
      shakeAnim.stopAnimation();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerReset);
    };
  }, [reduceMotion, shakeAnim]);

  // Static accessible fallback if reduced motion is preferred
  if (reduceMotion) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]} accessibilityRole="image">
        <Text style={styles.accessibleTitle}>📱 SOS Activation Pattern</Text>
        <View style={styles.staticPillContainer}>
          <View style={[styles.stepPill, styles.stepPillActive]}>
            <Text style={styles.stepPillTextActive}>1. ⮜ Left</Text>
          </View>
          <Text style={styles.arrowText}>➔</Text>
          <View style={[styles.stepPill, styles.stepPillActive]}>
            <Text style={styles.stepPillTextActive}>2. Right ⮞</Text>
          </View>
          <Text style={styles.arrowText}>➔</Text>
          <View style={[styles.stepPill, styles.stepPillActive]}>
            <Text style={styles.stepPillTextActive}>3. ⮜ Left</Text>
          </View>
        </View>
        <Text style={styles.accessibleDesc}>
          Shake your phone firmly Left, then Right, then Left within 2 seconds.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.compactContainer]} accessible accessibilityLabel="Emergency SOS Shake Gesture Guide: Move phone Left, Right, then Left">
      {/* Direction indicators */}
      <View style={styles.pillRow}>
        <View style={[styles.stepPill, activeStep === 1 && styles.stepPillActive]}>
          <Text style={[styles.stepPillText, activeStep === 1 && styles.stepPillTextActive]}>
            1. ⮜ Left
          </Text>
        </View>
        <Text style={styles.arrowText}>➔</Text>
        <View style={[styles.stepPill, activeStep === 2 && styles.stepPillActive]}>
          <Text style={[styles.stepPillText, activeStep === 2 && styles.stepPillTextActive]}>
            2. Right ⮞
          </Text>
        </View>
        <Text style={styles.arrowText}>➔</Text>
        <View style={[styles.stepPill, activeStep === 3 && styles.stepPillActive]}>
          <Text style={[styles.stepPillText, activeStep === 3 && styles.stepPillTextActive]}>
            3. ⮜ Left
          </Text>
        </View>
      </View>

      {/* Animation Stage */}
      <View style={styles.stage}>
        <Text style={styles.leftTrackArrow}>⮜</Text>
        <Animated.View style={[styles.phoneWrapper, { transform: [{ translateX: shakeAnim }] }]}>
          <View style={styles.phoneDevice}>
            <View style={styles.screenNotch} />
            <Text style={styles.sosEmoji}>🚨</Text>
            <Text style={styles.deviceLabel}>SOS</Text>
          </View>
        </Animated.View>
        <Text style={styles.rightTrackArrow}>⮞</Text>
      </View>

      {/* Instructional Caption */}
      <Text style={styles.instructionText}>
        Shake firmly: <Text style={styles.highlightText}>Left → Right → Left</Text>
      </Text>
      <Text style={styles.subInstructionText}>
        Complete the 3-stroke pattern within 2 seconds to initiate SOS.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  compactContainer: {
    paddingVertical: 6,
  },
  stage: {
    width: '100%',
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leftTrackArrow: {
    position: 'absolute',
    left: 14,
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  rightTrackArrow: {
    position: 'absolute',
    right: 14,
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  phoneWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneDevice: {
    width: 50,
    height: 72,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  screenNotch: {
    width: 14,
    height: 3,
    backgroundColor: '#334155',
    borderRadius: 2,
    position: 'absolute',
    top: 3,
  },
  sosEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  deviceLabel: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stepPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  stepPillActive: {
    backgroundColor: '#2563EB',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  stepPillTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrowText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 4,
  },
  highlightText: {
    color: '#2563EB',
  },
  subInstructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  accessibleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  staticPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 10,
  },
  accessibleDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});