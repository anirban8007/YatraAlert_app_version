import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Mapbox from '@rnmapbox/maps';

Mapbox.setAccessToken('YOUR_MAPBOX_ACCESS_TOKEN');

export default function YatraMap({ currentLat, currentLng, destLat, destLng, routeCoords }) {
  
  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera
          zoomLevel={14}
          centerCoordinate={currentLng && currentLat ? [currentLng, currentLat] : [78.9629, 20.5937]}
        />
        
        <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

        {destLat && destLng && (
          <Mapbox.PointAnnotation
            id="destLocation"
            coordinate={[destLng, destLat]}
          >
            <View style={styles.redPin} />
          </Mapbox.PointAnnotation>
        )}

        {routeCoords && routeCoords.length > 0 && (
          <Mapbox.ShapeSource
            id="routeSource"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoords.map(coord => [coord.longitude, coord.latitude]),
              },
            }}
          >
            <Mapbox.LineLayer
              id="routeFill"
              style={{
                lineColor: '#2563EB',
                lineWidth: 5,
                lineOpacity: 0.8,
              }}
            />
          </Mapbox.ShapeSource>
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
    elevation: 5
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
    elevation: 5
  }
});