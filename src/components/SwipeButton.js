import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS
} from 'react-native-reanimated';

const BUTTON_HEIGHT = 50;
const SWIPEABLE_DIMENSIONS = 44;

export default function SwipeButton({ onSwipeSuccess, text = "Slide to Set" }) {
  const [toggled, setToggled] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const X = useSharedValue(0);

  const handleComplete = () => {
    setToggled(true);
    if (onSwipeSuccess) {
      onSwipeSuccess();
    }
  };

  const H_WAVE_RANGE = Math.max(0, layoutWidth - SWIPEABLE_DIMENSIONS - 6);

  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = X.value;
    })
    .onUpdate((event) => {
      if (toggled || H_WAVE_RANGE === 0) return;
      let newValue = startX.value + event.translationX;
      if (newValue < 0) newValue = 0;
      if (newValue > H_WAVE_RANGE) newValue = H_WAVE_RANGE;
      X.value = newValue;
    })
    .onEnd(() => {
      if (toggled || H_WAVE_RANGE === 0) return;
      if (X.value < H_WAVE_RANGE - 30) {
        X.value = withSpring(0);
      } else {
        X.value = withSpring(H_WAVE_RANGE);
        runOnJS(handleComplete)();
      }
    });

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: X.value }],
    };
  });
  
  const animatedTrackStyles = useAnimatedStyle(() => {
    return {
      width: X.value + SWIPEABLE_DIMENSIONS,
    };
  });

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.track, animatedTrackStyles]} />
      <Text style={styles.text}>{text}</Text>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.swipeable, animatedStyles]}>
          <Text style={styles.arrow}>»</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    backgroundColor: '#E2E8F0',
    borderRadius: BUTTON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    overflow: 'hidden',
    width: '100%'
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#10B981', // Success green
    borderRadius: BUTTON_HEIGHT,
  },
  text: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 16,
    zIndex: 1,
  },
  swipeable: {
    position: 'absolute',
    left: 3,
    width: SWIPEABLE_DIMENSIONS,
    height: SWIPEABLE_DIMENSIONS,
    backgroundColor: '#fff',
    borderRadius: SWIPEABLE_DIMENSIONS,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  arrow: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 28,
  }
});
