# YatraAlert — React Native Conversion Guide

This guide walks through converting YatraAlert from a Flask + vanilla JS web app
into a React Native mobile app, while keeping the Flask backend exactly as is.

---

## Overview — What Changes and What Doesn't

```
STAYS THE SAME (Backend — untouched)
├── app.py                  → Flask routes, all APIs
├── Supabase database       → 1,18,639 railway features
├── MapMyIndia / OSRM        → routing
├── Telegram Bot API         → SOS
└── Render deployment        → backend hosting

REBUILT (Frontend — new React Native app)
├── app.js          → becomes React Native screens + hooks
├── index.html      → becomes React Native components
├── style.css       → becomes StyleSheet objects
└── Leaflet.js map  → becomes react-native-maps
```

**Core principle:** Your Flask backend is just an API now. React Native is a
client that calls the same endpoints (`/check`, `/directions`, `/sos/send`, etc.)

---

## Phase 0 — Prerequisites

Install these before starting:

```bash
# Node.js (v18 or higher)
node -v

# React Native CLI
npm install -g react-native-cli

# Expo CLI (recommended — easier setup)
npm install -g expo-cli

# Android Studio (for Android emulator + SDK)
# Download from: https://developer.android.com/studio

# Java JDK 17
java -version
```

**Recommendation:** Use **Expo** for this project. It handles native module
linking automatically and has excellent support for GPS, sensors, and maps —
all of which YatraAlert needs.

---

## Phase 1 — Project Setup

### Step 1.1 — Create the Expo project

```bash
npx create-expo-app YatraAlertApp
cd YatraAlertApp
```

### Step 1.2 — Install required dependencies

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# Maps
npx expo install react-native-maps

# Location & GPS
npx expo install expo-location

# Sensors (for shake detection)
npx expo install expo-sensors

# Storage (replaces localStorage)
npx expo install @react-native-async-storage/async-storage

# Voice (Text-to-Speech, replaces Web Speech API)
npx expo install expo-speech

# Wake Lock (keep screen on)
npx expo install expo-keep-awake

# Vibration (for SOS countdown)
# Built into React Native — no install needed

# HTTP requests
# fetch() is built into React Native — no install needed

# Icons
npx expo install @expo/vector-icons
```

### Step 1.3 — Project folder structure

```
YatraAlertApp/
├── App.js                      → Navigation root
├── app.json                    → Expo config
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js       → Main map + search
│   │   ├── NavigationScreen.js → Live trip view
│   │   ├── SosSetupScreen.js   → SOS contact setup
│   │   └── SettingsScreen.js   → Dark mode, voice etc
│   ├── components/
│   │   ├── MapView.js
│   │   ├── SearchBar.js
│   │   ├── AlarmPanel.js
│   │   ├── DetectionPanel.js
│   │   ├── SosButton.js
│   │   └── SosModal.js
│   ├── hooks/
│   │   ├── useGpsTracking.js   → replaces watchPosition logic
│   │   ├── useMotionTracker.js → speed/movement detection
│   │   ├── useKalmanFilter.js  → GPS smoothing
│   │   ├── useEtaRefresh.js    → live ETA refresh
│   │   └── useShakeDetection.js→ SOS shake gesture
│   ├── utils/
│   │   ├── haversine.js
│   │   ├── api.js              → all fetch calls to Flask backend
│   │   └── storage.js          → AsyncStorage wrapper
│   ├── context/
│   │   └── AppContext.js       → global state (replaces JS globals)
│   └── styles/
│       ├── colors.js           → your color system
│       └── globalStyles.js
└── package.json
```

---

## Phase 2 — Backend Changes (Minimal)

Your Flask backend needs **almost no changes** — just CORS enabled so the
React Native app (running on a different origin) can call it.

### Step 2.1 — Add CORS to app.py

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow all origins — or restrict to your app's domain
```

```bash
pip install flask-cors --break-system-packages
```

Add to `requirements.txt`:
```
flask-cors==4.0.0
```

### Step 2.2 — Verify your API base URL

Your Render URL stays the same:
```
https://your-app-name.onrender.com
```

React Native will call this exact URL for all API requests.

---

## Phase 3 — Global State (replaces JS global variables)

Your `app.js` uses many `let` variables at the top (`currentLat`, `destLat`,
`alarmSet`, etc.). In React Native, these become **Context + useState**.

### src/context/AppContext.js

```javascript
import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentLat, setCurrentLat] = useState(null);
  const [currentLng, setCurrentLng] = useState(null);
  const [destLat, setDestLat] = useState(null);
  const [destLng, setDestLng] = useState(null);
  const [destName, setDestName] = useState(null);

  const [alarmMinutes, setAlarmMinutes] = useState(10);
  const [alarmSet, setAlarmSet] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [currentDurationMin, setCurrentDurationMin] = useState(null);

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const value = {
    currentLat, setCurrentLat,
    currentLng, setCurrentLng,
    destLat, setDestLat,
    destLng, setDestLng,
    destName, setDestName,
    alarmMinutes, setAlarmMinutes,
    alarmSet, setAlarmSet,
    alarmTriggered, setAlarmTriggered,
    currentDurationMin, setCurrentDurationMin,
    isVoiceEnabled, setIsVoiceEnabled,
    isDarkMode, setIsDarkMode,
    journeyStarted, setJourneyStarted,
    offlineMode, setOfflineMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
```

### App.js — wrap everything

```javascript
import { AppProvider } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <AppProvider>
      <HomeScreen />
    </AppProvider>
  );
}
```

---

## Phase 4 — Haversine Formula (utils/haversine.js)

Direct port — math doesn't change:

```javascript
export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

---

## Phase 5 — Kalman Filter Hook

### src/hooks/useKalmanFilter.js

```javascript
import { useRef } from 'react';

export function useKalmanFilter(processNoise = 0.001, measurementNoise = 0.1) {
  const estimatedValue = useRef(null);
  const errorCovariance = useRef(1);

  function filter(measurement) {
    if (estimatedValue.current === null) {
      estimatedValue.current = measurement;
      return measurement;
    }
    const predicted = estimatedValue.current;
    const predictedError = errorCovariance.current + processNoise;
    const kalmanGain = predictedError / (predictedError + measurementNoise);

    estimatedValue.current = predicted + kalmanGain * (measurement - predicted);
    errorCovariance.current = (1 - kalmanGain) * predictedError;

    return estimatedValue.current;
  }

  return { filter };
}
```

---

## Phase 6 — GPS Tracking (replaces watchPosition)

### src/hooks/useGpsTracking.js

```javascript
import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import { useKalmanFilter } from './useKalmanFilter';

export function useGpsTracking() {
  const { setCurrentLat, setCurrentLng } = useApp();
  const latFilter = useKalmanFilter();
  const lngFilter = useKalmanFilter();
  const subscription = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (position) => {
          const rawLat = position.coords.latitude;
          const rawLng = position.coords.longitude;
          const smoothLat = latFilter.filter(rawLat);
          const smoothLng = lngFilter.filter(rawLng);

          setCurrentLat(smoothLat);
          setCurrentLng(smoothLng);
        }
      );
    })();

    return () => {
      if (subscription.current) subscription.current.remove();
    };
  }, []);
}
```

**Key differences from web:**
- `navigator.geolocation.watchPosition()` → `Location.watchPositionAsync()`
- Permission must be explicitly requested via `expo-location`
- Background location needs `Location.requestBackgroundPermissionsAsync()` (Phase 2)

---

## Phase 7 — Motion Tracker Hook (Speed Calculation)

### src/hooks/useMotionTracker.js

```javascript
import { useRef, useState, useEffect } from 'react';
import { distanceM } from '../utils/haversine';
import { useApp } from '../context/AppContext';

export function useMotionTracker() {
  const { currentLat, currentLng, destLat, destLng, setJourneyStarted, journeyStarted } = useApp();
  const speedWindow = useRef([]);
  const lastPosition = useRef(null);
  const lastPositionTime = useRef(null);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const MAX_WINDOW = 5;
  const MOVING_THRESHOLD = 2;

  useEffect(() => {
    if (!currentLat || !currentLng || !destLat || !destLng) return;

    const now = Date.now();
    if (lastPosition.current === null) {
      lastPosition.current = { lat: currentLat, lng: currentLng };
      lastPositionTime.current = now;
      return;
    }

    const timeDiffSec = (now - lastPositionTime.current) / 1000;
    if (timeDiffSec < 10) return;

    const dist = distanceM(
      lastPosition.current.lat, lastPosition.current.lng,
      currentLat, currentLng
    );
    const speedKmh = (dist / 1000) / (timeDiffSec / 3600);

    speedWindow.current.push(speedKmh);
    if (speedWindow.current.length > MAX_WINDOW) speedWindow.current.shift();

    const total = speedWindow.current.reduce((s, v) => s + v, 0);
    const avg = total / speedWindow.current.length;
    setAvgSpeed(avg);

    const moving = avg > MOVING_THRESHOLD;
    setIsMoving(moving);
    if (moving && !journeyStarted) setJourneyStarted(true);

    lastPosition.current = { lat: currentLat, lng: currentLng };
    lastPositionTime.current = now;
  }, [currentLat, currentLng]);

  function predictETA(remainingDistanceKm) {
    if (avgSpeed < MOVING_THRESHOLD || remainingDistanceKm <= 0) return null;
    return Math.round((remainingDistanceKm / avgSpeed) * 60);
  }

  function reset() {
    speedWindow.current = [];
    lastPosition.current = null;
    lastPositionTime.current = null;
    setAvgSpeed(0);
    setIsMoving(false);
  }

  return { avgSpeed, isMoving, predictETA, reset, samplesCount: speedWindow.current.length };
}
```

---

## Phase 8 — API Calls (utils/api.js)

All your Flask endpoints stay identical — just centralize the calls:

```javascript
const BASE_URL = 'https://your-app-name.onrender.com';

export async function checkRailways(lat, lng) {
  const res = await fetch(`${BASE_URL}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  return res.json();
}

export async function getDirections(origLat, origLng, destLat, destLng) {
  const res = await fetch(`${BASE_URL}/directions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orig_lat: origLat, orig_lng: origLng,
      dest_lat: destLat, dest_lng: destLng,
    }),
  });
  return res.json();
}

export async function getSuggestions(query, lat, lng) {
  let url = `${BASE_URL}/suggestions?q=${encodeURIComponent(query)}`;
  if (lat && lng) url += `&lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
  const res = await fetch(url);
  return res.json();
}

export async function geocode(query) {
  const res = await fetch(`${BASE_URL}/geocode?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function verifySosCode(code) {
  const res = await fetch(`${BASE_URL}/sos/verify?code=${code}`);
  return res.json();
}

export async function sendSos(lat, lng, chatIds, customMessage, updateNumber) {
  const res = await fetch(`${BASE_URL}/sos/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat, lng,
      chat_ids: chatIds,
      custom_message: customMessage,
      update_number: updateNumber,
    }),
  });
  return res.json();
}
```

---

## Phase 9 — AsyncStorage Wrapper (replaces localStorage)

### src/utils/storage.js

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem(key, defaultValue = null) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setItem(key, value) {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function getJSON(key, defaultValue = []) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export async function removeItem(key) {
  await AsyncStorage.removeItem(key);
}
```

**Mapping your localStorage keys:**
```javascript
// Old (web):
localStorage.getItem("sosContacts")

// New (React Native):
await getJSON("sosContacts", [])
```

All keys stay the same: `sosSetupDone`, `sosContacts`, `sosContactCount`,
`sosCustomMessage`, `voiceEnabled`, `darkMode`, `recentDestinations`, etc.

---

## Phase 10 — Map (Leaflet → react-native-maps)

### src/components/MapView.js

```javascript
import React from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet } from 'react-native';

export default function YatraMap({ currentLat, currentLng, destLat, destLng, routeCoords }) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: currentLat || 20.5937,
        longitude: currentLng || 78.9629,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      region={
        currentLat ? {
          latitude: currentLat,
          longitude: currentLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : undefined
      }
    >
      {currentLat && (
        <Marker
          coordinate={{ latitude: currentLat, longitude: currentLng }}
          title="You are here"
          pinColor="#2563EB"
        />
      )}

      {destLat && (
        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          title="Destination"
          pinColor="#EF4444"
        />
      )}

      {routeCoords && routeCoords.length > 0 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor="#2563EB"
          strokeWidth={5}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
```

**Converting GeoJSON route geometry to react-native-maps format:**

```javascript
// Your /directions API returns GeoJSON like:
// { type: "LineString", coordinates: [[lng, lat], [lng, lat], ...] }

function geoJsonToCoords(geometry) {
  return geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));
}
```

**Setup note:** `react-native-maps` uses Google Maps on Android. You'll need
a Google Maps API key in `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

---

## Phase 11 — Search with Autocomplete

### src/components/SearchBar.js

```javascript
import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getSuggestions } from '../utils/api';
import { useApp } from '../context/AppContext';

export default function SearchBar({ onSelectDestination }) {
  const { currentLat, currentLng } = useApp();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const data = await getSuggestions(query, currentLat, currentLng);
      setSuggestions(data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search destination..."
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={suggestions}
        keyExtractor={(item, idx) => idx.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.suggestionItem}
            onPress={() => {
              onSelectDestination(item);
              setQuery(item.label);
              setSuggestions([]);
            }}
          >
            <Text>{item.icon === 'train' ? '🚉' : '📍'} {item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 12, fontSize: 16, backgroundColor: '#FFFFFF',
  },
  suggestionItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
});
```

---

## Phase 12 — Live ETA Refresh Hook

### src/hooks/useEtaRefresh.js

```javascript
import { useEffect, useRef } from 'react';
import { getDirections } from '../utils/api';
import { useApp } from '../context/AppContext';

export function useEtaRefresh() {
  const {
    currentLat, currentLng, destLat, destLng,
    setCurrentDurationMin, offlineMode,
  } = useApp();

  const intervalRef = useRef(null);
  const ETA_REFRESH_MS = 60000;

  useEffect(() => {
    if (!destLat || !destLng) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (!currentLat || !currentLng || offlineMode) return;
      try {
        const data = await getDirections(currentLat, currentLng, destLat, destLng);
        if (!data.error) {
          setCurrentDurationMin(data.duration_min);
          // Trigger UI update + alarm check here
        }
      } catch (e) {
        console.warn('[ETA Refresh] skipped:', e.message);
      }
    }, ETA_REFRESH_MS);

    return () => clearInterval(intervalRef.current);
  }, [destLat, destLng, currentLat, currentLng, offlineMode]);
}
```

---

## Phase 13 — Shake Detection (DeviceMotion → expo-sensors)

### src/hooks/useShakeDetection.js

```javascript
import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import { Vibration } from 'react-native';

export function useShakeDetection(onShakeDetected) {
  const motionPattern = useRef([]);
  const lastMotionTime = useRef(0);
  const triggered = useRef(false);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100); // 10 Hz

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Note: expo-sensors gives values in 'g' units (~1 = 9.8 m/s²)
      // Convert to m/s² to match your threshold
      const xMs2 = x * 9.8;
      const yMs2 = y * 9.8;
      const now = Date.now();

      if (Math.abs(xMs2) < 13 && Math.abs(yMs2) < 13) return;

      let direction = '';
      if (Math.abs(xMs2) > Math.abs(yMs2)) {
        direction = xMs2 > 0 ? 'RIGHT' : 'LEFT';
      } else {
        direction = yMs2 > 0 ? 'UP' : 'DOWN';
      }

      if (motionPattern.current.length > 0 &&
          motionPattern.current[motionPattern.current.length - 1] === direction) {
        return;
      }

      if (now - lastMotionTime.current > 2500) motionPattern.current = [];
      lastMotionTime.current = now;
      motionPattern.current.push(direction);
      if (motionPattern.current.length > 4) motionPattern.current.shift();

      const pattern = motionPattern.current.join('-');
      if ((pattern === 'LEFT-RIGHT-LEFT-RIGHT' || pattern === 'RIGHT-LEFT-RIGHT-LEFT')
          && !triggered.current) {
        triggered.current = true;
        Vibration.vibrate([300, 100, 300]);
        onShakeDetected();
        motionPattern.current = [];
        setTimeout(() => { triggered.current = false; }, 30000); // 30s cooldown
      }
    });

    return () => subscription.remove();
  }, []);
}
```

**Important:** `expo-sensors` Accelerometer returns values in **g-force units**
(1g ≈ 9.8 m/s²), while the web `DeviceMotion` API returns **m/s² directly**.
The conversion `x * 9.8` above handles this — but you should re-test your
13 m/s² threshold on a real device, as sensor calibration varies by phone model.

---

## Phase 14 — SOS Countdown Overlay

### src/components/SosCountdown.js

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import { Vibration } from 'react-native';

export default function SosCountdown({ onComplete, onCancel }) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    Speech.speak('Emergency SOS will be sent in 5 seconds');

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onComplete();
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
          Vibration.vibrate(200);
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
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 16, marginBottom: 12, letterSpacing: 1 },
  countdown: { color: '#fff', fontSize: 80, fontWeight: '900' },
  subtitle: { color: '#ccc', fontSize: 14, marginVertical: 20, textAlign: 'center', paddingHorizontal: 20 },
  cancelBtn: {
    backgroundColor: '#EF4444', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 12,
  },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
```

---

## Phase 15 — Wake Lock (Keep Screen On)

```javascript
import { useKeepAwake } from 'expo-keep-awake';

function NavigationScreen() {
  useKeepAwake(); // Screen stays on while this screen is active
  // ... rest of component
}
```

This replaces the entire `requestWakeLock()` / `navigator.wakeLock` logic —
one line in React Native.

---

## Phase 16 — Voice Alerts (Web Speech → expo-speech)

```javascript
import * as Speech from 'expo-speech';

// Replaces speak() function
export function speak(text, isVoiceEnabled) {
  if (!isVoiceEnabled) return;
  Speech.speak(text, { rate: 0.9, language: 'en-IN' });
}
```

---

## Phase 17 — Color System & Theming

### src/styles/colors.js

```javascript
export const lightTheme = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  primary: '#2563EB',    // Blue — actions
  success: '#10B981',    // Green — safe
  danger: '#EF4444',     // Red — SOS
  warning: '#F59E0B',    // Amber — alerts
  border: '#E2E8F0',
  muted: '#64748B',
};

export const darkTheme = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  primary: '#2563EB',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  border: '#334155',
  muted: '#94A3B8',
};
```

### Usage with theme context

```javascript
import { lightTheme, darkTheme } from '../styles/colors';
import { useApp } from '../context/AppContext';

function MyComponent() {
  const { isDarkMode } = useApp();
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <View style={{ backgroundColor: theme.background }}>
      <Text style={{ color: theme.text }}>Hello</Text>
    </View>
  );
}
```

---

## Phase 18 — SOS Modal (Multi-step Flow)

The 5-step SOS modal (count → contact → message → edit-message → confirm-reset)
becomes a single component with step state:

```javascript
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { verifySosCode } from '../utils/api';
import { setJSON } from '../utils/storage';

export default function SosModal({ visible, onClose, onComplete }) {
  const [step, setStep] = useState('count');
  const [contactCount, setContactCount] = useState(1);
  const [contactIndex, setContactIndex] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('I need help! Please call me immediately.');

  async function handleVerify() {
    if (!name) { setError('Please enter a name'); return; }
    if (!/^\d{5}$/.test(code)) { setError('Enter the 5-digit code'); return; }

    const data = await verifySosCode(code);
    if (data.chat_id) {
      const newContacts = [...contacts, { name, chat_id: String(data.chat_id) }];
      setContacts(newContacts);
      setName(''); setCode(''); setError('');

      if (contactIndex < contactCount - 1) {
        setContactIndex(contactIndex + 1);
      } else {
        setStep('message');
      }
    } else {
      setError(data.error || 'Invalid code');
    }
  }

  async function handleSave() {
    await setJSON('sosContacts', contacts);
    await setJSON('sosContactCount', contactCount);
    await setJSON('sosCustomMessage', message);
    await setJSON('sosSetupDone', true);
    onComplete();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.box}>

          {step === 'count' && (
            <>
              <Text style={styles.title}>🆘 Link Emergency Contacts</Text>
              <Text>How many contacts?</Text>
              {[1, 2, 3].map((n) => (
                <TouchableOpacity key={n} onPress={() => setContactCount(n)}
                  style={[styles.pill, contactCount === n && styles.pillActive]}>
                  <Text>{n}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.btn} onPress={() => setStep('contact')}>
                <Text style={styles.btnText}>Begin Setup →</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'contact' && (
            <>
              <Text style={styles.title}>Contact {contactIndex + 1} of {contactCount}</Text>
              <Text style={styles.instructions}>
                1. Open Telegram{'\n'}
                2. Search @YatraAlertbot{'\n'}
                3. Press Start{'\n'}
                4. Share the 5-digit code
              </Text>
              <TextInput style={styles.input} placeholder="Contact Name"
                value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="5-digit code"
                value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 5))}
                keyboardType="number-pad" maxLength={5} />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.btn} onPress={handleVerify}>
                <Text style={styles.btnText}>
                  {contactIndex === contactCount - 1 ? 'Verify & Finish ✓' : 'Verify & Next →'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'message' && (
            <>
              <Text style={styles.title}>Custom Message</Text>
              {contacts.map((c, i) => (
                <Text key={i} style={styles.chip}>👤 {c.name} ✅</Text>
              ))}
              <TextInput style={[styles.input, { height: 80 }]} multiline
                value={message} onChangeText={setMessage} />
              <View style={styles.shakeGuide}>
                <Text>💡 Tip: Shake LEFT→RIGHT→LEFT→RIGHT to trigger SOS</Text>
              </View>
              <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={handleSave}>
                <Text style={styles.btnText}>Save Contacts ✓</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  pill: { padding: 10, borderRadius: 999, borderWidth: 1, borderColor: '#2563EB', marginVertical: 4, alignItems: 'center' },
  pillActive: { backgroundColor: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginVertical: 8 },
  btn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnSuccess: { backgroundColor: '#10B981' },
  btnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#EF4444', marginTop: 4 },
  chip: { backgroundColor: '#D1FAE5', borderRadius: 999, padding: 8, marginVertical: 4, textAlign: 'center' },
  instructions: { backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  shakeGuide: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
});
```

---

## Phase 19 — Live SOS Tracking (45-second interval)

```javascript
import { useRef } from 'react';
import { sendSos } from '../utils/api';
import { getJSON } from '../utils/storage';
import { useApp } from '../context/AppContext';

export function useSosTracking() {
  const { currentLat, currentLng } = useApp();
  const intervalRef = useRef(null);
  const updateCountRef = useRef(0);

  async function startSOS() {
    const contacts = await getJSON('sosContacts', []);
    const message = await getJSON('sosCustomMessage', 'I need help!');
    const chatIds = contacts.map(c => c.chat_id);

    updateCountRef.current = 1;
    await sendSos(currentLat, currentLng, chatIds, message, updateCountRef.current);

    intervalRef.current = setInterval(async () => {
      updateCountRef.current++;
      await sendSos(currentLat, currentLng, chatIds, message, updateCountRef.current);
      if (updateCountRef.current >= 13) stopSOS(true);
    }, 45000);
  }

  async function stopSOS(autoStopped = false) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const contacts = await getJSON('sosContacts', []);
    const chatIds = contacts.map(c => c.chat_id);
    const msg = autoStopped
      ? '✅ SOS tracking ended automatically after 10 minutes.'
      : '✅ SOS cancelled by user. I am safe now.';
    await sendSos(currentLat, currentLng, chatIds, msg, updateCountRef.current + 1);
  }

  return { startSOS, stopSOS };
}
```

---

## Phase 20 — Testing & Running

### Run on Android emulator

```bash
npx expo start
# Press 'a' to open Android emulator
```

### Run on physical Android device

```bash
npx expo start
# Scan QR code with Expo Go app (install from Play Store)
```

### Test checklist

```
□ GPS location updates correctly
□ Kalman filter smooths coordinates
□ Map shows user marker + destination marker
□ Route line draws correctly
□ Search autocomplete works
□ Railway detection (/check) returns correct data
□ ETA refreshes every 60 seconds
□ Alarm slider works, alarm fires at right time
□ Dark mode toggle works
□ Voice alerts speak correctly
□ SOS button → modal → code verification works
□ Shake gesture (LEFT-RIGHT-LEFT-RIGHT) triggers countdown
□ SOS sends to Telegram successfully
□ Screen stays awake during navigation
□ Offline mode shows estimated ETA
```

---

## Phase 21 — Building the APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Build APK for testing
eas build -p android --profile preview

# Build production AAB for Play Store
eas build -p android --profile production
```

This generates a downloadable `.apk` or `.aab` file — no Android Studio
manual build process needed.

---

## Phase 22 — Permissions (app.json)

```json
{
  "expo": {
    "name": "YatraAlert",
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "VIBRATE",
        "WAKE_LOCK"
      ]
    }
  }
}
```

---

## Migration Checklist — Feature by Feature

| Web Feature | React Native Equivalent | Status |
|---|---|---|
| `navigator.geolocation.watchPosition` | `expo-location` watchPositionAsync | Phase 6 |
| Kalman Filter class | Custom hook (same math) | Phase 5 |
| MotionTracker class | Custom hook (same math) | Phase 7 |
| Leaflet.js map | react-native-maps | Phase 10 |
| localStorage | AsyncStorage | Phase 9 |
| Web Speech API | expo-speech | Phase 16 |
| Wake Lock API | expo-keep-awake | Phase 15 |
| DeviceMotion shake detection | expo-sensors Accelerometer | Phase 13 |
| fetch() to Flask APIs | fetch() (unchanged) | Phase 8 |
| CSS dark mode | Theme context + StyleSheet | Phase 17 |
| SOS multi-step modal | React Modal + step state | Phase 18 |
| 45-sec SOS live tracking | setInterval (unchanged logic) | Phase 19 |
| 60-sec ETA refresh | setInterval (unchanged logic) | Phase 12 |
| Service Worker (PWA) | Not needed — native app | N/A |
| Offline countdown | Same logic, NetInfo for detection | Phase 9 (extend) |

---

## Key Advantages After Conversion

```
✅ Direct SMS access (Phase 2 of YatraAlert roadmap)
   → Replace Telegram with native SmsManager
✅ Background GPS tracking (even when app minimized)
✅ True native performance — no browser overhead
✅ Push notifications for alarms (even app closed)
✅ Access to phone contacts for SOS setup
✅ Play Store distribution
```

---

## Suggested Build Order (Recommended Sequence)

```
Week 1 → Phase 0-9   (setup, context, API, storage, Kalman, Haversine)
Week 2 → Phase 10-12 (map, search, ETA refresh)
Week 3 → Phase 13-19 (shake detection, SOS system, voice, wake lock)
Week 4 → Phase 20-22 (testing, building APK, permissions)
```

---

## Common Pitfalls

```
⚠️ Accelerometer units differ (g vs m/s²) — recalibrate threshold on real device
⚠️ react-native-maps requires Google Maps API key for Android
⚠️ AsyncStorage is asynchronous — every read/write needs await
⚠️ Background location requires separate permission + Android 10+ handling
⚠️ Expo Go app has limitations — some native modules need a dev build
⚠️ CORS must be enabled on Flask backend or all API calls will fail
```

---

## Final Notes

- Your Flask backend, Supabase database, MapMyIndia integration, and Telegram
  Bot remain **completely unchanged**.
- All formulas (Haversine, Kalman, ETA logic, alarm trigger logic) are
  **mathematically identical** — only the surrounding platform code changes.
- This conversion unlocks Phase 2 of your roadmap: native SMS SOS, background
  GPS, and Play Store distribution — directly addressing the offline/no-internet
  limitation discussed in your hackathon presentation.