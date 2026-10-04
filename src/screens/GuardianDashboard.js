import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useGuardianRealtime } from '../hooks/useGuardianRealtime';
import PairingScreen from './PairingScreen';

export default function GuardianDashboard() {
  const { activeAlerts, pairedTravelers } = useGuardianRealtime();
  const [showPairing, setShowPairing] = useState(false);

  if (activeAlerts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Guardian Dashboard</Text>
        <Text style={styles.subtitle}>You have {pairedTravelers.length} paired travelers.</Text>
        <TouchableOpacity style={styles.pairButton} onPress={() => setShowPairing(true)}>
          <Text style={styles.pairButtonText}>🔗 Add Traveler</Text>
        </TouchableOpacity>
        <Text style={styles.safeText}>No active SOS alerts. All travelers are safe.</Text>

        <Modal visible={showPairing} animationType="slide">
          <PairingScreen mode="Guardian" onClose={() => setShowPairing(false)} />
        </Modal>
      </View>
    );
  }

  // Calculate center of map based on latest active alert
  const latestAlert = activeAlerts[activeAlerts.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚨 SOS ALERTS ACTIVE ({activeAlerts.length})</Text>
      </View>

      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera
          zoomLevel={12}
          centerCoordinate={[latestAlert.longitude, latestAlert.latitude]}
          animationMode="flyTo"
          animationDuration={2000}
        />
        
        {activeAlerts.map(alert => (
          <Mapbox.PointAnnotation
            key={alert.id}
            id={`alert-${alert.id}`}
            coordinate={[alert.longitude, alert.latitude]}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker} />
            </View>
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
      <Modal visible={showPairing} animationType="slide">
        <PairingScreen mode="Guardian" onClose={() => setShowPairing(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B', marginBottom: 24 },
  safeText: { fontSize: 18, color: '#16A34A', fontWeight: 'bold', textAlign: 'center' },
  header: { padding: 16, backgroundColor: '#EF4444', alignItems: 'center', paddingTop: 50 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  map: { flex: 1 },
  markerContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 15,
  },
  marker: {
    width: 15,
    height: 15,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pairButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 24,
  },
  pairButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
