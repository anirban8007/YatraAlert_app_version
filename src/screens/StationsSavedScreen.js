import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { distanceM } from '../utils/haversine.js';
import { getJSON, setJSON, removeItem } from '../utils/storage.js';

const CACHED_ROUTE_KEY = 'cached_route';
const SAVED_PLACES_KEY = 'saved_favorite_places';

export default function StationsSavedScreen() {
  const router = useRouter();
  const {
    currentLat,
    setCurrentLat,
    currentLng,
    setCurrentLng,
    setDestLat,
    setDestLng,
    setDestName,
    setRouteCoords,
  } = useApp();

  // Sub-tabs: 'stations' | 'saved'
  const [activeTab, setActiveTab] = useState('stations');

  // Stations State
  const [stations, setStations] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10); // default to 10 km

  // Saved / Offline State
  const [cachedRouteInfo, setCachedRouteInfo] = useState(null);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [isAddingPlace, setIsAddingPlace] = useState(false);

  // ── Fetch Nearby Stations (Strict Bounded Railway Search) ────────
  // ── Fetch Nearby Stations (Strict Bounded Railway Search) ────────
  const scanStations = useCallback(async (radius = radiusKm) => {
    setIsScanning(true);
    try {
      // 1. Acquire true satellite GPS location with High accuracy
      let lat = currentLat;
      let lng = currentLng;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Immediately check last known position as baseline
          const lastLoc = await Location.getLastKnownPositionAsync({});
          if (lastLoc?.coords) {
            lat = lastLoc.coords.latitude;
            lng = lastLoc.coords.longitude;
            if (setCurrentLat) setCurrentLat(lat);
            if (setCurrentLng) setCurrentLng(lng);
          }

          // Query fresh high-precision GPS satellites
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
          });
          if (loc?.coords) {
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
            if (setCurrentLat) setCurrentLat(lat);
            if (setCurrentLng) setCurrentLng(lng);
          }
        }
      } catch (locErr) {
        console.warn('High accuracy GPS lock warning, using fallback coords:', locErr);
      }

      if (!lat || !lng) {
        Alert.alert('Location Required', 'Please enable high-accuracy GPS location to scan nearby railway stations.');
        setIsScanning(false);
        return;
      }

      const maxMeters = radius * 1000;
      // 1 deg latitude ~ 111 km. Compute cosine-adjusted deltaLng for accurate longitude bounds
      const deltaLat = Math.max(0.04, radius / 111);
      const radLat = (lat * Math.PI) / 180;
      const cosLat = Math.max(0.2, Math.cos(radLat));
      const deltaLng = Math.max(0.04, radius / (111 * cosLat));
      let foundStations = [];

      // 2. Primary: Nominatim Bounded Railway Search (Strictly railway=station or halt)
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=station&format=json&limit=50&countrycodes=in&viewbox=${(lng - deltaLng).toFixed(5)},${(lat + deltaLat).toFixed(5)},${(lng + deltaLng).toFixed(5)},${(lat - deltaLat).toFixed(5)}&bounded=1`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'YatraAlertApp/1.0' },
        });

        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData)) {
            foundStations = nomData
              .filter((x) => x.class === 'railway' && (x.type === 'station' || x.type === 'halt'))
              .map((x) => {
                const sLat = parseFloat(x.lat);
                const sLng = parseFloat(x.lon);
                const d = distanceM(lat, lng, sLat, sLng);
                const rawName = x.name || x.display_name?.split(',')?.[0]?.trim() || 'Railway Station';
                const parts = (x.display_name || '').split(',');
                const city = parts[parts.length - 3]?.trim() || parts[1]?.trim() || 'Indian Railways';
                const straightKm = (d / 1000).toFixed(1);
                const roadKm = ((d * 1.25) / 1000).toFixed(1);
                const distanceLabel =
                  d < 1000
                    ? `${Math.round(d)} m away (~${Math.round(d * 1.25)} m road)`
                    : `${straightKm} km (est. ~${roadKm} km by road)`;
                return {
                  id: String(x.place_id || Math.random()),
                  name: rawName,
                  city,
                  lat: sLat,
                  lng: sLng,
                  distanceMeters: Math.round(d),
                  distanceKm: straightKm,
                  distanceLabel,
                };
              })
              .filter((s) => s.distanceMeters <= maxMeters);
          }
        }
      } catch (nomErr) {
        console.warn('Nominatim station scan failed:', nomErr);
      }

      // 3. Fallback: Photon API with strict exclusion of post offices, roads, and non-train stations
      if (foundStations.length === 0) {
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=railway+station&limit=30&lat=${lat}&lon=${lng}`;
          const photonRes = await fetch(photonUrl);
          if (photonRes.ok) {
            const pData = await photonRes.json();
            if (pData?.features) {
              foundStations = pData.features
                .filter((f) => {
                  const p = f.properties || {};
                  const name = (p.name || '').toLowerCase();
                  if (
                    p.osm_key === 'highway' ||
                    p.osm_key === 'amenity' ||
                    p.osm_key === 'military' ||
                    p.osm_key === 'tourism' ||
                    p.osm_key === 'leisure' ||
                    name.includes('flyover') ||
                    name.includes('road') ||
                    name.includes('post office') ||
                    name.includes('air force') ||
                    name.includes('bus')
                  ) {
                    return false;
                  }
                  return (
                    p.osm_key === 'railway' ||
                    p.osm_value === 'station' ||
                    p.osm_value === 'halt' ||
                    (p.osm_key === 'landuse' && p.osm_value === 'railway') ||
                    name.includes('station') ||
                    name.includes('junction')
                  );
                })
                .map((f) => {
                  const coords = f.geometry?.coordinates;
                  if (!coords || coords.length < 2) return null;
                  const sLng = coords[0];
                  const sLat = coords[1];
                  const d = distanceM(lat, lng, sLat, sLng);
                  const straightKm = (d / 1000).toFixed(1);
                  const roadKm = ((d * 1.25) / 1000).toFixed(1);
                  const distanceLabel =
                    d < 1000
                      ? `${Math.round(d)} m away (~${Math.round(d * 1.25)} m road)`
                      : `${straightKm} km (est. ~${roadKm} km by road)`;
                  return {
                    id: String(f.properties?.osm_id || Math.random()),
                    name: f.properties?.name || 'Railway Station',
                    city: f.properties?.city || f.properties?.district || 'Indian Railways',
                    lat: sLat,
                    lng: sLng,
                    distanceMeters: Math.round(d),
                    distanceKm: straightKm,
                    distanceLabel,
                  };
                })
                .filter(Boolean)
                .filter((s) => s.distanceMeters <= maxMeters);
            }
          }
        } catch (pErr) {
          console.warn('Photon station scan fallback failed:', pErr);
        }
      }

      // 4. Deduplicate stations by name and sort ascending by true distance
      const seenNames = new Set();
      const uniqueStations = [];
      foundStations.sort((a, b) => a.distanceMeters - b.distanceMeters);

      for (const s of foundStations) {
        const clean = s.name.toLowerCase().trim();
        if (!seenNames.has(clean)) {
          seenNames.add(clean);
          uniqueStations.push(s);
        }
      }

      setStations(uniqueStations);
    } catch (e) {
      console.warn('Scan stations error:', e);
    }
    setIsScanning(false);
  }, [currentLat, currentLng, radiusKm, setCurrentLat, setCurrentLng]);

  // Continuous high-accuracy GPS watcher while on Stations tab
  useEffect(() => {
    if (activeTab !== 'stations') return;

    let sub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: 15,
              timeInterval: 5000,
            },
            (loc) => {
              if (loc?.coords) {
                if (setCurrentLat) setCurrentLat(loc.coords.latitude);
                if (setCurrentLng) setCurrentLng(loc.coords.longitude);
              }
            }
          );
        }
      } catch (err) {
        console.warn('Stations GPS watcher error:', err);
      }
    })();

    return () => {
      if (sub) sub.remove();
    };
  }, [activeTab, setCurrentLat, setCurrentLng]);

  // Auto-refresh nearby stations every 90 seconds
  useEffect(() => {
    if (activeTab === 'stations') {
      queueMicrotask(() => {
        scanStations(radiusKm);
      });

      const intervalId = setInterval(() => {
        scanStations(radiusKm);
      }, 90000);

      return () => clearInterval(intervalId);
    }
  }, [activeTab, radiusKm, scanStations]);

  // Load Saved & Cached Offline Info
  useEffect(() => {
    if (activeTab === 'saved') {
      const loadSaved = async () => {
        try {
          const cached = await getJSON(CACHED_ROUTE_KEY, null);
          setCachedRouteInfo(cached);

          const defaultPlaces = [
            { id: '1', name: 'Home', label: 'My Home Address' },
            { id: '2', name: 'Work / College', label: 'Daily Commute' },
            { id: '3', name: 'Main Railway Station', label: 'Transit Hub' },
          ];
          const storedPlaces = await getJSON(SAVED_PLACES_KEY, defaultPlaces);
          setSavedPlaces(storedPlaces);
        } catch (_e) {
          // silent
        }
      };
      loadSaved();
    }
  }, [activeTab]);

  // Direct Route to Station (clears previous route and switches to Yatra map)
  const handleRouteToStation = (station) => {
    if (setRouteCoords) setRouteCoords([]);
    setDestLat(station.lat);
    setDestLng(station.lng);
    setDestName(station.name);
    // Switch to Yatra navigation tab
    router.replace('/(tabs)/client');
  };

  // Navigate to Saved Place
  const handleNavigatePlace = (item) => {
    if (setRouteCoords) setRouteCoords([]);
    setDestLat(item.lat);
    setDestLng(item.lng);
    setDestName(item.name);
    router.replace('/(tabs)/client');
  };

  // Clear Offline Cached Route
  const handleClearCachedRoute = async () => {
    await removeItem(CACHED_ROUTE_KEY);
    setCachedRouteInfo(null);
    Alert.alert('Success', 'Offline cached route cleared.');
  };

  // Add new saved favorite place
  const handleAddPlace = async () => {
    if (!newPlaceName.trim()) return;
    const newPlace = {
      id: Date.now().toString(),
      name: newPlaceName.trim(),
      label: currentLat && currentLng ? `Saved at ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}` : 'Custom Location',
      lat: currentLat,
      lng: currentLng,
    };
    const updated = [...savedPlaces, newPlace];
    setSavedPlaces(updated);
    await setJSON(SAVED_PLACES_KEY, updated);
    setNewPlaceName('');
    setIsAddingPlace(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stations & Saved</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'stations' ? 'Live Railway Radar' : 'Offline Route Hub & Favorites'}
        </Text>
      </View>

      {/* Segmented Switcher */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={[styles.segmentPill, activeTab === 'stations' && styles.segmentPillActive]}
          onPress={() => setActiveTab('stations')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === 'stations' && styles.segmentTextActive]}>
            🚆 Nearby Stations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentPill, activeTab === 'saved' && styles.segmentPillActive]}
          onPress={() => setActiveTab('saved')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === 'saved' && styles.segmentTextActive]}>
            💾 Saved & Offline
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Sub-Tab 1: Nearby Stations Radar ─────────────────────── */}
      {activeTab === 'stations' && (
        <View style={{ flex: 1 }}>
          {/* Radius Filter Chips */}
          <View style={styles.radiusBar}>
            <Text style={styles.radiusLabel}>Radius:</Text>
            {[10, 25, 40].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]}
                onPress={() => {
                  setRadiusKm(r);
                  scanStations(r);
                }}
              >
                <Text style={[styles.radiusChipText, radiusKm === r && styles.radiusChipTextActive]}>
                  {r} km
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.timerBadge}>
              <Text style={styles.timerBadgeText}>⏱ 90s</Text>
            </View>

            <TouchableOpacity style={styles.refreshBtn} onPress={() => scanStations(radiusKm)}>
              <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>

          {isScanning ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.scanningText}>Scanning railway radar within {radiusKm} km...</Text>
            </View>
          ) : stations.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🚆</Text>
              <Text style={styles.emptyTitle}>No Stations Found within {radiusKm} km</Text>
              <Text style={styles.emptySubtitle}>Try expanding the scan radius to 25 km or 40 km.</Text>
            </View>
          ) : (
            <FlatList
              data={stations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => (
                <View style={styles.stationCard}>
                  <View style={styles.stationBadge}>
                    <Text style={styles.stationBadgeIndex}>{index + 1}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.stationName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.stationCity}>{item.city}</Text>
                    <Text style={styles.stationDistance}>📍 {item.distanceLabel || `${item.distanceKm} km from you`}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.routeBtn}
                    onPress={() => handleRouteToStation(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.routeBtnText}>Route ↗</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* ── Sub-Tab 2: Saved & Offline Routes ────────────────────── */}
      {activeTab === 'saved' && (
        <View style={styles.savedContainer}>
          {/* Offline Cache Status Card */}
          <View style={styles.cacheCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 24, marginRight: 8 }}>💾</Text>
              <View>
                <Text style={styles.cacheTitle}>Offline Navigation Cache</Text>
                <Text style={styles.cacheSubtitle}>
                  {cachedRouteInfo
                    ? `Cached route ready (${cachedRouteInfo.routeCoords?.length || 0} points)`
                    : 'No route currently stored for offline'}
                </Text>
              </View>
            </View>

            {cachedRouteInfo && (
              <TouchableOpacity style={styles.clearCacheBtn} onPress={handleClearCachedRoute}>
                <Text style={styles.clearCacheBtnText}>🗑️ Clear Cached Route</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Favorite Destinations */}
          <View style={styles.placesHeader}>
            <Text style={styles.placesSectionTitle}>Saved Places</Text>
            <TouchableOpacity onPress={() => setIsAddingPlace(!isAddingPlace)}>
              <Text style={styles.addPlaceBtnText}>{isAddingPlace ? 'Cancel' : '+ Add Place'}</Text>
            </TouchableOpacity>
          </View>

          {isAddingPlace && (
            <View style={styles.addPlaceBox}>
              <TextInput
                style={styles.placeInput}
                placeholder="Place name (e.g. My Office)"
                value={newPlaceName}
                onChangeText={setNewPlaceName}
              />
              <TouchableOpacity style={styles.savePlaceBtn} onPress={handleAddPlace}>
                <Text style={styles.savePlaceBtnText}>Save Current GPS</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={savedPlaces}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={styles.placeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeName}>{item.name}</Text>
                  <Text style={styles.placeLabel}>{item.label}</Text>
                </View>

                {item.lat && item.lng && (
                  <TouchableOpacity
                    style={styles.navigatePlaceBtn}
                    onPress={() => handleNavigatePlace(item)}
                  >
                    <Text style={styles.navigatePlaceBtnText}>Go ➔</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },

  // Segmented Pill
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 3,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { color: '#0F172A', fontWeight: '700' },

  // Radius Bar
  radiusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  radiusLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radiusChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  radiusChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  radiusChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  refreshBtn: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4 },
  refreshBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  timerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timerBadgeText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },

  // Center Box
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scanningText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // List & Cards
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  stationBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stationBadgeIndex: { color: '#2563EB', fontWeight: 'bold', fontSize: 13 },
  stationName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  stationCity: { fontSize: 12, color: '#64748B', marginTop: 1 },
  stationDistance: { fontSize: 12, fontWeight: '700', color: '#EA580C', marginTop: 3 },
  routeBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  routeBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  // Saved Container
  savedContainer: { flex: 1, paddingHorizontal: 16 },
  cacheCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cacheTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  cacheSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  clearCacheBtn: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearCacheBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },

  // Places
  placesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  placesSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  addPlaceBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  addPlaceBox: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  placeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  savePlaceBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
  },
  savePlaceBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  placeName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  placeLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  navigatePlaceBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  navigatePlaceBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
});
