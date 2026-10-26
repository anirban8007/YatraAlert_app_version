import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Modal } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
import AlarmPanel from '../components/AlarmPanel';
import AlarmOverlay from '../components/AlarmOverlay';

// Context & Hooks
import { useApp } from '../context/AppContext';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { useEtaRefresh } from '../hooks/useEtaRefresh';
import { downloadRouteTiles } from '../utils/offlineRouting';
import { useMotionTracker } from '../hooks/useMotionTracker';
import { useShakeDetection } from '../hooks/useShakeDetection';
import { useSosTracking } from '../hooks/useSosTracking';
import { useRailwayDetection } from '../hooks/useRailwayDetection';
import { useTrainJourney } from '../hooks/useTrainJourney';

// API & Storage
import { getDirections } from '../utils/api';
import { setJSON } from '../utils/storage';
import { distanceM } from '../utils/haversine';
import { getRouteProgress } from '../utils/routeProgress';

// UI Components
import YatraMap from '../components/MapView';
import SearchBar from '../components/SearchBar';
import SosCountdown from '../components/SosCountdown';
import PairingScreen from './PairingScreen';

export default function HomeScreen() {
  const { 
    currentLat, setCurrentLat,
    currentLng, setCurrentLng,
    destLat, setDestLat, 
    destLng, setDestLng, 
    destName, setDestName, 
    routeCoords, setRouteCoords,
    setCurrentDurationMin, currentDurationMin,
    alarmSet, setAlarmSet,
    alarmTriggered, setAlarmTriggered,
    alarmMinutes,
    hasSpeedExceeded2mps, setHasSpeedExceeded2mps,
  } = useApp();

  const { avgSpeed, isMoving } = useMotionTracker();

  // Mode Selection: 'road' | 'train'
  const [travelMode, setTravelMode] = useState('road');

  // References for route progress tracking and rerouting debouncing
  const lastRerouteTime = useRef(0);
  const lastRerouteLoc = useRef(null);
  const isReroutingRef = useRef(false);

  // References for route stability and ETA calculation (Problem 3)
  const fullRouteCoordsRef = useRef([]);
  const initialDistanceKmRef = useRef(null);
  const initialDurationMinRef = useRef(null);
  const lastProgressSegIdxRef = useRef(0);
  const consecutiveAlarmTriggersRef = useRef(0);

  // GPS Location Updates, Live Blue Path Trimming & Off-Route Recalculation
  useGpsTracking((location) => {
    const lat = location.latitude;
    const lng = location.longitude;
    const speed = location.speed; // m/s from native GPS device

    setCurrentLat(lat);
    setCurrentLng(lng);

    // 1. Initial 2 m/s movement detection for alarm activation
    // 2 m/s = 7.2 km/h
    const currentSpeedKmh = (speed !== null && speed !== undefined && speed >= 0) ? speed * 3.6 : avgSpeed;
    if ((speed !== null && speed !== undefined && speed >= 2.0) || currentSpeedKmh >= 7.2) {
      if (!hasSpeedExceeded2mps) {
        setHasSpeedExceeded2mps(true);
      }
    }

    // 2. Dynamic Route Updating and Off-Route Rerouting (Problem 3: Stable, Smooth ETA)
    const masterRoute = fullRouteCoordsRef.current.length >= 2 ? fullRouteCoordsRef.current : routeCoords;

    if (travelMode === 'road' && destLat && destLng && masterRoute && masterRoute.length >= 2) {
      const progress = getRouteProgress(
        { latitude: lat, longitude: lng },
        masterRoute,
        55,
        lastProgressSegIdxRef.current
      );

      lastProgressSegIdxRef.current = progress.segmentIndex;

      if (progress.isOffRoute) {
        // Traveller has deviated / changed route -> Immediately recalculate!
        const now = Date.now();
        const distFromLastReroute = lastRerouteLoc.current
          ? distanceM(lat, lng, lastRerouteLoc.current.lat, lastRerouteLoc.current.lng)
          : Infinity;

        // Debounce rerouting requests (minimum 4 seconds apart and 25m movement)
        if (now - lastRerouteTime.current > 4000 && distFromLastReroute > 25 && !isReroutingRef.current) {
          lastRerouteTime.current = now;
          lastRerouteLoc.current = { lat, lng };
          isReroutingRef.current = true;
          fetchRoadRoute(destLat, destLng, lat, lng).finally(() => {
            isReroutingRef.current = false;
          });
        }
      } else {
        // Traveller is following the route -> Trim the visual path from current position
        if (progress.trimmedCoords && progress.trimmedCoords.length >= 2) {
          setRouteCoords(progress.trimmedCoords);
        }

        if (progress.remainingDistanceKm) {
          setRouteDistance(progress.remainingDistanceKm);

          // Stable ETA: Scale remaining duration based on remaining route distance vs initial distance
          // Prevents wild fluctuations when vehicle speed temporarily changes
          const initDist = initialDistanceKmRef.current || parseFloat(progress.remainingDistanceKm) || 1;
          const initDur = initialDurationMinRef.current || 30;
          const remDist = parseFloat(progress.remainingDistanceKm);

          const progressRatio = Math.max(0, Math.min(1.2, remDist / initDist));
          const remainingMin = Math.max(1, Math.round(progressRatio * initDur));

          setCurrentDurationMin(remainingMin);
          setRouteTime(
            remainingMin >= 60
              ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}min`
              : `${remainingMin} min`
          );
        }
      }
    }
  });

  // Railway Detection (30-40 km regional scan + proximity warnings)
  const { 
    isTrainJourney, 
    dismissTrainJourney, 
    stationName,
    nearestTrackDistKm,
    proximityWarning,
    dismissProximityWarning,
  } = useRailwayDetection(currentLat, currentLng, isMoving);

  // Route UI State
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeTime, setRouteTime] = useState(null);

  // Multi-Modal Train Journey Hook
  const {
    isTrainMode,
    activeLegIndex,
    legs: trainLegs,
    originStation,
    destStation,
    isCalculating: isTrainCalculating,
    error: trainError,
    startTrainMode,
    clearTrainMode,
    setLeg,
  } = useTrainJourney({
    currentLat,
    currentLng,
    destLat,
    destLng,
    destName,
    avgSpeed,
    isTrainJourneyDetected: isTrainJourney,
    setCurrentDurationMin,
    setRouteDistance,
    setRouteTime,
    setRouteCoords,
  });

  // Modals & Overlays
  const [showCountdown, setShowCountdown] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [showAlarmOverlay, setShowAlarmOverlay] = useState(false);
  const [showPairing, setShowPairing] = useState(false);

  // SOS Logic
  const { startSOS, stopSOS, isSosActive, updateCount, sosError } = useSosTracking();

  // Bottom Sheet
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['15%', '60%'], []);

  // ── Watch the ETA and Distance to Trigger Alarm ──────────────
  useEffect(() => {
    if (alarmSet && !alarmTriggered) {
      // 1. Mandatory requirement: Alarm will not trigger till initial 2 m/s speed is detected
      if (!hasSpeedExceeded2mps) {
        consecutiveAlarmTriggersRef.current = 0;
        return;
      }

      let shouldTrigger = false;

      // Distance sanity check:
      // Verify traveller is physically within reachable distance before triggering alarm.
      // (e.g. 5 min alarm requires user to actually be within ~6 km)
      const straightDistKm = (currentLat && currentLng && destLat && destLng)
        ? distanceM(currentLat, currentLng, destLat, destLng) / 1000
        : null;

      // Generous physical upper bound based on highway speed (75 km/h) + buffer
      const maxPlausibleDistKm = Math.max(1.5, (alarmMinutes / 60) * 75 + 1.0);
      const isWithinPhysicalRange = straightDistKm === null || straightDistKm <= maxPlausibleDistKm;

      // 2. Primary: ETA Duration check (rings x minutes before arrival)
      if (currentDurationMin !== null && currentDurationMin !== undefined) {
        if (currentDurationMin <= alarmMinutes && isWithinPhysicalRange) {
          consecutiveAlarmTriggersRef.current += 1;
          // Require 2 consecutive confirmations to filter single-tick anomalies
          if (consecutiveAlarmTriggersRef.current >= 2) {
            shouldTrigger = true;
          }
        } else {
          consecutiveAlarmTriggersRef.current = 0;
        }
      } else if (currentLat && currentLng && destLat && destLng) {
        // 3. Fail-Safe: Direct GPS Distance check ONLY when ETA Duration is null/unknown (e.g. offline)
        const leadDistKm = (alarmMinutes / 60) * 25; // 25 km/h estimate
        if (straightDistKm <= leadDistKm) {
          consecutiveAlarmTriggersRef.current += 1;
          if (consecutiveAlarmTriggersRef.current >= 2) {
            shouldTrigger = true;
          }
        } else {
          consecutiveAlarmTriggersRef.current = 0;
        }
      }

      if (shouldTrigger) {
        queueMicrotask(() => {
          setAlarmTriggered(true);   // Mark it triggered so it doesn't fire repeatedly
          setShowAlarmOverlay(true); // Show the full-screen alarm & ringtone
        });
      }
    } else {
      consecutiveAlarmTriggersRef.current = 0;
    }
  }, [currentDurationMin, alarmSet, alarmTriggered, alarmMinutes, hasSpeedExceeded2mps, currentLat, currentLng, destLat, destLng, setAlarmTriggered]);

  // ── Safe Wake Lock (Prevents Crash) ────────────────────────
  useEffect(() => {
    async function keepAwake() {
      try { await activateKeepAwakeAsync(); } catch (_e) {}
    }
    keepAwake();
    return () => {
      async function releaseAwake() {
        try { await deactivateKeepAwakeAsync(); } catch (_e) {}
      }
      releaseAwake();
    };
  }, []);

  // ── Shake Detection ────────────────────────────────────────
  useShakeDetection(() => {
    if (!isSosActive && !showCountdown) {
      setShowCountdown(true);
    }
  }, !isSosActive);

  // ── Live ETA Refresh — smart speed-based offline fallback + route caching ──
  const { isOffline } = useEtaRefresh({
    destLat, destLng,
    currentLat, currentLng,
    setRouteCoords, setRouteDistance, setRouteTime, setCurrentDurationMin,
    isTrainMode,
  });

  // ── Fetch Road Route Helper ──────────────────────────────────
  const fetchRoadRoute = useCallback(async (targetLat, targetLng, originLat = null, originLng = null) => {
    const fromLat = originLat ?? currentLat;
    const fromLng = originLng ?? currentLng;
    if (!fromLat || !fromLng || !targetLat || !targetLng) return;
    setIsRouting(true);
    try {
      const data = await getDirections(fromLat, fromLng, targetLat, targetLng);
      if (data.geometry && data.geometry.coordinates) {
        const formattedCoords = data.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        setRouteCoords(formattedCoords);

        fullRouteCoordsRef.current = formattedCoords;
        initialDistanceKmRef.current = parseFloat(data.distance_km) || 1;
        initialDurationMinRef.current = data.duration_min || 1;
        lastProgressSegIdxRef.current = 0;

        setRouteDistance(data.distance_km);
        setRouteTime(data.time_str);
        setCurrentDurationMin(data.duration_min);

        // Cache route coords for offline use
        setJSON('cached_route', { routeCoords: formattedCoords, timestamp: Date.now() });

        // Download map tiles for offline viewing
        try {
          const lats = formattedCoords.map(c => c.latitude);
          const lngs = formattedCoords.map(c => c.longitude);
          downloadRouteTiles(`route_${Date.now()}`, {
            minLat: Math.min(...lats), maxLat: Math.max(...lats),
            minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
          });
        } catch (tileErr) {
          console.warn('Offline tile download failed (non-critical):', tileErr);
        }
      }
    } catch (e) {
      console.error("Routing Error", e);
    }
    setIsRouting(false);
  }, [currentLat, currentLng, setCurrentDurationMin, setRouteCoords]);

  // ── Search Destination Handler ─────────────────────────────
  const handleSelectDestination = async (location) => {
    setHasSpeedExceeded2mps(false); // Reset speed requirement for new search
    setDestLat(location.lat);
    setDestLng(location.lng);
    setDestName(location.label);
    
    if (currentLat && currentLng) {
      if (travelMode === 'train') {
        const success = await startTrainMode({ lat: location.lat, lng: location.lng, name: location.label });
        if (!success) {
          // If train routing failed, fall back to standard road route
          setTravelMode('road');
          await fetchRoadRoute(location.lat, location.lng);
        }
      } else {
        await fetchRoadRoute(location.lat, location.lng);
      }
    }
  };

  // ── Mode Switchers ──────────────────────────────────────────
  const handleSwitchToTrainMode = async () => {
    setTravelMode('train');
    if (destLat && destLng && currentLat && currentLng) {
      const success = await startTrainMode();
      if (!success) {
        setTravelMode('road');
        alert(trainError || 'Train route not available between these locations. Keeping road route.');
      }
    }
  };

  const handleSwitchToRoadMode = async () => {
    setTravelMode('road');
    clearTrainMode();
    if (currentLat && currentLng && destLat && destLng) {
      await fetchRoadRoute(destLat, destLng);
    }
  };

  // ── Auto-fetch route when destination is selected from Stations or Saved tabs ──
  const lastRoutedDest = useRef(null);
  useEffect(() => {
    if (destLat && destLng && currentLat && currentLng) {
      const destKey = `${destLat},${destLng}`;
      if (lastRoutedDest.current !== destKey || !routeCoords || routeCoords.length === 0) {
        lastRoutedDest.current = destKey;
        queueMicrotask(() => {
          if (travelMode === 'train') {
            startTrainMode();
          } else {
            fetchRoadRoute(destLat, destLng);
          }
        });
      }
    }
  }, [destLat, destLng, currentLat, currentLng, routeCoords, travelMode, fetchRoadRoute, startTrainMode]);

  const clearRoute = () => {
    lastRoutedDest.current = null;
    lastRerouteLoc.current = null;
    lastRerouteTime.current = 0;
    fullRouteCoordsRef.current = [];
    initialDistanceKmRef.current = null;
    initialDurationMinRef.current = null;
    lastProgressSegIdxRef.current = 0;
    consecutiveAlarmTriggersRef.current = 0;
    setHasSpeedExceeded2mps(false);
    setDestLat(null); setDestLng(null); setDestName(null); setRouteCoords([]);
    setRouteDistance(null); setRouteTime(null); setCurrentDurationMin(null);
    setAlarmSet(false);
    setAlarmTriggered(false);
    setShowAlarmOverlay(false);
    clearTrainMode();
    setTravelMode('road');
    // Clear stale cached route when user cancels navigation
    setJSON('cached_route', null);
  };

  const handleSosPress = () => {
    startSOS();
  };

  // ── Helper to render time in Indian Tri-colour ────────────────
  const renderTricolorTime = (timeStr) => {
    if (!timeStr) return null;
    const cleanTime = timeStr.replace(/\s*\([^)]*\)/g, '').trim();
    const parts = cleanTime.split(' ').filter(Boolean);

    if (parts.length >= 3) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[styles.routeTimeText, { color: '#FF671F' }]}>{parts[0]} </Text>
          <Text style={[styles.routeTimeText, { color: '#000080' }]}>{parts[1]} </Text>
          <Text style={[styles.routeTimeText, { color: '#16A34A' }]}>{parts.slice(2).join(' ')}</Text>
        </View>
      );
    } else if (parts.length === 2) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[styles.routeTimeText, { color: '#FF671F' }]}>{parts[0]} </Text>
          <Text style={[styles.routeTimeText, { color: '#16A34A' }]}>{parts[1]}</Text>
        </View>
      );
    } else {
      return (
        <Text style={[styles.routeTimeText, { color: '#FF671F' }]}>{cleanTime}</Text>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar - Floats on top */}
      <SearchBar onSelectDestination={handleSelectDestination} />

      {/* Main Map */}
      <YatraMap 
        currentLat={currentLat}
        currentLng={currentLng} 
        destLat={destLat}
        destLng={destLng} 
        routeCoords={routeCoords}
        trainLegs={isTrainMode ? trainLegs : null}
        originStation={originStation}
        destStation={destStation}
        activeLegIndex={activeLegIndex}
      />

      {/* Top Status Bar (Speed/Location info + 30-40km Nearest Railway Tracking) */}
      <View style={[styles.statusBar, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.statusText, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
          {currentLat 
            ? `📍 GPS Active | ${isMoving ? `${avgSpeed} km/h` : 'Stationary'}${nearestTrackDistKm ? ` • 🚆 Track: ${nearestTrackDistKm} km` : ''}` 
            : '📡 Getting location...'}
        </Text>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>🔴 OFFLINE</Text>
          </View>
        )}
      </View>

      {/* Railway Crossing / Track Proximity Warning Banner (<800m) */}
      {proximityWarning && !isTrainJourney && !isTrainMode && (
        <View style={styles.proximityBanner}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.proximityBannerTitle}>⚠️ Railway Crossing / Track Ahead</Text>
            <Text style={styles.proximityBannerSubtitle}>{proximityWarning}</Text>
          </View>
          <TouchableOpacity style={styles.dismissProximityBtn} onPress={dismissProximityWarning}>
            <Text style={styles.dismissProximityText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Railway Detection Banner (On-train travel detected) */}
      {isTrainJourney && !isTrainMode && (
        <View style={styles.trainBanner}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.trainBannerTitle}>🚆 Train Travel Detected</Text>
            <Text style={styles.trainBannerSubtitle}>
              {stationName ? `Near ${stationName}.` : 'You may be travelling by train.'} Switch to Train+Road mode?
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity style={styles.switchTrainBtn} onPress={handleSwitchToTrainMode}>
              <Text style={styles.switchTrainText}>Switch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissTrainBtn} onPress={dismissTrainJourney}>
              <Text style={styles.dismissTrainText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active SOS Banner */}
      {isSosActive && (
        <View style={[styles.sosBanner, sosError && { backgroundColor: '#B91C1C' }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.sosBannerText}>🚨 SOS Active — Update #{updateCount} sent</Text>
            {sosError && (
              <Text style={{ color: '#FEE2E2', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                ⚠️ {sosError}
              </Text>
            )}
          </View>
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
          {(isRouting || isTrainCalculating) && (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginBottom: 10 }} />
          )}

          {/* Mode Switcher Pill */}
          <View style={styles.modeSelectorContainer}>
            <TouchableOpacity
              style={[styles.modePill, travelMode === 'road' && styles.modePillActiveRoad]}
              onPress={handleSwitchToRoadMode}
              activeOpacity={0.8}
            >
              <Text style={[styles.modePillText, travelMode === 'road' && styles.modePillTextActive]}>
                🚗 Road
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modePill, travelMode === 'train' && styles.modePillActiveTrain]}
              onPress={handleSwitchToTrainMode}
              activeOpacity={0.8}
            >
              <Text style={[styles.modePillText, travelMode === 'train' && styles.modePillTextActive]}>
                🚆 Train+Road
              </Text>
            </TouchableOpacity>
          </View>
          
          {destName && (
            <View style={styles.routeBox}>
              {routeTime && (
                <View style={styles.routeInfoContainer}>
                  {renderTricolorTime(routeTime)}
                  <View style={styles.tricolorStripe}>
                    <View style={[styles.stripeSegment, { backgroundColor: '#FF671F' }]} />
                    <View style={[styles.stripeSegment, { backgroundColor: '#000080' }]} />
                    <View style={[styles.stripeSegment, { backgroundColor: '#16A34A' }]} />
                  </View>
                  {routeDistance && (
                    <Text style={styles.routeDistText}>📍 {routeDistance} km total</Text>
                  )}
                </View>
              )}
              
              <Text style={styles.routeTitle}>Heading to:</Text>
              <Text style={styles.routeDest} numberOfLines={1}>{destName}</Text>

              {/* ── Multi-Modal Train Legs Breakdown ── */}
              {isTrainMode && trainLegs && trainLegs.length > 0 && (
                <View style={styles.legsContainer}>
                  <View style={styles.activeLegHeader}>
                    <Text style={styles.activeLegLabel}>MULTI-MODAL TRIP</Text>
                    <Text style={styles.activeLegTitle}>
                      Step {activeLegIndex + 1} of {trainLegs.length}: {trainLegs[activeLegIndex]?.title}
                    </Text>
                  </View>

                  {trainLegs.map((leg, idx) => {
                    const isCompleted = idx < activeLegIndex;
                    const isCurrent = idx === activeLegIndex;
                    const isTrain = leg.type === 'train';

                    return (
                      <TouchableOpacity
                        key={leg.id || idx}
                        style={[
                          styles.legItem,
                          isCurrent && (isTrain ? styles.legItemCurrentTrain : styles.legItemCurrentRoad),
                        ]}
                        onPress={() => setLeg(idx)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.legStepBadge,
                          isCompleted && styles.legBadgeCompleted,
                          isCurrent && (isTrain ? styles.legBadgeCurrentTrain : styles.legBadgeCurrentRoad),
                          idx > activeLegIndex && styles.legBadgeUpcoming,
                        ]}>
                          <Text style={styles.legStepBadgeText}>
                            {isCompleted ? '✓' : isTrain ? '🚆' : '🚗'}
                          </Text>
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text
                              style={[
                                styles.legTitleText,
                                isCurrent && { color: isTrain ? '#EA580C' : '#2563EB', fontWeight: 'bold' },
                              ]}
                              numberOfLines={1}
                            >
                              {leg.title}
                            </Text>
                            <Text style={styles.legTimeText}>{leg.timeStr}</Text>
                          </View>
                          <Text style={styles.legSubtitleText}>
                            {leg.distanceKm} km {isCurrent ? '• Active' : isCompleted ? '• Done' : '• Next'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.clearRouteButton} onPress={clearRoute} activeOpacity={0.7}>
                <Text style={styles.clearRouteButtonText}>✕ Clear Route</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Alarm Panel */}
          <AlarmPanel avgSpeed={avgSpeed} />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.pairButton} onPress={() => setShowPairing(true)}>
              <Text style={styles.pairButtonText}>🔗 Pair Guardian</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sosButton, isSosActive && { opacity: 0.5 }]} 
              onPress={handleSosPress}
              disabled={isSosActive}
            >
              <Text style={styles.sosButtonText}>
                🆘 SOS
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Overlays */}
      {showCountdown && (
        <SosCountdown 
          onComplete={() => { setShowCountdown(false); startSOS(); }}
          onCancel={() => setShowCountdown(false)}
        />
      )}

      {/* Alarm Trigger Overlay */}
      {showAlarmOverlay && (
        <AlarmOverlay 
          destName={destName} 
          alarmMinutes={alarmMinutes} 
          onDismiss={() => {
            setShowAlarmOverlay(false);
            setAlarmSet(false);       // Reset the alarm after dismissing
            setAlarmTriggered(false); // Reset triggered status
          }} 
        />
      )}

      <Modal visible={showPairing} animationType="slide">
        <PairingScreen mode="Traveler" onClose={() => setShowPairing(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  roleSwitcher: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0', zIndex: 10 },
  roleBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  roleBtnText: { color: '#fff', fontWeight: 'bold' },
  statusBar: {
    position: 'absolute', top: 110, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)', padding: 8, borderRadius: 8,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, elevation: 3
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  offlineBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  offlineText: { color: '#DC2626', fontSize: 10, fontWeight: 'bold' },
  
  // Train Banner
  trainBanner: {
    position: 'absolute', top: 155, left: 16, right: 16, backgroundColor: '#1E293B',
    padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 100, borderRadius: 10, borderWidth: 1, borderColor: '#F97316',
    shadowColor: '#000', shadowOpacity: 0.2, elevation: 5
  },
  trainBannerTitle: { color: '#FB923C', fontWeight: 'bold', fontSize: 13 },
  trainBannerSubtitle: { color: '#E2E8F0', fontSize: 11, marginTop: 2 },
  switchTrainBtn: { backgroundColor: '#EA580C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  switchTrainText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  dismissTrainBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 },
  dismissTrainText: { color: '#E2E8F0', fontWeight: 'bold', fontSize: 11 },

  // Railway Track Proximity Banner (<800m)
  proximityBanner: {
    position: 'absolute', top: 155, left: 16, right: 16, backgroundColor: '#78350F',
    padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 95, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B',
    shadowColor: '#000', shadowOpacity: 0.25, elevation: 6
  },
  proximityBannerTitle: { color: '#FDE68A', fontWeight: 'bold', fontSize: 13 },
  proximityBannerSubtitle: { color: '#FEF3C7', fontSize: 11, marginTop: 2 },
  dismissProximityBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 },
  dismissProximityText: { color: '#FEF3C7', fontWeight: 'bold', fontSize: 11 },

  // Bottom Sheet
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  bottomSheetContent: {
    paddingHorizontal: 20, paddingBottom: 24,
    flex: 1,
  },

  // Mode Selector
  modeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActiveRoad: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  modePillActiveTrain: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Route Box
  routeBox: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  routeInfoContainer: { marginBottom: 10 },
  tricolorStripe: { flexDirection: 'row', height: 3, width: 80, borderRadius: 2, overflow: 'hidden', marginTop: 4, marginBottom: 6 },
  stripeSegment: { flex: 1 },
  routeTimeText: { fontSize: 24, fontWeight: 'bold' },
  routeDistText: { fontSize: 14, fontWeight: '600', color: '#64748B', marginTop: 2 },
  routeTitle: { fontSize: 11, color: '#64748B', fontWeight: 'bold' },
  routeDest: { fontSize: 15, color: '#0F172A', fontWeight: '600', marginVertical: 3 },

  // Multi-Modal Legs UI
  legsContainer: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeLegHeader: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activeLegLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F97316',
    letterSpacing: 0.5,
  },
  activeLegTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 2,
  },
  legItemCurrentRoad: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  legItemCurrentTrain: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  legStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  legBadgeCurrentRoad: {
    backgroundColor: '#DBEAFE',
  },
  legBadgeCurrentTrain: {
    backgroundColor: '#FFEDD5',
  },
  legBadgeUpcoming: {
    backgroundColor: '#F1F5F9',
  },
  legStepBadgeText: {
    fontSize: 12,
  },
  legTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  legTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  legSubtitleText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },

  clearRouteButton: {
    marginTop: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearRouteButtonText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  pairButton: {
    backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0'
  },
  pairButtonText: { color: '#475569', fontSize: 15, fontWeight: '700' },
  sosButton: {
    backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5,
    flex: 2
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
