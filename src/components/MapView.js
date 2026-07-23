import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function YatraMap({ currentLat, currentLng, destLat, destLng, routeCoords }) {
  const webviewRef = useRef(null);

  const mapHtml = useMemo(() => {
    const initialLat = currentLat || 20.5937;
    const initialLng = currentLng || 78.9629;
    const initialZoom = currentLat ? 14 : 5;

    const initialData = JSON.stringify({ currentLat, currentLng, destLat, destLng, routeCoords });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { height: 100%; margin: 0; padding: 0; background: #e8f0fe; }
          .user-marker { background: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.4); }
          .dest-marker { background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.4); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false }).setView([${initialLat}, ${initialLng}], ${initialZoom});
          
          // High quality fast-loading tile layer
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);

          let userMarker = null;
          let destMarker = null;
          let routeLine = null;

          function updateMap(data) {
            if (!data) return;

            // Update User Location
            if (data.currentLat && data.currentLng) {
              if (!userMarker) {
                const icon = L.divIcon({ className: 'user-marker', iconSize: [18, 18] });
                userMarker = L.marker([data.currentLat, data.currentLng], { icon }).addTo(map);
                if (!data.destLat && !data.routeCoords) {
                  map.setView([data.currentLat, data.currentLng], 15);
                }
              } else {
                userMarker.setLatLng([data.currentLat, data.currentLng]);
              }
            }

            // Update Destination Location
            if (data.destLat && data.destLng) {
              if (!destMarker) {
                const icon = L.divIcon({ className: 'dest-marker', iconSize: [18, 18] });
                destMarker = L.marker([data.destLat, data.destLng], { icon }).addTo(map);
              } else {
                destMarker.setLatLng([data.destLat, data.destLng]);
              }
            } else if (destMarker) {
              map.removeLayer(destMarker);
              destMarker = null;
            }

            // Update Route Polyline
            if (data.routeCoords && data.routeCoords.length > 0) {
              if (routeLine) map.removeLayer(routeLine);
              const latLngs = data.routeCoords.map(coord => [coord.latitude, coord.longitude]);
              routeLine = L.polyline(latLngs, { color: '#2563EB', weight: 5, opacity: 0.8 }).addTo(map);
              map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            } else if (routeLine) {
              map.removeLayer(routeLine);
              routeLine = null;
            }
          }

          // Apply initial data
          updateMap(${initialData});

          // Listen for updates from React Native
          function handleMessage(event) {
            try {
              const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              updateMap(data);
            } catch(e) {}
          }

          window.addEventListener('message', handleMessage);
          document.addEventListener('message', handleMessage);
        </script>
      </body>
      </html>
    `;
  }, []);

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
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, backgroundColor: '#e8f0fe' },
});