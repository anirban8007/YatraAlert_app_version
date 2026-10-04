import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Color Palette
const COLORS = {
  rose: '#D4537E',   // Centered behind everything
  coral: '#F0997B',  // Top Left
  teal: '#5DCAA5',   // Top Right
  gold: '#F0C060',   // Mid Left
  pink: '#ED93B1',   // Mid Right
  purple: '#7F77DD', // Bottom Left
  green: '#1D9E75',  // Bottom Right
  maroon: '#7a0f3f', // Icon Background
};

interface BlobConfig {
  color: string;
  size: number;
  initialStyle: object;
  duration: number;
  moveX: number;
  moveY: number;
  scaleRange: number;
  easing: any;
}

const BLOBS: BlobConfig[] = [
  // 1. Rose (Centered behind everything)
  {
    color: COLORS.rose,
    size: 220,
    initialStyle: { top: SCREEN_HEIGHT / 2 - 110, left: SCREEN_WIDTH / 2 - 110 },
    duration: 8500,
    moveX: 18,
    moveY: -15,
    scaleRange: 0.15,
    easing: Easing.inOut(Easing.ease),
  },
  // 2. Coral (Top Left)
  {
    color: COLORS.coral,
    size: 200,
    initialStyle: { top: -40, left: -40 },
    duration: 7200,
    moveX: 22,
    moveY: 18,
    scaleRange: 0.12,
    easing: Easing.inOut(Easing.quad),
  },
  // 3. Teal (Top Right)
  {
    color: COLORS.teal,
    size: 190,
    initialStyle: { top: -30, right: -40 },
    duration: 9000,
    moveX: -20,
    moveY: 20,
    scaleRange: 0.14,
    easing: Easing.inOut(Easing.sin),
  },
  // 4. Gold (Mid Left)
  {
    color: COLORS.gold,
    size: 210,
    initialStyle: { top: SCREEN_HEIGHT * 0.35 - 100, left: -50 },
    duration: 6800,
    moveX: 25,
    moveY: -18,
    scaleRange: 0.15,
    easing: Easing.inOut(Easing.ease),
  },
  // 5. Pink (Mid Right)
  {
    color: COLORS.pink,
    size: 195,
    initialStyle: { top: SCREEN_HEIGHT * 0.4 - 100, right: -50 },
    duration: 9800,
    moveX: -22,
    moveY: 22,
    scaleRange: 0.13,
    easing: Easing.inOut(Easing.cubic),
  },
  // 6. Purple (Bottom Left)
  {
    color: COLORS.purple,
    size: 205,
    initialStyle: { bottom: -40, left: -40 },
    duration: 7800,
    moveX: 20,
    moveY: -20,
    scaleRange: 0.14,
    easing: Easing.inOut(Easing.quad),
  },
  // 7. Green (Bottom Right)
  {
    color: COLORS.green,
    size: 215,
    initialStyle: { bottom: -40, right: -40 },
    duration: 8900,
    moveX: -24,
    moveY: -16,
    scaleRange: 0.15,
    easing: Easing.inOut(Easing.sin),
  },
];

// Single Animated Blob Component
function AnimatedBlob({ blob }: { blob: BlobConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: blob.duration, easing: blob.easing }),
      -1,
      true
    );
  }, [blob, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = (progress.value - 0.5) * 2 * blob.moveX;
    const translateY = (progress.value - 0.5) * 2 * blob.moveY;
    const scale = 1 + (progress.value - 0.5) * 2 * blob.scaleRange;

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.blobBase,
        {
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.color,
        },
        blob.initialStyle,
        animatedStyle,
      ]}
    />
  );
}

// Single Floating Dot Component
interface DotConfig {
  color: string;
  size: number;
  position: object;
  duration: number;
}

const DOTS: DotConfig[] = [
  { color: COLORS.teal, size: 10, position: { top: '24%', left: '18%' }, duration: 3200 },
  { color: COLORS.coral, size: 9, position: { top: '28%', right: '20%' }, duration: 3800 },
  { color: COLORS.pink, size: 8, position: { bottom: '26%', left: '22%' }, duration: 3500 },
  { color: COLORS.gold, size: 9, position: { bottom: '22%', right: '18%' }, duration: 4200 },
];

function FloatingDot({ dot }: { dot: DotConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: dot.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [dot, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = (progress.value - 0.5) * 16;
    const opacity = 0.4 + progress.value * 0.6;

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dotBase,
        {
          width: dot.size,
          height: dot.size,
          borderRadius: dot.size / 2,
          backgroundColor: dot.color,
          shadowColor: dot.color,
        },
        dot.position,
        animatedStyle,
      ]}
    />
  );
}

export default function SplashAnimation() {
  return (
    <View style={styles.container}>
      {/* 1. Base Color Field with 7 Overlapping Blobs */}
      <View style={StyleSheet.absoluteFill}>
        {BLOBS.map((blob, index) => (
          <AnimatedBlob key={index} blob={blob} />
        ))}
      </View>

      {/* 2. Heavy Blur Layer for Smooth Liquid Gradient Effect */}
      <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />

      {/* 3. Floating Glowing Dots */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {DOTS.map((dot, index) => (
          <FloatingDot key={index} dot={dot} />
        ))}
      </View>

      {/* 4. Foreground App Branding (Centered) */}
      <View style={styles.brandingContainer}>
        <View style={styles.iconBox}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.appIconImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.appName}>YatraAlart</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blobBase: {
    position: 'absolute',
    opacity: 0.35,
  },
  dotBase: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  brandingContainer: {
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: COLORS.maroon,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7a0f3f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 18,
    overflow: 'hidden',
  },
  appIconImage: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
