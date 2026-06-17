import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function YatraMap({ currentLat, currentLng, destLat, destLng, routeCoords }) {
  const webviewRef = useRef(null);

  // This HTML contains the pure Leaflet setup, completely independent of Google.
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { height: 100%; margin: 0; padding: 0; background: #e8f0fe; }
        /* Custom User Marker */
        .user-marker { background: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
        /* Custom Dest Marker */
        .dest-marker { background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // Initialize Map
        const map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);
        
        // OpenStreetMap Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        let userMarker = null;
        let destMarker = null;
        let routeLine = null;

        // Listen for real-time updates from React Native
        document.addEventListener('message', function(event) {
          const data = JSON.parse(event.data);
          
          // Update User Location
          if (data.currentLat && data.currentLng) {
            if (!userMarker) {
              const icon = L.divIcon({ className: 'user-marker', iconSize: [16, 16] });
              userMarker = L.marker([data.currentLat, data.currentLng], { icon }).addTo(map);
              map.setView([data.currentLat, data.currentLng], 15);
            } else {
              userMarker.setLatLng([data.currentLat, data.currentLng]);
            }
          }

          // Update Destination
          if (data.destLat && data.destLng) {
            if (!destMarker) {
              const icon = L.divIcon({ className: 'dest-marker', iconSize: [16, 16] });
              destMarker = L.marker([data.destLat, data.destLng], { icon }).addTo(map);
            } else {
              destMarker.setLatLng([data.destLat, data.destLng]);
            }
          } else if (destMarker) {
            map.removeLayer(destMarker);
            destMarker = null;
          }

          // Update Route Line
          if (data.routeCoords && data.routeCoords.length > 0) {
            if (routeLine) map.removeLayer(routeLine);
            const latLngs = data.routeCoords.map(coord => [coord.latitude, coord.longitude]);
            routeLine = L.polyline(latLngs, { color: '#2563EB', weight: 5 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
          } else if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
          }
        });
      </script>
    </body>
    </html>
  `;

  // Send new coordinates to the Leaflet map whenever React Native state changes
  useEffect(() => {
    if (webviewRef.current) {
      const data = JSON.stringify({ currentLat, currentLng, destLat, destLng, routeCoords });
      webviewRef.current.postMessage(data);
    }
  }, [currentLat, currentLng, destLat, destLng, routeCoords]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, backgroundColor: '#e8f0fe' },
});