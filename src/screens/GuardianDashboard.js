import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { useGuardianRealtime } from '../hooks/useGuardianRealtime';
import PairingScreen from './PairingScreen';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

export default function GuardianDashboard() {
  const { activeAlerts, pairedTravelers, resolveAlert } = useGuardianRealtime();
  const [showPairing, setShowPairing] = useState(false);

  const openInMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch((err) => console.warn('Could not open map URL:', err));
  };

  if (activeAlerts.length === 0) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <Text style={styles.title}>Guardian Dashboard</Text>
          <Text style={styles.subtitle}>
            Monitoring {pairedTravelers.length} paired traveler{pairedTravelers.length === 1 ? '' : 's'}.
          </Text>
          <TouchableOpacity style={styles.pairButton} onPress={() => setShowPairing(true)}>
            <Text style={styles.pairButtonText}>🔗 Add / Pair Traveler</Text>
          </TouchableOpacity>
          <View style={styles.statusPill}>
            <Text style={styles.safeText}>✅ All travelers are safe. No active SOS alerts.</Text>
          </View>
        </View>

        <Modal visible={showPairing} animationType="slide">
          <PairingScreen mode="Guardian" onClose={() => setShowPairing(false)} />
        </Modal>
      </SafeAreaView>
    );
  }

  // Calculate center of map based on latest active alert
  const latestAlert = activeAlerts[0] || activeAlerts[activeAlerts.length - 1];
  const hasCoords =
    latestAlert &&
    typeof latestAlert.latitude === 'number' &&
    typeof latestAlert.longitude === 'number';

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚨 SOS ALERT ACTIVE ({activeAlerts.length})</Text>
        <TouchableOpacity style={styles.headerPairBtn} onPress={() => setShowPairing(true)}>
          <Text style={styles.headerPairBtnText}>+ Pair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {hasCoords && (
          <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
            <Mapbox.Camera
              zoomLevel={14}
              centerCoordinate={[latestAlert.longitude, latestAlert.latitude]}
              animationMode="flyTo"
              animationDuration={1500}
            />

            {activeAlerts.map((alert) => {
              if (
                typeof alert.latitude !== 'number' ||
                typeof alert.longitude !== 'number'
              ) {
                return null;
              }
              return (
                <Mapbox.PointAnnotation
                  key={alert.id}
                  id={`alert-${alert.id}`}
                  coordinate={[alert.longitude, alert.latitude]}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerPulse} />
                    <View style={styles.marker} />
                  </View>
                </Mapbox.PointAnnotation>
              );
            })}
          </Mapbox.MapView>
        )}

        {/* Floating Alert Card */}
        {hasCoords && (
          <View style={styles.floatingCard}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Emergency SOS Location</Text>
                <Text style={styles.cardCoords}>
                  📍 {latestAlert.latitude.toFixed(5)}, {latestAlert.longitude.toFixed(5)}
                </Text>
                {latestAlert.timestamp && (
                  <Text style={styles.cardTime}>
                    Sent: {new Date(latestAlert.timestamp).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.cardBtnRow}>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => openInMaps(latestAlert.latitude, latestAlert.longitude)}
              >
                <Text style={styles.navigateBtnText}>🧭 Open in Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => resolveAlert(latestAlert.id)}
              >
                <Text style={styles.resolveBtnText}>✓ Mark Safe</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showPairing} animationType="slide">
        <PairingScreen mode="Guardian" onClose={() => setShowPairing(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  shieldIcon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 24, textAlign: 'center' },
  statusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 12,
  },
  safeText: { fontSize: 14, color: '#16A34A', fontWeight: 'bold', textAlign: 'center' },
  pairButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  pairButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerPairBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerPairBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  markerContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  marker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  floatingCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#DC2626' },
  cardCoords: { fontSize: 13, color: '#334155', fontWeight: '600', marginTop: 2 },
  cardTime: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cardBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  navigateBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  navigateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  resolveBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
