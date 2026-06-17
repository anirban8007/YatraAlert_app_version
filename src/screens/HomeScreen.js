import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
import AlarmPanel from '../components/AlarmPanel';
import AlarmOverlay from '../components/AlarmOverlay';

// Context & Hooks
import { useApp } from '../context/AppContext';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { useMotionTracker } from '../hooks/useMotionTracker';
import { useShakeDetection } from '../hooks/useShakeDetection';
import { useSosTracking } from '../hooks/useSosTracking';
import { useRailwayDetection } from '../hooks/useRailwayDetection';

// API & Storage
import * as Network from 'expo-network';
import { getDirections } from '../utils/api';
import { getJSON } from '../utils/storage';

// UI Components
import YatraMap from '../components/MapView';
import SearchBar from '../components/SearchBar';
import SosCountdown from '../components/SosCountdown';
import SosModal from '../components/SosModal';

export default function HomeScreen() {
  useGpsTracking(); // Starts GPS polling

  const { 
    currentLat, currentLng, 
    destLat, setDestLat, 
    destLng, setDestLng, 
    destName, setDestName, 
    routeCoords, setRouteCoords,
    setCurrentDurationMin, currentDurationMin,
    alarmSet, setAlarmSet,
    alarmTriggered, setAlarmTriggered,
    alarmMinutes,
    journeyStarted,
  } = useApp();
  
  const { avgSpeed, isMoving } = useMotionTracker();
  
  // Offline Mode States
  const [isOffline, setIsOffline] = useState(false);

  // Railway Detection
  const { isTrainJourney, dismissTrainJourney } = useRailwayDetection(currentLat, currentLng, isMoving);
  
  // Route UI State
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeTime, setRouteTime] = useState(null);

  // Modals & Overlays
  const [showSosModal, setShowSosModal] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [hasSosContacts, setHasSosContacts] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [showAlarmOverlay, setShowAlarmOverlay] = useState(false);

  // SOS Logic
  const { startSOS, stopSOS, isSosActive, updateCount } = useSosTracking();

  // Bottom Sheet
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['15%', '50%'], []);

  // ── Watch the ETA and Trigger Alarm ──────────────────────────
  useEffect(() => {
    if (alarmSet && !alarmTriggered && currentDurationMin !== null) {
      if (currentDurationMin <= alarmMinutes) {
        setAlarmTriggered(true);   // Mark it triggered so it doesn't fire again
        setShowAlarmOverlay(true); // Show the flashing red screen
      }
    }
  }, [currentDurationMin, alarmSet, alarmTriggered, alarmMinutes]);

  // ── 1. Safe Wake Lock (Prevents Crash) ────────────────────────
  useEffect(() => {
    async function keepAwake() {
      try { await activateKeepAwakeAsync(); } catch (e) {}
    }
    keepAwake();
    return () => {
      async function releaseAwake() {
        try { await deactivateKeepAwakeAsync(); } catch (e) {}
      }
      releaseAwake();
    };
  }, []);

  // ── 2. Check Contacts on Load ─────────────────────────────────
  useEffect(() => {
    checkContacts();
  }, []);

  const checkContacts = async () => {
    const contacts = await getJSON('sosContacts', []);
    setHasSosContacts(contacts.length > 0);
  };

  // ── 3. Shake Detection ────────────────────────────────────────
  useShakeDetection(() => {
    if (hasSosContacts && !isSosActive) setShowCountdown(true);
  });

  // ── 4. Live ETA Refresh & Offline Countdown ──────────────
  useEffect(() => {
    let apiInterval;
    let offlineInterval;
    
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = !(state.isConnected && state.isInternetReachable);
        setIsOffline(offline);
        return offline;
      } catch (e) { return false; }
    };

    if (destLat && destLng && currentLat && currentLng) {
      // API Fetch Loop (Every 60s)
      apiInterval = setInterval(async () => {
        const offline = await checkNetwork();
        if (!offline) {
          try {
            const data = await getDirections(currentLat, currentLng, destLat, destLng);
            if (data.geometry) {
              setRouteDistance(data.distance_km);
              setRouteTime(data.time_str);
              setCurrentDurationMin(data.duration_min);
            }
          } catch (e) {
            console.warn("ETA Refresh skipped", e);
          }
        }
      }, 60000);

      // Offline Countdown Loop (Every 60s)
      offlineInterval = setInterval(() => {
        if (isOffline) {
          setCurrentDurationMin((prev) => {
            if (prev && prev > 1) return prev - 1;
            return prev;
          });
          setRouteTime((prev) => {
             if (!prev) return prev;
             const num = parseInt(prev.split(' ')[0]);
             if (!isNaN(num) && num > 1) return `${num - 1} min (est.)`;
             return prev;
          });
        }
      }, 60000);
    }
    
    return () => {
      clearInterval(apiInterval);
      clearInterval(offlineInterval);
    };
  }, [destLat, destLng, currentLat, currentLng, isOffline]);

  // ── 5. Search Destination Handler ─────────────────────────────
  const handleSelectDestination = async (location) => {
    setDestLat(location.lat);
    setDestLng(location.lng);
    setDestName(location.label);
    
    if (currentLat && currentLng) {
      setIsRouting(true);
      try {
        const data = await getDirections(currentLat, currentLng, location.lat, location.lng);
        if (data.geometry && data.geometry.coordinates) {
          const formattedCoords = data.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
          setRouteCoords(formattedCoords);
          
          // Save distance and time to state!
          setRouteDistance(data.distance_km);
          setRouteTime(data.time_str);
          setCurrentDurationMin(data.duration_min);
        }
      } catch (e) {
        console.error("Routing Error", e);
        alert("Could not fetch route. Try again.");
      }
      setIsRouting(false);
    }
  };

  const clearRoute = () => {
    setDestLat(null); setDestLng(null); setDestName(null); setRouteCoords([]);
    setRouteDistance(null); setRouteTime(null); setCurrentDurationMin(null);
  };

  const handleSosPress = () => {
    if (!hasSosContacts) setShowSosModal(true);
    else startSOS();
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Search Bar - Floats on top */}
      <SearchBar onSelectDestination={handleSelectDestination} />

      {/* Main Map */}
      <YatraMap 
        currentLat={currentLat} currentLng={currentLng} 
        destLat={destLat} destLng={destLng} 
        routeCoords={routeCoords} 
      />

      {/* Top Status Bar (Speed/Location info) */}
      <View style={[styles.statusBar, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <Text style={styles.statusText}>
          {currentLat ? `📍 GPS Active | ${isMoving ? `Moving at ${avgSpeed} km/h` : 'Stationary'}` : '📡 Getting location...'}
        </Text>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>🔴 OFFLINE</Text>
          </View>
        )}
      </View>

      {/* Railway Detection Banner */}
      {isTrainJourney && (
        <View style={styles.trainBanner}>
          <Text style={styles.trainBannerText}>🚆 You may be travelling by train.</Text>
          <TouchableOpacity style={styles.stopSosBtn} onPress={dismissTrainJourney}>
            <Text style={styles.stopSosText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active SOS Banner */}
      {isSosActive && (
        <View style={styles.sosBanner}>
          <Text style={styles.sosBannerText}>🚨 SOS Active — Update #{updateCount} sent</Text>
          <TouchableOpacity style={styles.stopSosBtn} onPress={() => stopSOS(false)}>
            <Text style={styles.stopSosText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Panel (Sliding Bottom Sheet) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {isRouting && <ActivityIndicator size="small" color="#2563EB" style={{ marginBottom: 10 }} />}
          
          {destName && (
            <View style={styles.routeBox}>
              {routeTime && (
                <View style={styles.routeInfoRow}>
                  <Text style={styles.routeTimeText}>{routeTime}</Text>
                  <Text style={styles.routeDistText}>({routeDistance} km)</Text>
                </View>
              )}
              
              <Text style={styles.routeTitle}>Heading to:</Text>
              <Text style={styles.routeDest} numberOfLines={1}>{destName}</Text>
              <TouchableOpacity onPress={clearRoute}>
                <Text style={styles.clearRouteText}>Clear Route ✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Alarm Panel */}
          <AlarmPanel isMoving={isMoving} journeyStarted={journeyStarted} />

          <TouchableOpacity 
            style={[styles.sosButton, isSosActive && { opacity: 0.5 }]} 
            onPress={handleSosPress}
            disabled={isSosActive}
          >
            <Text style={styles.sosButtonText}>
              {hasSosContacts ? "🆘 SLIDE OR TAP TO SOS" : "⚙️ SETUP EMERGENCY SOS"}
            </Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Overlays */}
      {showCountdown && (
        <SosCountdown 
          onComplete={() => { setShowCountdown(false); startSOS(); }}
          onCancel={() => setShowCountdown(false)}
        />
      )}

      <SosModal 
        visible={showSosModal} 
        onClose={() => setShowSosModal(false)}
        onComplete={() => { checkContacts(); setShowSosModal(false); }}
      />

      {/* Alarm Trigger Overlay */}
      {showAlarmOverlay && (
        <AlarmOverlay 
          destName={destName} 
          alarmMinutes={alarmMinutes} 
          onDismiss={() => {
            setShowAlarmOverlay(false);
            setAlarmSet(false); // Reset the alarm after dismissing
          }} 
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  statusBar: {
    position: 'absolute', top: 110, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 8,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, elevation: 3
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  offlineBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  offlineText: { color: '#DC2626', fontSize: 10, fontWeight: 'bold' },
  trainBanner: {
    position: 'absolute', top: 155, left: 16, right: 16, backgroundColor: '#3B82F6',
    padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, borderRadius: 8
  },
  trainBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  bottomSheetContent: {
    paddingHorizontal: 24, paddingBottom: 24,
    flex: 1,
  },
  routeBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  routeInfoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  routeTimeText: { fontSize: 26, fontWeight: 'bold', color: '#F59E0B' },
  routeDistText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  routeTitle: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  routeDest: { fontSize: 16, color: '#0F172A', fontWeight: '600', marginVertical: 4 },
  clearRouteText: { color: '#EF4444', fontSize: 13, fontWeight: 'bold', marginTop: 8 },
  sosButton: {
    backgroundColor: '#EF4444', paddingVertical: 18, borderRadius: 12, alignItems: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5
  },
  sosButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  sosBanner: {
    position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#EF4444',
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 200
  },
  sosBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  stopSosBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  stopSosText: { color: '#EF4444', fontWeight: 'bold' }
});