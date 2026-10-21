import Mapbox from '@rnmapbox/maps';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

export default function YatraMap({
  currentLat,
  currentLng,
  destLat,
  destLng,
  routeCoords,
  trainLegs = null,
  originStation = null,
  destStation = null,
  activeLegIndex = 0,
}) {
  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
  }, []);

  const hasTrainLegs = Array.isArray(trainLegs) && trainLegs.length > 0;

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera
          zoomLevel={13}
          centerCoordinate={currentLng && currentLat ? [currentLng, currentLat] : [78.9629, 20.5937]}
        />

        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

        {/* Destination Pin */}
        {destLat && destLng && (
          <Mapbox.PointAnnotation id="destLocation" coordinate={[destLng, destLat]}>
            <View style={styles.redPin} />
          </Mapbox.PointAnnotation>
        )}

        {/* Multi-modal Train Mode Station Pins */}
        {hasTrainLegs && originStation?.lat && originStation?.lng && (
          <Mapbox.PointAnnotation
            id="originStationPin"
            coordinate={[originStation.lng, originStation.lat]}
          >
            <View style={[styles.stationPin, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.stationPinText}>🚉</Text>
            </View>
          </Mapbox.PointAnnotation>
        )}

        {hasTrainLegs && destStation?.lat && destStation?.lng && (
          <Mapbox.PointAnnotation
            id="destStationPin"
            coordinate={[destStation.lng, destStation.lat]}
          >
            <View style={[styles.stationPin, { backgroundColor: '#EA580C' }]}>
              <Text style={styles.stationPinText}>🚉</Text>
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* ── Multi-Modal Train Legs Rendering ── */}
        {hasTrainLegs ? (
          trainLegs.map((leg, index) => {
            if (!leg.coords || leg.coords.length < 2) return null;
            const isTrain = leg.type === 'train';
            const isActive = index === activeLegIndex;

            return (
              <React.Fragment key={leg.id || `leg_${index}`}>
                <Mapbox.ShapeSource
                  id={`shape_${leg.id || index}`}
                  shape={{
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: leg.coords.map((c) => [c.longitude, c.latitude]),
                    },
                  }}
                >
                  {isTrain ? (
                    <>
                      {/* Train Track Base (Railway bed) */}
                      <Mapbox.LineLayer
                        id={`line_bed_${leg.id || index}`}
                        style={{
                          lineColor: '#7C2D12',
                          lineWidth: isActive ? 7 : 5,
                          lineOpacity: 0.9,
                        }}
                      />
                      {/* Train Track Ties (Dashed Orange Line) */}
                      <Mapbox.LineLayer
                        id={`line_track_${leg.id || index}`}
                        style={{
                          lineColor: '#FB923C',
                          lineWidth: isActive ? 5 : 3.5,
                          lineDasharray: [2, 2],
                          lineOpacity: 1.0,
                        }}
                      />
                    </>
                  ) : (
                    /* Road Leg */
                    <Mapbox.LineLayer
                      id={`line_road_${leg.id || index}`}
                      style={{
                        lineColor: isActive ? '#2563EB' : '#64748B',
                        lineWidth: isActive ? 6 : 4,
                        lineOpacity: isActive ? 0.9 : 0.6,
                      }}
                    />
                  )}
                </Mapbox.ShapeSource>
              </React.Fragment>
            );
          })
        ) : (
          /* ── Standard Single Road Route ── */
          routeCoords && routeCoords.length > 0 && (
            <Mapbox.ShapeSource
              id="routeSource"
              shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords.map((coord) => [coord.longitude, coord.latitude]),
                },
              }}
            >
              <Mapbox.LineLayer
                id="routeFill"
                style={{
                  lineColor: '#2563EB',
                  lineWidth: 5,
                  lineOpacity: 0.85,
                }}
              />
            </Mapbox.ShapeSource>
          )
        )}
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  blueDot: {
    height: 20,
    width: 20,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    borderColor: 'white',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  redPin: {
    height: 30,
    width: 30,
    backgroundColor: '#EF4444',
    borderRadius: 15,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '45deg' }],
    borderColor: 'white',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  stationPin: {
    height: 30,
    width: 30,
    borderRadius: 15,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  stationPinText: {
    fontSize: 14,
  },
});